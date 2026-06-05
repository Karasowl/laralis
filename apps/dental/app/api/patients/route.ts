import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { z } from 'zod';
import { withRouteContext } from '@/lib/api/route-handler';
import { createRouteLogger } from '@/lib/api/logger';
import { readJsonBody } from '@/lib/api/validation';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { listConvexDocumentsByClinic, listConvexTable, upsertConvexDocumentByLegacyId } from '@/lib/convex/server';
import { shouldCompareConvexData, shouldReturnConvexData, shouldUseConvexOnlyWritePath, shouldWriteConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'


const patientSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  phone: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  first_visit_date: z.string().optional().nullable(),
  gender: z.union([z.enum(['male', 'female', 'other']), z.literal(''), z.null()]).optional(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  source_id: z.string().optional().nullable(),
  referred_by_patient_id: z.string().optional().nullable(),
  campaign_id: z.string().optional().nullable(),
  acquisition_date: z.string().optional().nullable(),
});

type PatientRequestBody = {
  clinic_id?: string
  first_name?: string
  last_name?: string
  email?: string | null
  phone?: string | null
  birth_date?: string | null
  first_visit_date?: string | null
  gender?: 'male' | 'female' | 'other' | '' | null
  address?: string | null
  city?: string | null
  postal_code?: string | null
  notes?: string | null
  source_id?: string | null
  referred_by_patient_id?: string | null
  campaign_id?: string | null
  acquisition_date?: string | null
}

