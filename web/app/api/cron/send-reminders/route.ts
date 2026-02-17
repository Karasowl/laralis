/**
 * Cron Job: Send Appointment Reminders
 *
 * This endpoint should be called periodically (e.g., every 15 minutes)
 * to process and send pending appointment reminders.
 *
 * Supports granular SMS notifications:
 * - 24 hours before (reminder_24h)
 * - 2 hours before (reminder_2h)
 * - To both patients and staff
 *
 * Vercel Cron configuration added to vercel.json
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendReminderEmail, AppointmentEmailData } from '@/lib/email/service';
import {
  getSMSConfigFromSettings,
  isEventEnabled,
  sendSMS,
  formatPhoneNumber,
} from '@/lib/sms/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max execution time

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // If no secret is configured, allow in development
  if (!cronSecret) {
    return process.env.NODE_ENV === 'development';
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // Get pending reminders that are due (scheduled_for <= now)
    const { data: pendingReminders, error: fetchError } = await supabaseAdmin
      .from('scheduled_reminders')
      .select(`
        id,
        clinic_id,
        treatment_id,
        patient_id,
        scheduled_for,
        reminder_type,
        treatments!inner (
          id,
          treatment_date,
          treatment_time,
          service_id,
          services!inner (
            name,
            est_minutes
          )
        ),
        patients!inner (
          first_name,
          last_name,
          email,
          phone
        ),
        clinics!inner (
          name,
          phone,
          address,
          notification_settings
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50); // Process up to 50 reminders per invocation

    if (fetchError) {
      console.error('[cron/send-reminders] Failed to fetch reminders:', fetchError);
      return NextResponse.json({
        error: 'Failed to fetch pending reminders',
        message: fetchError.message,
      }, { status: 500 });
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      return NextResponse.json({
        message: 'No pending reminders',
        ...results,
        duration: Date.now() - startTime,
      });
    }

    console.info(`[cron/send-reminders] Processing ${pendingReminders.length} reminders`);

    // Process each reminder
    for (const reminder of pendingReminders) {
      results.processed++;

      try {
        // Type assertions for nested data
        const treatment = reminder.treatments as unknown as {
          id: string;
          treatment_date: string;
          treatment_time: string | null;
          services: { name: string; est_minutes: number };
        };
        const patient = reminder.patients as unknown as {
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
        };
        const clinic = reminder.clinics as unknown as {
          name: string;
          phone: string | null;
          address: string | null;
          notification_settings: Record<string, unknown> | null;
        };

        // Skip if patient has no email
        if (!patient.email) {
          console.info(`[cron/send-reminders] Skipping reminder ${reminder.id}: No patient email`);
          await markReminderStatus(reminder.id, 'cancelled', 'No patient email');
          results.skipped++;
          continue;
        }

        // Skip if notifications are disabled
        const settings = clinic.notification_settings;
        if (!settings?.email_enabled || !settings?.reminder_enabled) {
          console.info(`[cron/send-reminders] Skipping reminder ${reminder.id}: Notifications disabled`);
          await markReminderStatus(reminder.id, 'cancelled', 'Notifications disabled');
          results.skipped++;
          continue;
        }

        // Calculate hours until appointment
        const appointmentDateTime = new Date(
          `${treatment.treatment_date}T${treatment.treatment_time || '12:00:00'}`
        );
        const hoursUntil = Math.round(
          (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60)
        );

        // Skip if appointment has passed
        if (hoursUntil < 0) {
          console.info(`[cron/send-reminders] Skipping reminder ${reminder.id}: Appointment passed`);
          await markReminderStatus(reminder.id, 'cancelled', 'Appointment already passed');
          results.skipped++;
          continue;
        }

        // Prepare email data
        const emailData: AppointmentEmailData = {
          patientName: `${patient.first_name} ${patient.last_name}`,
          patientEmail: patient.email,
          clinicName: clinic.name,
          clinicPhone: clinic.phone || undefined,
          clinicAddress: clinic.address || undefined,
          serviceName: treatment.services.name,
          appointmentDate: treatment.treatment_date,
          appointmentTime: treatment.treatment_time || undefined,
          duration: treatment.services.est_minutes,
        };

        // Send reminder email
        const emailResult = await sendReminderEmail(emailData, Math.max(1, hoursUntil));

        if (emailResult.success) {
          // Log successful notification
          await logNotification({
            clinicId: reminder.clinic_id,
            treatmentId: reminder.treatment_id,
            patientId: reminder.patient_id,
            type: 'reminder',
            recipientEmail: patient.email,
            recipientName: `${patient.first_name} ${patient.last_name}`,
            subject: 'Recordatorio de cita',
            status: 'sent',
            providerId: emailResult.messageId,
          });

          // Send granular SMS reminders based on settings
          await sendGranularSMSReminders({
            clinicId: reminder.clinic_id,
            clinicName: clinic.name,
            clinicSettings: settings,
            patient: {
              id: reminder.patient_id,
              name: `${patient.first_name} ${patient.last_name}`,
              phone: patient.phone,
            },
            treatment: {
              id: reminder.treatment_id,
              serviceName: treatment.services.name,
              date: treatment.treatment_date,
              time: treatment.treatment_time || '12:00:00',
            },
            reminderType: reminder.reminder_type as 'reminder_24h' | 'reminder_2h',
            reminderId: reminder.id,
          });

          // Mark reminder as sent
          await markReminderStatus(reminder.id, 'sent', null, emailResult.messageId);
          results.sent++;
        } else {
          // Log failed notification
          await logNotification({
            clinicId: reminder.clinic_id,
            treatmentId: reminder.treatment_id,
            patientId: reminder.patient_id,
            type: 'reminder',
            recipientEmail: patient.email,
            recipientName: `${patient.first_name} ${patient.last_name}`,
            subject: 'Recordatorio de cita',
            status: 'failed',
            errorMessage: emailResult.error,
          });

          // Mark reminder as failed
          await markReminderStatus(reminder.id, 'failed', emailResult.error);
          results.failed++;
          results.errors.push(`Reminder ${reminder.id}: ${emailResult.error}`);
        }
      } catch (reminderError) {
        console.error(`[cron/send-reminders] Error processing reminder ${reminder.id}:`, reminderError);
        await markReminderStatus(
          reminder.id,
          'failed',
          reminderError instanceof Error ? reminderError.message : 'Unknown error'
        );
        results.failed++;
        results.errors.push(
          `Reminder ${reminder.id}: ${reminderError instanceof Error ? reminderError.message : 'Unknown error'}`
        );
      }
    }

    const duration = Date.now() - startTime;
    console.info(`[cron/send-reminders] Completed in ${duration}ms:`, results);

    return NextResponse.json({
      message: 'Reminder processing complete',
      ...results,
      duration,
    });
  } catch (error) {
    console.error('[cron/send-reminders] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      ...results,
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}

/**
 * Update reminder status
 */
