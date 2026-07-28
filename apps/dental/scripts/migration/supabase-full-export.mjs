import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const KNOWN_STAGE_REF = 'kafbqdliromcveojtdar'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..', '..')
const repoRoot = path.resolve(appRoot, '..', '..')
const DEFAULT_OUTPUT_ROOT = path.join(repoRoot, 'tmp', 'supabase-production-export')

const APP_TABLES = [
  'workspaces',
  'clinics',
  'workspace_users',
  'workspace_members',
  'clinic_users',
  'invitations',
  'user_settings',
  'verification_codes',
  'category_types',
  'categories',
  'custom_categories',
  'patient_sources',
  'settings_time',
  'clinic_google_calendar',
  'fixed_costs',
  'assets',
  'supplies',
  'services',
  'service_supplies',
  'tariffs',
  'marketing_campaigns',
  'marketing_campaign_status_history',
  'patients',
  'treatments',
  'expenses',
  'ai_chat_sessions',
  'ai_chat_messages',
  'chat_sessions',
  'chat_messages',
  'ai_feedback',
  'workspace_activity',
  'public_bookings',
  'public_booking_services',
  'booking_blocked_slots',
  'medications',
  'prescriptions',
  'prescription_items',
  'quotes',
  'quote_items',
  'email_notifications',
  'scheduled_reminders',
  'sms_notifications',
  'push_subscriptions',
  'push_notifications',
  'clinic_snapshots',
  'custom_role_templates',
  'role_permissions',
  'leads',
  'marketing_campaign_channels',
  'inbox_conversations',
  'inbox_messages',
  'notification_retry_queue',
  'whatsapp_notifications',
  'whatsapp_templates',
  'action_logs',
  'organizations',
]

const STORAGE_BUCKETS = ['clinic-snapshots']

const options = parseArgs(process.argv.slice(2))
if (options.help) {
  printHelp()
  process.exit(0)
}

if (options.envFile) {
  loadEnv(path.resolve(process.cwd(), options.envFile))
}

