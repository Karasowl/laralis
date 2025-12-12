import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zSupply } from '@/lib/zod';
import type { Supply, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';

export const dynamic = 'force-dynamic'


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
    const clinicContext = await resolveClinicContext({ cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;

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
    const clinicContext = await resolveClinicContext({ cookieStore });
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

    // Extract and validate inventory fields (optional, not in main zod schema)
    // Only set if explicitly provided in body to avoid clearing existing values
    // Must be non-negative integers when provided
    let stock_quantity: number | undefined = undefined;
    let min_stock_alert: number | undefined = undefined;

    if ('stock_quantity' in body) {
      const raw = body.stock_quantity;
      stock_quantity = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : 0;
    }
    if ('min_stock_alert' in body) {
      const raw = body.min_stock_alert;
      min_stock_alert = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : 10;
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

    // Validate no duplicate name (case-insensitive) within the same clinic, excluding current id
    if (name) {
      const { data: existingSameName } = await supabaseAdmin
        .from('supplies')
        .select('id')
        .eq('clinic_id', clinicId)
        .ilike('name', name.trim())
        .limit(1);
      if (existingSameName && existingSameName.length > 0 && existingSameName[0].id !== params.id) {
        return NextResponse.json(
          { error: 'Duplicate name', message: 'Ya existe un insumo con ese nombre en esta clínica.' },
          { status: 409 }
        );
      }
    }

    // Build update object, only include inventory fields if provided
    const updateData: Record<string, unknown> = {
      name,
      category,
      presentation,
      price_cents,
      portions,
      updated_at: new Date().toISOString()
    };

    if (stock_quantity !== undefined) {
      updateData.stock_quantity = stock_quantity;
    }
    if (min_stock_alert !== undefined) {
      updateData.min_stock_alert = min_stock_alert;
    }

    const { data, error } = await supabaseAdmin
      .from('supplies')
      .update(updateData)
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
    const clinicContext = await resolveClinicContext({ cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;

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

    const { data: usage, error: usageError } = await supabaseAdmin
      .from('service_supplies')
      .select(`
        service_id,
        services:services!service_supplies_service_id_fkey (name)
      `)
      .eq('supply_id', params.id)
      .limit(5)

    if (usageError) {
      console.error('[supplies DELETE] Failed to check service dependencies:', usageError)
    } else if (usage && usage.length > 0) {
      const serviceNames = usage
        .map((row: any) => row.services?.name)
        .filter(Boolean)
      const nameList = serviceNames.slice(0, 3).join(', ')
      const moreCount = Math.max(0, serviceNames.length - 3)
      const message = serviceNames.length > 0
        ? `No puedes eliminar este insumo porque forma parte de ${serviceNames.length} servicio(s): ${nameList}${moreCount > 0 ? ` y ${moreCount} más` : ''}. Elimina primero el insumo de esos servicios.`
        : 'No puedes eliminar este insumo porque forma parte de uno o más servicios activos. Elimina primero el insumo de esos servicios.'
      return NextResponse.json(
        { error: 'supply_in_use', message },
        { status: 409 }
      )
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
