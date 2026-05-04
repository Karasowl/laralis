export {}

type QaDataset = {
  clinics: Array<{
    key: string
    name: string
  }>
}

type AssetSummary = {
  monthly_depreciation_cents: number
  total_investment_cents: number
  asset_count: number
  average_depreciation_months: number
  minimal_asset_present: boolean
}

type EquilibriumSnapshot = {
  fixed_costs_cents: number
  variable_cost_percentage: number
  contribution_margin_percentage: number
  break_even_revenue_cents: number
  daily_target_cents: number
  safety_margin_cents: number
  work_days: number
}

type ProfitSnapshot = {
  costs: {
    depreciation_cents: number
  }
  metadata: {
    monthly_depreciation_cents: number
  }
}

function selectQaClinic(key = 'clinicA') {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
    const clinicName = dataset.clinics.find((clinic) => clinic.key === key)?.name

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = (clinicsResponse.body.data || []).find((item: any) => item.name === clinicName)
      expect(clinic, `QA ${key}`).to.exist

      return cy.request('POST', '/api/clinics', { clinicId: clinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)
        return clinic
      })
    })
  })
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function visibleText($root: JQuery<HTMLElement>) {
  return $root
    .find(':visible')
    .toArray()
    .map((element) => element.textContent || '')
    .join(' ')
}

function getAssetSummary() {
  return cy.request('/api/assets/summary').then((response) => {
    expect(response.status).to.eq(200)
    return response.body.data as AssetSummary
  })
}

function getEquilibrium() {
  return cy.request('/api/equilibrium?variableCostPercentage=35').then((response) => {
    expect(response.status).to.eq(200)
    return response.body.data as EquilibriumSnapshot
  })
}

function getProfitAnalysis() {
  return cy
    .request('/api/analytics/profit-analysis?start_date=2026-05-01&end_date=2026-05-31')
    .then((response) => {
      expect(response.status).to.eq(200)
      return response.body as ProfitSnapshot
    })
}

