type WorkspaceRow = {
  id: string
  name: string
  slug: string
  status?: string | null
  onboarding_completed?: boolean | null
}

function workspaceStatus(workspace: WorkspaceRow) {
  return workspace.status || (workspace.onboarding_completed ? 'active' : 'draft')
}

function uniqueStamp(prefix: string) {
  return `${prefix}-${Date.now()}-${Cypress._.random(1000, 9999)}`
}

function deleteIncompleteWorkspace(workspaceId?: string) {
  if (!workspaceId) return

  cy.request({
    method: 'POST',
    url: `/api/workspaces/${workspaceId}/lifecycle`,
    body: { action: 'delete_incomplete' },
    failOnStatusCode: false,
  }).then((response) => {
    expect([200, 404], `cleanup draft workspace ${workspaceId}`).to.include(response.status)
  })
}

describe('Stage onboarding and setup lifecycle', () => {
  const password = Cypress.env('QA_STAGE_DEFAULT_PASSWORD') || 'LaralisQA!2026'
  const lifecycleStamp = uniqueStamp('qa-onboarding')
  const lifecycleEmail = `${lifecycleStamp}@laralis.test`
  const lifecycleWorkspace = `QA Onboarding ${lifecycleStamp}`
  const lifecycleClinic = `QA Clinic ${lifecycleStamp}`
  let draftWorkspaceId: string | undefined

  before(() => {
    cy.task('qaDeleteUserByEmail', lifecycleEmail)
    cy.task('qaCreateConfirmedUser', { email: lifecycleEmail, password })
  })

  after(() => {
    cy.task('qaDeleteUserByEmail', lifecycleEmail)
  })

  afterEach(() => {
    deleteIncompleteWorkspace(draftWorkspaceId)
    draftWorkspaceId = undefined
  })

  it('creates a new confirmed user workspace and clinic through onboarding', () => {
    cy.loginAsStageUser(lifecycleEmail, password, { allowSetup: true })
    cy.visit('/onboarding')

    cy.get('[data-testid="onboarding-page"]', { timeout: 30000 }).should('be.visible')
    cy.get('[data-testid="onboarding-modal"]').should('be.visible')
    cy.get('[data-testid="onboarding-next"]').click()

    cy.get('#onboarding-workspace-name').should('be.visible').clear().type(lifecycleWorkspace)
    cy.get('#onboarding-workspace-description').clear().type('Created by Cypress onboarding lifecycle QA')
    cy.get('[data-testid="onboarding-next"]').click()

    cy.get('#onboarding-clinic-name').should('be.visible').clear().type(lifecycleClinic)
    cy.get('#onboarding-clinic-address').clear().type('123 QA Street')
    cy.get('#onboarding-clinic-phone').clear().type('+15555550101')
    cy.get('#onboarding-clinic-email').clear().type(lifecycleEmail)
    cy.get('[data-testid="onboarding-next"]').click()

    cy.location('pathname', { timeout: 30000 }).should('eq', '/setup')
    cy.get('[data-testid="setup-page"]', { timeout: 30000 }).should('be.visible')

    cy.request('/api/workspaces?list=true').then((response) => {
      expect(response.status).to.eq(200)
      const workspaces = response.body as WorkspaceRow[]
      const workspace = workspaces.find((row) => row.name === lifecycleWorkspace)

      expect(workspace, 'created lifecycle workspace').to.exist
      expect(workspaceStatus(workspace!), 'new onboarding workspace status').to.eq('draft')
      expect(workspace!.onboarding_completed).to.eq(false)

      cy.request(`/api/workspaces/${workspace!.id}/clinics`).then((clinicsResponse) => {
        expect(clinicsResponse.status).to.eq(200)
        const clinic = (clinicsResponse.body.data || []).find((row: any) => row.name === lifecycleClinic)
        expect(clinic, 'created lifecycle clinic').to.exist
      })
    })

    cy.request('/api/setup/status').then((statusResponse) => {
      expect(statusResponse.status).to.eq(200)
      expect(statusResponse.body.data.clinicId, 'setup status keeps clinic context').to.be.a('string')
    })
  })

  it('keeps an active clinic selected when setup cancel is hit with a stale draft workspace', () => {
    cy.loginAsDoctor()

    cy.request('/api/workspaces?list=true').then((workspacesResponse) => {
      expect(workspacesResponse.status).to.eq(200)
      const activeWorkspace = (workspacesResponse.body as WorkspaceRow[]).find(
        (workspace) => workspaceStatus(workspace) === 'active'
      )
      expect(activeWorkspace, 'active QA workspace').to.exist

      cy.request('/api/clinics').then((clinicsResponse) => {
        expect(clinicsResponse.status).to.eq(200)
        const activeClinic = clinicsResponse.body.data?.[0]
        expect(activeClinic?.id, 'active QA clinic').to.be.a('string')

        cy.request('/api/patients').then((patientsBeforeResponse) => {
          expect(patientsBeforeResponse.status).to.eq(200)
          const patientCountBefore = (patientsBeforeResponse.body.data || []).length
          expect(patientCountBefore, 'seeded active clinic patients before cancel').to.be.greaterThan(0)

          const draftStamp = uniqueStamp('qa-draft-cancel')
          cy.request('POST', '/api/workspaces', {
            workspaceName: `QA Draft Cancel ${draftStamp}`,
            workspaceSlug: draftStamp,
            onboarding_completed: false,
            onboarding_step: 1,
          }).then((draftResponse) => {
            expect(draftResponse.status).to.eq(200)
            draftWorkspaceId = draftResponse.body.workspace.id
            expect(workspaceStatus(draftResponse.body.workspace), 'created draft status').to.eq('draft')
          })

          cy.then(() => {
            cy.setCookie('workspaceId', draftWorkspaceId!)
            cy.clearCookie('clinicId')
            cy.window().then((win) => {
              win.localStorage.setItem('selectedWorkspaceId', draftWorkspaceId!)
              win.localStorage.removeItem('selectedClinicId')
            })
          })

          cy.visit('/setup/cancel')
          cy.location('pathname', { timeout: 30000 }).should('eq', '/')
          cy.assertAppShell()

          cy.request('/api/workspaces').then((workspaceResponse) => {
            expect(workspaceResponse.status).to.eq(200)
            expect(workspaceResponse.body.workspace.id, 'cancel restores active workspace').to.eq(activeWorkspace!.id)
          })

          cy.request('/api/patients').then((patientsAfterResponse) => {
            expect(patientsAfterResponse.status).to.eq(200)
            expect((patientsAfterResponse.body.data || []).length, 'active clinic patients after cancel')
              .to.eq(patientCountBefore)
          })
        })
      })
    })
  })
})
