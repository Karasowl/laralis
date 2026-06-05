import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { listConvexDocumentsByClinic, listConvexTable } from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null;
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row;
  return rest;
}

async function getCampaignsFromConvex(
  clinicId: string,
  activeOnly: boolean,
  includeArchived: boolean,
  platformId: string | null
) {
  const [campaignRows, categoryRows, patientRows] = await Promise.all([
    listConvexDocumentsByClinic('marketing_campaigns', clinicId, 10000) as Promise<ImportedRecord[]>,
    // Marketing platforms are system categories (clinic_id null), so the FK
    // join must scan the full categories table, not just clinic-scoped rows.
    // Mirrors the Supabase `platform:platform_id (...)` join, which resolves by
    // id with no clinic filter (see the POST platform_id existence check).
    listConvexTable('categories', 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('patients', clinicId, 10000) as Promise<ImportedRecord[]>,
  ]);

  // Build the platform lookup by id/legacyId to replicate the FK join.
  const categoriesById = new Map<string, ImportedRecord>();
  for (const row of categoryRows) {
    for (const key of [row.id, row.legacyId].filter(Boolean)) {
      categoriesById.set(String(key), row);
    }
  }

  // Replicate the SAME JS filtering as the Supabase query builder.
  let campaigns = campaignRows.filter((row) => {
    if (activeOnly && row.is_active !== true) return false;
    // Mirror Supabase .eq('is_archived', false): excludes BOTH true AND null/undefined.
    if (!includeArchived && row.is_archived !== false) return false;
    if (platformId && String(row.platform_id || '') !== platformId) return false;
    return true;
  });

  // Order: is_active desc, is_archived asc, name asc (byte-identical to Supabase order chain).
  campaigns = campaigns.sort((a, b) => {
    const activeA = a.is_active === true ? 1 : 0;
    const activeB = b.is_active === true ? 1 : 0;
    if (activeA !== activeB) return activeB - activeA;
    const archivedA = a.is_archived === true ? 1 : 0;
    const archivedB = b.is_archived === true ? 1 : 0;
    if (archivedA !== archivedB) return archivedA - archivedB;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  // Count patients per campaign (FK join by campaign_id).
  const campaignIds = new Set(
    campaigns.map((c) => c.id).filter(Boolean).map((id) => String(id))
  );
  const patientsCounts: Record<string, number> = {};
  for (const row of patientRows) {
    if (!row.campaign_id) continue;
    const cid = String(row.campaign_id);
    if (!campaignIds.has(cid)) continue;
    patientsCounts[cid] = (patientsCounts[cid] || 0) + 1;
  }

  return campaigns.map((campaign) => {
    const platformRow = campaign.platform_id
      ? categoriesById.get(String(campaign.platform_id))
      : null;
    const platform = platformRow
      ? {
          id: platformRow.id,
          display_name: platformRow.display_name ?? null,
          name: platformRow.name ?? null,
        }
      : null;
    const normalized = normalizeConvexRecord(campaign) as ImportedRecord;
    return {
      ...normalized,
      platform,
      platform_name: platform?.display_name || platform?.name || 'Unknown',
      patients_count: patientsCounts[String(campaign.id)] || 0,
    };
  });
}


const createCampaignSchema = z.object({
  platform_id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().optional().nullable(),
});

const updateCampaignSchema = z.object({
  id: z.string().uuid(),
  clinic_id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  code: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  is_archived: z.boolean().optional(),
}).passthrough();

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    
    const searchParams = request.nextUrl.searchParams;
    const clinicContext = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'campaigns.view');
    if (forbidden) return forbidden;
    const activeOnly = searchParams.get('active') === 'true';
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const platformId = searchParams.get('platformId');

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    if (shouldReturnConvexData('marketing_campaigns')) {
      const data = await getCampaignsFromConvex(clinicId, activeOnly, includeArchived, platformId);
      return NextResponse.json({ data });
    }

    let query = supabaseAdmin
      .from('marketing_campaigns')
      .select(`
        *,
        platform:platform_id (
          id,
          display_name,
          name
        )
      `)
      .eq('clinic_id', clinicId)
      .order('is_active', { ascending: false })
      .order('is_archived', { ascending: true })
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }
    if (platformId) {
      query = query.eq('platform_id', platformId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching marketing campaigns:', error);
      return NextResponse.json(
        { error: 'Failed to fetch marketing campaigns', message: error.message },
        { status: 500 }
      );
    }

    // Enriquecer con conteo de pacientes por campaña
    let patientsCounts: Record<string, number> = {};
    const campaignIds = (data || []).map(c => c.id).filter(Boolean);
    if (campaignIds.length > 0) {
      const { data: patientRows, error: patientsError } = await supabaseAdmin
        .from('patients')
        .select('campaign_id')
        .eq('clinic_id', clinicId)
        .in('campaign_id', campaignIds as string[]);

      if (!patientsError && patientRows) {
        for (const row of patientRows) {
          if (!row.campaign_id) continue;
          patientsCounts[row.campaign_id] = (patientsCounts[row.campaign_id] || 0) + 1;
        }
      }
    }

    // Mapear los datos para incluir platform_name y patients_count
    const mappedData = (data || []).map(campaign => ({
      ...campaign,
      platform_name: campaign.platform?.display_name || campaign.platform?.name || 'Unknown',
      patients_count: patientsCounts[campaign.id] || 0,
    }));

    return NextResponse.json({ data: mappedData });
  } catch (error) {
    console.error('Unexpected error in GET /api/marketing/campaigns:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.info('[POST /api/marketing/campaigns] Starting...');
    
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data;
    console.info('[POST /api/marketing/campaigns] Request body:', JSON.stringify(body, null, 2));
    
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ requestedClinicId: body?.clinic_id, cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'campaigns.create');
    if (forbidden) return forbidden;
    console.info('[POST /api/marketing/campaigns] Clinic ID:', clinicId);

    if (!clinicId) {
      console.error('[POST /api/marketing/campaigns] No clinic context available');
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    const validation = createCampaignSchema.safeParse(body);
    if (!validation.success) {
      console.error('[POST /api/marketing/campaigns] Validation failed:', validation.error.errors);
      return NextResponse.json(
        { error: 'Validation failed', message: validation.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    // Verificar que el platform_id existe antes de insertar
    console.info('[POST /api/marketing/campaigns] Checking platform_id:', validation.data.platform_id);
    const { data: platformCheck, error: platformError } = await supabaseAdmin
      .from('categories')
      .select('id, name, display_name')
      .eq('id', validation.data.platform_id)
      .eq('entity_type', 'marketing_platform')
      .single();

    if (platformError || !platformCheck) {
      console.error('[POST /api/marketing/campaigns] Platform not found:', platformError);
      return NextResponse.json(
        { 
          error: 'Invalid platform_id', 
          message: `Platform with ID ${validation.data.platform_id} not found`,
          hint: 'Please ensure the platform exists in the categories table'
        },
        { status: 400 }
      );
    }

    console.info('[POST /api/marketing/campaigns] Platform verified:', platformCheck.display_name || platformCheck.name);

    const insertData = {
      clinic_id: clinicId,
      platform_id: validation.data.platform_id,
      name: validation.data.name,
      code: validation.data.code || null,
    };

    console.info('[POST /api/marketing/campaigns] Inserting:', JSON.stringify(insertData, null, 2));

    const { data, error } = await supabaseAdmin
      .from('marketing_campaigns')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[POST /api/marketing/campaigns] Insert error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return NextResponse.json(
        { 
          error: 'Failed to create marketing campaign', 
          message: error.message,
          details: error.details,
          hint: error.hint 
        },
        { status: 500 }
      );
    }

    console.info('[POST /api/marketing/campaigns] Campaign created successfully:', data.id);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[POST /api/marketing/campaigns] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const parsed = validateSchema(updateCampaignSchema, bodyResult.data);
    if ('error' in parsed) {
      return parsed.error;
    }
    const body = parsed.data;
    const id = body.id;

    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ requestedClinicId: body?.clinic_id, cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'campaigns.edit');
    if (forbidden) return forbidden;

    // Ensure the campaign belongs to this clinic
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('marketing_campaigns')
      .select('id, clinic_id')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) {
      return NextResponse.json({ error: 'Failed to fetch marketing campaign', message: fetchErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if ((existing as any).clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const patch: any = {};
    if (body.name) patch.name = body.name;
    if (body.code !== undefined) patch.code = body.code;
    if (body.is_active !== undefined) patch.is_active = body.is_active;
    if (body.is_archived !== undefined) patch.is_archived = body.is_archived;

    const { data, error } = await supabaseAdmin
      .from('marketing_campaigns')
      .update({ ...patch })
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .select()
      .single();

    if (error) {
      console.error('Error updating marketing campaign:', error);
      return NextResponse.json(
        { error: 'Failed to update marketing campaign', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error in PUT /api/marketing/campaigns:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


