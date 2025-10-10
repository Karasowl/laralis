import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zAsset } from '@/lib/zod';
import type { Asset, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Asset[]>>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search');

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
      .from('assets')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching assets:', error);
      return NextResponse.json(
        { error: 'Failed to fetch assets', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/assets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Asset>>> {
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

    const { purchase_price_pesos, ...bodyWithoutPesos } = body as {
      purchase_price_pesos?: number;
    } & Record<string, unknown>;

    const dataToValidate: Record<string, unknown> = {
      ...bodyWithoutPesos,
      clinic_id: clinicId,
    };

    if (typeof purchase_price_pesos === 'number') {
      dataToValidate.purchase_price_cents = Math.round(purchase_price_pesos * 100);
    }

    const validationResult = zAsset.safeParse(dataToValidate);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: validationResult.error.errors.map(e => e.message).join(', '),
        },
        { status: 400 }
      );
    }

    const {
      id: _ignoreId,
      created_at: _ignoreCreatedAt,
      updated_at: _ignoreUpdatedAt,
      depreciation_months,
      ...rest
    } = validationResult.data;

    const normalizedMonths = typeof depreciation_months === 'number' && Number.isFinite(depreciation_months)
      ? Math.max(1, Math.round(depreciation_months))
      : 36;
    const depreciationYears = Math.max(1, Math.round(normalizedMonths / 12));

    const dataToInsert = {
      ...rest,
      depreciation_years: depreciationYears,
    };

    const { data, error } = await supabaseAdmin
      .from('assets')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('Error creating asset:', error);
      return NextResponse.json(
        { error: 'Failed to create asset', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, message: 'Asset created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/assets:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
