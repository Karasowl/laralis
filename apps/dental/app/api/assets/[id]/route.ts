import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { withPermission } from '@/lib/middleware/with-permission';
import { zAsset } from '@/lib/zod';
import type { Asset, ApiResponse } from '@/lib/types';
import { readJson } from '@/lib/validation';

export const dynamic = 'force-dynamic'


export const PUT = withPermission(
  'assets.edit',
  async (request, context): Promise<NextResponse<ApiResponse<Asset>>> => {
    try {
      const assetId = request.nextUrl.pathname.split('/').pop();
      if (!assetId) {
        return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
      }

      const bodyResult = await readJson(request);
      if ('error' in bodyResult) {
        return bodyResult.error;
      }
      const body = bodyResult.data;
      const { clinicId } = context;

      const dataToValidate = { ...body, clinic_id: clinicId } as Record<string, unknown>;
      if ('purchase_price_pesos' in dataToValidate) {
        const pesosValue = dataToValidate.purchase_price_pesos;
        if (typeof pesosValue === 'number') {
          dataToValidate.purchase_price_cents = Math.round(pesosValue * 100);
        }
        delete dataToValidate.purchase_price_pesos;
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

      const dataToUpdate: Record<string, unknown> = { ...rest };
      if (typeof depreciation_months === 'number' && Number.isFinite(depreciation_months)) {
        const normalizedMonths = Math.max(1, Math.round(depreciation_months));
        dataToUpdate.depreciation_years = Math.max(1, Math.round(normalizedMonths / 12));
      }

      const { data, error } = await supabaseAdmin
        .from('assets')
        .update(dataToUpdate)
        .eq('id', assetId)
        .eq('clinic_id', clinicId)
        .select()
        .single();

      if (error) {
        console.error('Error updating asset:', error);
        return NextResponse.json(
          { error: 'Failed to update asset', message: error.message },
          { status: 500 }
        );
      }

      if (!data) {
        return NextResponse.json(
          { error: 'Asset not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ data, message: 'Asset updated successfully' });
    } catch (error) {
      console.error('Unexpected error in PUT /api/assets/[id]:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);

export const DELETE = withPermission(
  'assets.delete',
  async (request, context): Promise<NextResponse<ApiResponse<null>>> => {
    try {
      const assetId = request.nextUrl.pathname.split('/').pop();
      if (!assetId) {
        return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('assets')
        .delete()
        .eq('id', assetId)
        .eq('clinic_id', context.clinicId);

      if (error) {
        console.error('Error deleting asset:', error);
        return NextResponse.json(
          { error: 'Failed to delete asset', message: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ data: null, message: 'Asset deleted successfully' });
    } catch (error) {
      console.error('Unexpected error in DELETE /api/assets/[id]:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);
