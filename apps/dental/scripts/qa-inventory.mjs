import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()
const repoRoot = path.resolve(cwd, '..', '..')
const strict = process.argv.includes('--strict')

const reportPath = path.join(repoRoot, 'docs', 'qa', 'generated', 'inventory-report.md')

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function loadJSON(filePath) {
  return JSON.parse(readText(filePath))
}

function walk(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return []

  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'coverage') {
        continue
      }
      out.push(...walk(fullPath, predicate))
      continue
    }
    if (entry.isFile() && predicate(fullPath)) out.push(fullPath)
  }
  return out
}

function rel(filePath) {
  return path.relative(cwd, filePath).replaceAll(path.sep, '/')
}

function flatten(obj, prefix = '') {
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, nextKey))
    } else {
      out[nextKey] = value
    }
  }
  return out
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {}
      deepMerge(target[key], value)
    } else {
      target[key] = value
    }
  }
  return target
}

function missingKeys(base, other) {
  return Object.keys(base).filter(key => !(key in other)).sort()
}

function analyzeI18n() {
  const messagesDir = path.join(cwd, 'messages')
  const enPath = path.join(messagesDir, 'en.json')
  const esPath = path.join(messagesDir, 'es.json')

  if (!fs.existsSync(enPath) || !fs.existsSync(esPath)) {
    return {
      status: 'warn',
      summary: 'No se encontraron messages/en.json y messages/es.json.',
      details: []
    }
  }

  let enObj = loadJSON(enPath)
  const enOverridesPath = path.join(messagesDir, 'en-overrides.json')
  if (fs.existsSync(enOverridesPath)) {
    enObj = deepMerge(enObj, loadJSON(enOverridesPath))
  }

  let esObj = loadJSON(esPath)
  const esOverridesPath = path.join(messagesDir, 'es-overrides.json')
  if (fs.existsSync(esOverridesPath)) {
    esObj = deepMerge(esObj, loadJSON(esOverridesPath))
  }

  const en = flatten(enObj)
  const esEffective = flatten(deepMerge(JSON.parse(JSON.stringify(enObj)), esObj))
  const missingInEn = missingKeys(esEffective, en)
  const missingInEs = missingKeys(en, esEffective)

  return {
    status: missingInEn.length || missingInEs.length ? 'fail' : 'pass',
    summary: `en keys: ${Object.keys(en).length}; es effective keys: ${Object.keys(esEffective).length}; missing en: ${missingInEn.length}; missing es: ${missingInEs.length}`,
    details: [
      ...missingInEn.slice(0, 40).map(key => `missing en: ${key}`),
      ...(missingInEn.length > 40 ? [`missing en: ...${missingInEn.length - 40} more`] : []),
      ...missingInEs.slice(0, 40).map(key => `missing es: ${key}`),
      ...(missingInEs.length > 40 ? [`missing es: ...${missingInEs.length - 40} more`] : [])
    ]
  }
}

function analyzeCypressSpecs() {
  const packageJson = loadJSON(path.join(cwd, 'package.json'))
  const scripts = packageJson.scripts || {}
  const declared = []

  for (const [name, command] of Object.entries(scripts)) {
    if (!command.includes('cypress') || !command.includes('--spec')) continue
    const match = command.match(/--spec\s+["']([^"']+)["']/)
    if (!match) continue

    const spec = match[1]
    if (spec.includes('*')) {
      const base = spec.split('*')[0].replace(/[/\\]$/, '')
      const baseDir = path.join(cwd, base)
      const matches = walk(baseDir, file => /\.cy\.(ts|tsx|js|jsx)$/.test(file))
      declared.push({
        script: name,
        spec,
        exists: matches.length > 0,
        count: matches.length
      })
      continue
    }

    const exists = fs.existsSync(path.join(cwd, spec))
    declared.push({ script: name, spec, exists, count: exists ? 1 : 0 })
  }

  const allSpecs = walk(path.join(cwd, 'cypress', 'e2e'), file => /\.cy\.(ts|tsx|js|jsx)$/.test(file))
  const missing = declared.filter(item => !item.exists)

  return {
    status: missing.length ? 'fail' : 'pass',
    summary: `declared spec scripts: ${declared.length}; existing e2e specs: ${allSpecs.length}; missing declared specs: ${missing.length}`,
    details: declared.map(item => {
      const marker = item.exists ? 'ok' : 'missing'
      return `${marker}: ${item.script} -> ${item.spec}${item.count > 1 ? ` (${item.count} specs)` : ''}`
    })
  }
}

