import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import {
  listConvexTable,
  getConvexDocumentByLegacyId,
  upsertConvexDocumentByLegacyId,
  patchConvexDocumentByLegacyId,
  deleteConvexDocumentByLegacyId,
} from '@/lib/convex/server';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

async function getMarketingPlatformsFromConvex(clinicId: string, activeOnly: boolean) {
  const rows = await listConvexTable('categories', 10000) as ImportedRecord[];

  const filtered = rows.filter((row) => {
    if (row.entity_type !== 'marketing_platform') return false;
    // Replicate `.or('clinic_id.is.null,clinic_id.eq.${clinicId}')`
    const rowClinicId = row.clinic_id ?? null;
    if (rowClinicId !== null && rowClinicId !== clinicId) return false;
    if (activeOnly && row.is_active !== true) return false;
    return true;
  });

  // Replicate ordering: is_system DESC, display_order ASC (NULLS LAST), display_name ASC
  filtered.sort((a, b) => {
    const aSystem = a.is_system === true ? 1 : 0;
    const bSystem = b.is_system === true ? 1 : 0;
    if (aSystem !== bSystem) return bSystem - aSystem;

    const aOrder = a.display_order ?? null;
    const bOrder = b.display_order ?? null;
    if (aOrder === null && bOrder !== null) return 1;
    if (aOrder !== null && bOrder === null) return -1;
    if (aOrder !== null && bOrder !== null && Number(aOrder) !== Number(bOrder)) {
      return Number(aOrder) - Number(bOrder);
    }

    return String(a.display_name ?? '').localeCompare(String(b.display_name ?? ''));
  });

  return filtered.map(normalizeConvexRecord);
}


const createPlatformSchema = z.object({
  display_name: z.string().min(1),
  name: z.string().optional().nullable(),
});

const updatePlatformSchema = z.object({
  id: z.string().uuid(),
  clinic_id: z.string().uuid().optional(),
  display_name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
}).passthrough();

const deletePlatformSchema = z.object({
  id: z.string().uuid(),
  clinic_id: z.string().uuid().optional(),
}).passthrough();

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const searchParams = request.nextUrl.searchParams;

    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    });

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }

    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'campaigns.view');
    if (forbidden) return forbidden;
    const activeOnly = searchParams.get('active') === 'true';

    if (shouldReturnConvexData('categories')) {
      const data = await getMarketingPlatformsFromConvex(clinicId, activeOnly);
      return NextResponse.json({ data });
    }

    let query = supabaseAdmin
      .from('categories')
      .select('*')
      .eq('entity_type', 'marketing_platform')
      .or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
      .order('is_system', { ascending: false })
      .order('display_order', { ascending: true })
      .order('display_name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching marketing platforms:', error);
      return NextResponse.json(
        { error: 'Failed to fetch marketing platforms', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/marketing/platforms:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const searchParams = request.nextUrl.searchParams;
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const body = bodyResult.data;

    const clinicContext = await resolveClinicContext({
      requestedClinicId: body?.clinic_id || searchParams.get('clinicId'),
      cookieStore,
    });

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }

    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'campaigns.create');
    if (forbidden) return forbidden;

    const validation = createPlatformSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', message: validation.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const insertRow = {
      clinic_id: clinicId,
      entity_type: 'marketing_platform',
      name: validation.data.name || validation.data.display_name.toLowerCase().replace(/\s+/g, '_'),
      display_name: validation.data.display_name,
      is_system: false,
      is_active: true,
    };

    if (shouldUseConvexOnlyWritePath('categories')) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const row = { id, ...insertRow, created_at: now, updated_at: now };
      await upsertConvexDocumentByLegacyId('categories', id, row);
      return NextResponse.json({ data: row });
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert(insertRow)
      .select()
      .single();

    if (error) {
      console.error('Error creating marketing platform:', error);
      return NextResponse.json({ error: 'Failed to create marketing platform', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error in POST /api/marketing/platforms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const parsed = validateSchema(updatePlatformSchema, bodyResult.data);
    if ('error' in parsed) {
      return parsed.error;
    }
    const body = parsed.data;
    const id = body.id;

    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({
      requestedClinicId: body?.clinic_id,
      cookieStore,
    });

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }

    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'campaigns.edit');
    if (forbidden) return forbidden;

    const patch: Record<string, unknown> = {};
    if (body.display_name) patch.display_name = body.display_name;
    if (body.is_active !== undefined) patch.is_active = body.is_active;

    if (shouldUseConvexOnlyWritePath('categories')) {
      const existingConvex = await getConvexDocumentByLegacyId('categories', id) as ImportedRecord | null;
      if (!existingConvex || existingConvex.entity_type !== 'marketing_platform') {
        return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
      }
      if (existingConvex.clinic_id && existingConvex.clinic_id !== clinicId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (!existingConvex.clinic_id) {
        return NextResponse.json({ error: 'System platforms are read-only' }, { status: 403 });
      }

      const convexPatch = { ...patch, updated_at: new Date().toISOString() };
      await patchConvexDocumentByLegacyId('categories', id, convexPatch);
      const merged = { ...normalizeConvexRecord(existingConvex), ...convexPatch };
      return NextResponse.json({ data: merged });
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('categories')
      .select('id, clinic_id')
      .eq('id', id)
      .eq('entity_type', 'marketing_platform')
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching marketing platform:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch marketing platform', message: fetchError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    if (existing.clinic_id && existing.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!existing.clinic_id) {
      return NextResponse.json({ error: 'System platforms are read-only' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(patch)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .select()
      .single();

    if (error) {
      console.error('Error updating marketing platform:', error);
      return NextResponse.json({ error: 'Failed to update marketing platform', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error in PUT /api/marketing/platforms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const parsed = validateSchema(deletePlatformSchema, bodyResult.data);
    if ('error' in parsed) {
      return parsed.error;
    }
    const body = parsed.data;
    const id = body.id;

    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({
      requestedClinicId: body?.clinic_id,
      cookieStore,
    });

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }

    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'campaigns.delete');
    if (forbidden) return forbidden;

    if (shouldUseConvexOnlyWritePath('categories')) {
      const existingConvex = await getConvexDocumentByLegacyId('categories', id) as ImportedRecord | null;
      if (!existingConvex || existingConvex.entity_type !== 'marketing_platform') {
        return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
      }
      if (existingConvex.clinic_id && existingConvex.clinic_id !== clinicId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (!existingConvex.clinic_id) {
        return NextResponse.json({ error: 'System platforms are read-only' }, { status: 403 });
      }

      await deleteConvexDocumentByLegacyId('categories', id);
      return NextResponse.json({ success: true });
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('categories')
      .select('id, clinic_id')
      .eq('id', id)
      .eq('entity_type', 'marketing_platform')
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching marketing platform:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch marketing platform', message: fetchError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    if (existing.clinic_id && existing.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!existing.clinic_id) {
      return NextResponse.json({ error: 'System platforms are read-only' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('clinic_id', clinicId);

    if (error) {
      console.error('Error deleting marketing platform:', error);
      return NextResponse.json({ error: 'Failed to delete marketing platform', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/marketing/platforms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
