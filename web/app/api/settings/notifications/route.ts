/**
 * API: Notification Settings
 *
 * GET/PUT clinic notification settings (confirmation and reminder emails)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';

export const dynamic = 'force-dynamic';

// WhatsApp settings schema
const whatsappSettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['twilio', 'dialog360']),
  twilio_account_sid: z.string().optional(),
  twilio_auth_token: z.string().optional(),
  twilio_phone_number: z.string().optional(),
  dialog360_api_key: z.string().optional(),
  default_country_code: z.string(),
  send_confirmations: z.boolean(),
  send_reminders: z.boolean(),
  reminder_hours_before: z.number().optional(),
}).optional();

// SMS patient settings schema - all fields optional for flexibility
const smsPatientSettingsSchema = z.object({
  on_treatment_created: z.boolean().optional(),
  on_treatment_updated: z.boolean().optional(),
  reminder_24h: z.boolean().optional(),
  reminder_2h: z.boolean().optional(),
}).optional();

// SMS staff settings schema - all fields optional for flexibility
const smsStaffSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  phone: z.string().optional(),
  extra_phone: z.string().optional(),
  on_treatment_created: z.boolean().optional(),
  on_treatment_updated: z.boolean().optional(),
  reminder_24h: z.boolean().optional(),
  reminder_2h: z.boolean().optional(),
}).optional();

// SMS settings schema - flexible to accept both old and new formats
const smsSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  default_country_code: z.string().optional(),
  // New format fields
  patient: smsPatientSettingsSchema,
  staff: smsStaffSettingsSchema,
  // Legacy format fields (for backwards compatibility)
  send_confirmations: z.boolean().optional(),
  send_reminders: z.boolean().optional(),
  reminder_hours_before: z.number().optional(),
}).optional();

const notificationSettingsSchema = z.object({
  email_enabled: z.boolean(),
  confirmation_enabled: z.boolean(),
  reminder_enabled: z.boolean(),
  reminder_hours_before: z.number().min(1).max(168), // 1 hour to 1 week
  sender_name: z.string().max(100).nullable(),
  reply_to_email: z.string().email().nullable().or(z.literal('')),
  whatsapp: whatsappSettingsSchema,
  sms: smsSettingsSchema,
});

type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

const DEFAULT_SETTINGS: NotificationSettings = {
  email_enabled: true,
  confirmation_enabled: true,
  reminder_enabled: true,
  reminder_hours_before: 24,
  sender_name: null,
  reply_to_email: null,
  whatsapp: undefined,
  sms: undefined,
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      );
    }

    const { clinicId } = clinicContext;

    const { data: clinic, error } = await supabaseAdmin
      .from('clinics')
      .select('notification_settings')
      .eq('id', clinicId)
      .single();

    if (error) {
      console.error('[settings/notifications][GET] Error fetching clinic:', error);
      return NextResponse.json(
        { error: 'Failed to load notification settings' },
        { status: 500 }
      );
    }

    const settings = clinic?.notification_settings as NotificationSettings | null;

    return NextResponse.json({
      data: {
        email_enabled: settings?.email_enabled ?? DEFAULT_SETTINGS.email_enabled,
        confirmation_enabled: settings?.confirmation_enabled ?? DEFAULT_SETTINGS.confirmation_enabled,
        reminder_enabled: settings?.reminder_enabled ?? DEFAULT_SETTINGS.reminder_enabled,
        reminder_hours_before: settings?.reminder_hours_before ?? DEFAULT_SETTINGS.reminder_hours_before,
        sender_name: settings?.sender_name ?? DEFAULT_SETTINGS.sender_name,
        reply_to_email: settings?.reply_to_email ?? DEFAULT_SETTINGS.reply_to_email,
        whatsapp: settings?.whatsapp ?? undefined,
        sms: settings?.sms ?? undefined,
      },
    });
  } catch (error) {
    console.error('[settings/notifications][GET] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      );
    }

    const { clinicId } = clinicContext;
    const body = await request.json();

    // Handle empty string for reply_to_email
    if (body.reply_to_email === '') {
      body.reply_to_email = null;
    }

    // Log incoming body for debugging
    console.log('[settings/notifications][PUT] Received body:', JSON.stringify(body, null, 2));

    const parseResult = notificationSettingsSchema.safeParse(body);

    if (!parseResult.success) {
      console.error('[settings/notifications][PUT] Validation failed:', parseResult.error.flatten());
      return NextResponse.json(
        {
          error: 'Invalid settings',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const settings = parseResult.data;
    console.log('[settings/notifications][PUT] Parsed settings:', JSON.stringify(settings, null, 2));

    const { error } = await supabaseAdmin
      .from('clinics')
      .update({
        notification_settings: settings,
      })
      .eq('id', clinicId);

    if (error) {
      console.error('[settings/notifications][PUT] Error updating clinic:', error);
      return NextResponse.json(
        { error: 'Failed to save notification settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[settings/notifications][PUT] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