const envInfo = assertSafeEnv(options)
const supabase = createClient(envInfo.supabaseUrl, envInfo.serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const startedAt = new Date()
const exportDir = path.join(
  path.resolve(process.cwd(), options.outputRoot ?? DEFAULT_OUTPUT_ROOT),
  `supabase-export-${formatTimestamp(startedAt)}`
)
const tablesDir = path.join(exportDir, 'tables')
const storageDir = path.join(exportDir, 'storage')
fs.mkdirSync(tablesDir, { recursive: true })

log(`Supabase ref: ${envInfo.urlRef}`)
log(`Output: ${path.relative(repoRoot, exportDir)}`)
log('Mode: READ ONLY export. No remote writes are performed.')

const manifest = {
  generatedAt: startedAt.toISOString(),
  finishedAt: null,
  safety: {
    readOnly: true,
    writesPerformed: false,
    containsPii: true,
    productionExportConfirmed: options.confirmProductionExport,
    notes: [
      'This export contains production data and must remain outside git.',
      'Auth user export does not include password hashes; Supabase Auth passwords cannot be migrated from the admin API.',
      'Storage files are downloaded only when --include-storage is passed.',
    ],
  },
  target: {
    supabaseRef: envInfo.urlRef,
    serviceRoleRef: envInfo.jwtRef ?? null,
    serviceRoleRole: envInfo.jwtRole ?? null,
    envFile: options.envFile ? path.relative(repoRoot, path.resolve(process.cwd(), options.envFile)) : null,
  },
  tables: [],
  authUsers: null,
  storage: [],
  totals: {
    tablesExported: 0,
    tableRows: 0,
    authUsersExported: 0,
    storageFiles: 0,
    storageBytes: 0,
  },
}

for (const tableName of options.tables.length > 0 ? options.tables : APP_TABLES) {
  const tableExport = await exportTable(tableName)
  manifest.tables.push(tableExport)
  if (tableExport.ok) {
    manifest.totals.tablesExported += 1
    manifest.totals.tableRows += tableExport.rows
  }
  writeManifest(manifest)
}

if (options.includeAuthUsers) {
  manifest.authUsers = await exportAuthUsers()
  manifest.totals.authUsersExported = manifest.authUsers.users
  writeManifest(manifest)
}

if (options.includeStorage) {
  fs.mkdirSync(storageDir, { recursive: true })
  for (const bucketName of STORAGE_BUCKETS) {
    const storageExport = await exportStorageBucket(bucketName)
    manifest.storage.push(storageExport)
    manifest.totals.storageFiles += storageExport.files
    manifest.totals.storageBytes += storageExport.bytes
    writeManifest(manifest)
  }
}

manifest.finishedAt = new Date().toISOString()
writeManifest(manifest)

log(`Tables exported: ${manifest.totals.tablesExported}/${manifest.tables.length}`)
log(`Rows exported: ${manifest.totals.tableRows}`)
log(`Auth users exported: ${manifest.totals.authUsersExported}`)
log(`Storage files exported: ${manifest.totals.storageFiles} (${formatBytes(manifest.totals.storageBytes)})`)
log(`Manifest: ${path.relative(repoRoot, path.join(exportDir, 'manifest.json'))}`)

async function exportTable(tableName) {
  const outputPath = path.join(tablesDir, `${tableName}.jsonl`)
  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' })
  const pageSize = options.pageSize
  let offset = 0
  let rows = 0
  let count = null
  let ok = true
  let error = null

  try {
    while (true) {
      const query = supabase
        .from(tableName)
        .select('*', offset === 0 ? { count: 'exact' } : undefined)
        .range(offset, offset + pageSize - 1)

      const { data, count: exactCount, error: pageError } = await query

      if (pageError) {
        throw new Error(cleanSupabaseError(pageError))
      }

      if (offset === 0) count = exactCount ?? null

      for (const row of data ?? []) {
        stream.write(`${JSON.stringify(normalizeJson(row))}\n`)
        rows += 1
      }

      if (!data || data.length < pageSize) break
      offset += pageSize
    }
  } catch (caught) {
    ok = false
    error = caught instanceof Error ? caught.message : String(caught)
  } finally {
    await closeStream(stream)
  }

  const relativePath = path.relative(exportDir, outputPath)
  log(`Table ${tableName}: ${ok ? rows : `FAILED ${error}`}`)
  return {
    table: tableName,
    ok,
    rows,
    count,
    path: relativePath,
    error,
  }
}

async function exportAuthUsers() {
  const outputPath = path.join(exportDir, 'auth-users.jsonl')
  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' })
  const perPage = 1000
  let page = 1
  let users = 0
  let ok = true
  let error = null

  try {
    while (true) {
      const { data, error: pageError } = await supabase.auth.admin.listUsers({ page, perPage })
      if (pageError) {
        throw new Error(cleanSupabaseError(pageError))
      }

      const pageUsers = data?.users ?? []
      for (const user of pageUsers) {
        stream.write(`${JSON.stringify(normalizeJson(user))}\n`)
        users += 1
      }

      if (pageUsers.length < perPage) break
      page += 1
    }
  } catch (caught) {
    ok = false
    error = caught instanceof Error ? caught.message : String(caught)
  } finally {
    await closeStream(stream)
  }

  log(`Auth users: ${ok ? users : `FAILED ${error}`}`)
  return {
    ok,
    users,
    path: path.relative(exportDir, outputPath),
    includesPasswordHashes: false,
    error,
  }
}

async function exportStorageBucket(bucketName) {
  const bucketRoot = path.join(storageDir, bucketName)
  const result = {
    bucket: bucketName,
    ok: true,
    files: 0,
    bytes: 0,
    path: path.relative(exportDir, bucketRoot),
    error: null,
  }

  fs.mkdirSync(bucketRoot, { recursive: true })

  try {
    await walkStoragePrefix(bucketName, '', bucketRoot, result, 0)
  } catch (caught) {
    result.ok = false
    result.error = caught instanceof Error ? caught.message : String(caught)
  }

  log(`Storage ${bucketName}: ${result.ok ? `${result.files} files` : `FAILED ${result.error}`}`)
  return result
}

async function walkStoragePrefix(bucketName, prefix, bucketRoot, result, depth) {
  if (depth > 12) {
    throw new Error(`Storage recursion depth exceeded at ${prefix}`)
  }

  const limit = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase.storage.from(bucketName).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) throw new Error(cleanSupabaseError(error))

    const entries = data ?? []
    for (const entry of entries) {
      const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name
      const metadata = entry.metadata ?? {}
      const isFile = Boolean(entry.id) || typeof metadata.size === 'number'

      if (!isFile) {
        await walkStoragePrefix(bucketName, objectPath, bucketRoot, result, depth + 1)
        continue
      }

      const { data: blob, error: downloadError } = await supabase.storage.from(bucketName).download(objectPath)
      if (downloadError) throw new Error(`${objectPath}: ${cleanSupabaseError(downloadError)}`)

      const destination = safeJoin(bucketRoot, objectPath)
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.writeFileSync(destination, Buffer.from(await blob.arrayBuffer()))
      result.files += 1
      result.bytes += Number(metadata.size ?? fs.statSync(destination).size)
    }

    if (entries.length < limit) break
    offset += limit
  }
}

