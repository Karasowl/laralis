import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'
import { readJson, validateSchema } from '@/lib/validation'

const schema = z.object({
  conversationId: z.string().uuid(),
})

export const POST = withPermission('inbox.assign', async (request, context) => {
  const bodyResult = await readJson(request)
  if ('error' in bodyResult) {
    return bodyResult.error
  }
  const parsed = validateSchema(schema, bodyResult.data, 'Invalid payload')
  if ('error' in parsed) {
    return parsed.error
  }

  const { conversationId } = parsed.data
  const { clinicId, userId } = context

  const { data: conversation, error: fetchError } = await supabaseAdmin
    .from('inbox_conversations')
    .select('id, clinic_id, status')
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

  const { data, error } = await supabaseAdmin
    .from('inbox_conversations')
    .update({ status: 'in_progress', assigned_user_id: userId })
    .eq('id', conversationId)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to assign conversation', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ data })
})
