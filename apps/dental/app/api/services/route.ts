import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { z } from 'zod';
import { withRouteContext } from '@/lib/api/route-handler';
import { createRouteLogger } from '@/lib/api/logger';
import { readJsonBody } from '@/lib/api/validation';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { listConvexDocumentsByClinic, listConvexTable, upsertConvexDocumentByLegacyId } from '@/lib/convex/server';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath, shouldWriteConvexData } from '@/lib/data-backend';

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

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null;
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row;
  return rest;
}

function byId(rows: ImportedRecord[]) {
  return new Map(
    rows.flatMap((row) => {
      const ids = [row.id, row.legacyId].filter(Boolean).map((id) => String(id));
      return ids.map((id) => [id, row] as const);
    })
  );
}

function calculateFixedCostPerMinute(
  timeSettings: ImportedRecord | null | undefined,
  fixedCosts: ImportedRecord[],
  assets: ImportedRecord[]
) {
  const totalFixedCostsCents = fixedCosts.reduce((sum, cost) => sum + (Number(cost.amount_cents) || 0), 0);
  const totalDepreciationCents = assets.reduce((sum, asset) => {
    const months = Number(asset.depreciation_months) || 1;
    return sum + Math.round((Number(asset.purchase_price_cents) || 0) / months);
  }, 0);
  const monthlyFixedCostsCents = totalFixedCostsCents + totalDepreciationCents;

  if (!timeSettings) return 0;
  const workDays = Number(timeSettings.work_days) || 20;
  const hoursPerDay = Number(timeSettings.hours_per_day) || 7;
  const rawRealPct = Number(timeSettings.real_pct ?? 0.8);
  const realPctFactor = rawRealPct <= 1 ? rawRealPct : rawRealPct / 100;
  const effectiveMinutes = workDays * hoursPerDay * 60 * realPctFactor;
  return effectiveMinutes > 0 && monthlyFixedCostsCents > 0
    ? Math.round(monthlyFixedCostsCents / effectiveMinutes)
    : 0;
}

