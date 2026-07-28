import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { AppointmentEmailData, BookingConfirmationData } from '@/lib/email/service'
import { listConvexTable, decodeConvexValue } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

type ConvexImportedRecord = Record<string, any>

function normalizeRetryConvexRecord(row: ConvexImportedRecord): ConvexImportedRecord {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  // metadata is JSONB; decode nested keys so retry_payload matches Supabase.
  return { ...rest, metadata: decodeConvexValue(rest.metadata) }
}

export type NotificationRetryChannel = 'email' | 'sms'
export type NotificationRetryStatus = 'pending' | 'processing' | 'succeeded' | 'abandoned' | 'cancelled'

export type EmailRetryPayload =
  | {
      kind: 'confirmation'
      emailData: AppointmentEmailData
    }
  | {
      kind: 'reminder'
      emailData: AppointmentEmailData
      hoursUntil: number
    }
  | {
      kind: 'booking_confirmation'
      data: BookingConfirmationData
    }

export interface NotificationRetryRow {
  id: string
  clinic_id: string
  channel: NotificationRetryChannel
  notification_id: string
  provider: string | null
  provider_message_id: string | null
  status: NotificationRetryStatus
  reason: string | null
  error_message: string | null
  retry_count: number
  max_attempts: number
  next_retry_at: string
  last_attempt_at: string | null
  processed_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface QueueNotificationRetryParams {
  clinicId: string
  channel: NotificationRetryChannel
  notificationId: string
  provider?: string | null
  providerMessageId?: string | null
  reason?: string | null
  errorMessage?: string | null
  metadata?: Record<string, unknown>
  maxAttempts?: number
  nextRetryAt?: Date
}

interface RetryStateUpdate {
  errorMessage?: string | null
  providerMessageId?: string | null
  retryCount?: number
  nextRetryAt?: Date
}

const RETRY_DELAYS_MINUTES = [5, 15, 60, 240, 24 * 60]

const NON_RETRYABLE_ERROR_PATTERNS = [
  /invalid\s+(api\s+)?key/i,
  /unauthorized/i,
  /forbidden/i,
  /not\s+configured/i,
  /config\s+incomplete/i,
  /invalid\s+(email|phone|number|recipient|to)/i,
  /mailbox\s+(unavailable|does not exist|not found)/i,
  /suppressed/i,
  /unsubscribe/i,
  /carrier\s+blocked/i,
  /permanent/i,
  /bounce/i,
]

const RETRYABLE_ERROR_PATTERNS = [
  /timeout/i,
  /timed?\s*out/i,
  /temporar/i,
  /rate\s*limit/i,
  /\b429\b/,
  /\b500\b/,
  /\b502\b/,
  /\b503\b/,
  /\b504\b/,
  /network/i,
  /connection/i,
  /econn/i,
  /etimedout/i,
  /service\s+unavailable/i,
]

export function isRetryableNotificationError(errorMessage?: string | null): boolean {
  const message = (errorMessage || '').trim()
  if (!message) return false

  if (NON_RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return false
  }

  return RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

export function calculateNotificationRetryAt(retryCount: number, now: Date = new Date()): Date {
  const safeRetryCount = Number.isFinite(retryCount) ? Math.max(0, Math.floor(retryCount)) : 0
  const delayMinutes = RETRY_DELAYS_MINUTES[Math.min(safeRetryCount, RETRY_DELAYS_MINUTES.length - 1)]
  return new Date(now.getTime() + delayMinutes * 60 * 1000)
}

export function buildEmailRetryMetadata(
  retryPayload: EmailRetryPayload,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...extra,
    retry_payload: retryPayload,
  }
}

export function readEmailRetryPayload(metadata: unknown): EmailRetryPayload | null {
  if (!metadata || typeof metadata !== 'object') return null
  const payload = (metadata as Record<string, unknown>).retry_payload
  if (!payload || typeof payload !== 'object') return null

  const kind = (payload as { kind?: unknown }).kind
  if (kind === 'confirmation' || kind === 'reminder' || kind === 'booking_confirmation') {
    return payload as EmailRetryPayload
  }

  return null
}

export async function queueNotificationRetry(params: QueueNotificationRetryParams): Promise<NotificationRetryRow | null> {
  if (!isRetryableNotificationError(params.errorMessage)) {
    return null
  }

  const nextRetryAt = params.nextRetryAt || calculateNotificationRetryAt(0)
  const metadata = {
    ...(params.metadata || {}),
    queued_from: 'initial_failure',
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('notification_retry_queue')
    .select('*')
    .eq('channel', params.channel)
    .eq('notification_id', params.notificationId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) {
    console.error('[notification-retry] Failed to read existing retry row:', existingError)
    return null
  }

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('notification_retry_queue')
      .update({
        status: 'pending',
        provider: params.provider || existing.provider || null,
        provider_message_id: params.providerMessageId || existing.provider_message_id || null,
        reason: params.reason || existing.reason || 'transient_provider_failure',
        error_message: params.errorMessage || existing.error_message || null,
        max_attempts: params.maxAttempts || existing.max_attempts || 3,
        next_retry_at: nextRetryAt.toISOString(),
        metadata: {
          ...((existing.metadata as Record<string, unknown> | null) || {}),
          ...metadata,
        },
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) {
      console.error('[notification-retry] Failed to update retry row:', error)
      return null
    }

    return data as NotificationRetryRow
  }

  const { data, error } = await supabaseAdmin
    .from('notification_retry_queue')
    .insert({
      clinic_id: params.clinicId,
      channel: params.channel,
      notification_id: params.notificationId,
      provider: params.provider || null,
      provider_message_id: params.providerMessageId || null,
      status: 'pending',
      reason: params.reason || 'transient_provider_failure',
      error_message: params.errorMessage || null,
      retry_count: 0,
      max_attempts: params.maxAttempts || 3,
      next_retry_at: nextRetryAt.toISOString(),
      metadata,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[notification-retry] Failed to queue retry:', error)
    return null
  }

  return data as NotificationRetryRow
}

export async function listDueNotificationRetries(limit = 25, now: Date = new Date()): Promise<NotificationRetryRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100))

