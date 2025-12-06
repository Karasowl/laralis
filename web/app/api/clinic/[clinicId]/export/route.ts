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
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { ClinicSnapshotService } from '@/lib/ai/ClinicSnapshotService'

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

    // Create authenticated Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore - cookies can only be modified in Server Actions or Route Handlers
            }
          },
        },
      }
    )

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify clinic access
    const { data: clinicAccess, error: accessError } = await supabase
      .from('clinic_users')
      .select('clinic_id')
      .eq('clinic_id', clinicId)
      .eq('user_id', user.id)
      .single()

    if (accessError || !clinicAccess) {
      return NextResponse.json(
        { error: 'Access denied to this clinic' },
        { status: 403 }
      )
    }

    // Get clinic name
    const { data: clinic } = await supabase
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
      const snapshot = await snapshotService.getFullSnapshot(supabase, clinicId, {
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
      const fullData = await loadFullClinicData(supabase, clinicId)
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
 */
async function loadFullClinicData(
  supabase: ReturnType<typeof createServerClient>,
  clinicId: string
): Promise<FullExportData> {
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
    timeSettingsResult
  ] = await Promise.all([
    // Patients - all fields
    supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false }),

    // Treatments - with service name
    supabase
      .from('treatments')
      .select(`
        *,
        service:services(name),
        patient:patients(name)
      `)
      .eq('clinic_id', clinicId)
      .order('treatment_date', { ascending: false }),

    // Services - all pricing fields
    supabase
      .from('services')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Supplies - inventory
    supabase
      .from('supplies')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Service-Supply relationships (recipes)
    supabase
      .from('service_supplies')
      .select(`
        *,
        service:services(name),
        supply:supplies(name)
      `)
      .eq('clinic_id', clinicId),

    // Expenses
    supabase
      .from('expenses')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('expense_date', { ascending: false }),

    // Fixed costs
    supabase
      .from('fixed_costs')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Assets
    supabase
      .from('assets')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Custom categories
    supabase
      .from('custom_categories')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Patient sources
    supabase
      .from('patient_sources')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name'),

    // Time settings
    supabase
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
    settings_time: timeSettingsResult.data || null
  }
}
