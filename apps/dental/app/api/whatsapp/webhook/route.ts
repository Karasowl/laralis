import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { aiService } from '@/lib/ai'
import type { Message as AIMessage } from '@/lib/ai'
import { hasAIConfig, validateAIConfig } from '@/lib/ai/config'
import { buildInboxSystemPrompt } from '@/lib/ai/prompts/inbox-prompt'
import { sendWhatsAppMessage, updateWhatsAppDeliveryStatus } from '@/lib/whatsapp/service'
import { Dialog360WhatsAppProvider } from '@/lib/whatsapp/providers/dialog360'
import { TwilioWhatsAppProvider } from '@/lib/whatsapp/providers/twilio'
import type { MessageStatus, SendMessageResult } from '@/lib/whatsapp/types'

// QA route contract: @qa-webhook-guard external Twilio webhook verified by provider signature.
/**
 * Twilio signs every outbound webhook request with HMAC-SHA1 over
 * `<full url> + sorted(form params concatenated as key+value)`,
 * base64-encoded, in the `X-Twilio-Signature` header.
 *
 * Skipping validation lets anyone POST fake WhatsApp messages to this
 * endpoint and burn AI / SMS credits, create fake leads, or talk to the
 * bot pretending to be a patient. Always validate.
 *
 * Reference: https://www.twilio.com/docs/usage/security#validating-requests
 */
function verifyTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>,
  authToken: string
): boolean {
  if (!signature || !authToken) return false
  const sortedKeys = Object.keys(params).sort()
  const data = sortedKeys.reduce((acc, key) => acc + key + params[key], url)
  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64')
  // timing-safe comparison
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expBuf)
}

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

const HANDOFF_KEYWORDS = [
  'agente',
  'humano',
  'persona',
  'asesor',
  'call center',
  'callcenter',
  'llamar',
  'llamada',
]

const STAGE_SUPABASE_REF = 'kafbqdliromcveojtdar'

function isStageQaHeader(request: NextRequest, header: string, value: string): boolean {
  return (
    request.headers.get(header) === value &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(STAGE_SUPABASE_REF))
  )
}

function isQaWebhookMockRequest(request: NextRequest): boolean {
  return isStageQaHeader(request, 'x-laralis-qa-webhook', 'mock')
}

function isQaWebhookSendMockRequest(request: NextRequest): boolean {
  return isStageQaHeader(request, 'x-laralis-qa-whatsapp-send', 'mock')
}

function qaWhatsAppSendResult(messageIdPrefix: string): SendMessageResult {
  return {
    success: true,
    messageId: `${messageIdPrefix}-${Date.now()}`,
    status: 'sent',
  }
}

function normalizeContactAddress(value: string): string {
  if (!value) return value
  return value.startsWith('whatsapp:') ? value : `whatsapp:${value}`
}

function stripWhatsAppPrefix(value: string): string {
  return value.replace(/^whatsapp:/i, '')
}

function shouldHandoff(text: string): boolean {
  const lower = text.toLowerCase()
  return HANDOFF_KEYWORDS.some((keyword) => lower.includes(keyword))
}

async function sendWebhookWhatsAppMessage(
  request: NextRequest,
  params: {
    clinicId: string
    recipientPhone: string
    content: string
  }
) {
  if (isQaWebhookMockRequest(request) || isQaWebhookSendMockRequest(request)) {
    return qaWhatsAppSendResult('qa-whatsapp-webhook')
  }

  return sendWhatsAppMessage(params)
}

interface CtwaReferral {
  ctwa_clid: string | null
  ad_id: string | null
  ad_source_type: string | null
  ad_source_url: string | null
  ad_headline: string | null
  ad_body: string | null
  ad_media_type: string | null
  ad_media_url: string | null
}

/**
 * Click-to-WhatsApp ads attach a `referral` object to the FIRST inbound
 * message from a user that clicked the ad. Twilio surfaces it via Referral*
 * form fields; 360dialog forwards Meta's Cloud API `referral` object.
 */
