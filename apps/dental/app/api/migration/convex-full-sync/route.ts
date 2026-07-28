import { NextRequest, NextResponse } from 'next/server'
import { getConvexTableCounts, replaceConvexTableSnapshot } from '@/lib/convex/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PAGE_SIZE = 1000

const SUPABASE_TABLES = [
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
] as const

type PublicTable = (typeof SUPABASE_TABLES)[number]
type SyncTableResult = {
  table: string
  ok: boolean
  missingInSupabase?: boolean
  supabaseRows: number
  convexRowsBefore: number | null
  convexRowsAfter: number | null
  inserted?: number
  updated?: number
  unchanged?: number
  deleted?: number
  dryRun?: boolean
  error?: string
}

export async function GET(request: NextRequest) {
  return syncSupabaseToConvex(request)
}

export async function POST(request: NextRequest) {
  return syncSupabaseToConvex(request)
}

async function syncSupabaseToConvex(request: NextRequest) {
  const authError = authorizeMigrationSync(request)
  if (authError) return authError

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'
  const force = request.nextUrl.searchParams.get('force') === '1'
  const enabled = process.env.CONVEX_FULL_SYNC_ENABLED === '1'

  if (!enabled && !force && !dryRun) {
    return NextResponse.json({
      ok: true,
      disabled: true,
      message: 'Set CONVEX_FULL_SYNC_ENABLED=1 or call with force=1 to sync Supabase snapshots into Convex.',
    })
  }

  const includeAuth = request.nextUrl.searchParams.get('includeAuth') !== '0'
  let tables: PublicTable[]
  try {
    tables = parseTables(request.nextUrl.searchParams.get('tables'))
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    )
  }
  const tablesToCount = includeAuth ? [...tables, 'supabase_auth_users'] : tables
  const countsBefore = await safeConvexCounts(tablesToCount)
  const source = `supabase-full-sync:${new Date().toISOString()}`
  const results: SyncTableResult[] = []

  for (const table of tables) {
    const tableResult = await syncPublicTable(table, {
      dryRun,
      source,
      convexRowsBefore: countsBefore[table] ?? null,
    })
    results.push(tableResult)
  }

  if (includeAuth) {
    const authResult = await syncAuthUsers({
      dryRun,
      source,
      convexRowsBefore: countsBefore.supabase_auth_users ?? null,
    })
    results.push(authResult)
  }

  const failed = results.filter((result) => !result.ok)
  return NextResponse.json({
    ok: failed.length === 0,
    dryRun,
    source,
    tables: results.length,
    failed: failed.length,
    totals: {
      supabaseRows: results.reduce((sum, result) => sum + result.supabaseRows, 0),
      inserted: results.reduce((sum, result) => sum + Number(result.inserted ?? 0), 0),
      updated: results.reduce((sum, result) => sum + Number(result.updated ?? 0), 0),
      unchanged: results.reduce((sum, result) => sum + Number(result.unchanged ?? 0), 0),
      deleted: results.reduce((sum, result) => sum + Number(result.deleted ?? 0), 0),
    },
    results,
  }, { status: failed.length === 0 ? 200 : 500 })
}

