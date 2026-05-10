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
import { forbiddenIfMissingPermission } from '@/lib/permissions'

// Types for export
type ExportRow = Record<string, unknown> & {
  id?: string
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  workspace_id?: string | null
  campaign_id?: string | null
  source_id?: string | null
  patient_id?: string | null
  service_id?: string | null
  category_id?: string | null
}

type ExportError = {
  code?: string
  message?: string
}

type DynamicQueryResult<T> = PromiseLike<{
  data: T | null
  error: ExportError | null
}>

type DynamicRowsQuery = DynamicQueryResult<ExportRow[]> & {
  eq(column: string, value: string): DynamicRowsQuery
  in(column: string, values: string[]): DynamicRowsQuery
  maybeSingle(): DynamicQueryResult<ExportRow | null>
}

type DynamicSupabaseClient = {
  from(table: string): {
    select(columns: string): DynamicRowsQuery
  }
}

const dynamicSupabase = supabaseAdmin as unknown as DynamicSupabaseClient

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
  clinic: ExportRow | null
  settings_time: ExportRow | null
  clinic_google_calendar: ExportRow | null
  // Categories
  categories: ExportRow[]
  custom_categories: ExportRow[]
  // Patients & Sources
  patients: ExportRow[]
  patient_sources: ExportRow[]
  clinic_users: ExportRow[]
  invitations: ExportRow[]
  custom_role_templates: ExportRow[]
  // Treatments (with full details for per-patient analysis)
  treatments: ExportRow[]
  // Services & Recipes
  services: ExportRow[]
  supplies: ExportRow[]
  service_supplies: ExportRow[]
  // Financials
  expenses: ExportRow[]
  fixed_costs: ExportRow[]
  assets: ExportRow[]
  // Marketing
  marketing_campaigns: ExportRow[]
  marketing_campaign_status_history: ExportRow[]
  marketing_campaign_channels: ExportRow[]
  leads: ExportRow[]
  inbox_conversations: ExportRow[]
  inbox_messages: ExportRow[]
  // Public booking
  public_booking_services: ExportRow[]
  public_bookings: ExportRow[]
  booking_blocked_slots: ExportRow[]
  // Notifications
  email_notifications: ExportRow[]
  sms_notifications: ExportRow[]
  whatsapp_templates: ExportRow[]
  whatsapp_notifications: ExportRow[]
  scheduled_reminders: ExportRow[]
  push_subscriptions: ExportRow[]
  push_notifications: ExportRow[]
  notification_retry_queue: ExportRow[]
  // AI assistant
  action_logs: ExportRow[]
  chat_sessions: ExportRow[]
  chat_messages: ExportRow[]
  ai_feedback: ExportRow[]
  // Medical records and quotes
  medications: ExportRow[]
  prescriptions: ExportRow[]
  prescription_items: ExportRow[]
  quotes: ExportRow[]
  quote_items: ExportRow[]
}

interface ExportResponse {
  metadata: ExportMetadata
  snapshot?: unknown // ClinicSnapshot for AI
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

    const forbidden = await forbiddenIfMissingPermission(
      clinicContext.userId,
      clinicContext.clinicId,
      'export_import.export'
    )
    if (forbidden) return forbidden

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

      response.metadata.recordCounts = {
        ...response.metadata.recordCounts,
        ...countFullExportRecords(fullData),
      }
    }

    // Return with appropriate headers for download
    const filename = `clinic-export-${clinicId.slice(0, 8)}-${exportType}-${new Date().toISOString().slice(0, 10)}.json`

    const pretty = searchParams.get('pretty') === '1'

    return new NextResponse(JSON.stringify(response, null, pretty ? 2 : 0), {
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

function countFullExportRecords(data: FullExportData): Record<string, number> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.length : value ? 1 : 0,
    ])
  )
}

function logExportError(table: string, error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message)
    : String(error)
  console.error(`[AI Export] ${table} error:`, message)
}

function isMissingTableOrColumn(error: ExportError | null | undefined) {
  const message = error?.message || ''
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /Could not find the table/i.test(message) ||
    /Could not find the .* column/i.test(message) ||
    /relation .* does not exist/i.test(message)
  )
}

