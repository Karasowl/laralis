import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const STAGE_REF = 'kafbqdliromcveojtdar'

const cwd = process.cwd()
const repoRoot = path.resolve(cwd, '..', '..')

loadEnv(path.join(cwd, '.env.qa.local'))

const dataset = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs', 'qa', 'dataset.json'), 'utf8'))
const oracles = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs', 'qa', 'oracles.json'), 'utf8'))

const failures = []

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
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

    if (!(key in process.env)) process.env[key] = value
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

  if (!allowNonStage && !url.includes(STAGE_REF)) {
    throw new Error(`Refusing to read because NEXT_PUBLIC_SUPABASE_URL is not the known stage ref ${STAGE_REF}.`)
  }

  const jwtPayload = decodeJwtPayload(serviceRoleKey)
  if (!allowNonStage && jwtPayload?.ref && jwtPayload.ref !== STAGE_REF) {
    throw new Error(`Refusing to read because SUPABASE_SERVICE_ROLE_KEY belongs to ${jwtPayload.ref}, not ${STAGE_REF}.`)
  }
}

function log(message) {
  console.log(`[qa-stage-assert] ${message}`)
}

function expectEqual(label, actual, expected) {
  if (actual !== expected) {
    failures.push(`${label}: expected ${expected}, got ${actual}`)
  }
  log(`${label}: ${actual}`)
}

function expectClose(label, actual, expected, tolerance = 0.0001) {
  if (Math.abs(actual - expected) > tolerance) {
    failures.push(`${label}: expected ${expected}, got ${actual}`)
  }
  log(`${label}: ${actual}`)
}

async function select(table, columns, build) {
  let query = supabase.from(table).select(columns)
  query = build ? build(query) : query
  const { data, error } = await query

  if (error) throw new Error(`Select failed for ${table}: ${error.message}`)
  return data || []
}

function classifyTreatment(row) {
  if (row.status === 'cancelled') return 'cancelled'
  if (row.status === 'scheduled' || row.status === 'pending') return 'pending'

  const price = row.price_cents || 0
  const paid = row.amount_paid_cents || 0
  if (row.status === 'completed' && paid >= price && price > 0) return 'completed_paid'
  if (row.status === 'completed' && paid > 0 && paid < price) return 'partial'
  return row.status || 'unknown'
}

function sum(rows, getValue) {
  return rows.reduce((total, row) => total + (getValue(row) || 0), 0)
}

assertStageEnv()
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const workspaceRows = await select('workspaces', 'id, name, slug', query => query.eq('slug', dataset.workspace.slug))
if (workspaceRows.length !== 1) {
  throw new Error(`Expected exactly one QA workspace with slug ${dataset.workspace.slug}, found ${workspaceRows.length}`)
}

const workspace = workspaceRows[0]
const clinics = await select('clinics', 'id, name', query => query.eq('workspace_id', workspace.id))
const clinicA = clinics.find(clinic => clinic.name === 'QA Dental Centro')
const clinicB = clinics.find(clinic => clinic.name === 'QA Dental Norte')

if (!clinicA || !clinicB) {
  throw new Error('Expected QA Dental Centro and QA Dental Norte to exist')
}

const [
  patients,
  sources,
  treatments,
  fixedCosts,
  campaigns,
  expenses,
  services
] = await Promise.all([
  select('patients', 'id, source_id, campaign_id', query => query.eq('clinic_id', clinicA.id)),
  select('patient_sources', 'id, name', query => query.eq('clinic_id', clinicA.id)),
  select('treatments', 'id, status, price_cents, amount_paid_cents, variable_cost_cents, fixed_cost_per_minute_cents, minutes', query => query.eq('clinic_id', clinicA.id)),
  select('fixed_costs', 'id, amount_cents', query => query.eq('clinic_id', clinicA.id)),
  select('marketing_campaigns', 'id, name', query => query.eq('clinic_id', clinicA.id)),
  select('expenses', 'id, amount_cents, campaign_id, expense_category, category', query => query.eq('clinic_id', clinicA.id)),
  select('services', 'id, name, price_cents', query => query.eq('clinic_id', clinicA.id))
])

const clinicBPatients = await select('patients', 'id', query => query.eq('clinic_id', clinicB.id))
expectEqual('clinic isolation: clinic B patient count', clinicBPatients.length, 0)

expectEqual('patients total', patients.length, oracles.patients.total)

const sourceNameById = new Map(sources.map(source => [source.id, source.name]))
const patientsBySource = {}
for (const patient of patients) {
  const sourceName = sourceNameById.get(patient.source_id) || 'unknown'
  patientsBySource[sourceName] = (patientsBySource[sourceName] || 0) + 1
}

for (const [sourceName, expected] of Object.entries(oracles.patients.bySource)) {
  expectEqual(`patients by source ${sourceName}`, patientsBySource[sourceName] || 0, expected)
}

expectEqual('treatments total', treatments.length, oracles.treatments.total)

const treatmentsByStatus = {}
for (const treatment of treatments) {
  const status = classifyTreatment(treatment)
  treatmentsByStatus[status] = (treatmentsByStatus[status] || 0) + 1
}

for (const [status, expected] of Object.entries(oracles.treatments.byStatus)) {
  expectEqual(`treatments by status ${status}`, treatmentsByStatus[status] || 0, expected)
}

const fixedCostTotal = sum(fixedCosts, row => row.amount_cents)
expectEqual('fixed costs monthly total cents', fixedCostTotal, oracles.fixedCosts.monthlyTotalCents)
expectEqual(
  'fixed cost per minute cents',
  fixedCostTotal / dataset.period.monthlyProductiveMinutes,
  oracles.fixedCosts.costPerMinuteCents
)

const completedPaidTreatments = treatments.filter(row => classifyTreatment(row) === 'completed_paid')
const completedRevenue = sum(completedPaidTreatments, row => row.price_cents)
const completedVariableCost = sum(completedPaidTreatments, row => row.variable_cost_cents)
const allocatedFixedCost = sum(completedPaidTreatments, row => {
  return (row.fixed_cost_per_minute_cents || 0) * (row.minutes || 0)
})
const cashCollected = sum(treatments, row => row.amount_paid_cents)

expectEqual('completed revenue cents', completedRevenue, oracles.financial.completedRevenueCents)
expectEqual('completed variable cost cents', completedVariableCost, oracles.financial.completedVariableCostCents)
expectEqual('allocated fixed cost cents', allocatedFixedCost, oracles.financial.allocatedFixedCostCents)
expectEqual('cash collected cents', cashCollected, oracles.financial.cashCollectedCents)

const metaCampaign = campaigns.find(campaign => campaign.name === 'Meta Mayo')
if (!metaCampaign) {
  failures.push('Meta Mayo campaign missing')
} else {
  const metaPatients = patients.filter(patient => patient.campaign_id === metaCampaign.id)
  const spend = sum(expenses.filter(expense => expense.campaign_id === metaCampaign.id), expense => expense.amount_cents)
  expectEqual('Meta Mayo patients', metaPatients.length, oracles.marketing.metaMayo.patients)
  expectEqual('Meta Mayo spend cents', spend, oracles.marketing.metaMayo.spendCents)
  expectClose('Meta Mayo ROAS', Number((oracles.marketing.metaMayo.revenueCents / spend).toFixed(4)), oracles.marketing.metaMayo.roas)
}

expectEqual('services count', services.length, dataset.services.length)

if (failures.length) {
  console.error('\nQA stage assertion failures:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exitCode = 1
} else {
  log('stage dataset matches QA oracles')
}
