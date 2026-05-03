describe('Stage auth and active workspace shell', () => {
  it('redirects protected routes to login when unauthenticated', () => {
    cy.visit('/patients', { failOnStatusCode: false })
    cy.location('pathname', { timeout: 30000 }).should('include', '/auth/login')
  })

  it('keeps the stage account on register with a clear existing-account error', () => {
    const email = Cypress.env('STAGE_TEST_EMAIL') || 'qa-owner@laralis.test'

    cy.visit('/auth/register')
    cy.get('input').eq(0).clear().type('Stage')
    cy.get('input').eq(1).clear().type('Doctor')
    cy.get('input[type="email"]').clear().type(email)
    cy.get('input[type="password"]').eq(0).clear().type('StageTest123!', { log: false })
    cy.get('input[type="password"]').eq(1).clear().type('StageTest123!', { log: false })
    cy.get('input[type="checkbox"]').check()
    cy.get('button[type="submit"]').click()

    cy.location('pathname', { timeout: 30000 }).should('eq', '/auth/register')
    cy.contains(/ya existe una cuenta|account with this email already exists/i, { timeout: 30000 })
      .should('be.visible')
  })

  it('logs in to the active clinic instead of onboarding or setup', () => {
    cy.loginAsDoctor()
    cy.visit('/')
    cy.assertAppShell()
  })

  it('does not expose setup or cancellation when switching language', () => {
    cy.loginAsDoctor()
    cy.visit('/')
    cy.assertAppShell()

    cy.switchLanguage('en')
    cy.assertAppShell()
    cy.contains(/Cancel setup|Cancelar configuraci.n|setup\/cancel/i).should('not.exist')

    cy.switchLanguage('es')
    cy.assertAppShell()
    cy.contains(/Cancel setup|Cancelar configuraci.n|setup\/cancel/i).should('not.exist')
  })

  it('keeps the retention action API smoke behavior stable', () => {
    cy.request({
      method: 'GET',
      url: '/api/actions/analyze-patient-retention',
      failOnStatusCode: false,
    }).its('status').should('eq', 405)

    cy.clearCookies()
    cy.request({
      method: 'POST',
      url: '/api/actions/analyze-patient-retention',
      body: {},
      failOnStatusCode: false,
    }).its('status').should('eq', 401)
  })
})