function parseArgs(args) {
  const parsed = {
    help: false,
    envFile: null,
    confirmProductionExport: false,
    includeAuthUsers: false,
    includeStorage: false,
    outputRoot: null,
    pageSize: 1000,
    tables: [],
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') {
      parsed.help = true
    } else if (arg === '--env-file') {
      parsed.envFile = args[index + 1]
      index += 1
    } else if (arg === '--confirm-production-export') {
      parsed.confirmProductionExport = true
    } else if (arg === '--include-auth-users') {
      parsed.includeAuthUsers = true
    } else if (arg === '--include-storage') {
      parsed.includeStorage = true
    } else if (arg === '--output-root') {
      parsed.outputRoot = args[index + 1]
      index += 1
    } else if (arg === '--page-size') {
      parsed.pageSize = Number(args[index + 1])
      index += 1
    } else if (arg === '--tables') {
      parsed.tables = args[index + 1]
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
      index += 1
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!Number.isInteger(parsed.pageSize) || parsed.pageSize < 1 || parsed.pageSize > 1000) {
    throw new Error('--page-size must be an integer from 1 to 1000')
  }

  return parsed
}

function printHelp() {
  console.log(`
Usage:
  node apps/dental/scripts/migration/supabase-full-export.mjs --env-file apps/dental/.env.production.local --confirm-production-export --include-auth-users --include-storage

Options:
  --env-file <path>              Load Supabase env vars from an ignored local env file.
  --confirm-production-export    Required when the Supabase ref is not the known QA/stage ref.
  --include-auth-users           Export Supabase Auth user records. Password hashes are not available.
  --include-storage              Download Storage files from clinic-snapshots.
  --output-root <path>           Defaults to tmp/supabase-production-export.
  --tables table_a,table_b       Optional narrow table list.
  --page-size <1-1000>           Defaults to 1000.
`)
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`)
  }

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

function assertSafeEnv(parsedOptions) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Pass --env-file or export them in the shell.'
    )
  }

  const urlRef = getSupabaseRef(supabaseUrl)
  const jwtPayload = decodeJwtPayload(serviceRoleKey)
  const jwtRef = jwtPayload?.ref ?? null
  const jwtRole = jwtPayload?.role ?? null

  if (jwtRef && urlRef && jwtRef !== urlRef) {
    throw new Error(`Refusing to run: Supabase URL ref is ${urlRef}, but service role key ref is ${jwtRef}.`)
  }

  if (urlRef !== KNOWN_STAGE_REF && !parsedOptions.confirmProductionExport) {
    throw new Error(
      `Refusing to export non-stage Supabase ref ${urlRef}. Add --confirm-production-export to export production.`
    )
  }

  if (jwtRole && jwtRole !== 'service_role') {
    throw new Error(`Expected SUPABASE_SERVICE_ROLE_KEY role service_role, got ${jwtRole}.`)
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    urlRef,
    jwtRef,
    jwtRole,
  }
}

function writeManifest(manifest) {
  fs.writeFileSync(path.join(exportDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

function normalizeJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function safeJoin(root, relativePath) {
  const destination = path.resolve(root, relativePath)
  const resolvedRoot = path.resolve(root)
  if (!destination.startsWith(`${resolvedRoot}${path.sep}`) && destination !== resolvedRoot) {
    throw new Error(`Unsafe storage path: ${relativePath}`)
  }
  return destination
}

function closeStream(stream) {
  return new Promise((resolve, reject) => {
    stream.end((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

function getSupabaseRef(supabaseUrl) {
  try {
    const hostname = new URL(supabaseUrl).hostname
    return hostname.endsWith('.supabase.co') ? hostname.split('.')[0] : hostname
  } catch {
    return 'invalid-url'
  }
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

function cleanSupabaseError(error) {
  const message = [error.code, error.message].filter(Boolean).join(' ')
  return message || JSON.stringify(error)
}

function formatTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function log(message) {
  console.log(`[supabase-full-export] ${message}`)
}
