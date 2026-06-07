/**
 * Convex-only comprehensive READ smoke. Logs in (Convex Auth) and hits every
 * authenticated GET endpoint, asserting none return a 5xx (a 5xx == a route that
 * still assumes Supabase / crashes in convex mode). Dumps all statuses to
 * tmp/convex-api-smoke.json for triage.
 */
const EMAIL = 'conladoctoralara@gmail.com'
const PASS = 'TestConvex123!'

const ENDPOINTS = [
  '/api/actions/history',
  '/api/ai/chat/history', '/api/ai/feedback', '/api/ai/sessions',
  '/api/analytics/acquisition-trends', '/api/analytics/cac-trend', '/api/analytics/channel-roi',
  '/api/analytics/compare', '/api/analytics/inventory/alerts', '/api/analytics/marketing-metrics',
  '/api/analytics/patients/stats', '/api/analytics/predictions', '/api/analytics/refunds',
  '/api/analytics/services/top', '/api/analytics/treatments/frequency',
  '/api/auth/me',
  '/api/bookings', '/api/categories', '/api/clinics', '/api/clinics/discount',
  '/api/dashboard/activities', '/api/dashboard/appointments', '/api/dashboard/charts/categories',
  '/api/dashboard/charts/revenue', '/api/dashboard/charts/services', '/api/dashboard/expenses',
  '/api/dashboard/patients', '/api/dashboard/revenue', '/api/dashboard/supplies',
  '/api/dashboard/treatments',
  '/api/invitations', '/api/marketing/campaigns', '/api/marketing/campaigns/roi',
  '/api/marketing/platforms', '/api/medications', '/api/patient-sources', '/api/patients',
  '/api/permissions/my', '/api/prescriptions', '/api/public/availability',
  '/api/services', '/api/settings/booking', '/api/settings/notifications',
  '/api/settings/notifications/whatsapp-readiness', '/api/settings/preferences',
  '/api/settings/security/mfa', '/api/settings/time', '/api/settings/user', '/api/setup/status',
  '/api/snapshots', '/api/snapshots/discover', '/api/supplies', '/api/tariffs',
  '/api/team/clinic-members', '/api/team/workspace-members', '/api/time/cost-per-minute',
  '/api/treatments', '/api/workspaces',
]

function login() {
  cy.session([EMAIL], () => {
    cy.visit('/auth/login')
    cy.get('input[type="email"]', { timeout: 30000 }).should('be.visible').clear().type(EMAIL)
    cy.get('input[type="password"]').clear().type(PASS, { log: false })
    cy.get('button[type="submit"]').click()
    cy.location('pathname', { timeout: 30000 }).should('not.include', '/auth/login')
  })
}

describe('Convex-only — all GET APIs respond without a 5xx', () => {
  it('hits every authenticated GET endpoint', () => {
    login()
    const results: Record<string, number> = {}
    cy.wrap(ENDPOINTS).each((url) => {
      return cy.request({ method: 'GET', url: url as string, failOnStatusCode: false }).then((res) => {
        results[url as string] = res.status
      })
    }).then(() => {
      cy.writeFile('tmp/convex-api-smoke.json', JSON.stringify(results, null, 2))
      const crashes = Object.entries(results).filter(([, s]) => s >= 500)
      // eslint-disable-next-line no-console
      cy.log(`5xx endpoints: ${JSON.stringify(crashes)}`)
      expect(crashes, `endpoints returning 5xx: ${JSON.stringify(crashes)}`).to.have.length(0)
    })
  })
})
