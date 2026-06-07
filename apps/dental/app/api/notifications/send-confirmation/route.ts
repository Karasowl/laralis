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
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import {
  buildEmailRetryMetadata,
  isRetryableNotificationError,
  queueNotificationRetry,
} from '@/lib/notifications/retry-queue';
import {
  shouldReturnConvexData,
  shouldUseConvexOnlyWritePath,
} from '@/lib/data-backend';
import {
  getConvexDocumentByLegacyId,
  upsertConvexDocumentByLegacyId,
  decodeConvexValue,
} from '@/lib/convex/server';

export const dynamic = 'force-dynamic';

interface SendConfirmationRequest {
  treatmentId: string;
}

const sendConfirmationSchema = z.object({
  treatmentId: z.string().uuid(),
});

type ConvexImportedRecord = Record<string, any>;

/** Strip Convex bookkeeping fields so a doc matches the Supabase row shape. */
function stripConvexMetadata(row: ConvexImportedRecord): ConvexImportedRecord {
  const {
    _id,
    _creationTime,
    legacyId,
    legacyTable,
    convex_created_at,
    convex_updated_at,
    convex_snapshot_source,
    ...rest
  } = row;
  return rest;
}

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

    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'treatments.create');
    if (forbidden) return forbidden;

    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const parsed = validateSchema(sendConfirmationSchema, bodyResult.data);
    if ('error' in parsed) {
      return parsed.error;
    }
    const body: SendConfirmationRequest = parsed.data;

    // Shared shapes the email/log logic below consumes, populated by either backend.
    let treatment: {
      id: string;
      treatment_date: string;
      treatment_time: string | null;
      notes: string | null;
    };
    let service: { name: string; est_minutes: number };
    let patient: {
      id: string;
      first_name: string;
      last_name: string;
      email: string | null;
    };
    let clinic: {
      name: string;
      phone: string | null;
      address: string | null;
      notification_settings: Record<string, unknown> | null;
    };

    // Convex read branch (flag-gated, default Supabase). The Supabase query is a deep
    // join treatments -> services!inner / patients!inner; Convex has no nested select,
    // so read each doc by FK id and FK-reassemble, replicating the !inner semantics
    // (a missing treatment / service / patient is a 404, never a partial row).
    if (shouldReturnConvexData('email_notifications')) {
      const treatmentDoc = (await getConvexDocumentByLegacyId(
        'treatments',
        body.treatmentId
      )) as ConvexImportedRecord | null;
      // Scope to the resolved clinic (mirror .eq('clinic_id', clinicId)).
      if (!treatmentDoc || String(treatmentDoc.clinic_id) !== String(clinicId)) {
        return NextResponse.json({ error: 'Treatment not found' }, { status: 404 });
      }
      const t = stripConvexMetadata(treatmentDoc);

      const serviceDoc = t.service_id
        ? ((await getConvexDocumentByLegacyId('services', String(t.service_id))) as ConvexImportedRecord | null)
        : null;
      const patientDoc = t.patient_id
        ? ((await getConvexDocumentByLegacyId('patients', String(t.patient_id))) as ConvexImportedRecord | null)
        : null;
      // services!inner / patients!inner: missing FK target drops the row -> 404.
      if (!serviceDoc || !patientDoc) {
        return NextResponse.json({ error: 'Treatment not found' }, { status: 404 });
      }
      const s = stripConvexMetadata(serviceDoc);
      const p = stripConvexMetadata(patientDoc);

      const clinicDoc = (await getConvexDocumentByLegacyId(
        'clinics',
        clinicId
      )) as ConvexImportedRecord | null;
      if (!clinicDoc) {
        return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
      }
      const c = stripConvexMetadata(clinicDoc);

      treatment = {
        id: String(t.id ?? body.treatmentId),
        treatment_date: t.treatment_date,
        treatment_time: t.treatment_time ?? null,
        notes: t.notes ?? null,
      };
      service = { name: s.name, est_minutes: s.est_minutes };
      patient = {
        id: String(p.id ?? t.patient_id),
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email ?? null,
      };
      clinic = {
        name: c.name,
        phone: c.phone ?? null,
        address: c.address ?? null,
        // notification_settings is JSONB; decode nested keys to match Supabase.
        notification_settings: decodeConvexValue(c.notification_settings) as
          | Record<string, unknown>
          | null,
      };
    } else {
      // Get treatment with related data
      const { data: treatmentRow, error: treatmentError } = await supabaseAdmin
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

      if (treatmentError || !treatmentRow) {
        return NextResponse.json(
          { error: 'Treatment not found' },
          { status: 404 }
        );
      }

      // Get clinic info
      const { data: clinicRow, error: clinicError } = await supabaseAdmin
        .from('clinics')
        .select('name, phone, address, notification_settings')
        .eq('id', clinicId)
        .single();

      if (clinicError || !clinicRow) {
        return NextResponse.json(
          { error: 'Clinic not found' },
          { status: 404 }
        );
      }

      treatment = {
        id: treatmentRow.id,
        treatment_date: treatmentRow.treatment_date,
        treatment_time: treatmentRow.treatment_time,
        notes: treatmentRow.notes,
      };
      service = treatmentRow.services as unknown as { name: string; est_minutes: number };
      patient = treatmentRow.patients as unknown as {
        id: string;
        first_name: string;
        last_name: string;
        email: string | null;
      };
      clinic = clinicRow as unknown as {
        name: string;
        phone: string | null;
        address: string | null;
        notification_settings: Record<string, unknown> | null;
      };
    }

    // Check if confirmations are enabled
    if (!isConfirmationEnabled(clinic.notification_settings)) {
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'Confirmation emails are disabled for this clinic',
      });
    }

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

    const retryMetadata = buildEmailRetryMetadata({
      kind: 'confirmation',
      emailData,
    }, {
      source: 'send_confirmation_api',
    });

    // Log notification.
    // Convex-only write path mirrors the Supabase email_notifications insert. id and
    // created_at/updated_at have Postgres defaults (gen_random_uuid()/now()) that Convex
    // does not provide, so stamp them explicitly. metadata is JSONB and is encoded by
    // prepareConvexRow inside upsertConvexDocumentByLegacyId.
    if (shouldUseConvexOnlyWritePath('email_notifications')) {
      const now = new Date().toISOString();
      const notificationId = crypto.randomUUID();
      try {
        await upsertConvexDocumentByLegacyId('email_notifications', notificationId, {
          id: notificationId,
          clinic_id: clinicId,
          treatment_id: body.treatmentId,
          patient_id: patient.id,
          notification_type: 'confirmation',
          recipient_email: patient.email,
          recipient_name: `${patient.first_name} ${patient.last_name}`,
          subject: `Cita Confirmada - ${service.name}`,
          status: result.success ? 'sent' : 'failed',
          sent_at: result.success ? now : null,
          provider_message_id: result.messageId || null,
          error_message: result.error || null,
          metadata: retryMetadata,
          created_at: now,
          updated_at: now,
        });
      } catch (convexError) {
        console.error('[notifications/send-confirmation] Failed to log notification (convex):', convexError);
      }
      // queueNotificationRetry writes notification_retry_queue via supabaseAdmin only
      // (the shared retry-queue lib has no Convex write path), so skip the retry enqueue
      // on the convex-only path. The enqueue is a best-effort side-effect.
    } else {
      const { data: notificationLog, error: notificationLogError } = await supabaseAdmin.from('email_notifications').insert({
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
        metadata: retryMetadata,
      })
        .select('id')
        .single();

      if (notificationLogError) {
        console.error('[notifications/send-confirmation] Failed to log notification:', notificationLogError);
      }

      if (
        notificationLog?.id &&
        !result.success &&
        isRetryableNotificationError(result.error)
      ) {
        await queueNotificationRetry({
          clinicId,
          channel: 'email',
          notificationId: notificationLog.id,
          provider: 'resend',
          providerMessageId: result.messageId || null,
          reason: 'email_provider_failure',
          errorMessage: result.error || null,
          metadata: retryMetadata,
        });
      }
    }

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
