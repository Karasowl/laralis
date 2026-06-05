import fs from 'node:fs'
import path from 'node:path'

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  printHelp()
  process.exit(0)
}

const manifestPath = path.resolve(process.cwd(), args.manifest)
const exportDir = path.dirname(manifestPath)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const outputDir = path.resolve(process.cwd(), args.outputDir ?? path.join(exportDir, 'convex-import'))
const tablesDir = path.join(outputDir, 'tables')

fs.mkdirSync(tablesDir, { recursive: true })

const prepared = {
  generatedAt: new Date().toISOString(),
  sourceManifest: path.relative(process.cwd(), manifestPath),
  encoding: {
    version: 1,
    fieldNameRule: 'Any character outside A-Z, a-z, 0-9, and _ is encoded as _u{hex}_; keys starting with _creationTime are prefixed.',
  },
  tables: [],
  skippedTables: [],
  authUsers: null,
  storage: manifest.storage ?? [],
  totals: {
    tablesPrepared: 0,
    rowsPrepared: 0,
    emptyTablesPrepared: 0,
    encodedKeys: 0,
  },
}

for (const table of manifest.tables ?? []) {
  if (!table.ok) {
    prepared.skippedTables.push({
      table: table.table,
      ok: false,
      rows: table.rows ?? 0,
      error: table.error ?? 'Unknown export error',
    })
    continue
  }

  if (table.rows === 0) {
    const destination = path.join(tablesDir, `${table.table}.jsonl`)
    fs.writeFileSync(destination, '')
    prepared.tables.push({
      table: table.table,
      rows: 0,
      encodedKeys: 0,
      path: path.relative(outputDir, destination),
      empty: true,
    })
    prepared.totals.tablesPrepared += 1
    prepared.totals.emptyTablesPrepared += 1
    log(`Table ${table.table}: 0 rows`)
    continue
  }

  const source = path.join(exportDir, table.path)
  const destination = path.join(tablesDir, `${table.table}.jsonl`)
  const result = prepareJsonl(source, destination, table.table)
  prepared.tables.push({
    table: table.table,
    rows: result.rows,
    encodedKeys: result.encodedKeys,
    path: path.relative(outputDir, destination),
    empty: false,
  })
  prepared.totals.tablesPrepared += 1
  prepared.totals.rowsPrepared += result.rows
  prepared.totals.encodedKeys += result.encodedKeys
  log(`Table ${table.table}: ${result.rows} rows, ${result.encodedKeys} encoded keys`)
}

if (manifest.authUsers?.ok && manifest.authUsers.users > 0) {
  const source = path.join(exportDir, manifest.authUsers.path)
  const destination = path.join(outputDir, 'supabase_auth_users.jsonl')
  const result = prepareJsonl(source, destination, 'supabase_auth_users')
  prepared.authUsers = {
    table: 'supabase_auth_users',
    rows: result.rows,
    encodedKeys: result.encodedKeys,
    path: path.relative(outputDir, destination),
    includesPasswordHashes: false,
  }
  prepared.totals.rowsPrepared += result.rows
  prepared.totals.encodedKeys += result.encodedKeys
  log(`Auth users: ${result.rows} rows, ${result.encodedKeys} encoded keys`)
}

fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(prepared, null, 2)}\n`)
log(`Prepared import: ${path.relative(process.cwd(), path.join(outputDir, 'manifest.json'))}`)

function prepareJsonl(source, destination, tableName) {
  const lines = fs.readFileSync(source, 'utf8').split(/\r?\n/).filter(Boolean)
  let rows = 0
  let encodedKeys = 0
  const outputLines = []

  for (const line of lines) {
    const row = JSON.parse(line)
    const encoded = encodeValue(row)
    encodedKeys += encoded.encodedKeys
    const doc = encoded.value

    if (typeof doc === 'object' && doc !== null && !Array.isArray(doc)) {
      if (row.id !== undefined && doc.legacyId === undefined) doc.legacyId = String(row.id)
      doc.legacyTable = tableName
    }

    outputLines.push(JSON.stringify(doc))
    rows += 1
  }

  fs.writeFileSync(destination, `${outputLines.join('\n')}\n`)
  return { rows, encodedKeys }
}

function encodeValue(value) {
  if (Array.isArray(value)) {
    let encodedKeys = 0
    const items = value.map((item) => {
      const encoded = encodeValue(item)
      encodedKeys += encoded.encodedKeys
      return encoded.value
    })
    return { value: items, encodedKeys }
  }

  if (value && typeof value === 'object') {
    let encodedKeys = 0
    const object = {}

    for (const [key, child] of Object.entries(value)) {
      const safeKey = encodeFieldName(key)
      if (safeKey !== key) encodedKeys += 1

      const encoded = encodeValue(child)
      encodedKeys += encoded.encodedKeys
      object[safeKey] = encoded.value
    }

    return { value: object, encodedKeys }
  }

  return { value, encodedKeys: 0 }
}

function encodeFieldName(key) {
  let encoded = ''

  for (const char of key) {
    encoded += /[A-Za-z0-9_]/.test(char) ? char : `_u${char.codePointAt(0).toString(16)}_`
  }

  if (!encoded) encoded = '_empty'
  if (encoded === '_id' || encoded === '_creationTime') encoded = `legacy${encoded}`
  return encoded
}

function parseArgs(argv) {
  const parsed = {
    help: false,
    manifest: null,
    outputDir: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      parsed.help = true
    } else if (arg === '--manifest') {
      parsed.manifest = argv[index + 1]
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

function printHelp() {
  console.log(`
Usage:
  node apps/dental/scripts/migration/prepare-convex-import.mjs --manifest tmp/supabase-production-export/<export>/manifest.json
`)
}

function log(message) {
  console.log(`[prepare-convex-import] ${message}`)
}
