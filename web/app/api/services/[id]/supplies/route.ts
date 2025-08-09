import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zServiceSupply } from '@/lib/zod';
import type { ServiceSupply, Supply, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<(ServiceSupply & { supply?: Supply })[]>>> {
  try {
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // Get service supplies with supply details (join)
    const { data, error } = await supabaseAdmin
      .from('service_supplies')
      .select(`
        *,
        supplies (
          id,
          name,
          category,
          presentation,
          price_cents,
          portions
        )
      `)
      .eq('service_id', params.id)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching service supplies:', error);
      return NextResponse.json(
        { error: 'Failed to fetch service recipe', message: error.message },
        { status: 500 }
      );
    }

    // Transform the data to match our type
    const transformedData = data?.map(item => ({
      ...item,
      supply: item.supplies || undefined
    })) || [];

    return NextResponse.json({ data: transformedData });
  } catch (error) {
    console.error('Unexpected error in GET /api/services/[id]/supplies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<ServiceSupply>>> {
  try {
    const body = await request.json();
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // Verify service exists and belongs to clinic
    const { data: service } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single();

    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    // Add service_id and clinic_id to body for validation
    const dataWithContext = {
      ...body,
      service_id: params.id,
      clinic_id: clinicId
    };

    // Validate request body
    const validationResult = zServiceSupply.safeParse(dataWithContext);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    const { clinic_id, service_id, supply_id, qty } = validationResult.data;

    // Check if this supply is already in the recipe
    const { data: existing } = await supabaseAdmin
      .from('service_supplies')
      .select('id')
      .eq('service_id', service_id)
      .eq('supply_id', supply_id)
      .eq('clinic_id', clinic_id)
      .single();

    let result;

    if (existing) {
      // Update existing quantity
      result = await supabaseAdmin
        .from('service_supplies')
        .update({ qty })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new recipe line
      result = await supabaseAdmin
        .from('service_supplies')
        .insert({ clinic_id, service_id, supply_id, qty })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error saving service supply:', result.error);
      return NextResponse.json(
        { error: 'Failed to save recipe line', message: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: result.data,
      message: existing ? 'Recipe line updated' : 'Recipe line added'
    }, { status: existing ? 200 : 201 });

  } catch (error) {
    console.error('Unexpected error in POST /api/services/[id]/supplies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}