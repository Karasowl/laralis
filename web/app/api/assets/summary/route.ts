import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { calculateMonthlyDepreciation } from '@/lib/calc/depreciacion';

export const dynamic = 'force-dynamic'


type SummaryResponse = {
  monthly_depreciation_cents: number;
  total_investment_cents: number;
  asset_count: number;
  average_depreciation_months: number;
  minimal_asset_present: boolean;
};

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<SummaryResponse>>> {
  try {
    const cookieStore = cookies();
    const searchParams = request.nextUrl.searchParams;

    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    });

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      );
    }

    const { clinicId } = clinicContext;

    const { data, error } = await supabaseAdmin
      .from('assets')
      .select('purchase_price_cents, depreciation_months')
      .eq('clinic_id', clinicId);

    if (error) {
      console.error('Error fetching assets:', error);
      return NextResponse.json(
        { error: 'Failed to fetch assets', message: error.message },
        { status: 500 }
      );
    }

    const assets = data || [];

    // Debug logging
    console.log(`[Assets Summary] Found ${assets.length} assets for clinic ${clinicId}`);
    if (assets.length > 0) {
      console.log('[Assets Summary] Sample asset:', {
        purchase_price_cents: assets[0].purchase_price_cents,
        depreciation_months: assets[0].depreciation_months
      });
    }

    const minimal_asset_present = assets.length > 0;
    const total_investment_cents = assets.reduce((sum, a) => sum + (Number(a.purchase_price_cents) || 0), 0);

    const monthly_depreciation_cents = assets.reduce((sum, a) => {
      const price = Number(a.purchase_price_cents || 0);
      const months = Number(a.depreciation_months || 0);

      console.log(`[Assets Summary] Processing asset: price=${price}, months=${months}`);

      if (price <= 0 || months <= 0) {
        console.log('[Assets Summary] Skipping asset with invalid price or months');
        return sum;
      }

      try {
        const depreciation = calculateMonthlyDepreciation(price, months);
        console.log(`[Assets Summary] Calculated monthly depreciation: ${depreciation}`);
        return sum + depreciation;
      } catch (err) {
        console.error('[Assets Summary] Error calculating depreciation:', err);
        return sum;
      }
    }, 0);

    console.log(`[Assets Summary] Total monthly depreciation: ${monthly_depreciation_cents}`);

    const asset_count = assets.length;

    const average_depreciation_months = asset_count > 0
      ? Math.round(assets.reduce((sum, a) => sum + Number(a.depreciation_months || 0), 0) / asset_count)
      : 0;

    return NextResponse.json({
      data: {
        monthly_depreciation_cents,
        total_investment_cents,
        asset_count,
        average_depreciation_months,
        minimal_asset_present,
      },
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/assets/summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
