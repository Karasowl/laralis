/**
 * PROD verification — convex-only WRITE for secondary feature modules, LIVE site.
 * Footprint-zero (create+delete) where a delete endpoint exists.
 *   Creds via CYPRESS_PROD_EMAIL / CYPRESS_PROD_PASS, baseUrl via CYPRESS_baseUrl.
 *   No secrets in this file. Full how-to + coordinates in:
 *     docs/IMPORTANT/PROD-CONVEX-VERIFICATION-RUNBOOK.md
 */
export {}
const EMAIL = (Cypress.env('PROD_EMAIL') as string) || ''
const PASS = (Cypress.env('PROD_PASS') as string) || ''

function login() {
  cy.session([EMAIL, 'prod'], () => {
    cy.visit('/auth/login')
    cy.get('input[type="email"]', { timeout: 30000 }).should('be.visible').clear().type(EMAIL)
    cy.get('input[type="password"]').clear().type(PASS, { log: false })
    cy.get('button[type="submit"]').click()
    cy.location('pathname', { timeout: 40000 }).should('not.include', '/auth/login')
  })
}
function createdId(body: any): string | undefined {
  return body?.data?.id || body?.id || body?.data?.data?.id || body?.campaign?.id || body?.platform?.id || body?.prescription?.id || body?.patient?.id
}

describe('PROD convex-only write — secondary feature modules', () => {
  beforeEach(() => {
    expect(EMAIL, 'CYPRESS_PROD_EMAIL set').to.not.equal('')
    login()
  })

  it('marketing/platforms: create + delete', () => {
    cy.request({ method: 'POST', url: '/api/marketing/platforms', failOnStatusCode: false, body: { display_name: `E2E-${Date.now()}` } }).then((res) => {
      expect(res.status, `platform create (${JSON.stringify(res.body).slice(0, 200)})`).to.be.oneOf([200, 201])
      const id = createdId(res.body)
      expect(id, 'platform id').to.be.a('string')
      cy.request({ method: 'DELETE', url: `/api/marketing/platforms/${id}`, failOnStatusCode: false }).then((del) => {
        expect(del.status, 'platform delete').to.be.oneOf([200, 204])
      })
    })
  })

  it('medications: create (POST-only)', () => {
    cy.request({ method: 'POST', url: '/api/medications', failOnStatusCode: false, body: { name: `E2E-${Date.now()}` } }).then((res) => {
      expect(res.status, `medication create (${JSON.stringify(res.body).slice(0, 200)})`).to.be.oneOf([200, 201])
      expect(createdId(res.body), 'medication id').to.be.a('string')
    })
  })

  it('marketing/campaigns: create + delete (FK: platform)', () => {
    cy.request({ method: 'POST', url: '/api/marketing/platforms', failOnStatusCode: false, body: { display_name: `E2E-plat-${Date.now()}` } }).then((pr) => {
      const platformId = createdId(pr.body)
      expect(platformId, 'platform id for campaign').to.be.a('string')
      cy.request({ method: 'POST', url: '/api/marketing/campaigns', failOnStatusCode: false, body: { platform_id: platformId, name: `E2E-camp-${Date.now()}` } }).then((res) => {
        expect(res.status, `campaign create (${JSON.stringify(res.body).slice(0, 200)})`).to.be.oneOf([200, 201])
        const campaignId = createdId(res.body)
        expect(campaignId, 'campaign id').to.be.a('string')
        cy.request({ method: 'DELETE', url: `/api/marketing/campaigns/${campaignId}`, failOnStatusCode: false }).then((del) => {
          expect(del.status, 'campaign delete').to.be.oneOf([200, 204])
          cy.request({ method: 'DELETE', url: `/api/marketing/platforms/${platformId}`, failOnStatusCode: false })
        })
      })
    })
  })

  it('prescriptions: create + delete (FK: create own patient)', () => {
    cy.request({ method: 'POST', url: '/api/patients', failOnStatusCode: false, body: { first_name: `E2E-Rx-${Date.now()}`, last_name: 'RxFK' } }).then((pr) => {
      const patientId = createdId(pr.body)
      expect(patientId, 'patient id for prescription').to.be.a('string')
      cy.request({
        method: 'POST', url: '/api/prescriptions', failOnStatusCode: false,
        body: {
          patient_id: patientId, prescriber_name: 'Dr. E2E', prescription_date: '2026-01-15',
          items: [{ medication_name: 'Ibuprofeno', dosage: '1 tableta', frequency: 'cada 8h' }],
        },
      }).then((res) => {
        expect(res.status, `prescription create (${JSON.stringify(res.body).slice(0, 250)})`).to.be.oneOf([200, 201])
        const id = createdId(res.body)
        expect(id, 'prescription id').to.be.a('string')
        cy.request({ method: 'DELETE', url: `/api/prescriptions/${id}`, failOnStatusCode: false }).then((del) => {
          expect(del.status, 'prescription delete').to.be.oneOf([200, 204])
        })
        cy.request({ method: 'DELETE', url: `/api/patients/${patientId}`, failOnStatusCode: false })
      })
    })
  })
})
