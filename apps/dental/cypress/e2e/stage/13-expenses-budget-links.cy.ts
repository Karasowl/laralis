export {}

type QaExpensesDataset = {
  clinics: Array<{
    key: string
    name: string
  }>
}

type Clinic = {
  id: string
  name: string
}

type ExpenseCategory = {
  id?: string
  name?: string | null
  display_name?: string | null
}

type ExpenseStats = {
  total_amount: number
  total_count: number
  by_category: Array<{
    category: string
    amount: number
    count: number
  }>
  vs_fixed_costs: {
    planned: number
    actual: number
    variance: number
    variance_percentage: number
  }
}

type CreatedIds = {
  fixedCostId?: string
  supplyId?: string
  fixedExpenseId?: string
  variableExpenseId?: string
}

function selectQaClinic(key = 'clinicA'): Cypress.Chainable<Clinic> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaExpensesDataset) => {
    const clinicName = dataset.clinics.find((clinic) => clinic.key === key)?.name

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = (clinicsResponse.body.data || []).find((item: Clinic) => item.name === clinicName)
      expect(clinic, `QA ${key}`).to.exist

      return cy.request('POST', '/api/clinics', { clinicId: clinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)
        return clinic as Clinic
      })
    })
  })
}

function deleteIfPresent(path: string, id?: string) {
  if (!id) return

  cy.request({
    method: 'DELETE',
    url: `${path}/${id}`,
    failOnStatusCode: false,
  }).then((response) => {
    expect([200, 204, 404], `cleanup ${path}/${id}`).to.include(response.status)
  })
}

function getExpenseStats(startDate: string, endDate: string): Cypress.Chainable<ExpenseStats> {
  return cy
    .request(`/api/expenses/stats?start_date=${startDate}&end_date=${endDate}`)
    .then((response) => {
      expect(response.status).to.eq(200)
      return response.body.data as ExpenseStats
    })
}

function getSupply(id: string) {
  return cy.request(`/api/supplies/${id}`).then((response) => {
    expect(response.status).to.eq(200)
    return response.body.data
  })
}

function categoryLabel(category: ExpenseCategory) {
  return category.display_name || category.name || 'Otros'
}

function categoryPayload(category: ExpenseCategory) {
  return {
    category_id: category.id,
    category: categoryLabel(category),
  }
}

