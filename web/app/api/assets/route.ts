import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zAsset } from '@/lib/zod';
import type { Asset, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Asset[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search');

    const cookieStore = cookies();
    const clinicId = searchParams.get('clinicId') || await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

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
    const clinicId = body.clinic_id || await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // Convert pesos form payload if present
    const dataToValidate = { ...body, clinic_id: clinicId };
    if ('purchase_price_pesos' in body) {
      dataToValidate.purchase_price_cents = Math.round(body.purchase_price_pesos * 100);
      delete dataToValidate.purchase_price_pesos;
    }

    const validationResult = zAsset.safeParse(dataToValidate);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          message: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('assets')
      .insert(validationResult.data)
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



