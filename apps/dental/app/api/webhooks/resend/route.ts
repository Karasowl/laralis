import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import {
  parseResendEmailWebhook,
  updateEmailDeliveryStatus,
} from '@/lib/email/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STAGE_SUPABASE_REF = 'kafbqdliromcveojtdar'

function isStageQaWebhookRequest(request: NextRequest): boolean {
  return (
    request.headers.get('x-laralis-qa-webhook') === 'mock' &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(STAGE_SUPABASE_REF))
  )
}

function verifyResendWebhookPayload(payload: string, request: NextRequest): unknown {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('RESEND_WEBHOOK_SECRET is not configured')
  }

  const resend = new Resend(process.env.RESEND_API_KEY || 're_webhook_verifier')
  return resend.webhooks.verify({
    payload,
    webhookSecret,
    headers: {
      id: request.headers.get('svix-id') || '',
      timestamp: request.headers.get('svix-timestamp') || '',
      signature: request.headers.get('svix-signature') || '',
    },
  })
}

export async function POST(request: NextRequest) {
  const payload = await request.text()

  try {
    const eventPayload = isStageQaWebhookRequest(request)
      ? JSON.parse(payload)
      : verifyResendWebhookPayload(payload, request)

    const update = parseResendEmailWebhook(eventPayload)
    if (!update) {
      return NextResponse.json({ success: true, ignored: true })
    }

    const result = await updateEmailDeliveryStatus(update)
    return NextResponse.json({
      success: true,
      provider: 'resend',
      providerMessageId: update.providerMessageId,
      eventType: update.eventType,
      status: update.status,
      ...result,
    })
  } catch (error) {
    console.error('[webhooks/resend] Failed to process webhook:', error)
    const message = error instanceof Error ? error.message : 'Invalid webhook payload'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
