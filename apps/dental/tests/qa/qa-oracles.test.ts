import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

type Dataset = {
  period: {
    workingDays: number
    productiveMinutesPerDay: number
    monthlyProductiveMinutes: number
  }
  workspace: {
    slug: string
  }
  clinics: Array<{ key: string; name: string }>
  users: Array<{ key: string; email: string; role: string }>
  sources: Array<{ key: string; name: string; expectedPatients: number }>
  campaigns: Array<{ key: string; name: string; sourceKey: string; spendCents: number }>
  fixedCosts: Array<{ key: string; monthlyAmountCents: number }>
  supplies: Array<{ key: string; unitCostCents: number }>
  services: Array<{
    key: string
    name: string
    priceCents: number
    durationMinutes: number
    supplies: Array<{ supplyKey: string; quantity: number }>
    expectedVariableCostCents: number
    expectedAllocatedFixedCostCents: number
  }>
  patientGroups: Array<{ sourceKey: string; count: number }>
  treatmentGroups: Array<{
    clinicKey: string
    sourceKey: string
    serviceKey: string
    status: string
    count: number
    paidCents?: number
  }>
}

type Oracles = {
  patients: {
    total: number
    bySource: Record<string, number>
  }
  treatments: {
    total: number
    byStatus: Record<string, number>
  }
  fixedCosts: {
    monthlyTotalCents: number
    costPerMinuteCents: number
  }
  services: Record<string, {
    priceCents: number
    variableCostCents: number
    allocatedFixedCostCents: number
    netPerTreatmentCents: number
  }>
  marketing: Record<string, {
    patients: number
    spendCents: number
    revenueCents: number
    cpaCents: number
    roas: number
    roi: number
  }>
  financial: {
    completedRevenueCents: number
    cashCollectedCents: number
    completedVariableCostCents: number
    grossProfitCents: number
    allocatedFixedCostCents: number
    serviceNetProfitCents: number
    monthlyFixedCostsCents: number
    marketingSpendCents: number
    operatingProfitCents: number
  }
  breakEven: {
    averageContributionMarginCents: number
    fixedOnlyTreatments: number
    fixedPlusMarketingTreatments: number
  }
}

const repoRoot = path.resolve(process.cwd(), '..', '..')
const dataset = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'docs', 'qa', 'dataset.json'), 'utf8')
) as Dataset
const oracles = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'docs', 'qa', 'oracles.json'), 'utf8')
) as Oracles

const sourcesByKey = new Map(dataset.sources.map(source => [source.key, source]))
const suppliesByKey = new Map(dataset.supplies.map(supply => [supply.key, supply]))
const servicesByKey = new Map(dataset.services.map(service => [service.key, service]))

function fixedCostTotal() {
  return dataset.fixedCosts.reduce((sum, item) => sum + item.monthlyAmountCents, 0)
}

function serviceVariableCost(serviceKey: string) {
  const service = servicesByKey.get(serviceKey)
  if (!service) throw new Error(`Unknown service ${serviceKey}`)

  return service.supplies.reduce((sum, item) => {
    const supply = suppliesByKey.get(item.supplyKey)
    if (!supply) throw new Error(`Unknown supply ${item.supplyKey}`)
    return sum + supply.unitCostCents * item.quantity
  }, 0)
}

function groupsByStatus(status: string) {
  return dataset.treatmentGroups.filter(group => group.status === status)
}

function completedPaidGroups() {
  return groupsByStatus('completed_paid')
}

function revenueForGroups(groups = dataset.treatmentGroups) {
  return groups.reduce((sum, group) => {
    const service = servicesByKey.get(group.serviceKey)
    return sum + (service?.priceCents || 0) * group.count
  }, 0)
}

function variableCostForGroups(groups = dataset.treatmentGroups) {
  return groups.reduce((sum, group) => {
    const service = servicesByKey.get(group.serviceKey)
    return sum + (service?.expectedVariableCostCents || 0) * group.count
  }, 0)
}

function allocatedFixedForGroups(groups = dataset.treatmentGroups) {
  return groups.reduce((sum, group) => {
    const service = servicesByKey.get(group.serviceKey)
    return sum + (service?.expectedAllocatedFixedCostCents || 0) * group.count
  }, 0)
}

function treatmentCount(groups = dataset.treatmentGroups) {
  return groups.reduce((sum, group) => sum + group.count, 0)
}

