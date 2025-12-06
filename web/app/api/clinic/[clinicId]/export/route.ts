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
  patients: any[]
  treatments: any[]
  services: any[]
  supplies: any[]
  service_supplies: any[]
  expenses: any[]
  fixed_costs: any[]
  assets: any[]
  custom_categories: any[]
  patient_sources: any[]
  marketing_campaigns: any[]
  settings_time: any
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
      response.metadata.recordCounts.patients = fullData.patients.length
      response.metadata.recordCounts.treatments = fullData.treatments.length
      response.metadata.recordCounts.services = fullData.services.length
      response.metadata.recordCounts.supplies = fullData.supplies.length
      response.metadata.recordCounts.service_supplies = fullData.service_supplies.length
      response.metadata.recordCounts.expenses = fullData.expenses.length
      response.metadata.recordCounts.fixed_costs = fullData.fixed_costs.length
      response.metadata.recordCounts.assets = fullData.assets.length
      response.metadata.recordCounts.custom_categories = fullData.custom_categories.length
      response.metadata.recordCounts.patient_sources = fullData.patient_sources.length
      response.metadata.recordCounts.marketing_campaigns = fullData.marketing_campaigns.length
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
  // Run all queries in parallel for performance
  const [
    patientsResult,
    treatmentsResult,
    servicesResult,
    suppliesResult,
    serviceSuppliesResult,
    expensesResult,
    fixedCostsResult,
    assetsResult,
    categoriesResult,
    sourcesResult,
    campaignsResult,
    timeSettingsResult
  ] = await Promise.all([
    // Patients - with campaign name and source name
    supabaseAdmin
      .from('patients')
      .select(`
        *,
        campaign:marketing_campaigns(name, platform),
        source:patient_sources(name)
      `)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false }),

    // Treatments - with service, patient, and campaign info
    supabaseAdmin
      .from('treatments')
      .select(`
        *,
        service:services(name, category_id),
        patient:patients(name, campaign_id, campaign:marketing_campaigns(name, platform))
      `)
      .eq('clinic_id', clinicId)
      .order('treatment_date', { ascending: false }),

    // Services - all pricing fields
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
      .select(`
        *,
        service:services(name),
        supply:supplies(name)
      `)
      .eq('clinic_id', clinicId),

    // Expenses - with campaign name if linked
    supabaseAdmin
      .from('expenses')
      .select(`
        *,
        campaign:marketing_campaigns(name, platform)
      `)
      .eq('clinic_id', clinicId)
      .order('expense_date', { ascending: false }),

    // Fixed costs
    supabaseAdmin
      .from('fixed_costs')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Assets
    supabaseAdmin
      .from('assets')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Custom categories
    supabaseAdmin
      .from('custom_categories')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Patient sources
    supabaseAdmin
      .from('patient_sources')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Marketing campaigns - full data
    supabaseAdmin
      .from('marketing_campaigns')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false }),

    // Time settings
    supabaseAdmin
      .from('settings_time')
      .select('*')
      .eq('clinic_id', clinicId)
      .single()
  ])

  return {
    patients: patientsResult.data || [],
    treatments: treatmentsResult.data || [],
    services: servicesResult.data || [],
    supplies: suppliesResult.data || [],
    service_supplies: serviceSuppliesResult.data || [],
    expenses: expensesResult.data || [],
    fixed_costs: fixedCostsResult.data || [],
    assets: assetsResult.data || [],
    custom_categories: categoriesResult.data || [],
    patient_sources: sourcesResult.data || [],
    marketing_campaigns: campaignsResult.data || [],
    settings_time: timeSettingsResult.data || null
  }
}
