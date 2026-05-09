import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireCronAuth } from '@/lib/cron-auth'
import {
  abandonNotificationRetry,
  calculateNotificationRetryAt,
  isRetryableNotificationError,
  listDueNotificationRetries,
  markNotificationRetryProcessing,
  markNotificationRetrySucceeded,
  readEmailRetryPayload,
  rescheduleNotificationRetry,
  type NotificationRetryRow,
} from '@/lib/notifications/retry-queue'
import { getQaNotificationMode, type QaNotificationMode } from '@/lib/notifications/qa'
import { sendBookingConfirmation, sendConfirmationEmail, sendReminderEmail, type EmailResult } from '@/lib/email/service'
import { sendSMSDeliveryAttempt, type SendSMSResult } from '@/lib/sms'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RetryAttemptResult = {
  success: boolean
  messageId?: string
  status?: string
  error?: string
}

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const mode = getQaNotificationMode(request)
  const limitParam = Number(request.nextUrl.searchParams.get('limit') || 25)
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 25
  const startedAt = Date.now()
  const results = {
    processed: 0,
    succeeded: 0,
    rescheduled: 0,
    abandoned: 0,
    failed: 0,
    errors: [] as string[],
  }

  try {
    const dueRetries = await listDueNotificationRetries(limit)

    if (dueRetries.length === 0) {
      return NextResponse.json({
        message: 'No due notification retries',
        ...results,
        duration: Date.now() - startedAt,
      })
    }

    for (const retry of dueRetries) {
      results.processed += 1

      try {
        await markNotificationRetryProcessing(retry.id)
        const attempt = await processRetryAttempt(retry, mode)

        if (attempt.success) {
          await markNotificationSourceSent(retry, attempt)
          await markNotificationRetrySucceeded(retry.id, { providerMessageId: attempt.messageId || null })
          results.succeeded += 1
          continue
        }

        const nextRetryCount = retry.retry_count + 1
        await markNotificationSourceFailed(retry, attempt.error || 'Notification retry failed')

        if (
          nextRetryCount < retry.max_attempts &&
          isRetryableNotificationError(attempt.error || retry.error_message)
        ) {
          await rescheduleNotificationRetry(retry.id, {
            retryCount: nextRetryCount,
            nextRetryAt: calculateNotificationRetryAt(nextRetryCount),
            errorMessage: attempt.error || retry.error_message || null,
            providerMessageId: attempt.messageId || null,
          })
          results.rescheduled += 1
        } else {
          await abandonNotificationRetry(retry.id, {
            retryCount: nextRetryCount,
            errorMessage: attempt.error || retry.error_message || 'Notification retry abandoned',
            providerMessageId: attempt.messageId || null,
          })
          results.abandoned += 1
        }
      } catch (retryError) {
        const message = retryError instanceof Error ? retryError.message : 'Unknown retry error'
        console.error(`[cron/retry-notifications] Retry ${retry.id} failed:`, retryError)
        results.failed += 1
        results.errors.push(`${retry.id}: ${message}`)

        const nextRetryCount = retry.retry_count + 1
        if (nextRetryCount < retry.max_attempts && isRetryableNotificationError(message)) {
          await rescheduleNotificationRetry(retry.id, {
            retryCount: nextRetryCount,
            nextRetryAt: calculateNotificationRetryAt(nextRetryCount),
            errorMessage: message,
          }).catch((rescheduleError) => {
            console.error(`[cron/retry-notifications] Failed to reschedule ${retry.id}:`, rescheduleError)
          })
        } else {
          await abandonNotificationRetry(retry.id, {
            retryCount: nextRetryCount,
            errorMessage: message,
          }).catch((abandonError) => {
            console.error(`[cron/retry-notifications] Failed to abandon ${retry.id}:`, abandonError)
          })
        }
      }
    }

    return NextResponse.json({
      message: 'Notification retry processing complete',
      ...results,
      duration: Date.now() - startedAt,
    })
  } catch (error) {
    console.error('[cron/retry-notifications] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        ...results,
        duration: Date.now() - startedAt,
      },
      { status: 500 }
    )
  }
}

async function processRetryAttempt(retry: NotificationRetryRow, mode: QaNotificationMode): Promise<RetryAttemptResult> {
  if (retry.channel === 'email') {
    return processEmailRetry(retry, mode)
  }

  if (retry.channel === 'sms') {
    return processSmsRetry(retry, mode)
  }

  return {
    success: false,
    error: `Unsupported retry channel: ${retry.channel}`,
  }
}

