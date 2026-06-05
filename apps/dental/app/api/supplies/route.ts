import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zSupply } from '@/lib/zod';
import type { Supply, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { readJson } from '@/lib/validation';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { sendLowStockAlertPush } from '@/lib/notifications/product-push';
import { listConvexDocumentsByClinic, upsertConvexDocumentByLegacyId } from '@/lib/convex/server';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath, shouldWriteConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row;
  return rest;
}

function withCostPerPortion<T extends { price_cents?: number; portions?: number }>(supply: T) {
  return {
    ...supply,
    cost_per_portion_cents: supply.portions && supply.portions > 0
      ? Math.round((supply.price_cents || 0) / supply.portions)
      : 0,
  };
}

async function getSuppliesFromConvex(
  clinicId: string,
  options: { category?: string | null; search?: string | null; page?: number; limit?: number; paginate?: boolean }
) {
  const normalizedSearch = options.search?.trim().toLowerCase();
  let rows = await listConvexDocumentsByClinic('supplies', clinicId, 1000) as ImportedRecord[];

  if (options.category) {
    rows = rows.filter((row) => row.category === options.category);
  }

  if (normalizedSearch) {
    rows = rows.filter((row) => String(row.name || '').toLowerCase().includes(normalizedSearch));
  }

  rows = rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  if (options.paginate) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, options.limit || 100);
    rows = rows.slice((page - 1) * limit, page * limit);
  }

  return rows.map((row) => withCostPerPortion(normalizeConvexRecord(row)));
}

async function findConvexSupplyByName(clinicId: string, name: string) {
  const supplies = await getSuppliesFromConvex(clinicId, { search: name });
  return supplies.find((row: any) => String(row.name || '').trim().toLowerCase() === name.trim().toLowerCase()) ?? null;
}

async function createSupplyInConvex(row: Record<string, unknown>) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const document = {
    ...row,
    id,
    created_at: now,
    updated_at: now,
  };

  await upsertConvexDocumentByLegacyId('supplies', id, document);
  return withCostPerPortion(document as any);
}

async function mirrorSupplyToConvex(supply: Record<string, unknown>) {
  const id = supply.id;
  if (typeof id !== 'string') return;
  await upsertConvexDocumentByLegacyId('supplies', id, supply);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limitParam = searchParams.get('limit');
    // Default to no limit (or very high limit) to show all supplies in dropdowns
    // Only apply pagination if explicitly requested
    const limit = limitParam ? parseInt(limitParam) : 10000;
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'supplies.view');
    if (forbidden) return forbidden;

    if (shouldReturnConvexData('supplies')) {
      const data = await getSuppliesFromConvex(clinicId, {
        category,
        search,
        page,
        limit,
        paginate: Boolean(limitParam),
      });
      return NextResponse.json({ data } as ApiResponse<Supply[]>);
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

    // Apply pagination only if limit is explicitly provided
    if (limitParam) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data as Record<string, any>;

    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ requestedClinicId: body?.clinic_id, cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'supplies.create');
    if (forbidden) return forbidden;
    
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

    // Extract and validate inventory fields (optional, not in main zod schema)
    // Must be non-negative integers
    const rawStockQty = body.stock_quantity ?? 0;
    const rawMinAlert = body.min_stock_alert ?? 10;

    const stock_quantity = typeof rawStockQty === 'number' && Number.isInteger(rawStockQty) && rawStockQty >= 0
      ? rawStockQty
      : 0;
    const min_stock_alert = typeof rawMinAlert === 'number' && Number.isInteger(rawMinAlert) && rawMinAlert >= 0
      ? rawMinAlert
      : 10;

    if (shouldUseConvexOnlyWritePath('supplies')) {
      const existingByName = await findConvexSupplyByName(clinic_id, name);
      if (existingByName) {
        return NextResponse.json(
          { error: 'Duplicate name', message: 'Ya existe un insumo con ese nombre en esta clínica.' },
          { status: 409 }
        );
      }

      const data = await createSupplyInConvex({
        clinic_id,
        name,
        category,
        presentation,
        price_cents,
        portions,
        stock_quantity,
        min_stock_alert,
      });

      return NextResponse.json({
        data,
        message: 'Supply created successfully'
      } as ApiResponse<Supply>, { status: 201 });
    }

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
      .insert({
        clinic_id,
        name,
        category,
        presentation,
        price_cents,
        portions,
        stock_quantity,
        min_stock_alert
      })
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

    if (shouldWriteConvexData('supplies')) {
      try {
        await mirrorSupplyToConvex(data as Record<string, unknown>);
      } catch (convexError) {
        console.error('[supplies POST] Convex dual-write failed:', convexError);
      }
    }

    try {
      await sendLowStockAlertPush(request, clinicId, supplyWithCostPerPortion);
    } catch (pushError) {
      console.warn('[supplies POST] Failed to send low stock push notification:', pushError);
    }

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
