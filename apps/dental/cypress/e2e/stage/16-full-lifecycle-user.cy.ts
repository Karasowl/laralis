export {}

type WorkspaceRow = {
  id: string
  name: string
  slug: string
  status?: string | null
  onboarding_completed?: boolean | null
}

type ClinicRow = {
  id: string
  name: string
  workspace_id: string
}

type CategoryRow = {
  id?: string
  name?: string | null
  display_name?: string | null
}

type CreatedIds = {
  workspaceId?: string
  clinicId?: string
  assetId?: string
  fixedCostId?: string
  supplyId?: string
  serviceId?: string
  platformId?: string
  campaignId?: string
  patientId?: string
  treatmentId?: string
  expenseId?: string
}

function uniqueStamp(prefix: string) {
  return `${prefix}-${Date.now()}-${Cypress._.random(1000, 9999)}`
}

function expectStatus(response: Cypress.Response<any>, allowed = [200, 201]) {
  expect(allowed, `${response.status} is an allowed status`).to.include(response.status)
}

function workspaceStatus(workspace: WorkspaceRow) {
  return workspace.status || (workspace.onboarding_completed ? 'active' : 'draft')
}

function categoryLabel(category: CategoryRow) {
  return category.display_name || category.name || 'Otros'
}

function chooseCategory(categories: CategoryRow[], pattern: RegExp, fallback: CategoryRow) {
  return categories.find((category) => pattern.test(categoryLabel(category))) || categories[0] || fallback
}

function finishSetupFromCurrentPage() {
  const nextPattern = /Paso siguiente|Next/i
  const completePattern = /Listo, ir al dashboard|Done, go to dashboard/i

  cy.contains('button', nextPattern, { timeout: 30000 }).should('be.enabled').click()
  cy.contains('button', nextPattern, { timeout: 30000 }).should('be.enabled').click()
  cy.contains('button', nextPattern, { timeout: 30000 }).should('be.enabled').click()
  cy.contains('button', nextPattern, { timeout: 30000 }).should('be.enabled').click()
  cy.contains('button', completePattern, { timeout: 30000 }).should('be.enabled').click()
}

function expectRenderedText(text: string) {
  cy.document().its('body.innerText', { timeout: 30000 }).should('include', text)
}

function expectRenderedTextMatching(pattern: RegExp) {
  cy.document().its('body.innerText', { timeout: 30000 }).should('match', pattern)
}

