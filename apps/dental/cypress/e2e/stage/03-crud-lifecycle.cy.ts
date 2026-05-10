type CreatedIds = {
  patientId?: string
  supplyId?: string
  serviceId?: string
  treatmentId?: string
}

function expectStatus(response: Cypress.Response<any>, allowed = [200, 201]) {
  expect(allowed, `${response.status} is an allowed status`).to.include(response.status)
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

describe('Stage CRUD lifecycle and dependency guards', () => {
  const ids: CreatedIds = {}
  let stamp = ''
  let patientName = ''
  let patientEmail = ''
  let supplyName = ''
  let serviceName = ''

  beforeEach(() => {
    cy.loginAsDoctor()
    stamp = `qa-${Date.now()}-${Cypress._.random(1000, 9999)}`
    patientName = `QA CRUD ${stamp}`
    patientEmail = `${stamp}@laralis.test`
    supplyName = `QA CRUD Insumo ${stamp}`
    serviceName = `QA CRUD Servicio ${stamp}`
  })

  afterEach(() => {
    deleteIfPresent('/api/treatments', ids.treatmentId)
    deleteIfPresent('/api/services', ids.serviceId)
    deleteIfPresent('/api/supplies', ids.supplyId)
    deleteIfPresent('/api/patients', ids.patientId)

    ids.treatmentId = undefined
    ids.serviceId = undefined
    ids.supplyId = undefined
    ids.patientId = undefined
  })

  it('creates, updates, relates, protects, and cleans patient, supply, service, and treatment records', () => {
    cy.request('POST', '/api/patients', {
      first_name: patientName,
      last_name: 'Paciente',
      email: patientEmail,
      phone: '+15555550999',
      first_visit_date: '2026-05-20',
      acquisition_date: '2026-05-20',
      gender: 'other',
      notes: `created by ${stamp}`,
    }).then((response) => {
      expectStatus(response)
      ids.patientId = response.body.data.id
      expect(response.body.data.email).to.eq(patientEmail)
    })

    cy.then(() => {
      cy.request('PUT', `/api/patients/${ids.patientId}`, {
        first_name: patientName,
        last_name: 'Paciente Editado',
        email: patientEmail,
        phone: '+15555550001',
        first_visit_date: '2026-05-20',
        acquisition_date: '2026-05-20',
        gender: 'other',
        notes: `updated by ${stamp}`,
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.last_name).to.eq('Paciente Editado')
      })

      cy.request(`/api/patients?search=${encodeURIComponent(patientEmail)}`).then((response) => {
        expect(response.status).to.eq(200)
        const matches = response.body.data || []
        expect(matches.map((patient: any) => patient.id)).to.include(ids.patientId)
      })
    })

    cy.request('POST', '/api/supplies', {
      name: supplyName,
      category: 'qa-crud',
      presentation: 'unidad',
      price_cents: 12000,
      portions: 4,
      stock_quantity: 20,
      min_stock_alert: 2,
    }).then((response) => {
      expectStatus(response)
      ids.supplyId = response.body.data.id
      expect(response.body.data.cost_per_portion_cents).to.eq(3000)
    })

    cy.then(() => {
      cy.request('PUT', `/api/supplies/${ids.supplyId}`, {
        name: supplyName,
        category: 'qa-crud',
        presentation: 'unidad',
        price_cents: 16000,
        portions: 4,
        stock_quantity: 18,
        min_stock_alert: 3,
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.cost_per_portion_cents).to.eq(4000)
      })

      cy.request(`/api/supplies?search=${encodeURIComponent(supplyName)}`).then((response) => {
        expect(response.status).to.eq(200)
        const supply = (response.body.data || []).find((row: any) => row.id === ids.supplyId)
        expect(supply, 'created supply').to.exist
        expect(supply.cost_per_portion_cents).to.eq(4000)
      })
    })

    cy.then(() => {
      cy.request('POST', '/api/services', {
        name: serviceName,
        category: 'qa-crud',
        est_minutes: 30,
        description: `created by ${stamp}`,
        target_price: 2500,
        margin_pct: 50,
        supplies: [{ supply_id: ids.supplyId, qty: 2 }],
      }).then((response) => {
        expect(response.status).to.eq(201)
        ids.serviceId = response.body.data.id
        expect(response.body.data.original_price_cents).to.eq(250000)
      })
    })

    cy.then(() => {
      cy.request({
        method: 'DELETE',
        url: `/api/supplies/${ids.supplyId}`,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status, 'supply protected while service uses it').to.eq(409)
        expect(response.body.error).to.eq('supply_in_use')
      })

      cy.request(`/api/services?search=${encodeURIComponent(serviceName)}`).then((response) => {
        expect(response.status).to.eq(200)
        const service = (response.body || []).find((row: any) => row.id === ids.serviceId)
        expect(service, 'created service').to.exist
        expect(service.variable_cost_cents).to.eq(8000)
        expect(service.original_price_cents).to.eq(250000)
      })
    })

    cy.then(() => {
      cy.request('PUT', `/api/services/${ids.serviceId}`, {
        name: serviceName,
        category: 'qa-crud',
        est_minutes: 35,
        description: `updated by ${stamp}`,
        target_price: 2750,
        margin_pct: 55,
        discount_type: 'none',
        discount_value: 0,
        supplies: [{ supply_id: ids.supplyId, qty: 3 }],
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.est_minutes).to.eq(35)
        expect(response.body.data.original_price_cents).to.eq(275000)
      })

      cy.request(`/api/services?search=${encodeURIComponent(serviceName)}`).then((response) => {
        expect(response.status).to.eq(200)
        const service = (response.body || []).find((row: any) => row.id === ids.serviceId)
        expect(service, 'updated service').to.exist
        expect(service.variable_cost_cents).to.eq(12000)
        expect(service.fixed_cost_cents).to.be.greaterThan(0)
      })
    })

    cy.then(() => {
      cy.request('POST', '/api/treatments', {
        patient_id: ids.patientId,
        service_id: ids.serviceId,
        treatment_date: '2026-05-21',
        treatment_time: '11:00',
        minutes: 35,
        variable_cost_cents: 12000,
        margin_pct: 55,
        price_cents: 275000,
        amount_paid_cents: 150000,
        status: 'completed',
        notes: `created by ${stamp}`,
      }).then((response) => {
        expectStatus(response)
        ids.treatmentId = response.body.data.id
        expect(response.body.data.patient_id).to.eq(ids.patientId)
        expect(response.body.data.service_id).to.eq(ids.serviceId)
        expect(response.body.data.amount_paid_cents).to.eq(150000)
      })
    })

    cy.then(() => {
      cy.request({
        method: 'DELETE',
        url: `/api/services/${ids.serviceId}`,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status, 'service protected while treatment uses it').to.eq(409)
        expect(response.body.error).to.eq('service_in_use')
      })

      cy.request({
        method: 'DELETE',
        url: `/api/patients/${ids.patientId}`,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status, 'patient protected while treatment exists').to.eq(409)
        expect(response.body.error).to.eq('patient_in_use')
      })

      cy.request(`/api/treatments?patient_id=${ids.patientId}`).then((response) => {
        expect(response.status).to.eq(200)
        const treatment = (response.body.data || []).find((row: any) => row.id === ids.treatmentId)
        expect(treatment, 'patient treatment history API').to.exist
        expect(treatment.status).to.eq('completed')
        expect(treatment.price_cents).to.eq(275000)
        expect(treatment.amount_paid_cents).to.eq(150000)
      })
    })

    cy.then(() => {
      cy.request('PUT', `/api/treatments/${ids.treatmentId}`, {
        amount_paid_cents: 275000,
        price_cents: 275000,
        status: 'completed',
        notes: `paid by ${stamp}`,
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.amount_paid_cents).to.eq(275000)
        expect(response.body.data.notes).to.eq(`paid by ${stamp}`)
      })
    })
  })
})
