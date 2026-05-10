type CoreRoute = {
  path: string
  expectedPath?: string
  label: RegExp
}

const coreRoutes: CoreRoute[] = [
  { path: '/', label: /Dashboard|Panel|Ingresos|Revenue/i },
  { path: '/patients', label: /Pacientes|Patients/i },
  { path: '/treatments', label: /Tratamientos|Treatments/i },
  { path: '/marketing', label: /Marketing|Campañas|Campaigns/i },
  { path: '/reports', expectedPath: '/', label: /Dashboard|Panel|Ingresos|Revenue/i },
]

describe('Stage core navigation smoke', () => {
  beforeEach(() => {
    cy.loginAsDoctor()
  })

  it('opens the P0 dental routes without auth/setup regressions or horizontal overflow', () => {
    coreRoutes.forEach((route) => {
      cy.visit(route.path)
      cy.assertAppShell()
      cy.location('pathname', { timeout: 30000 }).should('eq', route.expectedPath || route.path)
      cy.get('main', { timeout: 30000 }).should('be.visible')
      cy.get('main').contains(route.label, { timeout: 30000 }).should('be.visible')
      cy.contains(/Application error|Internal Server Error|Unhandled Runtime Error|Something went wrong/i)
        .should('not.exist')
      cy.assertNoHorizontalScroll()
    })
  })
})
