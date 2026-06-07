/**
 * Phase F — convex-only WRITE cutover validation.
 *
 * Run with DATA_WRITE_MODE_PATIENTS=convex (+ AUTH_BACKEND=convex) so the patient
 * write goes through the Convex-only path (createPatientInConvex) — no Supabase.
 * Proves a write-domain cutover works end to end, then cleans up (create -> delete).
 *
 *   CYPRESS_baseUrl=http://localhost:3000 npx cypress run --spec cypress/e2e/convex-write-cutover.cy.ts
 */
describe('Convex-only write cutover (patients)', () => {
  it('creates a patient via the Convex-only write path, then deletes it', () => {
    cy.visit('/auth/login')
    cy.get('input[type="email"]', { timeout: 30000 }).should('be.visible').clear().type('conladoctoralara@gmail.com')
    cy.get('input[type="password"]').clear().type('TestConvex123!', { log: false })
    cy.get('button[type="submit"]').click()
    cy.location('pathname', { timeout: 30000 }).should('not.include', '/auth/login')

    const marker = `E2E-Convex-${Date.now()}`
    cy.request({
      method: 'POST',
      url: '/api/patients',
      failOnStatusCode: false,
      body: { first_name: marker, last_name: 'WriteCutover' },
    }).then((res) => {
      // A successful 200/201 means createPatientInConvex wrote to Convex (no Supabase).
      expect(res.status, 'create status').to.be.oneOf([200, 201])
      const id = res.body?.data?.id || res.body?.id
      expect(id, 'created patient id').to.be.a('string')

      // Clean up (delete also runs the Convex-only write path).
      cy.request({
        method: 'DELETE',
        url: `/api/patients/${id}`,
        failOnStatusCode: false,
      }).then((del) => {
        expect(del.status, 'delete status').to.be.oneOf([200, 204])
      })
    })
  })
})
