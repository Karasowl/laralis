import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const STAGE_REF = 'kafbqdliromcveojtdar'
const CONFIRMATION = 'laralis-stage'
const DEFAULT_PASSWORD = 'LaralisQA!2026'

const cwd = process.cwd()
const repoRoot = path.resolve(cwd, '..', '..')
const datasetPath = path.join(repoRoot, 'docs', 'qa', 'dataset.json')
const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const resetOnly = args.has('--reset-only')
const dryRun = args.has('--dry-run') || !apply

loadEnv(path.join(cwd, '.env.qa.local'))

const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'))

const warnings = []
let supabase

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const index = trimmed.indexOf('=')
    if (index === -1) continue

    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

function assertStageEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const allowNonStage = process.env.QA_ALLOW_NON_STAGE === '1'

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Put stage values in apps/dental/.env.qa.local or export them in the shell.'
    )
  }

  if (!apply) {
    return
  }

  if (process.env.QA_STAGE_SEED_CONFIRM !== CONFIRMATION) {
    throw new Error(`Refusing to write. Set QA_STAGE_SEED_CONFIRM=${CONFIRMATION} to seed stage.`)
  }

  if (!allowNonStage && !url.includes(STAGE_REF)) {
    throw new Error(`Refusing to write because NEXT_PUBLIC_SUPABASE_URL is not the known stage ref ${STAGE_REF}.`)
  }

  const jwtPayload = decodeJwtPayload(serviceRoleKey)
  if (!allowNonStage && jwtPayload?.ref && jwtPayload.ref !== STAGE_REF) {
    throw new Error(`Refusing to write because SUPABASE_SERVICE_ROLE_KEY belongs to ${jwtPayload.ref}, not ${STAGE_REF}.`)
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed while NODE_ENV=production.')
  }
}

function client() {
  if (!supabase) {
    assertStageEnv()
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  }

  return supabase
}

function log(message) {
  console.log(`[qa-stage-seed] ${message}`)
}

function membershipRole(role) {
  if (role === 'owner' || role === 'admin' || role === 'viewer') return role
  return 'editor'
}

function clinicRole(role) {
  if (role === 'owner') return 'admin'
  if (role === 'admin' || role === 'doctor' || role === 'assistant' || role === 'receptionist' || role === 'viewer') {
    return role
  }
  return 'viewer'
}

function isMissingTable(error) {
  return (
    error?.code === '42P01' ||
    /relation .* does not exist/i.test(error?.message || '') ||
    /Could not find the table/i.test(error?.message || '')
  )
}

function missingColumn(error) {
  const message = error?.message || ''
  const schemaCache = message.match(/Could not find the '([^']+)' column/)
  if (schemaCache) return schemaCache[1]

  const pgColumn = message.match(/column "([^"]+)" of relation/)
  if (pgColumn) return pgColumn[1]

  const newRecord = message.match(/record "new" has no field "([^"]+)"/)
  if (newRecord) return newRecord[1]

  const defaultOnly = message.match(/cannot insert a non-DEFAULT value into column "([^"]+)"/)
  if (defaultOnly) return defaultOnly[1]

  return null
}

function stripColumn(rows, column) {
  return rows.map(row => {
    const clone = { ...row }
    delete clone[column]
    return clone
  })
}

async function insertRows(table, rows, options = {}) {
  const { optional = false, select = '*' } = options
  if (!rows.length) return []
  if (dryRun) {
    log(`plan insert ${rows.length} row(s) into ${table}`)
    return rows.map((row, index) => ({ id: `dry-${table}-${index + 1}`, ...row }))
  }

  let activeRows = rows.map(row => ({ ...row }))
  const stripped = new Set()

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const { data, error } = await client().from(table).insert(activeRows).select(select)
    if (!error) return Array.isArray(data) ? data : data ? [data] : []

    if (optional && isMissingTable(error)) {
      warnings.push(`optional table missing: ${table}`)
      return []
    }

    const column = missingColumn(error)
    if (column && !stripped.has(column)) {
      stripped.add(column)
      activeRows = stripColumn(activeRows, column)
      warnings.push(`removed missing column ${table}.${column}`)
      continue
    }

    throw new Error(`Insert failed for ${table}: ${error.message}`)
  }

  throw new Error(`Insert failed for ${table}: too many schema-prune attempts`)
}