function extractCtwaReferralFromTwilio(form: Record<string, string>): CtwaReferral | null {
  const ctwaClid = form.ReferralCtwaClid?.trim()
  const sourceId = form.ReferralSourceId?.trim()
  const sourceType = form.ReferralSourceType?.trim()
  const sourceUrl = form.ReferralSourceUrl?.trim()
  const headline = form.ReferralHeadline?.trim()
  const body = form.ReferralBody?.trim()
  const mediaType = form.ReferralMediaType?.trim()
  const mediaUrl = form.ReferralMediaUrl?.trim()

  // Only emit a referral if at least one identifier-ish field is present.
  // Twilio passes the same Referral* keys for posts (no ctwa_clid) so we
  // accept ad_id (source_id) as a fallback signal.
  if (!ctwaClid && !sourceId && !sourceUrl) {
    return null
  }

  return {
    ctwa_clid: ctwaClid || null,
    ad_id: sourceId || null,
    ad_source_type: sourceType || null,
    ad_source_url: sourceUrl || null,
    ad_headline: headline || null,
    ad_body: body || null,
    ad_media_type: mediaType || null,
    ad_media_url: mediaUrl || null,
  }
}

function extractCtwaReferralFromCloudApi(referral: unknown): CtwaReferral | null {
  if (!referral || typeof referral !== 'object') return null
  const data = referral as Record<string, unknown>
  const text = (key: string) => {
    const value = data[key]
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  const mediaUrl = text('image_url') || text('video_url') || text('thumbnail_url')
  const ctwaClid = text('ctwa_clid')
  const sourceId = text('source_id')
  const sourceUrl = text('source_url')

  if (!ctwaClid && !sourceId && !sourceUrl) {
    return null
  }

  return {
    ctwa_clid: ctwaClid,
    ad_id: sourceId,
    ad_source_type: text('source_type'),
    ad_source_url: sourceUrl,
    ad_headline: text('headline'),
    ad_body: text('body'),
    ad_media_type: text('media_type'),
    ad_media_url: mediaUrl,
  }
}

interface InboundWhatsAppMessage {
  clinicId: string | null
  campaignId: string | null
  fromRaw: string
  toRaw: string
  body: string
  profileName: string
  messageSid: string
  ctwaReferral: CtwaReferral | null
  providerMetadata?: Record<string, unknown>
}

interface ProviderStatusUpdate {
  messageId: string
  status: MessageStatus
  timestamp?: string
  errorMessage?: string
  provider: string
}

function mapProviderStatus(providerStatus: string): MessageStatus {
  const statusMap: Record<string, MessageStatus> = {
    queued: 'pending',
    sending: 'pending',
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
    undelivered: 'undelivered',
    accepted: 'sent',
    seen: 'read',
    error: 'failed',
  }

  return statusMap[providerStatus.toLowerCase()] || 'pending'
}

function extractDialog360StatusUpdates(payload: unknown): ProviderStatusUpdate[] {
  if (!payload || typeof payload !== 'object') return []
  const entries = Array.isArray((payload as any).entry) ? (payload as any).entry : []
  const updates: ProviderStatusUpdate[] = []

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : []
    for (const change of changes) {
      const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : []
      for (const status of statuses) {
        if (!status?.id || !status?.status) continue
        updates.push({
          messageId: String(status.id),
          status: mapProviderStatus(String(status.status)),
          timestamp: status.timestamp
            ? new Date(Number.parseInt(String(status.timestamp), 10) * 1000).toISOString()
            : undefined,
          errorMessage: status.errors?.[0]?.message || status.errors?.[0]?.title,
          provider: '360dialog',
        })
      }
    }
  }

  return updates
}

