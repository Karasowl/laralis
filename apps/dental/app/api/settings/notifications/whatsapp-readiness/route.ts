import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { getWhatsAppConfig } from '@/lib/whatsapp/service'
import { getProviderFromConfig } from '@/lib/whatsapp/providers'
import type { WhatsAppConfig, WhatsAppProvider } from '@/lib/whatsapp/types'

export const dynamic = 'force-dynamic'

type CheckStatus = 'pass' | 'fail' | 'manual'

type ReadinessCheck = {
  id:
    | 'enabled'
    | 'provider_credentials'
    | 'sender_number'
    | 'webhook_security'
    | 'external_provider_setup'
  status: CheckStatus
  required: boolean
  message?: string
}

function webhookSecurityConfigured(provider: WhatsAppProvider) {
  if (provider === 'twilio') {
    return Boolean(process.env.TWILIO_AUTH_TOKEN?.trim())
  }

  return Boolean(
    process.env.WHATSAPP_WEBHOOK_BASIC_AUTH?.trim() ||
      (process.env.WHATSAPP_WEBHOOK_BASIC_USER?.trim() &&
        process.env.WHATSAPP_WEBHOOK_BASIC_PASSWORD?.trim())
  )
}

function senderNumberCheck(config: WhatsAppConfig): ReadinessCheck {
  if (config.provider === 'twilio') {
    return {
      id: 'sender_number',
      status: config.twilio_phone_number?.trim() ? 'pass' : 'fail',
      required: true,
      message: config.twilio_phone_number?.trim()
        ? undefined
        : 'Twilio WhatsApp sender phone number is missing',
    }
  }

  return {
    id: 'sender_number',
    status: 'manual',
    required: false,
    message: '360dialog sender approval is managed outside Laralis',
  }
}

function buildChecks(config: WhatsAppConfig): ReadinessCheck[] {
  const provider = getProviderFromConfig(config)
  const validation = provider.validateConfig(config)

  return [
    {
      id: 'enabled',
      status: config.enabled ? 'pass' : 'fail',
      required: true,
      message: config.enabled ? undefined : 'WhatsApp is disabled for this clinic',
    },
    {
      id: 'provider_credentials',
      status: validation.valid ? 'pass' : 'fail',
      required: true,
      message: validation.error,
    },
    senderNumberCheck(config),
    {
      id: 'webhook_security',
      status: webhookSecurityConfigured(config.provider) ? 'pass' : 'fail',
      required: true,
      message:
        config.provider === 'twilio'
          ? 'TWILIO_AUTH_TOKEN must be configured in the runtime environment'
          : 'WHATSAPP_WEBHOOK_BASIC_AUTH or WHATSAPP_WEBHOOK_BASIC_USER/PASSWORD must be configured in the runtime environment',
    },
    {
      id: 'external_provider_setup',
      status: 'manual',
      required: false,
      message:
        'Laralis cannot verify WhatsApp Business approval, sender quality, templates, or provider dashboard webhook registration without a real provider smoke test',
    },
  ]
}

export async function GET(request: NextRequest) {
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
      'settings.view'
    )
    if (forbidden) return forbidden

    const config = await getWhatsAppConfig(clinicContext.clinicId)
    if (!config) {
      return NextResponse.json(
        { error: 'WhatsApp configuration could not be loaded' },
        { status: 500 }
      )
    }

    const checks = buildChecks(config)
    const ready = checks
      .filter((check) => check.required)
      .every((check) => check.status === 'pass')
    const origin = request.headers.get('origin') || request.nextUrl.origin
    const webhookUrl = `${origin}/api/whatsapp/webhook?clinicId=${encodeURIComponent(clinicContext.clinicId)}`

    return NextResponse.json({
      ready,
      externalVerificationRequired: true,
      provider: config.provider,
      webhookUrl,
      checks,
    })
  } catch (error) {
    console.error('[settings/notifications/whatsapp-readiness] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
