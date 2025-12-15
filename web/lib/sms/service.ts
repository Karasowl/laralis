/**
 * SMS Notification Service
 *
 * Handles sending SMS messages via Twilio with granular notification settings.
 * Supports notifications to both patients and clinic staff.
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type {
  SMSConfig,
  SendSMSParams,
  SendSMSResult,
  NotificationType,
} from './types'
import { DEFAULT_SMS_CONFIG } from './types'

/** Event types for SMS notifications */
export type SMSEventType =
  | 'on_treatment_created'
  | 'on_treatment_updated'
  | 'reminder_24h'
  | 'reminder_2h'

/**
 * Get SMS config for a clinic with deep merge of nested objects
 */
export async function getSMSConfig(clinicId: string): Promise<SMSConfig> {
  const { data: clinic, error } = await supabaseAdmin
    .from('clinics')
    .select('notification_settings')
    .eq('id', clinicId)
    .single()

  if (error || !clinic) {
    console.error('[sms] Failed to get clinic config:', error)
    return DEFAULT_SMS_CONFIG
  }

  const settings = clinic.notification_settings as Record<string, unknown> | null
  const smsSettings = settings?.sms as Partial<SMSConfig> | undefined

  if (!smsSettings) {
    return DEFAULT_SMS_CONFIG
  }

  // Deep merge with defaults
  return mergeSMSConfigWithDefaults(smsSettings)
}

/**
 * Get SMS config from notification_settings object (synchronous)
 * Use this when you already have the settings loaded
 */
export function getSMSConfigFromSettings(
  notificationSettings: Record<string, unknown> | null
): SMSConfig {
  const smsSettings = notificationSettings?.sms as Partial<SMSConfig> | undefined
  if (!smsSettings) {
    return DEFAULT_SMS_CONFIG
  }
  return mergeSMSConfigWithDefaults(smsSettings)
}

/**
 * Deep merge SMS settings with defaults
 */
function mergeSMSConfigWithDefaults(smsSettings: Partial<SMSConfig>): SMSConfig {
  return {
    enabled: smsSettings.enabled ?? DEFAULT_SMS_CONFIG.enabled,
    default_country_code: smsSettings.default_country_code ?? DEFAULT_SMS_CONFIG.default_country_code,
    patient: {
      ...DEFAULT_SMS_CONFIG.patient,
      ...(smsSettings.patient || {}),
    },
    staff: {
      ...DEFAULT_SMS_CONFIG.staff,
      ...(smsSettings.staff || {}),
    },
  }
}

/**
 * Check if a specific notification event is enabled
 */
export function isEventEnabled(
  config: SMSConfig,
  recipient: 'patient' | 'staff',
  event: SMSEventType
): boolean {
  if (!config.enabled) return false
  if (recipient === 'staff' && !config.staff.enabled) return false
  return config[recipient][event] ?? false
}

/**
 * Check if SMS is enabled for a clinic
 */
export async function isSMSEnabled(clinicId: string): Promise<boolean> {
  const config = await getSMSConfig(clinicId)
  return config.enabled
}

/**
 * Get Twilio credentials from environment variables
 */
function getTwilioCredentials() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  }
}

/**
 * Validate Twilio config from environment variables
 */
function validateTwilioConfig(): { valid: boolean; error?: string } {
  const { accountSid, authToken, phoneNumber } = getTwilioCredentials()
  if (!accountSid) {
    return { valid: false, error: 'TWILIO_ACCOUNT_SID not configured' }
  }
  if (!authToken) {
    return { valid: false, error: 'TWILIO_AUTH_TOKEN not configured' }
  }
  if (!phoneNumber) {
    return { valid: false, error: 'TWILIO_PHONE_NUMBER not configured' }
  }
  return { valid: true }
}

/**
 * Format phone number to E.164 format
 * Example: +521234567890
 */
export function formatPhoneNumber(phone: string, countryCode: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '')

  // If it already starts with country code, just add +
  if (cleaned.startsWith(countryCode)) {
    return `+${cleaned}`
  }

  // If it starts with +, keep it
  if (phone.startsWith('+')) {
    return phone.replace(/\D/g, (match, offset) => (offset === 0 ? '+' : ''))
  }

  // Add country code
  return `+${countryCode}${cleaned}`
}

/**
 * Send SMS via Twilio using environment credentials
 */