async function tryInsertRows(table, rows, options = {}) {
  try {
    return await insertRows(table, rows, options)
  } catch (error) {
    warnings.push(`optional insert skipped for ${table}: ${error.message}`)
    return []
  }
}

async function tryInsertRowsIndividually(table, rows, options = {}) {
  const inserted = []

  for (const row of rows) {
    const result = await tryInsertRows(table, [row], options)
    inserted.push(...result)
  }

  return inserted
}

async function deleteBy(table, column, values, optional = true) {
  const activeValues = Array.isArray(values) ? values.filter(Boolean) : [values].filter(Boolean)
  if (!activeValues.length) return
  if (dryRun) {
    log(`plan delete ${table} where ${column} in (${activeValues.length} value(s))`)
    return
  }

  const query = client().from(table).delete()
  const { error } = activeValues.length === 1
    ? await query.eq(column, activeValues[0])
    : await query.in(column, activeValues)

  if (!error) return

  if (optional && (isMissingTable(error) || missingColumn(error))) {
    warnings.push(`optional cleanup skipped for ${table}.${column}: ${error.message}`)
    return
  }

  throw new Error(`Delete failed for ${table}: ${error.message}`)
}

async function selectRows(table, select, build, optional = true) {
  if (dryRun) return []

  let query = client().from(table).select(select)
  query = build ? build(query) : query
  const { data, error } = await query

  if (!error) return data || []

  if (optional && (isMissingTable(error) || missingColumn(error))) {
    warnings.push(`optional select skipped for ${table}: ${error.message}`)
    return []
  }

  throw new Error(`Select failed for ${table}: ${error.message}`)
}

async function findWorkspaceIds() {
  if (dryRun) return []

  const slug = dataset.workspace.slug
  const bySlug = await selectRows('workspaces', 'id', query => query.eq('slug', slug), true)
  if (bySlug.length) return bySlug.map(row => row.id)

  const byName = await selectRows('workspaces', 'id', query => query.eq('name', dataset.workspace.name), true)
  return byName.map(row => row.id)
}

