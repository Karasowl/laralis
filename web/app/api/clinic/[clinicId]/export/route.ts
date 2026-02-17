/**
 * Clinic Data Export API
 *
 * Flexible endpoint to export clinic data for external AI integration.
 * Supports three export types:
 * - snapshot: Optimized for AI (~100KB) - includes analytics
 * - full: Complete data (~5MB) - all records from all tables
 * - both: Combines snapshot + full data
 *
 * @example GET /api/clinic/:clinicId/export?type=snapshot
 * @example GET /api/clinic/:clinicId/export?type=full
 * @example GET /api/clinic/:clinicId/export?type=both&period=60
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ClinicSnapshotService } from '@/lib/ai/ClinicSnapshotService'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Types for export
interface ExportMetadata {
  version: string
  exportDate: string
  clinicId: string
  clinicName: string
  exportType: 'snapshot' | 'full' | 'both'
  period?: number
  recordCounts: Record<string, number>
}

interface FullExportData {
  // Clinic configuration
  clinic: any
  settings_time: any
  // Categories
  categories: any[]
  custom_categories: any[]
  // Patients & Sources
  patients: any[]
  patient_sources: any[]
  // Treatments (with full details for per-patient analysis)
  treatments: any[]
  // Services & Recipes
  services: any[]
  supplies: any[]
  service_supplies: any[]
  // Financials
  expenses: any[]
  fixed_costs: any[]
  assets: any[]
  // Marketing
  marketing_campaigns: any[]
  marketing_campaign_status_history: any[]
}

interface ExportResponse {
  metadata: ExportMetadata
  snapshot?: any // ClinicSnapshot for AI
  data?: FullExportData // Full records
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  try {
    const { clinicId } = await params
    const searchParams = request.nextUrl.searchParams
    const exportType = (searchParams.get('type') || 'snapshot') as 'snapshot' | 'full' | 'both'
    const period = parseInt(searchParams.get('period') || '30', 10)

    // Validate export type
    if (!['snapshot', 'full', 'both'].includes(exportType)) {
      return NextResponse.json(
        { error: 'Invalid export type. Use: snapshot, full, or both' },
        { status: 400 }
      )
    }

    // Verify authentication and clinic access using the standard pattern
    const cookieStore = await cookies()
    const clinicContext = await resolveClinicContext({
      requestedClinicId: clinicId,
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      )
    }

    // Verify the requested clinicId matches the resolved one
    if (clinicContext.clinicId !== clinicId) {
      return NextResponse.json(
        { error: 'Access denied to this clinic' },
        { status: 403 }
      )
    }

    // Get clinic name (using supabaseAdmin after auth verification)
    const { data: clinic } = await supabaseAdmin
      .from('clinics')
      .select('name')
      .eq('id', clinicId)
      .single()

    // Initialize response
    const response: ExportResponse = {
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        clinicId,
        clinicName: clinic?.name || 'Unknown',
        exportType,
        period,
        recordCounts: {}
      }
    }

    // Generate snapshot if needed
    if (exportType === 'snapshot' || exportType === 'both') {
      const snapshotService = new ClinicSnapshotService()
      const snapshot = await snapshotService.getFullSnapshot(supabaseAdmin, clinicId, {
        period,
        forceRefresh: true
      })
      response.snapshot = snapshot

      // Update record counts from snapshot
      response.metadata.recordCounts.patients_summary = snapshot.data?.patients?.total || 0
      response.metadata.recordCounts.treatments_summary = snapshot.data?.treatments?.total || 0
      response.metadata.recordCounts.services_summary = snapshot.data?.services?.total || 0
    }

    // Generate full data if needed
    if (exportType === 'full' || exportType === 'both') {
      const fullData = await loadFullClinicData(clinicId)
      response.data = fullData

      // Update record counts
      response.metadata.recordCounts.clinic = fullData.clinic ? 1 : 0
      response.metadata.recordCounts.settings_time = fullData.settings_time ? 1 : 0
      response.metadata.recordCounts.categories = fullData.categories.length
      response.metadata.recordCounts.custom_categories = fullData.custom_categories.length
      response.metadata.recordCounts.patients = fullData.patients.length
      response.metadata.recordCounts.patient_sources = fullData.patient_sources.length
      response.metadata.recordCounts.treatments = fullData.treatments.length
      response.metadata.recordCounts.services = fullData.services.length
      response.metadata.recordCounts.supplies = fullData.supplies.length
      response.metadata.recordCounts.service_supplies = fullData.service_supplies.length
      response.metadata.recordCounts.expenses = fullData.expenses.length
      response.metadata.recordCounts.fixed_costs = fullData.fixed_costs.length
      response.metadata.recordCounts.assets = fullData.assets.length
      response.metadata.recordCounts.marketing_campaigns = fullData.marketing_campaigns.length
      response.metadata.recordCounts.marketing_campaign_status_history = fullData.marketing_campaign_status_history.length
    }

    // Return with appropriate headers for download
    const filename = `clinic-export-${clinicId.slice(0, 8)}-${exportType}-${new Date().toISOString().slice(0, 10)}.json`

    return new NextResponse(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Export-Type': exportType,
        'X-Record-Count': Object.values(response.metadata.recordCounts).reduce((a, b) => a + b, 0).toString()
      }
    })

  } catch (error) {
    console.error('[Clinic Export] Error:', error)
    return NextResponse.json(
      { error: 'Failed to export clinic data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Load all clinic data from database (full export)
 * Uses supabaseAdmin to bypass RLS after access verification
 */