async function markReminderStatus(
  reminderId: string,
  status: 'sent' | 'cancelled' | 'failed',
  errorMessage?: string | null,
  notificationId?: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('scheduled_reminders')
    .update({
      status,
      processed_at: new Date().toISOString(),
      email_notification_id: notificationId || null,
    })
    .eq('id', reminderId);

  if (error) {
    console.error(`[cron/send-reminders] Failed to update reminder ${reminderId}:`, error);
  }
}

/**
 * Log email notification
 */
async function logNotification(params: {
  clinicId: string;
  treatmentId: string;
  patientId: string;
  type: 'confirmation' | 'reminder';
  recipientEmail: string;
  recipientName: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed';
  providerId?: string;
  errorMessage?: string;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('email_notifications')
    .insert({
      clinic_id: params.clinicId,
      treatment_id: params.treatmentId,
      patient_id: params.patientId,
      notification_type: params.type,
      recipient_email: params.recipientEmail,
      recipient_name: params.recipientName,
      subject: params.subject,
      status: params.status,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
      provider_message_id: params.providerId || null,
      error_message: params.errorMessage || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[cron/send-reminders] Failed to log notification:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Send granular SMS reminders based on clinic settings
 * Supports both patient and staff notifications with individual toggles
 */
async function sendGranularSMSReminders(params: {
  clinicId: string;
  clinicName: string;
  clinicSettings: Record<string, unknown> | null;
  patient: {
    id: string;
    name: string;
    phone: string | null;
  };
  treatment: {
    id: string;
    serviceName: string;
    date: string;
    time: string;
  };
  reminderType: 'reminder_24h' | 'reminder_2h';
  reminderId: string;
}): Promise<void> {
  const { clinicId, clinicName, clinicSettings, patient, treatment, reminderType, reminderId } = params;

  // Get SMS config with defaults (synchronous since we already have settings)
  const smsConfig = getSMSConfigFromSettings(clinicSettings);

  // If SMS is globally disabled, skip entirely
  if (!smsConfig.enabled) {
    return;
  }

  const countryCode = smsConfig.default_country_code || '52';
  const formattedDate = formatAppointmentDate(treatment.date);
  const formattedTime = formatAppointmentTime(treatment.time);

  // Send to patient if enabled
  if (isEventEnabled(smsConfig, 'patient', reminderType) && patient.phone) {
    try {
      const patientPhone = formatPhoneNumber(patient.phone, countryCode);
      const patientMessage = buildPatientReminderMessage({
        patientName: patient.name.split(' ')[0], // First name only
        clinicName,
        serviceName: treatment.serviceName,
        date: formattedDate,
        time: formattedTime,
        reminderType,
      });

      const result = await sendSMS({
        clinicId,
        recipientPhone: patientPhone,
        recipientName: patient.name,
        message: patientMessage,
        notificationType: reminderType,
        treatmentId: treatment.id,
        patientId: patient.id,
      });

      if (result.success) {
        console.info(`[cron/send-reminders] Patient SMS ${reminderType} sent for reminder ${reminderId}`);
      } else {
        console.error(`[cron/send-reminders] Patient SMS failed for reminder ${reminderId}:`, result.error);
      }
    } catch (smsError) {
      console.error(`[cron/send-reminders] Patient SMS error for reminder ${reminderId}:`, smsError);
    }
  }

  // Send to staff if enabled
  if (smsConfig.staff.enabled && isEventEnabled(smsConfig, 'staff', reminderType)) {
    const staffMessage = buildStaffReminderMessage({
      patientName: patient.name,
      patientPhone: patient.phone,
      clinicName,
      serviceName: treatment.serviceName,
      date: formattedDate,
      time: formattedTime,
      reminderType,
    });

    // Determine staff notification type
    const staffNotificationType = reminderType === 'reminder_24h'
      ? 'staff_reminder_24h' as const
      : 'staff_reminder_2h' as const;

    // Send to primary staff phone
    if (smsConfig.staff.phone) {
      try {
        const staffPhone = formatPhoneNumber(smsConfig.staff.phone, countryCode);
        const result = await sendSMS({
          clinicId,
          recipientPhone: staffPhone,
          recipientName: 'Staff',
          message: staffMessage,
          notificationType: staffNotificationType,
          treatmentId: treatment.id,
        });

        if (result.success) {
          console.info(`[cron/send-reminders] Staff SMS ${reminderType} sent for reminder ${reminderId}`);
        } else {
          console.error(`[cron/send-reminders] Staff SMS failed for reminder ${reminderId}:`, result.error);
        }
      } catch (smsError) {
        console.error(`[cron/send-reminders] Staff SMS error for reminder ${reminderId}:`, smsError);
      }
    }

    // Send to extra staff phone if configured
    if (smsConfig.staff.extra_phone) {
      try {
        const extraPhone = formatPhoneNumber(smsConfig.staff.extra_phone, countryCode);
        const result = await sendSMS({
          clinicId,
          recipientPhone: extraPhone,
          recipientName: 'Staff (Extra)',
          message: staffMessage,
          notificationType: staffNotificationType,
          treatmentId: treatment.id,
        });

        if (result.success) {
          console.info(`[cron/send-reminders] Staff extra SMS ${reminderType} sent for reminder ${reminderId}`);
        } else {
          console.error(`[cron/send-reminders] Staff extra SMS failed for reminder ${reminderId}:`, result.error);
        }
      } catch (smsError) {
        console.error(`[cron/send-reminders] Staff extra SMS error for reminder ${reminderId}:`, smsError);
      }
    }
  }
}

/**
 * Build patient reminder message (short, friendly)
 */
function buildPatientReminderMessage(params: {
  patientName: string;
  clinicName: string;
  serviceName: string;
  date: string;
  time: string;
  reminderType: 'reminder_24h' | 'reminder_2h';
}): string {
  const timeframe = params.reminderType === 'reminder_24h' ? 'mañana' : 'en 2 horas';
  return `Hola ${params.patientName}, te recordamos tu cita ${timeframe} en ${params.clinicName}. ` +
    `Servicio: ${params.serviceName}. Fecha: ${params.date} a las ${params.time}. ¡Te esperamos!`;
}

/**
 * Build staff reminder message (detailed with patient info)
 */
function buildStaffReminderMessage(params: {
  patientName: string;
  patientPhone: string | null;
  clinicName: string;
  serviceName: string;
  date: string;
  time: string;
  reminderType: 'reminder_24h' | 'reminder_2h';
}): string {
  const timeframe = params.reminderType === 'reminder_24h' ? 'mañana' : 'en 2 horas';
  const phoneInfo = params.patientPhone ? ` Tel: ${params.patientPhone}` : '';
  return `[${params.clinicName}] Recordatorio ${timeframe}: ` +
    `Paciente: ${params.patientName}.${phoneInfo} ` +
    `Servicio: ${params.serviceName}. Fecha: ${params.date} a las ${params.time}.`;
}

/**
 * Format date for SMS (Spanish format)
 */
function formatAppointmentDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Format time for SMS (12h format)
 */
function formatAppointmentTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}
