/**
 * Convex Auth smoke test (run against the LOCAL app with AUTH_BACKEND=convex).
 *
 * Validates the Convex Auth surface in a real browser WITHOUT needing an OTP email
 * or a pre-existing password account:
 *  - convexAuthNextjsMiddleware redirects protected routes to /auth/login
 *  - the login/register pages render (ConvexAuth providers mounted, no crash)
 *  - invalid credentials exercise convexAuthActions.signIn and stay on /auth/login
 *  - protected API returns 401 without a session
 *
 * Run: CYPRESS_baseUrl=http://localhost:3000 npx cypress run --spec cypress/e2e/convex-auth-smoke.cy.ts
 */
describe('Convex Auth (local) — middleware + auth surface', () => {
  it('redirects a protected route to /auth/login when unauthenticated', () => {
    cy.visit('/patients', { failOnStatusCode: false })
    cy.location('pathname', { timeout: 30000 }).should('include', '/auth/login')
  })

  it('redirects the home route to /auth/login when unauthenticated', () => {
    cy.visit('/', { failOnStatusCode: false })
    cy.location('pathname', { timeout: 30000 }).should('include', '/auth/login')
  })

  it('renders the login form (Convex Auth providers mounted)', () => {
    cy.visit('/auth/login')
    cy.get('input[type="email"]', { timeout: 30000 }).should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })

  it('renders the register form', () => {
    cy.visit('/auth/register')
    cy.get('input[type="email"]', { timeout: 30000 }).should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })

  it('rejects invalid credentials and stays on /auth/login', () => {
    cy.visit('/auth/login')
    cy.get('input[type="email"]').clear().type(`nobody-${Date.now()}@example.com`)
    cy.get('input[type="password"]').clear().type('definitely-wrong-password', { log: false })
    cy.get('button[type="submit"]').click()
    // convexAuthActions.signIn rejects -> we must NOT be navigated into the app.
    cy.wait(4000)
    cy.location('pathname').should('include', '/auth/login')
  })

  it('logs in a seeded user (password account) and leaves /auth/login', () => {
    // vk@yopmail.com has a Convex Auth password account created by the test helper
    // (linked to the seeded user, legacyId preserved). A successful signIn establishes
    // a session and navigates away from /auth/login.
    cy.visit('/auth/login')
    cy.get('input[type="email"]', { timeout: 30000 }).should('be.visible').clear().type('vk@yopmail.com')
    cy.get('input[type="password"]').clear().type('TestConvex123!', { log: false })
    cy.get('button[type="submit"]').click()
    cy.location('pathname', { timeout: 30000 }).should('not.include', '/auth/login')
  })

  it('protected API returns 401 without a session', () => {
    cy.clearCookies()
    cy.request({
      method: 'POST',
      url: '/api/actions/analyze-patient-retention',
      body: {},
      failOnStatusCode: false,
    })
      .its('status')
      .should('eq', 401)
  })
})
