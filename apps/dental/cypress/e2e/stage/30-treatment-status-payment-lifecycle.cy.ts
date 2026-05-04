type Clinic = {
  id: string
  name: string
}

type CreatedIds = {
  patientId?: string
  partialTreatmentId?: string
  cancelledTreatmentId?: string
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

function selectQaClinicAndService(): Cypress.Chainable<{ clinic: Clinic; serviceId: string }> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
    const clinicA = dataset.clinics.find((clinic: any) => clinic.key === 'clinicA')
    const service = dataset.services.find((row: any) => row.key === 'limpieza')

    expect(clinicA, 'QA clinic A definition').to.exist
    expect(service, 'QA limpieza service definition').to.exist

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = (clinicsResponse.body.data || []).find((row: Clinic) => row.name === clinicA.name)
      expect(clinic, 'QA clinic A in stage').to.exist

      return cy.request('POST', '/api/clinics', { clinicId: clinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)

        return cy.request(`/api/services?search=${encodeURIComponent(service.name)}`).then((servicesResponse) => {
          expect(servicesResponse.status).to.eq(200)
          const serviceRow = (servicesResponse.body || []).find((row: any) => row.name === service.name)
          expect(serviceRow, 'QA limpieza service in selected clinic').to.exist

          return {
            clinic,
            serviceId: serviceRow.id,
          }
        })
      })
    })
  })
}

describe('Stage treatment status and payment lifecycle', () => {
  const ids: CreatedIds = {}
  let stamp = ''

  afterEach(() => {
    deleteIfPresent('/api/treatments', ids.partialTreatmentId)
    deleteIfPresent('/api/treatments', ids.cancelledTreatmentId)
    deleteIfPresent('/api/patients', ids.patientId)

    ids.partialTreatmentId = undefined
    ids.cancelledTreatmentId = undefined
    ids.patientId = undefined
  })

  it('tracks scheduled, partial, fully paid, cancelled, and cleanup states', () => {
    cy.loginAsDoctor()
    stamp = `qa-treatment-status-${Date.now()}-${Cypress._.random(1000, 9999)}`

    selectQaClinicAndService().then(({ serviceId }) => {
      cy.request('POST', '/api/patients', {
        first_name: `QA Payment ${stamp}`,
        last_name: 'Paciente',
        email: `${stamp}@laralis.test`,
        phone: '+15555550123',
        first_visit_date: '2026-08-01',
        acquisition_date: '2026-08-01',
        gender: 'other',
        notes: `created by ${stamp}`,
      }).then((response) => {
        expect([200, 201], 'patient creation status').to.include(response.status)
        ids.patientId = response.body.data.id
      })

      cy.then(() => {
        cy.request('POST', '/api/treatments', {
          patient_id: ids.patientId,
          service_id: serviceId,
          treatment_date: '2026-08-01',
          treatment_time: '15:00',
          minutes: 45,
          variable_cost_cents: 9000,
          margin_pct: 50,
          price_cents: 100000,
          amount_paid_cents: 0,
          status: 'pending',
          notes: `partial payment target ${stamp}`,
        }).then((response) => {
          expect(response.status).to.eq(200)
          ids.partialTreatmentId = response.body.data.id
          expect(response.body.data.status).to.eq('scheduled')
          expect(response.body.data.amount_paid_cents || 0).to.eq(0)
        })
      })

      cy.then(() => {
        cy.request({
          method: 'POST',
          url: `/api/treatments/${ids.partialTreatmentId}/payment`,
          failOnStatusCode: false,
          body: { amount_cents: 125000 },
        }).then((response) => {
          expect(response.status).to.eq(400)
          expect(response.body.error).to.eq('Payment exceeds balance')
        })

        cy.request('POST', `/api/treatments/${ids.partialTreatmentId}/payment`, {
          amount_cents: 25000,
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data.amount_paid_cents).to.eq(25000)
          expect(response.body.data.balance_cents).to.eq(75000)
          expect(response.body.data.is_paid).to.eq(false)
        })

        cy.request('POST', `/api/treatments/${ids.partialTreatmentId}/payment`, {
          amount_cents: 75000,
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data.amount_paid_cents).to.eq(100000)
          expect(response.body.data.balance_cents).to.eq(0)
          expect(response.body.data.is_paid).to.eq(true)
        })
      })

      cy.then(() => {
        cy.request('POST', '/api/treatments', {
          patient_id: ids.patientId,
          service_id: serviceId,
          treatment_date: '2026-08-01',
          treatment_time: '16:00',
          minutes: 30,
          variable_cost_cents: 5000,
          margin_pct: 45,
          price_cents: 50000,
          amount_paid_cents: 0,
          status: 'pending',
          notes: `cancel target ${stamp}`,
        }).then((response) => {
          expect(response.status).to.eq(200)
          ids.cancelledTreatmentId = response.body.data.id
          expect(response.body.data.status).to.eq('scheduled')
        })
      })

      cy.then(() => {
        cy.request('PUT', `/api/treatments/${ids.cancelledTreatmentId}`, {
          status: 'cancelled',
          notes: `cancelled by ${stamp}`,
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.data.status).to.eq('cancelled')
          expect(response.body.data.notes).to.eq(`cancelled by ${stamp}`)
        })

        cy.request(`/api/treatments?patient_id=${ids.patientId}`).then((response) => {
          expect(response.status).to.eq(200)
          const treatments = response.body.data || []
          const paid = treatments.find((row: any) => row.id === ids.partialTreatmentId)
          const cancelled = treatments.find((row: any) => row.id === ids.cancelledTreatmentId)

          expect(paid, 'fully paid treatment in patient history').to.exist
          expect(paid.amount_paid_cents).to.eq(100000)
          expect(paid.is_paid).to.eq(true)

          expect(cancelled, 'cancelled treatment in patient history').to.exist
          expect(cancelled.status).to.eq('cancelled')
        })
      })
    })
  })
})