function analyzeTestHooks() {
  const uiFiles = [
    ...walk(path.join(cwd, 'app'), file => /\.(ts|tsx)$/.test(file)),
    ...walk(path.join(cwd, 'components'), file => /\.(ts|tsx)$/.test(file))
  ]

  const filesWithTestId = uiFiles.filter(file => readText(file).includes('data-testid'))
  const testIdCount = filesWithTestId.reduce((count, file) => {
    const matches = readText(file).match(/data-testid/g)
    return count + (matches ? matches.length : 0)
  }, 0)

  const ratio = uiFiles.length ? filesWithTestId.length / uiFiles.length : 0

  return {
    status: ratio < 0.1 ? 'fail' : 'warn',
    summary: `ui files: ${uiFiles.length}; files with data-testid: ${filesWithTestId.length}; data-testid occurrences: ${testIdCount}`,
    details: filesWithTestId.slice(0, 40).map(file => rel(file))
  }
}

function analyzeApiSurface() {
  const routeFiles = walk(path.join(cwd, 'app', 'api'), file => file.endsWith('route.ts'))

  const rows = routeFiles.map(file => {
    const text = readText(file)
    const withPermission = text.includes('withPermission(')
    const manualPermission = text.includes('forbiddenIfMissingPermission(') || text.includes('userHasPermission(')
    return {
      route: rel(file),
      withPermission,
      manualPermission,
      permissionGuard: withPermission || manualPermission,
      supabaseAdmin: text.includes('supabaseAdmin'),
      requireCronAuth: text.includes('requireCronAuth')
    }
  })

  const withPermission = rows.filter(row => row.withPermission).length
  const manualPermission = rows.filter(row => row.manualPermission).length
  const permissionGuard = rows.filter(row => row.permissionGuard).length
  const adminRoutes = rows.filter(row => row.supabaseAdmin).length
  const adminWithoutPermission = rows.filter(row => row.supabaseAdmin && !row.permissionGuard && !row.requireCronAuth)

  return {
    status: adminWithoutPermission.length ? 'warn' : 'pass',
    summary: `api routes: ${rows.length}; permission guard: ${permissionGuard} (withPermission: ${withPermission}, manual: ${manualPermission}); using supabaseAdmin: ${adminRoutes}; admin without permission/cron guard: ${adminWithoutPermission.length}`,
    details: adminWithoutPermission.slice(0, 60).map(row => row.route)
  }
}

function analyzeCrons() {
  const vercelPath = path.join(cwd, 'vercel.json')
  const config = fs.existsSync(vercelPath) ? loadJSON(vercelPath) : {}
  const crons = config.crons || []

  const rows = crons.map(cron => {
    const routePath = path.join(cwd, 'app', cron.path.replace(/^\/+/, ''), 'route.ts')
    const exists = fs.existsSync(routePath)
    const text = exists ? readText(routePath) : ''
    return {
      path: cron.path,
      schedule: cron.schedule,
      exists,
      requireCronAuth: text.includes('requireCronAuth')
    }
  })

  const failing = rows.filter(row => !row.exists || !row.requireCronAuth)

  return {
    status: failing.length ? 'fail' : 'pass',
    summary: `cron entries: ${rows.length}; missing/unguarded: ${failing.length}`,
    details: rows.map(row => {
      const marker = row.exists && row.requireCronAuth ? 'ok' : 'needs attention'
      return `${marker}: ${row.path} (${row.schedule})`
    })
  }
}

function analyzeQaDocs() {
  const required = [
    path.join(repoRoot, 'docs', 'qa', 'README.md'),
    path.join(repoRoot, 'docs', 'qa', 'coverage-matrix.md'),
    path.join(repoRoot, 'docs', 'qa', 'coverage-matrix.json'),
    path.join(repoRoot, 'docs', 'qa', 'dataset.md'),
    path.join(repoRoot, 'docs', 'qa', 'dataset.json'),
    path.join(repoRoot, 'docs', 'qa', 'oracles.md'),
    path.join(repoRoot, 'docs', 'qa', 'oracles.json'),
    path.join(repoRoot, 'docs', 'qa', 'regression-log.md')
  ]
  const missing = required.filter(file => !fs.existsSync(file))

  return {
    status: missing.length ? 'fail' : 'pass',
    summary: `required QA docs: ${required.length}; missing: ${missing.length}`,
    details: required.map(file => `${fs.existsSync(file) ? 'ok' : 'missing'}: ${path.relative(repoRoot, file).replaceAll(path.sep, '/')}`)
  }
}

