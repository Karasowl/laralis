import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ApiResponse, ServiceWithCost } from '@/lib/types';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { calcularCostoVariable } from '@/lib/calc/variable';
import { getConvexDocumentByLegacyId, listConvexDocumentsByClinic, listConvexTable } from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'


interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest, 
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });
    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }
    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'financial_reports.view');
    if (forbidden) return forbidden;

    if (shouldReturnConvexData('services')) {
      const service = await getConvexDocumentByLegacyId('services', params.id) as Record<string, any> | null
      if (!service || service.clinic_id !== clinicId) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      }

      const [serviceSupplies, supplies, timeRows, fixedCosts, assets] = await Promise.all([
        listConvexTable('service_supplies'),
        listConvexDocumentsByClinic('supplies', clinicId),
        listConvexDocumentsByClinic('settings_time', clinicId, 10),
        listConvexDocumentsByClinic('fixed_costs', clinicId),
        listConvexDocumentsByClinic('assets', clinicId),
      ])

      const suppliesById = new Map(
        (supplies as Record<string, any>[]).flatMap((row) => {
          const ids = [row.id, row.legacyId].filter(Boolean).map((id) => String(id))
          return ids.map((id) => [id, row] as const)
        })
      )
      let variableCostCents = 0
      for (const item of serviceSupplies as Record<string, any>[]) {
        if (item.service_id !== params.id && item.serviceId !== params.id) continue
        const supply = item.supply_id ? suppliesById.get(String(item.supply_id)) : null
        if (!supply) continue
        const price = Number(supply.price_cents || 0)
        const portions = Number(supply.portions || 0)
        const qty = Number(item.qty || 0)
        if (portions > 0 && qty > 0) {
          variableCostCents += Math.round((price / portions) * qty)
        }
      }

      const settingsTime = (timeRows as Record<string, any>[])[0]
      let fixedCostCents = 0
      if (settingsTime) {
        const totalFixedCostsCents = (fixedCosts as Record<string, any>[]).reduce((sum, cost) => sum + (Number(cost.amount_cents) || 0), 0)
        const assetsMonthlyDepCents = (assets as Record<string, any>[]).reduce((sum, asset) => {
          const months = Number(asset.depreciation_months) || 0
          if (months <= 0) return sum
          return sum + Math.round((Number(asset.purchase_price_cents) || 0) / months)
        }, 0)
        const monthlyFixedTotal = totalFixedCostsCents + assetsMonthlyDepCents
        if (monthlyFixedTotal > 0) {
          const workDays = Number(settingsTime.working_days_per_month ?? settingsTime.work_days ?? 20)
          const hoursPerDay = Number(settingsTime.hours_per_day ?? 7)
          let realPctFactor = Number(settingsTime.real_hours_percentage ?? settingsTime.real_pct ?? 0)
          if (!Number.isFinite(realPctFactor) || realPctFactor < 0) realPctFactor = 0
          if (realPctFactor > 1) realPctFactor = realPctFactor / 100
          realPctFactor = Math.min(1, Math.max(0, realPctFactor))
          const effectiveMinutes = Math.round(workDays * hoursPerDay * 60 * realPctFactor)
          const fixedCostPerMinute = effectiveMinutes > 0 ? Math.round(monthlyFixedTotal / effectiveMinutes) : 0
          fixedCostCents = Math.round(fixedCostPerMinute * (Number(service.est_minutes) || 0))
        }
      }

      const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...serviceRow } = service
      return NextResponse.json({
        data: {
          ...serviceRow,
          variable_cost_cents: variableCostCents,
          fixed_cost_cents: fixedCostCents,
          total_cost_cents: fixedCostCents + variableCostCents,
        }
      })
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
      .select('*, supplies!service_supplies_supply_id_fkey(price_cents, portions)')
      .eq('service_id', params.id);

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
      .select('*')
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

      // Get monthly depreciation from assets
      const { data: assets, error: assetsError } = await supabaseAdmin
        .from('assets')
        .select('purchase_price_cents, depreciation_months')
        .eq('clinic_id', clinicId);

      if (fixedCostsError) {
        console.error('Error fetching fixed costs:', fixedCostsError);
      }
      if (assetsError) {
        console.error('Error fetching assets:', assetsError);
      }

      const totalFixedCostsCents = (fixedCosts || []).reduce((sum, cost) => sum + cost.amount_cents, 0);
      const assetsMonthlyDepCents = (assets || []).reduce((sum, a) => {
        if (!a.depreciation_months || a.depreciation_months <= 0) return sum;
        return sum + Math.round(a.purchase_price_cents / a.depreciation_months);
      }, 0);

      const monthlyFixedTotal = totalFixedCostsCents + assetsMonthlyDepCents;

      if (monthlyFixedTotal > 0) {
        // Calculate minutes per month
        const workDays = settingsTime.working_days_per_month ?? settingsTime.work_days;
        const rawRealPct = settingsTime.real_hours_percentage ?? settingsTime.real_pct ?? 0;
        let realPctFactor = Number(rawRealPct);
        if (!Number.isFinite(realPctFactor) || realPctFactor < 0) {
          realPctFactor = 0;
        }
        if (realPctFactor > 1) {
          realPctFactor = realPctFactor / 100;
        }
        realPctFactor = Math.min(1, Math.max(0, realPctFactor));
        const minutesPerMonth = workDays * settingsTime.hours_per_day * 60;
        const effectiveMinutes = Math.round(minutesPerMonth * realPctFactor);
        
        // Calculate fixed cost per minute
        const fixedCostPerMinute = effectiveMinutes > 0 ? Math.round(monthlyFixedTotal / effectiveMinutes) : 0;
        
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
