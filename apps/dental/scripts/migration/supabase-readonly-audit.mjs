import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const KNOWN_STAGE_REF = 'kafbqdliromcveojtdar'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..', '..')
const repoRoot = path.resolve(appRoot, '..', '..')

const DEFAULT_OUTPUT_DIR = path.join(repoRoot, 'tmp', 'convex-migration-audit')

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
const TIMESTAMP_COLUMNS = ['created_at', 'updated_at', 'deleted_at']

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
log(`Supabase ref: ${envInfo.urlRef}`)
log(`Service role ref: ${envInfo.jwtRef ?? 'unknown'}`)
log('Mode: READ ONLY. This script uses table HEAD counts, timestamp-only selects, and storage listing.')

const tableNames = options.tables.length > 0 ? options.tables : APP_TABLES
const tableResults = []

for (const tableName of tableNames) {
  tableResults.push(await auditTable(tableName))
}

const storageResults = []
for (const bucketName of STORAGE_BUCKETS) {
  storageResults.push(await auditStorageBucket(bucketName))
}

const finishedAt = new Date()
const audit = {
  generatedAt: finishedAt.toISOString(),
  durationMs: finishedAt.getTime() - startedAt.getTime(),
  safety: {
    readOnly: true,
    writesPerformed: false,
    piiSelected: false,
    productionReadConfirmed: options.confirmReadonlyProduction,
    notes: [
      'No table row payloads are exported.',
      'Only row counts, timestamp extrema, RPC availability, and storage object metadata totals are recorded.',
      'Auth users are not listed to avoid exporting email/user PII.',
    ],
  },
  target: {
    supabaseRef: envInfo.urlRef,
    serviceRoleRef: envInfo.jwtRef ?? null,
    serviceRoleRole: envInfo.jwtRole ?? null,
    envFile: options.envFile ? path.relative(repoRoot, path.resolve(process.cwd(), options.envFile)) : null,
  },
  envKeysPresent: envPresence([
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'TOTP_ENCRYPTION_KEY',
    'CRON_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'RESEND_API_KEY',
    'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
  ]),
  tables: tableResults,
  storage: storageResults,
  totals: {
    tablesChecked: tableResults.length,
    tablesReadable: tableResults.filter((table) => table.ok).length,
    tablesMissingOrBlocked: tableResults.filter((table) => !table.ok).length,
    rowsAcrossReadableTables: tableResults.reduce((sum, table) => sum + (table.count ?? 0), 0),
    storageBucketsChecked: storageResults.length,
    storageFiles: storageResults.reduce((sum, bucket) => sum + (bucket.files ?? 0), 0),
    storageBytes: storageResults.reduce((sum, bucket) => sum + (bucket.bytes ?? 0), 0),
  },
  fingerprints: {
    tableInventorySha256: sha256(
      JSON.stringify(
        tableResults.map((table) => ({
          table: table.table,
          ok: table.ok,
          count: table.count,
          timestamps: table.timestamps,
        }))
      )
    ),
    storageInventorySha256: sha256(JSON.stringify(storageResults)),
  },
}

const outputDir = path.resolve(process.cwd(), options.outputDir ?? DEFAULT_OUTPUT_DIR)
fs.mkdirSync(outputDir, { recursive: true })
const outputPath = path.join(outputDir, `supabase-readonly-audit-${formatTimestamp(finishedAt)}.json`)
fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`)

log(`Tables readable: ${audit.totals.tablesReadable}/${audit.totals.tablesChecked}`)
log(`Rows counted across readable tables: ${audit.totals.rowsAcrossReadableTables}`)
log(`Storage files: ${audit.totals.storageFiles} (${formatBytes(audit.totals.storageBytes)})`)
log(`Wrote ${path.relative(repoRoot, outputPath)}`)

function parseArgs(args) {
  const parsed = {
    help: false,
    envFile: null,
    confirmReadonlyProduction: false,
    outputDir: null,
    tables: [],
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--help' || arg === '-h') {
      parsed.help = true
    } else if (arg === '--env-file') {
      parsed.envFile = args[index + 1]
      index += 1
    } else if (arg === '--confirm-readonly-production') {
      parsed.confirmReadonlyProduction = true
    } else if (arg === '--output-dir') {
      parsed.outputDir = args[index + 1]
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

  return parsed
}

function printHelp() {
  console.log(`