function extractDialog360InboundMessages(
  payload: unknown,
  clinicId: string | null,
  campaignId: string | null
): InboundWhatsAppMessage[] {
  if (!payload || typeof payload !== 'object') return []
  const entries = Array.isArray((payload as any).entry) ? (payload as any).entry : []
  const messages: InboundWhatsAppMessage[] = []

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : []
    for (const change of changes) {
      const value = change?.value || {}
      const metadata = value.metadata || {}
      const contacts = Array.isArray(value.contacts) ? value.contacts : []
      const inboundMessages = Array.isArray(value.messages) ? value.messages : []

      for (const message of inboundMessages) {
        const body = typeof message?.text?.body === 'string' ? message.text.body.trim() : ''
        if (!body) continue

        const fromRaw = typeof message.from === 'string' ? `+${message.from.replace(/^\+/, '')}` : ''
        const contact = contacts.find((row: any) => String(row?.wa_id || '') === String(message.from || ''))
        const profileName =
          typeof contact?.profile?.name === 'string'
            ? contact.profile.name.trim()
            : ''

        messages.push({
          clinicId,
          campaignId,
          fromRaw,
          toRaw: metadata.display_phone_number || metadata.phone_number_id || '',
          body,
          profileName,
          messageSid: typeof message.id === 'string' ? message.id : '',
          ctwaReferral: extractCtwaReferralFromCloudApi(message.referral),
          providerMetadata: {
            provider: '360dialog',
            phone_number_id: metadata.phone_number_id || null,
            display_phone_number: metadata.display_phone_number || null,
            message_type: message.type || null,
          },
        })
      }
    }
  }

  return messages
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  if (aBuffer.length !== bBuffer.length) return false
  return crypto.timingSafeEqual(aBuffer, bBuffer)
}

function expectedBasicAuthorization(): string | null {
  const exact = process.env.WHATSAPP_WEBHOOK_BASIC_AUTH?.trim()
  if (exact) {
    return exact.startsWith('Basic ')
      ? exact
      : `Basic ${Buffer.from(exact).toString('base64')}`
  }

  const user = process.env.WHATSAPP_WEBHOOK_BASIC_USER?.trim()
  const password = process.env.WHATSAPP_WEBHOOK_BASIC_PASSWORD?.trim()
  if (!user || !password) return null

  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
}

function verifyBasicAuthorization(request: NextRequest): boolean {
  const expected = expectedBasicAuthorization()
  const actual = request.headers.get('authorization') || ''
  return Boolean(expected && actual && timingSafeStringEqual(actual, expected))
}

async function applyProviderStatusUpdates(updates: ProviderStatusUpdate[]) {
  for (const update of updates) {
    await updateWhatsAppDeliveryStatus({
      providerMessageId: update.messageId,
      status: update.status,
      timestamp: update.timestamp,
      errorMessage: update.errorMessage,
      provider: update.provider,
    })
  }
}

async function parseTwilioFormRequest(request: NextRequest): Promise<Record<string, string>> {
  const form = await request.formData()
  const formParams: Record<string, string> = {}
  form.forEach((value, key) => {
    formParams[key] = String(value)
  })
  return formParams
}

