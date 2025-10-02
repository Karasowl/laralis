import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { calculateMonthlyDepreciation } from '@/lib/calc/depreciacion';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{
  monthly_depreciation_cents: number;
  total_investment_cents: number;
  asset_count: number;
  average_depreciation_months: number;
}>>> {
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

    const total_investment_cents = assets.reduce((sum, a) => sum + a.purchase_price_cents, 0);

    const monthly_depreciation_cents = assets.reduce((sum, a) => {
      try {
        return sum + calculateMonthlyDepreciation(a.purchase_price_cents, a.depreciation_months);
      } catch {
        return sum;
      }
    }, 0);

    const asset_count = assets.length;

    const average_depreciation_months = asset_count > 0
      ? Math.round(assets.reduce((sum, a) => sum + (a.depreciation_months || 0), 0) / asset_count)
      : 0;

    return NextResponse.json({
      data: {
        monthly_depreciation_cents,
        total_investment_cents,
        asset_count,
        average_depreciation_months,
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