async function selectClinicRows(table: string, clinicId: string): Promise<ExportRow[]> {
  const { data, error } = await dynamicSupabase
    .from(table)
    .select('*')
    .eq('clinic_id', clinicId)

  if (error) {
    logExportError(table, error)
    return []
  }

  return data || []
}

async function selectWorkspaceRows(table: string, workspaceId?: string | null): Promise<ExportRow[]> {
  if (!workspaceId) return []

  const { data, error } = await dynamicSupabase
    .from(table)
    .select('*')
    .eq('workspace_id', workspaceId)

  if (error) {
    if (!isMissingTableOrColumn(error)) logExportError(table, error)
    return []
  }

  return data || []
}

async function selectRowsByIds(
  table: string,
  column: string,
  ids: Array<string | null | undefined>
): Promise<ExportRow[]> {
  const filteredIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))))
  if (!filteredIds.length) return []

  const { data, error } = await dynamicSupabase
    .from(table)
    .select('*')
    .in(column, filteredIds)

  if (error) {
    if (!isMissingTableOrColumn(error)) logExportError(table, error)
    return []
  }

  return data || []
}

async function selectServiceSuppliesByClinic(clinicId: string): Promise<ExportRow[]> {
  const { data: services, error } = await supabaseAdmin
    .from('services')
    .select('id')
    .eq('clinic_id', clinicId)

  if (error) {
    logExportError('service_supplies.services', error)
    return []
  }

  return selectRowsByIds(
    'service_supplies',
    'service_id',
    ((services || []) as ExportRow[]).map((service) => service.id)
  )
}

