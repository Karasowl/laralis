import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { z } from 'zod';

export const dynamic = 'force-dynamic'

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

    // Get time settings to calculate fixed costs
    const { data: timeSettings } = await supabaseAdmin
      .from('settings_time')
      .select('*')
      .eq('clinic_id', clinicId)
      .single();

    // Get fixed costs
    const { data: fixedCosts } = await supabaseAdmin
      .from('fixed_costs')
      .select('amount_cents')
      .eq('clinic_id', clinicId);

    // Get assets depreciation
    const { data: assets } = await supabaseAdmin
      .from('assets')
      .select('purchase_price_cents, depreciation_months')
      .eq('clinic_id', clinicId);

    // Calculate total fixed costs per month
    const totalFixedCostsCents = (fixedCosts || []).reduce((sum, cost) =>
      sum + (cost.amount_cents || 0), 0
    );

    const totalDepreciationCents = (assets || []).reduce((sum, asset) => {
      const months = asset.depreciation_months || 1;
      return sum + Math.round((asset.purchase_price_cents || 0) / months);
    }, 0);

    const monthlyFixedCostsCents = totalFixedCostsCents + totalDepreciationCents;

    // Calculate fixed cost per minute
    let fixedCostPerMinuteCents = 0;
    if (timeSettings) {
      const workDays = timeSettings.work_days || 0;
      const hoursPerDay = timeSettings.hours_per_day || 0;
      const realPct = timeSettings.real_pct || 0;
      const minutesMonth = workDays * hoursPerDay * 60;
      const effectiveMinutes = minutesMonth * realPct;

      if (effectiveMinutes > 0 && monthlyFixedCostsCents > 0) {
        fixedCostPerMinuteCents = Math.round(monthlyFixedCostsCents / effectiveMinutes);
      }
    }

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
      .eq('is_active', true)  // Only fetch active services (not soft-deleted)
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

    // Calculate variable and fixed costs for each service
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

      const estMinutes = service.est_minutes || 0;
      const fixedCostCents = Math.round(estMinutes * fixedCostPerMinuteCents);

      return {
        ...service,
        fixed_cost_cents: fixedCostCents,
        variable_cost_cents: Math.round(variableCostCents),
        total_cost_cents: fixedCostCents + Math.round(variableCostCents)
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
    
    const { supplies, name, category, est_minutes, description, base_price_cents } = parseResult.data;

    // Get margin percentage from body, default to 30%
    const margin_pct = typeof rawBody.margin_pct === 'number' ? rawBody.margin_pct : 30;

    // Calculate price WITH margin
    // base_price_cents already includes fixed costs (time-based) + variable costs (supplies)
    // Now we apply the margin to get the final sale price
    const base_price = Math.round(base_price_cents || 0);
    const price_with_margin = base_price > 0 ? Math.round(base_price * (1 + margin_pct / 100)) : 0;

    // Create the service with new fields
    const { data: serviceData, error: serviceError } = await supabaseAdmin
      .from('services')
      .insert({
        clinic_id: clinicId,
        name,
        category,
        est_minutes,
        description: description ?? null,
        price_cents: price_with_margin,  // Save sale price (with margin)
        margin_pct: margin_pct,           // Save margin for reference
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
