import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zService } from '@/lib/zod';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import type { Service, ServiceSupply, ApiResponse } from '@/lib/types';
import { readJson } from '@/lib/validation';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { getConvexDocumentByLegacyId, listConvexDocumentsByClinic, listConvexTable, upsertConvexDocumentByLegacyId, patchConvexDocumentByLegacyId, deleteConvexDocumentByLegacyId } from '@/lib/convex/server';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath, shouldWriteConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'

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
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

function byId(rows: ImportedRecord[]) {
  return new Map(
    rows.flatMap((row) => {
      const ids = [row.id, row.legacyId].filter(Boolean).map((id) => String(id))
      return ids.map((id) => [id, row] as const)
    })
  )
}

function calculateDiscountedPriceCents(originalPriceCents: number, discountType: string, discountValue: number) {
  if (discountType === 'percentage') {
    return Math.max(0, Math.round(originalPriceCents * (1 - discountValue / 100)))
  }
  if (discountType === 'fixed') {
    return Math.max(0, originalPriceCents - Math.round(discountValue * 100))
  }
  return originalPriceCents
}

async function listConvexServiceSupplies(serviceId: string) {
  const rows = await listConvexTable('service_supplies')
  return rows.filter((row: any) => row.service_id === serviceId || row.serviceId === serviceId)
}

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest, 
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'services.view');
    if (forbidden) return forbidden;

    if (shouldReturnConvexData('services')) {
      const service = await getConvexDocumentByLegacyId('services', params.id) as ImportedRecord | null
      if (!service || service.clinic_id !== clinicId) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      }

      const [serviceSupplies, supplies] = await Promise.all([
        listConvexServiceSupplies(params.id),
        listConvexDocumentsByClinic('supplies', clinicId),
      ])
      const suppliesById = byId(supplies as ImportedRecord[])
      const recipeRows = serviceSupplies.map((row: any) => ({
        ...normalizeConvexRecord(row),
        supplies: normalizeConvexRecord(row.supply_id ? suppliesById.get(String(row.supply_id)) : null),
      }))

      return NextResponse.json({
        data: {
          ...normalizeConvexRecord(service),
          supplies: recipeRows,
        }
      })
    }

    // Get service with its supplies
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
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
): Promise<NextResponse> {
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
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'services.edit');
    if (forbidden) return forbidden;
    
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

    const marginCandidate = toFiniteNumber(body.margin_pct) ?? 30;
    if (!Number.isFinite(marginCandidate) || marginCandidate < 0 || marginCandidate > MAX_MARGIN_PCT) {
      return NextResponse.json(
        { error: 'Validation failed', message: 'margin_pct must be between 0 and 999.99' },
        { status: 400 }
      );
    }
    const margin_pct = marginCandidate;

    const targetPricePesos = toFiniteNumber(body.target_price);
    if (targetPricePesos !== null && (targetPricePesos < 0 || targetPricePesos > MAX_TARGET_PRICE_PESOS)) {
      return NextResponse.json(
        { error: 'Validation failed', message: 'target_price is out of allowed range' },
        { status: 400 }
      );
    }

    const explicitOriginalPriceCents = toFiniteNumber(body.original_price_cents);
    if (
      explicitOriginalPriceCents !== null &&
      (explicitOriginalPriceCents < 0 || explicitOriginalPriceCents > MAX_ORIGINAL_PRICE_CENTS)
    ) {
      return NextResponse.json(
        { error: 'Validation failed', message: 'original_price_cents is out of allowed range' },
        { status: 400 }
      );
    }

    const discount_type = typeof body.discount_type === 'string' ? body.discount_type : 'none';
    if (!ALLOWED_DISCOUNT_TYPES.has(discount_type)) {
      return NextResponse.json(
        { error: 'Validation failed', message: 'discount_type must be one of: none, percentage, fixed' },
        { status: 400 }
      );
    }

    const discount_value = toFiniteNumber(body.discount_value) ?? 0;
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

    // FIX: Calculate original_price_cents (price BEFORE discount)
    // The trigger will automatically calculate price_cents from original_price_cents + discount
    // Priority:
    // 1. If target_price is provided (user's desired price), use it as original_price_cents
    // 2. If original_price_cents is provided explicitly, use it
    // 3. If price_cents is provided but no discount, use it as original_price_cents
    // 4. Otherwise, calculate from base_price + margin (for backwards compatibility)
    let original_price_cents: number;

    // Ignore zero/default target price to avoid forcing unintended zero-priced services.
    if (targetPricePesos !== null && targetPricePesos > 0) {
      // User specified a target price - this is the price BEFORE discount
      original_price_cents = Math.round(targetPricePesos * 100);
    } else if (explicitOriginalPriceCents !== null) {
      // Explicit original_price_cents provided
      original_price_cents = Math.round(explicitOriginalPriceCents);
    } else if (body.price_cents !== undefined && body.price_cents !== null) {
      // price_cents provided - if no discount, use as original; if discount exists, keep current original
      const hasDiscount = discount_type !== 'none';
      if (hasDiscount) {
        // Need to fetch current original_price_cents from DB
        let currentService: any = null
        if (shouldUseConvexOnlyWritePath('services')) {
          currentService = await getConvexDocumentByLegacyId('services', params.id)
        } else {
          const { data } = await supabaseAdmin
            .from('services')
            .select('original_price_cents')
            .eq('id', params.id)
            .single();
          currentService = data
        }
        original_price_cents = currentService?.original_price_cents || Math.round(body.price_cents || 0);
      } else {
        original_price_cents = Math.round(body.price_cents || 0);
      }
    } else if (body.base_price_cents !== undefined && body.base_price_cents !== null) {
      // Calculate from base cost + margin (fallback for old logic)
      const base_price = Math.round(body.base_price_cents || 0);
      original_price_cents = base_price > 0 ? Math.round(base_price * (1 + margin_pct / 100)) : 0;
    } else {
      // No price information provided, default to 0
      original_price_cents = 0;
    }
    if (original_price_cents < 0 || original_price_cents > MAX_ORIGINAL_PRICE_CENTS) {
      return NextResponse.json(
        { error: 'Validation failed', message: 'Calculated original price is out of allowed range' },
        { status: 400 }
      );
    }

    const price_cents = calculateDiscountedPriceCents(original_price_cents, discount_type, discount_value);

    if (shouldUseConvexOnlyWritePath('services')) {
      const current = await getConvexDocumentByLegacyId('services', params.id) as ImportedRecord | null
      if (!current || current.clinic_id !== clinicId) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      }

      const patch = {
        name,
        est_minutes,
        category,
        description,
        original_price_cents,
        price_cents,
        final_price_with_discount_cents: price_cents,
        margin_pct,
        discount_type,
        discount_value,
        discount_reason: body.discount_reason !== undefined && body.discount_reason !== null ? body.discount_reason : null,
        updated_at: new Date().toISOString()
      }

      await patchConvexDocumentByLegacyId('services', params.id, patch)

      if (supplies !== undefined) {
        const existingRows = await listConvexServiceSupplies(params.id)
        await Promise.all(
          existingRows.map((row: any) => {
            const rowId = String(row.id || row.legacyId || '')
            return rowId ? deleteConvexDocumentByLegacyId('service_supplies', rowId) : Promise.resolve()
          })
        )

        const serviceSuppliesPayload = normalizeSupplyList(supplies)
        await Promise.all(
          serviceSuppliesPayload.map((supply) => {
            const rowId = crypto.randomUUID()
            return upsertConvexDocumentByLegacyId('service_supplies', rowId, {
              id: rowId,
              clinic_id: clinicId,
              service_id: params.id,
              supply_id: supply.supply_id,
              qty: supply.qty,
              created_at: new Date().toISOString(),
            })
          })
        )
      }

      return NextResponse.json({
        data: {
          ...normalizeConvexRecord(current),
          ...patch,
        },
        message: 'Service updated successfully'
      })
    }

    // Note: price_cents will be calculated by the trigger from original_price_cents + discount

    const { data, error } = await supabaseAdmin
      .from('services')
      .update({
        name,
        est_minutes,
        category,
        description,
        // FIX: Send original_price_cents instead of price_cents
        // The trigger will calculate price_cents from original_price_cents + discount
        original_price_cents,
        margin_pct,
        // FIX BUG 3: Always update discount fields to allow removal
        discount_type,
        discount_value,
        discount_reason: body.discount_reason !== undefined && body.discount_reason !== null ? body.discount_reason : null,
        // Note: price_cents and final_price_with_discount_cents are auto-calculated by trigger
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
      if (error.code === '22003') {
        return NextResponse.json(
          {
            error: 'numeric_overflow',
            message: 'Uno de los valores numéricos excede el límite permitido (precio, margen o descuento).'
          },
          { status: 400 }
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

    if (data && shouldWriteConvexData('services')) {
      try {
        await upsertConvexDocumentByLegacyId('services', data.id, data as Record<string, unknown>)
      } catch (convexError) {
        console.error('[services PUT] Convex mirror failed:', convexError)
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
): Promise<NextResponse> {
  try {
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'services.delete');
    if (forbidden) return forbidden;

    // Check dependencies before deleting
    const dependencyMessages: string[] = []

    try {
      let treatmentUsage: any[] | null = null
      let treatmentError: { message?: string } | null = null

      if (shouldUseConvexOnlyWritePath('services')) {
        const treatments = await listConvexDocumentsByClinic('treatments', clinicId)
        treatmentUsage = treatments
          .filter((row: any) => row.service_id === params.id || row.serviceId === params.id)
          .slice(0, 5)
      } else {
        const result = await supabaseAdmin
          .from('treatments')
          .select('id, patient_id')
          .eq('clinic_id', clinicId)
          .eq('service_id', params.id)
          .limit(5)
        treatmentUsage = result.data
        treatmentError = result.error
      }

      if (treatmentError) {
        console.error('[services DELETE] treatment usage lookup failed:', treatmentError)
      } else if (treatmentUsage && treatmentUsage.length > 0) {
        const patientIds = Array.from(new Set(
          treatmentUsage.map((row: any) => row.patient_id).filter(Boolean)
        ))
        const patientNamesById = new Map<string, string>()

        if (patientIds.length > 0) {
          let patients: any[] | null = null
          let patientError: { message?: string } | null = null

          if (shouldUseConvexOnlyWritePath('services')) {
            const allPatients = await listConvexDocumentsByClinic('patients', clinicId)
            patients = allPatients.filter((patient: any) => patientIds.includes(String(patient.id || patient.legacyId || '')))
          } else {
            const result = await supabaseAdmin
              .from('patients')
              .select('id, first_name, last_name')
              .eq('clinic_id', clinicId)
              .in('id', patientIds)
            patients = result.data
            patientError = result.error
          }

          if (patientError) {
            console.error('[services DELETE] patient usage lookup failed:', patientError)
          } else {
            for (const patient of patients || []) {
              const first = patient.first_name?.trim() || ''
              const last = patient.last_name?.trim() || ''
              const full = `${first} ${last}`.trim()
              if (full) patientNamesById.set(patient.id, full)
            }
          }
        }

        const patientNames = treatmentUsage
          .map((row: any) => patientNamesById.get(row.patient_id))
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

    // Tariff dependency check removed - discounts are now part of services table

    if (dependencyMessages.length > 0) {
      return NextResponse.json(
        {
          error: 'service_in_use',
          message: `No puedes eliminar este servicio porque está en uso. ${dependencyMessages.join(' ')}`
        },
        { status: 409 }
      )
    }

    if (shouldUseConvexOnlyWritePath('services')) {
      const current = await getConvexDocumentByLegacyId('services', params.id) as ImportedRecord | null
      if (!current || current.clinic_id !== clinicId) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      }

      const recipeRows = await listConvexServiceSupplies(params.id)
      await Promise.all(
        recipeRows.map((row: any) => {
          const rowId = String(row.id || row.legacyId || '')
          return rowId ? deleteConvexDocumentByLegacyId('service_supplies', rowId) : Promise.resolve()
        })
      )
      await deleteConvexDocumentByLegacyId('services', params.id)

      return NextResponse.json({
        data: null,
        message: 'Service deleted successfully'
      })
    }

    // Hard delete - eliminar físicamente de la base de datos
    // (solo llega aquí si no tiene tratamientos ni tarifas asociadas)
    const { error: deleteError } = await supabaseAdmin
      .from('services')
      .delete()
      .eq('id', params.id)
      .eq('clinic_id', clinicId);

    if (deleteError) {
      console.error('Error deleting service:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete service', message: deleteError.message },
        { status: 500 }
      );
    }

    if (shouldWriteConvexData('services')) {
      try {
        const recipeRows = await listConvexServiceSupplies(params.id)
        await Promise.all(
          recipeRows.map((row: any) => {
            const rowId = String(row.id || row.legacyId || '')
            return rowId ? deleteConvexDocumentByLegacyId('service_supplies', rowId) : Promise.resolve()
          })
        )
        await deleteConvexDocumentByLegacyId('services', params.id)
      } catch (convexError) {
        console.error('[services DELETE] Convex mirror failed:', convexError)
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
