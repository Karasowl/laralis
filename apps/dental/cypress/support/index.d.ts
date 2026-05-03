declare namespace Cypress {
  interface Chainable {
    loginAsDoctor(): Chainable<void>
    loginAsStageUser(email: string, password?: string, options?: { allowSetup?: boolean }): Chainable<void>
    assertNotInSetupFlow(): Chainable<void>
    assertAppShell(): Chainable<void>
    assertNoHorizontalScroll(): Chainable<void>
    switchLanguage(targetLocale: 'en' | 'es'): Chainable<void>
  }
}
