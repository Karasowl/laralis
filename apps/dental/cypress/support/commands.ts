function isStageRun() {
  return String(Cypress.config('baseUrl') || '').includes('laralis-monorepo-preview')
}

function requiredEnv(name: string) {
  const value = Cypress.env(name)
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing Cypress env ${name}`)
  }
  return value
}

function stageCredentials() {
  if (isStageRun()) {
    return {
      email: requiredEnv('STAGE_TEST_EMAIL'),
      password: requiredEnv('STAGE_TEST_PASSWORD'),
    }
  }

  return {
    email: requiredEnv('TEST_EMAIL'),
    password: requiredEnv('TEST_PASSWORD'),
  }
}

Cypress.Commands.add('loginAsDoctor', () => {
  const { email, password } = stageCredentials()

  cy.session(
    ['doctor', Cypress.config('baseUrl'), email],
    () => {
      cy.visit('/auth/login')
      cy.get('input[type="email"]').should('be.visible').clear().type(email)
      cy.get('input[type="password"]').should('be.visible').clear().type(password, { log: false })
      cy.get('button[type="submit"]').click()
      cy.location('pathname', { timeout: 30000 }).should('not.include', '/auth/login')
      cy.assertNotInSetupFlow()
    },
    {
      validate() {
        cy.visit('/')
        cy.location('pathname', { timeout: 30000 }).should('not.match', /\/auth\/login/)
        cy.assertNotInSetupFlow()
      },
    }
  )
})

Cypress.Commands.add('assertNotInSetupFlow', () => {
  cy.location('pathname', { timeout: 30000 }).should((pathname) => {
    expect(pathname, 'active users must not be sent to onboarding').not.to.match(
      /^\/(?:onboarding|setup(?:\/cancel|\/resume)?)/
    )
  })
})

Cypress.Commands.add('assertAppShell', () => {
  cy.assertNotInSetupFlow()
  cy.contains(/Dashboard|Panel|Pacientes|Patients|Tratamientos|Treatments/i, { timeout: 30000 })
    .should('be.visible')
  cy.contains(/PoDent|Lara/i, { timeout: 30000 }).should('exist')
})

Cypress.Commands.add('switchLanguage', (targetLocale: 'en' | 'es') => {
  const label = targetLocale === 'en' ? /EN\s+English|English/i : /ES\s+Espa.ol|Espa.ol/i
  const ariaLabel = targetLocale === 'en' ? /Language: English/i : /Language: Espa.ol/i

  cy.get('button[aria-label^="Language:"]:visible').first().click()
  cy.contains('[role="menuitem"]', label, { timeout: 30000 }).then(($item) => {
    ;($item[0] as HTMLElement).click()
  })
  cy.location('pathname', { timeout: 30000 }).should('not.match', /\/auth\/login/)
  cy.get('button[aria-label^="Language:"]:visible', { timeout: 30000 })
    .first()
    .should('have.attr', 'aria-label')
    .and('match', ariaLabel)
  cy.assertNotInSetupFlow()
})
