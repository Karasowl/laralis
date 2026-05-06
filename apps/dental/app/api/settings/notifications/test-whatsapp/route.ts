import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { resolveClinicContext } from '@/lib/clinic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { getWhatsAppConfig, sendWhatsAppMessage } from '@/lib/whatsapp/service'
import { readJson, validateSchema } from '@/lib/validation'
import type { MessageStatus, WhatsAppProvider } from '@/lib/whatsapp/types'

export const dynamic = 'force-dynamic'

const STAGE_SUPABASE_REF = 'kafbqdliromcveojtdar'

const testWhatsAppSchema = z.object({
  phone: z.string().trim().min(6).max(40).optional(),
})

function qaTestMode(request: NextRequest): 'mock' | 'fail' | null {
  const mode = request.headers.get('x-laralis-qa-whatsapp-test')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const isStage = supabaseUrl.includes(STAGE_SUPABASE_REF)

  if (!isStage) return null
  return mode === 'mock' || mode === 'fail' ? mode : null
}

async function logWhatsAppTestNotification(params: {
  clinicId: string
  recipientPhone: string
  recipientName: string
  content: string
  provider: WhatsAppProvider
  providerMessageId: string | null
  status: MessageStatus
  errorMessage?: string | null
  metadata?: Record<string, unknown>
}) {
  const { error } = await supabaseAdmin
    .from('whatsapp_notifications')
    .insert({
      clinic_id: params.clinicId,
      notification_type: 'custom',
      recipient_phone: params.recipientPhone,
      recipient_name: params.recipientName,
      message_content: params.content,
      status: params.status,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
      error_message: params.errorMessage || null,
      provider: params.provider,
      provider_message_id: params.providerMessageId,
      provider_status: params.status,
      cost_cents: 0,
      metadata: {
        source: 'settings_test',
        ...(params.metadata || {}),
      },
    })

  if (error) {
    console.error('[settings/notifications/test-whatsapp] Failed to log test notification:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const clinicContext = await resolveClinicContext({ cookieStore })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      )
    }

    const forbidden = await forbiddenIfMissingPermission(
      clinicContext.userId,
      clinicContext.clinicId,
      'settings.edit'
    )
    if (forbidden) return forbidden

    const bodyResult = await readJson(request)
    if ('error' in bodyResult) return bodyResult.error

    const parseResult = validateSchema(testWhatsAppSchema, bodyResult.data, 'Invalid test payload')
    if ('error' in parseResult) return parseResult.error

    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: clinic } = await supabaseAdmin
      .from('clinics')
      .select('name, phone')
      .eq('id', clinicContext.clinicId)
      .single()

    const recipientPhone = parseResult.data.phone || clinic?.phone || ''
    if (!recipientPhone) {
      return NextResponse.json(
        { error: 'A WhatsApp test phone number is required' },
        { status: 400 }
      )
    }

    const config = await getWhatsAppConfig(clinicContext.clinicId)
    if (!config?.enabled) {
      return NextResponse.json(
        { error: 'WhatsApp is not enabled for this clinic' },
        { status: 400 }
      )
    }

    const provider = config.provider
    const userEmail = authData.user.email || 'settings user'
    const clinicName = clinic?.name || 'Clinic'
    const content = `Mensaje de prueba de Laralis para ${clinicName}. Tu configuracion de WhatsApp esta activa.`
    const mode = qaTestMode(request)

    if (mode === 'fail') {
      const providerMessageId = `qa-whatsapp-test-failed-${Date.now()}`
      await logWhatsAppTestNotification({
        clinicId: clinicContext.clinicId,
        recipientPhone,
        recipientName: userEmail,
        content,
        provider,
        providerMessageId,
        status: 'failed',
        errorMessage: 'QA forced WhatsApp test failure',
        metadata: { qa: true, mode },
      })

      return NextResponse.json(
        { error: 'QA forced WhatsApp test failure', messageId: providerMessageId },
        { status: 500 }
      )
    }

    if (mode === 'mock') {
      const providerMessageId = `qa-whatsapp-test-${Date.now()}`
      await logWhatsAppTestNotification({
        clinicId: clinicContext.clinicId,
        recipientPhone,
        recipientName: userEmail,
        content,
        provider,
        providerMessageId,
        status: 'sent',
        metadata: { qa: true, mode },
      })

      return NextResponse.json({
        success: true,
        messageId: providerMessageId,
        provider,
        status: 'sent',
      })
    }

    const result = await sendWhatsAppMessage({
      clinicId: clinicContext.clinicId,
      recipientPhone,
      content,
    })

    await logWhatsAppTestNotification({
      clinicId: clinicContext.clinicId,
      recipientPhone,
      recipientName: userEmail,
      content,
      provider,
      providerMessageId: result.messageId || null,
      status: result.success ? (result.status || 'sent') : 'failed',
      errorMessage: result.error || null,
      metadata: { qa: false },
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send WhatsApp test message' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      provider,
      status: result.status || 'sent',
    })
  } catch (error) {
    console.error('[settings/notifications/test-whatsapp] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
