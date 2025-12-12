/**
 * WhatsApp Notification Service
 *
 * Handles sending WhatsApp messages through configured provider.
 * Supports template-based messages with variable substitution.
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getProviderFromConfig } from './providers'
import type {
  WhatsAppConfig,
  WhatsAppTemplate,
  SendMessageParams,
  SendMessageResult,
  NotificationType,
} from './types'

// Default config for new clinics
const DEFAULT_WHATSAPP_CONFIG: WhatsAppConfig = {
  enabled: false,
  provider: 'twilio',
  default_country_code: '52', // Mexico
  send_confirmations: true,
  send_reminders: true,
  reminder_hours_before: 24,
}

/**
 * Get WhatsApp config for a clinic
 */
export async function getWhatsAppConfig(
  clinicId: string
): Promise<WhatsAppConfig | null> {
  const { data: clinic, error } = await supabaseAdmin
    .from('clinics')
    .select('notification_settings')
    .eq('id', clinicId)
    .single()

  if (error || !clinic) {
    console.error('[whatsapp] Failed to get clinic config:', error)
    return null
  }

  const settings = clinic.notification_settings as Record<string, unknown> | null
  if (!settings?.whatsapp) {
    return DEFAULT_WHATSAPP_CONFIG
  }

  return {
    ...DEFAULT_WHATSAPP_CONFIG,
    ...(settings.whatsapp as Partial<WhatsAppConfig>),
  }
}

/**
 * Check if WhatsApp is enabled for a clinic
 */
export async function isWhatsAppEnabled(clinicId: string): Promise<boolean> {
  const config = await getWhatsAppConfig(clinicId)
  return config?.enabled ?? false
}

/**
 * Get template for a notification type
 */
export async function getTemplate(
  clinicId: string,
  templateType: NotificationType,
  language: string = 'es'
): Promise<WhatsAppTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_templates')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('template_type', templateType)
    .eq('language', language)
    .eq('is_active', true)
    .single()

  if (error) {
    // Try fallback language
    if (language !== 'es') {
      return getTemplate(clinicId, templateType, 'es')
    }
    console.error('[whatsapp] Template not found:', error)
    return null
  }

  return data as WhatsAppTemplate
}

/**
 * Replace template variables with actual values
 */
