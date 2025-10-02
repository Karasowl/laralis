import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';

interface RouteParams {
  params: {
    id: string;
    rowId: string;
  };
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const cookieStore = cookies();
    const ctx = await resolveClinicContext({ cookieStore });
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status });
    }
    const { clinicId } = ctx;

    // Verify the recipe line exists and belongs to the service and clinic
    // Verify the recipe line exists and belongs to a service in this clinic
    const { data: recipeLine } = await supabaseAdmin
      .from('service_supplies')
      .select('id, service_id')
      .eq('id', params.rowId)
      .eq('service_id', params.id)
      .single();

    if (!recipeLine) {
      return NextResponse.json(
        { error: 'Recipe line not found' },
        { status: 404 }
      );
    }

    // Double-check service belongs to clinic
    const { data: service } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single();
    if (!service) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the recipe line
    const { error } = await supabaseAdmin
      .from('service_supplies')
      .delete()
      .eq('id', params.rowId);

    if (error) {
      console.error('Error deleting recipe line:', error);
      return NextResponse.json(
        { error: 'Failed to delete recipe line', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: null,
      message: 'Recipe line deleted successfully'
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/services/[id]/supplies/[rowId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const body = await request.json();
    const cookieStore = cookies();
    const ctx = await resolveClinicContext({ cookieStore });
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status });
    }
    const { clinicId } = ctx;

    // Verify the recipe line exists and belongs to the service and clinic
    const { data: recipeLine } = await supabaseAdmin
      .from('service_supplies')
      .select('id, service_id')
      .eq('id', params.rowId)
      .eq('service_id', params.id)
      .single();

    if (!recipeLine) {
      return NextResponse.json(
        { error: 'Recipe line not found' },
        { status: 404 }
      );
    }

    const { qty } = body;

    if (typeof qty !== 'number' || qty < 0) {
      return NextResponse.json(
        { error: 'Invalid quantity' },
        { status: 400 }
      );
    }

    // Double-check service belongs to clinic
    const { data: service } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single();
    if (!service) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update the quantity
    const { error } = await supabaseAdmin
      .from('service_supplies')
      .update({ qty })
      .eq('id', params.rowId);

    if (error) {
      console.error('Error updating recipe line:', error);
      return NextResponse.json(
        { error: 'Failed to update recipe line', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: null,
      message: 'Recipe line updated successfully'
    });

  } catch (error) {
    console.error('Unexpected error in PUT /api/services/[id]/supplies/[rowId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
