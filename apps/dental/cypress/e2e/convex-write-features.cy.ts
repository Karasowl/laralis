/**
 * Phase F — convex-only WRITE lifecycle for secondary feature modules.
 * Run with AUTH_BACKEND=convex + DATA_READ_BACKEND=convex + DATA_WRITE_MODE=convex.
 * Footprint-zero (create+delete) where a delete endpoint exists.
 */
export {} // isolate module scope (cypress specs share global scope under tsc)
const EMAIL = 'conladoctoralara@gmail.com'
const PASS = 'TestConvex123!'

function login() {
  cy.session([EMAIL], () => {
    cy.visit('/auth/login')
    cy.get('input[type="email"]', { timeout: 30000 }).should('be.visible').clear().type(EMAIL)
    cy.get('input[type="password"]').clear().type(PASS, { log: false })
    cy.get('button[type="submit"]').click()
    cy.location('pathname', { timeout: 30000 }).should('not.include', '/auth/login')
  })
}

function createdId(body: any): string | undefined {
  return body?.data?.id || body?.id || body?.data?.data?.id || body?.campaign?.id || body?.platform?.id || body?.prescription?.id
}
function firstId(body: any): string | undefined {
  const arr = Array.isArray(body) ? body : body?.data || body?.patients || body?.items || []
  return Array.isArray(arr) && arr.length ? arr[0]?.id : undefined
}

describe('Convex-only write — secondary feature modules', () => {
  beforeEach(() => login())

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

  it('prescriptions: create + delete (FK: patient)', () => {
    cy.request({ method: 'GET', url: '/api/patients', failOnStatusCode: false }).then((pr) => {
      const patientId = firstId(pr.body)
      expect(patientId, 'an existing patient id').to.be.a('string')
      cy.request({
        method: 'POST',
        url: '/api/prescriptions',
        failOnStatusCode: false,
        body: {
          patient_id: patientId,
          prescriber_name: 'Dr. E2E',
          prescription_date: '2026-01-15',
          items: [{ medication_name: 'Ibuprofeno', dosage: '1 tableta', frequency: 'cada 8h' }],
        },
      }).then((res) => {
        expect(res.status, `prescription create (${JSON.stringify(res.body).slice(0, 250)})`).to.be.oneOf([200, 201])
        const id = createdId(res.body)
        expect(id, 'prescription id').to.be.a('string')
        cy.request({ method: 'DELETE', url: `/api/prescriptions/${id}`, failOnStatusCode: false }).then((del) => {
          expect(del.status, 'prescription delete').to.be.oneOf([200, 204])
        })
      })
    })
  })
})
