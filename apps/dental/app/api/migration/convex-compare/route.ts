import { NextRequest, NextResponse } from 'next/server'
import { getLegacyIdForTable, listConvexTable, prepareConvexRow } from '@/lib/convex/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PAGE_SIZE = 1000
const DEFAULT_LIMIT = 10000
const MAX_LIMIT = 10000

const COMPARABLE_TABLES = [
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
  'supabase_auth_users',
]

const DEFAULT_TABLES = [
  'workspaces',
  'clinics',
  'workspace_users',
  'workspace_members',
  'clinic_users',
  'patient_sources',
  'settings_time',
  'fixed_costs',
  'assets',
  'supplies',
  'services',
  'service_supplies',
  'tariffs',
  'marketing_campaigns',
  'patients',
  'treatments',
  'expenses',
  'clinic_snapshots',
  'supabase_auth_users',
]

type CompareIssue = {
  legacyId: string
  reason: 'missing_in_convex' | 'missing_in_supabase' | 'different'
  supabaseHash?: string
  convexHash?: string
}

export async function GET(request: NextRequest) {
  const authError = authorizeMigrationCheck(request)
  if (authError) return authError

  let tables: string[]
  try {
    tables = parseTables(request.nextUrl.searchParams.get('tables'))
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    )
  }
  const limit = parseLimit(request.nextUrl.searchParams.get('limit'))
  const sampleLimit = Math.max(1, Math.min(parseLimit(request.nextUrl.searchParams.get('sampleLimit')), 100))
  const results = []

  for (const table of tables) {
    try {
      const result = table === 'supabase_auth_users'
        ? await compareAuthUsers(limit, sampleLimit)
        : await comparePublicTable(table, limit, sampleLimit)
      results.push(result)
    } catch (error) {
      results.push({
        table,
        ok: false,
        supabaseRows: null,
        convexRows: null,
        issueCount: 1,
        issues: [
          {
            legacyId: table,
            reason: 'different',
            supabaseHash: error instanceof Error ? error.message : String(error),
          },
        ],
      })
    }
  }

  return NextResponse.json({
    ok: results.every((result) => result.ok),
    generatedAt: new Date().toISOString(),
    limit,
    tables: results,
  })
}

async function comparePublicTable(table: string, limit: number, sampleLimit: number) {
  const supabaseRows = await readSupabaseTable(table, limit)
  const convexRows = await listConvexTable(table, limit) as Array<Record<string, unknown>>

  if (!supabaseRows.ok) {
    if (supabaseRows.missingInSupabase) {
      return compareMissingSupabaseTable(table, convexRows, sampleLimit, supabaseRows.error)
    }

    return {
      table,
      ok: false,
      supabaseRows: supabaseRows.rows.length,
      convexRows: convexRows.length,
      issueCount: 1,
      issues: [{ legacyId: table, reason: 'missing_in_supabase', supabaseHash: supabaseRows.error }] as CompareIssue[],
    }
  }

  return compareRows(table, supabaseRows.rows, convexRows, sampleLimit)
}

async function compareAuthUsers(limit: number, sampleLimit: number) {
  const supabaseRows = await readSupabaseAuthUsers(limit)
  const convexRows = await listConvexTable('supabase_auth_users', limit) as Array<Record<string, unknown>>
  return compareRows('supabase_auth_users', supabaseRows, convexRows, sampleLimit)
}

function compareRows(
  table: string,
  supabaseRows: Array<Record<string, unknown>>,
  convexRows: Array<Record<string, unknown>>,
  sampleLimit: number
) {
  const supabaseById = new Map<string, string>()
  const convexById = new Map<string, string>()

  for (const row of supabaseRows) {
    const normalized = normalizeSupabaseRow(table, row)
    const legacyId = getLegacyIdForTable(table, normalized)
    if (legacyId) supabaseById.set(legacyId, stableStringify(normalized))
  }

  for (const row of convexRows) {
    const normalized = normalizeConvexRow(row)
    const legacyId = getLegacyIdForTable(table, normalized)
    if (legacyId) convexById.set(legacyId, stableStringify(normalized))
  }

  const issues: CompareIssue[] = []
  for (const [legacyId, supabaseHash] of Array.from(supabaseById.entries())) {
    const convexHash = convexById.get(legacyId)
    if (!convexHash) {
      issues.push({ legacyId, reason: 'missing_in_convex', supabaseHash })
    } else if (convexHash !== supabaseHash) {
      issues.push({ legacyId, reason: 'different', supabaseHash, convexHash })
    }
  }

  for (const [legacyId, convexHash] of Array.from(convexById.entries())) {
    if (!supabaseById.has(legacyId)) {
      issues.push({ legacyId, reason: 'missing_in_supabase', convexHash })
    }
  }

  return {
    table,
    ok: issues.length === 0,
    supabaseRows: supabaseById.size,
    convexRows: convexById.size,
    issueCount: issues.length,
    issues: issues.slice(0, sampleLimit),
  }
}

