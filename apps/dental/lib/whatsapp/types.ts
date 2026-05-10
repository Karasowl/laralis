/**
 * WhatsApp Notification Types
 */

export type WhatsAppProvider = 'twilio' | '360dialog'

export type NotificationType =
  | 'appointment_confirmation'
  | 'appointment_reminder'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'booking_received'
  | 'booking_confirmed'
  | 'custom'

export type MessageStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'undelivered'

export interface WhatsAppConfig {
  enabled: boolean
  provider: WhatsAppProvider
  // Twilio config
  twilio_account_sid?: string
  twilio_auth_token?: string
  twilio_phone_number?: string
  // 360dialog config
  dialog360_api_key?: string
  dialog360_phone_number_id?: string
  // General settings
  default_country_code: string
  send_confirmations: boolean
  send_reminders: boolean
  reminder_hours_before: number
}

export interface WhatsAppTemplate {
  id: string
  clinic_id: string
  name: string
  template_type: NotificationType
  content: string
  language: string
  provider_template_id?: string
  provider: WhatsAppProvider
  is_active: boolean
}

export interface SendMessageParams {
  clinicId: string
  recipientPhone: string
  recipientName: string
  templateType: NotificationType
  variables: Record<string, string>
  treatmentId?: string
  patientId?: string
  publicBookingId?: string
  language?: string
}

export interface SendMessageResult {
  success: boolean
  messageId?: string
  status?: MessageStatus
  error?: string
  costCents?: number
}

export interface WhatsAppNotification {
  id: string
  clinic_id: string
  treatment_id?: string
  patient_id?: string
  public_booking_id?: string
  notification_type: NotificationType
  recipient_phone: string
  recipient_name?: string
  message_content: string
  template_id?: string
  status: MessageStatus
  sent_at?: string
  delivered_at?: string
  read_at?: string
  error_message?: string
  provider: WhatsAppProvider
  provider_message_id?: string
  cost_cents: number
  created_at: string
}

// Template variable placeholders
export const TEMPLATE_VARIABLES = {
  patient_name: '{{patient_name}}',
  clinic_name: '{{clinic_name}}',
  date: '{{date}}',
  time: '{{time}}',
  service_name: '{{service_name}}',
  time_until: '{{time_until}}',
  doctor_name: '{{doctor_name}}',
  price: '{{price}}',
} as const

export type TemplateVariable = keyof typeof TEMPLATE_VARIABLES
