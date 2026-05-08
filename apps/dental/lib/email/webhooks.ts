import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type ResendEmailEventType =
  | 'email.sent'
  | 'email.scheduled'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.complained'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked'
  | 'email.failed'
  | 'email.suppressed'

type EmailNotificationStatus = 'pending' | 'sent' | 'failed' | 'bounced' | 'opened'

export interface ResendEmailStatusUpdate {
  providerMessageId: string
  eventType: ResendEmailEventType
  status: EmailNotificationStatus
  eventAt: string
  errorMessage?: string
  metadata: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function mapResendEventToStatus(eventType: ResendEmailEventType): EmailNotificationStatus {
  switch (eventType) {
    case 'email.scheduled':
      return 'pending'
    case 'email.failed':
    case 'email.suppressed':
      return 'failed'
    case 'email.bounced':
    case 'email.complained':
      return 'bounced'
    case 'email.opened':
    case 'email.clicked':
      return 'opened'
    case 'email.sent':
    case 'email.delivered':
    case 'email.delivery_delayed':
    default:
      return 'sent'
  }
}

function extractResendError(eventType: ResendEmailEventType, data: Record<string, unknown>): string | undefined {
  if (eventType === 'email.bounced' && isRecord(data.bounce)) {
    return text(data.bounce.message) || text(data.bounce.type) || text(data.bounce.subType)
  }

  if (eventType === 'email.failed' && isRecord(data.failed)) {
    return text(data.failed.reason)
  }

  if (eventType === 'email.suppressed' && isRecord(data.suppressed)) {
    return text(data.suppressed.message) || text(data.suppressed.type)
  }

  if (eventType === 'email.complained') {
    return 'Recipient complained about this email'
  }

  if (eventType === 'email.delivery_delayed') {
    return 'Resend reported delayed delivery'
  }

  return undefined
}

export function parseResendEmailWebhook(payload: unknown): ResendEmailStatusUpdate | null {
  if (!isRecord(payload)) return null

  const eventType = text(payload.type) as ResendEmailEventType | undefined
  if (!eventType || !eventType.startsWith('email.')) return null
  if (
    ![
      'email.sent',
      'email.scheduled',
      'email.delivered',
      'email.delivery_delayed',
      'email.complained',
      'email.bounced',
      'email.opened',
      'email.clicked',
      'email.failed',
      'email.suppressed',
    ].includes(eventType)
  ) {
    return null
  }

  const data = isRecord(payload.data) ? payload.data : null
  const providerMessageId = text(data?.email_id)
  if (!data || !providerMessageId) return null

  const eventAt = text(payload.created_at) || text(data.created_at) || new Date().toISOString()
  const errorMessage = extractResendError(eventType, data)
  const metadata: Record<string, unknown> = {
    resend_event: eventType,
    provider_status: eventType.replace(/^email\./, ''),
    provider_event_at: eventAt,
  }

  if (isRecord(data.bounce)) {
    metadata.bounce = data.bounce
  }
  if (isRecord(data.failed)) {
    metadata.failed = data.failed
  }
  if (isRecord(data.suppressed)) {
    metadata.suppressed = data.suppressed
  }
  if (isRecord(data.click)) {
    metadata.click = data.click
  }

  return {
    providerMessageId,
    eventType,
    status: mapResendEventToStatus(eventType),
    eventAt,
    errorMessage,
    metadata,
  }
}

export async function updateEmailDeliveryStatus(update: ResendEmailStatusUpdate): Promise<{
  updatedCount: number
}> {
  const { data: rows, error: readError } = await supabaseAdmin
    .from('email_notifications')
    .select('id, metadata')
    .eq('provider_message_id', update.providerMessageId)

  if (readError) {
    console.error('[email/webhooks] Failed to read notification rows:', readError)
    throw readError
  }

  let updatedCount = 0
  for (const row of rows || []) {
    const existingMetadata =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {}

    const updateData: Record<string, unknown> = {
      status: update.status,
      updated_at: new Date().toISOString(),
      metadata: {
        ...existingMetadata,
        ...update.metadata,
      },
    }

    if (update.status === 'sent') {
      updateData.sent_at = update.eventAt
    }
    if (update.status === 'opened') {
      updateData.opened_at = update.eventAt
    }
    if (update.errorMessage) {
      updateData.error_message = update.errorMessage
    }

    const { error: updateError } = await supabaseAdmin
      .from('email_notifications')
      .update(updateData)
      .eq('id', row.id)

    if (updateError) {
      console.error('[email/webhooks] Failed to update notification row:', updateError)
      throw updateError
    }

    updatedCount += 1
  }

  return { updatedCount }
}
