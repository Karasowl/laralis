/**
 * Phase F — convex-only WRITE lifecycle across all core CRUD entities.
 *
 * Run with AUTH_BACKEND=convex + DATA_READ_BACKEND=convex + DATA_WRITE_MODE=convex
 * (blanket) so every create/update/delete goes through the Convex-only write path
 * (createXInConvex / patchConvexDocumentByLegacyId / deleteConvexDocumentByLegacyId)
 * and NEVER reaches Supabase. Each entity creates a record and deletes it
 * (footprint zero), except patient_sources (POST-only, marked leftover) and
 * settings_time (skipped: its upsert mutates the clinic's real config).
 *
 *   npx cypress run --spec cypress/e2e/convex-write-lifecycle.cy.ts --config baseUrl=http://localhost:<port>
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

function createdId(body: any): string | undefined {
  return (
    body?.data?.id ||
    body?.id ||
    body?.data?.data?.id ||
    body?.category?.id ||
    body?.service?.id ||
    body?.patient?.id ||
    body?.treatment?.id ||
    body?.expense?.id ||
    body?.asset?.id ||
    body?.supply?.id
  )
}

function firstId(body: any): string | undefined {
  const arr = Array.isArray(body)
    ? body
    : body?.data || body?.patients || body?.services || body?.items || body?.results || []
  return Array.isArray(arr) && arr.length ? arr[0]?.id : undefined
}

/** Create via a Convex-only write path, assert 2xx + id, then delete (also Convex-only). */
function createAndDelete(
  name: string,
  createPath: string,
  body: Record<string, unknown>,
  opts: { deleteBase?: string } = {}
) {
  cy.request({ method: 'POST', url: createPath, failOnStatusCode: false, body }).then((res) => {
    expect(res.status, `${name} create (body: ${JSON.stringify(res.body).slice(0, 200)})`).to.be.oneOf([200, 201])
    const id = createdId(res.body)
    expect(id, `${name} created id`).to.be.a('string')
    const base = opts.deleteBase || createPath.split('?')[0]
    cy.request({ method: 'DELETE', url: `${base}/${id}`, failOnStatusCode: false }).then((del) => {
      expect(del.status, `${name} delete (body: ${JSON.stringify(del.body).slice(0, 200)})`).to.be.oneOf([200, 204])
    })
  })
}

describe('Convex-only write lifecycle — core CRUD entities', () => {
  beforeEach(() => login())

  it('fixed_costs: create + delete', () => {
    createAndDelete('fixed_costs', '/api/fixed-costs', {
      category: 'rent',
      concept: `E2E-${Date.now()}`,
      amount_cents: 12345,
    })
  })

  it('supplies: create + delete', () => {
    createAndDelete('supplies', '/api/supplies', {
      name: `E2E-${Date.now()}`,
      category: 'consumable',
      presentation: 'box',
      price_cents: 5000,
      portions: 10,
    })
  })

  it('assets: create + delete', () => {
    createAndDelete('assets', '/api/assets', {
      name: `E2E-${Date.now()}`,
      category: 'equipment',
      purchase_price_cents: 100000,
      depreciation_months: 36,
    })
  })

  it('categories: create + delete (soft)', () => {
    createAndDelete(
      'categories',
      '/api/categories?type=expense',
      { name: `E2E-${Date.now()}` },
      { deleteBase: '/api/categories' }
    )
  })

  it('services: create + delete', () => {
    createAndDelete('services', '/api/services', {
      name: `E2E-${Date.now()}`,
      est_minutes: 30,
    })
  })

  it('patients: create + delete', () => {
    createAndDelete('patients', '/api/patients', {
      first_name: `E2E-${Date.now()}`,
      last_name: 'WriteLifecycle',
    })
  })

  it('expenses: create + delete', () => {
    // Resolve a real expense category (the route validates category/category_id against
    // system categories with entity_type='expense').
    cy.request({ method: 'GET', url: '/api/categories?type=expense', failOnStatusCode: false }).then((cr) => {
      const list = Array.isArray(cr.body) ? cr.body : cr.body?.data || cr.body?.categories || []
      const cat = Array.isArray(list) && list.length ? list[0] : undefined
      expect(cat?.id, 'an existing expense category id').to.be.a('string')
      createAndDelete('expenses', '/api/expenses', {
        expense_date: '2026-01-15',
        category_id: cat.id,
        category: cat.name,
        amount_cents: 5000,
      })
    })
  })

  it('patient_sources: create (POST-only, no delete endpoint)', () => {
    cy.request({
      method: 'POST',
      url: '/api/patient-sources',
      failOnStatusCode: false,
      body: { name: `E2E-${Date.now()}` },
    }).then((res) => {
      expect(res.status, `patient_sources create (body: ${JSON.stringify(res.body).slice(0, 200)})`).to.be.oneOf([200, 201])
      expect(createdId(res.body), 'patient_sources created id').to.be.a('string')
    })
  })

  it('treatments: create + delete (FK: existing patient + service)', () => {
    cy.request({ method: 'GET', url: '/api/patients', failOnStatusCode: false }).then((pr) => {
      const patientId = firstId(pr.body)
      expect(patientId, 'an existing patient id').to.be.a('string')
      cy.request({ method: 'GET', url: '/api/services', failOnStatusCode: false }).then((sr) => {
        const serviceId = firstId(sr.body)
        expect(serviceId, 'an existing service id').to.be.a('string')
        cy.request({
          method: 'POST',
          url: '/api/treatments',
          failOnStatusCode: false,
          body: { patient_id: patientId, service_id: serviceId, minutes: 30, treatment_date: '2026-01-15' },
        }).then((res) => {
          expect(res.status, `treatments create (body: ${JSON.stringify(res.body).slice(0, 250)})`).to.be.oneOf([200, 201])
          const id = createdId(res.body)
          expect(id, 'treatment created id').to.be.a('string')
          cy.request({ method: 'DELETE', url: `/api/treatments/${id}`, failOnStatusCode: false }).then((del) => {
            expect(del.status, 'treatment delete').to.be.oneOf([200, 204])
          })
        })
      })
    })
  })
})
