type WorkspaceRow = {
  id: string
  name: string
  slug: string
  status?: string | null
  onboarding_completed?: boolean | null
}

type DraftWorkspaceInput = {
  name: string
  slug: string
  clinicName?: string
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

function createDraftWorkspace(input: DraftWorkspaceInput): Cypress.Chainable<WorkspaceRow> {
  return cy
    .request('POST', '/api/workspaces', {
      workspaceName: input.name,
      workspaceSlug: input.slug,
      clinicName: input.clinicName,
      clinicAddress: input.clinicName ? '123 QA Resume Street' : undefined,
      onboarding_completed: false,
      onboarding_step: input.clinicName ? 1 : 0,
    })
    .then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.workspace.name).to.eq(input.name)
      expect(workspaceStatus(response.body.workspace), `${input.name} status`).to.eq('draft')
      if (input.clinicName) {
        expect(response.body.clinic?.name, `${input.name} clinic`).to.eq(input.clinicName)
      }

      return response.body.workspace as WorkspaceRow
    })
}

function maskSetupResumeDynamicFields() {
  cy.document().then((doc) => {
    const style = doc.createElement('style')
    style.setAttribute('data-testid', 'qa-visual-mask')
    style.textContent = `
      [data-testid="setup-resume-updated-at"],
      [data-testid="setup-resume-workspace-id"],
      [data-testid="setup-resume-delete-after"] {
        color: transparent !important;
        text-shadow: none !important;
      }
    `
    doc.head.appendChild(style)
  })
}

function compareVisualSnapshot(screenshotName: string, baselineName = screenshotName) {
  cy.task('compareSnapshot', {
    screenshotName,
    specName: '07-onboarding-setup-lifecycle.cy.ts',
    baselineName,
    maxDiffRatio: 0.04,
    threshold: 0.12,
  }).then((result: any) => {
    if (!result.passed) {
      throw new Error(result.error || `${baselineName} visual snapshot failed`)
    }

    expect(result.passed, `${baselineName} visual snapshot`).to.eq(true)
  })
}

