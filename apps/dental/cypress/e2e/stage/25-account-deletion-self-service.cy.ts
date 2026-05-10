describe('Stage self-service account deletion', () => {
  const password = Cypress.env('QA_STAGE_DEFAULT_PASSWORD') || 'LaralisQA!2026'
  const stamp = `qa-delete-account-${Date.now()}-${Cypress._.random(1000, 9999)}`
  const email = `${stamp}@laralis.test`
  const otherEmail = `${stamp}-other@laralis.test`
  const workspaceName = `QA Delete Account Workspace ${stamp}`
  const workspaceSlug = `qa-delete-account-${stamp}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const clinicName = `QA Delete Account Clinic ${stamp}`

  function expectDeletionState(expected: {
    authUserExists: boolean
    workspaceCount: number
    clinicCount: number
    patientCount: number
  }) {
    cy.task('qaAccountDeletionState', { email, workspaceName }).then((state) => {
      expect(state, 'account deletion state').to.deep.include(expected)
    })
  }

  before(() => {
    cy.task('qaDeleteUserByEmail', email)
    cy.task('qaDeleteUserByEmail', otherEmail)
    cy.task('qaCreateConfirmedUser', { email, password })
    cy.task('qaCreateConfirmedUser', { email: otherEmail, password })
  })

  after(() => {
    cy.task('qaDeleteUserByEmail', email)
    cy.task('qaDeleteUserByEmail', otherEmail)
  })

  it('requires OTP for the current user and deletes the owned workspace tree', () => {
    cy.loginAsStageUser(email, password, { allowSetup: true })

    cy.request('POST', '/api/workspaces', {
      workspaceName,
      workspaceSlug,
      clinicName,
      clinicAddress: '123 QA Delete Account Street',
      description: 'Disposable account deletion QA workspace',
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.workspace.name).to.eq(workspaceName)
      expect(response.body.clinic.name).to.eq(clinicName)
    })

    expectDeletionState({
      authUserExists: true,
      workspaceCount: 1,
      clinicCount: 1,
      patientCount: 0,
    })

    cy.request({
      method: 'DELETE',
      url: '/api/account/delete',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, 'legacy deletion route is disabled').to.eq(410)
      expect(response.body.error).to.eq('Deprecated account deletion route')
    })

    expectDeletionState({
      authUserExists: true,
      workspaceCount: 1,
      clinicCount: 1,
      patientCount: 0,
    })

    cy.task('qaGenerateAccountDeletionOtp', otherEmail).then((result: any) => {
      cy.request({
        method: 'DELETE',
        url: '/api/auth/delete-account',
        body: {
          email: otherEmail,
          code: result.otp,
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status, 'OTP email must match current user').to.eq(403)
        expect(response.body.error).to.eq('Email does not match current user')
      })
    })

    expectDeletionState({
      authUserExists: true,
      workspaceCount: 1,
      clinicCount: 1,
      patientCount: 0,
    })

    cy.task('qaGenerateAccountDeletionOtp', email).then((result: any) => {
      cy.request({
        method: 'DELETE',
        url: '/api/auth/delete-account',
        body: {
          email,
          code: result.otp,
        },
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.message).to.eq('Account successfully deleted')
      })
    })

    expectDeletionState({
      authUserExists: false,
      workspaceCount: 0,
      clinicCount: 0,
      patientCount: 0,
    })

    cy.request({
      url: '/api/workspaces',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, 'deleted account session no longer resolves').to.eq(401)
    })
  })
})