describe('Laralis QA dataset contract', () => {
  it('keeps the seed scoped to a QA workspace and disposable QA users', () => {
    expect(dataset.workspace.slug).toBe('qa-workspace-laralis')
    expect(dataset.clinics).toHaveLength(2)
    expect(dataset.users).toHaveLength(6)
    expect(dataset.users.every(user => user.email.endsWith('@laralis.test'))).toBe(true)
  })

  it('defines two clinics but assigns the business fixture to clinic A only', () => {
    const clinicKeysWithTreatments = new Set(dataset.treatmentGroups.map(group => group.clinicKey))

    expect(clinicKeysWithTreatments).toEqual(new Set(['clinicA']))
    expect(dataset.clinics.map(clinic => clinic.key)).toEqual(['clinicA', 'clinicB'])
  })

  it('keeps patient acquisition counts aligned with the source oracles', () => {
    const patientTotal = dataset.patientGroups.reduce((sum, group) => sum + group.count, 0)
    const bySourceName = Object.fromEntries(
      dataset.patientGroups.map(group => {
        const source = sourcesByKey.get(group.sourceKey)
        return [source?.name || group.sourceKey, group.count]
      })
    )

    expect(patientTotal).toBe(oracles.patients.total)
    expect(bySourceName).toEqual(oracles.patients.bySource)
  })

  it('keeps every service variable-cost oracle derivable from seeded supplies', () => {
    for (const service of dataset.services) {
      expect(Number.isInteger(service.durationMinutes)).toBe(true)
      for (const row of service.supplies) {
        expect(Number.isInteger(row.quantity)).toBe(true)
      }

      expect(serviceVariableCost(service.key)).toBe(service.expectedVariableCostCents)
      expect(oracles.services[service.key].variableCostCents).toBe(service.expectedVariableCostCents)
      expect(oracles.services[service.key].allocatedFixedCostCents).toBe(service.expectedAllocatedFixedCostCents)
      expect(oracles.services[service.key].netPerTreatmentCents).toBe(
        service.priceCents - service.expectedVariableCostCents - service.expectedAllocatedFixedCostCents
      )
    }
  })

  it('keeps fixed-cost per minute mathematically pinned', () => {
    expect(fixedCostTotal()).toBe(oracles.fixedCosts.monthlyTotalCents)
    expect(dataset.period.monthlyProductiveMinutes).toBe(
      dataset.period.workingDays * dataset.period.productiveMinutesPerDay
    )
    expect(fixedCostTotal() / dataset.period.monthlyProductiveMinutes).toBe(
      oracles.fixedCosts.costPerMinuteCents
    )
  })
})

describe('Laralis QA business oracles', () => {
  it('keeps treatment status totals explicit, including partial, pending, and cancelled cases', () => {
    expect(treatmentCount()).toBe(oracles.treatments.total)

    for (const [status, expected] of Object.entries(oracles.treatments.byStatus)) {
      const actual = groupsByStatus(status === 'completed_paid' ? 'completed_paid' : status)
        .reduce((sum, group) => sum + group.count, 0)
      expect(actual).toBe(expected)
    }
  })

  it('keeps completed revenue, variable costs, and allocated fixed costs aligned', () => {
    const completed = completedPaidGroups()
    const revenue = revenueForGroups(completed)
    const variableCost = variableCostForGroups(completed)
    const allocatedFixed = allocatedFixedForGroups(completed)

    expect(revenue).toBe(oracles.financial.completedRevenueCents)
    expect(variableCost).toBe(oracles.financial.completedVariableCostCents)
    expect(revenue - variableCost).toBe(oracles.financial.grossProfitCents)
    expect(allocatedFixed).toBe(oracles.financial.allocatedFixedCostCents)
    expect(revenue - variableCost - allocatedFixed).toBe(oracles.financial.serviceNetProfitCents)
  })

  it('keeps collected cash distinct from completed revenue', () => {
    const completedCash = revenueForGroups(completedPaidGroups())
    const partialCash = groupsByStatus('partial').reduce((sum, group) => sum + (group.paidCents || 0), 0)

    expect(completedCash + partialCash).toBe(oracles.financial.cashCollectedCents)
    expect(oracles.financial.cashCollectedCents).toBeGreaterThan(oracles.financial.completedRevenueCents)
  })

  it('keeps Meta Mayo marketing CPA, ROAS, and ROI pinned to the controlled dataset', () => {
    const metaCampaign = dataset.campaigns.find(campaign => campaign.key === 'metaMayo')
    const metaSource = dataset.sources.find(source => source.key === metaCampaign?.sourceKey)
    const metaGroups = dataset.treatmentGroups.filter(
      group => group.sourceKey === metaCampaign?.sourceKey && group.status === 'completed_paid'
    )
    const revenue = revenueForGroups(metaGroups)
    const spend = metaCampaign?.spendCents || 0

    expect(metaSource?.expectedPatients).toBe(oracles.marketing.metaMayo.patients)
    expect(spend).toBe(oracles.marketing.metaMayo.spendCents)
    expect(revenue).toBe(oracles.marketing.metaMayo.revenueCents)
    expect(Math.round(spend / (metaSource?.expectedPatients || 1))).toBe(oracles.marketing.metaMayo.cpaCents)
    expect(Number((revenue / spend).toFixed(4))).toBe(oracles.marketing.metaMayo.roas)
    expect(Number(((revenue - spend) / spend).toFixed(4))).toBe(oracles.marketing.metaMayo.roi)
  })

  it('keeps operating profit and break-even expectations reproducible', () => {
    const completed = completedPaidGroups()
    const revenue = revenueForGroups(completed)
    const variableCost = variableCostForGroups(completed)
    const allocatedFixed = allocatedFixedForGroups(completed)
    const serviceNet = revenue - variableCost - allocatedFixed
    const operatingProfit = serviceNet - fixedCostTotal() + allocatedFixed - oracles.financial.marketingSpendCents
    const averageContribution = Math.round((revenue - variableCost) / treatmentCount(completed))

    expect(operatingProfit).toBe(oracles.financial.operatingProfitCents)
    expect(averageContribution).toBe(oracles.breakEven.averageContributionMarginCents)
    expect(Math.ceil(fixedCostTotal() / averageContribution)).toBe(oracles.breakEven.fixedOnlyTreatments)
    expect(Math.ceil((fixedCostTotal() + oracles.financial.marketingSpendCents) / averageContribution)).toBe(
      oracles.breakEven.fixedPlusMarketingTreatments
    )
  })
})
