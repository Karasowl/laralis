import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()
const repoRoot = path.resolve(cwd, '..', '..')
const strict = process.argv.includes('--strict')

const numericPath = path.join(repoRoot, 'docs', 'qa', 'numeric-oracles.json')
const datasetPath = path.join(repoRoot, 'docs', 'qa', 'dataset.json')
const oraclesPath = path.join(repoRoot, 'docs', 'qa', 'oracles.json')
const reportPath = path.join(repoRoot, 'docs', 'qa', 'generated', 'numeric-oracle-report.md')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function rel(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/')
}

function getByPath(root, expression) {
  const parts = expression.split('.')
  let current = root

  for (const part of parts) {
    if (part === 'length') {
      current = current?.length
      continue
    }

    if (current && Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part]
      continue
    }

    return undefined
  }

  return current
}

function collectEvidenceFiles(value, out = []) {
  if (!value) return out
  if (typeof value === 'string') {
    if (/^(apps|docs)\//.test(value)) out.push(value)
    return out
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectEvidenceFiles(item, out))
    return out
  }

  if (typeof value === 'object') {
    Object.values(value).forEach(item => collectEvidenceFiles(item, out))
  }

  return out
}

function countAssertions(metrics) {
  return metrics.reduce((sum, metric) => sum + (metric.assertions?.length || 0), 0)
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || 'unknown'
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})
}

function formatCounts(counts) {
  return Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(', ')
}

const failures = []
const warnings = []

if (!fs.existsSync(numericPath)) failures.push('Missing docs/qa/numeric-oracles.json')
if (!fs.existsSync(datasetPath)) failures.push('Missing docs/qa/dataset.json')
if (!fs.existsSync(oraclesPath)) failures.push('Missing docs/qa/oracles.json')

let spec = { metrics: [] }
let dataset = {}
let oracles = {}

if (!failures.length) {
  spec = readJson(numericPath)
  dataset = readJson(datasetPath)
  oracles = readJson(oraclesPath)
}

const computed = {
  serviceSupplyRecipeRows: (dataset.services || []).reduce((sum, service) => {
    return sum + (service.supplies?.length || 0)
  }, 0)
}

const sourceRoot = { dataset, oracles, computed }
const metrics = Array.isArray(spec.metrics) ? spec.metrics : []

if (!Array.isArray(spec.metrics)) failures.push('numeric-oracles.json must expose a metrics array')
if (metrics.length < 10) failures.push(`numeric-oracles.json should track at least 10 metric groups; found ${metrics.length}`)

const ids = metrics.map(metric => metric.id).filter(Boolean)
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
duplicateIds.forEach(id => failures.push(`Duplicate numeric metric id: ${id}`))

for (const metric of metrics) {
  if (!metric.id) failures.push('Numeric metric missing id')
  if (!metric.priority) failures.push(`${metric.id || '(missing id)'} missing priority`)
  if (!metric.domain) failures.push(`${metric.id || '(missing id)'} missing domain`)
  if (!metric.status) failures.push(`${metric.id || '(missing id)'} missing status`)
  if (!metric.businessDecision) failures.push(`${metric.id || '(missing id)'} missing businessDecision`)
  if (!metric.formula) failures.push(`${metric.id || '(missing id)'} missing formula`)
  if (!Array.isArray(metric.assertions)) failures.push(`${metric.id || '(missing id)'} assertions must be an array`)

  const isP0 = metric.priority === 'P0'
  const isCovered = metric.status === 'covered'
  const layers = metric.layers || {}
  const formulaLayer = layers.formula || []
  const apiLayer = layers.api || []
  const uiLayer = layers.ui || []
  const exportLayer = layers.export || []

  if (isP0 && isCovered) {
    if (!metric.assertions?.length) failures.push(`${metric.id} is covered P0 but has no numeric assertions`)
    if (!formulaLayer.length) failures.push(`${metric.id} is covered P0 but has no formula evidence`)
    if (!apiLayer.length) failures.push(`${metric.id} is covered P0 but has no API evidence`)
    if (!uiLayer.length && !exportLayer.length) {
      failures.push(`${metric.id} is covered P0 but has neither UI nor export evidence`)
    }
  }

  if (isP0 && metric.status !== 'covered') {
    warnings.push(`${metric.id} remains ${metric.status}: ${metric.businessDecision}`)
  }

  for (const file of collectEvidenceFiles(metric.layers)) {
    const fullPath = path.join(repoRoot, file)
    if (!fs.existsSync(fullPath)) failures.push(`${metric.id} evidence file missing: ${file}`)
  }

  for (const assertion of metric.assertions || []) {
    if (!assertion.label || !assertion.path || !('expected' in assertion) || !assertion.unit) {
      failures.push(`${metric.id} has an invalid assertion: ${JSON.stringify(assertion)}`)
      continue
    }

    const actual = getByPath(sourceRoot, assertion.path)
    const tolerance = assertion.tolerance ?? 0

    if (typeof actual === 'undefined') {
      failures.push(`${metric.id} assertion "${assertion.label}" path not found: ${assertion.path}`)
      continue
    }

    if (typeof actual === 'number' && typeof assertion.expected === 'number') {
      const delta = Math.abs(actual - assertion.expected)
      if (delta > tolerance) {
        failures.push(
          `${metric.id} assertion "${assertion.label}" expected ${assertion.expected}, got ${actual} at ${assertion.path}`
        )
      }
      continue
    }

    if (actual !== assertion.expected) {
      failures.push(
        `${metric.id} assertion "${assertion.label}" expected ${assertion.expected}, got ${actual} at ${assertion.path}`
      )
    }
  }
}

const assertionTotal = countAssertions(metrics)
const statusCounts = countBy(metrics, 'status')
const priorityCounts = countBy(metrics, 'priority')
const coveredP0 = metrics.filter(metric => metric.priority === 'P0' && metric.status === 'covered').length
const openP0 = metrics.filter(metric => metric.priority === 'P0' && metric.status !== 'covered').length
const status = failures.length ? 'fail' : warnings.length ? 'warn' : 'pass'

const lines = [
  '# Numeric Oracle Audit',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Status: ${status}`,
  `Metric groups: ${metrics.length}`,
  `Assertions: ${assertionTotal}`,
  `Priorities: ${formatCounts(priorityCounts)}`,
  `Statuses: ${formatCounts(statusCounts)}`,
  `Covered P0: ${coveredP0}`,
  `Open P0: ${openP0}`,
  '',
  '## Metric Groups',
  ''
]

for (const metric of metrics) {
  lines.push(`- ${metric.id} [${metric.priority}/${metric.status}] ${metric.domain}: ${metric.assertions?.length || 0} assertions`)
}

if (warnings.length) {
  lines.push('', '## Warnings', '')
  warnings.forEach(warning => lines.push(`- ${warning}`))
}

if (failures.length) {
  lines.push('', '## Failures', '')
  failures.forEach(failure => lines.push(`- ${failure}`))
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true })
fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)

console.log(lines.join('\n'))
console.log(`\nReport written to ${rel(reportPath)}`)

if (failures.length || (strict && warnings.length)) {
  process.exit(1)
}
