export {} // isolate module scope (cypress specs share global scope under tsc)
/**
 * Phase F — convex-only snapshot CREATE + DELETE.
 * Exercises the ported ClinicSnapshotExporter (reads all clinic tables from Convex,
 * uploads the gzip blob to Convex storage, writes the clinic_snapshots row) and the
 * convex-only DELETE (row + storage blob). Footprint zero.
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

describe('Convex-only snapshot create + delete', () => {
  it('creates a snapshot via the Convex-aware exporter, then deletes it (row + blob)', () => {
    login()
    cy.request({ method: 'POST', url: '/api/snapshots', failOnStatusCode: false, body: { type: 'manual' } }).then((res) => {
      expect(res.status, `snapshot create (${JSON.stringify(res.body).slice(0, 250)})`).to.be.oneOf([200, 201])
      const id = res.body?.snapshotId || res.body?.data?.id || res.body?.id
      expect(id, 'snapshot id').to.be.a('string')
      expect(res.body?.stats?.totalRecords, 'exported record count').to.be.a('number')
      cy.request({ method: 'DELETE', url: `/api/snapshots/${id}`, failOnStatusCode: false }).then((del) => {
        expect(del.status, `snapshot delete (${JSON.stringify(del.body).slice(0, 200)})`).to.be.oneOf([200, 204])
      })
    })
  })
})
