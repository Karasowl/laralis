import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { listConvexDocumentsByClinic } from '@/lib/convex/server';
import { shouldReturnConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>;

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row;
  return rest;
}

/**
 * Replicates the exact Supabase aggregation used by the refunds analytics route.
 *
 * Supabase reads (all against `treatments`, no joins):
 *   1. refunded set:   .eq('is_refunded', true) [+ optional treatment_date gte/lte]
 *   2. all-count:      .neq('status', 'cancelled') [+ optional treatment_date gte/lte], { count: 'exact' }
 *   3. trend set:      .eq('is_refunded', true).gte('refunded_at', sixMonthsAgoISO).order('refunded_at' asc)
 *
 * Date columns (treatment_date) are ISO date strings (YYYY-MM-DD) and `refunded_at`
 * is a full ISO timestamp string, so lexicographic string comparison matches the
 * Postgres range filtering for the same formats. Money stays in integer cents and
 * the rounding mirrors the Supabase path exactly.
 */
async function getRefundStatsFromConvex(
  clinicId: string,
  fromDate: string | null,
  toDate: string | null,
) {
  const rows = (await listConvexDocumentsByClinic('treatments', clinicId, 10000)) as ImportedRecord[];

  const inDateRange = (row: ImportedRecord) => {
    const treatmentDate = String(row.treatment_date || '');
    if (fromDate && treatmentDate < fromDate) return false;
    if (toDate && treatmentDate > toDate) return false;
    return true;
  };

  // Query 1: refunded treatments (is_refunded = true) within optional date range
  const refundedTreatments = rows
    .filter((row) => row.is_refunded === true && inDateRange(row))
    .map(normalizeConvexRecord);

  // Query 2: all treatments count (status != 'cancelled') within optional date range.
  // Postgres `.neq('status', 'cancelled')` excludes NULL-status rows (NULL <> x is NULL),
  // so mirror that by requiring status to be non-null AND not 'cancelled'.
  const totalTreatments = rows.filter(
    (row) => row.status != null && row.status !== 'cancelled' && inDateRange(row),
  ).length;

  // Query 3: refund trend (last 6 months by refunded_at)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoISO = sixMonthsAgo.toISOString();

  const trendData = rows
    .filter((row) => {
      if (row.is_refunded !== true) return false;
      const refundedAt = String(row.refunded_at || '');
      return refundedAt !== '' && refundedAt >= sixMonthsAgoISO;
    })
    .map(normalizeConvexRecord)
    .sort((a, b) => String(a.refunded_at || '').localeCompare(String(b.refunded_at || '')));

  return { refundedTreatments, totalTreatments, trendData };
}

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
    const { searchParams } = new URL(request.url);
    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    });

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status });
    }

    const { clinicId, userId } = clinicContext;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'financial_reports.view');
    if (forbidden) return forbidden;

    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    let refundedTreatments: ImportedRecord[] = [];
    let totalTreatments = 0;
    let trendData: ImportedRecord[] = [];

    if (shouldReturnConvexData('treatments')) {
      const convexStats = await getRefundStatsFromConvex(clinicId, fromDate, toDate);
      refundedTreatments = convexStats.refundedTreatments;
      totalTreatments = convexStats.totalTreatments;
      trendData = convexStats.trendData;
    } else {
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

      refundedTreatments = refundedResult.data || [];
      totalTreatments = allTreatmentsResult.count || 0;

      // Get refunds by month for trend analysis (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: supabaseTrendData } = await supabaseAdmin
        .from('treatments')
        .select('refunded_at, variable_cost_cents, duration_minutes, fixed_cost_per_minute_cents')
        .eq('clinic_id', clinicId)
        .eq('is_refunded', true)
        .gte('refunded_at', sixMonthsAgo.toISOString())
        .order('refunded_at', { ascending: true });

      trendData = supabaseTrendData || [];
    }

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

    // Group by month (trend data fetched above per the active data backend)
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
