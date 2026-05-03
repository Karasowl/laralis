describe('Stage permission boundaries', () => {
  const viewerEmail = 'qa-viewer@laralis.test'
  const stamp = `qa-permission-${Date.now()}-${Cypress._.random(1000, 9999)}`
  const patientEmail = `${stamp}@laralis.test`
  let ownerCreatedPatientId: string | undefined

  function rowsFromBody(body: any) {
    return Array.isArray(body) ? body : (body.data || [])
  }

  function selectClinicA() {
    cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
      const clinicAName = dataset.clinics.find((clinic: any) => clinic.key === 'clinicA')?.name

      cy.request('/api/clinics').then((clinicsResponse) => {
        expect(clinicsResponse.status).to.eq(200)
        const clinicA = (clinicsResponse.body.data || []).find((clinic: any) => clinic.name === clinicAName)
        expect(clinicA, 'current user can access QA clinic A').to.exist

        cy.request('POST', '/api/clinics', { clinicId: clinicA.id }).then((selectResponse) => {
          expect(selectResponse.status).to.eq(200)
        })
      })
    })
  }

  afterEach(() => {
    if (!ownerCreatedPatientId) return

    cy.loginAsDoctor()
    cy.request({
      method: 'DELETE',
      url: `/api/patients/${ownerCreatedPatientId}`,
      failOnStatusCode: false,
    }).then((response) => {
      expect([200, 204, 404], 'owner cleanup patient').to.include(response.status)
    })
    ownerCreatedPatientId = undefined
  })

  it('exposes viewer permissions as read-only for patients', () => {
    cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
    selectClinicA()

    cy.request('/api/permissions/my').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.workspaceRole).to.eq('viewer')
      expect(response.body.clinicRole).to.eq('viewer')
      expect(response.body.permissions['patients.view']).to.eq(true)
      expect(response.body.permissions['patients.create']).to.eq(false)
      expect(response.body.permissions['patients.edit']).to.eq(false)
      expect(response.body.permissions['patients.delete']).to.eq(false)
      expect(response.body.permissions['services.view']).to.eq(true)
      expect(response.body.permissions['services.create']).to.eq(false)
      expect(response.body.permissions['services.edit']).to.eq(false)
      expect(response.body.permissions['services.delete']).to.eq(false)
      expect(response.body.permissions['supplies.view']).to.eq(true)
      expect(response.body.permissions['supplies.create']).to.eq(false)
      expect(response.body.permissions['supplies.edit']).to.eq(false)
      expect(response.body.permissions['supplies.delete']).to.eq(false)
      expect(response.body.permissions['treatments.view']).to.eq(true)
      expect(response.body.permissions['treatments.create']).to.eq(false)
      expect(response.body.permissions['treatments.edit']).to.eq(false)
      expect(response.body.permissions['treatments.delete']).to.eq(false)
    })
  })

  it('blocks viewer patient writes at the API and still allows owner writes', () => {
    cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
    selectClinicA()

    cy.request({
      method: 'POST',
      url: '/api/patients',
      failOnStatusCode: false,
      body: {
        first_name: 'QA Viewer',
        last_name: stamp,
        email: patientEmail,
        first_visit_date: '2026-05-25',
        acquisition_date: '2026-05-25',
        gender: 'other',
      },
    }).then((response) => {
      expect(response.status, 'viewer cannot create patients').to.eq(403)
      expect(response.body.error).to.eq('Forbidden')
    })

    cy.loginAsDoctor()
    cy.request('POST', '/api/patients', {
      first_name: 'QA Owner',
      last_name: stamp,
      email: patientEmail,
      first_visit_date: '2026-05-25',
      acquisition_date: '2026-05-25',
      gender: 'other',
    }).then((response) => {
      expect([200, 201], 'owner can create patients').to.include(response.status)
      ownerCreatedPatientId = response.body.data.id
    })
  })

  it('blocks viewer writes for supplies, services, and treatments while preserving reads', () => {
    cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
    selectClinicA()

    cy.request('/api/supplies').then((suppliesResponse) => {
      expect(suppliesResponse.status).to.eq(200)
      const supplies = rowsFromBody(suppliesResponse.body)
      expect(supplies.length, 'viewer can read supplies').to.be.greaterThan(0)
      const supply = supplies[0]

      cy.request(`/api/supplies/${supply.id}`).then((supplyResponse) => {
        expect(supplyResponse.status).to.eq(200)
        expect(supplyResponse.body.data.id).to.eq(supply.id)
      })

      cy.request({
        method: 'POST',
        url: '/api/supplies',
        failOnStatusCode: false,
        body: {
          name: `QA Viewer Supply ${stamp}`,
          category: 'qa-permission',
          presentation: 'unidad',
          price_cents: 10000,
          portions: 1,
        },
      }).then((response) => {
        expect(response.status, 'viewer cannot create supplies').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        method: 'PUT',
        url: `/api/supplies/${supply.id}`,
        failOnStatusCode: false,
        body: {
          name: supply.name,
          category: supply.category,
          presentation: supply.presentation,
          price_cents: supply.price_cents,
          portions: supply.portions,
        },
      }).then((response) => {
        expect(response.status, 'viewer cannot edit supplies').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        method: 'DELETE',
        url: `/api/supplies/${supply.id}`,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status, 'viewer cannot delete supplies').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request('/api/services').then((servicesResponse) => {
        expect(servicesResponse.status).to.eq(200)
        const services = rowsFromBody(servicesResponse.body)
        expect(services.length, 'viewer can read services').to.be.greaterThan(0)
        const service = services[0]

        cy.request(`/api/services/${service.id}`).then((serviceResponse) => {
          expect(serviceResponse.status).to.eq(200)
          expect(serviceResponse.body.data.id).to.eq(service.id)
        })

        cy.request({
          method: 'POST',
          url: '/api/services',
          failOnStatusCode: false,
          body: {
            name: `QA Viewer Service ${stamp}`,
            category: 'qa-permission',
            est_minutes: 30,
            target_price: 1000,
            margin_pct: 30,
            supplies: [{ supply_id: supply.id, qty: 1 }],
          },
        }).then((response) => {
          expect(response.status, 'viewer cannot create services').to.eq(403)
          expect(response.body.error).to.eq('Forbidden')
        })

        cy.request({
          method: 'PUT',
          url: `/api/services/${service.id}`,
          failOnStatusCode: false,
          body: {
            name: service.name,
            category: service.category || 'qa-permission',
            est_minutes: service.est_minutes || 30,
            margin_pct: service.margin_pct || 30,
            original_price_cents: service.original_price_cents || service.price_cents || 100000,
            discount_type: service.discount_type || 'none',
            discount_value: service.discount_value || 0,
          },
        }).then((response) => {
          expect(response.status, 'viewer cannot edit services').to.eq(403)
          expect(response.body.error).to.eq('Forbidden')
        })

        cy.request({
          method: 'DELETE',
          url: `/api/services/${service.id}`,
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status, 'viewer cannot delete services').to.eq(403)
          expect(response.body.error).to.eq('Forbidden')
        })

        cy.request('/api/patients').then((patientsResponse) => {
          expect(patientsResponse.status).to.eq(200)
          const patients = rowsFromBody(patientsResponse.body)
          expect(patients.length, 'viewer can read patients needed for treatment assertions').to.be.greaterThan(0)

          cy.request('/api/treatments').then((treatmentsResponse) => {
            expect(treatmentsResponse.status).to.eq(200)
            const treatments = rowsFromBody(treatmentsResponse.body)
            expect(treatments.length, 'viewer can read treatments').to.be.greaterThan(0)
            const treatment = treatments[0]

            cy.request({
              method: 'POST',
              url: '/api/treatments',
              failOnStatusCode: false,
              body: {
                patient_id: patients[0].id,
                service_id: service.id,
                treatment_date: '2026-05-26',
                treatment_time: '10:00',
                minutes: 30,
                variable_cost_cents: 0,
                price_cents: 100000,
                amount_paid_cents: 0,
                status: 'completed',
              },
            }).then((response) => {
              expect(response.status, 'viewer cannot create treatments').to.eq(403)
              expect(response.body.error).to.eq('Forbidden')
            })

            cy.request({
              method: 'PUT',
              url: `/api/treatments/${treatment.id}`,
              failOnStatusCode: false,
              body: {
                notes: `viewer blocked ${stamp}`,
              },
            }).then((response) => {
              expect(response.status, 'viewer cannot edit treatments').to.eq(403)
              expect(response.body.error).to.eq('Forbidden')
            })

            cy.request({
              method: 'DELETE',
              url: `/api/treatments/${treatment.id}`,
              failOnStatusCode: false,
            }).then((response) => {
              expect(response.status, 'viewer cannot delete treatments').to.eq(403)
              expect(response.body.error).to.eq('Forbidden')
            })
          })
        })
      })
    })
  })
})
