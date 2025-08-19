import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zSupply } from '@/lib/zod';
import type { Supply, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Supply[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');
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
      .from('supplies')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name', { ascending: true });

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }
    
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching supplies:', error);
      return NextResponse.json(
        { error: 'Failed to fetch supplies', message: error.message },
        { status: 500 }
      );
    }

    // Add calculated cost_per_portion_cents field
    const suppliesWithCostPerPortion = (data || []).map(supply => ({
      ...supply,
      cost_per_portion_cents: Math.round(supply.price_cents / supply.portions)
    }));

    return NextResponse.json({ data: suppliesWithCostPerPortion });
  } catch (error) {
    console.error('Unexpected error in GET /api/supplies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Supply>>> {
  try {
    const body = await request.json();

    const cookieStore = cookies();
    const supabase = createSupabaseClient(cookieStore);
    
    // ✅ Validar usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clinicId = body.clinic_id || await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }
    
    // Si viene con price_pesos, convertir a cents
    let dataToValidate = { ...body };
    if ('price_pesos' in body) {
      dataToValidate.price_cents = Math.round(body.price_pesos * 100);
      delete dataToValidate.price_pesos;
    }
    
    // Add clinic_id to body for validation
    dataToValidate.clinic_id = clinicId;
    
    // Calcular cost_per_portion_cents si no viene
    if (dataToValidate.price_cents && dataToValidate.portions > 0) {
      dataToValidate.cost_per_portion_cents = Math.round(dataToValidate.price_cents / dataToValidate.portions);
    }
    
    // Validate request body
    const validationResult = zSupply.safeParse(dataToValidate);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          message: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    const { clinic_id, name, category, presentation, price_cents, portions } = validationResult.data;

    const { data, error } = await supabaseAdmin
      .from('supplies')
      .insert({ clinic_id, name, category, presentation, price_cents, portions })
      .select()
      .single();

    if (error) {
      console.error('Error creating supply:', error);
      return NextResponse.json(
        { error: 'Failed to create supply', message: error.message },
        { status: 500 }
      );
    }

    // Add calculated cost_per_portion_cents field
    const supplyWithCostPerPortion = {
      ...data,
      cost_per_portion_cents: Math.round(data.price_cents / data.portions)
    };

    return NextResponse.json({ 
      data: supplyWithCostPerPortion,
      message: 'Supply created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in POST /api/supplies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}