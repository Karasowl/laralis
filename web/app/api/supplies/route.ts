import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zSupply } from '@/lib/zod';
import type { Supply, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';

export const dynamic = 'force-dynamic'


export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Supply[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;

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
    const clinicContext = await resolveClinicContext({ requestedClinicId: body?.clinic_id, cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;
    
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

    // Prevent duplicate names per clinic (case-insensitive)
    const { data: existingByName, error: dupCheckErr } = await supabaseAdmin
      .from('supplies')
      .select('id, name')
      .eq('clinic_id', clinic_id)
      .ilike('name', name.trim())
      .limit(1);

    if (dupCheckErr) {
      console.error('Error checking duplicate supply name:', dupCheckErr)
    }

    if (existingByName && existingByName.length > 0) {
      return NextResponse.json(
        { error: 'Duplicate name', message: 'Ya existe un insumo con ese nombre en esta clínica.' },
        { status: 409 }
      )
    }

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