describe('Stage full lifecycle user journey', () => {
  const password = Cypress.env('QA_STAGE_DEFAULT_PASSWORD') || 'LaralisQA!2026'
  const stamp = uniqueStamp('qa-lifecycle')
  const email = `${stamp}@laralis.test`
  const workspaceName = `QA Lifecycle Workspace ${stamp}`
  const clinicName = `QA Lifecycle Clinic ${stamp}`
  const patientName = `Paciente Lifecycle ${stamp}`
  const patientEmail = `${stamp}-patient@laralis.test`
  const supplyName = `Insumo Lifecycle ${stamp}`
  const serviceName = `Servicio Lifecycle ${stamp}`
  const platformName = `Plataforma Lifecycle ${stamp}`
  const campaignName = `Campana Lifecycle ${stamp}`
  const expenseDescription = `Gasto Lifecycle ${stamp}`
  const ids: CreatedIds = {}

  before(() => {
    cy.task('qaDeleteUserByEmail', email)
    cy.task('qaCreateConfirmedUser', { email, password })
  })

  after(() => {
    cy.task('qaDeleteUserByEmail', email)
  })

  it('registers a confirmed QA user, completes setup, uses core modules, and deletes the QA account tree', () => {
    cy.loginAsStageUser(email, password, { allowSetup: true })
    cy.visit('/onboarding')

    cy.get('[data-testid="onboarding-page"]', { timeout: 30000 }).should('be.visible')
    cy.get('[data-testid="onboarding-modal"]').should('be.visible')
    cy.get('[data-testid="onboarding-next"]').click()

    cy.get('#onboarding-workspace-name').should('be.visible').clear().type(workspaceName)
    cy.get('#onboarding-workspace-description').clear().type('Full lifecycle Cypress QA workspace')
    cy.get('[data-testid="onboarding-next"]').click()

    cy.get('#onboarding-clinic-name').should('be.visible').clear().type(clinicName)
    cy.get('#onboarding-clinic-address').clear().type('456 QA Lifecycle Avenue')
    cy.get('#onboarding-clinic-phone').clear().type('+15555550202')
    cy.get('#onboarding-clinic-email').clear().type(email)
    cy.get('[data-testid="onboarding-next"]').click()

    cy.location('pathname', { timeout: 30000 }).should('eq', '/setup')
    cy.get('[data-testid="setup-page"]', { timeout: 30000 }).should('be.visible')

    cy.request('/api/workspaces?list=true').then((response) => {
      expect(response.status).to.eq(200)
      const workspace = (response.body as WorkspaceRow[]).find((row) => row.name === workspaceName)
      expect(workspace, 'workspace created through onboarding').to.exist
      expect(workspaceStatus(workspace!), 'workspace remains draft until setup is complete').to.eq('draft')
      ids.workspaceId = workspace!.id

      cy.request(`/api/workspaces/${ids.workspaceId}/clinics`).then((clinicsResponse) => {
        expect(clinicsResponse.status).to.eq(200)
        const clinic = (clinicsResponse.body.data || []).find((row: ClinicRow) => row.name === clinicName)
        expect(clinic, 'clinic created through onboarding').to.exist
        ids.clinicId = clinic.id
      })
    })

    cy.then(() => {
      cy.request('POST', '/api/clinics', { clinicId: ids.clinicId }).then((response) => {
        expect(response.status).to.eq(200)
      })
    })

    cy.request('POST', '/api/assets', {
      name: `Activo Lifecycle ${stamp}`,
      category: 'equipment',
      purchase_price_pesos: 12000,
      depreciation_months: 24,
      purchase_date: '2026-05-01',
    }).then((response) => {
      expectStatus(response)
      ids.assetId = response.body.data.id
    })

    cy.request('POST', '/api/fixed-costs', {
      category: 'rent',
      concept: `Renta Lifecycle ${stamp}`,
      amount_cents: 180000,
    }).then((response) => {
      expectStatus(response)
      ids.fixedCostId = response.body.data.id
    })

    cy.request('POST', '/api/settings/time', {
      work_days: 20,
      hours_per_day: 7,
      real_pct: 75,
      monthly_goal_cents: 5500000,
    }).then((response) => {
      expectStatus(response)
      expect(response.body.data.work_days).to.eq(20)
    })

    cy.request('POST', '/api/supplies', {
      name: supplyName,
      category: 'qa-lifecycle',
      presentation: 'caja',
      price_cents: 90000,
      portions: 9,
      stock_quantity: 6,
      min_stock_alert: 1,
    }).then((response) => {
      expectStatus(response)
      ids.supplyId = response.body.data.id
      expect(response.body.data.cost_per_portion_cents).to.eq(10000)
    })

    cy.then(() => {
      cy.request('POST', '/api/services', {
        name: serviceName,
        category: 'qa-lifecycle',
        est_minutes: 45,
        description: `Full lifecycle service ${stamp}`,
        target_price: 3200,
        margin_pct: 58,
        supplies: [{ supply_id: ids.supplyId, qty: 2 }],
      }).then((response) => {
        expect(response.status).to.eq(201)
        ids.serviceId = response.body.data.id
      })
    })

    cy.request('/api/setup/status').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.data).to.include({
        clinicId: ids.clinicId,
        hasTime: true,
        hasFixedCosts: true,
        hasAssets: true,
      })
      expect(response.body.data.suppliesCount).to.be.greaterThan(0)
      expect(response.body.data.servicesWithRecipeCount).to.be.greaterThan(0)
    })

    cy.visit('/setup')
    cy.get('[data-testid="setup-page"]', { timeout: 30000 }).should('be.visible')
    cy.window().then((win) => {
      const refreshSetup = (win as any).__LARALIS_REFRESH_SETUP
      if (typeof refreshSetup === 'function') {
        return refreshSetup()
      }
      return null
    })
    cy.contains(/5 de 5|5 of 5/i, { timeout: 30000 }).should('be.visible')
    finishSetupFromCurrentPage()

    cy.location('pathname', { timeout: 30000 }).should('eq', '/')
    cy.assertAppShell()

    cy.request('/api/workspaces?list=true').then((response) => {
      expect(response.status).to.eq(200)
      const workspace = (response.body as WorkspaceRow[]).find((row) => row.id === ids.workspaceId)
      expect(workspace, 'workspace after setup completion').to.exist
      expect(workspaceStatus(workspace!), 'setup completion activates workspace').to.eq('active')
      expect(workspace!.onboarding_completed).to.eq(true)
    })

    cy.request('POST', '/api/marketing/platforms', {
      display_name: platformName,
      name: `platform_${stamp}`.replace(/[^a-zA-Z0-9_]/g, '_'),
    }).then((response) => {
      expectStatus(response)
      ids.platformId = response.body.data.id

      cy.request('POST', '/api/marketing/campaigns', {
        platform_id: ids.platformId,
        name: campaignName,
        code: `LIFE-${stamp}`,
      }).then((campaignResponse) => {
        expectStatus(campaignResponse)
        ids.campaignId = campaignResponse.body.data.id
      })
    })

    cy.then(() => {
      cy.request('POST', '/api/patients', {
        first_name: patientName,
        last_name: 'QA',
        email: patientEmail,
        phone: '+15555550303',
        first_visit_date: '2026-05-18',
        acquisition_date: '2026-05-18',
        gender: 'other',
        campaign_id: ids.campaignId,
        notes: `Full lifecycle patient ${stamp}`,
      }).then((response) => {
        expectStatus(response)
        ids.patientId = response.body.data.id
      })
    })

    cy.then(() => {
      cy.request('POST', '/api/treatments', {
        patient_id: ids.patientId,
        service_id: ids.serviceId,
        treatment_date: '2026-05-19',
        treatment_time: '10:30',
        minutes: 45,
        variable_cost_cents: 20000,
        margin_pct: 58,
        price_cents: 320000,
        amount_paid_cents: 200000,
        pending_balance_cents: 120000,
        status: 'completed',
        notes: `Full lifecycle treatment ${stamp}`,
      }).then((response) => {
        expectStatus(response)
        ids.treatmentId = response.body.data.id
      })
    })

    cy.request('/api/categories?entity_type=expense').then((response) => {
      expect(response.status).to.eq(200)
      const categories = (response.body.data || []) as CategoryRow[]
      const category = chooseCategory(categories, /renta|servicios|otros|admin/i, {
        name: 'Otros',
        display_name: 'Otros',
      })

      cy.request('POST', '/api/expenses', {
        category_id: category.id,
        category: categoryLabel(category),
        expense_date: '2026-05-20',
        description: expenseDescription,
        amount_cents: 75000,
        vendor: `Proveedor Lifecycle ${stamp}`,
        is_recurring: false,
        is_variable: false,
        expense_category: 'rent',
        related_fixed_cost_id: ids.fixedCostId,
      }).then((expenseResponse) => {
        expectStatus(expenseResponse)
        ids.expenseId = expenseResponse.body.data.id
      })
    })

    cy.visit(`/patients?search=${encodeURIComponent(patientEmail)}`)
    expectRenderedText(patientEmail)
    expectRenderedText(patientName)
    cy.assertNoHorizontalScroll()

    cy.visit('/treatments')
    expectRenderedText(serviceName)
    expectRenderedTextMatching(/completed|completado|completada/i)
    cy.assertNoHorizontalScroll()

    cy.visit('/marketing')
    cy.contains(platformName, { timeout: 30000 }).click()
    expectRenderedText(campaignName)
    expectRenderedTextMatching(/1\b|paciente|patient/i)
    cy.assertNoHorizontalScroll()

    cy.visit('/expenses')
    expectRenderedText(expenseDescription)
    cy.assertNoHorizontalScroll()

    cy.switchLanguage('en')
    cy.assertAppShell()
    cy.switchLanguage('es')
    cy.assertAppShell()

    cy.task('qaDeleteUserByEmail', email).then((result: any) => {
      expect(result.deleted, 'full lifecycle deleted the QA auth user and owned data').to.eq(true)
    })

    cy.task('qaDeleteUserByEmail', email).then((result: any) => {
      expect(result.deleted, 'second cleanup finds no leftover auth user').to.eq(false)
    })
  })
})