function analyzeCoverageMatrix() {
  const matrixPath = path.join(repoRoot, 'docs', 'qa', 'coverage-matrix.json')

  if (!fs.existsSync(matrixPath)) {
    return {
      status: 'fail',
      summary: 'No existe docs/qa/coverage-matrix.json.',
      details: []
    }
  }

  const capabilities = loadJSON(matrixPath)
  const ids = capabilities.map(item => item.id).filter(Boolean)
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
  const invalid = capabilities.filter(item => {
    return !item.id || !item.priority || !item.domain || !item.capability || !Array.isArray(item.layers) || !item.status
  })

  const requiredDomains = [
    'smoke',
    'auth',
    'lifecycle',
    'onboarding',
    'multi-clinic',
    'permissions',
    'crud',
    'patients',
    'business-calculations',
    'expenses',
    'date-filters',
    'marketing',
    'dashboards',
    'reports',
    'visual',
    'i18n',
    'navigation',
    'booking',
    'notifications',
    'cron',
    'lara',
    'audio'
  ]

  const domains = new Set(capabilities.map(item => item.domain))
  const missingDomains = requiredDomains.filter(domain => !domains.has(domain))
  const statusCounts = capabilities.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {})
  const priorityCounts = capabilities.reduce((acc, item) => {
    acc[item.priority] = (acc[item.priority] || 0) + 1
    return acc
  }, {})

  const fail =
    !Array.isArray(capabilities) ||
    capabilities.length < 30 ||
    duplicateIds.length > 0 ||
    invalid.length > 0 ||
    missingDomains.length > 0

  const details = [
    `status counts: ${Object.entries(statusCounts).map(([key, value]) => `${key}=${value}`).join(', ')}`,
    `priority counts: ${Object.entries(priorityCounts).map(([key, value]) => `${key}=${value}`).join(', ')}`
  ]

  if (capabilities.length < 30) details.push(`needs at least 30 capabilities; found ${capabilities.length}`)
  duplicateIds.forEach(id => details.push(`duplicate id: ${id}`))
  invalid.slice(0, 20).forEach(item => details.push(`invalid entry: ${item.id || JSON.stringify(item)}`))
  missingDomains.forEach(domain => details.push(`missing domain: ${domain}`))

  return {
    status: fail ? 'fail' : 'pass',
    summary: `capabilities: ${capabilities.length}; domains: ${domains.size}; required missing domains: ${missingDomains.length}`,
    details
  }
}

function analyzeQaDataset() {
  const datasetPath = path.join(repoRoot, 'docs', 'qa', 'dataset.json')

  if (!fs.existsSync(datasetPath)) {
    return {
      status: 'fail',
      summary: 'No existe docs/qa/dataset.json.',
      details: []
    }
  }

  const dataset = loadJSON(datasetPath)
  const clinicCount = dataset.clinics?.length || 0
  const userCount = dataset.users?.length || 0
  const sourceCounts = Object.fromEntries((dataset.sources || []).map(source => [source.name, source.expectedPatients]))
  const patientTotal = (dataset.patientGroups || []).reduce((sum, group) => sum + (group.count || 0), 0)
  const treatmentTotal = (dataset.treatmentGroups || []).reduce((sum, group) => sum + (group.count || 0), 0)
  const fixedCostTotal = (dataset.fixedCosts || []).reduce((sum, item) => sum + (item.monthlyAmountCents || 0), 0)
  const serviceErrors = []

  const suppliesByKey = Object.fromEntries((dataset.supplies || []).map(supply => [supply.key, supply]))
  for (const service of dataset.services || []) {
    const expected = (service.supplies || []).reduce((sum, row) => {
      const supply = suppliesByKey[row.supplyKey]
      return sum + ((supply?.unitCostCents || 0) * (row.quantity || 0))
    }, 0)

    if (Math.round(expected) !== service.expectedVariableCostCents) {
      serviceErrors.push(`${service.key}: expected variable ${service.expectedVariableCostCents}, calculated ${Math.round(expected)}`)
    }
  }

  const failures = []
  if (!dataset.workspace?.slug) failures.push('workspace.slug is required so the seed can reset only QA data')
  if (clinicCount < 2) failures.push(`needs at least 2 clinics; found ${clinicCount}`)
  if (userCount < 6) failures.push(`needs at least 6 users/roles; found ${userCount}`)
  if (sourceCounts['Meta Mayo'] !== 22) failures.push(`Meta Mayo patients should be 22; found ${sourceCounts['Meta Mayo'] || 0}`)
  if (sourceCounts.Referidos !== 7) failures.push(`Referidos patients should be 7; found ${sourceCounts.Referidos || 0}`)
  if (patientTotal !== 30) failures.push(`patient group total should be 30; found ${patientTotal}`)
  if (treatmentTotal < 30) failures.push(`treatment group total should be at least 30; found ${treatmentTotal}`)
  if (fixedCostTotal !== 4680000) failures.push(`fixed cost total should be 4680000 cents; found ${fixedCostTotal}`)
  failures.push(...serviceErrors)
  for (const service of dataset.services || []) {
    for (const row of service.supplies || []) {
      if (!Number.isInteger(row.quantity)) {
        failures.push(`${service.key}: supply ${row.supplyKey} quantity must be an integer for current service_supplies schema`)
      }
    }
  }

  return {
    status: failures.length ? 'fail' : 'pass',
    summary: `clinics: ${clinicCount}; users: ${userCount}; patients: ${patientTotal}; treatments: ${treatmentTotal}; services: ${dataset.services?.length || 0}; supplies: ${dataset.supplies?.length || 0}`,
    details: [
      `Meta Mayo patients: ${sourceCounts['Meta Mayo'] || 0}`,
      `Referidos patients: ${sourceCounts.Referidos || 0}`,
      `fixed costs cents: ${fixedCostTotal}`,
      ...failures
    ]
  }
}

