import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ConvexHttpClient } from 'convex/browser'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..', '..')
const repoRoot = path.resolve(appRoot, '..', '..')
const DEFAULT_OUTPUT_DIR = path.join(repoRoot, 'tmp', 'convex-migration-audit')

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  printHelp()
  process.exit(0)
}

loadEnv(path.join(appRoot, '.env.local'))
if (args.envFile) loadEnv(path.resolve(process.cwd(), args.envFile))

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
const convexDeployment = process.env.CONVEX_DEPLOYMENT ?? ''
const secret = process.env.CONVEX_AUTH_BRIDGE_SECRET

if (!convexUrl) throw new Error('Missing NEXT_PUBLIC_CONVEX_URL.')
if (!secret) throw new Error('Missing CONVEX_AUTH_BRIDGE_SECRET.')
if (!convexDeployment.startsWith('dev:') && !args.confirmNonDev) {
  throw new Error(
    `Refusing to import storage into non-dev Convex deployment "${convexDeployment || 'unknown'}". Pass --confirm-non-dev if this is intentional.`
  )
}

const manifestPath = path.resolve(process.cwd(), args.manifest)
const exportDir = path.dirname(manifestPath)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const { api } = await import(pathToFileURL(path.join(appRoot, 'convex', '_generated', 'api.js')).href)
const client = new ConvexHttpClient(convexUrl)
const startedAt = new Date()

const buckets = (manifest.storage ?? [])
  .filter((bucket) => bucket.ok)
  .filter((bucket) => args.buckets.length === 0 || args.buckets.includes(bucket.bucket))

const result = {
  generatedAt: startedAt.toISOString(),
  finishedAt: null,
  convexUrlHost: new URL(convexUrl).host,
  convexDeployment,
  sourceManifest: path.relative(repoRoot, manifestPath),
  replace: args.replace,
  buckets: [],
  totals: {
    buckets: 0,
    filesFound: 0,
    filesUploaded: 0,
    filesSkipped: 0,
    bytesUploaded: 0,
    storageMetadataDeletedBeforeImport: 0,
    storageFilesDeletedBeforeImport: 0,
  },
}

for (const bucket of buckets) {
  const bucketRoot = path.join(exportDir, bucket.path)
  const bucketResult = {
    bucket: bucket.bucket,
    expectedFiles: bucket.files,
    expectedBytes: bucket.bytes,
    filesFound: 0,
    filesUploaded: 0,
    filesSkipped: 0,
    bytesUploaded: 0,
    ok: true,
    error: null,
  }

  try {
    if (args.replace) {
      const cleared = await client.mutation(api.migration.clearStorageObjects, {
        secret,
        bucket: bucket.bucket,
      })
      result.totals.storageMetadataDeletedBeforeImport += cleared.deletedMetadata
      result.totals.storageFilesDeletedBeforeImport += cleared.deletedFiles
      log(`${bucket.bucket}: cleared ${cleared.deletedMetadata} metadata rows and ${cleared.deletedFiles} blobs`)
    }

    const files = listFiles(bucketRoot)
    bucketResult.filesFound = files.length
    result.totals.filesFound += files.length

    for (let index = 0; index < files.length; index += 1) {
      const filePath = files[index]
      const objectPath = normalizeObjectPath(path.relative(bucketRoot, filePath))
      const buffer = fs.readFileSync(filePath)
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex')
      const contentType = inferContentType(objectPath)

      if (!args.replace) {
        const existing = await client.query(api.migration.findStorageObject, {
          secret,
          bucket: bucket.bucket,
          path: objectPath,
        })
        if (existing?.sha256 === sha256 && existing?.size === buffer.length) {
          bucketResult.filesSkipped += 1
          result.totals.filesSkipped += 1
          continue
        }
      }

      const uploadUrl = await client.mutation(api.migration.generateStorageUploadUrl, { secret })
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: buffer,
      })

      if (!uploadResponse.ok) {
        throw new Error(`${objectPath}: Convex storage upload failed ${uploadResponse.status} ${await uploadResponse.text()}`)
      }

      const uploadResult = await uploadResponse.json()
      if (!uploadResult.storageId) {
        throw new Error(`${objectPath}: Convex upload response did not include storageId`)
      }

      await client.mutation(api.migration.recordStorageObject, {
        secret,
        bucket: bucket.bucket,
        path: objectPath,
        storageId: uploadResult.storageId,
        size: buffer.length,
        sha256,
        contentType,
        source: path.relative(repoRoot, manifestPath),
      })

      bucketResult.filesUploaded += 1
      bucketResult.bytesUploaded += buffer.length
      result.totals.filesUploaded += 1
      result.totals.bytesUploaded += buffer.length

      if ((index + 1) % args.progressEvery === 0) {
        log(`${bucket.bucket}: ${index + 1}/${files.length}`)
      }
    }

    log(`${bucket.bucket}: ${bucketResult.filesUploaded} uploaded, ${bucketResult.filesSkipped} skipped`)
  } catch (caught) {
    bucketResult.ok = false
    bucketResult.error = caught instanceof Error ? caught.message : String(caught)
    result.buckets.push(bucketResult)
    writeAudit(result)
    throw caught
  }

  result.buckets.push(bucketResult)
  result.totals.buckets += 1
  writeAudit(result)
}