async function handleTwilioWebhook(
  request: NextRequest,
  clinicId: string | null,
  campaignId: string | null
): Promise<NextResponse> {
  const formParams = await parseTwilioFormRequest(request)

  // Verify Twilio signature BEFORE we trust any field. Build the URL
  // exactly as Twilio saw it (including query string). Use the
  // x-forwarded-* headers because Vercel terminates TLS upstream.
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const fullUrl = `${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`
  const authToken = process.env.TWILIO_AUTH_TOKEN || ''
  const signature = request.headers.get('x-twilio-signature')

  // Allow opting out only in stage QA. In production the signature is required.
  const qaMock = isQaWebhookMockRequest(request)
  const sigOk = qaMock || verifyTwilioSignature(signature, fullUrl, formParams, authToken)
  if (!sigOk && process.env.NODE_ENV === 'production') {
    console.warn('[whatsapp/webhook] Rejecting unsigned request from', request.headers.get('x-forwarded-for'))
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const twilioStatus = new TwilioWhatsAppProvider().parseStatusWebhook(formParams)
  if (twilioStatus) {
    await applyProviderStatusUpdates([{
      ...twilioStatus,
      provider: 'twilio',
    }])
    return new NextResponse('', { status: 200 })
  }

  return handleInboundWhatsAppMessage(request, {
    clinicId,
    campaignId,
    fromRaw: formParams.From || '',
    toRaw: formParams.To || '',
    body: (formParams.Body || '').trim(),
    profileName: (formParams.ProfileName || '').trim(),
    messageSid: (formParams.MessageSid || '').trim(),
    ctwaReferral: extractCtwaReferralFromTwilio(formParams),
    providerMetadata: {
      provider: 'twilio',
      account_sid: formParams.AccountSid || null,
      messaging_service_sid: formParams.MessagingServiceSid || null,
    },
  })
}

async function handleDialog360Webhook(
  request: NextRequest,
  clinicId: string | null,
  campaignId: string | null
): Promise<NextResponse> {
  const qaMock = isQaWebhookMockRequest(request)
  if (!qaMock && process.env.NODE_ENV === 'production' && !verifyBasicAuthorization(request)) {
    console.warn('[whatsapp/webhook] Rejecting unauthorized 360dialog request from', request.headers.get('x-forwarded-for'))
    return NextResponse.json({ error: 'Invalid authorization' }, { status: 403 })
  }

  const payload = await request.json()
  const provider = new Dialog360WhatsAppProvider()
  const firstStatus = provider.parseStatusWebhook(payload)
  const statusUpdates = extractDialog360StatusUpdates(payload)

  if (firstStatus && statusUpdates.length === 0) {
    statusUpdates.push({
      ...firstStatus,
      provider: '360dialog',
    })
  }

  if (statusUpdates.length > 0) {
    await applyProviderStatusUpdates(statusUpdates)
    return new NextResponse('', { status: 200 })
  }

  const inboundMessages = extractDialog360InboundMessages(payload, clinicId, campaignId)
  if (inboundMessages.length === 0) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  for (const inbound of inboundMessages) {
    const response = await handleInboundWhatsAppMessage(request, inbound)
    if (response.status >= 400) {
      return response
    }
  }

  return new NextResponse('', { status: 200 })
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clinicId = searchParams.get('clinicId')
  const campaignId = searchParams.get('campaignId')
  const contentType = request.headers.get('content-type') || ''

  try {
    if (contentType.includes('application/json')) {
      return await handleDialog360Webhook(request, clinicId, campaignId)
    }

    return await handleTwilioWebhook(request, clinicId, campaignId)
  } catch (error) {
    console.error('[whatsapp webhook] Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

async function handleInboundWhatsAppMessage(
  request: NextRequest,
  inbound: InboundWhatsAppMessage
) {
  try {
    let { clinicId, campaignId } = inbound
    const { fromRaw, toRaw, body, profileName, messageSid, ctwaReferral, providerMetadata } = inbound

    if (!fromRaw || !body) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    if (messageSid) {
      const { data: existingMessages } = await supabaseAdmin
        .from('inbox_messages')
        .select('id')
        .eq('channel_message_id', messageSid)
        .limit(1)

      if (existingMessages && existingMessages.length > 0) {
        return new NextResponse('', { status: 200 })
      }
    }

    const contactAddress = normalizeContactAddress(fromRaw)
    const channelAddress = normalizeContactAddress(toRaw)
    const normalizedPhone = stripWhatsAppPrefix(contactAddress)

    if (!clinicId) {
      const { data: channel } = await supabaseAdmin
        .from('marketing_campaign_channels')
        .select('clinic_id, campaign_id')
        .eq('channel_type', 'whatsapp')
        .eq('channel_address', channelAddress)
        .eq('is_active', true)
        .maybeSingle()

      if (channel) {
        clinicId = channel.clinic_id
        if (!campaignId && channel.campaign_id) {
          campaignId = channel.campaign_id
        }
      }
    }

    if (!clinicId) {
      return NextResponse.json(
        { error: 'Missing clinic context' },
        { status: 400 }
      )
    }

    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select('id, name, phone, email')
      .eq('id', clinicId)
      .single()

    if (clinicError || !clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('phone', normalizedPhone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let leadId = lead?.id as string | undefined
    let conversationState = lead?.full_name ? 'chatting' : 'collecting_name'

    if (!leadId) {
      const { data: newLead, error: leadError } = await supabaseAdmin
        .from('leads')
        .insert({
          clinic_id: clinicId,
          campaign_id: campaignId || null,
          phone: normalizedPhone,
          full_name: profileName || null,
          channel: 'whatsapp',
          status: 'new',
          ...(ctwaReferral
            ? {
                ctwa_clid: ctwaReferral.ctwa_clid,
                ad_id: ctwaReferral.ad_id,
                ad_source_type: ctwaReferral.ad_source_type,
                ad_source_url: ctwaReferral.ad_source_url,
                ad_headline: ctwaReferral.ad_headline,
                ad_body: ctwaReferral.ad_body,
                ad_media_type: ctwaReferral.ad_media_type,
                ad_media_url: ctwaReferral.ad_media_url,
              }
            : {}),
        })
        .select()
        .single()

      if (leadError || !newLead) {
        return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
      }

      leadId = newLead.id
      if (newLead.full_name) {
        conversationState = 'chatting'
      }
    } else {
      // Only fill CTWA fields if the existing lead never had attribution.
      // First-touch wins: a returning visitor who clicks a different ad
      // shouldn't overwrite the ad that originally generated this lead.
      const referralUpdate = ctwaReferral && !lead?.ctwa_clid
        ? {
            ctwa_clid: ctwaReferral.ctwa_clid,
            ad_id: ctwaReferral.ad_id,
            ad_source_type: ctwaReferral.ad_source_type,
            ad_source_url: ctwaReferral.ad_source_url,
            ad_headline: ctwaReferral.ad_headline,
            ad_body: ctwaReferral.ad_body,
            ad_media_type: ctwaReferral.ad_media_type,
            ad_media_url: ctwaReferral.ad_media_url,
          }
        : {}

      await supabaseAdmin
        .from('leads')
        .update({
          last_contacted_at: new Date().toISOString(),
          status: lead?.status === 'new' ? 'contacted' : lead?.status,
          ...referralUpdate,
        })
        .eq('id', leadId)
    }

    const { data: existingConversation } = await supabaseAdmin
      .from('inbox_conversations')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('contact_address', contactAddress)
      .in('status', ['bot', 'pending', 'in_progress'])
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let conversation = existingConversation
    let createdConversation = false

    if (!conversation) {
      const { data: newConversation, error: conversationError } = await supabaseAdmin
        .from('inbox_conversations')
        .insert({
          clinic_id: clinicId,
          campaign_id: campaignId || null,
          lead_id: leadId || null,
          channel: 'whatsapp',
          contact_address: contactAddress,
          contact_name: profileName || lead?.full_name || null,
          status: 'bot',
          conversation_state: conversationState,
          last_message_at: new Date().toISOString(),
          last_message_preview: body.slice(0, 200),
        })
        .select()
        .single()

      if (conversationError || !newConversation) {
        return NextResponse.json(
          { error: 'Failed to create conversation' },
          { status: 500 }
        )
      }

      conversation = newConversation
      createdConversation = true
    }

    await supabaseAdmin.from('inbox_messages').insert({
      conversation_id: conversation.id,
      role: 'user',
      content: body,
      direction: 'inbound',
      message_type: 'text',
      channel_message_id: messageSid || null,
      metadata: {
        from: contactAddress,
        to: channelAddress,
        profile_name: profileName || null,
        ...(providerMetadata ? { provider_metadata: providerMetadata } : {}),
        ...(ctwaReferral ? { ctwa_referral: ctwaReferral } : {}),
      },
    })

    if (conversation.status !== 'bot') {
      return new NextResponse('', { status: 200 })
    }

    if (shouldHandoff(body)) {
      await supabaseAdmin
        .from('inbox_conversations')
        .update({ status: 'pending' })
        .eq('id', conversation.id)

      await sendWebhookWhatsAppMessage(request, {
        clinicId,
        recipientPhone: normalizedPhone,
        content: 'Gracias. Un agente te contactara en breve.',
      })

      return new NextResponse('', { status: 200 })
    }

    if (conversation.conversation_state === 'collecting_name') {
      if (createdConversation) {
        await sendWebhookWhatsAppMessage(request, {
          clinicId,
          recipientPhone: normalizedPhone,
          content: 'Hola. Para ayudarte mejor, cual es tu nombre?',
        })
        return new NextResponse('', { status: 200 })
      }

      await supabaseAdmin
        .from('leads')
        .update({ full_name: body, status: 'contacted' })
        .eq('id', leadId)

      await supabaseAdmin
        .from('inbox_conversations')
        .update({ conversation_state: 'collecting_email', contact_name: body })
        .eq('id', conversation.id)

      await sendWebhookWhatsAppMessage(request, {
        clinicId,
        recipientPhone: normalizedPhone,
        content: 'Gracias. Cual es tu correo?',
      })

      return new NextResponse('', { status: 200 })
    }

    if (conversation.conversation_state === 'collecting_email') {
      await supabaseAdmin
        .from('leads')
        .update({ email: body, status: 'contacted' })
        .eq('id', leadId)

      await supabaseAdmin
        .from('inbox_conversations')
        .update({ conversation_state: 'chatting' })
        .eq('id', conversation.id)

      await sendWebhookWhatsAppMessage(request, {
        clinicId,
        recipientPhone: normalizedPhone,
        content: 'Listo, gracias. En que te puedo ayudar?',
      })

      return new NextResponse('', { status: 200 })
    }

    if (!hasAIConfig()) {
      await sendWebhookWhatsAppMessage(request, {
        clinicId,
        recipientPhone: normalizedPhone,
        content: 'Gracias. Un agente te respondera pronto.',
      })
      return new NextResponse('', { status: 200 })
    }

    try {
      validateAIConfig()
    } catch (error) {
      console.error('[whatsapp webhook] AI config error:', error)
      await sendWebhookWhatsAppMessage(request, {
        clinicId,
        recipientPhone: normalizedPhone,
        content: 'Gracias. Un agente te respondera pronto.',
      })
      return new NextResponse('', { status: 200 })
    }

    const { data: campaign } = campaignId
      ? await supabaseAdmin
          .from('marketing_campaigns')
          .select('id, name')
          .eq('id', campaignId)
          .maybeSingle()
      : { data: null }

    const { data: recentMessages } = await supabaseAdmin
      .from('inbox_messages')
      .select('role, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(20)

    const systemPrompt = buildInboxSystemPrompt({
      clinicName: clinic.name,
      clinicPhone: clinic.phone,
      clinicEmail: clinic.email,
      campaignName: campaign?.name || null,
      leadName: lead?.full_name || profileName || null,
      leadEmail: lead?.email || null,
    })

    const aiMessages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(recentMessages || [])
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
          role: msg.role === 'agent' ? 'assistant' : msg.role,
          content: msg.content,
        })),
    ]

    const reply = await aiService.chat(aiMessages)

    const sendResult = await sendWebhookWhatsAppMessage(request, {
      clinicId,
      recipientPhone: normalizedPhone,
      content: reply,
    })

    await supabaseAdmin.from('inbox_messages').insert({
      conversation_id: conversation.id,
      role: 'assistant',
      content: reply,
      direction: 'outbound',
      message_type: 'text',
      channel_message_id: sendResult.messageId || null,
      metadata: {
        provider_status: sendResult.status || null,
        provider_error: sendResult.error || null,
      },
    })

    return new NextResponse('', { status: 200 })
  } catch (error) {
    console.error('[whatsapp webhook] Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
