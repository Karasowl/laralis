import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zSupply } from '@/lib/zod';
import type { Supply, ApiResponse } from '@/lib/types';
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
): Promise<NextResponse<ApiResponse<Supply>>> {
  try {
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('supplies')
      .select('*')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Supply not found' },
          { status: 404 }
        );
      }
      
      console.error('Error fetching supply:', error);
      return NextResponse.json(
        { error: 'Failed to fetch supply', message: error.message },
        { status: 500 }
      );
    }

    // Agregar campo calculado
    const supplyWithCostPerPortion = {
      ...data,
      cost_per_portion_cents: data.portions > 0 ? Math.round(data.price_cents / data.portions) : 0
    };

    return NextResponse.json({ data: supplyWithCostPerPortion });
  } catch (error) {
    console.error('Unexpected error in GET /api/supplies/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest, 
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Supply>>> {
  try {
    const body = await request.json();
    console.log('PUT /api/supplies/[id] - Received body:', body, 'ID:', params.id);
    
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

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
    
    console.log('Data to validate:', dataToValidate);
    
    // Validate request body
    const validationResult = zSupply.safeParse(dataToValidate);
    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error);
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          message: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        },
        { status: 400 }
      );
    }

    const { name, category, presentation, price_cents, portions } = validationResult.data;

    // Verificar que el supply pertenece a la clínica
    const { data: existingSupply } = await supabaseAdmin
      .from('supplies')
      .select('clinic_id')
      .eq('id', params.id)
      .single();

    if (!existingSupply || existingSupply.clinic_id !== clinicId) {
      return NextResponse.json(
        { error: 'Supply not found or access denied' },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('supplies')
      .update({ 
        name, 
        category, 
        presentation, 
        price_cents, 
        portions,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .select()
      .single();

    if (error) {
      console.error('Error updating supply:', error);
      return NextResponse.json(
        { error: 'Failed to update supply', message: error.message },
        { status: 500 }
      );
    }

    // Agregar campo calculado
    const supplyWithCostPerPortion = {
      ...data,
      cost_per_portion_cents: Math.round(data.price_cents / data.portions)
    };

    return NextResponse.json({ 
      data: supplyWithCostPerPortion,
      message: 'Supply updated successfully'
    });

  } catch (error) {
    console.error('Unexpected error in PUT /api/supplies/[id]:', error);
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
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // Verificar que el supply pertenece a la clínica
    const { data: existingSupply } = await supabaseAdmin
      .from('supplies')
      .select('clinic_id')
      .eq('id', params.id)
      .single();

    if (!existingSupply || existingSupply.clinic_id !== clinicId) {
      return NextResponse.json(
        { error: 'Supply not found or access denied' },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from('supplies')
      .delete()
      .eq('id', params.id)
      .eq('clinic_id', clinicId);

    if (error) {
      console.error('Error deleting supply:', error);
      return NextResponse.json(
        { error: 'Failed to delete supply', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data: null,
      message: 'Supply deleted successfully'
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/supplies/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}