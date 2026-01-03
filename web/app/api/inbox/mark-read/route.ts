import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'

const schema = z.object({
  conversationId: z.string().uuid(),
})

export const POST = withPermission('inbox.view', async (request, context) => {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { conversationId } = parsed.data
  const { clinicId } = context

  const { data: conversation, error: fetchError } = await supabaseAdmin
    .from('inbox_conversations')
    .select('id, clinic_id, unread_count')
    .eq('id', conversationId)
    .single()

  if (fetchError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  if (conversation.clinic_id !== clinicId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!conversation.unread_count || conversation.unread_count === 0) {
    return NextResponse.json({ data: conversation })
  }

  const { data, error } = await supabaseAdmin
    .from('inbox_conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to mark conversation as read', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ data })
})
