import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zFixedCost } from '@/lib/zod';
import type { FixedCost, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';

interface RouteParams {
  params: {
    id: string;
  };
}

async function getClinicContextFromCookies() {
  const cookieStore = cookies();
  const clinicContext = await resolveClinicContext({ cookieStore });
  if ('error' in clinicContext) {
    return clinicContext;
  }
  return { clinicId: clinicContext.clinicId };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<FixedCost>>> {
  try {
    const clinicContext = await getClinicContextFromCookies();
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }

    const { clinicId } = clinicContext;

    const { data, error } = await supabaseAdmin
      .from('fixed_costs')
      .select('*')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Fixed cost not found' },
          { status: 404 }
        );
      }

      console.error('Error fetching fixed cost:', error);
      return NextResponse.json(
        { error: 'Failed to fetch fixed cost', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error in GET /api/fixed-costs/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<FixedCost>>> {
  try {
    const body = await request.json();
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }

    const { clinicId } = clinicContext;

    const validationResult = zFixedCost.safeParse({ ...body, clinic_id: clinicId });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: validationResult.error.errors.map(e => e.message).join(', '),
        },
        { status: 400 }
      );
    }

    const { category, concept, amount_cents } = validationResult.data;

    const { data, error } = await supabaseAdmin
      .from('fixed_costs')
      .update({ category, concept, amount_cents })
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Fixed cost not found' },
          { status: 404 }
        );
      }

      console.error('Error updating fixed cost:', error);
      return NextResponse.json(
        { error: 'Failed to update fixed cost', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      message: 'Fixed cost updated successfully',
    });
  } catch (error) {
    console.error('Unexpected error in PUT /api/fixed-costs/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const clinicContext = await getClinicContextFromCookies();
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }

    const { clinicId } = clinicContext;

    const { error } = await supabaseAdmin
      .from('fixed_costs')
      .delete()
      .eq('id', params.id)
      .eq('clinic_id', clinicId);

    if (error) {
      console.error('Error deleting fixed cost:', error);
      return NextResponse.json(
        { error: 'Failed to delete fixed cost', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: null,
      message: 'Fixed cost deleted successfully',
    });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/fixed-costs/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