async function sendViaTwilio(
  to: string,
  message: string
): Promise<SendSMSResult> {
  const { accountSid, authToken, phoneNumber } = getTwilioCredentials()

  if (!accountSid || !authToken || !phoneNumber) {
    return { success: false, error: 'Twilio config incomplete' }
  }

  try {
    // Twilio API endpoint
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    // Prepare request
    const params = new URLSearchParams({
      To: to,
      From: phoneNumber,
      Body: message,
    })

    // Send request with Basic Auth
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body: params.toString(),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[sms] Twilio error:', data)
      return {
        success: false,
        error: data.message || `Twilio API error: ${response.status}`,
      }
    }

    // Twilio successful response
    return {
      success: true,
      messageId: data.sid,
      status: mapTwilioStatus(data.status),
      costCents: 2, // ~2 cents USD per SMS (estimate)
    }
  } catch (error) {
    console.error('[sms] Twilio request failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Map Twilio status to our internal status
 */
function mapTwilioStatus(twilioStatus: string): 'pending' | 'sent' | 'delivered' | 'failed' | 'undelivered' {
  switch (twilioStatus) {
    case 'queued':
    case 'sending':
      return 'pending'
    case 'sent':
      return 'sent'
    case 'delivered':
      return 'delivered'
    case 'failed':
      return 'failed'
    case 'undelivered':
      return 'undelivered'
    default:
      return 'pending'
  }
}

/**
 * Send SMS notification
 */
export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  const {
    clinicId,
    recipientPhone,
    recipientName,
    message,
    notificationType,
    treatmentId,
    patientId,
  } = params

  // Get config
  const config = await getSMSConfig(clinicId)
  if (!config.enabled) {
    return { success: false, error: 'SMS is not enabled for this clinic' }
  }

  // Validate Twilio credentials
  const validation = validateTwilioConfig()
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  // Format phone number
  const formattedPhone = formatPhoneNumber(recipientPhone, config.default_country_code)

  // Send SMS
  const result = await sendViaTwilio(formattedPhone, message)

  // Log the notification
  const { error: logError } = await supabaseAdmin.from('sms_notifications').insert({
    clinic_id: clinicId,
    treatment_id: treatmentId || null,
    patient_id: patientId || null,
    notification_type: notificationType,
    recipient_phone: formattedPhone,
    recipient_name: recipientName,
    message_content: message,
    status: result.success ? (result.status || 'sent') : 'failed',
    sent_at: result.success ? new Date().toISOString() : null,
    error_message: result.error || null,
    provider: 'twilio',
    provider_message_id: result.messageId || null,
    cost_cents: result.costCents || 2,
  })

  if (logError) {
    console.error('[sms] Failed to log notification:', logError)
  }

  return result
}

/** Parameters for treatment notification */
export interface TreatmentNotificationParams {
  clinicId: string
  clinicName: string
  patientName: string
  patientPhone: string
  patientId: string
  treatmentId: string
  serviceName: string
  appointmentDate: string
  appointmentTime: string
}

/** Parameters for treatment update notification */
export interface TreatmentUpdateParams extends TreatmentNotificationParams {
  changes: {
    date?: { from: string; to: string }
    time?: { from: string; to: string }
    service?: { from: string; to: string }
  }
}

/**
 * Send treatment created SMS to patient
 */
export async function sendTreatmentCreatedToPatient(
  params: TreatmentNotificationParams
): Promise<SendSMSResult> {
  const config = await getSMSConfig(params.clinicId)
  if (!isEventEnabled(config, 'patient', 'on_treatment_created')) {
    return { success: false, error: 'Patient treatment created notifications not enabled' }
  }

  const message = `Hola ${params.patientName}, tu cita en ${params.clinicName} ha sido confirmada.\n\nServicio: ${params.serviceName}\nFecha: ${formatDateForMessage(params.appointmentDate)}\nHora: ${formatTimeForMessage(params.appointmentTime)}\n\n¡Te esperamos!`

  return sendSMS({
    clinicId: params.clinicId,
    recipientPhone: params.patientPhone,
    recipientName: params.patientName,
    message,
    notificationType: 'appointment_confirmation',
    treatmentId: params.treatmentId,
    patientId: params.patientId,
  })
}

/**
 * Send treatment created SMS to staff
 */
export async function sendTreatmentCreatedToStaff(
  params: TreatmentNotificationParams
): Promise<{ primary: SendSMSResult; extra?: SendSMSResult }> {
  const config = await getSMSConfig(params.clinicId)
  if (!isEventEnabled(config, 'staff', 'on_treatment_created')) {
    return { primary: { success: false, error: 'Staff treatment created notifications not enabled' } }
  }

  const message = `Nueva cita programada en ${params.clinicName}:\n\nPaciente: ${params.patientName}\nTeléfono: ${params.patientPhone}\nServicio: ${params.serviceName}\nFecha: ${formatDateForMessage(params.appointmentDate)}\nHora: ${formatTimeForMessage(params.appointmentTime)}`

  const results: { primary: SendSMSResult; extra?: SendSMSResult } = {
    primary: { success: false, error: 'No staff phone configured' },
  }

  // Send to primary staff phone
  if (config.staff.phone) {
    results.primary = await sendSMS({
      clinicId: params.clinicId,
      recipientPhone: config.staff.phone,
      recipientName: 'Staff',
      message,
      notificationType: 'appointment_confirmation',
      treatmentId: params.treatmentId,
      patientId: params.patientId,
    })
  }

  // Send to extra phone if configured
  if (config.staff.extra_phone) {
    results.extra = await sendSMS({
      clinicId: params.clinicId,
      recipientPhone: config.staff.extra_phone,
      recipientName: 'Staff (Extra)',
      message,
      notificationType: 'appointment_confirmation',
      treatmentId: params.treatmentId,
      patientId: params.patientId,
    })
  }

  return results
}

/**
 * Send treatment updated SMS to patient
 */
export async function sendTreatmentUpdatedToPatient(
  params: TreatmentUpdateParams
): Promise<SendSMSResult> {
  const config = await getSMSConfig(params.clinicId)
  if (!isEventEnabled(config, 'patient', 'on_treatment_updated')) {
    return { success: false, error: 'Patient treatment updated notifications not enabled' }
  }

  // Build changes text
  const changesList: string[] = []
  if (params.changes.date) {
    changesList.push(`Fecha: ${formatDateForMessage(params.changes.date.from)} → ${formatDateForMessage(params.changes.date.to)}`)
  }
  if (params.changes.time) {
    changesList.push(`Hora: ${formatTimeForMessage(params.changes.time.from)} → ${formatTimeForMessage(params.changes.time.to)}`)
  }
  if (params.changes.service) {
    changesList.push(`Servicio: ${params.changes.service.from} → ${params.changes.service.to}`)
  }

  const message = `Hola ${params.patientName}, tu cita en ${params.clinicName} ha sido modificada.\n\nCambios:\n${changesList.join('\n')}\n\nNueva cita:\nServicio: ${params.serviceName}\nFecha: ${formatDateForMessage(params.appointmentDate)}\nHora: ${formatTimeForMessage(params.appointmentTime)}`

  return sendSMS({
    clinicId: params.clinicId,
    recipientPhone: params.patientPhone,
    recipientName: params.patientName,
    message,
    notificationType: 'appointment_rescheduled',
    treatmentId: params.treatmentId,
    patientId: params.patientId,
  })
}

/**
 * Send treatment updated SMS to staff
 */
export async function sendTreatmentUpdatedToStaff(
  params: TreatmentUpdateParams
): Promise<{ primary: SendSMSResult; extra?: SendSMSResult }> {
  const config = await getSMSConfig(params.clinicId)
  if (!isEventEnabled(config, 'staff', 'on_treatment_updated')) {
    return { primary: { success: false, error: 'Staff treatment updated notifications not enabled' } }
  }

  // Build changes text
  const changesList: string[] = []
  if (params.changes.date) {
    changesList.push(`Fecha: ${formatDateForMessage(params.changes.date.from)} → ${formatDateForMessage(params.changes.date.to)}`)
  }
  if (params.changes.time) {
    changesList.push(`Hora: ${formatTimeForMessage(params.changes.time.from)} → ${formatTimeForMessage(params.changes.time.to)}`)
  }
  if (params.changes.service) {
    changesList.push(`Servicio: ${params.changes.service.from} → ${params.changes.service.to}`)
  }

  const message = `Cita modificada en ${params.clinicName}:\n\nPaciente: ${params.patientName}\nTeléfono: ${params.patientPhone}\n\nCambios:\n${changesList.join('\n')}\n\nNueva cita:\nServicio: ${params.serviceName}\nFecha: ${formatDateForMessage(params.appointmentDate)}\nHora: ${formatTimeForMessage(params.appointmentTime)}`

  const results: { primary: SendSMSResult; extra?: SendSMSResult } = {
    primary: { success: false, error: 'No staff phone configured' },
  }

  // Send to primary staff phone
  if (config.staff.phone) {
    results.primary = await sendSMS({
      clinicId: params.clinicId,
      recipientPhone: config.staff.phone,
      recipientName: 'Staff',
      message,
      notificationType: 'appointment_rescheduled',
      treatmentId: params.treatmentId,
      patientId: params.patientId,
    })
  }

  // Send to extra phone if configured
  if (config.staff.extra_phone) {
    results.extra = await sendSMS({
      clinicId: params.clinicId,
      recipientPhone: config.staff.extra_phone,
      recipientName: 'Staff (Extra)',
      message,
      notificationType: 'appointment_rescheduled',
      treatmentId: params.treatmentId,
      patientId: params.patientId,
    })
  }

  return results
}

/**
 * Send all treatment created notifications (patient + staff)
 */
export async function sendAllTreatmentCreatedNotifications(
  params: TreatmentNotificationParams
): Promise<{ patient: SendSMSResult; staff: { primary: SendSMSResult; extra?: SendSMSResult } }> {
  const [patientResult, staffResult] = await Promise.all([
    sendTreatmentCreatedToPatient(params),
    sendTreatmentCreatedToStaff(params),
  ])

  return { patient: patientResult, staff: staffResult }
}

/**
 * Send all treatment updated notifications (patient + staff)
 */
export async function sendAllTreatmentUpdatedNotifications(
  params: TreatmentUpdateParams
): Promise<{ patient: SendSMSResult; staff: { primary: SendSMSResult; extra?: SendSMSResult } }> {
  const [patientResult, staffResult] = await Promise.all([
    sendTreatmentUpdatedToPatient(params),
    sendTreatmentUpdatedToStaff(params),
  ])

  return { patient: patientResult, staff: staffResult }
}

/**
 * Send appointment reminder via SMS
 * @deprecated Use sendGranularSMSReminders in cron job instead.
 * This is kept for backwards compatibility.
 */
export async function sendAppointmentReminderSMS(params: {
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
}): Promise<SendSMSResult> {
  const config = await getSMSConfig(params.clinicId)

  // Check if reminders are enabled using new granular settings
  const reminderType = params.hoursUntil <= 3 ? 'reminder_2h' : 'reminder_24h'
  if (!config?.enabled || !isEventEnabled(config, 'patient', reminderType)) {
    return { success: false, error: 'Reminders not enabled' }
  }

  const timeUntil =
    params.hoursUntil === 24
      ? 'mañana'
      : params.hoursUntil === 1
      ? 'en 1 hora'
      : `en ${params.hoursUntil} horas`

  const message = `Recordatorio: Tienes una cita ${timeUntil} en ${params.clinicName}.\n\nServicio: ${params.serviceName}\nFecha: ${formatDateForMessage(params.appointmentDate)}\nHora: ${formatTimeForMessage(params.appointmentTime)}\n\n¡Te esperamos!`

  return sendSMS({
    clinicId: params.clinicId,
    recipientPhone: params.patientPhone,
    recipientName: params.patientName,
    message,
    notificationType: reminderType,
    treatmentId: params.treatmentId,
    patientId: params.patientId,
  })
}

/**
 * Send booking received notification via SMS
 */
export async function sendBookingReceivedSMS(params: {
  clinicId: string
  clinicName: string
  patientName: string
  patientPhone: string
  publicBookingId: string
  serviceName: string
  requestedDate: string
  requestedTime: string
}): Promise<SendSMSResult> {
  const config = await getSMSConfig(params.clinicId)
  if (!config?.enabled) {
    return { success: false, error: 'SMS not enabled' }
  }

  const message = `Hola ${params.patientName}, hemos recibido tu solicitud de cita en ${params.clinicName}.\n\nServicio: ${params.serviceName}\nFecha solicitada: ${formatDateForMessage(params.requestedDate)}\nHora solicitada: ${formatTimeForMessage(params.requestedTime)}\n\nTe confirmaremos pronto.`

  return sendSMS({
    clinicId: params.clinicId,
    recipientPhone: params.patientPhone,
    recipientName: params.patientName,
    message,
    notificationType: 'booking_received',
    publicBookingId: params.publicBookingId,
  })
}

/**
 * Update notification status from webhook
 */
export async function updateSMSStatus(
  providerMessageId: string,
  status: string,
  timestamp?: string,
  errorMessage?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status: mapTwilioStatus(status),
    updated_at: new Date().toISOString(),
  }

  if (status === 'delivered' && timestamp) {
    updateData.delivered_at = timestamp
  }
  if (errorMessage) {
    updateData.error_message = errorMessage
  }

  const { error } = await supabaseAdmin
    .from('sms_notifications')
    .update(updateData)
    .eq('provider_message_id', providerMessageId)

  if (error) {
    console.error('[sms] Failed to update status:', error)
  }
}

/**
 * Format date for display in messages
 */
function formatDateForMessage(dateStr: string, locale: string = 'es-MX'): string {
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
function formatTimeForMessage(timeStr: string): string {
  if (!timeStr) return ''
  const [hours, minutes] = timeStr.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}
