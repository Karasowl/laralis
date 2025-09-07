import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';
import { z } from 'zod';

const createCampaignSchema = z.object({
  platform_id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    
    const searchParams = request.nextUrl.searchParams;
    const clinicId = searchParams.get('clinicId') || await getClinicIdOrDefault(cookieStore);
    const activeOnly = searchParams.get('active') === 'true';
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const platformId = searchParams.get('platformId');

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from('marketing_campaigns')
      .select(`
        *,
        platform:platform_category_id (
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
      query = query.eq('platform_category_id', platformId);
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
      platform_name: campaign.platform?.display_name || campaign.platform?.name || 'Desconocida',
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
    console.log('[POST /api/marketing/campaigns] Starting...');
    
    const body = await request.json();
    console.log('[POST /api/marketing/campaigns] Request body:', JSON.stringify(body, null, 2));
    
    const cookieStore = cookies();
    const clinicId = body.clinic_id || await getClinicIdOrDefault(cookieStore);
    console.log('[POST /api/marketing/campaigns] Clinic ID:', clinicId);

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
    console.log('[POST /api/marketing/campaigns] Checking platform_id:', validation.data.platform_id);
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

    console.log('[POST /api/marketing/campaigns] Platform verified:', platformCheck.display_name || platformCheck.name);

    const insertData = {
      clinic_id: clinicId,
      platform_category_id: validation.data.platform_id,  // La columna en la DB es platform_category_id
      name: validation.data.name,
      code: validation.data.code || null,
    };

    console.log('[POST /api/marketing/campaigns] Inserting:', JSON.stringify(insertData, null, 2));

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

    console.log('[POST /api/marketing/campaigns] Campaign created successfully:', data.id);
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
    const body = await request.json();
    const id = body?.id as string | undefined;
    if (!id) {
      return NextResponse.json({ error: 'Missing campaign id' }, { status: 400 });
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


