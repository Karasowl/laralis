import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zServiceSupply } from '@/lib/zod';
import type { ServiceSupply, Supply, ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { readJson } from '@/lib/validation';
import { getConvexDocumentByLegacyId, listConvexDocumentsByClinic, listConvexTable, upsertConvexDocumentByLegacyId, deleteConvexDocumentByLegacyId } from '@/lib/convex/server';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath, shouldWriteConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'


interface RouteParams {
  params: {
    id: string;
  };
}

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row
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

async function listConvexServiceSupplies(serviceId: string) {
  const rows = await listConvexTable('service_supplies')
  return rows.filter((row: any) => row.service_id === serviceId || row.serviceId === serviceId)
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

      const [recipeRows, supplies] = await Promise.all([
        listConvexServiceSupplies(params.id),
        listConvexDocumentsByClinic('supplies', clinicId),
      ])
      const suppliesById = byId(supplies as ImportedRecord[])
      const transformedData = recipeRows.map((item: any) => {
        const supply = item.supply_id ? normalizeConvexRecord(suppliesById.get(String(item.supply_id))) : null
        return {
          id: item.id,
          clinic_id: clinicId,
          service_id: params.id,
          supply_id: item.supply_id,
          qty: item.qty,
          supply: supply
            ? {
                ...supply,
                cost_per_portion_cents: supply.portions
                  ? Math.round((supply.price_cents || 0) / supply.portions)
                  : null,
              }
            : undefined,
        }
      })

      return NextResponse.json({ data: transformedData })
    }

    // Get service supplies with supply details (join)
    // Note: service_supplies doesn't have clinic_id, the service itself has it
    const { data, error } = await supabaseAdmin
      .from('service_supplies')
      .select(`
        *,
        supplies!service_supplies_supply_id_fkey (
          id,
          name,
          category,
          presentation,
          price_cents,
          portions
        )
      `)
      .eq('service_id', params.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching service supplies:', error);
      return NextResponse.json(
        { error: 'Failed to fetch service recipe', message: error.message },
        { status: 500 }
      );
    }

    // Transform the data to match our type
    // Note: Database uses 'qty' column
    const transformedData = (data ?? []).map(item => ({
      id: item.id, // Include the record ID
      clinic_id: clinicId,
      service_id: params.id,
      supply_id: item.supply_id,
      qty: item.qty, // Keep original column name
      supply: item.supplies
        ? {
            ...item.supplies,
            cost_per_portion_cents: item.supplies.portions
              ? Math.round(item.supplies.price_cents / item.supplies.portions)
              : null,
          }
        : undefined,
    }));

    return NextResponse.json({ data: transformedData });
  } catch (error) {
    console.error('Unexpected error in GET /api/services/[id]/supplies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const clinicContext = await resolveClinicContext({ cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'services.edit');
    if (forbidden) return forbidden;

    // Verify service exists and belongs to clinic
    let service: any = null
    if (shouldUseConvexOnlyWritePath('services')) {
      service = await getConvexDocumentByLegacyId('services', params.id)
      if (service?.clinic_id !== clinicId) service = null
    } else {
      const result = await supabaseAdmin
        .from('services')
        .select('id')
        .eq('id', params.id)
        .eq('clinic_id', clinicId)
        .single();
      service = result.data
    }

    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    // Add service_id and clinic_id to body for validation
    const dataWithContext = {
      ...body,
      service_id: params.id,
      clinic_id: clinicId
    };

    // Validate request body
    const validationResult = zServiceSupply.safeParse(dataWithContext);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    const { clinic_id, service_id, supply_id, qty } = validationResult.data;
    // Use 'quantity' as our standard name, but the API uses 'qty'
    const quantity = qty;

    if (shouldUseConvexOnlyWritePath('services')) {
      const existing = (await listConvexServiceSupplies(service_id))
        .find((row: any) => row.supply_id === supply_id || row.supplyId === supply_id)
      const rowId = String(existing?.id || existing?.legacyId || crypto.randomUUID())
      const payload = {
        id: rowId,
        clinic_id,
        service_id,
        supply_id,
        qty: quantity,
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await upsertConvexDocumentByLegacyId('service_supplies', rowId, payload)

      return NextResponse.json({
        data: payload,
        message: existing ? 'Recipe line updated' : 'Recipe line added'
      }, { status: existing ? 200 : 201 })
    }

    // Check if this supply is already in the recipe
    const { data: existing } = await supabaseAdmin
      .from('service_supplies')
      .select('id')
      .eq('service_id', service_id)
      .eq('supply_id', supply_id)
      .single();

    let result;

    if (existing) {
      // Update existing quantity (use qty for backward compatibility)
      result = await supabaseAdmin
        .from('service_supplies')
        .update({ qty: quantity })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new recipe line (use qty for backward compatibility)
      // Note: service_supplies doesn't have clinic_id
      result = await supabaseAdmin
        .from('service_supplies')
        .insert({ service_id, supply_id, qty: quantity })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error saving service supply:', result.error);
      return NextResponse.json(
        { error: 'Failed to save recipe line', message: result.error.message },
        { status: 500 }
      );
    }

    if (result.data && shouldWriteConvexData('services')) {
      try {
        await upsertConvexDocumentByLegacyId('service_supplies', result.data.id, {
          ...result.data,
          clinic_id,
        })
      } catch (convexError) {
        console.error('[service supplies POST] Convex mirror failed:', convexError)
      }
    }

    return NextResponse.json({
      data: result.data,
      message: existing ? 'Recipe line updated' : 'Recipe line added'
    }, { status: existing ? 200 : 201 });

  } catch (error) {
    console.error('Unexpected error in POST /api/services/[id]/supplies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE endpoint for removing supply by supply_id (not row id)
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data as { supply_id?: string };
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'services.edit');
    if (forbidden) return forbidden;

    const { supply_id } = body;
    
    if (!supply_id) {
      return NextResponse.json(
        { error: 'supply_id is required' },
        { status: 400 }
      );
    }

    if (shouldUseConvexOnlyWritePath('services')) {
      const service = await getConvexDocumentByLegacyId('services', params.id) as ImportedRecord | null
      if (!service || service.clinic_id !== clinicId) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      }

      const row = (await listConvexServiceSupplies(params.id))
        .find((item: any) => item.supply_id === supply_id || item.supplyId === supply_id)
      if (row) {
        const rowId = String(row.id || row.legacyId || '')
        if (rowId) await deleteConvexDocumentByLegacyId('service_supplies', rowId)
      }

      return NextResponse.json({
        data: null,
        message: 'Supply removed from service'
      })
    }

    // Delete the service_supply record
    const { error } = await supabaseAdmin
      .from('service_supplies')
      .delete()
      .eq('service_id', params.id)
      .eq('supply_id', supply_id);

    if (error) {
      console.error('Error deleting service supply:', error);
      return NextResponse.json(
        { error: 'Failed to delete service supply', message: error.message },
        { status: 500 }
      );
    }

    if (shouldWriteConvexData('services')) {
      try {
        const row = (await listConvexServiceSupplies(params.id))
          .find((item: any) => item.supply_id === supply_id || item.supplyId === supply_id)
        const rowId = String(row?.id || row?.legacyId || '')
        if (rowId) await deleteConvexDocumentByLegacyId('service_supplies', rowId)
      } catch (convexError) {
        console.error('[service supplies DELETE] Convex mirror failed:', convexError)
      }
    }

    return NextResponse.json({
      data: null,
      message: 'Supply removed from service'
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/services/[id]/supplies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
