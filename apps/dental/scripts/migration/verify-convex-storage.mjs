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
if (!convexUrl) throw new Error('Missing NEXT_PUBLIC_CONVEX_URL.')

const manifestPath = path.resolve(process.cwd(), args.manifest)
const exportDir = path.dirname(manifestPath)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const { api } = await import(pathToFileURL(path.join(appRoot, 'convex', '_generated', 'api.js')).href)
const client = new ConvexHttpClient(convexUrl)

const expected = []
for (const bucket of manifest.storage ?? []) {
  if (!bucket.ok) continue
  if (args.buckets.length > 0 && !args.buckets.includes(bucket.bucket)) continue
  const bucketRoot = path.join(exportDir, bucket.path)
  for (const filePath of listFiles(bucketRoot)) {
    const buffer = fs.readFileSync(filePath)
    expected.push({
      bucket: bucket.bucket,
      path: normalizeObjectPath(path.relative(bucketRoot, filePath)),
      size: buffer.length,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    })
  }
}

const actualRows = []
const bucketNames = [...new Set(expected.map((row) => row.bucket))]
for (const bucket of bucketNames) {
  const rows = await client.query(api.migration.listStorageObjects, {
    bucket,
    limit: Math.max(1000, expected.length + 10),
  })
  actualRows.push(...rows)
}

const actualByKey = new Map(actualRows.map((row) => [`${row.bucket}/${row.path}`, row]))
const missing = []
const mismatches = []

for (const expectedRow of expected) {
  const key = `${expectedRow.bucket}/${expectedRow.path}`
  const actual = actualByKey.get(key)
  if (!actual) {
    missing.push(expectedRow)
    continue
  }
  if (actual.size !== expectedRow.size || actual.sha256 !== expectedRow.sha256) {
    mismatches.push({
      bucket: expectedRow.bucket,
      path: expectedRow.path,
      expected: { size: expectedRow.size, sha256: expectedRow.sha256 },
      actual: { size: actual.size ?? null, sha256: actual.sha256 ?? null },
    })
  }
}

const expectedKeys = new Set(expected.map((row) => `${row.bucket}/${row.path}`))
const extra = actualRows
  .filter((row) => !expectedKeys.has(`${row.bucket}/${row.path}`))
  .map((row) => ({ bucket: row.bucket, path: row.path, size: row.size ?? null, sha256: row.sha256 ?? null }))

const result = {
  generatedAt: new Date().toISOString(),
  convexUrlHost: new URL(convexUrl).host,
  sourceManifest: path.relative(repoRoot, manifestPath),
  ok: missing.length === 0 && mismatches.length === 0 && extra.length === 0,
  expectedFiles: expected.length,
  actualFiles: actualRows.length,
  expectedBytes: expected.reduce((sum, row) => sum + row.size, 0),
  actualBytes: actualRows.reduce((sum, row) => sum + Number(row.size ?? 0), 0),
  missing,
  mismatches,
  extra,
}

const outputDir = path.resolve(process.cwd(), args.outputDir ?? DEFAULT_OUTPUT_DIR)
fs.mkdirSync(outputDir, { recursive: true })
const outputPath = path.join(outputDir, `convex-storage-verify-${formatTimestamp(new Date())}.json`)
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`)

if (!result.ok) {
  console.error(`[verify-convex-storage] Mismatches: missing=${missing.length} changed=${mismatches.length} extra=${extra.length}`)
  console.error(`[verify-convex-storage] Wrote ${path.relative(repoRoot, outputPath)}`)
  process.exit(1)
}

console.log(`[verify-convex-storage] OK: ${result.actualFiles} files, ${result.actualBytes} bytes`)
console.log(`[verify-convex-storage] Wrote ${path.relative(repoRoot, outputPath)}`)

function listFiles(root) {
  if (!fs.existsSync(root)) return []
  const entries = fs.readdirSync(root, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(entryPath))
    else if (entry.isFile()) files.push(entryPath)
  }

  return files.sort((a, b) => a.localeCompare(b))
}

function normalizeObjectPath(relativePath) {
  return relativePath.split(path.sep).join('/')
}

function parseArgs(argv) {
  const parsed = {
    help: false,
    manifest: null,
    envFile: null,
    outputDir: null,
    buckets: [],
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
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!parsed.help && !parsed.manifest) throw new Error('Missing --manifest')
  return parsed
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
  node apps/dental/scripts/migration/verify-convex-storage.mjs --manifest tmp/supabase-production-export/<export>/manifest.json
`)
}
