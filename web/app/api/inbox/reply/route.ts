import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'
import { sendWhatsAppMessage } from '@/lib/whatsapp/service'

const schema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1),
})

export const POST = withPermission('inbox.reply', async (request, context) => {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { conversationId, content } = parsed.data
  const { clinicId, userId } = context

  const { data: conversation, error: fetchError } = await supabaseAdmin
    .from('inbox_conversations')
    .select('id, clinic_id, status, channel, contact_address, assigned_user_id')
    .eq('id', conversationId)
    .single()

  if (fetchError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  if (conversation.clinic_id !== clinicId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (conversation.status === 'closed') {
    return NextResponse.json({ error: 'Conversation is closed' }, { status: 400 })
  }

  if (conversation.channel !== 'whatsapp') {
    return NextResponse.json({ error: 'Unsupported channel' }, { status: 400 })
  }

  const sendResult = await sendWhatsAppMessage({
    clinicId,
    recipientPhone: conversation.contact_address,
    content,
  })

  const { data: message, error: messageError } = await supabaseAdmin
    .from('inbox_messages')
    .insert({
      conversation_id: conversationId,
      role: 'agent',
      sender_user_id: userId,
      content,
      direction: 'outbound',
      message_type: 'text',
      channel_message_id: sendResult.messageId || null,
      metadata: {
        provider_status: sendResult.status || null,
        provider_error: sendResult.error || null,
      },
    })
    .select()
    .single()

  if (messageError) {
    return NextResponse.json(
      { error: 'Failed to store message', message: messageError.message },
      { status: 500 }
    )
  }

  await supabaseAdmin
    .from('inbox_conversations')
    .update({
      status: 'in_progress',
      assigned_user_id: conversation.assigned_user_id || userId,
    })
    .eq('id', conversationId)

  if (!sendResult.success) {
    return NextResponse.json(
      { error: sendResult.error || 'Failed to send message', data: message },
      { status: 502 }
    )
  }

  return NextResponse.json({ data: message, sendResult })
})