async function processEmailRetry(retry: NotificationRetryRow, mode: QaNotificationMode): Promise<RetryAttemptResult> {
  const { data: notification, error } = await supabaseAdmin
    .from('email_notifications')
    .select('*')
    .eq('id', retry.notification_id)
    .maybeSingle()

  if (error || !notification) {
    return {
      success: false,
      error: error?.message || 'Email notification row not found',
    }
  }

  if (notification.status === 'sent' || notification.status === 'opened') {
    return {
      success: true,
      messageId: notification.provider_message_id || undefined,
      status: notification.status,
    }
  }

  if (mode === 'mock') {
    return {
      success: true,
      messageId: `qa-retry-email-${retry.id}`,
      status: 'sent',
    }
  }

  if (mode === 'fail') {
    return {
      success: false,
      error: 'QA forced retry timeout 503',
    }
  }

  const payload = readEmailRetryPayload(notification.metadata)
  if (!payload) {
    return {
      success: false,
      error: 'Email notification is missing retry_payload metadata',
    }
  }

  let result: EmailResult
  if (payload.kind === 'confirmation') {
    result = await sendConfirmationEmail(payload.emailData)
  } else if (payload.kind === 'reminder') {
    result = await sendReminderEmail(payload.emailData, payload.hoursUntil)
  } else {
    result = await sendBookingConfirmation(payload.data)
  }

  return {
    success: result.success,
    messageId: result.messageId,
    status: result.success ? 'sent' : 'failed',
    error: result.error,
  }
}

async function processSmsRetry(retry: NotificationRetryRow, mode: QaNotificationMode): Promise<RetryAttemptResult> {
  const { data: notification, error } = await supabaseAdmin
    .from('sms_notifications')
    .select('*')
    .eq('id', retry.notification_id)
    .maybeSingle()

  if (error || !notification) {
    return {
      success: false,
      error: error?.message || 'SMS notification row not found',
    }
  }

  if (notification.status === 'sent' || notification.status === 'delivered') {
    return {
      success: true,
      messageId: notification.provider_message_id || undefined,
      status: notification.status,
    }
  }

  if (mode === 'mock') {
    return {
      success: true,
      messageId: `qa-retry-sms-${retry.id}`,
      status: 'sent',
    }
  }

  if (mode === 'fail') {
    return {
      success: false,
      error: 'QA forced retry timeout 503',
    }
  }

  const result: SendSMSResult = await sendSMSDeliveryAttempt({
    clinicId: notification.clinic_id,
    recipientPhone: notification.recipient_phone,
    message: notification.message_content,
  })

  return {
    success: result.success,
    messageId: result.messageId,
    status: result.status || (result.success ? 'sent' : 'failed'),
    error: result.error,
  }
}

async function markNotificationSourceSent(retry: NotificationRetryRow, attempt: RetryAttemptResult): Promise<void> {
  const now = new Date().toISOString()

  if (retry.channel === 'email') {
    const { error } = await supabaseAdmin
      .from('email_notifications')
      .update({
        status: 'sent',
        sent_at: now,
        provider_message_id: attempt.messageId || null,
        error_message: null,
      })
      .eq('id', retry.notification_id)

    if (error) throw new Error(`Failed to mark email notification sent: ${error.message}`)
    return
  }

  const { error } = await supabaseAdmin
    .from('sms_notifications')
    .update({
      status: attempt.status === 'delivered' ? 'delivered' : 'sent',
      sent_at: now,
      delivered_at: attempt.status === 'delivered' ? now : null,
      provider_message_id: attempt.messageId || null,
      error_message: null,
    })
    .eq('id', retry.notification_id)

  if (error) throw new Error(`Failed to mark SMS notification sent: ${error.message}`)
}

async function markNotificationSourceFailed(retry: NotificationRetryRow, errorMessage: string): Promise<void> {
  const table = retry.channel === 'email' ? 'email_notifications' : 'sms_notifications'
  const { error } = await supabaseAdmin
    .from(table)
    .update({
      status: 'failed',
      error_message: errorMessage,
    })
    .eq('id', retry.notification_id)

  if (error) {
    throw new Error(`Failed to mark ${retry.channel} notification failed: ${error.message}`)
  }
}
