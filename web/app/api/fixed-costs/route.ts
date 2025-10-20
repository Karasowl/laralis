import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zFixedCost } from '@/lib/zod';
import type { FixedCost, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';

export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<FixedCost[]>>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const category = searchParams.get('category');

    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    });

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      );
    }

    const { clinicId } = clinicContext;

    let query = supabaseAdmin
      .from('fixed_costs')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching fixed costs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch fixed costs', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/fixed-costs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<FixedCost>>> {
  try {
    const body = await request.json();
    const cookieStore = cookies();

    const clinicContext = await resolveClinicContext({
      requestedClinicId: body?.clinic_id,
      cookieStore,
    });

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      );
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

    const { clinic_id, category, concept, amount_cents } = validationResult.data;

    const { data, error } = await supabaseAdmin
      .from('fixed_costs')
      .insert({ clinic_id, category, concept, amount_cents })
      .select()
      .single();

    if (error) {
      console.error('Error creating fixed cost:', error);
      return NextResponse.json(
        { error: 'Failed to create fixed cost', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      message: 'Fixed cost created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/fixed-costs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
