import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { withPermission } from '@/lib/middleware/with-permission';
import { zFixedCost } from '@/lib/zod';
import type { FixedCost, ApiResponse } from '@/lib/types';
import { readJson } from '@/lib/validation';
import { listConvexDocumentsByClinic, upsertConvexDocumentByLegacyId } from '@/lib/convex/server';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath, shouldWriteConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

async function getFixedCostsFromConvex(clinicId: string, category: string | null, page: number, limit: number) {
  let rows = await listConvexDocumentsByClinic('fixed_costs', clinicId, 1000) as ImportedRecord[];

  if (category) {
    rows = rows.filter((row) => row.category === category);
  }

  rows = rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const from = (Math.max(1, page) - 1) * Math.max(1, limit);
  return rows.slice(from, from + Math.max(1, limit)).map(normalizeConvexRecord);
}

async function createFixedCostInConvex(row: Record<string, unknown>) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const document = {
    ...row,
    id,
    created_at: now,
    updated_at: now,
  };

  await upsertConvexDocumentByLegacyId('fixed_costs', id, document);
  return document;
}

async function mirrorFixedCostToConvex(row: Record<string, unknown>) {
  const id = row.id;
  if (typeof id !== 'string') return;
  await upsertConvexDocumentByLegacyId('fixed_costs', id, row);
}

export const GET = withPermission(
  'fixed_costs.view',
  async (request, context): Promise<NextResponse> => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const category = searchParams.get('category');

      const { clinicId } = context;

      if (shouldReturnConvexData('fixed_costs')) {
        const data = await getFixedCostsFromConvex(clinicId, category, page, limit);
        return NextResponse.json({ data });
      }

      let query = supabaseAdmin
        .from('fixed_costs')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching fixed costs:', error);
        return NextResponse.json(
          { error: 'Failed to fetch fixed costs', message: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ data: data || [] });
    } catch (error) {
      console.error('Unexpected error in GET /api/fixed-costs:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);

export const POST = withPermission(
  'fixed_costs.create',
  async (request, context): Promise<NextResponse> => {
    try {
      const bodyResult = await readJson(request);
      if ('error' in bodyResult) {
        return bodyResult.error as NextResponse<ApiResponse<FixedCost>>;
      }
      const body = bodyResult.data as Record<string, unknown>;
      const { clinicId } = context;

      const { amount_pesos, ...bodyWithoutPesos } = body as {
        amount_pesos?: number;
      } & Record<string, unknown>;

      const dataToValidate: Record<string, unknown> = {
        ...bodyWithoutPesos,
        clinic_id: clinicId,
      };

      if (typeof amount_pesos === 'number') {
        dataToValidate.amount_cents = Math.round(amount_pesos * 100);
      }

      const validationResult = zFixedCost.safeParse(dataToValidate);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            message: validationResult.error.errors.map(e => e.message).join(', '),
          },
          { status: 400 }
        );
      }

      const { clinic_id, category, concept, amount_cents } = validationResult.data;

      if (shouldUseConvexOnlyWritePath('fixed_costs')) {
        const data = await createFixedCostInConvex({ clinic_id, category, concept, amount_cents });
        return NextResponse.json({
          data,
          message: 'Fixed cost created successfully',
        }, { status: 201 });
      }

      const { data, error } = await supabaseAdmin
        .from('fixed_costs')
        .insert({ clinic_id, category, concept, amount_cents })
        .select()
        .single();

      if (error) {
        console.error('Error creating fixed cost:', error);
        return NextResponse.json(
          { error: 'Failed to create fixed cost', message: error.message },
          { status: 500 }
        );
      }

      if (data && shouldWriteConvexData('fixed_costs')) {
        try {
          await mirrorFixedCostToConvex(data as Record<string, unknown>);
        } catch (convexError) {
          console.error('[fixed-costs POST] Convex dual-write failed:', convexError);
        }
      }

      return NextResponse.json({
        data,
        message: 'Fixed cost created successfully',
      }, { status: 201 });
    } catch (error) {
      console.error('Unexpected error in POST /api/fixed-costs:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);