async function syncPublicTable(
  table: PublicTable,
  options: { dryRun: boolean; source: string; convexRowsBefore: number | null }
): Promise<SyncTableResult> {
  const snapshot = await readSupabaseTable(table)

  if (!snapshot.ok) {
    return {
      table,
      ok: false,
      supabaseRows: 0,
      convexRowsBefore: options.convexRowsBefore,
      convexRowsAfter: options.convexRowsBefore,
      error: snapshot.error,
    }
  }

  if (options.dryRun) {
    return {
      table,
      ok: true,
      dryRun: true,
      missingInSupabase: snapshot.missingInSupabase,
      supabaseRows: snapshot.rows.length,
      convexRowsBefore: options.convexRowsBefore,
      convexRowsAfter: options.convexRowsBefore,
    }
  }

  try {
    const replaced = await replaceSnapshotWithRetry(table, snapshot.rows, options.source)

    return {
      table,
      ok: true,
      missingInSupabase: snapshot.missingInSupabase,
      supabaseRows: snapshot.rows.length,
      convexRowsBefore: options.convexRowsBefore,
      convexRowsAfter: replaced.finalRows,
      inserted: replaced.inserted,
      updated: replaced.updated,
      unchanged: replaced.unchanged,
      deleted: replaced.deleted,
    }
  } catch (error) {
    return {
      table,
      ok: false,
      missingInSupabase: snapshot.missingInSupabase,
      supabaseRows: snapshot.rows.length,
      convexRowsBefore: options.convexRowsBefore,
      convexRowsAfter: options.convexRowsBefore,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function syncAuthUsers(options: {
  dryRun: boolean
  source: string
  convexRowsBefore: number | null
}): Promise<SyncTableResult> {
  const users = await readSupabaseAuthUsers()

  if (options.dryRun) {
    return {
      table: 'supabase_auth_users',
      ok: true,
      dryRun: true,
      supabaseRows: users.length,
      convexRowsBefore: options.convexRowsBefore,
      convexRowsAfter: options.convexRowsBefore,
    }
  }

  try {
    const replaced = await replaceSnapshotWithRetry('supabase_auth_users', users, options.source)

    return {
      table: 'supabase_auth_users',
      ok: true,
      supabaseRows: users.length,
      convexRowsBefore: options.convexRowsBefore,
      convexRowsAfter: replaced.finalRows,
      inserted: replaced.inserted,
      updated: replaced.updated,
      unchanged: replaced.unchanged,
      deleted: replaced.deleted,
    }
  } catch (error) {
    return {
      table: 'supabase_auth_users',
      ok: false,
      supabaseRows: users.length,
      convexRowsBefore: options.convexRowsBefore,
      convexRowsAfter: options.convexRowsBefore,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function readSupabaseTable(table: PublicTable) {
  const rows: Array<Record<string, unknown>> = []
  let offset = 0
  let missingInSupabase = false

  while (true) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      if (isMissingSupabaseTable(error)) {
        missingInSupabase = true
        break
      }

      return { ok: false as const, rows, error: error.message }
    }

    const page = (data ?? []) as Array<Record<string, unknown>>
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return { ok: true as const, rows, missingInSupabase }
}

async function readSupabaseAuthUsers() {
  const rows: Array<Record<string, unknown>> = []
  let page = 1

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    })

    if (error) throw new Error(`Supabase auth users export failed: ${error.message}`)

    const users = data?.users ?? []
    rows.push(...users.map((user) => JSON.parse(JSON.stringify(user)) as Record<string, unknown>))
    if (users.length < PAGE_SIZE) break
    page += 1
  }

  return rows
}

async function safeConvexCounts(tables: string[]) {
  try {
    return await getConvexTableCounts(tables)
  } catch {
    return {}
  }
}

async function replaceSnapshotWithRetry(table: string, rows: Array<Record<string, unknown>>, source: string) {
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await replaceConvexTableSnapshot(table, rows, source) as {
        inserted: number
        updated: number
        unchanged: number
        deleted: number
        finalRows: number
      }
    } catch (error) {
      lastError = error
      if (attempt < 3) await delay(250 * attempt)
    }
  }

  throw lastError
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function authorizeMigrationSync(request: NextRequest) {
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

function parseTables(raw: string | null): PublicTable[] {
  if (!raw) return [...SUPABASE_TABLES]

  const requested = raw
    .split(',')
    .map((table) => table.trim())
    .filter(Boolean)

  const invalid = requested.filter((table) => !SUPABASE_TABLES.includes(table as PublicTable))
  if (invalid.length > 0) {
    throw new Error(`Unsupported full-sync table(s): ${invalid.join(', ')}`)
  }

  return requested as PublicTable[]
}

function isMissingSupabaseTable(error: { code?: string; message?: string }) {
  const message = error.message ?? ''
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /does not exist|Could not find the table|relation .* does not exist/i.test(message)
  )
}