function compareMissingSupabaseTable(
  table: string,
  convexRows: Array<Record<string, unknown>>,
  sampleLimit: number,
  error?: string
) {
  const issues: CompareIssue[] = []

  for (const row of convexRows) {
    const normalized = normalizeConvexRow(row)
    const legacyId = getLegacyIdForTable(table, normalized) ?? table
    issues.push({
      legacyId,
      reason: 'missing_in_supabase',
      convexHash: stableStringify(normalized),
      supabaseHash: error,
    })
  }

  return {
    table,
    ok: issues.length === 0,
    missingInSupabase: true,
    supabaseRows: 0,
    convexRows: convexRows.length,
    issueCount: issues.length,
    issues: issues.slice(0, sampleLimit),
  }
}

async function readSupabaseTable(table: string, limit: number) {
  const rows: Array<Record<string, unknown>> = []
  let offset = 0

  while (rows.length < limit) {
    const remaining = limit - rows.length
    const to = offset + Math.min(PAGE_SIZE, remaining) - 1
    const { data, error } = await supabaseAdmin.from(table).select('*').range(offset, to)

    if (error) {
      return {
        ok: false as const,
        rows,
        error: error.message,
        missingInSupabase: isMissingSupabaseTable(error),
      }
    }

    const page = (data ?? []) as Array<Record<string, unknown>>
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return { ok: true as const, rows, missingInSupabase: false }
}

async function readSupabaseAuthUsers(limit: number) {
  const rows: Array<Record<string, unknown>> = []
  let page = 1

  while (rows.length < limit) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: Math.min(PAGE_SIZE, limit - rows.length),
    })

    if (error) throw new Error(`Supabase auth users compare failed: ${error.message}`)

    const users = data?.users ?? []
    rows.push(...users.map((user) => JSON.parse(JSON.stringify(user)) as Record<string, unknown>))
    if (users.length < PAGE_SIZE) break
    page += 1
  }

  return rows
}

function normalizeSupabaseRow(table: string, row: Record<string, unknown>) {
  return normalizeComparable(prepareConvexRow(row, table)) as Record<string, unknown>
}

function normalizeConvexRow(row: Record<string, unknown>) {
  return normalizeComparable(row) as Record<string, unknown>
}

function normalizeComparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeComparable(item))

  if (value && typeof value === 'object') {
    const object: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (shouldIgnoreConvexMetadata(key)) continue
      object[key] = normalizeComparable(child)
    }
    return object
  }

  return value
}

function shouldIgnoreConvexMetadata(key: string) {
  return (
    key === '_id' ||
    key === '_creationTime' ||
    key === 'convex_created_at' ||
    key === 'convex_updated_at' ||
    key === 'convex_snapshot_source'
  )
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function isMissingSupabaseTable(error: { code?: string; message?: string }) {
  const message = error.message ?? ''
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /does not exist|Could not find the table|relation .* does not exist/i.test(message)
  )
}

function parseTables(raw: string | null) {
  if (!raw) return DEFAULT_TABLES
  const tables = raw
    .split(',')
    .map((table) => table.trim())
    .filter(Boolean)

  const invalid = tables.filter((table) => !COMPARABLE_TABLES.includes(table))
  if (invalid.length > 0) {
    throw new Error(`Unsupported compare table(s): ${invalid.join(', ')}`)
  }

  return tables
}

function parseLimit(raw: string | null) {
  const parsed = Number(raw ?? DEFAULT_LIMIT)
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(Math.floor(parsed), MAX_LIMIT))
}

function authorizeMigrationCheck(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is required' }, { status: 503 })
  }

  const authorization = request.headers.get('authorization')
  const headerSecret = request.headers.get('x-migration-secret')
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null

  if (bearer === secret || headerSecret === secret) {
    return null
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
