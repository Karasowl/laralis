import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { withPermission } from '@/lib/middleware/with-permission';
import { zFixedCost } from '@/lib/zod';
import type { FixedCost, ApiResponse } from '@/lib/types';

export const dynamic = 'force-dynamic'


export const GET = withPermission(
  'fixed_costs.view',
  async (request, context): Promise<NextResponse<ApiResponse<FixedCost>>> => {
    try {
      const fixedCostId = request.nextUrl.pathname.split('/').pop();
      if (!fixedCostId) {
        return NextResponse.json(
          { error: 'Fixed cost ID is required' },
          { status: 400 }
        );
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
  async (request, context): Promise<NextResponse<ApiResponse<FixedCost>>> => {
    try {
      const fixedCostId = request.nextUrl.pathname.split('/').pop();
      if (!fixedCostId) {
        return NextResponse.json(
          { error: 'Fixed cost ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
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
  async (request, context): Promise<NextResponse<ApiResponse<null>>> => {
    try {
      const fixedCostId = request.nextUrl.pathname.split('/').pop();
      if (!fixedCostId) {
        return NextResponse.json(
          { error: 'Fixed cost ID is required' },
          { status: 400 }
        );
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
