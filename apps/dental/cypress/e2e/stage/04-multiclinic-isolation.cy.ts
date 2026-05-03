type QaDataset = {
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
  beforeEach(() => {
    cy.loginAsDoctor()
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