describe('Stage expenses budget and inventory links', () => {
  const ids: CreatedIds = {}
  const stamp = `qa-expenses-${Date.now()}-${Cypress._.random(1000, 9999)}`
  const startDate = '2026-06-01'
  const endDate = '2026-06-30'
  const fixedExpenseDate = '2026-06-10'
  const variableExpenseDate = '2026-06-11'
  const fixedCostAmountCents = 150000
  const fixedExpenseAmountCents = 125000
  const variableExpenseAmountCents = 60000
  const updatedVariableExpenseAmountCents = 30000
  const initialStock = 5
  const portionsPerPresentation = 10
  let fixedCategory: ExpenseCategory = { name: 'Otros', display_name: 'Otros' }
  let variableCategory: ExpenseCategory = { name: 'Insumos', display_name: 'Insumos' }

  beforeEach(() => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA')
    cy.request('/api/categories?entity_type=expense').then((response) => {
      expect(response.status).to.eq(200)
      const categories = (response.body.data || []) as ExpenseCategory[]
      fixedCategory =
        categories.find((category) => /servicios|renta|admin|otros/i.test(categoryLabel(category))) ||
        categories[0] ||
        fixedCategory
      variableCategory =
        categories.find((category) => /insumos|material/i.test(categoryLabel(category))) ||
        categories[1] ||
        fixedCategory
    })
  })

  afterEach(() => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA')

    deleteIfPresent('/api/expenses', ids.variableExpenseId)
    deleteIfPresent('/api/expenses', ids.fixedExpenseId)
    deleteIfPresent('/api/fixed-costs', ids.fixedCostId)
    deleteIfPresent('/api/supplies', ids.supplyId)

    ids.variableExpenseId = undefined
    ids.fixedExpenseId = undefined
    ids.fixedCostId = undefined
    ids.supplyId = undefined
  })

  it('links fixed expenses to planned fixed costs and variable expenses to supply inventory', () => {
    let baselineStats: ExpenseStats

    getExpenseStats(startDate, endDate).then((stats) => {
      baselineStats = stats
    })

    cy.request('POST', '/api/fixed-costs', {
      category: 'other',
      concept: `QA Presupuesto Gastos ${stamp}`,
      amount_cents: fixedCostAmountCents,
    }).then((response) => {
      ids.fixedCostId = response.body.data.id
      expect(response.status).to.eq(201)
      expect(response.body.data.amount_cents).to.eq(fixedCostAmountCents)
    })

    cy.then(() => {
      cy.request('POST', '/api/expenses', {
        ...categoryPayload(fixedCategory),
        expense_date: fixedExpenseDate,
        description: `QA gasto fijo ${stamp}`,
        amount_cents: fixedExpenseAmountCents,
        vendor: `Proveedor fijo ${stamp}`,
        is_recurring: false,
        is_variable: false,
        expense_category: 'rent',
        related_fixed_cost_id: ids.fixedCostId,
      }).then((response) => {
        ids.fixedExpenseId = response.body.data.id
        expect(response.status).to.eq(201)
        expect(response.body.data.related_fixed_cost_id).to.eq(ids.fixedCostId)
        expect(response.body.data.is_variable).to.eq(false)
        expect(response.body.data.auto_processed).to.eq(false)
      })
    })

    cy.then(() => {
      getExpenseStats(startDate, endDate).then((afterFixed) => {
        expect(afterFixed.total_amount).to.eq(baselineStats.total_amount + fixedExpenseAmountCents)
        expect(afterFixed.total_count).to.eq(baselineStats.total_count + 1)
        expect(afterFixed.vs_fixed_costs.planned).to.eq(
          baselineStats.vs_fixed_costs.planned + fixedCostAmountCents
        )
        expect(afterFixed.vs_fixed_costs.actual).to.eq(
          baselineStats.vs_fixed_costs.actual + fixedExpenseAmountCents
        )
        expect(afterFixed.vs_fixed_costs.variance).to.eq(
          afterFixed.vs_fixed_costs.actual - afterFixed.vs_fixed_costs.planned
        )
      })
    })

    cy.request('POST', '/api/supplies', {
      name: `QA Insumo Gastos ${stamp}`,
      category: 'qa-expenses',
      presentation: 'caja',
      price_cents: 100000,
      portions: portionsPerPresentation,
      stock_quantity: initialStock,
      min_stock_alert: 1,
    }).then((response) => {
      ids.supplyId = response.body.data.id
      expect(response.status).to.eq(201)
      expect(response.body.data.stock_quantity).to.eq(initialStock)
      expect(response.body.data.portions).to.eq(portionsPerPresentation)
    })

    cy.then(() => {
      cy.request('POST', '/api/expenses', {
        ...categoryPayload(variableCategory),
        expense_date: variableExpenseDate,
        description: `QA gasto variable ${stamp}`,
        amount_cents: variableExpenseAmountCents,
        vendor: `Proveedor insumos ${stamp}`,
        is_recurring: false,
        is_variable: true,
        expense_category: 'materials',
        related_supply_id: ids.supplyId,
        quantity: 2,
      }).then((response) => {
        ids.variableExpenseId = response.body.data.id
        expect(response.status).to.eq(201)
        expect(response.body.data.related_supply_id).to.eq(ids.supplyId)
        expect(response.body.data.is_variable).to.eq(true)
        expect(response.body.data.auto_processed).to.eq(true)
      })
    })

    cy.then(() => {
      getSupply(ids.supplyId as string).then((supply) => {
        expect(supply.stock_quantity).to.eq(initialStock + 2 * portionsPerPresentation)
      })

      getExpenseStats(startDate, endDate).then((afterVariable) => {
        expect(afterVariable.total_amount).to.eq(
          baselineStats.total_amount + fixedExpenseAmountCents + variableExpenseAmountCents
        )
        expect(afterVariable.total_count).to.eq(baselineStats.total_count + 2)
        expect(afterVariable.vs_fixed_costs.actual).to.eq(
          baselineStats.vs_fixed_costs.actual + fixedExpenseAmountCents
        )
      })

      cy.request(
        `/api/expenses?start_date=${startDate}&end_date=${endDate}&auto_processed=true`
      ).then((response) => {
        expect(response.status).to.eq(200)
        const rows = response.body.data || []
        expect(rows.map((expense: any) => expense.id)).to.include(ids.variableExpenseId)
        expect(rows.map((expense: any) => expense.id)).not.to.include(ids.fixedExpenseId)
      })

      cy.request(`/api/analytics/expenses?start_date=${startDate}&end_date=${endDate}`).then(
        (response) => {
          expect(response.status).to.eq(200)
          expect(response.body.total_expenses_cents).to.eq(
            baselineStats.total_amount + fixedExpenseAmountCents + variableExpenseAmountCents
          )
          expect(response.body.expenses_count).to.eq(baselineStats.total_count + 2)
        }
      )

      cy.request(`/api/dashboard/expenses?date_from=${startDate}&date_to=${endDate}`).then(
        (response) => {
          expect(response.status).to.eq(200)
          expect(response.body.expenses.current).to.eq(
            baselineStats.total_amount + fixedExpenseAmountCents + variableExpenseAmountCents
          )
          expect(response.body.totals.current_count).to.eq(baselineStats.total_count + 2)
        }
      )
    })

    cy.then(() => {
      cy.request('PUT', `/api/expenses/${ids.variableExpenseId}`, {
        amount_cents: updatedVariableExpenseAmountCents,
        expense_date: variableExpenseDate,
        related_supply_id: ids.supplyId,
        quantity: 1,
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.data.amount_cents).to.eq(updatedVariableExpenseAmountCents)
        expect(response.body.data.quantity).to.eq(1)
      })
    })

    cy.then(() => {
      getSupply(ids.supplyId as string).then((supply) => {
        expect(supply.stock_quantity).to.eq(initialStock + portionsPerPresentation)
      })

      getExpenseStats(startDate, endDate).then((afterUpdate) => {
        expect(afterUpdate.total_amount).to.eq(
          baselineStats.total_amount + fixedExpenseAmountCents + updatedVariableExpenseAmountCents
        )
        expect(afterUpdate.vs_fixed_costs.actual).to.eq(
          baselineStats.vs_fixed_costs.actual + fixedExpenseAmountCents
        )
      })
    })

    cy.then(() => {
      cy.request('DELETE', `/api/expenses/${ids.variableExpenseId}`).then((response) => {
        expect(response.status).to.eq(200)
        ids.variableExpenseId = undefined
      })

      getSupply(ids.supplyId as string).then((supply) => {
        expect(supply.stock_quantity).to.eq(initialStock)
      })
    })
  })
})
