/**
 * PROD verification — convex-only WRITE lifecycle against the LIVE deployment.
 *
 * With prod DATA_WRITE_MODE=convex, every create/update/delete must go through the
 * Convex-only write path and land in prod Convex (superb-grouse-940). Each entity
 * creates a record and deletes it (footprint zero). Logs in as the TEST account.
 *
 *   Creds via CYPRESS_PROD_EMAIL / CYPRESS_PROD_PASS, baseUrl via CYPRESS_baseUrl.
 *   No secrets in this file. Full how-to + coordinates (accounts, Convex prod deployment,
 *   the vercel --cwd quirk, the 412-needs-recipe note) in:
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
  return (
    body?.data?.id || body?.id || body?.data?.data?.id || body?.category?.id ||
    body?.service?.id || body?.patient?.id || body?.treatment?.id ||
    body?.expense?.id || body?.asset?.id || body?.supply?.id
  )
}
function firstId(body: any): string | undefined {
  const arr = Array.isArray(body)
    ? body
    : body?.data || body?.patients || body?.services || body?.items || body?.results || []
  return Array.isArray(arr) && arr.length ? arr[0]?.id : undefined
}

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

describe('PROD convex-only write lifecycle — core CRUD entities', () => {
  beforeEach(() => {
    expect(EMAIL, 'CYPRESS_PROD_EMAIL set').to.not.equal('')
    login()
  })

  it('fixed_costs: create + delete', () => {
    createAndDelete('fixed_costs', '/api/fixed-costs', {
      category: 'rent', concept: `E2E-${Date.now()}`, amount_cents: 12345,
    })
  })

  it('supplies: create + delete', () => {
    createAndDelete('supplies', '/api/supplies', {
      name: `E2E-${Date.now()}`, category: 'consumable', presentation: 'box',
      price_cents: 5000, portions: 10,
    })
  })

  it('assets: create + delete', () => {
    createAndDelete('assets', '/api/assets', {
      name: `E2E-${Date.now()}`, category: 'equipment',
      purchase_price_cents: 100000, depreciation_months: 36,
    })
  })

  it('categories: create + delete (soft)', () => {
    createAndDelete('categories', '/api/categories?type=expense',
      { name: `E2E-${Date.now()}` }, { deleteBase: '/api/categories' })
  })

  it('services: create + delete', () => {
    createAndDelete('services', '/api/services', { name: `E2E-${Date.now()}`, est_minutes: 30 })
  })

  it('patients: create + delete', () => {
    createAndDelete('patients', '/api/patients', {
      first_name: `E2E-${Date.now()}`, last_name: 'WriteLifecycle',
    })
  })

  it('expenses: create + delete', () => {
    cy.request({ method: 'GET', url: '/api/categories?type=expense', failOnStatusCode: false }).then((cr) => {
      const list = Array.isArray(cr.body) ? cr.body : cr.body?.data || cr.body?.categories || []
      const cat = Array.isArray(list) && list.length ? list[0] : undefined
      expect(cat?.id, 'an existing expense category id').to.be.a('string')
      createAndDelete('expenses', '/api/expenses', {
        expense_date: '2026-01-15', category_id: cat.id, category: cat.name, amount_cents: 5000,
      })
    })
  })

  it('patient_sources: create (POST-only, no delete endpoint)', () => {
    cy.request({ method: 'POST', url: '/api/patient-sources', failOnStatusCode: false,
      body: { name: `E2E-${Date.now()}` } }).then((res) => {
      expect(res.status, `patient_sources create (body: ${JSON.stringify(res.body).slice(0, 200)})`).to.be.oneOf([200, 201])
      expect(createdId(res.body), 'patient_sources created id').to.be.a('string')
    })
  })

  it('treatments: create + delete (full recipe chain: supply -> service -> recipe -> patient)', () => {
    // Self-contained chain so it passes on an empty clinic AND satisfies the
    // "service must have a recipe" precondition (412 otherwise).
    cy.request({ method: 'POST', url: '/api/supplies', failOnStatusCode: false,
      body: { name: `E2E-T-${Date.now()}`, category: 'consumable', presentation: 'box', price_cents: 5000, portions: 10 },
    }).then((supRes) => {
      const supplyId = createdId(supRes.body)
      expect(supplyId, 'supply id for recipe').to.be.a('string')
      cy.request({ method: 'POST', url: '/api/services', failOnStatusCode: false,
        body: { name: `E2E-T-${Date.now()}`, est_minutes: 30 } }).then((sr) => {
        const serviceId = createdId(sr.body) || firstId(sr.body)
        expect(serviceId, 'service id for treatment').to.be.a('string')
        // Attach a recipe line (Convex-only write path for service_supplies)
        cy.request({ method: 'POST', url: `/api/services/${serviceId}/supplies`, failOnStatusCode: false,
          body: { supply_id: supplyId, qty: 1 } }).then((recipeRes) => {
          expect(recipeRes.status, `recipe line (body: ${JSON.stringify(recipeRes.body).slice(0, 200)})`).to.be.oneOf([200, 201])
          cy.request({ method: 'POST', url: '/api/patients', failOnStatusCode: false,
            body: { first_name: `E2E-T-${Date.now()}`, last_name: 'TreatFK' } }).then((pr) => {
            const patientId = createdId(pr.body) || firstId(pr.body)
            expect(patientId, 'patient id for treatment').to.be.a('string')
            cy.request({ method: 'POST', url: '/api/treatments', failOnStatusCode: false,
              body: { patient_id: patientId, service_id: serviceId, minutes: 30, treatment_date: '2026-01-15' },
            }).then((res) => {
              expect(res.status, `treatments create (body: ${JSON.stringify(res.body).slice(0, 250)})`).to.be.oneOf([200, 201])
              const id = createdId(res.body)
              expect(id, 'treatment created id').to.be.a('string')
              cy.request({ method: 'DELETE', url: `/api/treatments/${id}`, failOnStatusCode: false }).then((del) => {
                expect(del.status, 'treatment delete').to.be.oneOf([200, 204])
              })
              // cleanup fixtures
              cy.request({ method: 'DELETE', url: `/api/patients/${patientId}`, failOnStatusCode: false })
              cy.request({ method: 'DELETE', url: `/api/services/${serviceId}`, failOnStatusCode: false })
              cy.request({ method: 'DELETE', url: `/api/supplies/${supplyId}`, failOnStatusCode: false })
            })
          })
        })
      })
    })
  })
})
