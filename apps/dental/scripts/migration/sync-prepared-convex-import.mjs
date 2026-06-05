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
    `Refusing to sync non-dev Convex deployment "${convexDeployment || 'unknown'}". Pass --confirm-non-dev if this is intentional.`
  )
}

const manifestPath = path.resolve(process.cwd(), args.manifest)
const importDir = path.dirname(manifestPath)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const { api } = await import(pathToFileURL(path.join(appRoot, 'convex', '_generated', 'api.js')).href)
const client = new ConvexHttpClient(convexUrl)

const startedAt = new Date()
const tables = [...(manifest.tables ?? [])]
if (manifest.authUsers) tables.push(manifest.authUsers)

const result = {
  generatedAt: startedAt.toISOString(),
  finishedAt: null,
  convexUrlHost: new URL(convexUrl).host,
  convexDeployment,
  sourceManifest: path.relative(repoRoot, manifestPath),
  replace: args.replace,
  tables: [],
  totals: {
    tables: 0,
    rowsRead: 0,
    rowsUpserted: 0,
    rowsDeletedBeforeImport: 0,
  },
}

for (const table of tables) {
  const tableName = table.table
  const tableResult = {
    table: tableName,
    expectedRows: table.rows,
    deletedBeforeImport: 0,
    rowsRead: 0,
    rowsUpserted: 0,
    ok: true,
    error: null,
  }

  try {
    if (args.replace) {
      const cleared = await client.mutation(api.migration.clearTable, { secret, table: tableName })
      tableResult.deletedBeforeImport = cleared.deleted
      result.totals.rowsDeletedBeforeImport += cleared.deleted
    }

    const rows = table.rows > 0 ? readJsonl(path.join(importDir, table.path)) : []
    tableResult.rowsRead = rows.length
    result.totals.rowsRead += rows.length

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const legacyId = getLegacyId(row, index, tableName)
      await client.mutation(api.migration.upsertByLegacyId, {
        secret,
        table: tableName,
        legacyId,
        row,
      })
      tableResult.rowsUpserted += 1
      result.totals.rowsUpserted += 1

      if ((index + 1) % args.progressEvery === 0) {
        log(`${tableName}: ${index + 1}/${rows.length}`)
      }
    }

    log(`${tableName}: ${tableResult.rowsUpserted} rows upserted${args.replace ? ` after clearing ${tableResult.deletedBeforeImport}` : ''}`)
  } catch (caught) {
    tableResult.ok = false
    tableResult.error = caught instanceof Error ? caught.message : String(caught)
    result.tables.push(tableResult)
    writeAudit(result)
    throw caught
  }

  result.tables.push(tableResult)
  result.totals.tables += 1
  writeAudit(result)
}

result.finishedAt = new Date().toISOString()
const auditPath = writeAudit(result)
log(`OK: ${result.totals.tables} tables, ${result.totals.rowsUpserted} rows upserted`)
log(`Audit: ${path.relative(repoRoot, auditPath)}`)

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function getLegacyId(row, index, tableName) {
  if (row && typeof row === 'object') {
    if (row.legacyId !== undefined && row.legacyId !== null) return String(row.legacyId)
    if (row.id !== undefined && row.id !== null) return String(row.id)
  }
  return `${tableName}:${index}`
}

function writeAudit(result) {
  const outputDir = path.resolve(process.cwd(), args.outputDir ?? DEFAULT_OUTPUT_DIR)
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `convex-import-sync-${formatTimestamp(startedAt)}.json`)
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`)
  return outputPath
}

function parseArgs(argv) {
  const parsed = {
    help: false,
    manifest: null,
    envFile: null,
    outputDir: null,
    replace: false,
    confirmNonDev: false,
    progressEvery: 100,
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
  node apps/dental/scripts/migration/sync-prepared-convex-import.mjs --manifest tmp/supabase-production-export/<export>/convex-import/manifest.json --replace

Options:
  --manifest <path>          Prepared Convex import manifest.
  --replace                  Clear each listed Convex table before upserting rows. Needed for exact Supabase snapshot parity.
  --env-file <path>          Optional env file. apps/dental/.env.local is loaded automatically.
  --confirm-non-dev          Allow syncing a non-dev Convex deployment.
  --output-dir <path>        Defaults to tmp/convex-migration-audit.
  --progress-every <n>       Defaults to 100.
`)
}

function log(message) {
  console.log(`[sync-prepared-convex-import] ${message}`)
}
