import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';
import { calculateMonthlyDepreciation } from '@/lib/calc/depreciacion';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{ monthly_depreciation_cents: number }>>> {
  try {
    const cookieStore = cookies();
    const searchParams = request.nextUrl.searchParams;
    const clinicId = searchParams.get('clinicId') || await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

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

    const monthly_depreciation_cents = (data || []).reduce((sum, a) => {
      try {
        return sum + calculateMonthlyDepreciation(a.purchase_price_cents, a.depreciation_months);
      } catch {
        return sum; // ignore invalid rows gracefully
      }
    }, 0);

    return NextResponse.json({ data: { monthly_depreciation_cents } });
  } catch (error) {
    console.error('Unexpected error in GET /api/assets/summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}