async function deleteAuthUsers() {
  if (dryRun) {
    log(`plan delete auth users for ${dataset.users.length} QA email(s)`)
    return
  }

  const expectedEmails = new Set(dataset.users.map(user => user.email.toLowerCase()))
  let page = 1

  while (true) {
    const { data, error } = await client().auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Could not list auth users: ${error.message}`)

    for (const user of data.users || []) {
      if (expectedEmails.has(user.email?.toLowerCase())) {
        const { error: deleteError } = await client().auth.admin.deleteUser(user.id)
        if (deleteError) throw new Error(`Could not delete auth user ${user.email}: ${deleteError.message}`)
      }
    }

    if (!data.users || data.users.length < 1000) break
    page += 1
  }
}

async function resetQaData() {
  log('resetting QA data')

  const workspaceIds = await findWorkspaceIds()
  const clinicRows = workspaceIds.length
    ? await selectRows('clinics', 'id', query => query.in('workspace_id', workspaceIds), true)
    : []
  const clinicIds = clinicRows.map(row => row.id)
  const serviceRows = clinicIds.length
    ? await selectRows('services', 'id', query => query.in('clinic_id', clinicIds), true)
    : []
  const serviceIds = serviceRows.map(row => row.id)
  const patientRows = clinicIds.length
    ? await selectRows('patients', 'id', query => query.in('clinic_id', clinicIds), true)
    : []
  const patientIds = patientRows.map(row => row.id)

  await deleteBy('service_supplies', 'service_id', serviceIds)
  await deleteBy('public_bookings', 'clinic_id', clinicIds)
  await deleteBy('appointments', 'clinic_id', clinicIds)
  await deleteBy('appointment_reminders', 'clinic_id', clinicIds)
  await deleteBy('notification_queue', 'clinic_id', clinicIds)
  await deleteBy('notifications', 'clinic_id', clinicIds)
  await deleteBy('treatment_payments', 'patient_id', patientIds)
  await deleteBy('payments', 'patient_id', patientIds)
  await deleteBy('treatments', 'clinic_id', clinicIds)
  await deleteBy('expenses', 'clinic_id', clinicIds)
  await deleteBy('assets', 'clinic_id', clinicIds)
  await deleteBy('fixed_costs', 'clinic_id', clinicIds)
  await deleteBy('settings_time', 'clinic_id', clinicIds)
  await deleteBy('patients', 'clinic_id', clinicIds)
  await deleteBy('marketing_campaigns', 'clinic_id', clinicIds)
  await deleteBy('patient_sources', 'clinic_id', clinicIds)
  await deleteBy('services', 'clinic_id', clinicIds)
  await deleteBy('supplies', 'clinic_id', clinicIds)
  await deleteBy('clinic_users', 'clinic_id', clinicIds)
  await deleteBy('clinic_members', 'clinic_id', clinicIds)
  await deleteBy('workspace_users', 'workspace_id', workspaceIds)
  await deleteBy('workspace_members', 'workspace_id', workspaceIds)
  await deleteBy('clinics', 'workspace_id', workspaceIds)
  await deleteBy('workspaces', 'id', workspaceIds)
  await deleteAuthUsers()
}

async function createAuthUsers() {
  const password = process.env.QA_STAGE_DEFAULT_PASSWORD || DEFAULT_PASSWORD
  const out = new Map()

  for (const user of dataset.users) {
    if (dryRun) {
      out.set(user.key, { id: `dry-user-${user.key}`, email: user.email, role: user.role })
      continue
    }

    const { data, error } = await client().auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: `QA ${user.role}`,
        role: user.role
      },
      app_metadata: {
        qa_seed: true
      }
    })

    if (error) throw new Error(`Could not create auth user ${user.email}: ${error.message}`)
    out.set(user.key, { id: data.user.id, email: user.email, role: user.role })
  }

  await tryInsertRows(
    'profiles',
    [...out.values()].map(user => ({
      id: user.id,
      email: user.email,
      full_name: `QA ${user.role}`,
      role: user.role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })),
    { optional: true }
  )

  await tryInsertRows(
    'user_profiles',
    [...out.values()].map(user => ({
      id: user.id,
      user_id: user.id,
      email: user.email,
      full_name: `QA ${user.role}`,
      display_name: `QA ${user.role}`,
      role: user.role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })),
    { optional: true }
  )

  return out
}

async function seedWorkspace(users) {
  const owner = users.get('owner')
  const [workspace] = await insertRows('workspaces', [{
    name: dataset.workspace.name,
    slug: dataset.workspace.slug,
    description: 'Workspace seeded by Laralis QA harness',
    owner_id: owner.id,
    status: 'active',
    onboarding_completed: true,
    onboarding_step: 3,
    setup_started_at: '2026-05-01T09:00:00.000Z',
    setup_last_seen_at: '2026-05-01T09:15:00.000Z',
    setup_completed_at: '2026-05-01T09:30:00.000Z'
  }])

  const clinicRows = dataset.clinics.map((clinic, index) => ({
    workspace_id: workspace.id,
    name: clinic.name,
    slug: clinic.slug,
    address: index === 0 ? 'QA Centro 123' : 'QA Norte 456',
    phone: '+15555550000',
    email: `qa-${clinic.slug}@laralis.test`,
    is_active: true,
    booking_config: {
      enabled: true,
      allow_new_patients: true,
      require_phone: true,
      require_notes: false,
      max_advance_days: 60,
      min_advance_hours: 2,
      slot_duration_minutes: 30
    },
    notification_settings: {
      email_enabled: false,
      sms_enabled: false,
      whatsapp_enabled: false
    }
  }))

  const clinics = await insertRows('clinics', clinicRows)
  const clinicsByKey = new Map(dataset.clinics.map((clinic, index) => [clinic.key, clinics[index]]))

  const clinicA = clinicsByKey.get('clinicA')
  const clinicB = clinicsByKey.get('clinicB')
  const allowedAll = [clinicA.id, clinicB.id]
  const allowedA = [clinicA.id]

  const workspaceMemberRows = [...users.values()].map(user => ({
    workspace_id: workspace.id,
    user_id: user.id,
    role: membershipRole(user.role),
    custom_permissions: {},
    custom_role_id: null,
    allowed_clinics: user.role === 'owner' || user.role === 'admin' ? allowedAll : allowedA,
    is_active: true,
    joined_at: '2026-05-01T09:30:00.000Z',
    clinic_ids: user.role === 'owner' || user.role === 'admin' ? allowedAll : allowedA
  }))

  await tryInsertRows('workspace_users', workspaceMemberRows, { optional: true })
  await tryInsertRowsIndividually('workspace_members', workspaceMemberRows, { optional: true })

  const clinicUserRows = []
  for (const user of users.values()) {
    clinicUserRows.push({
      clinic_id: clinicA.id,
      user_id: user.id,
      role: clinicRole(user.role),
      custom_permissions: {},
      custom_role_id: null,
      is_active: true,
      joined_at: '2026-05-01T09:30:00.000Z',
      can_access_all_patients: user.role !== 'viewer',
      assigned_chair: user.role === 'doctor' ? 'Sillon 1' : null,
      schedule: {}
    })

    if (user.role === 'owner' || user.role === 'admin') {
      clinicUserRows.push({
        clinic_id: clinicB.id,
        user_id: user.id,
        role: clinicRole(user.role),
        custom_permissions: {},
        custom_role_id: null,
        is_active: true,
        joined_at: '2026-05-01T09:30:00.000Z',
        can_access_all_patients: true,
        assigned_chair: null,
        schedule: {}
      })
    }
  }

  await tryInsertRowsIndividually('clinic_users', clinicUserRows, { optional: true })
  await tryInsertRows('clinic_members', clinicUserRows, { optional: true })

  return { workspace, clinicsByKey }
}

async function seedSettingsAndCosts(clinicId) {
  const cfg = dataset.timeSettings
  const workingDaysConfig = cfg.workingDaysPattern

  await insertRows('settings_time', [{
    clinic_id: clinicId,
    work_days: cfg.workDaysPerWeek,
    working_days_per_month: dataset.period.workingDays,
    hours_per_day: cfg.hoursPerDay,
    real_pct: cfg.realPct / 100,
    real_hours_percentage: cfg.realPct,
    working_days_config: workingDaysConfig,
    monthly_goal_cents: 0
  }])

  const fixedCosts = await insertRows('fixed_costs', dataset.fixedCosts.map(item => ({
    clinic_id: clinicId,
    category: item.key,
    concept: item.name,
    name: item.name,
    amount_cents: item.monthlyAmountCents,
    monthly_amount_cents: item.monthlyAmountCents,
    is_active: true
  })))

  await insertRows('assets', dataset.assets.map(item => ({
    clinic_id: clinicId,
    name: item.name,
    category: 'equipment',
    purchase_price_cents: item.purchaseAmountCents,
    purchase_amount_cents: item.purchaseAmountCents,
    salvage_value_cents: item.salvageAmountCents,
    depreciation_months: item.usefulLifeMonths,
    depreciation_years: Math.max(1, Math.round(item.usefulLifeMonths / 12)),
    purchase_date: '2026-05-01',
    is_active: true
  })))

  return { fixedCosts }
}

async function seedSuppliesAndServices(clinicId) {
  const supplies = await insertRows('supplies', dataset.supplies.map(item => ({
    clinic_id: clinicId,
    name: item.name,
    category: 'qa',
    presentation: item.unit,
    price_cents: item.unitCostCents,
    portions: 1,
    portions_per_presentation: 1,
    unit_cost_cents: item.unitCostCents,
    stock_quantity: 100,
    min_stock_alert: 5,
    is_active: true
  })))

  const supplyByKey = new Map(dataset.supplies.map((item, index) => [item.key, supplies[index]]))

  const services = await insertRows('services', dataset.services.map(item => ({
    clinic_id: clinicId,
    name: item.name,
    category: 'qa',
    description: `Seed QA service ${item.key}`,
    est_minutes: item.durationMinutes,
    duration_minutes: item.durationMinutes,
    original_price_cents: item.priceCents,
    price_cents: item.priceCents,
    margin_pct: 0,
    is_active: true
  })))

  const serviceByKey = new Map(dataset.services.map((item, index) => [item.key, services[index]]))
  const serviceSupplyRows = []

  for (const service of dataset.services) {
    const serviceRow = serviceByKey.get(service.key)
    for (const supply of service.supplies) {
      serviceSupplyRows.push({
        clinic_id: clinicId,
        service_id: serviceRow.id,
        supply_id: supplyByKey.get(supply.supplyKey).id,
        qty: supply.quantity,
        quantity: supply.quantity
      })
    }
  }

  await insertRows('service_supplies', serviceSupplyRows)

  return { supplyByKey, serviceByKey }
}

async function seedMarketing(clinicId) {
  const sources = await insertRows('patient_sources', dataset.sources.map((source, index) => ({
    clinic_id: clinicId,
    name: source.name,
    description: `QA source ${source.key}`,
    color: ['#1877F2', '#16A34A', '#64748B'][index] || '#64748B',
    icon: 'user-plus',
    is_active: true,
    is_system: false
  })))

  const sourceByKey = new Map(dataset.sources.map((item, index) => [item.key, sources[index]]))
  const platform = await ensureMarketingPlatform(clinicId)
  const campaignByKey = new Map()

  if (!platform) {
    warnings.push('marketing platform was not created; campaigns will be skipped and patient campaign_id will be null')
    return { sourceByKey, campaignByKey }
  }

  const campaigns = await insertRows('marketing_campaigns', dataset.campaigns.map(campaign => ({
    clinic_id: clinicId,
    platform_id: platform.id,
    name: campaign.name,
    code: campaign.key,
    source_id: sourceByKey.get(campaign.sourceKey)?.id,
    spend_cents: campaign.spendCents,
    budget_cents: campaign.spendCents,
    start_date: campaign.periodFrom,
    end_date: campaign.periodTo,
    status: 'active',
    is_active: true
  })))

  dataset.campaigns.forEach((item, index) => campaignByKey.set(item.key, campaigns[index]))
  return { sourceByKey, campaignByKey }
}

async function ensureMarketingPlatform(clinicId) {
  if (dryRun) return { id: 'dry-marketing-platform' }

  const existing = await selectRows(
    'categories',
    'id',
    query => query.eq('entity_type', 'marketing_platform').eq('name', 'meta_ads').limit(1),
    true
  )

  if (existing.length) return existing[0]

  const inserted = await tryInsertRows(
    'categories',
    [{
      clinic_id: clinicId,
      entity_type: 'marketing_platform',
      name: 'meta_ads',
      code: 'meta_ads',
      display_name: 'Meta Ads',
      description: 'QA marketing platform',
      color: '#1877F2',
      icon: 'megaphone',
      is_system: false,
      is_active: true,
      display_order: 10
    }],
    { optional: true }
  )

  return inserted[0] || null
}

function patientRowsFor(clinicId, sourceByKey, campaignByKey) {
  const rows = []
  let index = 1

  for (const group of dataset.patientGroups) {
    for (let n = 1; n <= group.count; n += 1) {
      const padded = String(index).padStart(3, '0')
      const source = sourceByKey.get(group.sourceKey)
      const campaign = dataset.campaigns.find(item => item.sourceKey === group.sourceKey)
      rows.push({
        clinic_id: clinicId,
        first_name: `${group.namePrefix} ${padded}`,
        last_name: 'Paciente',
        email: `qa.patient.${padded}@laralis.test`,
        phone: `+1555555${String(index).padStart(4, '0')}`,
        gender: index % 2 === 0 ? 'female' : 'male',
        first_visit_date: `2026-05-${String(Math.min(28, n)).padStart(2, '0')}`,
        acquisition_date: `2026-05-${String(Math.min(28, n)).padStart(2, '0')}`,
        source_id: source?.id || null,
        campaign_id: campaign ? campaignByKey.get(campaign.key)?.id || null : null,
        notes: `QA_SEED source=${group.sourceKey}`
      })
      index += 1
    }
  }

  return rows
}

function treatmentStatus(status, service, group) {
  if (status === 'completed_paid') {
    return {
      status: 'completed',
      is_paid: true,
      amount_paid_cents: service.priceCents,
      pending_balance_cents: 0,
      payment_method: 'cash'
    }
  }

  if (status === 'partial') {
    const paid = group.paidCents || 0
    return {
      status: 'completed',
      is_paid: false,
      amount_paid_cents: paid,
      pending_balance_cents: Math.max(0, service.priceCents - paid),
      payment_method: 'card'
    }
  }

  if (status === 'pending') {
    return {
      status: 'scheduled',
      is_paid: false,
      amount_paid_cents: 0,
      pending_balance_cents: service.priceCents,
      payment_method: null
    }
  }

  return {
    status: 'cancelled',
    is_paid: false,
    amount_paid_cents: 0,
    pending_balance_cents: 0,
    payment_method: null
  }
}

function treatmentRowsFor(clinicId, patients, serviceByKey) {
  const rows = []
  const patientsBySource = new Map()

  for (const row of patients) {
    const match = /source=([a-zA-Z0-9]+)/.exec(row.notes || '')
    const key = match?.[1] || 'unknown'
    if (!patientsBySource.has(key)) patientsBySource.set(key, [])
    patientsBySource.get(key).push(row)
  }

  let sequence = 1
  const sourceIndexes = new Map()

  for (const group of dataset.treatmentGroups) {
    const pool = patientsBySource.get(group.sourceKey) || patients
    const serviceDef = dataset.services.find(service => service.key === group.serviceKey)
    const service = serviceByKey.get(group.serviceKey)

    for (let n = 0; n < group.count; n += 1) {
      const poolIndex = sourceIndexes.get(group.sourceKey) || 0
      const patient = pool[poolIndex % pool.length]
      sourceIndexes.set(group.sourceKey, poolIndex + 1)
      const payment = treatmentStatus(group.status, serviceDef, group)
      const date = `2026-05-${String(Math.min(28, sequence)).padStart(2, '0')}`

      rows.push({
        clinic_id: clinicId,
        patient_id: patient.id,
        service_id: service.id,
        treatment_date: date,
        treatment_time: '10:00',
        duration_minutes: serviceDef.durationMinutes,
        minutes: serviceDef.durationMinutes,
        fixed_cost_per_minute_cents: 500,
        fixed_per_minute_cents: 500,
        variable_cost_cents: serviceDef.expectedVariableCostCents,
        fixed_cost_cents: serviceDef.expectedAllocatedFixedCostCents,
        price_cents: serviceDef.priceCents,
        margin_pct: 0,
        amount_paid_cents: payment.amount_paid_cents,
        pending_balance_cents: payment.pending_balance_cents,
        is_paid: payment.is_paid,
        payment_method: payment.payment_method,
        payment_date: payment.amount_paid_cents > 0 ? date : null,
        status: payment.status,
        notes: `QA_SEED source=${group.sourceKey} original_status=${group.status}`,
        snapshot_costs: {
          sourceKey: group.sourceKey,
          serviceKey: group.serviceKey,
          expectedVariableCostCents: serviceDef.expectedVariableCostCents,
          expectedAllocatedFixedCostCents: serviceDef.expectedAllocatedFixedCostCents
        }
      })

      sequence += 1
    }
  }

  return rows
}

async function seedPatientsAndTreatments(clinicId, sourceByKey, campaignByKey, serviceByKey) {
  const patients = await insertRows('patients', patientRowsFor(clinicId, sourceByKey, campaignByKey))
  await insertRows('treatments', treatmentRowsFor(clinicId, patients, serviceByKey))
  return { patients }
}

async function seedExpenses(clinicId, fixedCosts, campaignByKey) {
  const fixedByConcept = new Map(fixedCosts.map(row => [row.concept || row.name, row]))
  const expenseCategories = await selectRows(
    'categories',
    'id, name, display_name',
    query => query.eq('entity_type', 'expense').eq('is_system', true),
    false
  )
  const categoryByLabel = new Map()

  for (const category of expenseCategories) {
    categoryByLabel.set(String(category.name || '').toLowerCase(), category)
    categoryByLabel.set(String(category.display_name || '').toLowerCase(), category)
  }

  const marketingCategory = categoryByLabel.get('marketing')
  const servicesCategory = categoryByLabel.get('servicios')
  const suppliesCategory = categoryByLabel.get('insumos')
  if (!marketingCategory || !servicesCategory || !suppliesCategory) {
    throw new Error('Required expense categories are missing: Marketing, Servicios, Insumos')
  }

  const metaCampaign = campaignByKey.get('metaMayo')

  await tryInsertRows(
    'expenses',
    [
      {
        clinic_id: clinicId,
        expense_date: '2026-05-05',
        category_id: marketingCategory.id,
        category: 'Marketing',
        subcategory: 'Publicidad',
        description: 'Gasto QA Meta Mayo',
        amount_cents: 660000,
        vendor: 'Meta Ads QA',
        notes: 'QA_SEED marketing spend for oracle',
        is_recurring: false,
        is_variable: false,
        expense_category: 'marketing',
        campaign_id: metaCampaign?.id || null,
        auto_processed: true
      },
      {
        clinic_id: clinicId,
        expense_date: '2026-05-01',
        category_id: servicesCategory.id,
        category: 'Servicios',
        subcategory: 'Software',
        description: 'Software QA contra costo fijo planificado',
        amount_cents: 280000,
        vendor: 'Laralis QA',
        notes: 'QA_SEED planned-vs-actual fixed cost link',
        is_recurring: true,
        recurrence_interval: 'monthly',
        recurrence_day: 1,
        next_recurrence_date: '2026-06-01',
        is_variable: false,
        expense_category: 'software_subscriptions',
        related_fixed_cost_id: fixedByConcept.get('Software QA')?.id || null,
        auto_processed: true
      },
      {
        clinic_id: clinicId,
        expense_date: '2026-05-12',
        category_id: suppliesCategory.id,
        category: 'Insumos',
        subcategory: 'Materiales',
        description: 'Laboratorio QA variable',
        amount_cents: 150000,
        vendor: 'Laboratorio QA',
        notes: 'QA_SEED lara action reference expense',
        is_recurring: false,
        is_variable: true,
        expense_category: 'lab_fees',
        auto_processed: false
      }
    ],
    { optional: true }
  )
}

async function seedPublicBooking(clinicId, serviceByKey) {
  const caseDef = dataset.bookingCases[0]
  if (!caseDef) return

  await tryInsertRows(
    'public_bookings',
    [{
      clinic_id: clinicId,
      service_id: serviceByKey.get(caseDef.serviceKey)?.id,
      patient_name: caseDef.patientName,
      patient_email: 'qa.booking@laralis.test',
      patient_phone: caseDef.patientPhone,
      patient_notes: 'QA_SEED booking notification smoke',
      requested_date: '2026-06-15',
      requested_time: '10:00',
      status: 'pending',
      confirmation_email_sent: false,
      whatsapp_sent: false,
      utm_source: 'qa',
      utm_medium: 'e2e',
      utm_campaign: 'meta-mayo'
    }],
    { optional: true }
  )
}

async function seedAll() {
  log('creating QA auth users')
  const users = await createAuthUsers()

  log('creating QA workspace, clinics, and memberships')
  const { clinicsByKey } = await seedWorkspace(users)
  const clinicA = clinicsByKey.get('clinicA')

  log('creating QA settings, fixed costs, and assets')
  const { fixedCosts } = await seedSettingsAndCosts(clinicA.id)

  log('creating QA supplies and services')
  const { serviceByKey } = await seedSuppliesAndServices(clinicA.id)

  log('creating QA marketing sources and campaigns')
  const { sourceByKey, campaignByKey } = await seedMarketing(clinicA.id)

  log('creating QA patients and treatments')
  await seedPatientsAndTreatments(clinicA.id, sourceByKey, campaignByKey, serviceByKey)

  log('creating QA expenses and booking fixtures')
  await seedExpenses(clinicA.id, fixedCosts, campaignByKey)
  await seedPublicBooking(clinicA.id, serviceByKey)
}

function printPlan() {
  const fixedCostTotal = dataset.fixedCosts.reduce((sum, item) => sum + item.monthlyAmountCents, 0)
  const patientTotal = dataset.patientGroups.reduce((sum, item) => sum + item.count, 0)
  const treatmentTotal = dataset.treatmentGroups.reduce((sum, item) => sum + item.count, 0)

  log('dry run only; no database writes')
  log(`stage ref guard: ${STAGE_REF}`)
  log(`workspace: ${dataset.workspace.name} (${dataset.workspace.slug})`)
  log(`clinics: ${dataset.clinics.length}`)
  log(`auth users: ${dataset.users.length}`)
  log(`patients: ${patientTotal}`)
  log(`treatments: ${treatmentTotal}`)
  log(`services: ${dataset.services.length}`)
  log(`supplies: ${dataset.supplies.length}`)
  log(`fixed costs cents: ${fixedCostTotal}`)
  log(`campaigns: ${dataset.campaigns.length}`)
}

async function main() {
  if (dryRun) {
    printPlan()
    return
  }

  assertStageEnv()

  log(`target Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
  await resetQaData()

  if (!resetOnly) {
    await seedAll()
  }

  if (warnings.length) {
    log('warnings:')
    warnings.forEach(warning => log(`- ${warning}`))
  }

  log(resetOnly ? 'QA reset completed' : 'QA seed completed')
}

main().catch(error => {
  console.error(`[qa-stage-seed] ${error.message}`)
  process.exitCode = 1
})
