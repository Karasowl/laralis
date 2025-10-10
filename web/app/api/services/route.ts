import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { z } from 'zod';
// import { createSupabaseClient } from '@/lib/supabase';

const serviceSupplySchema = z.object({
  supply_id: z.string().min(1, 'supply_id is required'),
  qty: z.coerce.number().int().positive('qty must be positive').optional(),
  quantity: z.coerce.number().int().positive('quantity must be positive').optional(),
});

const serviceSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  category: z.string().trim().min(1).optional().default('otros'),
  est_minutes: z.coerce.number().int().positive('est_minutes must be positive'),
  description: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  supplies: z.array(serviceSupplySchema).optional(),
});

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;

    // Get services with their supplies relationship
    // Using explicit relationship hint to avoid ambiguity
    let query = supabaseAdmin
      .from('services')
      .select(`
        *,
        service_supplies!service_supplies_service_id_fkey (
          id,
          supply_id,
          qty,
          supplies!service_supplies_supply_id_fkey (
            id,
            name,
            price_cents,
            portions
          )
        )
      `)
      .eq('clinic_id', clinicId)
      .order('name', { ascending: true });

    // Apply search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching services:', error);
      return NextResponse.json(
        { error: 'Failed to fetch services', message: error.message },
        { status: 500 }
      );
    }

    // Calculate variable cost for each service
    const servicesWithCost = (data || []).map(service => {
      const variableCostCents = service.service_supplies?.reduce((total: number, ss: any) => {
        const supply = ss?.supplies;
        const qty = Number(ss?.qty) || 0;
        const price = Number(supply?.price_cents) || 0;
        const portions = Number(supply?.portions) || 0;
        if (supply && portions > 0 && qty > 0) {
          const costPerPortion = price / portions;
          return total + Math.round(costPerPortion * qty);
        }
        return total;
      }, 0) || 0;

      return {
        ...service,
        variable_cost_cents: Math.round(variableCostCents)
      };
    });

    return NextResponse.json(servicesWithCost);
  } catch (error) {
    console.error('Unexpected error in GET /api/services:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parseResult = serviceSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const message = parseResult.error.errors.map((err) => err.message).join(', ');
      return NextResponse.json(
        {
          error: 'Validation failed',
          message,
        },
        { status: 400 }
      );
    }

    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ requestedClinicId: rawBody?.clinic_id, cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId } = clinicContext;
    
    const { supplies, name, category, est_minutes, description } = parseResult.data;

    // Calculate initial price (can be updated later in tariffs)
    // For now, use a default calculation based on time and a standard margin
    const minuteRate = 1000; // Default rate per minute in cents (10 pesos)
    const basePrice = est_minutes * minuteRate;
    const defaultMargin = 1.6; // 60% margin
    const price_cents = Math.round(basePrice * defaultMargin);

    // Create the service with new fields
    const { data: serviceData, error: serviceError } = await supabaseAdmin
      .from('services')
      .insert({ 
        clinic_id: clinicId,
        name,
        category,
        est_minutes,
        description: description ?? null,
        price_cents: price_cents,
        is_active: true
      })
      .select()
      .single();

    if (serviceError) {
      console.error('Error creating service:', serviceError);
      return NextResponse.json(
        { error: 'Failed to create service', message: serviceError.message },
        { status: 500 }
      );
    }

    const serviceSuppliesPayload = normalizeSupplyList(supplies)

    if (serviceSuppliesPayload.length > 0) {
      const serviceSupplies = serviceSuppliesPayload.map((supply) => ({
        service_id: serviceData.id,
        supply_id: supply.supply_id,
        qty: supply.qty
      }))

      const { error: suppliesError } = await supabaseAdmin
        .from('service_supplies')
        .insert(serviceSupplies)

      if (suppliesError) {
        console.error('Error adding supplies to service:', suppliesError)
        // Consider rolling back the service creation here
      }
    }

    return NextResponse.json({ 
      data: serviceData,
      message: 'Service created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in POST /api/services:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