describe('Stage onboarding and setup lifecycle', () => {
  const password = Cypress.env('QA_STAGE_DEFAULT_PASSWORD') || 'LaralisQA!2026'
  const lifecycleStamp = uniqueStamp('qa-onboarding')
  const lifecycleEmail = `${lifecycleStamp}@laralis.test`
  const lifecycleWorkspace = `QA Onboarding ${lifecycleStamp}`
  const lifecycleClinic = `QA Clinic ${lifecycleStamp}`
  const transientEmails: string[] = []
  let draftWorkspaceId: string | undefined

  before(() => {
    cy.task('qaDeleteUserByEmail', lifecycleEmail)
    cy.task('qaCreateConfirmedUser', { email: lifecycleEmail, password })
  })

  after(() => {
    cy.task('qaDeleteUserByEmail', lifecycleEmail)
    cy.wrap(transientEmails, { log: false }).each((email) => {
      cy.task('qaDeleteUserByEmail', email)
    })
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

  it('resumes a pending workspace into setup with clinic context', () => {
    const stamp = uniqueStamp('qa-resume-setup')
    const email = `${stamp}@laralis.test`
    const workspaceName = `QA Resume ${stamp}`
    const clinicName = `QA Resume Clinic ${stamp}`
    transientEmails.push(email)

    cy.task('qaDeleteUserByEmail', email)
    cy.task('qaCreateConfirmedUser', { email, password })
    cy.loginAsStageUser(email, password, { allowSetup: true })

    createDraftWorkspace({
      name: workspaceName,
      slug: stamp,
      clinicName,
    })

    cy.intercept('POST', '**/api/workspaces/*/lifecycle').as('workspaceLifecycle')
    cy.visit('/setup/resume')
    cy.get('[data-testid="setup-resume-page"]', { timeout: 30000 }).should('be.visible')
    cy.contains('[data-testid="setup-resume-workspace-card"]', workspaceName).within(() => {
      cy.get('[data-testid="setup-resume-continue"], button').contains(/Continuar|Continue/i).click()
    })

    cy.wait('@workspaceLifecycle', { timeout: 30000 }).its('response.statusCode').should('eq', 200)
    cy.location('pathname', { timeout: 30000 }).should('eq', '/setup')
    cy.get('[data-testid="setup-page"]', { timeout: 30000 }).should('be.visible')

    cy.request('/api/setup/status').then((statusResponse) => {
      expect(statusResponse.status).to.eq(200)
      expect(statusResponse.body.data.clinicId, 'resumed setup clinic context').to.be.a('string')
    })
  })

  it('archives and deletes multiple pending workspaces from setup resume without orphaning visible drafts', () => {
    const stamp = uniqueStamp('qa-resume-manage')
    const email = `${stamp}@laralis.test`
    const archiveWorkspaceName = `QA Archive Draft ${stamp}`
    const deleteWorkspaceName = `QA Delete Draft ${stamp}`
    transientEmails.push(email)

    cy.task('qaDeleteUserByEmail', email)
    cy.task('qaCreateConfirmedUser', { email, password })
    cy.loginAsStageUser(email, password, { allowSetup: true })

    createDraftWorkspace({
      name: archiveWorkspaceName,
      slug: `${stamp}-archive`,
    })
    createDraftWorkspace({
      name: deleteWorkspaceName,
      slug: `${stamp}-delete`,
    })

    cy.intercept('POST', '**/api/workspaces/*/lifecycle').as('workspaceLifecycle')
    cy.visit('/setup/resume')
    cy.get('[data-testid="setup-resume-page"]', { timeout: 30000 }).should('be.visible')
    cy.contains('[data-testid="setup-resume-workspace-card"]', archiveWorkspaceName).should('be.visible')
    cy.contains('[data-testid="setup-resume-workspace-card"]', deleteWorkspaceName).should('be.visible')
    cy.assertNoHorizontalScroll()

    cy.window().then((win) => {
      cy.stub(win, 'confirm').returns(true)
    })

    cy.contains('[data-testid="setup-resume-workspace-card"]', archiveWorkspaceName).within(() => {
      cy.get('[data-testid="setup-resume-archive"], button').contains(/Empezar|Start/i).click()
    })
    cy.wait('@workspaceLifecycle', { timeout: 30000 }).then((interception) => {
      expect(interception.response?.statusCode).to.eq(200)
      expect(interception.response?.body?.workspace?.status).to.eq('archived')
    })

    cy.location('pathname', { timeout: 30000 }).should('eq', '/setup/resume')
    cy.contains('[data-testid="setup-resume-workspace-card"]', archiveWorkspaceName).should('not.exist')
    cy.contains('[data-testid="setup-resume-workspace-card"]', deleteWorkspaceName).should('be.visible')

    cy.contains('[data-testid="setup-resume-workspace-card"]', deleteWorkspaceName).within(() => {
      cy.get('[data-testid="setup-resume-delete"], button').contains(/Eliminar|Delete/i).click()
    })
    cy.wait('@workspaceLifecycle', { timeout: 30000 }).then((interception) => {
      expect(interception.response?.statusCode).to.eq(200)
      expect(interception.response?.body?.deleted).to.eq(true)
    })

    cy.location('pathname', { timeout: 30000 }).should('eq', '/onboarding')
    cy.request('/api/workspaces?list=true').then((workspacesResponse) => {
      expect(workspacesResponse.status).to.eq(200)
      expect(workspacesResponse.body, 'visible workspaces after archive/delete').to.deep.eq([])
    })
  })

  it('matches the setup resume multiple drafts desktop visual baseline', () => {
    const stamp = uniqueStamp('qa-visual-resume')
    const email = 'qa-visual-setup-resume@laralis.test'
    const firstWorkspaceName = 'QA Resume Visual Draft A'
    const secondWorkspaceName = 'QA Resume Visual Draft B'
    const screenshotName = 'setup-resume-multiple-drafts-desktop-dark'
    transientEmails.push(email)

    cy.task('qaDeleteUserByEmail', email)
    cy.task('qaCreateConfirmedUser', { email, password })
    cy.loginAsStageUser(email, password, { allowSetup: true })

    createDraftWorkspace({
      name: firstWorkspaceName,
      slug: `${stamp}-a`,
    })
    createDraftWorkspace({
      name: secondWorkspaceName,
      slug: `${stamp}-b`,
    })

    cy.viewport(1440, 900)
    cy.visit('/setup/resume', {
      onBeforeLoad(win) {
        win.localStorage.setItem('laralis-theme', 'dark')
        win.localStorage.setItem('preferred-locale', 'es')
      },
    })
    cy.get('[data-testid="setup-resume-page"]', { timeout: 30000 }).should('be.visible')
    cy.contains('[data-testid="setup-resume-workspace-card"]', firstWorkspaceName).should('be.visible')
    cy.contains('[data-testid="setup-resume-workspace-card"]', secondWorkspaceName).should('be.visible')
    cy.assertNoHorizontalScroll()
    maskSetupResumeDynamicFields()

    cy.get('[data-testid="setup-resume-page"]').screenshot(screenshotName, {
      overwrite: true,
    })
    compareVisualSnapshot(screenshotName)
  })
})
