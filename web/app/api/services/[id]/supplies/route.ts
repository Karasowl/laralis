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
    // Note: service_supplies doesn't have clinic_id, the service itself has it
    const { data, error } = await supabaseAdmin
      .from('service_supplies')
      .select(`
        *,
        supplies!service_supplies_supply_id_fkey (
          id,
          name,
          category,
          presentation,
          price_cents,
          portions
        )
      `)
      .eq('service_id', params.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching service supplies:', error);
      return NextResponse.json(
        { error: 'Failed to fetch service recipe', message: error.message },
        { status: 500 }
      );
    }

    // Transform the data to match our type
    // Note: Database uses 'qty' column
    const transformedData = data?.map(item => ({
      id: item.id, // Include the record ID
      supply_id: item.supply_id,
      qty: item.qty, // Keep original column name
      supply: item.supplies ? {
        ...item.supplies,
        cost_per_portion_cents: Math.round(item.supplies.price_cents / item.supplies.portions)
      } : undefined
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
    // Use 'quantity' as our standard name, but the API uses 'qty'
    const quantity = qty;

    // Check if this supply is already in the recipe
    const { data: existing } = await supabaseAdmin
      .from('service_supplies')
      .select('id')
      .eq('service_id', service_id)
      .eq('supply_id', supply_id)
      .single();

    let result;

    if (existing) {
      // Update existing quantity (use qty for backward compatibility)
      result = await supabaseAdmin
        .from('service_supplies')
        .update({ qty: quantity })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new recipe line (use qty for backward compatibility)
      // Note: service_supplies doesn't have clinic_id
      result = await supabaseAdmin
        .from('service_supplies')
        .insert({ service_id, supply_id, qty: quantity })
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

// DELETE endpoint for removing supply by supply_id (not row id)
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<null>>> {
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

    const { supply_id } = body;
    
    if (!supply_id) {
      return NextResponse.json(
        { error: 'supply_id is required' },
        { status: 400 }
      );
    }

    // Delete the service_supply record
    const { error } = await supabaseAdmin
      .from('service_supplies')
      .delete()
      .eq('service_id', params.id)
      .eq('supply_id', supply_id);

    if (error) {
      console.error('Error deleting service supply:', error);
      return NextResponse.json(
        { error: 'Failed to delete service supply', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: null,
      message: 'Supply removed from service'
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/services/[id]/supplies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}