result.finishedAt = new Date().toISOString()
const auditPath = writeAudit(result)
log(`OK: ${result.totals.filesUploaded} uploaded, ${result.totals.filesSkipped} skipped`)
log(`Audit: ${path.relative(repoRoot, auditPath)}`)

function listFiles(root) {
  if (!fs.existsSync(root)) return []
  const entries = fs.readdirSync(root, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath))
    } else if (entry.isFile()) {
      files.push(entryPath)
    }
  }

  return files.sort((a, b) => a.localeCompare(b))
}

function normalizeObjectPath(relativePath) {
  return relativePath.split(path.sep).join('/')
}

function inferContentType(objectPath) {
  if (objectPath.endsWith('.json.gz')) return 'application/gzip'
  if (objectPath.endsWith('.json')) return 'application/json'
  return 'application/octet-stream'
}

function parseArgs(argv) {
  const parsed = {
    help: false,
    manifest: null,
    envFile: null,
    outputDir: null,
    buckets: [],
    replace: false,
    confirmNonDev: false,
    progressEvery: 25,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      parsed.help = true
    } else if (arg === '--manifest') {
      parsed.manifest = argv[index + 1]
      index += 1
    } else if (arg === '--env-file') {
      parsed.envFile = argv[index + 1]
      index += 1
    } else if (arg === '--output-dir') {
      parsed.outputDir = argv[index + 1]
      index += 1
    } else if (arg === '--buckets') {
      parsed.buckets = argv[index + 1].split(',').map((bucket) => bucket.trim()).filter(Boolean)
      index += 1
    } else if (arg === '--replace') {
      parsed.replace = true
    } else if (arg === '--confirm-non-dev') {
      parsed.confirmNonDev = true
    } else if (arg === '--progress-every') {
      parsed.progressEvery = Number(argv[index + 1])
      index += 1
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!parsed.help && !parsed.manifest) throw new Error('Missing --manifest')
  if (!Number.isInteger(parsed.progressEvery) || parsed.progressEvery < 1) {
    throw new Error('--progress-every must be a positive integer')
  }

  return parsed
}

function writeAudit(result) {
  const outputDir = path.resolve(process.cwd(), args.outputDir ?? DEFAULT_OUTPUT_DIR)
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `convex-storage-import-${formatTimestamp(startedAt)}.json`)
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`)
  return outputPath
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue

    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) process.env[key] = value
  }
}

function formatTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function printHelp() {
  console.log(`
Usage:
  node apps/dental/scripts/migration/import-convex-storage.mjs --manifest tmp/supabase-production-export/<export>/manifest.json --replace

Options:
  --manifest <path>          Supabase export manifest with storage entries.
  --replace                  Delete existing Convex storage metadata/blobs for the bucket before import.
  --buckets a,b              Optional comma-separated bucket allow-list.
  --env-file <path>          Optional env file. apps/dental/.env.local is loaded automatically.
  --confirm-non-dev          Allow importing into a non-dev Convex deployment.
  --output-dir <path>        Defaults to tmp/convex-migration-audit.
  --progress-every <n>       Defaults to 25.
`)
}

function log(message) {
  console.log(`[import-convex-storage] ${message}`)
}
