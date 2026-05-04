export {}

type QaTimeDataset = {
  clinics: Array<{
    key: string
    name: string
  }>
}

type Clinic = {
  id: string
  name: string
}

type TimeSettings = {
  work_days: number
  hours_per_day: number
  real_pct: number
  monthly_goal_cents?: number | null
}

type CostPerMinuteSnapshot = {
  per_minute_cents: number
  monthly_fixed_cents: number
  effective_minutes_per_month: number
}

type CreatedIds = {
  fixedCostId?: string
  supplyId?: string
  serviceId?: string
  patientId?: string
  treatmentId?: string
}

function selectQaClinic(key = 'clinicA'): Cypress.Chainable<Clinic> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaTimeDataset) => {
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

function responseRows(body: any): any[] {
  if (Array.isArray(body)) return body
  if (Array.isArray(body?.data)) return body.data
  return []
}

function includesQaTime(value: unknown) {
  return typeof value === 'string' && value.toLowerCase().includes('qa-time-')
}

function cleanupQaTimeArtifacts() {
  cy.request('/api/treatments').then((response) => {
    expect(response.status).to.eq(200)
    responseRows(response.body)
      .filter((row) => includesQaTime(row.notes))
      .forEach((row) => deleteIfPresent('/api/treatments', row.id))
  })

  cy.request(`/api/services?search=${encodeURIComponent('QA Servicio Tiempo')}`).then((response) => {
    expect(response.status).to.eq(200)
    responseRows(response.body)
      .filter((row) => includesQaTime(row.name) || includesQaTime(row.description))
      .forEach((row) => deleteIfPresent('/api/services', row.id))
  })

  cy.request(`/api/supplies?search=${encodeURIComponent('QA Insumo Tiempo')}`).then((response) => {
    expect(response.status).to.eq(200)
    responseRows(response.body)
      .filter((row) => includesQaTime(row.name))
      .forEach((row) => deleteIfPresent('/api/supplies', row.id))
  })

  cy.request('/api/fixed-costs?limit=200').then((response) => {
    expect(response.status).to.eq(200)
    responseRows(response.body)
      .filter((row) => includesQaTime(row.concept) || includesQaTime(row.category))
      .forEach((row) => deleteIfPresent('/api/fixed-costs', row.id))
  })

  cy.request(`/api/patients?search=${encodeURIComponent('qa-time-')}`).then((response) => {
    expect(response.status).to.eq(200)
    responseRows(response.body)
      .filter(
        (row) =>
          includesQaTime(row.first_name) ||
          includesQaTime(row.last_name) ||
          includesQaTime(row.email) ||
          includesQaTime(row.notes)
      )
      .forEach((row) => deleteIfPresent('/api/patients', row.id))
  })
}

function getTimeSettings(): Cypress.Chainable<TimeSettings | null> {
  return cy.request('/api/settings/time').then((response) => {
    expect(response.status).to.eq(200)
    return response.body.data as TimeSettings | null
  })
}

function saveTimeSettings(settings: TimeSettings): Cypress.Chainable<TimeSettings> {
  return cy.request('POST', '/api/settings/time', {
    work_days: settings.work_days,
    hours_per_day: settings.hours_per_day,
    real_pct: settings.real_pct,
    monthly_goal_cents: settings.monthly_goal_cents ?? null,
  }).then((response) => {
    expect(response.status).to.eq(200)
    return response.body.data as TimeSettings
  })
}

function getCostPerMinute(): Cypress.Chainable<CostPerMinuteSnapshot> {
  return cy.request('/api/time/cost-per-minute').then((response) => {
    expect(response.status).to.eq(200)
    return response.body.data as CostPerMinuteSnapshot
  })
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function expectedEffectiveMinutes(settings: TimeSettings) {
  return Math.round(settings.work_days * settings.hours_per_day * 60 * (settings.real_pct / 100))
}

function roundPct(value: number) {
  return Math.round(value * 100) / 100
}

describe('Stage time settings and pricing simulations', () => {
  const ids: CreatedIds = {}
  const stamp = `qa-time-${Date.now()}-${Cypress._.random(1000, 9999)}`
  const fixedCostAmountCents = 384000
  const supplyPriceCents = 20000
  const supplyPortions = 5
  const supplyQty = 3
  const serviceMinutes = 45
  const servicePriceCents = 100000
  const targetTime: TimeSettings = {
    work_days: 20,
    hours_per_day: 8,
    real_pct: 80,
    monthly_goal_cents: 2500000,
  }
  const actionTime = {
    work_days: 24,
    hours_per_day: 6,
    real_productivity_pct: 75,
  }

  let clinicId = ''
  let originalTimeSettings: TimeSettings | null = null

  beforeEach(() => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA').then((clinic) => {
      clinicId = clinic.id
    })
    cleanupQaTimeArtifacts()
    getTimeSettings().then((settings) => {
      originalTimeSettings = settings
    })
  })

  afterEach(() => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA')

    deleteIfPresent('/api/treatments', ids.treatmentId)
    deleteIfPresent('/api/services', ids.serviceId)
    deleteIfPresent('/api/supplies', ids.supplyId)
    deleteIfPresent('/api/fixed-costs', ids.fixedCostId)
    deleteIfPresent('/api/patients', ids.patientId)
    cleanupQaTimeArtifacts()

    if (originalTimeSettings) {
      saveTimeSettings(originalTimeSettings)
    }

    ids.treatmentId = undefined
    ids.serviceId = undefined
    ids.supplyId = undefined
    ids.fixedCostId = undefined
    ids.patientId = undefined
  })

  it('propagates productivity settings into service costs, margins, and Lara simulations', () => {
    const expectedVariableCost = Math.round((supplyPriceCents / supplyPortions) * supplyQty)
    let monthlyFixedBeforeQaCost = 0
    let expectedInitialFixedCost = 0
    let expectedActionFixedCost = 0
    let expectedInitialTotalCost = 0
    let expectedActionTotalCost = 0

    saveTimeSettings(targetTime).then((saved) => {
      expect(saved.work_days).to.eq(targetTime.work_days)
      expect(saved.hours_per_day).to.eq(targetTime.hours_per_day)
      expect(saved.real_pct).to.eq(targetTime.real_pct)
    })

    getCostPerMinute().then((baseline) => {
      monthlyFixedBeforeQaCost = baseline.monthly_fixed_cents
      expect(baseline.effective_minutes_per_month).to.eq(expectedEffectiveMinutes(targetTime))
    })

    cy.request('POST', '/api/fixed-costs', {
      category: 'other',
      concept: `QA Tiempo Simulacion ${stamp}`,
      amount_cents: fixedCostAmountCents,
    }).then((response) => {
      expect(response.status).to.eq(201)
      ids.fixedCostId = response.body.data.id
    })

    getCostPerMinute().then((snapshot) => {
      expect(snapshot.monthly_fixed_cents).to.eq(monthlyFixedBeforeQaCost + fixedCostAmountCents)
      expect(snapshot.effective_minutes_per_month).to.eq(expectedEffectiveMinutes(targetTime))
      expect(snapshot.per_minute_cents).to.eq(
        Math.round(snapshot.monthly_fixed_cents / snapshot.effective_minutes_per_month)
      )
      expectedInitialFixedCost = Math.round(serviceMinutes * snapshot.per_minute_cents)
      expectedInitialTotalCost = expectedInitialFixedCost + expectedVariableCost
    })

    cy.request('POST', '/api/supplies', {
      name: `QA Insumo Tiempo ${stamp}`,
      category: 'qa-time',
      presentation: 'kit',
      price_cents: supplyPriceCents,
      portions: supplyPortions,
      stock_quantity: 20,
      min_stock_alert: 2,
    }).then((response) => {
      expect(response.status).to.eq(201)
      ids.supplyId = response.body.data.id
      expect(response.body.data.cost_per_portion_cents).to.eq(supplyPriceCents / supplyPortions)
    })

    cy.then(() => {
      cy.request('POST', '/api/services', {
        name: `QA Servicio Tiempo ${stamp}`,
        category: 'qa-time',
        est_minutes: serviceMinutes,
        description: `service for ${stamp}`,
        target_price: servicePriceCents / 100,
        margin_pct: 30,
        supplies: [{ supply_id: ids.supplyId, qty: supplyQty }],
    }).then((response) => {
      ids.serviceId = response.body.data.id
      expect(response.status).to.eq(201)
      })
    })

    cy.then(() => {
      cy.request(`/api/services?search=${encodeURIComponent(stamp)}`).then((response) => {
        expect(response.status).to.eq(200)
        const service = (response.body || []).find((row: any) => row.id === ids.serviceId)
        expect(service, 'service with live costs').to.exist
        expect(service.variable_cost_cents).to.eq(expectedVariableCost)
        expect(service.fixed_cost_cents).to.eq(expectedInitialFixedCost)
        expect(service.total_cost_cents).to.eq(expectedInitialTotalCost)
        expect(service.price_cents).to.eq(servicePriceCents)
      })

      cy.request(`/api/services/${ids.serviceId}/cost`).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.data.variable_cost_cents).to.eq(expectedVariableCost)
        expect(response.body.data.fixed_cost_cents).to.eq(expectedInitialFixedCost)
        expect(response.body.data.total_cost_cents).to.eq(expectedInitialTotalCost)
      })
    })

    cy.request('POST', '/api/patients', {
      first_name: `QA Tiempo ${stamp}`,
      last_name: 'Paciente',
      email: `${stamp}@laralis.test`,
      phone: '+15555551999',
      first_visit_date: todayIsoDate(),
      acquisition_date: todayIsoDate(),
      gender: 'other',
      notes: `created by ${stamp}`,
    }).then((response) => {
      ids.patientId = response.body.data.id
      expect([200, 201], 'patient create status').to.include(response.status)
    })

    cy.then(() => {
      cy.request('POST', '/api/treatments', {
        patient_id: ids.patientId,
        service_id: ids.serviceId,
        treatment_date: todayIsoDate(),
        treatment_time: '10:30',
        minutes: serviceMinutes,
        variable_cost_cents: expectedVariableCost,
        margin_pct: 30,
        price_cents: servicePriceCents,
        amount_paid_cents: servicePriceCents,
        status: 'completed',
        notes: `created by ${stamp}`,
      }).then((response) => {
        ids.treatmentId = response.body.data.id
        expect([200, 201], 'treatment create status').to.include(response.status)
      })
    })

    cy.then(() => {
      cy.request('POST', '/api/actions/simulate-price-change', {
        clinic_id: clinicId,
        service_id: ids.serviceId,
        change_type: 'percentage',
        change_value: 10,
      }).then((response) => {
        expect(response.status).to.eq(200)
        const action = response.body.data
        const result = action.result
        const simulation = result.simulation_by_service[0]
        const expectedNewPrice = Math.round(servicePriceCents * 1.1)
        const expectedCurrentProfit = servicePriceCents - expectedInitialTotalCost
        const expectedNewProfit = expectedNewPrice - expectedInitialTotalCost

        expect(result.before.total_treatments).to.eq(1)
        expect(result.before.total_monthly_revenue_cents).to.eq(servicePriceCents)
        expect(result.after.total_monthly_revenue_cents).to.eq(expectedNewPrice)
        expect(result.after.revenue_change_cents).to.eq(expectedNewPrice - servicePriceCents)
        expect(simulation.service_id).to.eq(ids.serviceId)
        expect(simulation.treatment_count).to.eq(1)
        expect(simulation.current_price_cents).to.eq(servicePriceCents)
        expect(simulation.new_price_cents).to.eq(expectedNewPrice)
        expect(simulation.fixed_cost_cents).to.eq(expectedInitialFixedCost)
        expect(simulation.variable_cost_cents).to.eq(expectedVariableCost)
        expect(simulation.total_cost_cents).to.eq(expectedInitialTotalCost)
        expect(simulation.current_profit_per_treatment_cents).to.eq(expectedCurrentProfit)
        expect(simulation.new_profit_per_treatment_cents).to.eq(expectedNewProfit)
        expect(simulation.current_margin_pct).to.eq(
          roundPct((expectedCurrentProfit / expectedInitialTotalCost) * 100)
        )
        expect(simulation.new_margin_pct).to.eq(
          roundPct((expectedNewProfit / expectedInitialTotalCost) * 100)
        )
      })
    })

    cy.then(() => {
      cy.request('POST', '/api/actions/update-time-settings', {
        clinic_id: clinicId,
        ...actionTime,
        dry_run: true,
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.data.result.before.effective_minutes_month).to.eq(
          expectedEffectiveMinutes(targetTime)
        )
        expect(response.body.data.result.after.effective_minutes_month).to.eq(
          Math.round(
            actionTime.work_days *
              actionTime.hours_per_day *
              60 *
              (actionTime.real_productivity_pct / 100)
          )
        )
      })

      getTimeSettings().then((settings) => {
        expect(settings?.work_days).to.eq(targetTime.work_days)
        expect(settings?.hours_per_day).to.eq(targetTime.hours_per_day)
        expect(settings?.real_pct).to.eq(targetTime.real_pct)
      })
    })

    cy.then(() => {
      cy.request('POST', '/api/actions/update-time-settings', {
        clinic_id: clinicId,
        ...actionTime,
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.data.result.after.work_days).to.eq(actionTime.work_days)
        expect(response.body.data.result.after.hours_per_day).to.eq(actionTime.hours_per_day)
        expect(response.body.data.result.after.real_productivity_pct).to.eq(
          actionTime.real_productivity_pct
        )
      })
    })

    getCostPerMinute().then((snapshot) => {
      const expectedEffective = Math.round(
        actionTime.work_days * actionTime.hours_per_day * 60 * (actionTime.real_productivity_pct / 100)
      )

      expect(snapshot.monthly_fixed_cents).to.eq(monthlyFixedBeforeQaCost + fixedCostAmountCents)
      expect(snapshot.effective_minutes_per_month).to.eq(expectedEffective)
      expect(snapshot.per_minute_cents).to.eq(Math.round(snapshot.monthly_fixed_cents / expectedEffective))
      expectedActionFixedCost = Math.round(serviceMinutes * snapshot.per_minute_cents)
      expectedActionTotalCost = expectedActionFixedCost + expectedVariableCost
    })

    cy.then(() => {
      cy.request(`/api/services/${ids.serviceId}/cost`).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.data.fixed_cost_cents).to.eq(expectedActionFixedCost)
        expect(response.body.data.variable_cost_cents).to.eq(expectedVariableCost)
        expect(response.body.data.total_cost_cents).to.eq(expectedActionTotalCost)
      })

      cy.request('POST', '/api/actions/simulate-price-change', {
        clinic_id: clinicId,
        service_id: ids.serviceId,
        change_type: 'fixed',
        change_value: 5000,
      }).then((response) => {
        expect(response.status).to.eq(200)
        const simulation = response.body.data.result.simulation_by_service[0]
        const expectedNewPrice = servicePriceCents + 5000
        const expectedCurrentProfit = servicePriceCents - expectedActionTotalCost
        const expectedNewProfit = expectedNewPrice - expectedActionTotalCost

        expect(simulation.fixed_cost_cents).to.eq(expectedActionFixedCost)
        expect(simulation.variable_cost_cents).to.eq(expectedVariableCost)
        expect(simulation.total_cost_cents).to.eq(expectedActionTotalCost)
        expect(simulation.current_profit_per_treatment_cents).to.eq(expectedCurrentProfit)
        expect(simulation.new_profit_per_treatment_cents).to.eq(expectedNewProfit)
        expect(simulation.current_margin_pct).to.eq(
          roundPct((expectedCurrentProfit / expectedActionTotalCost) * 100)
        )
        expect(simulation.new_margin_pct).to.eq(
          roundPct((expectedNewProfit / expectedActionTotalCost) * 100)
        )
      })
    })
  })
})
