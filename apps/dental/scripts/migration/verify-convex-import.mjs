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
if (!convexUrl) {
  throw new Error('Missing NEXT_PUBLIC_CONVEX_URL. Run npx convex dev --once or pass --env-file.')
}

const manifestPath = path.resolve(process.cwd(), args.manifest)
const prepared = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const expected = {}

for (const table of prepared.tables ?? []) {
  expected[table.table] = table.rows
}

if (prepared.authUsers) {
  expected[prepared.authUsers.table] = prepared.authUsers.rows
}

const { api } = await import(pathToFileURL(path.join(appRoot, 'convex', '_generated', 'api.js')).href)
const client = new ConvexHttpClient(convexUrl)
const tables = Object.keys(expected).sort()
const actual = await client.query(api.migration.tableCounts, { tables })
const mismatches = []

for (const table of tables) {
  if (actual[table] !== expected[table]) {
    mismatches.push({
      table,
      expected: expected[table],
      actual: actual[table] ?? null,
    })
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  convexUrlHost: new URL(convexUrl).host,
  sourceManifest: path.relative(repoRoot, manifestPath),
  ok: mismatches.length === 0,
  tablesChecked: tables.length,
  expectedRows: Object.values(expected).reduce((sum, count) => sum + count, 0),
  actualRows: Object.values(actual).reduce((sum, count) => sum + count, 0),
  mismatches,
}

const outputDir = path.resolve(process.cwd(), args.outputDir ?? DEFAULT_OUTPUT_DIR)
fs.mkdirSync(outputDir, { recursive: true })
const outputPath = path.join(outputDir, `convex-import-verify-${formatTimestamp(new Date())}.json`)
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`)

if (!result.ok) {
  console.error(`[verify-convex-import] Mismatches: ${mismatches.length}`)
  console.error(`[verify-convex-import] Wrote ${path.relative(repoRoot, outputPath)}`)
  process.exit(1)
}

console.log(`[verify-convex-import] OK: ${result.tablesChecked} tables, ${result.actualRows} rows`)
console.log(`[verify-convex-import] Wrote ${path.relative(repoRoot, outputPath)}`)

function parseArgs(argv) {
  const parsed = {
    help: false,
    manifest: null,
    envFile: null,
    outputDir: null,
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
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!parsed.help && !parsed.manifest) {
    throw new Error('Missing --manifest')
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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
  node apps/dental/scripts/migration/verify-convex-import.mjs --manifest tmp/supabase-production-export/<export>/convex-import/manifest.json
`)
}
