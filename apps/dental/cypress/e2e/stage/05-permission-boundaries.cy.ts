describe('Stage permission boundaries', () => {
  const viewerEmail = 'qa-viewer@laralis.test'
  const stamp = `qa-permission-${Date.now()}-${Cypress._.random(1000, 9999)}`
  const patientEmail = `${stamp}@laralis.test`
  let ownerCreatedPatientId: string | undefined

  function rowsFromBody(body: any) {
    return Array.isArray(body) ? body : (body.data || [])
  }

  function selectClinicA() {
    return cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
      const clinicAName = dataset.clinics.find((clinic: any) => clinic.key === 'clinicA')?.name

      return cy.request('/api/clinics').then((clinicsResponse) => {
        expect(clinicsResponse.status).to.eq(200)
        const clinicA = (clinicsResponse.body.data || []).find((clinic: any) => clinic.name === clinicAName)
        expect(clinicA, 'current user can access QA clinic A').to.exist

        return cy.request('POST', '/api/clinics', { clinicId: clinicA.id }).then((selectResponse) => {
          expect(selectResponse.status).to.eq(200)
          return clinicA.id
        })
      })
    })
  }

  function expectForbiddenGet(url: string, label: string) {
    cy.request({
      url,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, label).to.eq(403)
      expect(response.body.error).to.eq('Forbidden')
    })
  }

  function expectForbiddenPost(url: string, body: Record<string, any>, label: string) {
    cy.request({
      method: 'POST',
      url,
      body,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, label).to.eq(403)
      expect(response.body.error).to.eq('Forbidden')
    })
  }

  function expectForbiddenRequest(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    label: string,
    body?: Record<string, any>
  ) {
    cy.request({
      method,
      url,
      body,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, label).to.eq(403)
      expect(response.body.error).to.eq('Forbidden')
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
      expect(response.body.permissions['treatments.mark_paid']).to.eq(false)
      expect(response.body.permissions['campaigns.view']).to.eq(false)
      expect(response.body.permissions['campaigns.create']).to.eq(false)
      expect(response.body.permissions['campaigns.edit']).to.eq(false)
      expect(response.body.permissions['campaigns.delete']).to.eq(false)
      expect(response.body.permissions['financial_reports.view']).to.eq(false)
      expect(response.body.permissions['settings.view']).to.eq(false)
      expect(response.body.permissions['settings.edit']).to.eq(false)
      expect(response.body.permissions['team.view']).to.eq(false)
      expect(response.body.permissions['team.invite']).to.eq(false)
      expect(response.body.permissions['team.edit_roles']).to.eq(false)
      expect(response.body.permissions['team.remove']).to.eq(false)
      expect(response.body.permissions['export_import.export']).to.eq(false)
      expect(response.body.permissions['export_import.import']).to.eq(false)
      expect(response.body.permissions['lara.use_query_mode']).to.eq(false)
      expect(response.body.permissions['lara.execute_actions']).to.eq(false)
    })
  })

  it('blocks viewer patient writes at the API and still allows owner writes', () => {
    const fakeConversationId = '00000000-0000-4000-8000-000000000005'

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

    expectForbiddenPost(
      '/api/inbox/convert',
      {
        conversationId: fakeConversationId,
        firstName: 'QA',
        lastName: 'Inbox Forbidden',
      },
      'viewer cannot convert inbox leads into patients'
    )

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

  it('blocks viewer marketing and treatment payment endpoints at the API', () => {
    let platformId: string | undefined
    let campaignId: string | undefined
    let treatmentWithBalanceId: string | undefined

    cy.loginAsDoctor()
    selectClinicA()

    cy.request('/api/marketing/platforms').then((platformsResponse) => {
      expect(platformsResponse.status).to.eq(200)
      const platforms = rowsFromBody(platformsResponse.body)
      expect(platforms.length, 'owner can read marketing platforms for permission fixture').to.be.greaterThan(0)
      platformId = platforms[0].id
    })

    cy.request('/api/marketing/campaigns?includeArchived=true').then((campaignsResponse) => {
      expect(campaignsResponse.status).to.eq(200)
      const campaigns = rowsFromBody(campaignsResponse.body)
      expect(campaigns.length, 'owner can read marketing campaigns for permission fixture').to.be.greaterThan(0)
      campaignId = campaigns[0].id
    })

    cy.request('/api/treatments').then((treatmentsResponse) => {
      expect(treatmentsResponse.status).to.eq(200)
      const treatments = rowsFromBody(treatmentsResponse.body)
      const treatmentWithBalance = treatments.find((treatment: any) => Number(treatment.pending_balance_cents || 0) > 0) || treatments[0]
      expect(treatmentWithBalance?.id, 'treatment fixture for payment permission').to.exist
      treatmentWithBalanceId = treatmentWithBalance.id
    })

    cy.then(() => {
      expect(platformId, 'platform id fixture').to.exist
      expect(campaignId, 'campaign id fixture').to.exist
      expect(treatmentWithBalanceId, 'treatment payment fixture').to.exist

      cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
      selectClinicA()

      cy.request({
        url: '/api/marketing/platforms',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status, 'viewer cannot read marketing platforms').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        method: 'POST',
        url: '/api/marketing/platforms',
        failOnStatusCode: false,
        body: {
          display_name: `QA Viewer Platform ${stamp}`,
        },
      }).then((response) => {
        expect(response.status, 'viewer cannot create marketing platforms').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        method: 'PUT',
        url: '/api/marketing/platforms',
        failOnStatusCode: false,
        body: {
          id: platformId,
          display_name: `QA Viewer Platform ${stamp}`,
        },
      }).then((response) => {
        expect(response.status, 'viewer cannot edit marketing platforms').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        method: 'DELETE',
        url: '/api/marketing/platforms',
        failOnStatusCode: false,
        body: {
          id: platformId,
        },
      }).then((response) => {
        expect(response.status, 'viewer cannot delete marketing platforms').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        method: 'PUT',
        url: `/api/marketing/platforms/${platformId}`,
        failOnStatusCode: false,
        body: {
          display_name: `QA Viewer Platform ${stamp}`,
        },
      }).then((response) => {
        expect(response.status, 'viewer cannot edit dynamic marketing platforms').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        method: 'DELETE',
        url: `/api/marketing/platforms/${platformId}`,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status, 'viewer cannot delete dynamic marketing platforms').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        url: '/api/marketing/campaigns?includeArchived=true',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status, 'viewer cannot read marketing campaigns').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        method: 'POST',
        url: '/api/marketing/campaigns',
        failOnStatusCode: false,
        body: {
          platform_id: platformId,
          name: `QA Viewer Campaign ${stamp}`,
        },
      }).then((response) => {
        expect(response.status, 'viewer cannot create marketing campaigns').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        method: 'PUT',
        url: '/api/marketing/campaigns',
        failOnStatusCode: false,
        body: {
          id: campaignId,
          name: `QA Viewer Campaign ${stamp}`,
        },
      }).then((response) => {
        expect(response.status, 'viewer cannot edit marketing campaigns').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        method: 'PATCH',
        url: `/api/marketing/campaigns/${campaignId}`,
        failOnStatusCode: false,
        body: {
          name: `QA Viewer Campaign ${stamp}`,
        },
      }).then((response) => {
        expect(response.status, 'viewer cannot patch dynamic marketing campaigns').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        method: 'DELETE',
        url: `/api/marketing/campaigns/${campaignId}`,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status, 'viewer cannot delete dynamic marketing campaigns').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        method: 'POST',
        url: `/api/treatments/${treatmentWithBalanceId}/payment`,
        failOnStatusCode: false,
        body: {
          amount_cents: 1,
        },
      }).then((response) => {
        expect(response.status, 'viewer cannot register treatment payments').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })
    })
  })

  it('blocks viewer analytics and reporting endpoints at the API', () => {
    cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
    selectClinicA()

    const marketingRange = 'startDate=2026-05-01&endDate=2026-05-31'

    expectForbiddenGet(
      `/api/analytics/cac-trend?${marketingRange}`,
      'viewer cannot read CAC trend analytics'
    )
    expectForbiddenGet(
      `/api/analytics/channel-roi?${marketingRange}`,
      'viewer cannot read channel ROI analytics'
    )
    expectForbiddenGet(
      `/api/analytics/marketing-metrics?${marketingRange}`,
      'viewer cannot read marketing metrics analytics'
    )
    expectForbiddenGet(
      `/api/marketing/campaigns/roi?${marketingRange}`,
      'viewer cannot read campaign ROI analytics'
    )
    expectForbiddenGet(
      '/api/marketing/roi?months=6',
      'viewer cannot read legacy marketing ROI analytics'
    )
    expectForbiddenGet(
      '/api/analytics/predictions',
      'viewer cannot read revenue predictions'
    )
    expectForbiddenGet(
      '/api/analytics/refunds?from=2026-05-01&to=2026-05-31',
      'viewer cannot read refund analytics'
    )
  })

  it('blocks viewer financial dashboards and clinic export while preserving clinical dashboard reads', () => {
    cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
    selectClinicA().then((clinicId) => {
      cy.request('/api/dashboard/patients').then((response) => {
        expect(response.status, 'viewer can read patient dashboard metrics').to.eq(200)
      })
      cy.request('/api/dashboard/treatments').then((response) => {
        expect(response.status, 'viewer can read treatment dashboard metrics').to.eq(200)
      })

      expectForbiddenGet('/api/dashboard/revenue', 'viewer cannot read revenue dashboard metrics')
      expectForbiddenGet('/api/dashboard/expenses', 'viewer cannot read expenses dashboard metrics')
      expectForbiddenGet('/api/dashboard/activities', 'viewer cannot read mixed financial activity feed')
      expectForbiddenGet('/api/dashboard/charts/revenue', 'viewer cannot read revenue chart data')
      expectForbiddenGet('/api/dashboard/charts/categories', 'viewer cannot read revenue by category chart data')
      expectForbiddenGet(
        `/api/clinic/${clinicId}/export?type=snapshot`,
        'viewer cannot export clinic data'
      )
    })
  })

  it('blocks viewer Lara action endpoints at the API', () => {
    const fakeServiceId = '00000000-0000-4000-8000-000000000001'
    const fakeCategoryId = '00000000-0000-4000-8000-000000000002'

    cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
    selectClinicA().then((clinicId) => {
      expectForbiddenGet(
        `/api/ai/sessions?clinicId=${clinicId}&mode=query`,
        'viewer cannot list Lara query sessions'
      )
      expectForbiddenPost(
        '/api/ai/sessions',
        { clinicId, mode: 'query', title: `QA forbidden ${stamp}` },
        'viewer cannot create Lara query sessions'
      )
      expectForbiddenPost(
        '/api/ai/query',
        { clinicId, query: 'Resume los ingresos de la clinica' },
        'viewer cannot query Lara'
      )
      expectForbiddenGet(
        `/api/ai/feedback?clinicId=${clinicId}`,
        'viewer cannot read Lara feedback analytics'
      )
      expectForbiddenPost(
        '/api/ai/feedback',
        { clinicId, message_id: fakeServiceId, rating: 'positive' },
        'viewer cannot create Lara feedback'
      )
      expectForbiddenPost(
        '/api/actions/analyze-patient-retention',
        { clinic_id: clinicId, period_days: 90 },
        'viewer cannot run Lara patient retention queries'
      )
      expectForbiddenPost(
        '/api/actions/compare-periods',
        {
          clinic_id: clinicId,
          period1_start: '2026-05-01',
          period1_end: '2026-05-31',
          period2_start: '2026-04-01',
          period2_end: '2026-04-30',
        },
        'viewer cannot run Lara financial period comparisons'
      )
      expectForbiddenPost(
        '/api/actions/forecast-revenue',
        { clinic_id: clinicId, days: 30 },
        'viewer cannot run Lara revenue forecasts'
      )
      expectForbiddenPost(
        '/api/actions/identify-underperforming-services',
        { clinic_id: clinicId, min_margin_pct: 30 },
        'viewer cannot run Lara margin analysis'
      )
      expectForbiddenPost(
        '/api/actions/optimize-inventory',
        { clinic_id: clinicId, days_ahead: 30 },
        'viewer cannot run Lara inventory optimization'
      )
      expectForbiddenPost(
        '/api/actions/simulate-price-change',
        {
          clinic_id: clinicId,
          service_id: fakeServiceId,
          change_type: 'percentage',
          change_value: 10,
        },
        'viewer cannot run Lara price simulations'
      )
      expectForbiddenPost(
        '/api/actions/adjust-service-margin',
        {
          clinic_id: clinicId,
          service_id: fakeServiceId,
          target_margin_pct: 40,
          dry_run: true,
        },
        'viewer cannot run Lara service margin adjustments'
      )
      expectForbiddenPost(
        '/api/actions/bulk-update-prices',
        {
          clinic_id: clinicId,
          change_type: 'percentage',
          change_value: 10,
          dry_run: true,
        },
        'viewer cannot run Lara bulk price updates'
      )
      expectForbiddenPost(
        '/api/actions/update-service-price',
        {
          clinic_id: clinicId,
          service_id: fakeServiceId,
          new_price_cents: 100000,
          dry_run: true,
        },
        'viewer cannot run Lara service price updates'
      )
      expectForbiddenPost(
        '/api/actions/create-expense',
        {
          clinic_id: clinicId,
          category_id: fakeCategoryId,
          amount_cents: 10000,
          description: `QA forbidden ${stamp}`,
          expense_date: '2026-05-27',
          dry_run: true,
        },
        'viewer cannot run Lara expense creation'
      )
      expectForbiddenPost(
        '/api/actions/update-time-settings',
        {
          clinic_id: clinicId,
          work_days: 20,
          dry_run: true,
        },
        'viewer cannot run Lara time settings updates'
      )
    })
  })

  it('blocks viewer clinical catalogs, prescriptions, pricing, and treatment adjunct endpoints at the API', () => {
    const fakeId = '00000000-0000-4000-8000-000000000004'

    cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
    selectClinicA().then((clinicId) => {
      expectForbiddenGet(
        '/api/categories?type=expenses',
        'viewer cannot read expense categories'
      )
      expectForbiddenRequest(
        'POST',
        '/api/categories?type=services',
        'viewer cannot create service categories',
        { name: `QA Category ${stamp}` }
      )
      expectForbiddenRequest(
        'PUT',
        `/api/categories/${fakeId}?type=services`,
        'viewer cannot edit service categories',
        { name: `QA Category ${stamp}` }
      )
      expectForbiddenRequest(
        'DELETE',
        `/api/categories/${fakeId}?type=services`,
        'viewer cannot delete service categories'
      )

      expectForbiddenRequest(
        'POST',
        '/api/patient-sources',
        'viewer cannot create patient sources',
        {
          clinic_id: clinicId,
          name: `QA Source ${stamp}`,
        }
      )

      cy.request('/api/medications').then((response) => {
        expect(response.status, 'viewer can read medication catalog').to.eq(200)
      })
      expectForbiddenRequest(
        'POST',
        '/api/medications',
        'viewer cannot create medications',
        {
          clinic_id: clinicId,
          name: `QA Medication ${stamp}`,
        }
      )

      cy.request('/api/prescriptions').then((response) => {
        expect(response.status, 'viewer can read prescriptions').to.eq(200)
      })
      expectForbiddenRequest(
        'POST',
        '/api/prescriptions',
        'viewer cannot create prescriptions',
        {
          clinic_id: clinicId,
          patient_id: fakeId,
          prescription_date: '2026-05-28',
          prescriber_name: 'QA Doctor',
          items: [
            {
              medication_name: 'QA Medication',
              dosage: '1 tableta',
              frequency: 'Cada 8 horas',
            },
          ],
        }
      )
      expectForbiddenRequest(
        'PUT',
        `/api/prescriptions/${fakeId}`,
        'viewer cannot edit prescriptions',
        {
          clinic_id: clinicId,
          status: 'active',
        }
      )
      expectForbiddenRequest(
        'DELETE',
        `/api/prescriptions/${fakeId}?clinicId=${clinicId}`,
        'viewer cannot cancel prescriptions'
      )
      expectForbiddenGet(
        `/api/prescriptions/${fakeId}/pdf?clinicId=${clinicId}`,
        'viewer cannot print prescription PDFs'
      )

      expectForbiddenGet('/api/tariffs', 'viewer cannot read tariff costs')
      expectForbiddenRequest(
        'POST',
        '/api/tariffs',
        'viewer cannot set tariffs',
        {
          tariffs: [
            {
              clinic_id: clinicId,
              service_id: fakeId,
              margin_percentage: 30,
              final_price_cents: 100000,
            },
          ],
        }
      )
      expectForbiddenGet(
        `/api/services/${fakeId}/cost`,
        'viewer cannot read service cost breakdowns'
      )
      expectForbiddenRequest(
        'POST',
        `/api/services/${fakeId}/supplies`,
        'viewer cannot edit service recipes',
        {
          supply_id: fakeId,
          qty: 1,
        }
      )
      expectForbiddenRequest(
        'DELETE',
        `/api/services/${fakeId}/supplies`,
        'viewer cannot remove supplies from service recipes',
        {
          supply_id: fakeId,
        }
      )
      expectForbiddenRequest(
        'PUT',
        `/api/services/${fakeId}/supplies/${fakeId}`,
        'viewer cannot edit service recipe lines',
        {
          qty: 1,
        }
      )
      expectForbiddenRequest(
        'DELETE',
        `/api/services/${fakeId}/supplies/${fakeId}`,
        'viewer cannot delete service recipe lines'
      )

      expectForbiddenGet(
        '/api/time/cost-per-minute',
        'viewer cannot read cost per minute'
      )
      expectForbiddenRequest(
        'POST',
        '/api/treatments/check-conflicts',
        'viewer cannot check treatment scheduling conflicts for new appointments',
        {
          clinic_id: clinicId,
          date: '2026-05-28',
          time: '10:00',
          duration_minutes: 30,
        }
      )
      expectForbiddenRequest(
        'PATCH',
        `/api/treatments/${fakeId}/refund`,
        'viewer cannot refund treatments',
        {
          clinic_id: clinicId,
          refund_reason: `QA forbidden ${stamp}`,
        }
      )
      expectForbiddenRequest(
        'POST',
        '/api/notifications/send-confirmation',
        'viewer cannot send treatment confirmation notifications',
        {
          treatmentId: fakeId,
        }
      )
    })
  })

  it('blocks viewer administrative settings, team, snapshots, and reset endpoints at the API', () => {
    const fakeId = '00000000-0000-4000-8000-000000000003'

    cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
    selectClinicA().then((clinicId) => {
      expectForbiddenGet('/api/team/workspace-members', 'viewer cannot list workspace members')
      expectForbiddenRequest(
        'POST',
        '/api/team/workspace-members',
        'viewer cannot invite workspace members',
        {
          email: `${stamp}-invite@laralis.test`,
          role: 'viewer',
        }
      )
      expectForbiddenRequest(
        'PUT',
        `/api/team/workspace-members/${fakeId}`,
        'viewer cannot edit workspace members',
        { role: 'viewer' }
      )
      expectForbiddenRequest(
        'DELETE',
        `/api/team/workspace-members/${fakeId}`,
        'viewer cannot remove workspace members'
      )

      expectForbiddenGet('/api/team/clinic-members', 'viewer cannot list clinic members')
      expectForbiddenRequest(
        'POST',
        '/api/team/clinic-members',
        'viewer cannot add clinic members',
        {
          user_id: fakeId,
          role: 'viewer',
        }
      )
      expectForbiddenRequest(
        'PUT',
        `/api/team/clinic-members/${fakeId}`,
        'viewer cannot edit clinic members',
        { role: 'viewer' }
      )
      expectForbiddenRequest(
        'DELETE',
        `/api/team/clinic-members/${fakeId}`,
        'viewer cannot remove clinic members'
      )

      expectForbiddenGet('/api/invitations?status=pending', 'viewer cannot list invitations')
      expectForbiddenRequest(
        'POST',
        '/api/invitations',
        'viewer cannot invite users',
        {
          email: `${stamp}-invite@laralis.test`,
          role: 'viewer',
          scope: 'clinic',
          clinic_ids: [clinicId],
        }
      )
      expectForbiddenRequest(
        'DELETE',
        `/api/invitations?id=${fakeId}`,
        'viewer cannot cancel invitations'
      )
      expectForbiddenRequest(
        'POST',
        `/api/invitations/${fakeId}/resend`,
        'viewer cannot resend invitations'
      )

      expectForbiddenGet('/api/settings/booking', 'viewer cannot read booking settings')
      expectForbiddenRequest(
        'PUT',
        '/api/settings/booking',
        'viewer cannot edit booking settings',
        {
          slug: `qa-${stamp}`,
          booking_config: { enabled: false },
          service_ids: [],
        }
      )
      expectForbiddenGet('/api/settings/notifications', 'viewer cannot read notification settings')
      expectForbiddenRequest(
        'PUT',
        '/api/settings/notifications',
        'viewer cannot edit notification settings',
        {
          email_enabled: true,
          confirmation_enabled: true,
          reminder_enabled: true,
          reminder_hours_before: 24,
          sender_name: null,
          reply_to_email: null,
        }
      )
      expectForbiddenRequest(
        'POST',
        '/api/settings/notifications/test',
        'viewer cannot send notification test emails'
      )
      expectForbiddenGet('/api/settings/time', 'viewer cannot read time settings')
      expectForbiddenRequest(
        'POST',
        '/api/settings/time',
        'viewer cannot edit time settings',
        {
          clinic_id: clinicId,
          work_days: 20,
          hours_per_day: 8,
          real_pct: 80,
        }
      )

      expectForbiddenGet('/api/snapshots', 'viewer cannot list snapshots')
      expectForbiddenGet('/api/snapshots/discover', 'viewer cannot discover snapshot tables')
      expectForbiddenRequest(
        'POST',
        '/api/snapshots',
        'viewer cannot create snapshots',
        { type: 'manual' }
      )
      expectForbiddenGet(
        `/api/snapshots/${fakeId}?metadata=true&clinicId=${clinicId}`,
        'viewer cannot download snapshot metadata'
      )
      expectForbiddenRequest(
        'DELETE',
        `/api/snapshots/${fakeId}`,
        'viewer cannot delete snapshots'
      )
      expectForbiddenRequest(
        'POST',
        `/api/snapshots/${fakeId}/restore`,
        'viewer cannot restore snapshots',
        { dryRun: true }
      )

      expectForbiddenGet(`/api/reset?clinicId=${clinicId}`, 'viewer cannot read reset status')
      expectForbiddenRequest(
        'POST',
        '/api/reset',
        'viewer cannot reset clinic data',
        { resetType: 'patients' }
      )
    })
  })

  it('blocks viewer workspace and clinic administration while preserving context reads', () => {
    cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })

    cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
      const clinicAName = dataset.clinics.find((clinic: any) => clinic.key === 'clinicA')?.name

      cy.request('/api/clinics').then((clinicsResponse) => {
        expect(clinicsResponse.status, 'viewer can resolve accessible clinics').to.eq(200)
        const clinicA = (clinicsResponse.body.data || []).find((clinic: any) => clinic.name === clinicAName)
        expect(clinicA, 'viewer has clinic A context').to.exist

        cy.request('POST', '/api/clinics', { clinicId: clinicA.id }).then((selectResponse) => {
          expect(selectResponse.status, 'viewer can select an accessible clinic').to.eq(200)
        })

        cy.request('/api/workspaces?list=true').then((workspacesResponse) => {
          expect(workspacesResponse.status, 'viewer can list accessible workspaces for context').to.eq(200)
          const workspaces = rowsFromBody(workspacesResponse.body)
          expect(
            workspaces.some((workspace: any) => workspace.id === clinicA.workspace_id),
            'workspace list includes clinic A workspace'
          ).to.eq(true)
        })

        cy.request(`/api/workspaces/${clinicA.workspace_id}/clinics`).then((workspaceClinicsResponse) => {
          expect(workspaceClinicsResponse.status, 'viewer can list clinics for an accessible workspace').to.eq(200)
          const workspaceClinics = rowsFromBody(workspaceClinicsResponse.body)
          expect(
            workspaceClinics.some((clinic: any) => clinic.id === clinicA.id),
            'workspace clinics include clinic A'
          ).to.eq(true)
        })

        expectForbiddenRequest(
          'POST',
          '/api/workspaces',
          'viewer cannot create additional workspaces',
          {
            workspaceName: `QA Viewer Workspace ${stamp}`,
            workspaceSlug: `qa-viewer-${stamp}`,
          }
        )
        expectForbiddenRequest(
          'PUT',
          `/api/workspaces/${clinicA.workspace_id}`,
          'viewer cannot edit workspace settings',
          { name: `QA Viewer Workspace ${stamp}` }
        )
        expectForbiddenRequest(
          'DELETE',
          `/api/workspaces/${clinicA.workspace_id}`,
          'viewer cannot delete workspaces'
        )
        expectForbiddenRequest(
          'POST',
          `/api/workspaces/${clinicA.workspace_id}/clinics`,
          'viewer cannot create clinics in a workspace',
          {
            name: `QA Viewer Clinic ${stamp}`,
            currency: 'MXN',
            locale: 'es-MX',
          }
        )
        expectForbiddenRequest(
          'POST',
          `/api/workspaces/${clinicA.workspace_id}/lifecycle`,
          'viewer cannot run workspace lifecycle actions',
          { action: 'archive' }
        )
        expectForbiddenRequest(
          'PUT',
          `/api/clinics/${clinicA.id}`,
          'viewer cannot edit clinic settings',
          { name: clinicA.name }
        )
        expectForbiddenRequest(
          'DELETE',
          `/api/clinics/${clinicA.id}`,
          'viewer cannot delete clinics'
        )
        expectForbiddenRequest(
          'PUT',
          '/api/clinics/discount',
          'viewer cannot edit global clinic discount',
          {
            enabled: false,
            type: 'percentage',
            value: 0,
          }
        )
        expectForbiddenPost(
          '/api/export/generate',
          {
            workspaceId: clinicA.workspace_id,
          },
          'viewer cannot generate workspace export bundles'
        )
        expectForbiddenPost(
          '/api/export/import',
          {
            bundle: {
              metadata: {
                workspaceId: clinicA.workspace_id,
                workspaceName: 'QA forbidden import',
              },
              data: {},
            },
            options: {
              dryRun: true,
            },
          },
          'viewer cannot import workspace bundles'
        )
      })
    })
  })
})
