import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { parseTwilioSMSStatusWebhook, updateSMSStatus } from '@/lib/sms/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STAGE_SUPABASE_REF = 'kafbqdliromcveojtdar'

function isStageQaWebhookRequest(request: NextRequest): boolean {
  return (
    request.headers.get('x-laralis-qa-webhook') === 'mock' &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(STAGE_SUPABASE_REF))
  )
}

function verifyTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>,
  authToken: string
): boolean {
  if (!signature || !authToken) return false
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url)
  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64')

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expBuf)
}

async function parseFormRequest(request: NextRequest): Promise<Record<string, string>> {
  const form = await request.formData()
  const params: Record<string, string> = {}
  form.forEach((value, key) => {
    params[key] = String(value)
  })
  return params
}

export async function POST(request: NextRequest) {
  try {
    const params = await parseFormRequest(request)
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
    const fullUrl = `${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`
    const signature = request.headers.get('x-twilio-signature')
    const authToken = process.env.TWILIO_AUTH_TOKEN || ''

    if (!isStageQaWebhookRequest(request) && !verifyTwilioSignature(signature, fullUrl, params, authToken)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const update = parseTwilioSMSStatusWebhook(params)
    if (!update) {
      return NextResponse.json({ error: 'Invalid Twilio status payload' }, { status: 400 })
    }

    const result = await updateSMSStatus(
      update.providerMessageId,
      update.providerStatus,
      update.timestamp,
      update.errorMessage
    )

    return NextResponse.json({
      success: true,
      provider: 'twilio',
      providerMessageId: update.providerMessageId,
      providerStatus: update.providerStatus,
      status: update.status,
      ...result,
    })
  } catch (error) {
    console.error('[webhooks/twilio/sms-status] Failed to process webhook:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
