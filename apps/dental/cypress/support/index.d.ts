declare namespace Cypress {
  interface Chainable {
    loginAsDoctor(): Chainable<void>
    assertNotInSetupFlow(): Chainable<void>
    assertAppShell(): Chainable<void>
    switchLanguage(targetLocale: 'en' | 'es'): Chainable<void>
  }
}

