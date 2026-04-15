import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { aiService } from '@/lib/ai'
import type { Message as AIMessage } from '@/lib/ai'
import { hasAIConfig, validateAIConfig } from '@/lib/ai/config'
import { buildInboxSystemPrompt } from '@/lib/ai/prompts/inbox-prompt'
import { sendWhatsAppMessage } from '@/lib/whatsapp/service'

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

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let clinicId = searchParams.get('clinicId')
    let campaignId = searchParams.get('campaignId')

    const form = await request.formData()
    const formParams: Record<string, string> = {}
    form.forEach((value, key) => {
      formParams[key] = String(value)
    })

    // Verify Twilio signature BEFORE we trust any field. Build the URL
    // exactly as Twilio saw it (including query string). Use the
    // x-forwarded-* headers because Vercel terminates TLS upstream.
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
    const fullUrl = `${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`
    const authToken = process.env.TWILIO_AUTH_TOKEN || ''
    const signature = request.headers.get('x-twilio-signature')

    // Allow opting out only in dev. In production the signature is required.
    const sigOk = verifyTwilioSignature(signature, fullUrl, formParams, authToken)
    if (!sigOk && process.env.NODE_ENV === 'production') {
      console.warn('[whatsapp/webhook] Rejecting unsigned request from', request.headers.get('x-forwarded-for'))
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const fromRaw = formParams.From || ''
    const toRaw = formParams.To || ''
    const body = (formParams.Body || '').trim()
    const profileName = (formParams.ProfileName || '').trim()
    const messageSid = (formParams.MessageSid || '').trim()

    if (!fromRaw || !body) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
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
      await supabaseAdmin
        .from('leads')
        .update({
          last_contacted_at: new Date().toISOString(),
          status: lead?.status === 'new' ? 'contacted' : lead?.status,
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

      await sendWhatsAppMessage({
        clinicId,
        recipientPhone: normalizedPhone,
        content: 'Gracias. Un agente te contactara en breve.',
      })

      return new NextResponse('', { status: 200 })
    }

    if (conversation.conversation_state === 'collecting_name') {
      if (createdConversation) {
        await sendWhatsAppMessage({
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

      await sendWhatsAppMessage({
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

      await sendWhatsAppMessage({
        clinicId,
        recipientPhone: normalizedPhone,
        content: 'Listo, gracias. En que te puedo ayudar?',
      })

      return new NextResponse('', { status: 200 })
    }

    if (!hasAIConfig()) {
      await sendWhatsAppMessage({
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
      await sendWhatsAppMessage({
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

    const sendResult = await sendWhatsAppMessage({
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