export async function GET(request: NextRequest) {
  return withRouteContext(request, async ({ requestId }) => {
    const logger = createRouteLogger(requestId);

    try {
      const cookieStore = cookies();
      const searchParams = request.nextUrl.searchParams;

      const clinicContext = await resolveClinicContext({
        requestedClinicId: searchParams.get('clinicId'),
        cookieStore,
      });

      if ('error' in clinicContext) {
        return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
      }

      const { clinicId, userId } = clinicContext;
      const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'patients.view');
      if (forbidden) return forbidden;

      const search = searchParams.get('search');

      if (shouldReturnConvexData('patients')) {
        const data = await getPatientsFromConvex(clinicId, search);
        return NextResponse.json({ data });
      }

      let query = supabaseAdmin
        .from('patients')
        .select(`
          *,
          source:patient_sources(*),
          campaign:marketing_campaigns(id, name),
          platform:categories(id, name, display_name),
          referred_by:patients!referred_by_patient_id(id, first_name, last_name)
        `)
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('patients.get.query_failed', { error: error.message });
        return NextResponse.json(
          { error: 'Failed to fetch patients', message: error.message },
          { status: 500 }
        );
      }

      if (shouldCompareConvexData('patients')) {
        await comparePatientsWithConvex(logger, clinicId, search, data || []);
      }

      return NextResponse.json({ data: data || [] });
    } catch (error) {
      logger.error('patients.get.unexpected_error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

type ImportedRecord = Record<string, any>

async function getPatientsFromConvex(clinicId: string, search: string | null) {
  const [patientRows, sourceRows, campaignRows, categoryRows] = await Promise.all([
    listConvexDocumentsByClinic('patients', clinicId, 500) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('patient_sources', clinicId, 500) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('marketing_campaigns', clinicId, 500) as Promise<ImportedRecord[]>,
    listConvexTable('categories', 1000) as Promise<ImportedRecord[]>,
  ]);

  const sourceById = byId(sourceRows);
  const campaignById = byId(campaignRows);
  const categoryById = byId(categoryRows);
  const patientById = byId(patientRows);
  const normalizedSearch = search?.trim().toLowerCase();

  return patientRows
    .filter((row) => {
      if (!normalizedSearch) return true;
      return [row.first_name, row.last_name, row.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    })
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .map((row) => {
      const patient = normalizeConvexRecord(row);
      const referredBy = row.referred_by_patient_id ? patientById.get(String(row.referred_by_patient_id)) : null;

      return {
        ...patient,
        source: row.source_id ? normalizeConvexRecord(sourceById.get(String(row.source_id))) : null,
        campaign: row.campaign_id ? normalizeConvexRecord(campaignById.get(String(row.campaign_id))) : null,
        platform: row.platform_id ? normalizeConvexRecord(categoryById.get(String(row.platform_id))) : null,
        referred_by: referredBy
          ? {
              id: referredBy.id,
              first_name: referredBy.first_name,
              last_name: referredBy.last_name,
            }
          : null,
      };
    });
}

function byId(rows: ImportedRecord[]) {
  return new Map(
    rows.flatMap((row) => {
      const ids = [row.id, row.legacyId].filter(Boolean).map((id) => String(id));
      return ids.map((id) => [id, row] as const);
    })
  );
}

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null;
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

async function comparePatientsWithConvex(
  logger: ReturnType<typeof createRouteLogger>,
  clinicId: string,
  search: string | null,
  supabaseRows: unknown[]
) {
  try {
    const convexRows = await getPatientsFromConvex(clinicId, search);
    if (convexRows.length !== supabaseRows.length) {
      logger.warn('patients.dual_read.count_mismatch', {
        clinicId,
        search: search ?? null,
        supabase: supabaseRows.length,
        convex: convexRows.length,
      });
    }
  } catch (error) {
    logger.error('patients.dual_read.convex_failed', {
      clinicId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function findConvexPatientConflict(
  clinicId: string,
  patient: { first_name?: string | null; last_name?: string | null; email?: string | null },
  excludeId?: string
): Promise<ImportedRecord | null> {
  const rows = await getPatientsFromConvex(clinicId, null);
  const normalizedName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim().toLowerCase();
  const normalizedEmail = patient.email?.trim().toLowerCase();

  return rows.find((row: any) => {
    if (excludeId && row.id === excludeId) return false;
    const rowName = `${row.first_name || ''} ${row.last_name || ''}`.trim().toLowerCase();
    const rowEmail = row.email?.trim().toLowerCase();

    return (
      (normalizedName.length > 0 && rowName === normalizedName) ||
      (normalizedEmail && rowEmail === normalizedEmail)
    );
  }) ?? null;
}

async function createPatientInConvex(
  clinicId: string,
  patientData: Record<string, unknown>
) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const row = {
    active: true,
    ...patientData,
    id,
    clinic_id: clinicId,
    created_at: now,
    updated_at: now,
  };

  await upsertConvexDocumentByLegacyId('patients', id, row);
  return row;
}

async function mirrorPatientToConvex(
  logger: ReturnType<typeof createRouteLogger>,
  patient: Record<string, unknown>
) {
  const id = patient.id;
  if (typeof id !== 'string') return;

  try {
    await upsertConvexDocumentByLegacyId('patients', id, patient);
  } catch (error) {
    logger.error('patients.dual_write.convex_failed', {
      patientId: id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(request: NextRequest) {
  return withRouteContext(request, async ({ requestId }) => {
    const logger = createRouteLogger(requestId);

    try {
      const bodyResult = await readJsonBody<PatientRequestBody>(request);
      if ('error' in bodyResult) {
        return bodyResult.error;
      }
      const body = bodyResult.data;
      const cookieStore = cookies();

      const clinicContext = await resolveClinicContext({
        requestedClinicId: body?.clinic_id,
        cookieStore,
      });

      if ('error' in clinicContext) {
        return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
      }

      const { clinicId, userId } = clinicContext;
      const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'patients.create');
      if (forbidden) return forbidden;

      const cleanedBody = {
        first_name: body.first_name,
        last_name: body.last_name,
        ...(body.email && body.email.trim() && { email: body.email.trim() }),
        ...(body.phone && { phone: body.phone }),
        ...(body.birth_date && { birth_date: body.birth_date }),
        ...(body.first_visit_date && { first_visit_date: body.first_visit_date }),
        ...(body.gender && { gender: body.gender }),
        ...(body.address && { address: body.address }),
        ...(body.city && { city: body.city }),
        ...(body.postal_code && { postal_code: body.postal_code }),
        ...(body.notes && { notes: body.notes }),
        ...(body.source_id && { source_id: body.source_id }),
        ...(body.referred_by_patient_id && { referred_by_patient_id: body.referred_by_patient_id }),
        ...(body.campaign_id && { campaign_id: body.campaign_id }),
        ...(
          (body.acquisition_date || body.first_visit_date)
            ? { acquisition_date: (body.acquisition_date || body.first_visit_date) }
            : {}
        ),
      };

      const validationResult = patientSchema.safeParse(cleanedBody);
      if (!validationResult.success) {
        logger.warn('patients.post.validation_failed', {
          details: validationResult.error.errors,
        });
        return NextResponse.json(
          {
            error: 'Validation failed',
            message: validationResult.error.errors.map(e => e.message).join(', '),
          },
          { status: 400 }
        );
      }

      const patientData = {
        ...validationResult.data,
        clinic_id: clinicId,
      };

      if (shouldUseConvexOnlyWritePath('patients')) {
        const conflict = await findConvexPatientConflict(clinicId, patientData);
        if (conflict) {
          const fullName = `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim();
          return NextResponse.json(
            {
              error: conflict.email && patientData.email && conflict.email === patientData.email
                ? 'DUPLICATE_PATIENT_EMAIL'
                : 'DUPLICATE_PATIENT_NAME',
              data: {
                name: fullName || 'Unknown',
                email: patientData.email || 'Unknown',
              },
            },
            { status: 409 }
          );
        }

        const data = await createPatientInConvex(clinicId, patientData);
        return NextResponse.json({
          data,
          message: 'Patient created successfully',
        });
      }

      const { data, error } = await supabaseAdmin
        .from('patients')
        .insert(patientData)
        .select()
        .single();

      if (error) {
        logger.error('patients.post.insert_failed', {
          code: error.code,
          error: error.message,
        });

        // Handle unique constraint violations (code 23505)
        // Return error codes + data for client-side i18n translation
        if (error.code === '23505') {
          // Duplicate name constraint
          if (error.message.includes('idx_patients_unique_name_per_clinic')) {
            const fullName = `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim();
            return NextResponse.json(
              {
                error: 'DUPLICATE_PATIENT_NAME',
                data: {
                  name: fullName || 'Unknown'
                }
              },
              { status: 409 }
            );
          }
          // Duplicate email constraint
          if (error.message.includes('patients_clinic_id_email_key')) {
            return NextResponse.json(
              {
                error: 'DUPLICATE_PATIENT_EMAIL',
                data: {
                  email: patientData.email || 'Unknown'
                }
              },
              { status: 409 }
            );
          }
        }

        return NextResponse.json(
          { error: 'Failed to create patient', message: error.message },
          { status: 500 }
        );
      }

      if (data && shouldWriteConvexData('patients')) {
        await mirrorPatientToConvex(logger, data as Record<string, unknown>);
      }

      return NextResponse.json({
        data,
        message: 'Patient created successfully',
      });
    } catch (error) {
      logger.error('patients.post.unexpected_error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