Usage:
  node apps/dental/scripts/migration/supabase-readonly-audit.mjs --env-file apps/dental/.env.qa.local
  node apps/dental/scripts/migration/supabase-readonly-audit.mjs --env-file apps/dental/.env.production.local --confirm-readonly-production

Options:
  --env-file <path>                    Load Supabase env vars from an ignored local env file.
  --confirm-readonly-production        Required when the Supabase ref is not the known QA/stage ref.
  --output-dir <path>                  Defaults to tmp/convex-migration-audit.
  --tables table_a,table_b             Optional narrow table list.

Safety:
  The script performs no inserts, updates, deletes, RPC SQL execution, or auth user export.
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

  if (urlRef !== KNOWN_STAGE_REF && !parsedOptions.confirmReadonlyProduction) {
    throw new Error(
      `Refusing to read non-stage Supabase ref ${urlRef}. Add --confirm-readonly-production to perform the read-only production audit.`
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

async function auditTable(tableName) {
  const result = {
    table: tableName,
    ok: false,
    count: null,
    timestamps: {},
    error: null,
  }

  const { count, error } = await supabase.from(tableName).select('*', {
    count: 'exact',
    head: true,
  })

  if (error) {
    result.error = cleanSupabaseError(error)
    log(`Table ${tableName}: ${result.error}`)
    return result
  }

  result.ok = true
  result.count = count ?? 0

  for (const columnName of TIMESTAMP_COLUMNS) {
    const timestamps = await getTimestampExtrema(tableName, columnName)
    if (timestamps.supported) {
      result.timestamps[columnName] = {
        min: timestamps.min,
        max: timestamps.max,
      }
    }
  }

  log(`Table ${tableName}: ${result.count}`)
  return result
}

async function getTimestampExtrema(tableName, columnName) {
  const minResult = await getTimestampExtreme(tableName, columnName, true)
  if (!minResult.supported) return minResult

  const maxResult = await getTimestampExtreme(tableName, columnName, false)
  if (!maxResult.supported) return maxResult

  return {
    supported: true,
    min: minResult.value,
    max: maxResult.value,
  }
}

async function getTimestampExtreme(tableName, columnName, ascending) {
  const { data, error } = await supabase
    .from(tableName)
    .select(columnName)
    .not(columnName, 'is', null)
    .order(columnName, { ascending })
    .limit(1)

  if (error) {
    if (isMissingColumnError(error)) {
      return { supported: false }
    }

    return { supported: false, error: cleanSupabaseError(error) }
  }

  return {
    supported: true,
    value: data?.[0]?.[columnName] ?? null,
  }
}

async function auditStorageBucket(bucketName) {
  const result = {
    bucket: bucketName,
    ok: false,
    files: 0,
    bytes: 0,
    latestUpdatedAt: null,
    prefixesVisited: 0,
    error: null,
  }

  try {
    await walkStoragePrefix(bucketName, '', result, 0)
    result.ok = true
    log(`Storage ${bucketName}: ${result.files} files, ${formatBytes(result.bytes)}`)
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    log(`Storage ${bucketName}: ${result.error}`)
  }

  return result
}

async function walkStoragePrefix(bucketName, prefix, result, depth) {
  if (depth > 12) {
    throw new Error(`Storage recursion depth exceeded at ${prefix}`)
  }

  result.prefixesVisited += 1
  const limit = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase.storage.from(bucketName).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) {
      throw new Error(cleanSupabaseError(error))
    }

    const entries = data ?? []
    for (const entry of entries) {
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name
      const metadata = entry.metadata ?? {}
      const isFile = Boolean(entry.id) || typeof metadata.size === 'number'

      if (isFile) {
        result.files += 1
        result.bytes += Number(metadata.size ?? 0)
        const updatedAt = entry.updated_at ?? entry.created_at ?? null
        if (updatedAt && (!result.latestUpdatedAt || updatedAt > result.latestUpdatedAt)) {
          result.latestUpdatedAt = updatedAt
        }
      } else {
        await walkStoragePrefix(bucketName, entryPath, result, depth + 1)
      }
    }

    if (entries.length < limit) break
    offset += limit
  }
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

function isMissingColumnError(error) {
  return error.code === '42703' || /column .* does not exist/i.test(error.message ?? '')
}

function envPresence(keys) {
  return Object.fromEntries(keys.map((key) => [key, Boolean(process.env[key])]))
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
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
  console.log(`[supabase-readonly-audit] ${message}`)
}
