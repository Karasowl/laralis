/**
 * Phase F — convex-only WRITE cutover across multiple domains.
 * Run with DATA_WRITE_MODE=convex (global) + AUTH_BACKEND=convex so every create
 * goes through the Convex-only write path (createXInConvex). Each test creates a
 * record and deletes it (footprint zero).
 */
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

function createAndDelete(name: string, path: string, body: Record<string, unknown>) {
  cy.request({ method: 'POST', url: path, failOnStatusCode: false, body }).then((res) => {
    expect(res.status, `${name} create status (body: ${JSON.stringify(res.body).slice(0, 200)})`).to.be.oneOf([200, 201])
    const id = (res.body?.data?.id || res.body?.id) as string
    expect(id, `${name} created id`).to.be.a('string')
    cy.request({ method: 'DELETE', url: `${path}/${id}`, failOnStatusCode: false }).then((del) => {
      expect(del.status, `${name} delete status`).to.be.oneOf([200, 204])
    })
  })
}

describe('Convex-only write cutover — multiple domains', () => {
  beforeEach(() => login())

  // Note: patient_sources create also works via Convex, but it has no DELETE endpoint
  // (GET/POST only) so it can't self-clean — validated separately, omitted here.

  it('fixed_costs: create + delete via Convex', () => {
    createAndDelete('fixed_costs', '/api/fixed-costs', {
      category: 'rent',
      concept: `E2E-${Date.now()}`,
      amount_cents: 12345,
    })
  })

  it('supplies: create + delete via Convex', () => {
    createAndDelete('supplies', '/api/supplies', {
      name: `E2E-${Date.now()}`,
      category: 'consumable',
      presentation: 'box',
      price_cents: 5000,
      portions: 10,
    })
  })

  it('assets: create + delete via Convex', () => {
    createAndDelete('assets', '/api/assets', {
      name: `E2E-${Date.now()}`,
      category: 'equipment',
      purchase_price_cents: 100000,
      depreciation_months: 36,
    })
  })
})
