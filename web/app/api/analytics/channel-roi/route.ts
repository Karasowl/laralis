import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { calculateROI } from '@/lib/calc/marketing'
import { getFirstTreatmentDateByPatient } from '@/lib/calc/patient-acquisition'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/channel-roi
 *
 * Calcula el ROI (Return on Investment) por CAMPAÑA de marketing
 * Compara inversión en marketing vs ingresos generados por campaña específica
 *
 * IMPORTANT: This API shows ROI for marketing_campaigns (real campaigns created by user),
 * NOT patient_sources (dummy data auto-created by triggers).
 *
 * Query params:
 * - clinicId: UUID (opcional, se obtiene del contexto)
 * - period: number (días, default: 30)
 * - startDate: YYYY-MM-DD (optional)
 * - endDate: YYYY-MM-DD (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const searchParams = request.nextUrl.searchParams

    // Resolver contexto de clínica
    const ctx = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore
    })

    if ('error' in ctx) {
      return NextResponse.json(
        { error: ctx.error.message },
        { status: ctx.error.status }
      )
    }

    const { clinicId } = ctx

    // Parse date range - supports explicit dates or period lookback
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const period = parseInt(searchParams.get('period') || '30', 10)

    let startDate: Date
    let endDate: Date
    let startDateStr: string
    let endDateStr: string

    if (startDateParam && endDateParam) {
      // Use explicit date range
      startDateStr = startDateParam
      endDateStr = endDateParam
      startDate = new Date(startDateParam)
      endDate = new Date(endDateParam)
    } else {
      // Fall back to period lookback
      endDate = new Date()
      startDate = new Date()
      startDate.setDate(startDate.getDate() - period)
      startDateStr = startDate.toISOString().split('T')[0]
      endDateStr = endDate.toISOString().split('T')[0]
    }

    console.info('[channel-roi] Fetching for clinic:', clinicId)
    console.info('[channel-roi] Date range:', startDateStr, 'to', endDateStr)

    // 1. Get user's REAL marketing campaigns (NOT dummy patient_sources)
    // Use .or() to handle NULL values - campaigns might have is_archived = null
    // Only select columns known to exist in production schema. The
    // marketing_campaigns table on prod does NOT have description /
    // start_date / end_date columns; selecting them caused 42703 errors.
    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('marketing_campaigns')
      .select('id, name, code, platform_id, is_active')
      .eq('clinic_id', clinicId)
      .or('is_archived.is.null,is_archived.eq.false')

    if (campaignsError) {
      console.error('[channel-roi] Error fetching campaigns:', campaignsError)
      throw campaignsError
    }

    console.info('[channel-roi] Found campaigns:', campaigns?.length || 0)

    // If no campaigns exist, return empty state with helpful message
    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        period,
        dateRange: {
          start: startDateStr,
          end: endDateStr
        },
        channels: [],
        isEmpty: true,
        message: 'no_campaigns',
        summary: {
          totalPatients: 0,
          totalMarketingExpensesCents: 0,
          bestChannel: null,
          worstChannel: null
        }
      })
    }

    // 2. Get all patients linked to campaigns (no date filter — we'll
    //    filter in-memory by the patient's FIRST treatment date, which is
    //    the dashboard's definition of "new patient").
    const { data: patientsLinked, error: patientsError } = await supabaseAdmin
      .from('patients')
      .select('id, campaign_id')
      .eq('clinic_id', clinicId)
      .not('campaign_id', 'is', null)

    if (patientsError) {
      console.error('[channel-roi] Error fetching patients:', patientsError)
      throw patientsError
    }

    const linkedIds = (patientsLinked || []).map((p: any) => p.id)
    const firstTreatmentByPatient = await getFirstTreatmentDateByPatient(clinicId, {
      patientIds: linkedIds,
    })

    // Keep only the patients whose first treatment falls inside the range.
    // If a campaign-linked patient has no treatments at all (firstTreatment
    // is undefined) they don't count as an acquired patient for this period.
    const patients = (patientsLinked || []).filter((p: any) => {
      const iso = firstTreatmentByPatient.get(p.id)
      return iso !== undefined && iso >= startDateStr && iso <= endDateStr
    })

    // 3. Get revenue from treatments of these patients
    const patientIds = (patients || []).map((p: any) => p.id)

    const { data: treatments, error: treatmentsError } = patientIds.length > 0
      ? await supabaseAdmin
          .from('treatments')
          .select('patient_id, price_cents')
          .eq('clinic_id', clinicId)
          .eq('status', 'completed')
          .in('patient_id', patientIds)
      : { data: [], error: null }

    if (treatmentsError) {
      console.error('[channel-roi] Error fetching treatments:', treatmentsError)
      throw treatmentsError
    }

    // 4. Get marketing expenses linked to campaigns
    const { data: campaignExpenses, error: expensesError } = await supabaseAdmin
      .from('expenses')
      .select('amount_cents, campaign_id')
      .eq('clinic_id', clinicId)
      .not('campaign_id', 'is', null)
      .gte('expense_date', startDateStr)
      .lte('expense_date', endDateStr)

    if (expensesError) {
      console.error('[channel-roi] Error fetching expenses:', expensesError)
      throw expensesError
    }

    // Also get total marketing expenses for campaigns without direct links.
    // Done in two steps (instead of `categories!inner(name)` join) because the
    // implicit FK join was triggering PostgREST "multiple relationships" or
    // "relationship not found" errors on some schemas and caused the whole
    // endpoint to 500. Two explicit queries are both safer and easier to debug.
    const { data: marketingCategories, error: marketingCatError } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('name', 'marketing')

    if (marketingCatError) {
      console.error('[channel-roi] Error fetching marketing category:', marketingCatError)
    }

    const marketingCategoryIds = (marketingCategories || []).map((c: any) => c.id)

    let totalMarketingExpenses = 0
    if (marketingCategoryIds.length > 0) {
      const { data: allMarketingExpenses, error: allExpensesError } = await supabaseAdmin
        .from('expenses')
        .select('amount_cents')
        .eq('clinic_id', clinicId)
        .in('category_id', marketingCategoryIds)
        .gte('expense_date', startDateStr)
        .lte('expense_date', endDateStr)

      if (allExpensesError) {
        console.error('[channel-roi] Error fetching all marketing expenses:', allExpensesError)
      }

      totalMarketingExpenses = (allMarketingExpenses || [])
        .reduce((sum: number, e: any) => sum + (e.amount_cents || 0), 0)
    }

    console.info('[channel-roi] Total marketing expenses:', totalMarketingExpenses)

    // 5. Calculate metrics per CAMPAIGN (not patient_source)
    const totalPatients = (patients || []).length
    const channelMetrics = (campaigns || []).map((campaign: any) => {
      // Patients from this campaign
      const campaignPatients = (patients || [])
        .filter((p: any) => p.campaign_id === campaign.id)

      const campaignPatientCount = campaignPatients.length
      const campaignPatientIds = campaignPatients.map((p: any) => p.id)

      // Revenue from this campaign's patients
      const campaignRevenue = (treatments || [])
        .filter((t: any) => campaignPatientIds.includes(t.patient_id))
        .reduce((sum: number, t: any) => sum + (t.price_cents || 0), 0)

      // Investment: prefer direct expense link, fallback to proportional distribution
      const directExpenses = (campaignExpenses || [])
        .filter((e: any) => e.campaign_id === campaign.id)
        .reduce((sum: number, e: any) => sum + (e.amount_cents || 0), 0)

      const campaignInvestment = directExpenses > 0
        ? directExpenses
        : totalPatients > 0
          ? Math.round((campaignPatientCount / totalPatients) * totalMarketingExpenses)
          : 0

      // Calculate ROI
      const roi = calculateROI(campaignRevenue, campaignInvestment)

      return {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          code: campaign.code,
          isActive: campaign.is_active
        },
        patients: campaignPatientCount,
        revenueCents: campaignRevenue,
        investmentCents: campaignInvestment,
        roi: {
          value: roi,
          formatted: `${roi.toFixed(1)}%`
        }
      }
    })

    // Sort by ROI descending
    const sortedChannels = channelMetrics.sort((a, b) => b.roi.value - a.roi.value)

    // Identify best and worst campaigns
    const bestChannel = sortedChannels.find(c => c.patients > 0) || sortedChannels[0]
    const worstChannel = [...sortedChannels].reverse().find(c => c.patients > 0) || sortedChannels[sortedChannels.length - 1]

    console.info('[channel-roi] Best campaign:', bestChannel?.campaign.name, bestChannel?.roi.value)
    console.info('[channel-roi] Worst campaign:', worstChannel?.campaign.name, worstChannel?.roi.value)

    return NextResponse.json({
      period,
      dateRange: {
        start: startDateStr,
        end: endDateStr
      },
      channels: sortedChannels,
      isEmpty: false,
      summary: {
        totalPatients,
        totalMarketingExpensesCents: totalMarketingExpenses,
        bestChannel: bestChannel ? {
          name: bestChannel.campaign.name,
          roi: bestChannel.roi.value,
          patients: bestChannel.patients
        } : null,
        worstChannel: worstChannel ? {
          name: worstChannel.campaign.name,
          roi: worstChannel.roi.value,
          patients: worstChannel.patients
        } : null
      }
    })

  } catch (error: any) {
    console.error('[channel-roi] Error:', error)
    // Supabase errors are plain objects, not Error instances. Serialize
    // them explicitly so the response carries something useful (message,
    // details, hint, code) instead of the default "[object Object]".
    const detail = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : {
          message: error?.message ?? 'Unknown error',
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          raw: (() => {
            try { return JSON.stringify(error) } catch { return String(error) }
          })(),
        }
    return NextResponse.json(
      { error: 'Failed to calculate channel ROI', ...detail },
      { status: 500 }
    )
  }
}
