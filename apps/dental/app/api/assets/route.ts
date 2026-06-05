import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { withPermission } from '@/lib/middleware/with-permission';
import { zAsset } from '@/lib/zod';
import type { Asset, ApiResponse } from '@/lib/types';
import { readJson } from '@/lib/validation';
import { listConvexDocumentsByClinic, upsertConvexDocumentByLegacyId } from '@/lib/convex/server';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath, shouldWriteConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row;
  return rest;
}

async function getAssetsFromConvex(clinicId: string, search: string | null, page: number, limit: number) {
  const normalizedSearch = search?.trim().toLowerCase();
  let rows = await listConvexDocumentsByClinic('assets', clinicId, 1000) as ImportedRecord[];

  if (normalizedSearch) {
    rows = rows.filter((row) => String(row.name || '').toLowerCase().includes(normalizedSearch));
  }

  rows = rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const from = (Math.max(1, page) - 1) * Math.max(1, limit);
  return rows.slice(from, from + Math.max(1, limit)).map(normalizeConvexRecord);
}

function normalizeAssetPayload(row: Record<string, unknown>) {
  const { depreciation_months, ...rest } = row as { depreciation_months?: number } & Record<string, unknown>;
  const normalizedMonths = typeof depreciation_months === 'number' && Number.isFinite(depreciation_months)
    ? Math.max(1, Math.round(depreciation_months))
    : 36;

  return {
    ...rest,
    depreciation_months: normalizedMonths,
    depreciation_years: Math.max(1, Math.round(normalizedMonths / 12)),
  };
}

async function createAssetInConvex(row: Record<string, unknown>) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const document = {
    ...normalizeAssetPayload(row),
    id,
    created_at: now,
    updated_at: now,
  };

  await upsertConvexDocumentByLegacyId('assets', id, document);
  return document;
}

async function mirrorAssetToConvex(row: Record<string, unknown>) {
  const id = row.id;
  if (typeof id !== 'string') return;
  await upsertConvexDocumentByLegacyId('assets', id, row);
}

export const GET = withPermission(
  'assets.view',
  async (request, context): Promise<NextResponse> => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const search = searchParams.get('search');

      const { clinicId } = context;

      if (shouldReturnConvexData('assets')) {
        const data = await getAssetsFromConvex(clinicId, search, page, limit);
        return NextResponse.json({ data });
      }

      let query = supabaseAdmin
        .from('assets')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching assets:', error);
        return NextResponse.json(
          { error: 'Failed to fetch assets', message: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ data: data || [] });
    } catch (error) {
      console.error('Unexpected error in GET /api/assets:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);

export const POST = withPermission(
  'assets.create',
  async (request, context): Promise<NextResponse> => {
    try {
      const bodyResult = await readJson(request);
      if ('error' in bodyResult) {
        return bodyResult.error as NextResponse<ApiResponse<Asset>>;
      }
      const body = bodyResult.data as Record<string, unknown>;
      const { clinicId } = context;

      const { purchase_price_pesos, ...bodyWithoutPesos } = body as {
        purchase_price_pesos?: number;
      } & Record<string, unknown>;

      const dataToValidate: Record<string, unknown> = {
        ...bodyWithoutPesos,
        clinic_id: clinicId,
      };

      if (typeof purchase_price_pesos === 'number') {
        dataToValidate.purchase_price_cents = Math.round(purchase_price_pesos * 100);
      }

      const validationResult = zAsset.safeParse(dataToValidate);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            message: validationResult.error.errors.map(e => e.message).join(', '),
          },
          { status: 400 }
        );
      }

      const {
        id: _ignoreId,
        created_at: _ignoreCreatedAt,
        updated_at: _ignoreUpdatedAt,
        depreciation_months,
        ...rest
      } = validationResult.data;

      const normalizedMonths = typeof depreciation_months === 'number' && Number.isFinite(depreciation_months)
        ? Math.max(1, Math.round(depreciation_months))
        : 36;
      const depreciationYears = Math.max(1, Math.round(normalizedMonths / 12));

      const dataToInsert = {
        ...rest,
        depreciation_years: depreciationYears,
      };

      if (shouldUseConvexOnlyWritePath('assets')) {
        const data = await createAssetInConvex({
          ...rest,
          depreciation_months,
        });

        return NextResponse.json({ data, message: 'Asset created successfully' }, { status: 201 });
      }

      const { data, error } = await supabaseAdmin
        .from('assets')
        .insert(dataToInsert)
        .select()
        .single();

      if (error) {
        console.error('Error creating asset:', error);
        return NextResponse.json(
          { error: 'Failed to create asset', message: error.message },
          { status: 500 }
        );
      }

      if (data && shouldWriteConvexData('assets')) {
        try {
          await mirrorAssetToConvex(data as Record<string, unknown>);
        } catch (convexError) {
          console.error('[assets POST] Convex dual-write failed:', convexError);
        }
      }

      return NextResponse.json({ data, message: 'Asset created successfully' }, { status: 201 });
    } catch (error) {
      console.error('Unexpected error in POST /api/assets:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);