async function loadFullClinicData(clinicId: string): Promise<FullExportData> {
  console.info('[AI Export] Loading full clinic data for:', clinicId)

  // Run all queries in parallel for performance
  const [
    clinicResult,
    timeSettingsResult,
    categoriesResult,
    customCategoriesResult,
    patientsResult,
    sourcesResult,
    treatmentsResult,
    servicesResult,
    suppliesResult,
    serviceSuppliesResult,
    expensesResult,
    fixedCostsResult,
    assetsResult,
    campaignsResult,
    campaignHistoryResult
  ] = await Promise.all([
    // Clinic - full record with global discount config
    supabaseAdmin
      .from('clinics')
      .select('*')
      .eq('id', clinicId)
      .single(),

    // Time settings
    supabaseAdmin
      .from('settings_time')
      .select('*')
      .eq('clinic_id', clinicId)
      .single(),

    // Categories (generic) - may be null for clinic_id
    supabaseAdmin
      .from('categories')
      .select('*')
      .or(`clinic_id.eq.${clinicId},clinic_id.is.null`)
      .order('name'),

    // Custom categories
    supabaseAdmin
      .from('custom_categories')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Patients - simplified query first, then enrich
    supabaseAdmin
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false }),

    // Patient sources
    supabaseAdmin
      .from('patient_sources')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Treatments - simplified query
    supabaseAdmin
      .from('treatments')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('treatment_date', { ascending: false }),

    // Services - simplified query
    supabaseAdmin
      .from('services')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Supplies - inventory
    supabaseAdmin
      .from('supplies')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Service-Supply relationships (recipes)
    supabaseAdmin
      .from('service_supplies')
      .select('*')
      .eq('clinic_id', clinicId),

    // Expenses
    supabaseAdmin
      .from('expenses')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('expense_date', { ascending: false }),

    // Fixed costs (note: column is 'concept', not 'name')
    supabaseAdmin
      .from('fixed_costs')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('concept'),

    // Assets
    supabaseAdmin
      .from('assets')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Marketing campaigns - full data
    supabaseAdmin
      .from('marketing_campaigns')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false }),

    // Marketing campaign status history - need different approach
    supabaseAdmin
      .from('marketing_campaign_status_history')
      .select('*')
  ])

  // Log any errors with full details
  if (patientsResult.error) console.error('[AI Export] Patients error:', patientsResult.error)
  if (treatmentsResult.error) console.error('[AI Export] Treatments error:', treatmentsResult.error)
  if (servicesResult.error) console.error('[AI Export] Services error:', servicesResult.error)
  if (expensesResult.error) console.error('[AI Export] Expenses error:', expensesResult.error)
  if (fixedCostsResult.error) console.error('[AI Export] Fixed costs error:', fixedCostsResult.error)
  if (assetsResult.error) console.error('[AI Export] Assets error:', assetsResult.error)
  if (suppliesResult.error) console.error('[AI Export] Supplies error:', suppliesResult.error)
  if (categoriesResult.error) console.error('[AI Export] Categories error:', categoriesResult.error)
  if (customCategoriesResult.error) console.error('[AI Export] Custom categories error:', customCategoriesResult.error)
  if (sourcesResult.error) console.error('[AI Export] Sources error:', sourcesResult.error)
  if (serviceSuppliesResult.error) console.error('[AI Export] Service supplies error:', serviceSuppliesResult.error)
  if (campaignsResult.error) console.error('[AI Export] Campaigns error:', campaignsResult.error)


  console.info('[AI Export] Results:', {
    patients: patientsResult.data?.length || 0,
    treatments: treatmentsResult.data?.length || 0,
    services: servicesResult.data?.length || 0,
    supplies: suppliesResult.data?.length || 0,
    expenses: expensesResult.data?.length || 0,
    fixedCosts: fixedCostsResult.data?.length || 0,
    assets: assetsResult.data?.length || 0,
    campaigns: campaignsResult.data?.length || 0,
  })

  // Get campaign IDs for filtering status history
  const campaignIds = (campaignsResult.data || []).map((c: any) => c.id)
  const filteredHistory = (campaignHistoryResult.data || []).filter(
    (h: any) => campaignIds.includes(h.campaign_id)
  )

  // Enrich patients with campaign and source names
  const campaigns = campaignsResult.data || []
  const sources = sourcesResult.data || []
  const enrichedPatients = (patientsResult.data || []).map((patient: any) => ({
    ...patient,
    campaign_name: campaigns.find((c: any) => c.id === patient.campaign_id)?.name || null,
    source_name: sources.find((s: any) => s.id === patient.source_id)?.name || null,
  }))

  // Enrich treatments with service and patient names
  const services = servicesResult.data || []
  const patients = patientsResult.data || []
  const enrichedTreatments = (treatmentsResult.data || []).map((treatment: any) => {
    const patient = patients.find((p: any) => p.id === treatment.patient_id)
    const patientName = patient
      ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || patient.name || null
      : null
    return {
      ...treatment,
      service_name: services.find((s: any) => s.id === treatment.service_id)?.name || null,
      patient_name: patientName,
    }
  })

  // Enrich services with category names
  const customCategories = customCategoriesResult.data || []
  const enrichedServices = (servicesResult.data || []).map((service: any) => ({
    ...service,
    category_name: customCategories.find((c: any) => c.id === service.category_id)?.name || null,
  }))

  return {
    // Clinic configuration
    clinic: clinicResult.data || null,
    settings_time: timeSettingsResult.data || null,
    // Categories
    categories: categoriesResult.data || [],
    custom_categories: customCategoriesResult.data || [],
    // Patients & Sources
    patients: enrichedPatients,
    patient_sources: sourcesResult.data || [],
    // Treatments
    treatments: enrichedTreatments,
    // Services & Recipes
    services: enrichedServices,
    supplies: suppliesResult.data || [],
    service_supplies: serviceSuppliesResult.data || [],
    // Financials
    expenses: expensesResult.data || [],
    fixed_costs: fixedCostsResult.data || [],
    assets: assetsResult.data || [],
    // Marketing
    marketing_campaigns: campaignsResult.data || [],
    marketing_campaign_status_history: filteredHistory
  }
}
