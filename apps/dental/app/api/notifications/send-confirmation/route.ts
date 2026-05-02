/**
 * API: Send Appointment Confirmation Email
 *
 * Called after creating a new treatment/appointment to send
 * a confirmation email to the patient.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import {
  sendConfirmationEmail,
  AppointmentEmailData,
  isConfirmationEnabled,
} from '@/lib/email/service';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

interface SendConfirmationRequest {
  treatmentId: string;
}

const sendConfirmationSchema = z.object({
  treatmentId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      );
    }

    const { clinicId } = clinicContext;
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const parsed = validateSchema(sendConfirmationSchema, bodyResult.data);
    if ('error' in parsed) {
      return parsed.error;
    }
    const body: SendConfirmationRequest = parsed.data;

    // Get treatment with related data
    const { data: treatment, error: treatmentError } = await supabaseAdmin
      .from('treatments')
      .select(`
        id,
        treatment_date,
        treatment_time,
        notes,
        clinic_id,
        services!inner (
          name,
          est_minutes
        ),
        patients!inner (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', body.treatmentId)
      .eq('clinic_id', clinicId)
      .single();

    if (treatmentError || !treatment) {
      return NextResponse.json(
        { error: 'Treatment not found' },
        { status: 404 }
      );
    }

    // Get clinic info
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select('name, phone, address, notification_settings')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    // Check if confirmations are enabled
    if (!isConfirmationEnabled(clinic.notification_settings)) {
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'Confirmation emails are disabled for this clinic',
      });
    }

    // Type assertions
    const service = treatment.services as unknown as { name: string; est_minutes: number };
    const patient = treatment.patients as unknown as {
      id: string;
      first_name: string;
      last_name: string;
      email: string | null;
    };

    // Check if patient has email
    if (!patient.email) {
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'Patient has no email address',
      });
    }

    // Prepare email data
    const emailData: AppointmentEmailData = {
      patientName: `${patient.first_name} ${patient.last_name}`,
      patientEmail: patient.email,
      clinicName: clinic.name,
      clinicPhone: clinic.phone || undefined,
      clinicAddress: clinic.address || undefined,
      serviceName: service.name,
      appointmentDate: treatment.treatment_date,
      appointmentTime: treatment.treatment_time || undefined,
      duration: service.est_minutes,
      notes: treatment.notes || undefined,
    };

    // Send confirmation email
    const result = await sendConfirmationEmail(emailData);

    // Log notification
    await supabaseAdmin.from('email_notifications').insert({
      clinic_id: clinicId,
      treatment_id: body.treatmentId,
      patient_id: patient.id,
      notification_type: 'confirmation',
      recipient_email: patient.email,
      recipient_name: `${patient.first_name} ${patient.last_name}`,
      subject: `Cita Confirmada - ${service.name}`,
      status: result.success ? 'sent' : 'failed',
      sent_at: result.success ? new Date().toISOString() : null,
      provider_message_id: result.messageId || null,
      error_message: result.error || null,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[notifications/send-confirmation] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
