import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ApiResponse, ServiceWithCost } from '@/lib/types';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';
import { calcularCostoVariable } from '@/lib/calc/variable';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest, 
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<ServiceWithCost>>> {
  try {
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // Get service details
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single();

    if (serviceError) {
      if (serviceError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        );
      }
      
      console.error('Error fetching service:', serviceError);
      return NextResponse.json(
        { error: 'Failed to fetch service', message: serviceError.message },
        { status: 500 }
      );
    }

    // Get service supplies with supply details for variable cost calculation
    const { data: serviceSupplies, error: suppliesError } = await supabaseAdmin
      .from('service_supplies')
      .select('*, supplies(price_cents, portions)')
      .eq('service_id', params.id)
      .eq('clinic_id', clinicId);

    if (suppliesError) {
      console.error('Error fetching service supplies:', suppliesError);
      return NextResponse.json(
        { error: 'Failed to fetch service supplies', message: suppliesError.message },
        { status: 500 }
      );
    }

    // Calculate variable cost
    let variableCostCents = 0;
    if (serviceSupplies && serviceSupplies.length > 0) {
      for (const item of serviceSupplies) {
        if (item.supplies) {
          const supply = item.supplies as any;
          const costPerPortion = supply.price_cents / supply.portions;
          variableCostCents += Math.round(costPerPortion * item.qty);
        }
      }
    }

    // Get fixed cost per minute for this clinic
    const { data: settingsTime, error: settingsError } = await supabaseAdmin
      .from('settings_time')
      .select('work_days, hours_per_day, real_pct')
      .eq('clinic_id', clinicId)
      .single();

    if (settingsError) {
      console.error('Error fetching time settings:', settingsError);
    }

    let fixedCostCents = 0;
    
    // Calculate fixed cost if we have time settings
    if (settingsTime) {
      // Get total fixed costs
      const { data: fixedCosts, error: fixedCostsError } = await supabaseAdmin
        .from('fixed_costs')
        .select('amount_cents')
        .eq('clinic_id', clinicId);

      if (!fixedCostsError && fixedCosts) {
        const totalFixedCostsCents = fixedCosts.reduce((sum, cost) => sum + cost.amount_cents, 0);
        
        // Calculate minutes per month
        const minutesPerMonth = settingsTime.work_days * settingsTime.hours_per_day * 60;
        const effectiveMinutes = minutesPerMonth * settingsTime.real_pct;
        
        // Calculate fixed cost per minute
        const fixedCostPerMinute = totalFixedCostsCents / effectiveMinutes;
        
        // Calculate fixed cost for this service
        fixedCostCents = Math.round(fixedCostPerMinute * service.est_minutes);
      }
    }

    // Total cost
    const totalCostCents = fixedCostCents + variableCostCents;

    const serviceWithCost: ServiceWithCost = {
      ...service,
      variable_cost_cents: variableCostCents,
      fixed_cost_cents: fixedCostCents,
      total_cost_cents: totalCostCents
    };

    return NextResponse.json({ data: serviceWithCost });
  } catch (error) {
    console.error('Unexpected error in GET /api/services/[id]/cost:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}