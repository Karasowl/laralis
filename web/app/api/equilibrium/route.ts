import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';

interface EquilibriumCalculation {
  fixed_costs_cents: number;
  variable_cost_percentage: number;
  contribution_margin_percentage: number;
  break_even_revenue_cents: number;
  daily_target_cents: number;
  safety_margin_cents: number;
  work_days: number;
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<EquilibriumCalculation>>> {
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

    // Get variable cost percentage from query params
    const variableCostPercentage = Number(searchParams.get('variableCostPercentage')) || 35;
    
    // Load fixed costs
    const { data: fixedCosts, error: fixedCostsError } = await supabaseAdmin
      .from('fixed_costs')
      .select('amount_cents')
      .eq('clinic_id', clinicId);

    if (fixedCostsError) {
      console.error('Error fetching fixed costs:', fixedCostsError);
      return NextResponse.json(
        { error: 'Failed to fetch fixed costs', message: fixedCostsError.message },
        { status: 500 }
      );
    }

    // Load assets depreciation
    const { data: assets, error: assetsError } = await supabaseAdmin
      .from('assets')
      .select('purchase_price_cents, depreciation_months')
      .eq('clinic_id', clinicId);

    if (assetsError) {
      console.error('Error fetching assets:', assetsError);
      return NextResponse.json(
        { error: 'Failed to fetch assets', message: assetsError.message },
        { status: 500 }
      );
    }

    // Load time settings
    const { data: timeSettings, error: timeError } = await supabaseAdmin
      .from('settings_time')
      .select('work_days')
      .eq('clinic_id', clinicId)
      .single();

    if (timeError && timeError.code !== 'PGRST116') { // Not found is ok
      console.error('Error fetching time settings:', timeError);
    }

    // Calculate total fixed costs
    const manualFixedCosts = (fixedCosts || []).reduce((sum, cost) => sum + cost.amount_cents, 0);
    const assetsDepreciation = (assets || []).reduce((sum, asset) => {
      if (!asset.depreciation_months || asset.depreciation_months <= 0) return sum;
      return sum + Math.round(asset.purchase_price_cents / asset.depreciation_months);
    }, 0);
    
    const totalFixedCostsCents = manualFixedCosts + assetsDepreciation;
    const workDays = timeSettings?.work_days || 20;

    // Calculate equilibrium metrics
    const contributionMarginPercentage = 100 - variableCostPercentage;
    const contributionMarginDecimal = contributionMarginPercentage / 100;
    
    const breakEvenRevenueCents = contributionMarginDecimal > 0 
      ? Math.round(totalFixedCostsCents / contributionMarginDecimal) 
      : 0;
    
    const dailyTargetCents = workDays > 0 ? Math.round(breakEvenRevenueCents / workDays) : 0;
    const safetyMarginCents = Math.round(breakEvenRevenueCents * 1.2); // 20% safety margin

    const result: EquilibriumCalculation = {
      fixed_costs_cents: totalFixedCostsCents,
      variable_cost_percentage: variableCostPercentage,
      contribution_margin_percentage: contributionMarginPercentage,
      break_even_revenue_cents: breakEvenRevenueCents,
      daily_target_cents: dailyTargetCents,
      safety_margin_cents: safetyMarginCents,
      work_days: workDays
    };

    return NextResponse.json({ data: result });

  } catch (error) {
    console.error('Unexpected error in GET /api/equilibrium:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}