async function selectSingleByClinic(table: string, clinicId: string): Promise<ExportRow | null> {
  const { data, error } = await dynamicSupabase
    .from(table)
    .select('*')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (error) {
    if (!isMissingTableOrColumn(error)) logExportError(table, error)
    return null
  }

  return data || null
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
    serviceSupplies,
    expensesResult,
    fixedCostsResult,
    assetsResult,
    campaignsResult,
    campaignHistoryResult,
    clinicUsers,
    invitations,
    marketingCampaignChannels,
    leads,
    inboxConversations,
    publicBookingServices,
    publicBookings,
    bookingBlockedSlots,
    emailNotifications,
    smsNotifications,
    whatsappTemplates,
    whatsappNotifications,
    scheduledReminders,
    pushSubscriptions,
    pushNotifications,
    notificationRetryQueue,
    actionLogs,
    clinicGoogleCalendar,
    chatSessions,
    medications,
    prescriptions,
    quotes
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
    selectServiceSuppliesByClinic(clinicId),

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
      .select('*'),

    selectClinicRows('clinic_users', clinicId),
    selectClinicRows('invitations', clinicId),
    selectClinicRows('marketing_campaign_channels', clinicId),
    selectClinicRows('leads', clinicId),
    selectClinicRows('inbox_conversations', clinicId),
    selectClinicRows('public_booking_services', clinicId),
    selectClinicRows('public_bookings', clinicId),
    selectClinicRows('booking_blocked_slots', clinicId),
    selectClinicRows('email_notifications', clinicId),
    selectClinicRows('sms_notifications', clinicId),
    selectClinicRows('whatsapp_templates', clinicId),
    selectClinicRows('whatsapp_notifications', clinicId),
    selectClinicRows('scheduled_reminders', clinicId),
    selectClinicRows('push_subscriptions', clinicId),
    selectClinicRows('push_notifications', clinicId),
    selectClinicRows('notification_retry_queue', clinicId),
    selectClinicRows('action_logs', clinicId),
    selectSingleByClinic('clinic_google_calendar', clinicId),
    selectClinicRows('chat_sessions', clinicId),
    supabaseAdmin
      .from('medications')
      .select('*')
      .or(`clinic_id.eq.${clinicId},clinic_id.is.null`),
    selectClinicRows('prescriptions', clinicId),
    selectClinicRows('quotes', clinicId)
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
    leads: leads.length,
    publicBookings: publicBookings.length,
    inboxConversations: inboxConversations.length,
  })

  // Get campaign IDs for filtering status history
  const campaignRows = (campaignsResult.data || []) as ExportRow[]
  const campaignIds = campaignRows.map((campaign) => campaign.id).filter((id): id is string => Boolean(id))
  const filteredHistory = ((campaignHistoryResult.data || []) as ExportRow[]).filter(
    (history) => typeof history.campaign_id === 'string' && campaignIds.includes(history.campaign_id)
  )

  // Enrich patients with campaign and source names
  const campaigns = campaignRows
  const sources = (sourcesResult.data || []) as ExportRow[]
  const clinic = (clinicResult.data || null) as ExportRow | null
  const chatMessages = await selectRowsByIds(
    'chat_messages',
    'session_id',
    chatSessions.map((session) => session.id)
  )
  const aiFeedback = await selectRowsByIds(
    'ai_feedback',
    'message_id',
    chatMessages.map((message) => message.id)
  )
  const inboxMessages = await selectRowsByIds(
    'inbox_messages',
    'conversation_id',
    inboxConversations.map((conversation) => conversation.id)
  )
  const prescriptionItems = await selectRowsByIds(
    'prescription_items',
    'prescription_id',
    prescriptions.map((prescription) => prescription.id)
  )
  const quoteItems = await selectRowsByIds(
    'quote_items',
    'quote_id',
    quotes.map((quote) => quote.id)
  )
  const customRoleTemplates = await selectWorkspaceRows('custom_role_templates', clinic?.workspace_id)
  const patientRows = (patientsResult.data || []) as ExportRow[]
  const enrichedPatients = patientRows.map((patient) => ({
    ...patient,
    campaign_name: campaigns.find((campaign) => campaign.id === patient.campaign_id)?.name || null,
    source_name: sources.find((source) => source.id === patient.source_id)?.name || null,
  }))

  // Enrich treatments with service and patient names
  const services = (servicesResult.data || []) as ExportRow[]
  const patients = patientRows
  const enrichedTreatments = ((treatmentsResult.data || []) as ExportRow[]).map((treatment) => {
    const patient = patients.find((row) => row.id === treatment.patient_id)
    const patientName = patient
      ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || patient.name || null
      : null
    return {
      ...treatment,
      service_name: services.find((service) => service.id === treatment.service_id)?.name || null,
      patient_name: patientName,
    }
  })

  // Enrich services with category names
  const customCategories = (customCategoriesResult.data || []) as ExportRow[]
  const enrichedServices = services.map((service) => ({
    ...service,
    category_name: customCategories.find((category) => category.id === service.category_id)?.name || null,
  }))

  return {
    // Clinic configuration
    clinic,
    settings_time: timeSettingsResult.data || null,
    clinic_google_calendar: clinicGoogleCalendar,
    // Categories
    categories: (categoriesResult.data || []) as ExportRow[],
    custom_categories: customCategories,
    // Patients & Sources
    patients: enrichedPatients,
    patient_sources: sourcesResult.data || [],
    clinic_users: clinicUsers,
    invitations,
    custom_role_templates: customRoleTemplates,
    // Treatments
    treatments: enrichedTreatments,
    // Services & Recipes
    services: enrichedServices,
    supplies: (suppliesResult.data || []) as ExportRow[],
    service_supplies: serviceSupplies,
    // Financials
    expenses: (expensesResult.data || []) as ExportRow[],
    fixed_costs: (fixedCostsResult.data || []) as ExportRow[],
    assets: (assetsResult.data || []) as ExportRow[],
    // Marketing
    marketing_campaigns: campaigns,
    marketing_campaign_status_history: filteredHistory,
    marketing_campaign_channels: marketingCampaignChannels,
    leads,
    inbox_conversations: inboxConversations,
    inbox_messages: inboxMessages,
    // Public booking
    public_booking_services: publicBookingServices,
    public_bookings: publicBookings,
    booking_blocked_slots: bookingBlockedSlots,
    // Notifications
    email_notifications: emailNotifications,
    sms_notifications: smsNotifications,
    whatsapp_templates: whatsappTemplates,
    whatsapp_notifications: whatsappNotifications,
    scheduled_reminders: scheduledReminders,
    push_subscriptions: pushSubscriptions,
    push_notifications: pushNotifications,
    notification_retry_queue: notificationRetryQueue,
    // AI assistant
    action_logs: actionLogs,
    chat_sessions: chatSessions,
    chat_messages: chatMessages,
    ai_feedback: aiFeedback,
    // Medical records and quotes
    medications: (medications.data || []) as ExportRow[],
    prescriptions,
    prescription_items: prescriptionItems,
    quotes,
    quote_items: quoteItems,
  }
}
