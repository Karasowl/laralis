/**
 * Email Service
 *
 * Handles sending emails using Resend API.
 * Supports appointment confirmations and reminders.
 */

import { Resend } from 'resend';

// Lazy initialize Resend client (only when API key is available)
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Types
export interface EmailRecipient {
  email: string;
  name: string;
}

export interface AppointmentEmailData {
  patientName: string;
  patientEmail: string;
  clinicName: string;
  clinicPhone?: string;
  clinicAddress?: string;
  serviceName: string;
  appointmentDate: string; // ISO date
  appointmentTime?: string; // HH:mm format
  duration?: number; // minutes
  notes?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Configuration
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@laralis.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Laralis';

/**
 * Format date for display
 */
function formatDate(dateStr: string, locale: string = 'es-MX'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time for display
 */
function formatTime(timeStr?: string): string {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Generate confirmation email HTML
 */
function generateConfirmationHtml(data: AppointmentEmailData): string {
  const formattedDate = formatDate(data.appointmentDate);
  const formattedTime = formatTime(data.appointmentTime);

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Cita</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Cita Confirmada</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #1f2937; font-size: 16px;">
                Hola <strong>${data.patientName}</strong>,
              </p>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px;">
                Tu cita ha sido confirmada exitosamente. Aquí están los detalles:
              </p>

              <!-- Appointment Card -->
              <table role="presentation" style="width: 100%; background-color: #f8fafc; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <span style="color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Servicio</span>
                          <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px; font-weight: 600;">${data.serviceName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <span style="color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Fecha</span>
                          <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px; font-weight: 600;">${formattedDate}</p>
                        </td>
                      </tr>
                      ${formattedTime ? `
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <span style="color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Hora</span>
                          <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px; font-weight: 600;">${formattedTime}</p>
                        </td>
                      </tr>
                      ` : ''}
                      ${data.duration ? `
                      <tr>
                        <td>
                          <span style="color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Duración estimada</span>
                          <p style="margin: 4px 0 0; color: #1f2937; font-size: 16px; font-weight: 600;">${data.duration} minutos</p>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Clinic Info -->
              <table role="presentation" style="width: 100%; border-top: 1px solid #e5e7eb; padding-top: 24px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px; color: #1f2937; font-size: 15px; font-weight: 600;">${data.clinicName}</p>
                    ${data.clinicAddress ? `<p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">📍 ${data.clinicAddress}</p>` : ''}
                    ${data.clinicPhone ? `<p style="margin: 0; color: #6b7280; font-size: 14px;">📞 ${data.clinicPhone}</p>` : ''}
                  </td>
                </tr>
              </table>

              ${data.notes ? `
              <table role="presentation" style="width: 100%; margin-top: 24px; background-color: #fef3c7; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;">
                      <strong>Nota:</strong> ${data.notes}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">
                Si necesitas cancelar o reprogramar tu cita, por favor contáctanos.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} ${data.clinicName}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate reminder email HTML
 */
function generateReminderHtml(data: AppointmentEmailData, hoursUntil: number): string {
  const formattedDate = formatDate(data.appointmentDate);
  const formattedTime = formatTime(data.appointmentTime);
  const timeLabel = hoursUntil === 24 ? 'mañana' : hoursUntil === 1 ? 'en una hora' : `en ${hoursUntil} horas`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recordatorio de Cita</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">⏰ Recordatorio de Cita</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #1f2937; font-size: 16px;">
                Hola <strong>${data.patientName}</strong>,
              </p>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px;">
                Te recordamos que tienes una cita programada <strong>${timeLabel}</strong>.
              </p>

              <!-- Appointment Card -->
              <table role="presentation" style="width: 100%; background-color: #fffbeb; border: 2px solid #fcd34d; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <span style="color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Servicio</span>
                          <p style="margin: 4px 0 0; color: #78350f; font-size: 16px; font-weight: 600;">${data.serviceName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <span style="color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Fecha</span>
                          <p style="margin: 4px 0 0; color: #78350f; font-size: 16px; font-weight: 600;">${formattedDate}</p>
                        </td>
                      </tr>
                      ${formattedTime ? `
                      <tr>
                        <td>
                          <span style="color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Hora</span>
                          <p style="margin: 4px 0 0; color: #78350f; font-size: 18px; font-weight: 700;">${formattedTime}</p>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Clinic Info -->
              <table role="presentation" style="width: 100%; border-top: 1px solid #e5e7eb; padding-top: 24px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px; color: #1f2937; font-size: 15px; font-weight: 600;">${data.clinicName}</p>
                    ${data.clinicAddress ? `<p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">📍 ${data.clinicAddress}</p>` : ''}
                    ${data.clinicPhone ? `<p style="margin: 0; color: #6b7280; font-size: 14px;">📞 ${data.clinicPhone}</p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">
                Si no puedes asistir, por favor avísanos con anticipación.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} ${data.clinicName}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send appointment confirmation email
 */
export async function sendConfirmationEmail(data: AppointmentEmailData): Promise<EmailResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const formattedDate = formatDate(data.appointmentDate);
    const formattedTime = formatTime(data.appointmentTime);

    const { data: result, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [data.patientEmail],
      subject: `Cita Confirmada - ${data.serviceName} el ${formattedDate}${formattedTime ? ` a las ${formattedTime}` : ''}`,
      html: generateConfirmationHtml(data),
    });

    if (error) {
      console.error('[email] Failed to send confirmation:', error);
      return { success: false, error: error.message };
    }

    console.log('[email] Confirmation sent:', result?.id);
    return { success: true, messageId: result?.id };
  } catch (error) {
    console.error('[email] Unexpected error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send appointment reminder email
 */
export async function sendReminderEmail(data: AppointmentEmailData, hoursUntil: number = 24): Promise<EmailResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const formattedDate = formatDate(data.appointmentDate);
    const formattedTime = formatTime(data.appointmentTime);
    const timeLabel = hoursUntil === 24 ? 'mañana' : hoursUntil === 1 ? 'en 1 hora' : `en ${hoursUntil} horas`;

    const { data: result, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [data.patientEmail],
      subject: `⏰ Recordatorio: Tu cita es ${timeLabel} - ${data.serviceName}${formattedTime ? ` a las ${formattedTime}` : ''}`,
      html: generateReminderHtml(data, hoursUntil),
    });

    if (error) {
      console.error('[email] Failed to send reminder:', error);
      return { success: false, error: error.message };
    }

    console.log('[email] Reminder sent:', result?.id);
    return { success: true, messageId: result?.id };
  } catch (error) {
    console.error('[email] Unexpected error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Booking confirmation email data (for public bookings)
 */
export interface BookingConfirmationData {
  clinicId: string;
  clinicName: string;
  patientName: string;
  patientEmail: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  bookingId: string;
}

/**
 * Generate public booking confirmation HTML
 */
function generateBookingConfirmationHtml(data: BookingConfirmationData): string {
  const formattedDate = formatDate(data.appointmentDate);
  const formattedTime = formatTime(data.appointmentTime);

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solicitud de Cita Recibida</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Solicitud Recibida</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #1f2937; font-size: 16px;">
                Hola <strong>${data.patientName}</strong>,
              </p>

              <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px;">
                Hemos recibido tu solicitud de cita. Te confirmaremos a la brevedad.
              </p>

              <!-- Appointment Card -->
              <table role="presentation" style="width: 100%; background-color: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <span style="color: #166534; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Servicio solicitado</span>
                          <p style="margin: 4px 0 0; color: #14532d; font-size: 16px; font-weight: 600;">${data.serviceName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <span style="color: #166534; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Fecha solicitada</span>
                          <p style="margin: 4px 0 0; color: #14532d; font-size: 16px; font-weight: 600;">${formattedDate}</p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <span style="color: #166534; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Hora solicitada</span>
                          <p style="margin: 4px 0 0; color: #14532d; font-size: 18px; font-weight: 700;">${formattedTime}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Status Note -->
              <table role="presentation" style="width: 100%; background-color: #fef3c7; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;">
                      <strong>Estado:</strong> Pendiente de confirmación<br>
                      <span style="font-size: 13px;">Recibirás otro correo cuando tu cita sea confirmada.</span>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Clinic Info -->
              <table role="presentation" style="width: 100%; border-top: 1px solid #e5e7eb; padding-top: 24px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px; color: #1f2937; font-size: 15px; font-weight: 600;">${data.clinicName}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">
                Si tienes alguna pregunta, no dudes en contactarnos.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Ref: ${data.bookingId.slice(0, 8).toUpperCase()}<br>
                © ${new Date().getFullYear()} ${data.clinicName}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send booking confirmation email (for public booking requests)
 */
export async function sendBookingConfirmation(data: BookingConfirmationData): Promise<EmailResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const formattedDate = formatDate(data.appointmentDate);
    const formattedTime = formatTime(data.appointmentTime);

    const { data: result, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [data.patientEmail],
      subject: `Solicitud de Cita Recibida - ${data.serviceName} el ${formattedDate} a las ${formattedTime}`,
      html: generateBookingConfirmationHtml(data),
    });

    if (error) {
      console.error('[email] Failed to send booking confirmation:', error);
      return { success: false, error: error.message };
    }

    console.log('[email] Booking confirmation sent:', result?.id);
    return { success: true, messageId: result?.id };
  } catch (error) {
    console.error('[email] Unexpected error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Check if email notifications are enabled for a clinic
 */
export function isEmailEnabled(notificationSettings: Record<string, unknown> | null): boolean {
  if (!notificationSettings) return false;
  return notificationSettings.email_enabled === true;
}

/**
 * Check if confirmation emails are enabled
 */
export function isConfirmationEnabled(notificationSettings: Record<string, unknown> | null): boolean {
  if (!isEmailEnabled(notificationSettings)) return false;
  return notificationSettings?.confirmation_enabled !== false; // Default true
}

/**
 * Check if reminder emails are enabled
 */
export function isReminderEnabled(notificationSettings: Record<string, unknown> | null): boolean {
  if (!isEmailEnabled(notificationSettings)) return false;
  return notificationSettings?.reminder_enabled !== false; // Default true
}
