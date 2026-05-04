type QaDataset = {
  workspace: {
    name: string
  }
  clinics: Array<{
    key: string
    name: string
  }>
}

type QaOracles = {
  patients: {
    total: number
  }
  treatments: {
    total: number
  }
  marketing: {
    metaMayo: {
      patients: number
    }
  }
}

describe('Stage multi-clinic isolation', () => {
  const stamp = `qa-clinic-${Date.now()}-${Cypress._.random(1000, 9999)}`
  const createdClinicName = `QA Clinic ${stamp}`
  const createdPatientEmail = `${stamp}@laralis.test`
  let createdClinicId: string | undefined
  let createdPatientId: string | undefined

  function selectClinic(clinicId: string) {
    return cy.request('POST', '/api/clinics', { clinicId }).then((selectResponse) => {
      expect(selectResponse.status, `select clinic ${clinicId}`).to.eq(200)
    })
  }

  function clinicAFromDataset(dataset: QaDataset) {
    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinicAName = dataset.clinics.find((clinic) => clinic.key === 'clinicA')?.name
      const clinicA = (clinicsResponse.body.data || []).find((clinic: any) => clinic.name === clinicAName)
      expect(clinicA, 'seeded clinic A').to.exist
      return clinicA
    })
  }

  beforeEach(() => {
    cy.loginAsDoctor()
  })

  afterEach(() => {
    if (!createdClinicId && !createdPatientId) return

    cy.loginAsDoctor()

    if (createdClinicId) {
      selectClinic(createdClinicId)
    }

    if (createdPatientId) {
      cy.request({
        method: 'DELETE',
        url: `/api/patients/${createdPatientId}`,
        failOnStatusCode: false,
      }).then((response) => {
        expect([200, 204, 404], 'cleanup created clinic patient').to.include(response.status)
      })
      createdPatientId = undefined
    }

    if (createdClinicId) {
      cy.request({
        method: 'DELETE',
        url: `/api/clinics/${createdClinicId}`,
        failOnStatusCode: false,
      }).then((response) => {
        expect([200, 404], 'cleanup created clinic').to.include(response.status)
      })
      createdClinicId = undefined
    }
  })

  it('creates a second clinic in the active workspace and keeps its data isolated', () => {
    cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
      cy.request('/api/workspaces?list=true').then((workspacesResponse) => {
        expect(workspacesResponse.status).to.eq(200)
        const workspace = (workspacesResponse.body || []).find((row: any) => row.name === dataset.workspace.name)
        expect(workspace?.id, 'QA workspace id').to.be.a('string')

        cy.request('POST', `/api/workspaces/${workspace.id}/clinics`, {
          name: createdClinicName,
          address: '456 QA Isolation Street',
          phone: '+15555550177',
          email: createdPatientEmail,
        }).then((createResponse) => {
          expect(createResponse.status).to.eq(200)
          expect(createResponse.body.data.name).to.eq(createdClinicName)
          createdClinicId = createResponse.body.data.id
        })

        cy.then(() => {
          expect(createdClinicId, 'created clinic id').to.be.a('string')

          cy.request(`/api/workspaces/${workspace.id}/clinics`).then((clinicsResponse) => {
            expect(clinicsResponse.status).to.eq(200)
            const createdClinic = (clinicsResponse.body.data || []).find((clinic: any) => clinic.id === createdClinicId)
            expect(createdClinic?.name, 'created clinic appears in workspace list').to.eq(createdClinicName)
          })

          selectClinic(createdClinicId!)

          cy.request('/api/patients').then((patientsBeforeResponse) => {
            expect(patientsBeforeResponse.status).to.eq(200)
            expect(patientsBeforeResponse.body.data || [], 'new clinic starts without seeded patients').to.have.length(0)
          })

          cy.request('POST', '/api/patients', {
            first_name: 'QA Clinic',
            last_name: stamp,
            email: createdPatientEmail,
            phone: '+15555550177',
            first_visit_date: '2026-05-27',
            acquisition_date: '2026-05-27',
            gender: 'other',
          }).then((patientResponse) => {
            expect([200, 201], 'created patient in new clinic').to.include(patientResponse.status)
            createdPatientId = patientResponse.body.data.id
          })

          cy.request('/api/patients').then((patientsAfterResponse) => {
            expect(patientsAfterResponse.status).to.eq(200)
            const patients = patientsAfterResponse.body.data || []
            expect(patients.map((patient: any) => patient.email), 'new clinic patient list')
              .to.include(createdPatientEmail)
          })

          clinicAFromDataset(dataset).then((clinicA: any) => {
            selectClinic(clinicA.id)

            cy.request('/api/patients').then((clinicAResponse) => {
              expect(clinicAResponse.status).to.eq(200)
              const emails = (clinicAResponse.body.data || []).map((patient: any) => patient.email)
              expect(emails, 'created clinic patient is isolated from clinic A').not.to.include(createdPatientEmail)
            })

            cy.request(`/api/patients?clinicId=${createdClinicId}`).then((explicitNewClinicResponse) => {
              expect(explicitNewClinicResponse.status).to.eq(200)
              const emails = (explicitNewClinicResponse.body.data || []).map((patient: any) => patient.email)
              expect(emails, 'explicit new clinic query still works while clinic A is active')
                .to.include(createdPatientEmail)
            })
          })
        })
      })
    })
  })

  it('keeps seeded clinic data isolated when switching active clinic context', () => {
    cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
      cy.readFile('../../docs/qa/oracles.json').then((oracles: QaOracles) => {
        const clinicAName = dataset.clinics.find((clinic) => clinic.key === 'clinicA')?.name
        const clinicBName = dataset.clinics.find((clinic) => clinic.key === 'clinicB')?.name

        expect(clinicAName, 'clinic A name in dataset').to.be.a('string')
        expect(clinicBName, 'clinic B name in dataset').to.be.a('string')

        cy.request('/api/clinics').then((clinicsResponse) => {
          expect(clinicsResponse.status).to.eq(200)

          const clinics = clinicsResponse.body.data || []
          const clinicA = clinics.find((clinic: any) => clinic.name === clinicAName)
          const clinicB = clinics.find((clinic: any) => clinic.name === clinicBName)

          expect(clinicA, 'seeded clinic A').to.exist
          expect(clinicB, 'seeded clinic B').to.exist
          expect(clinicA.id, 'clinic A id').not.to.eq(clinicB.id)

          cy.request('POST', '/api/clinics', { clinicId: clinicA.id }).then((selectAResponse) => {
            expect(selectAResponse.status).to.eq(200)
          })

          cy.request('/api/patients').then((patientsResponse) => {
            expect(patientsResponse.status).to.eq(200)
            expect(patientsResponse.body.data || [], 'clinic A patients').to.have.length(oracles.patients.total)
          })

          cy.request('/api/treatments').then((treatmentsResponse) => {
            expect(treatmentsResponse.status).to.eq(200)
            expect(treatmentsResponse.body.data || [], 'clinic A treatments').to.have.length(oracles.treatments.total)
          })

          cy.request('/api/services').then((servicesResponse) => {
            expect(servicesResponse.status).to.eq(200)
            expect(servicesResponse.body || [], 'clinic A services').to.have.length.greaterThan(0)
          })

          cy.request('/api/marketing/campaigns/roi?startDate=2026-05-01&endDate=2026-05-31')
            .then((marketingResponse) => {
              expect(marketingResponse.status).to.eq(200)
              const meta = (marketingResponse.body.data || []).find((campaign: any) => campaign.name === 'Meta Mayo')
              expect(meta, 'clinic A Meta Mayo').to.exist
              expect(meta.patientsCount).to.eq(oracles.marketing.metaMayo.patients)
            })

          cy.request('POST', '/api/clinics', { clinicId: clinicB.id }).then((selectBResponse) => {
            expect(selectBResponse.status).to.eq(200)
          })

          cy.request('/api/patients').then((patientsResponse) => {
            expect(patientsResponse.status).to.eq(200)
            expect(patientsResponse.body.data || [], 'clinic B patients').to.have.length(0)
          })

          cy.request('/api/treatments').then((treatmentsResponse) => {
            expect(treatmentsResponse.status).to.eq(200)
            expect(treatmentsResponse.body.data || [], 'clinic B treatments').to.have.length(0)
          })

          cy.request('/api/services').then((servicesResponse) => {
            expect(servicesResponse.status).to.eq(200)
            expect(servicesResponse.body || [], 'clinic B services').to.have.length(0)
          })

          cy.request('/api/marketing/campaigns/roi?startDate=2026-05-01&endDate=2026-05-31')
            .then((marketingResponse) => {
              expect(marketingResponse.status).to.eq(200)
              expect(marketingResponse.body.data || [], 'clinic B campaigns').to.have.length(0)
            })

          cy.request(`/api/patients?clinicId=${clinicA.id}`).then((explicitAResponse) => {
            expect(explicitAResponse.status).to.eq(200)
            expect(explicitAResponse.body.data || [], 'explicit clinic A query while clinic B is active')
              .to.have.length(oracles.patients.total)
          })

          cy.request('POST', '/api/clinics', { clinicId: clinicA.id }).then((restoreAResponse) => {
            expect(restoreAResponse.status).to.eq(200)
          })
        })
      })
    })
  })
})
