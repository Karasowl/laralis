import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { withPermission } from '@/lib/middleware/with-permission';
import { zFixedCost } from '@/lib/zod';
import type { FixedCost, ApiResponse } from '@/lib/types';
import { readJson } from '@/lib/validation';
import { getConvexDocumentByLegacyId, patchConvexDocumentByLegacyId, deleteConvexDocumentByLegacyId } from '@/lib/convex/server';
import { shouldReturnConvexData, shouldUseConvexOnlyWritePath, shouldWriteConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord | null | undefined) {
  if (!row) return null;
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

async function getFixedCostFromConvex(id: string, clinicId: string) {
  const row = await getConvexDocumentByLegacyId('fixed_costs', id) as ImportedRecord | null;
  if (!row || row.clinic_id !== clinicId) return null;
  return normalizeConvexRecord(row);
}

export const GET = withPermission(
  'fixed_costs.view',
  async (request, context): Promise<NextResponse> => {
    try {
      const fixedCostId = request.nextUrl.pathname.split('/').pop();
      if (!fixedCostId) {
        return NextResponse.json(
          { error: 'Fixed cost ID is required' },
          { status: 400 }
        );
      }

      if (shouldReturnConvexData('fixed_costs')) {
        const data = await getFixedCostFromConvex(fixedCostId, context.clinicId);
        if (!data) {
          return NextResponse.json(
            { error: 'Fixed cost not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ data });
      }

      const { data, error } = await supabaseAdmin
        .from('fixed_costs')
        .select('*')
        .eq('id', fixedCostId)
        .eq('clinic_id', context.clinicId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Fixed cost not found' },
            { status: 404 }
          );
        }

        console.error('Error fetching fixed cost:', error);
        return NextResponse.json(
          { error: 'Failed to fetch fixed cost', message: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ data });
    } catch (error) {
      console.error('Unexpected error in GET /api/fixed-costs/[id]:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);

export const PUT = withPermission(
  'fixed_costs.edit',
  async (request, context): Promise<NextResponse> => {
    try {
      const fixedCostId = request.nextUrl.pathname.split('/').pop();
      if (!fixedCostId) {
        return NextResponse.json(
          { error: 'Fixed cost ID is required' },
          { status: 400 }
        );
      }

      const bodyResult = await readJson(request);
      if ('error' in bodyResult) {
        return bodyResult.error as NextResponse<ApiResponse<FixedCost>>;
      }
      const body = bodyResult.data as Record<string, unknown>;
      const { clinicId } = context;

      const validationResult = zFixedCost.safeParse({ ...body, clinic_id: clinicId });
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            message: validationResult.error.errors.map(e => e.message).join(', '),
          },
          { status: 400 }
        );
      }

      const { category, concept, amount_cents } = validationResult.data;

      if (shouldUseConvexOnlyWritePath('fixed_costs')) {
        const current = await getFixedCostFromConvex(fixedCostId, clinicId);
        if (!current) {
          return NextResponse.json(
            { error: 'Fixed cost not found' },
            { status: 404 }
          );
        }

        const patch = {
          category,
          concept,
          amount_cents,
          updated_at: new Date().toISOString(),
        };
        await patchConvexDocumentByLegacyId('fixed_costs', fixedCostId, patch);
        return NextResponse.json({
          data: { ...current, ...patch },
          message: 'Fixed cost updated successfully',
        });
      }

      const { data, error } = await supabaseAdmin
        .from('fixed_costs')
        .update({ category, concept, amount_cents })
        .eq('id', fixedCostId)
        .eq('clinic_id', clinicId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Fixed cost not found' },
            { status: 404 }
          );
        }

        console.error('Error updating fixed cost:', error);
        return NextResponse.json(
          { error: 'Failed to update fixed cost', message: error.message },
          { status: 500 }
        );
      }

      if (data && shouldWriteConvexData('fixed_costs')) {
        try {
          await patchConvexDocumentByLegacyId('fixed_costs', fixedCostId, data as Record<string, unknown>);
        } catch (convexError) {
          console.error('[fixed-costs PUT] Convex dual-write failed:', convexError);
        }
      }

      return NextResponse.json({
        data,
        message: 'Fixed cost updated successfully',
      });
    } catch (error) {
      console.error('Unexpected error in PUT /api/fixed-costs/[id]:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);

export const DELETE = withPermission(
  'fixed_costs.delete',
  async (request, context): Promise<NextResponse> => {
    try {
      const fixedCostId = request.nextUrl.pathname.split('/').pop();
      if (!fixedCostId) {
        return NextResponse.json(
          { error: 'Fixed cost ID is required' },
          { status: 400 }
        );
      }

      if (shouldUseConvexOnlyWritePath('fixed_costs')) {
        const current = await getFixedCostFromConvex(fixedCostId, context.clinicId);
        if (!current) {
          return NextResponse.json(
            { error: 'Fixed cost not found' },
            { status: 404 }
          );
        }

        await deleteConvexDocumentByLegacyId('fixed_costs', fixedCostId);
        return NextResponse.json({
          data: null,
          message: 'Fixed cost deleted successfully',
        });
      }

      const { error } = await supabaseAdmin
        .from('fixed_costs')
        .delete()
        .eq('id', fixedCostId)
        .eq('clinic_id', context.clinicId);

      if (error) {
        console.error('Error deleting fixed cost:', error);
        return NextResponse.json(
          { error: 'Failed to delete fixed cost', message: error.message },
          { status: 500 }
        );
      }

      if (shouldWriteConvexData('fixed_costs')) {
        try {
          await deleteConvexDocumentByLegacyId('fixed_costs', fixedCostId);
        } catch (convexError) {
          console.error('[fixed-costs DELETE] Convex dual-write failed:', convexError);
        }
      }

      return NextResponse.json({
        data: null,
        message: 'Fixed cost deleted successfully',
      });
    } catch (error) {
      console.error('Unexpected error in DELETE /api/fixed-costs/[id]:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);