async function getServicesFromConvex(clinicId: string, search: string | null) {
  const [
    timeRows,
    fixedCosts,
    assets,
    services,
    serviceSupplies,
    supplies,
  ] = await Promise.all([
    listConvexDocumentsByClinic('settings_time', clinicId, 10) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('fixed_costs', clinicId, 1000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('assets', clinicId, 1000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('services', clinicId, 1000) as Promise<ImportedRecord[]>,
    listConvexTable('service_supplies', 5000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('supplies', clinicId, 1000) as Promise<ImportedRecord[]>,
  ]);

  const fixedCostPerMinuteCents = calculateFixedCostPerMinute(timeRows[0], fixedCosts, assets);
  const suppliesById = byId(supplies);
  const normalizedSearch = search?.trim().toLowerCase();

  return services
    .filter((service) => {
      if (!normalizedSearch) return true;
      return String(service.name || '').toLowerCase().includes(normalizedSearch);
    })
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .map((service) => {
      const serviceId = String(service.id || service.legacyId || '');
      const recipeRows = serviceSupplies
        .filter((row) => row.service_id === serviceId || row.serviceId === serviceId)
        .map((row) => {
          const supply = row.supply_id ? suppliesById.get(String(row.supply_id)) : null;
          return {
            ...normalizeConvexRecord(row),
            supplies: normalizeConvexRecord(supply),
          };
        });
      const variableCostCents = recipeRows.reduce((total, row: any) => {
        const supply = row.supplies;
        const qty = Number(row.qty) || 0;
        const price = Number(supply?.price_cents) || 0;
        const portions = Number(supply?.portions) || 0;
        if (supply && portions > 0 && qty > 0) {
          return total + Math.round((price / portions) * qty);
        }
        return total;
      }, 0);
      const estMinutes = Number(service.est_minutes) || 0;
      const fixedCostCents = Math.round(estMinutes * fixedCostPerMinuteCents);

      return {
        ...normalizeConvexRecord(service),
        service_supplies: recipeRows,
        fixed_cost_cents: fixedCostCents,
        variable_cost_cents: Math.round(variableCostCents),
        total_cost_cents: fixedCostCents + Math.round(variableCostCents),
      };
    });
}

async function findConvexServiceNameConflict(clinicId: string, name: string) {
  const services = await getServicesFromConvex(clinicId, name);
  return services.find((service: any) => String(service.name || '').trim().toLowerCase() === name.trim().toLowerCase()) ?? null;
}

function calculateDiscountedPriceCents(originalPriceCents: number, discountType: string, discountValue: number) {
  if (discountType === 'percentage') {
    return Math.max(0, Math.round(originalPriceCents * (1 - discountValue / 100)));
  }
  if (discountType === 'fixed') {
    return Math.max(0, originalPriceCents - Math.round(discountValue * 100));
  }
  return originalPriceCents;
}

async function createServiceInConvex(
  clinicId: string,
  service: Record<string, unknown>,
  serviceSuppliesPayload: Array<{ supply_id: string; qty: number }>
) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const serviceDocument = {
    ...service,
    id,
    clinic_id: clinicId,
    created_at: now,
    updated_at: now,
  };
  await upsertConvexDocumentByLegacyId('services', id, serviceDocument);

  for (const supply of serviceSuppliesPayload) {
    const rowId = crypto.randomUUID();
    await upsertConvexDocumentByLegacyId('service_supplies', rowId, {
      id: rowId,
      clinic_id: clinicId,
      service_id: id,
      supply_id: supply.supply_id,
      qty: supply.qty,
      created_at: now,
    });
  }

  return serviceDocument;
}

async function mirrorServiceToConvex(
  logger: ReturnType<typeof createRouteLogger>,
  service: Record<string, unknown>,
  serviceSupplies: Record<string, unknown>[]
) {
  const id = service.id;
  if (typeof id !== 'string') return;

  try {
    await upsertConvexDocumentByLegacyId('services', id, service);
    for (const row of serviceSupplies) {
      const rowId = row.id;
      if (typeof rowId === 'string') {
        await upsertConvexDocumentByLegacyId('service_supplies', rowId, row);
      }
    }
  } catch (error) {
    logger.error('services.dual_write.convex_failed', {
      serviceId: id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
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
      const { clinicId, userId } = clinicContext;
      const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'services.view');
      if (forbidden) return forbidden;

      if (shouldReturnConvexData('services')) {
        const servicesWithCost = await getServicesFromConvex(clinicId, search);
        return NextResponse.json(servicesWithCost);
      }

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
      const { clinicId, userId } = clinicContext;
      const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'services.create');
      if (forbidden) return forbidden;

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

      const serviceSuppliesPayload = normalizeSupplyList(supplies)
      const price_cents = calculateDiscountedPriceCents(original_price_cents, discount_type, discount_value);

      if (shouldUseConvexOnlyWritePath('services')) {
        const existingService = await findConvexServiceNameConflict(clinicId, name);
        if (existingService) {
          return NextResponse.json(
            { error: 'duplicate_service_name', message: 'Ya existe un servicio con ese nombre. Por favor, usa un nombre diferente.' },
            { status: 409 }
          );
        }

        const serviceData = await createServiceInConvex(
          clinicId,
          {
            name,
            category,
            est_minutes,
            description: description ?? null,
            original_price_cents,
            price_cents,
            final_price_with_discount_cents: price_cents,
            margin_pct,
            discount_type,
            discount_value,
            discount_reason: rawBody.discount_reason || null,
          },
          serviceSuppliesPayload
        );

        return NextResponse.json({
          data: serviceData,
          message: 'Service created successfully'
        }, { status: 201 });
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

      let createdServiceSupplies: Record<string, unknown>[] = []

      if (serviceSuppliesPayload.length > 0) {
        const serviceSupplies = serviceSuppliesPayload.map((supply) => ({
          service_id: serviceData.id,
          supply_id: supply.supply_id,
          qty: supply.qty
        }))

        const { data: insertedServiceSupplies, error: suppliesError } = await supabaseAdmin
          .from('service_supplies')
          .insert(serviceSupplies)
          .select()

        if (suppliesError) {
          logger.error('services.post.supplies_attach_failed', { error: suppliesError.message });
          // Consider rolling back the service creation here
        } else {
          createdServiceSupplies = (insertedServiceSupplies || []) as Record<string, unknown>[]
        }
      }

      if (serviceData && shouldWriteConvexData('services')) {
        await mirrorServiceToConvex(logger, serviceData as Record<string, unknown>, createdServiceSupplies);
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
