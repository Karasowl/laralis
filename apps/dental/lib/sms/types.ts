/**
 * SMS Notification Types
 *
 * Type definitions for SMS notifications via Twilio
 */

export type SMSProvider = 'twilio'

export type NotificationType =
  | 'appointment_confirmation'
  | 'appointment_reminder'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'booking_received'
  | 'booking_confirmed'
  | 'on_treatment_created'
  | 'on_treatment_updated'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'staff_on_treatment_created'
  | 'staff_on_treatment_updated'
  | 'staff_reminder_24h'
  | 'staff_reminder_2h'
  | 'custom'

export type MessageStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'undelivered'

/**
 * Patient notification settings
 * Controls what notifications patients receive
 */
export interface SMSPatientSettings {
  on_treatment_created: boolean    // When treatment is scheduled
  on_treatment_updated: boolean    // When treatment date/time/service changes
  reminder_24h: boolean            // 24 hours before appointment
  reminder_2h: boolean             // 2 hours before appointment
}

/**
 * Staff notification settings
 * Controls what notifications clinic staff receives
 */
export interface SMSStaffSettings {
  enabled: boolean                 // Master switch for staff notifications
  phone: string                    // Primary staff phone number
  extra_phone: string              // Additional phone number (optional)
  on_treatment_created: boolean    // When treatment is scheduled
  on_treatment_updated: boolean    // When treatment changes
  reminder_24h: boolean            // 24h reminder with patient details
  reminder_2h: boolean             // 2h reminder with patient details
}

/**
 * Complete SMS configuration for a clinic
 */
export interface SMSConfig {
  enabled: boolean                 // Master switch for SMS
  default_country_code: string     // Default country code (e.g., "52" for Mexico)
  provider?: SMSProvider           // SMS provider (default: twilio)
  twilio_account_sid?: string      // Optional per-clinic Twilio SID
  twilio_auth_token?: string       // Optional per-clinic Twilio auth token
  twilio_phone_number?: string     // Optional per-clinic Twilio phone number
  patient: SMSPatientSettings      // Patient notification settings
  staff: SMSStaffSettings          // Staff notification settings
}

/**
 * Default SMS configuration
 */
export const DEFAULT_SMS_CONFIG: SMSConfig = {
  enabled: false,
  default_country_code: '52',
  provider: 'twilio',
  twilio_account_sid: '',
  twilio_auth_token: '',
  twilio_phone_number: '',
  patient: {
    on_treatment_created: true,
    on_treatment_updated: true,
    reminder_24h: true,
    reminder_2h: false,
  },
  staff: {
    enabled: false,
    phone: '',
    extra_phone: '',
    on_treatment_created: true,
    on_treatment_updated: true,
    reminder_24h: true,
    reminder_2h: false,
  },
}

/**
 * Legacy SMS config (for backwards compatibility)
 * @deprecated Use SMSConfig instead
 */
export interface LegacySMSConfig {
  enabled: boolean
  twilio_account_sid?: string
  twilio_auth_token?: string
  twilio_phone_number?: string
  default_country_code: string
  send_confirmations: boolean
  send_reminders: boolean
  reminder_hours_before: number
}

export interface SendSMSParams {
  clinicId: string
  recipientPhone: string
  recipientName: string
  message: string
  notificationType: NotificationType
  treatmentId?: string
  patientId?: string
  publicBookingId?: string
}

export interface SendSMSResult {
  success: boolean
  messageId?: string
  status?: MessageStatus
  error?: string
  costCents?: number
}

export interface SMSNotification {
  id: string
  clinic_id: string
  treatment_id?: string
  patient_id?: string
  public_booking_id?: string
  notification_type: NotificationType
  recipient_phone: string
  recipient_name?: string
  message_content: string
  status: MessageStatus
  sent_at?: string
  delivered_at?: string
  error_message?: string
  provider: SMSProvider
  provider_message_id?: string
  cost_cents: number
  created_at: string
  updated_at: string
}
