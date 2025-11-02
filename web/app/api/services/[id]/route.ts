import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zService } from '@/lib/zod';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import type { Service, ServiceSupply, ApiResponse } from '@/lib/types';

export const dynamic = 'force-dynamic'


const normalizeSupplyList = (supplies?: Array<{ supply_id?: string; qty?: number | null; quantity?: number | null }>) => {
  if (!Array.isArray(supplies)) return [] as Array<{ supply_id: string; qty: number }>

  const merged = new Map<string, number>()

  for (const item of supplies) {
    if (!item) continue
    const supplyId = typeof item.supply_id === 'string' && item.supply_id.trim().length > 0
      ? item.supply_id.trim()
      : null
    if (!supplyId) continue

    const rawQty = item.qty ?? item.quantity ?? 0
    const qty = Number(rawQty)
    if (!Number.isFinite(qty) || qty <= 0) continue

    const current = merged.get(supplyId) || 0
    merged.set(supplyId, current + Math.round(qty))
  }

  return Array.from(merged.entries()).map(([supply_id, qty]) => ({ supply_id, qty }))
}

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest, 
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Service & { supplies?: ServiceSupply[] }>>> {
  try {
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;

    // Get service with its supplies
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .eq('is_active', true)  // Only fetch active services (not soft-deleted)
      .single();

    if (serviceError) {
      if (serviceError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        );
      }
      
      console.error('Error fetching service:', serviceError);
      return NextResponse.json(
        { error: 'Failed to fetch service', message: serviceError.message },
        { status: 500 }
      );
    }

    // Get service supplies with supply details (disambiguated relationship)
    const { data: supplies, error: suppliesError } = await supabaseAdmin
      .from('service_supplies')
      .select('*, supplies!service_supplies_supply_id_fkey(*)')
      .eq('service_id', params.id);

    if (suppliesError) {
      console.error('Error fetching service supplies:', suppliesError);
    }

    return NextResponse.json({ 
      data: {
        ...service,
        supplies: supplies || []
      }
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/services/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest, 
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Service>>> {
  try {
    const body = await request.json();
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ requestedClinicId: body?.clinic_id, cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;
    
    // Extract supplies if provided
    const { supplies, ...serviceData } = body;
    
    // Add clinic_id to body for validation
    const dataWithClinic = { ...serviceData, clinic_id: clinicId };
    
    // Validate request body
    const validationResult = zService.safeParse(dataWithClinic);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          message: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    const { name, est_minutes } = validationResult.data;
    const category = body.category || 'otros';
    const description = body.description || null;

    // Get margin percentage, default to 30%
    const margin_pct = typeof body.margin_pct === 'number' ? body.margin_pct : 30;

    // Calculate price WITH margin
    // If base_price_cents is provided, use it and apply margin
    // Otherwise fall back to price_cents (backwards compatibility)
    let price_cents;
    if (body.base_price_cents) {
      const base_price = Math.round(body.base_price_cents);
      price_cents = Math.round(base_price * (1 + margin_pct / 100));
    } else {
      price_cents = Math.round(body.price_cents || 0);
    }

    const { data, error } = await supabaseAdmin
      .from('services')
      .update({
        name,
        est_minutes,
        category,
        description,
        price_cents,
        margin_pct,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        );
      }
      
      console.error('Error updating service:', error);
      return NextResponse.json(
        { error: 'Failed to update service', message: error.message },
        { status: 500 }
      );
    }

    // If supplies are provided, update them
    if (supplies !== undefined) {
      // Delete existing supplies
      await supabaseAdmin
        .from('service_supplies')
        .delete()
        .eq('service_id', params.id);

      const serviceSuppliesPayload = normalizeSupplyList(supplies)

      // Add new supplies if any
      if (serviceSuppliesPayload.length > 0) {
        const serviceSupplies = serviceSuppliesPayload.map((supply: any) => ({
          service_id: params.id,
          supply_id: supply.supply_id,
          qty: supply.qty
        }));

        const { error: suppliesError } = await supabaseAdmin
          .from('service_supplies')
          .insert(serviceSupplies);

        if (suppliesError) {
          console.error('Error updating service supplies:', suppliesError);
        }
      }
    }

    return NextResponse.json({ 
      data,
      message: 'Service updated successfully'
    });

  } catch (error) {
    console.error('Unexpected error in PUT /api/services/[id]:', error);
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

    // Check dependencies before deleting
    const dependencyMessages: string[] = []

    try {
      const { data: treatmentUsage, error: treatmentError } = await supabaseAdmin
        .from('treatments')
        .select(
          'id, treatment_date, patients:patients!treatments_patient_id_fkey (first_name, last_name)'
        )
        .eq('clinic_id', clinicId)
        .eq('service_id', params.id)
        .limit(5)

      if (treatmentError) {
        console.error('[services DELETE] treatment usage lookup failed:', treatmentError)
      } else if (treatmentUsage && treatmentUsage.length > 0) {
        const patientNames = treatmentUsage
          .map((row: any) => {
            const patient = row?.patients
            if (!patient) return null
            const first = patient.first_name?.trim() || ''
            const last = patient.last_name?.trim() || ''
            const full = `${first} ${last}`.trim()
            return full || null
          })
          .filter(Boolean) as string[]
        const listed = patientNames.slice(0, 3).join(', ')
        const remaining = Math.max(0, patientNames.length - 3)
        dependencyMessages.push(
          patientNames.length > 0
            ? `Tiene ${patientNames.length} tratamiento(s) registrados: ${listed}${remaining > 0 ? ` y ${remaining} más` : ''}.`
            : 'Tiene tratamientos registrados.'
        )
      }
    } catch (err) {
      console.error('[services DELETE] treatment usage unexpected error:', err)
    }

    try {
      const { data: tariffUsage, error: tariffError } = await supabaseAdmin
        .from('tariffs')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('service_id', params.id)
        .limit(1)

      if (tariffError) {
        console.error('[services DELETE] tariff usage lookup failed:', tariffError)
      } else if (tariffUsage && tariffUsage.length > 0) {
        dependencyMessages.push('Tiene tarifas activas asociadas.')
      }
    } catch (err) {
      console.error('[services DELETE] tariff usage unexpected error:', err)
    }

    if (dependencyMessages.length > 0) {
      return NextResponse.json(
        {
          error: 'service_in_use',
          message: `No puedes eliminar este servicio porque está en uso. ${dependencyMessages.join(' ')}`
        },
        { status: 409 }
      )
    }

    // Soft delete - marcar como inactivo; si la columna no existe, borrar duro
    let result = await supabaseAdmin
      .from('services')
      .update({ is_active: false })
      .eq('id', params.id)
      .eq('clinic_id', clinicId);

    if (result.error) {
      const msg = result.error.message || '';
      const missingCol = /column .*is_active.* does not exist/i.test(msg);
      if (missingCol) {
        // Fallback: eliminar registro
        const hard = await supabaseAdmin
          .from('services')
          .delete()
          .eq('id', params.id)
          .eq('clinic_id', clinicId);
        if (hard.error) {
          console.error('Error hard-deleting service:', hard.error);
          return NextResponse.json(
            { error: 'Failed to delete service', message: hard.error.message },
            { status: 500 }
          );
        }
      } else {
        console.error('Error soft-deleting service:', result.error);
        return NextResponse.json(
          { error: 'Failed to delete service', message: result.error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ 
      data: null,
      message: 'Service deleted successfully'
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/services/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