function analyzeQaOracles() {
  const datasetPath = path.join(repoRoot, 'docs', 'qa', 'dataset.json')
  const oraclesPath = path.join(repoRoot, 'docs', 'qa', 'oracles.json')

  if (!fs.existsSync(oraclesPath)) {
    return {
      status: 'fail',
      summary: 'No existe docs/qa/oracles.json.',
      details: []
    }
  }

  if (!fs.existsSync(datasetPath)) {
    return {
      status: 'fail',
      summary: 'No se pueden validar oraculos sin docs/qa/dataset.json.',
      details: []
    }
  }

  const dataset = loadJSON(datasetPath)
  const oracles = loadJSON(oraclesPath)
  const sourceCounts = Object.fromEntries((dataset.sources || []).map(source => [source.name, source.expectedPatients]))
  const fixedCostTotal = (dataset.fixedCosts || []).reduce((sum, item) => sum + (item.monthlyAmountCents || 0), 0)
  const completedGroups = (dataset.treatmentGroups || []).filter(group => group.status === 'completed_paid')
  const servicesByKey = Object.fromEntries((dataset.services || []).map(service => [service.key, service]))

  const completedRevenue = completedGroups.reduce((sum, group) => {
    return sum + ((servicesByKey[group.serviceKey]?.priceCents || 0) * (group.count || 0))
  }, 0)

  const completedVariableCost = completedGroups.reduce((sum, group) => {
    return sum + ((servicesByKey[group.serviceKey]?.expectedVariableCostCents || 0) * (group.count || 0))
  }, 0)

  const completedAllocatedFixedCost = completedGroups.reduce((sum, group) => {
    return sum + ((servicesByKey[group.serviceKey]?.expectedAllocatedFixedCostCents || 0) * (group.count || 0))
  }, 0)

  const completedTreatmentCount = completedGroups.reduce((sum, group) => sum + (group.count || 0), 0)
  const grossProfit = completedRevenue - completedVariableCost
  const averageContribution = Math.round(grossProfit / completedTreatmentCount)

  const failures = []
  if (oracles.patients?.bySource?.['Meta Mayo'] !== sourceCounts['Meta Mayo']) failures.push('Meta Mayo patient oracle does not match dataset')
  if (oracles.patients?.bySource?.Referidos !== sourceCounts.Referidos) failures.push('Referidos patient oracle does not match dataset')
  if (oracles.fixedCosts?.monthlyTotalCents !== fixedCostTotal) failures.push('fixed cost oracle does not match dataset')
  if (oracles.financial?.completedRevenueCents !== completedRevenue) failures.push(`completed revenue oracle should be ${completedRevenue}; found ${oracles.financial?.completedRevenueCents}`)
  if (oracles.financial?.completedVariableCostCents !== completedVariableCost) failures.push(`variable cost oracle should be ${completedVariableCost}; found ${oracles.financial?.completedVariableCostCents}`)
  if (oracles.financial?.allocatedFixedCostCents !== completedAllocatedFixedCost) failures.push(`allocated fixed cost oracle should be ${completedAllocatedFixedCost}; found ${oracles.financial?.allocatedFixedCostCents}`)
  if (oracles.breakEven?.averageContributionMarginCents !== averageContribution) failures.push(`average contribution oracle should be ${averageContribution}; found ${oracles.breakEven?.averageContributionMarginCents}`)

  return {
    status: failures.length ? 'fail' : 'pass',
    summary: `completed revenue cents: ${completedRevenue}; variable cost cents: ${completedVariableCost}; allocated fixed cents: ${completedAllocatedFixedCost}; average contribution cents: ${averageContribution}`,
    details: [
      `oracle gross profit cents: ${oracles.financial?.grossProfitCents}`,
      `oracle operating profit cents: ${oracles.financial?.operatingProfitCents}`,
      ...failures
    ]
  }
}