  // Convex read branch (flag-gated, default Supabase). notification_retry_queue is
  // read across all clinics, so read the whole table and filter/sort/limit in JS,
  // mirroring status='pending' AND next_retry_at <= now ORDER BY next_retry_at ASC.
  if (shouldReturnConvexData('notification_retry_queue')) {
    const nowISO = now.toISOString()
    const rows = (await listConvexTable('notification_retry_queue', 10000) as ConvexImportedRecord[])
      .map(normalizeRetryConvexRecord)
      .filter((r) => r.status === 'pending' && String(r.next_retry_at ?? '') <= nowISO)
      .sort((a, b) => String(a.next_retry_at ?? '').localeCompare(String(b.next_retry_at ?? '')))
      .slice(0, safeLimit)
    return rows as NotificationRetryRow[]
  }

  const { data, error } = await supabaseAdmin
    .from('notification_retry_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('next_retry_at', now.toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(safeLimit)

  if (error) {
    if (isMissingNotificationRetryQueueTable(error)) {
      console.warn('[notification-retry] notification_retry_queue table is not installed; skipping retry processing')
      return []
    }

    throw new Error(`Failed to fetch notification retries: ${error.message}`)
  }

  return (data || []) as NotificationRetryRow[]
}

function isMissingNotificationRetryQueueTable(error: { code?: string; message?: string }) {
  const message = error.message || ''
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /notification_retry_queue|schema cache|relation .* does not exist|Could not find the table/i.test(message)
  )
}

export async function markNotificationRetryProcessing(retryId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notification_retry_queue')
    .update({
      status: 'processing',
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', retryId)

  if (error) {
    throw new Error(`Failed to mark notification retry processing: ${error.message}`)
  }
}

export async function markNotificationRetrySucceeded(
  retryId: string,
  update: RetryStateUpdate = {}
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notification_retry_queue')
    .update({
      status: 'succeeded',
      provider_message_id: update.providerMessageId || null,
      error_message: null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', retryId)

  if (error) {
    throw new Error(`Failed to mark notification retry succeeded: ${error.message}`)
  }
}

export async function rescheduleNotificationRetry(retryId: string, update: Required<Pick<RetryStateUpdate, 'retryCount' | 'nextRetryAt'>> & RetryStateUpdate): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notification_retry_queue')
    .update({
      status: 'pending',
      retry_count: update.retryCount,
      next_retry_at: update.nextRetryAt.toISOString(),
      error_message: update.errorMessage || null,
      provider_message_id: update.providerMessageId || null,
    })
    .eq('id', retryId)

  if (error) {
    throw new Error(`Failed to reschedule notification retry: ${error.message}`)
  }
}

export async function abandonNotificationRetry(retryId: string, update: Required<Pick<RetryStateUpdate, 'retryCount'>> & RetryStateUpdate): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notification_retry_queue')
    .update({
      status: 'abandoned',
      retry_count: update.retryCount,
      error_message: update.errorMessage || null,
      provider_message_id: update.providerMessageId || null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', retryId)

  if (error) {
    throw new Error(`Failed to abandon notification retry: ${error.message}`)
  }
}
