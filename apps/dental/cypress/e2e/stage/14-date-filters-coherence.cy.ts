export {}

type QaDateDataset = {
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

type DateRange = {
  from: string
  to: string
}

type DateSurface = {
  dashboardRevenueCurrent: number
  dashboardRevenueCount: number
  dashboardExpensesCurrent: number
  dashboardExpenseCount: number
  dashboardTreatmentsTotal: number
  dashboardTreatmentsCompleted: number
  dashboardPatientsAttended: number
  treatmentListIds: string[]
  expenseListIds: string[]
  reportsRevenueTotal: number
  reportsRevenueCount: number
  reportsSummaryTreatments: number
  reportsSummaryRevenue: number
  revenueChartRevenue: number
  revenueChartExpenses: number
  categoryRevenueByName: Record<string, number>
  serviceChartNames: string[]
}

type CreatedIds = {
  supplyId?: string
  inRangeServiceId?: string
  outOfRangeServiceId?: string
  inRangePatientId?: string
  outOfRangePatientId?: string
  inRangeTreatmentId?: string
  outOfRangeTreatmentId?: string
  inRangeExpenseId?: string
  outOfRangeExpenseId?: string
}

function selectQaClinic(key = 'clinicA'): Cypress.Chainable<Clinic> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDateDataset) => {
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
    expect([200, 204, 404, 409], `cleanup ${path}/${id}`).to.include(response.status)
  })
}

