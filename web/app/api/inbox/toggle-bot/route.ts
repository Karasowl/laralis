import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'

const schema = z.object({
  conversationId: z.string().uuid(),
})

export const POST = withPermission('inbox.assign', async (request, context) => {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { conversationId } = parsed.data
  const { clinicId, userId } = context

  const { data: conversation, error: fetchError } = await supabaseAdmin
    .from('inbox_conversations')
    .select('id, clinic_id, status, assigned_user_id')
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

  const nextStatus = conversation.status === 'bot' ? 'in_progress' : 'bot'
  const assignedUserId =
    nextStatus === 'in_progress'
      ? conversation.assigned_user_id || userId
      : conversation.assigned_user_id

  const { data, error } = await supabaseAdmin
    .from('inbox_conversations')
    .update({
      status: nextStatus,
      assigned_user_id: assignedUserId,
    })
    .eq('id', conversationId)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to toggle bot status', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ data })
})
