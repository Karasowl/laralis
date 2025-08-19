import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';
import { createSupabaseClient } from '@/lib/supabase';
import { z } from 'zod';

const createCampaignSchema = z.object({
  platform_id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createSupabaseClient(cookieStore);
    
    // ✅ Validar usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Mapear los datos para incluir platform_name
    const mappedData = (data || []).map(campaign => ({
      ...campaign,
      platform_name: campaign.platform?.display_name || campaign.platform?.name || 'Desconocida'
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
    const body = await request.json();
    const cookieStore = cookies();
    const supabase = createSupabaseClient(cookieStore);
    
    // ✅ Validar usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    const validation = createCampaignSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', message: validation.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('marketing_campaigns')
      .insert({
        clinic_id: clinicId,
        platform_id: validation.data.platform_id,
        name: validation.data.name,
        code: validation.data.code || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating marketing campaign:', error);
      return NextResponse.json(
        { error: 'Failed to create marketing campaign', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error in POST /api/marketing/campaigns:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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