function deleteQaDateArtifacts() {
  cy.request('/api/treatments?start_date=2026-07-01&end_date=2026-08-31').then((response) => {
    expect(response.status).to.eq(200)
    for (const treatment of response.body.data || []) {
      const text = `${treatment.notes || ''} ${treatment.service?.name || ''}`
      if (text.includes('qa-date-') || text.includes('QA Fecha')) {
        deleteIfPresent('/api/treatments', treatment.id)
      }
    }
  })

  cy.request('/api/expenses?start_date=2026-07-01&end_date=2026-08-31').then((response) => {
    expect(response.status).to.eq(200)
    for (const expense of response.body.data || []) {
      const text = `${expense.description || ''} ${expense.vendor || ''}`
      if (text.includes('qa-date-') || text.includes('QA gasto julio') || text.includes('QA gasto agosto')) {
        deleteIfPresent('/api/expenses', expense.id)
      }
    }
  })

  cy.request('/api/services?search=QA%20Fecha').then((response) => {
    expect(response.status).to.eq(200)
    for (const service of response.body || []) {
      const name = service.name || ''
      if (name.includes('qa-date-') || name.startsWith('QA Fecha')) {
        deleteIfPresent('/api/services', service.id)
      }
    }
  })

  cy.request('/api/supplies?search=QA%20Insumo%20Fechas').then((response) => {
    expect(response.status).to.eq(200)
    for (const supply of response.body.data || []) {
      const name = supply.name || ''
      if (name.includes('qa-date-') || name.startsWith('QA Insumo Fechas')) {
        deleteIfPresent('/api/supplies', supply.id)
      }
    }
  })

  cy.request('/api/patients?search=qa-date').then((response) => {
    expect(response.status).to.eq(200)
    for (const patient of response.body.data || []) {
      const text = `${patient.email || ''} ${patient.last_name || ''}`
      if (text.includes('qa-date-')) {
        deleteIfPresent('/api/patients', patient.id)
      }
    }
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

function rangeParams(range: DateRange, queryNames: 'date' | 'start' | 'report' = 'date') {
  if (queryNames === 'start') return `start_date=${range.from}&end_date=${range.to}`
  if (queryNames === 'report') return `from=${range.from}&to=${range.to}`
  return `date_from=${range.from}&date_to=${range.to}`
}

function sumRows(rows: Array<Record<string, unknown>>, key: string) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0)
}

function getDateSurface(range: DateRange): Cypress.Chainable<DateSurface> {
  const surface: DateSurface = {
    dashboardRevenueCurrent: 0,
    dashboardRevenueCount: 0,
    dashboardExpensesCurrent: 0,
    dashboardExpenseCount: 0,
    dashboardTreatmentsTotal: 0,
    dashboardTreatmentsCompleted: 0,
    dashboardPatientsAttended: 0,
    treatmentListIds: [],
    expenseListIds: [],
    reportsRevenueTotal: 0,
    reportsRevenueCount: 0,
    reportsSummaryTreatments: 0,
    reportsSummaryRevenue: 0,
    revenueChartRevenue: 0,
    revenueChartExpenses: 0,
    categoryRevenueByName: {},
    serviceChartNames: [],
  }

  return cy
    .request(`/api/dashboard/revenue?period=month&${rangeParams(range)}`)
    .then((response) => {
      expect(response.status).to.eq(200)
      surface.dashboardRevenueCurrent = Number(response.body.revenue?.current || 0)
      surface.dashboardRevenueCount = Number(response.body.totals?.current_count || 0)
    })
    .then(() => cy.request(`/api/dashboard/expenses?period=month&${rangeParams(range)}`))
    .then((response) => {
      expect(response.status).to.eq(200)
      surface.dashboardExpensesCurrent = Number(response.body.expenses?.current || 0)
      surface.dashboardExpenseCount = Number(response.body.totals?.current_count || 0)
    })
    .then(() => cy.request(`/api/dashboard/treatments?period=month&${rangeParams(range)}`))
    .then((response) => {
      expect(response.status).to.eq(200)
      surface.dashboardTreatmentsTotal = Number(response.body.treatments?.total || 0)
      surface.dashboardTreatmentsCompleted = Number(response.body.treatments?.completed || 0)
    })
    .then(() => cy.request(`/api/dashboard/patients?period=month&${rangeParams(range)}`))
    .then((response) => {
      expect(response.status).to.eq(200)
      surface.dashboardPatientsAttended = Number(response.body.patients?.attended || 0)
    })
    .then(() => cy.request(`/api/treatments?${rangeParams(range, 'start')}`))
    .then((response) => {
      expect(response.status).to.eq(200)
      surface.treatmentListIds = (response.body.data || []).map((row: { id: string }) => row.id)
    })
    .then(() => cy.request(`/api/expenses?${rangeParams(range, 'start')}`))
    .then((response) => {
      expect(response.status).to.eq(200)
      surface.expenseListIds = (response.body.data || []).map((row: { id: string }) => row.id)
    })
    .then(() => cy.request(`/api/reports/revenue?period=month&${rangeParams(range, 'report')}`))
    .then((response) => {
      expect(response.status).to.eq(200)
      surface.reportsRevenueTotal = Number(response.body.data?.total_cents || 0)
      surface.reportsRevenueCount = Number(response.body.data?.completed_count || 0)
    })
    .then(() => cy.request(`/api/reports/summary?${rangeParams(range, 'report')}`))
    .then((response) => {
      expect(response.status).to.eq(200)
      surface.reportsSummaryTreatments = Number(response.body.data?.counts?.treatments || 0)
      surface.reportsSummaryRevenue = Number(response.body.data?.dashboard?.revenueMonth || 0)
    })
    .then(() => cy.request(`/api/dashboard/charts/revenue?period=month&granularity=month&${rangeParams(range)}`))
    .then((response) => {
      expect(response.status).to.eq(200)
      const rows = response.body.revenue || []
      surface.revenueChartRevenue = sumRows(rows, 'revenue')
      surface.revenueChartExpenses = sumRows(rows, 'expenses')
    })
    .then(() => cy.request(`/api/dashboard/charts/categories?period=month&${rangeParams(range)}`))
    .then((response) => {
      expect(response.status).to.eq(200)
      surface.categoryRevenueByName = Object.fromEntries(
        (response.body.categories || []).map((row: { name: string; value: number }) => [
          row.name,
          Number(row.value || 0),
        ])
      )
    })
    .then(() => cy.request(`/api/dashboard/charts/services?period=month&${rangeParams(range)}`))
    .then((response) => {
      expect(response.status).to.eq(200)
      surface.serviceChartNames = response.body.labels || []
      return surface
    })
}

describe('Stage date filter coherence', () => {
  const ids: CreatedIds = {}
  const stamp = `qa-date-${Date.now()}-${Cypress._.random(1000, 9999)}`
  const selectedRange = { from: '2026-07-01', to: '2026-07-31' }
  const outsideRange = { from: '2026-08-01', to: '2026-08-31' }
  const inRangeDate = '2026-07-10'
  const outOfRangeDate = '2026-08-10'
  const inRangePriceCents = 321000
  const outOfRangePriceCents = 876000
  const inRangeExpenseCents = 45000
  const outOfRangeExpenseCents = 99000
  const inRangeServiceName = `QA Fecha Julio ${stamp}`
  const outOfRangeServiceName = `QA Fecha Agosto ${stamp}`
  let expenseCategory: ExpenseCategory = { name: 'Otros', display_name: 'Otros' }
  let selectedBaseline: DateSurface
  let outsideBaseline: DateSurface

  beforeEach(() => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA')
    cy.request('/api/categories?entity_type=expense').then((response) => {
      expect(response.status).to.eq(200)
      expenseCategory = (response.body.data || [])[0] || expenseCategory
    })
  })

  afterEach(() => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA')
    deleteQaDateArtifacts()

    deleteIfPresent('/api/expenses', ids.outOfRangeExpenseId)
    deleteIfPresent('/api/expenses', ids.inRangeExpenseId)
    deleteIfPresent('/api/treatments', ids.outOfRangeTreatmentId)
    deleteIfPresent('/api/treatments', ids.inRangeTreatmentId)
    deleteIfPresent('/api/services', ids.outOfRangeServiceId)
    deleteIfPresent('/api/services', ids.inRangeServiceId)
    deleteIfPresent('/api/supplies', ids.supplyId)
    deleteIfPresent('/api/patients', ids.outOfRangePatientId)
    deleteIfPresent('/api/patients', ids.inRangePatientId)
  })

  it('keeps selected and outside ranges separated across lists, cards, charts, and reports', () => {
    getDateSurface(selectedRange).then((surface) => {
      selectedBaseline = surface
    })
    getDateSurface(outsideRange).then((surface) => {
      outsideBaseline = surface
    })

    cy.request('POST', '/api/supplies', {
      name: `QA Insumo Fechas ${stamp}`,
      category: 'qa-date-filters',
      presentation: 'unidad',
      price_cents: 20000,
      portions: 10,
      stock_quantity: 30,
      min_stock_alert: 2,
    }).then((response) => {
      expect(response.status).to.eq(201)
      ids.supplyId = response.body.data.id
    })

    cy.then(() => {
      cy.request('POST', '/api/services', {
        name: inRangeServiceName,
        category: 'qa-date-filters',
        est_minutes: 30,
        description: `selected range service ${stamp}`,
        target_price: inRangePriceCents / 100,
        margin_pct: 50,
        supplies: [{ supply_id: ids.supplyId, qty: 1 }],
      }).then((response) => {
        expect(response.status).to.eq(201)
        ids.inRangeServiceId = response.body.data.id
      })

      cy.request('POST', '/api/services', {
        name: outOfRangeServiceName,
        category: 'qa-date-filters',
        est_minutes: 30,
        description: `outside range service ${stamp}`,
        target_price: outOfRangePriceCents / 100,
        margin_pct: 50,
        supplies: [{ supply_id: ids.supplyId, qty: 1 }],
      }).then((response) => {
        expect(response.status).to.eq(201)
        ids.outOfRangeServiceId = response.body.data.id
      })
    })

    cy.then(() => {
      cy.request('POST', '/api/patients', {
        first_name: 'QA Julio',
        last_name: stamp,
        email: `${stamp}-julio@laralis.test`,
        first_visit_date: inRangeDate,
        acquisition_date: inRangeDate,
        gender: 'other',
      }).then((response) => {
        expect(response.status).to.eq(200)
        ids.inRangePatientId = response.body.data.id
      })

      cy.request('POST', '/api/patients', {
        first_name: 'QA Agosto',
        last_name: stamp,
        email: `${stamp}-agosto@laralis.test`,
        first_visit_date: outOfRangeDate,
        acquisition_date: outOfRangeDate,
        gender: 'other',
      }).then((response) => {
        expect(response.status).to.eq(200)
        ids.outOfRangePatientId = response.body.data.id
      })
    })

    cy.then(() => {
      cy.request('POST', '/api/treatments', {
        patient_id: ids.inRangePatientId,
        service_id: ids.inRangeServiceId,
        treatment_date: inRangeDate,
        treatment_time: '10:00',
        minutes: 30,
        variable_cost_cents: 2000,
        margin_pct: 50,
        price_cents: inRangePriceCents,
        amount_paid_cents: inRangePriceCents,
        status: 'completed',
        notes: `selected range ${stamp}`,
      }).then((response) => {
        ids.inRangeTreatmentId = response.body.data.id
        expect([200, 201]).to.include(response.status)
      })

      cy.request('POST', '/api/treatments', {
        patient_id: ids.outOfRangePatientId,
        service_id: ids.outOfRangeServiceId,
        treatment_date: outOfRangeDate,
        treatment_time: '11:00',
        minutes: 30,
        variable_cost_cents: 2000,
        margin_pct: 50,
        price_cents: outOfRangePriceCents,
        amount_paid_cents: outOfRangePriceCents,
        status: 'completed',
        notes: `outside range ${stamp}`,
      }).then((response) => {
        ids.outOfRangeTreatmentId = response.body.data.id
        expect([200, 201]).to.include(response.status)
      })
    })

    cy.then(() => {
      cy.request('POST', '/api/expenses', {
        ...categoryPayload(expenseCategory),
        expense_date: inRangeDate,
        description: `QA gasto julio ${stamp}`,
        amount_cents: inRangeExpenseCents,
        vendor: `Proveedor julio ${stamp}`,
        is_recurring: false,
        is_variable: false,
        expense_category: 'other',
      }).then((response) => {
        expect(response.status).to.eq(201)
        ids.inRangeExpenseId = response.body.data.id
      })

      cy.request('POST', '/api/expenses', {
        ...categoryPayload(expenseCategory),
        expense_date: outOfRangeDate,
        description: `QA gasto agosto ${stamp}`,
        amount_cents: outOfRangeExpenseCents,
        vendor: `Proveedor agosto ${stamp}`,
        is_recurring: false,
        is_variable: false,
        expense_category: 'other',
      }).then((response) => {
        expect(response.status).to.eq(201)
        ids.outOfRangeExpenseId = response.body.data.id
      })
    })

    cy.then(() => {
      getDateSurface(selectedRange).then((afterSelected) => {
        expect(afterSelected.dashboardRevenueCurrent).to.eq(
          selectedBaseline.dashboardRevenueCurrent + inRangePriceCents
        )
        expect(afterSelected.dashboardRevenueCount).to.eq(selectedBaseline.dashboardRevenueCount + 1)
        expect(afterSelected.dashboardExpensesCurrent).to.eq(
          selectedBaseline.dashboardExpensesCurrent + inRangeExpenseCents
        )
        expect(afterSelected.dashboardExpenseCount).to.eq(selectedBaseline.dashboardExpenseCount + 1)
        expect(afterSelected.dashboardTreatmentsTotal).to.eq(selectedBaseline.dashboardTreatmentsTotal + 1)
        expect(afterSelected.dashboardTreatmentsCompleted).to.eq(
          selectedBaseline.dashboardTreatmentsCompleted + 1
        )
        expect(afterSelected.dashboardPatientsAttended).to.eq(selectedBaseline.dashboardPatientsAttended + 1)
        expect(afterSelected.treatmentListIds).to.include(ids.inRangeTreatmentId)
        expect(afterSelected.treatmentListIds).not.to.include(ids.outOfRangeTreatmentId)
        expect(afterSelected.expenseListIds).to.include(ids.inRangeExpenseId)
        expect(afterSelected.expenseListIds).not.to.include(ids.outOfRangeExpenseId)
        expect(afterSelected.reportsRevenueTotal).to.eq(selectedBaseline.reportsRevenueTotal + inRangePriceCents)
        expect(afterSelected.reportsRevenueCount).to.eq(selectedBaseline.reportsRevenueCount + 1)
        expect(afterSelected.reportsSummaryTreatments).to.eq(selectedBaseline.reportsSummaryTreatments + 1)
        expect(afterSelected.reportsSummaryRevenue).to.eq(
          selectedBaseline.reportsSummaryRevenue + inRangePriceCents
        )
        expect(afterSelected.revenueChartRevenue).to.eq(selectedBaseline.revenueChartRevenue + inRangePriceCents)
        expect(afterSelected.revenueChartExpenses).to.eq(
          selectedBaseline.revenueChartExpenses + inRangeExpenseCents
        )
        expect(afterSelected.categoryRevenueByName[inRangeServiceName]).to.eq(inRangePriceCents)
        expect(afterSelected.categoryRevenueByName[outOfRangeServiceName] || 0).to.eq(0)
        expect(afterSelected.serviceChartNames).to.include(inRangeServiceName)
        expect(afterSelected.serviceChartNames).not.to.include(outOfRangeServiceName)
      })

      getDateSurface(outsideRange).then((afterOutside) => {
        expect(afterOutside.dashboardRevenueCurrent).to.eq(
          outsideBaseline.dashboardRevenueCurrent + outOfRangePriceCents
        )
        expect(afterOutside.dashboardExpensesCurrent).to.eq(
          outsideBaseline.dashboardExpensesCurrent + outOfRangeExpenseCents
        )
        expect(afterOutside.treatmentListIds).to.include(ids.outOfRangeTreatmentId)
        expect(afterOutside.treatmentListIds).not.to.include(ids.inRangeTreatmentId)
        expect(afterOutside.expenseListIds).to.include(ids.outOfRangeExpenseId)
        expect(afterOutside.expenseListIds).not.to.include(ids.inRangeExpenseId)
        expect(afterOutside.categoryRevenueByName[outOfRangeServiceName]).to.eq(outOfRangePriceCents)
        expect(afterOutside.categoryRevenueByName[inRangeServiceName] || 0).to.eq(0)
      })
    })
  })
})
