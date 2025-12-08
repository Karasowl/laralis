import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/refunds
 *
 * Returns refund statistics for the clinic:
 * - Total refunded treatments count
 * - Refund rate (% of all treatments)
 * - Total loss from refunds (materials + time)
 * - Material losses (variable costs)
 * - Time losses (fixed costs based on duration)
 * - Average loss per refund
 *
 * Query params:
 * - from: Start date (ISO string, optional)
 * - to: End date (ISO string, optional)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }

    const { clinicId } = clinicContext;
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    // Build the query for refunded treatments
    let refundedQuery = supabaseAdmin
      .from('treatments')
      .select('id, variable_cost_cents, duration_minutes, fixed_cost_per_minute_cents, price_cents, refunded_at')
      .eq('clinic_id', clinicId)
      .eq('is_refunded', true);

    // Build the query for all treatments (for calculating refund rate)
    let allTreatmentsQuery = supabaseAdmin
      .from('treatments')
      .select('id', { count: 'exact' })
      .eq('clinic_id', clinicId)
      .neq('status', 'cancelled');

    // Apply date filters if provided
    if (fromDate) {
      refundedQuery = refundedQuery.gte('treatment_date', fromDate);
      allTreatmentsQuery = allTreatmentsQuery.gte('treatment_date', fromDate);
    }
    if (toDate) {
      refundedQuery = refundedQuery.lte('treatment_date', toDate);
      allTreatmentsQuery = allTreatmentsQuery.lte('treatment_date', toDate);
    }

    const [refundedResult, allTreatmentsResult] = await Promise.all([
      refundedQuery,
      allTreatmentsQuery
    ]);

    if (refundedResult.error) {
      console.error('Error fetching refunded treatments:', refundedResult.error);
      return NextResponse.json({ error: 'Failed to fetch refund statistics' }, { status: 500 });
    }

    const refundedTreatments = refundedResult.data || [];
    const totalTreatments = allTreatmentsResult.count || 0;

    // Calculate statistics
    let totalMaterialLoss = 0;
    let totalTimeLoss = 0;
    let totalOriginalPrice = 0;

    for (const treatment of refundedTreatments) {
      const variableCost = treatment.variable_cost_cents || 0;
      const fixedCostPerMinute = treatment.fixed_cost_per_minute_cents || 0;
      const minutes = treatment.duration_minutes || 0;
      const fixedCost = fixedCostPerMinute * minutes;

      totalMaterialLoss += variableCost;
      totalTimeLoss += fixedCost;
      totalOriginalPrice += treatment.price_cents || 0;
    }

    const totalLoss = totalMaterialLoss + totalTimeLoss;
    const refundCount = refundedTreatments.length;
    const refundRate = totalTreatments > 0 ? (refundCount / totalTreatments) * 100 : 0;
    const avgLossPerRefund = refundCount > 0 ? totalLoss / refundCount : 0;

    // Get refunds by month for trend analysis (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: trendData } = await supabaseAdmin
      .from('treatments')
      .select('refunded_at, variable_cost_cents, duration_minutes, fixed_cost_per_minute_cents')
      .eq('clinic_id', clinicId)
      .eq('is_refunded', true)
      .gte('refunded_at', sixMonthsAgo.toISOString())
      .order('refunded_at', { ascending: true });

    // Group by month
    const monthlyTrend: Record<string, { count: number; loss: number }> = {};
    for (const treatment of trendData || []) {
      if (treatment.refunded_at) {
        const monthKey = treatment.refunded_at.substring(0, 7); // YYYY-MM
        if (!monthlyTrend[monthKey]) {
          monthlyTrend[monthKey] = { count: 0, loss: 0 };
        }
        monthlyTrend[monthKey].count += 1;
        const variableCost = treatment.variable_cost_cents || 0;
        const fixedCostPerMinute = treatment.fixed_cost_per_minute_cents || 0;
        const minutes = treatment.duration_minutes || 0;
        monthlyTrend[monthKey].loss += variableCost + (fixedCostPerMinute * minutes);
      }
    }

    return NextResponse.json({
      data: {
        refund_count: refundCount,
        total_treatments: totalTreatments,
        refund_rate: Math.round(refundRate * 100) / 100, // Round to 2 decimals
        total_loss_cents: totalLoss,
        material_loss_cents: totalMaterialLoss,
        time_loss_cents: totalTimeLoss,
        avg_loss_per_refund_cents: Math.round(avgLossPerRefund),
        total_original_price_cents: totalOriginalPrice,
        monthly_trend: Object.entries(monthlyTrend).map(([month, data]) => ({
          month,
          count: data.count,
          loss_cents: data.loss
        }))
      }
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/analytics/refunds:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
