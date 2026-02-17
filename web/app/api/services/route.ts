import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { z } from 'zod';
import { withRouteContext } from '@/lib/api/route-handler';
import { createRouteLogger } from '@/lib/api/logger';
import { readJsonBody } from '@/lib/api/validation';

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
  base_price_cents: z.coerce.number().int().nonnegative().optional(),
  margin_pct: z.coerce.number().nonnegative().max(999.99, 'margin_pct must be <= 999.99').optional(),
  supplies: z.array(serviceSupplySchema).optional(),
});

type ServiceRequestBody = {
  clinic_id?: string
  margin_pct?: number
  target_price?: number
  original_price_cents?: number
  discount_type?: string
  discount_value?: number
  discount_reason?: string | null
  [key: string]: unknown
}

const MAX_MARGIN_PCT = 999.99
const MAX_TARGET_PRICE_PESOS = Number.MAX_SAFE_INTEGER / 100
// Keep compatibility with legacy DBs where some service price fields may still be INTEGER.
const MAX_ORIGINAL_PRICE_CENTS = 2_147_483_647
const MAX_DISCOUNT_VALUE = 99_999_999.99
const ALLOWED_DISCOUNT_TYPES = new Set(['none', 'percentage', 'fixed'])

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

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
  return withRouteContext(request, async ({ requestId }) => {
    const logger = createRouteLogger(requestId);

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
        // Use correct field names from settings_time table schema
        const workDays = timeSettings.work_days || 20;
        const hoursPerDay = timeSettings.hours_per_day || 7;
        const rawRealPct = timeSettings.real_pct ?? 0.8;
        // DB stores as decimal (0-1), so if value <= 1, use as-is; otherwise convert from percentage
        const realPctFactor = rawRealPct <= 1 ? rawRealPct : rawRealPct / 100;

        const minutesMonth = workDays * hoursPerDay * 60;
        const effectiveMinutes = minutesMonth * realPctFactor;

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
        .order('name', { ascending: true });

      // Apply search filter
      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('services.get.query_failed', { error: error.message });
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
      logger.error('services.get.unexpected_error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withRouteContext(request, async ({ requestId }) => {
    const logger = createRouteLogger(requestId);

    try {
      const bodyResult = await readJsonBody<ServiceRequestBody>(request);
      if ('error' in bodyResult) {
        return bodyResult.error;
      }
      const rawBody = bodyResult.data;
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

      const marginCandidate = parseResult.data.margin_pct ?? toFiniteNumber(rawBody.margin_pct) ?? 30
      if (!Number.isFinite(marginCandidate) || marginCandidate < 0 || marginCandidate > MAX_MARGIN_PCT) {
        return NextResponse.json(
          { error: 'Validation failed', message: 'margin_pct must be between 0 and 999.99' },
          { status: 400 }
        );
      }
      const margin_pct = marginCandidate;

      const targetPricePesos = toFiniteNumber(rawBody.target_price);
      if (targetPricePesos !== null && (targetPricePesos < 0 || targetPricePesos > MAX_TARGET_PRICE_PESOS)) {
        return NextResponse.json(
          { error: 'Validation failed', message: 'target_price is out of allowed range' },
          { status: 400 }
        );
      }

      const explicitOriginalPriceCents = toFiniteNumber(rawBody.original_price_cents);
      if (
        explicitOriginalPriceCents !== null &&
        (explicitOriginalPriceCents < 0 || explicitOriginalPriceCents > MAX_ORIGINAL_PRICE_CENTS)
      ) {
        return NextResponse.json(
          { error: 'Validation failed', message: 'original_price_cents is out of allowed range' },
          { status: 400 }
        );
      }

      const discount_type = typeof rawBody.discount_type === 'string' ? rawBody.discount_type : 'none';
      if (!ALLOWED_DISCOUNT_TYPES.has(discount_type)) {
        return NextResponse.json(
          { error: 'Validation failed', message: 'discount_type must be one of: none, percentage, fixed' },
          { status: 400 }
        );
      }

      const discount_value = toFiniteNumber(rawBody.discount_value) ?? 0;
      if (!Number.isFinite(discount_value) || discount_value < 0 || discount_value > MAX_DISCOUNT_VALUE) {
        return NextResponse.json(
          { error: 'Validation failed', message: 'discount_value is out of allowed range' },
          { status: 400 }
        );
      }
      if (discount_type === 'percentage' && discount_value > 100) {
        return NextResponse.json(
          { error: 'Validation failed', message: 'discount_value cannot exceed 100 for percentage discounts' },
          { status: 400 }
        );
      }

      // Calculate original_price_cents (price BEFORE discount)
      // base_price_cents already includes fixed costs (time-based) + variable costs (supplies)
      // Now we apply the margin to get the sale price
      // Priority: target_price > original_price_cents > calculated from base + margin
      let original_price_cents: number;

      // Ignore zero/default target price to avoid forcing an unintended zero-priced service.
      if (targetPricePesos !== null && targetPricePesos > 0) {
        // User specified a target price directly
        original_price_cents = Math.round(targetPricePesos * 100);
      } else if (explicitOriginalPriceCents !== null) {
        // Explicit original_price_cents provided
        original_price_cents = Math.round(explicitOriginalPriceCents);
      } else {
        // Calculate from base cost + margin
        const base_price = Math.round(base_price_cents || 0);
        original_price_cents = base_price > 0 ? Math.round(base_price * (1 + margin_pct / 100)) : 0;
      }
      if (original_price_cents < 0 || original_price_cents > MAX_ORIGINAL_PRICE_CENTS) {
        return NextResponse.json(
          { error: 'Validation failed', message: 'Calculated original price is out of allowed range' },
          { status: 400 }
        );
      }

      // Create the service with new fields (including discount fields)
      // Note: The trigger will calculate price_cents from original_price_cents + discount
      const { data: serviceData, error: serviceError} = await supabaseAdmin
        .from('services')
        .insert({
          clinic_id: clinicId,
          name,
          category,
          est_minutes,
          description: description ?? null,
          original_price_cents,            // Save original price (before discount)
          margin_pct: margin_pct,          // Save margin for reference
          // Discount fields (optional, default to none)
          discount_type,
          discount_value,
          discount_reason: rawBody.discount_reason || null
          // Note: price_cents and final_price_with_discount_cents are auto-calculated by trigger
        })
        .select()
        .single();

      if (serviceError) {
        logger.error('services.post.create_failed', { error: serviceError.message });

        // Check for duplicate service name
        if (serviceError.code === '23505' && serviceError.message.includes('services_clinic_id_name_key')) {
          return NextResponse.json(
            { error: 'duplicate_service_name', message: 'Ya existe un servicio con ese nombre. Por favor, usa un nombre diferente.' },
            { status: 409 }
          );
        }
        if (serviceError.code === '22003') {
          return NextResponse.json(
            {
              error: 'numeric_overflow',
              message: 'Uno de los valores numéricos excede el límite permitido (precio, margen o descuento).'
            },
            { status: 400 }
          );
        }

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
          logger.error('services.post.supplies_attach_failed', { error: suppliesError.message });
          // Consider rolling back the service creation here
        }
      }

      return NextResponse.json({
        data: serviceData,
        message: 'Service created successfully'
      }, { status: 201 });

    } catch (error) {
      logger.error('services.post.unexpected_error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