export function interpolateTemplate(
  content: string,
  variables: Record<string, string>
): string {
  let result = content
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`
    result = result.replace(new RegExp(placeholder, 'g'), value)
  }
  return result
}

/**
 * Format date for display in messages
 */
export function formatDateForMessage(dateStr: string, locale: string = 'es-MX'): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format time for display in messages
 */
export function formatTimeForMessage(timeStr: string): string {
  if (!timeStr) return ''
  const [hours, minutes] = timeStr.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

/**
 * Send a WhatsApp notification
 */
export async function sendWhatsAppNotification(
  params: SendMessageParams
): Promise<SendMessageResult> {
  const {
    clinicId,
    recipientPhone,
    recipientName,
    templateType,
    variables,
    treatmentId,
    patientId,
    publicBookingId,
    language = 'es',
  } = params

  // Get config
  const config = await getWhatsAppConfig(clinicId)
  if (!config || !config.enabled) {
    return { success: false, error: 'WhatsApp is not enabled for this clinic' }
  }

  // Validate config
  const provider = getProviderFromConfig(config)
  const validation = provider.validateConfig(config)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  // Get template
  const template = await getTemplate(clinicId, templateType, language)
  if (!template) {
    return { success: false, error: `Template not found for type: ${templateType}` }
  }

  // Interpolate variables
  const messageContent = interpolateTemplate(template.content, variables)

  // Send message
  const result = await provider.sendMessage(recipientPhone, messageContent, config)

  // Log the notification
  const { error: logError } = await supabaseAdmin.from('whatsapp_notifications').insert({
    clinic_id: clinicId,
    treatment_id: treatmentId || null,
    patient_id: patientId || null,
    public_booking_id: publicBookingId || null,
    notification_type: templateType,
    recipient_phone: recipientPhone,
    recipient_name: recipientName,
    message_content: messageContent,
    template_id: template.id,
    status: result.success ? (result.status || 'sent') : 'failed',
    sent_at: result.success ? new Date().toISOString() : null,
    error_message: result.error || null,
    provider: config.provider,
    provider_message_id: result.messageId || null,
    cost_cents: result.costCents || 0,
  })

  if (logError) {
    console.error('[whatsapp] Failed to log notification:', logError)
  }

  return result
}

/**
 * Send appointment confirmation via WhatsApp
 */
export async function sendAppointmentConfirmation(params: {
  clinicId: string
  clinicName: string
  patientName: string
  patientPhone: string
  patientId: string
  treatmentId: string
  serviceName: string
  appointmentDate: string
  appointmentTime: string
  language?: string
}): Promise<SendMessageResult> {
  const config = await getWhatsAppConfig(params.clinicId)
  if (!config?.enabled || !config.send_confirmations) {
    return { success: false, error: 'Confirmations not enabled' }
  }

  return sendWhatsAppNotification({
    clinicId: params.clinicId,
    recipientPhone: params.patientPhone,
    recipientName: params.patientName,
    templateType: 'appointment_confirmation',
    treatmentId: params.treatmentId,
    patientId: params.patientId,
    language: params.language,
    variables: {
      patient_name: params.patientName,
      clinic_name: params.clinicName,
      service_name: params.serviceName,
      date: formatDateForMessage(params.appointmentDate),
      time: formatTimeForMessage(params.appointmentTime),
    },
  })
}

/**
 * Send appointment reminder via WhatsApp
 */
export async function sendAppointmentReminder(params: {
  clinicId: string
  clinicName: string
  patientName: string
  patientPhone: string
  patientId: string
  treatmentId: string
  serviceName: string
  appointmentDate: string
  appointmentTime: string
  hoursUntil: number
  language?: string
}): Promise<SendMessageResult> {
  const config = await getWhatsAppConfig(params.clinicId)
  if (!config?.enabled || !config.send_reminders) {
    return { success: false, error: 'Reminders not enabled' }
  }

  const timeUntil =
    params.hoursUntil === 24
      ? 'mañana'
      : params.hoursUntil === 1
      ? 'en 1 hora'
      : `en ${params.hoursUntil} horas`

  return sendWhatsAppNotification({
    clinicId: params.clinicId,
    recipientPhone: params.patientPhone,
    recipientName: params.patientName,
    templateType: 'appointment_reminder',
    treatmentId: params.treatmentId,
    patientId: params.patientId,
    language: params.language,
    variables: {
      patient_name: params.patientName,
      clinic_name: params.clinicName,
      service_name: params.serviceName,
      date: formatDateForMessage(params.appointmentDate),
      time: formatTimeForMessage(params.appointmentTime),
      time_until: timeUntil,
    },
  })
}

/**
 * Send booking received notification via WhatsApp
 */
export async function sendBookingReceivedWhatsApp(params: {
  clinicId: string
  clinicName: string
  patientName: string
  patientPhone: string
  publicBookingId: string
  serviceName: string
  requestedDate: string
  requestedTime: string
  language?: string
}): Promise<SendMessageResult> {
  const config = await getWhatsAppConfig(params.clinicId)
  if (!config?.enabled) {
    return { success: false, error: 'WhatsApp not enabled' }
  }

  return sendWhatsAppNotification({
    clinicId: params.clinicId,
    recipientPhone: params.patientPhone,
    recipientName: params.patientName,
    templateType: 'booking_received',
    publicBookingId: params.publicBookingId,
    language: params.language,
    variables: {
      patient_name: params.patientName,
      clinic_name: params.clinicName,
      service_name: params.serviceName,
      date: formatDateForMessage(params.requestedDate),
      time: formatTimeForMessage(params.requestedTime),
    },
  })
}

/**
 * Update notification status from webhook
 */
export async function updateNotificationStatus(
  providerMessageId: string,
  status: string,
  timestamp?: string,
  errorMessage?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'delivered' && timestamp) {
    updateData.delivered_at = timestamp
  }
  if (status === 'read' && timestamp) {
    updateData.read_at = timestamp
  }
  if (errorMessage) {
    updateData.error_message = errorMessage
  }

  const { error } = await supabaseAdmin
    .from('whatsapp_notifications')
    .update(updateData)
    .eq('provider_message_id', providerMessageId)

  if (error) {
    console.error('[whatsapp] Failed to update status:', error)
  }
}
