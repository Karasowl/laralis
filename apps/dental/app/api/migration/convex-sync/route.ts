import { NextRequest, NextResponse } from 'next/server'
import {
  deleteConvexDocumentByLegacyId,
  getLegacyIdForTable,
  upsertConvexDocumentByLegacyId,
} from '@/lib/convex/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000

const MIRRORED_TABLES = new Set([
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
])

type MirrorEvent = {
  id: number
  table_name: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  record_id: string | null
  record: Record<string, unknown> | null
  old_record: Record<string, unknown> | null
  attempts: number
}

export async function GET(request: NextRequest) {
  return syncConvexMirrorEvents(request)
}

export async function POST(request: NextRequest) {
  return syncConvexMirrorEvents(request)
}

async function syncConvexMirrorEvents(request: NextRequest) {
  const authError = authorizeMigrationSync(request)
  if (authError) return authError

  if (process.env.CONVEX_MIRROR_SYNC_ENABLED !== '1') {
    return NextResponse.json({
      ok: true,
      disabled: true,
      message: 'Set CONVEX_MIRROR_SYNC_ENABLED=1 to process Supabase mirror events.',
    })
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'
  const limit = parseLimit(request.nextUrl.searchParams.get('limit'))
  const { data, error } = await supabaseAdmin
    .from('convex_mirror_events')
    .select('id, table_name, operation, record_id, record, old_record, attempts')
    .is('processed_at', null)
    .order('id', { ascending: true })
    .limit(limit)

  if (error) {
    const code = (error as { code?: string }).code
    if (code === '42P01' || /convex_mirror_events/i.test(error.message)) {
      return NextResponse.json({
        ok: true,
        queueInstalled: false,
        processed: 0,
        message: 'convex_mirror_events table is not installed yet.',
      })
    }

    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const events = (data ?? []) as MirrorEvent[]
  const results = []

  for (const event of events) {
    const result = await processMirrorEvent(event, { dryRun })
    results.push(result)
  }

  return NextResponse.json({
    ok: results.every((result) => result.ok),
    dryRun,
    fetched: events.length,
    processed: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  })
}

async function processMirrorEvent(event: MirrorEvent, options: { dryRun: boolean }) {
  if (!MIRRORED_TABLES.has(event.table_name)) {
    const message = `Table ${event.table_name} is not in the Convex mirror allowlist.`
    if (!options.dryRun) await markEventFailed(event, message)
    return { id: event.id, ok: false, table: event.table_name, operation: event.operation, error: message }
  }

  const row = event.operation === 'DELETE' ? event.old_record : event.record
  const legacyId = getLegacyIdForTable(event.table_name, row, event.record_id)

  if (!legacyId) {
    const message = 'Mirror event has no usable legacy id.'
    if (!options.dryRun) await markEventFailed(event, message)
    return { id: event.id, ok: false, table: event.table_name, operation: event.operation, error: message }
  }

  try {
    if (!options.dryRun) {
      if (event.operation === 'DELETE') {
        await deleteConvexDocumentByLegacyId(event.table_name, legacyId)
      } else if (event.record) {
        await upsertConvexDocumentByLegacyId(event.table_name, legacyId, event.record)
      } else {
        throw new Error('Insert/update mirror event has no record payload.')
      }

      await markEventProcessed(event)
    }

    return {
      id: event.id,
      ok: true,
      dryRun: options.dryRun,
      table: event.table_name,
      operation: event.operation,
      legacyId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!options.dryRun) await markEventFailed(event, message)
    return { id: event.id, ok: false, table: event.table_name, operation: event.operation, legacyId, error: message }
  }
}

async function markEventProcessed(event: MirrorEvent) {
  await supabaseAdmin
    .from('convex_mirror_events')
    .update({
      processed_at: new Date().toISOString(),
      attempts: event.attempts + 1,
      last_error: null,
    })
    .eq('id', event.id)
}

async function markEventFailed(event: MirrorEvent, message: string) {
  await supabaseAdmin
    .from('convex_mirror_events')
    .update({
      attempts: event.attempts + 1,
      last_error: message.slice(0, 2000),
    })
    .eq('id', event.id)
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

function parseLimit(raw: string | null) {
  const parsed = Number(raw ?? DEFAULT_LIMIT)
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(Math.floor(parsed), MAX_LIMIT))
}