function analyzeQaSeed() {
  const seedPath = path.join(cwd, 'scripts', 'qa-stage-seed.mjs')
  const assertPath = path.join(cwd, 'scripts', 'qa-stage-assert.mjs')
  const envExamplePath = path.join(cwd, '.env.qa.example')
  const packageJson = loadJSON(path.join(cwd, 'package.json'))
  const scripts = packageJson.scripts || {}
  const requiredScripts = ['qa:seed:plan', 'qa:seed', 'qa:seed:reset', 'qa:stage:assert', 'qa:oracles', 'qa:check']
  const missingScripts = requiredScripts.filter(name => !scripts[name])
  const seedExists = fs.existsSync(seedPath)
  const assertExists = fs.existsSync(assertPath)
  const envExampleExists = fs.existsSync(envExamplePath)
  const seedText = seedExists ? readText(seedPath) : ''
  const assertText = assertExists ? readText(assertPath) : ''
  const failures = []

  if (!seedExists) failures.push('missing apps/dental/scripts/qa-stage-seed.mjs')
  if (!assertExists) failures.push('missing apps/dental/scripts/qa-stage-assert.mjs')
  if (!envExampleExists) failures.push('missing apps/dental/.env.qa.example')
  for (const name of missingScripts) failures.push(`missing package script: ${name}`)
  if (seedExists && !seedText.includes('QA_STAGE_SEED_CONFIRM')) failures.push('seed script must require QA_STAGE_SEED_CONFIRM before writes')
  if (seedExists && !seedText.includes('kafbqdliromcveojtdar')) failures.push('seed script must guard the known stage Supabase ref')
  if (seedExists && seedText.includes('.env.production')) failures.push('seed script must not load production env files')
  if (assertExists && !assertText.includes('kafbqdliromcveojtdar')) failures.push('stage assert script must guard the known stage Supabase ref')

  return {
    status: failures.length ? 'fail' : 'pass',
    summary: `seed script: ${seedExists ? 'present' : 'missing'}; assert script: ${assertExists ? 'present' : 'missing'}; env example: ${envExampleExists ? 'present' : 'missing'}; package scripts: ${requiredScripts.length - missingScripts.length}/${requiredScripts.length}`,
    details: [
      ...requiredScripts.map(name => `${scripts[name] ? 'ok' : 'missing'}: ${name}`),
      ...failures
    ]
  }
}

const checks = [
  ['QA docs', analyzeQaDocs()],
  ['QA coverage matrix', analyzeCoverageMatrix()],
  ['QA dataset', analyzeQaDataset()],
  ['QA oracles', analyzeQaOracles()],
  ['QA stage seed', analyzeQaSeed()],
  ['Cypress spec inventory', analyzeCypressSpecs()],
  ['i18n parity', analyzeI18n()],
  ['UI test hooks', analyzeTestHooks()],
  ['API permission surface', analyzeApiSurface()],
  ['Cron guard inventory', analyzeCrons()]
]

const failing = checks.filter(([, result]) => result.status === 'fail')
const warnings = checks.filter(([, result]) => result.status === 'warn')

const lines = []
lines.push('# QA Inventory Report')
lines.push('')
lines.push(`Generated: ${new Date().toISOString()}`)
lines.push('')
lines.push(`Status: ${failing.length ? 'fail' : warnings.length ? 'warn' : 'pass'}`)
lines.push(`Failing checks: ${failing.length}`)
lines.push(`Warning checks: ${warnings.length}`)
lines.push('')

for (const [name, result] of checks) {
  lines.push(`## ${name}`)
  lines.push('')
  lines.push(`Status: ${result.status}`)
  lines.push('')
  lines.push(result.summary)
  lines.push('')

  if (result.details.length) {
    for (const detail of result.details) {
      lines.push(`- ${detail}`)
    }
    lines.push('')
  }
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true })
fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)

console.log(lines.join('\n'))
console.log(`\nReport written to ${path.relative(cwd, reportPath).replaceAll(path.sep, '/')}`)

if (strict && failing.length) {
  process.exitCode = 1
}
