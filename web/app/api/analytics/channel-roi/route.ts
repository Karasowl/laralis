import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { calculateROI } from '@/lib/calc/marketing'

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

    console.log('[channel-roi] Fetching for clinic:', clinicId)
    console.log('[channel-roi] Date range:', startDateStr, 'to', endDateStr)

    // 1. Get user's REAL marketing campaigns (NOT dummy patient_sources)
    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('marketing_campaigns')
      .select(`
        id,
        name,
        code,
        description,
        platform_id,
        start_date,
        end_date,
        is_active
      `)
      .eq('clinic_id', clinicId)
      .eq('is_archived', false)

    if (campaignsError) {
      console.error('[channel-roi] Error fetching campaigns:', campaignsError)
      throw campaignsError
    }

    console.log('[channel-roi] Found campaigns:', campaigns?.length || 0)

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

    // 2. Get patients linked to campaigns (via campaign_id)
    const { data: patients, error: patientsError } = await supabaseAdmin
      .from('patients')
      .select('id, campaign_id, created_at')
      .eq('clinic_id', clinicId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('campaign_id', 'is', null)

    if (patientsError) {
      console.error('[channel-roi] Error fetching patients:', patientsError)
      throw patientsError
    }

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

    // Also get total marketing expenses for campaigns without direct links
    const { data: allMarketingExpenses, error: allExpensesError } = await supabaseAdmin
      .from('expenses')
      .select('amount_cents, category_id, categories!inner(name)')
      .eq('clinic_id', clinicId)
      .gte('expense_date', startDateStr)
      .lte('expense_date', endDateStr)

    if (allExpensesError) {
      console.error('[channel-roi] Error fetching all expenses:', allExpensesError)
    }

    const totalMarketingExpenses = (allMarketingExpenses || [])
      .filter((e: any) => e.categories?.name === 'marketing')
      .reduce((sum: number, e: any) => sum + (e.amount_cents || 0), 0)

    console.log('[channel-roi] Total marketing expenses:', totalMarketingExpenses)

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
          description: campaign.description,
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

    console.log('[channel-roi] Best campaign:', bestChannel?.campaign.name, bestChannel?.roi.value)
    console.log('[channel-roi] Worst campaign:', worstChannel?.campaign.name, worstChannel?.roi.value)

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

  } catch (error) {
    console.error('[channel-roi] Error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate channel ROI' },
      { status: 500 }
    )
  }
}