describe('Stage assets depreciation', () => {
  const stamp = `QA Activo Depreciacion ${Date.now()}`
  const initialPriceCents = 2400000
  const initialMonths = 24
  const updatedPriceCents = 3600000
  const updatedMonths = 48
  let createdAssetId: string | undefined

  beforeEach(() => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA')
  })

  afterEach(() => {
    if (!createdAssetId) return

    cy.loginAsDoctor()
    selectQaClinic('clinicA')
    cy.request({
      method: 'DELETE',
      url: `/api/assets/${createdAssetId}`,
      failOnStatusCode: false,
    }).then((response) => {
      expect([200, 204, 404], 'cleanup asset').to.include(response.status)
    })
    createdAssetId = undefined
  })

  it('creates, updates, deletes an asset and reflects depreciation in business calculations', () => {
    const baseline: {
      summary?: AssetSummary
      equilibrium?: EquilibriumSnapshot
      profit?: ProfitSnapshot
    } = {}

    getAssetSummary()
      .then((summary) => {
        baseline.summary = summary
        return getEquilibrium()
      })
      .then((equilibrium) => {
        baseline.equilibrium = equilibrium
        return getProfitAnalysis()
      })
      .then((profit) => {
        baseline.profit = profit
      })

    cy.then(() => {
      expect(baseline.summary, 'asset summary baseline').to.exist
      expect(baseline.equilibrium, 'equilibrium baseline').to.exist
      expect(baseline.profit, 'profit baseline').to.exist

      const baselineSummary = baseline.summary as AssetSummary
      const baselineEquilibrium = baseline.equilibrium as EquilibriumSnapshot
      const baselineProfit = baseline.profit as ProfitSnapshot
      const initialMonthlyDepreciation = Math.round(initialPriceCents / initialMonths)
      const updatedMonthlyDepreciation = Math.round(updatedPriceCents / updatedMonths)

      cy.request('POST', '/api/assets', {
        name: stamp,
        category: 'equipment',
        purchase_price_pesos: initialPriceCents / 100,
        depreciation_months: initialMonths,
        purchase_date: '2026-05-01',
      }).then((createResponse) => {
        expect(createResponse.status).to.eq(201)
        createdAssetId = createResponse.body.data.id
        expect(createResponse.body.data.name).to.eq(stamp)
        expect(createResponse.body.data.purchase_price_cents).to.eq(initialPriceCents)
        expect(createResponse.body.data.depreciation_months).to.eq(initialMonths)
        expect(createResponse.body.data.category).to.eq('equipment')
      })

      cy.visit('/assets')
      cy.assertAppShell()
      cy.assertNoHorizontalScroll()
      cy.get('main', { timeout: 30000 }).should(($main) => {
        const text = visibleText($main)
        expect(text).to.include(stamp)
        expect(text).to.include(formatCurrency(initialPriceCents))
        expect(text).to.include(formatCurrency(initialMonthlyDepreciation))
      })

      getAssetSummary().then((afterCreate) => {
        expect(afterCreate.asset_count).to.eq(baselineSummary.asset_count + 1)
        expect(afterCreate.total_investment_cents).to.eq(
          baselineSummary.total_investment_cents + initialPriceCents
        )
        expect(afterCreate.monthly_depreciation_cents).to.eq(
          baselineSummary.monthly_depreciation_cents + initialMonthlyDepreciation
        )
        expect(afterCreate.minimal_asset_present).to.eq(true)
      })

      getEquilibrium().then((afterCreate) => {
        expect(afterCreate.fixed_costs_cents).to.eq(
          baselineEquilibrium.fixed_costs_cents + initialMonthlyDepreciation
        )
        expect(afterCreate.break_even_revenue_cents).to.eq(
          Math.round(afterCreate.fixed_costs_cents / (afterCreate.contribution_margin_percentage / 100))
        )
      })

      getProfitAnalysis().then((afterCreate) => {
        expect(afterCreate.metadata.monthly_depreciation_cents).to.eq(
          baselineProfit.metadata.monthly_depreciation_cents + initialMonthlyDepreciation
        )
        expect(afterCreate.costs.depreciation_cents).to.eq(
          baselineProfit.costs.depreciation_cents + initialMonthlyDepreciation
        )
      })

      cy.then(() => {
        expect(createdAssetId, 'created asset id').to.be.a('string')
        cy.request('PUT', `/api/assets/${createdAssetId}`, {
          name: `${stamp} Editado`,
          category: 'equipment',
          purchase_price_pesos: updatedPriceCents / 100,
          depreciation_months: updatedMonths,
          purchase_date: '2026-05-01',
        }).then((updateResponse) => {
          expect(updateResponse.status).to.eq(200)
          expect(updateResponse.body.data.name).to.eq(`${stamp} Editado`)
          expect(updateResponse.body.data.purchase_price_cents).to.eq(updatedPriceCents)
          expect(updateResponse.body.data.depreciation_months).to.eq(updatedMonths)
          expect(updateResponse.body.data.category).to.eq('equipment')
        })
      })

      getAssetSummary().then((afterUpdate) => {
        expect(afterUpdate.asset_count).to.eq(baselineSummary.asset_count + 1)
        expect(afterUpdate.total_investment_cents).to.eq(
          baselineSummary.total_investment_cents + updatedPriceCents
        )
        expect(afterUpdate.monthly_depreciation_cents).to.eq(
          baselineSummary.monthly_depreciation_cents + updatedMonthlyDepreciation
        )
      })

      getEquilibrium().then((afterUpdate) => {
        expect(afterUpdate.fixed_costs_cents).to.eq(
          baselineEquilibrium.fixed_costs_cents + updatedMonthlyDepreciation
        )
      })

      getProfitAnalysis().then((afterUpdate) => {
        expect(afterUpdate.metadata.monthly_depreciation_cents).to.eq(
          baselineProfit.metadata.monthly_depreciation_cents + updatedMonthlyDepreciation
        )
        expect(afterUpdate.costs.depreciation_cents).to.eq(
          baselineProfit.costs.depreciation_cents + updatedMonthlyDepreciation
        )
      })

      cy.then(() => {
        cy.request('DELETE', `/api/assets/${createdAssetId}`).then((deleteResponse) => {
          expect(deleteResponse.status).to.eq(200)
          createdAssetId = undefined
        })
      })

      getAssetSummary().then((afterDelete) => {
        expect(afterDelete.asset_count).to.eq(baselineSummary.asset_count)
        expect(afterDelete.total_investment_cents).to.eq(baselineSummary.total_investment_cents)
        expect(afterDelete.monthly_depreciation_cents).to.eq(
          baselineSummary.monthly_depreciation_cents
        )
      })

      getEquilibrium().then((afterDelete) => {
        expect(afterDelete.fixed_costs_cents).to.eq(baselineEquilibrium.fixed_costs_cents)
      })

      getProfitAnalysis().then((afterDelete) => {
        expect(afterDelete.metadata.monthly_depreciation_cents).to.eq(
          baselineProfit.metadata.monthly_depreciation_cents
        )
        expect(afterDelete.costs.depreciation_cents).to.eq(
          baselineProfit.costs.depreciation_cents
        )
      })
    })
  })
})
