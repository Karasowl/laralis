export {}

type Clinic = {
  id: string
  name: string
}

type QaDataset = {
  clinics: Array<{
    key: string
    name: string
  }>
}

function selectQaClinic(key = 'clinicA'): Cypress.Chainable<Clinic> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
    const clinicName = dataset.clinics.find((clinic) => clinic.key === key)?.name

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = (clinicsResponse.body.data || []).find((item: Clinic) => item.name === clinicName)
      expect(clinic, `QA ${key}`).to.exist

      return cy.request('POST', '/api/clinics', { clinicId: clinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)
        return clinic as Clinic
      })
    })
  })
}

function setTheme(theme: 'dark' | 'light') {
  cy.window().then((win) => {
    win.localStorage.setItem('laralis-theme', theme)
  })
}

function openDashboardTab(label: RegExp) {
  cy.visit('/', { failOnStatusCode: false })
  cy.location('pathname', { timeout: 30000 }).should('eq', '/')
  cy.assertNotInSetupFlow()
  cy.contains('button[role="tab"]', label, { timeout: 30000 })
    .should('be.visible')
    .click()
}

function assertThemeApplied(theme: 'dark' | 'light') {
  cy.get('html', { timeout: 30000 }).should(theme === 'dark' ? 'have.class' : 'not.have.class', 'dark')
}

function assertNoFatalText(label: string) {
  cy.get('body', { timeout: 30000 }).should(($body) => {
    expect($body.text(), `${label} fatal UI text`).not.to.match(
      /Application error|Unhandled Runtime Error|Hydration failed|This page could not be found|404:|500:/i
    )
  })
}

function assertChartPrimitives(testId: string, minPrimitiveCount = 2) {
  cy.get(`[data-testid="${testId}"]`, { timeout: 30000 }).scrollIntoView()
  cy.get(`[data-testid="${testId}"] .recharts-wrapper`, { timeout: 30000 })
    .should('be.visible')
    .then(($wrapper) => {
      const rect = $wrapper[0].getBoundingClientRect()
      expect(rect.width, `${testId} width`).to.be.greaterThan(220)
      expect(rect.height, `${testId} height`).to.be.greaterThan(140)
    })

  cy.get(
    `[data-testid="${testId}"] .recharts-surface path, ` +
      `[data-testid="${testId}"] .recharts-surface rect, ` +
      `[data-testid="${testId}"] .recharts-surface line, ` +
      `[data-testid="${testId}"] .recharts-surface circle, ` +
      `[data-testid="${testId}"] .recharts-surface polygon`,
    { timeout: 30000 }
  ).should('have.length.greaterThan', minPrimitiveCount)
}

function triggerTooltip(chartTestId: string) {
  cy.get(`[data-testid="${chartTestId}"] .recharts-wrapper`, { timeout: 30000 }).then(($wrapper) => {
    const rect = $wrapper[0].getBoundingClientRect()

    cy.wrap($wrapper)
      .trigger('mouseenter', { force: true })
      .trigger('mousemove', {
        clientX: rect.left + rect.width * 0.65,
        clientY: rect.top + rect.height * 0.45,
        force: true,
      })
  })
}

describe('Stage chart tooltips and dark mode coverage', () => {
  beforeEach(() => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA')
  })

  for (const theme of ['light', 'dark'] as const) {
    it(`renders overview revenue chart primitives and tooltip in ${theme} mode`, () => {
      cy.viewport(1440, 900)
      setTheme(theme)
      openDashboardTab(/Resumen|Overview/i)
      assertThemeApplied(theme)
      assertNoFatalText(`overview ${theme}`)
      assertChartPrimitives('revenue-chart', 4)

      triggerTooltip('revenue-chart')
      cy.get('[data-testid="revenue-chart-tooltip"]', { timeout: 30000 })
        .should('be.visible')
        .and('contain.text', '$')
      cy.contains('[data-testid="revenue-chart-tooltip"]', /Ingresos|Revenue|Gastos|Expenses/i).should('be.visible')
      cy.assertNoHorizontalScroll()
    })

    it(`renders marketing ROI and CAC chart tooltips with Meta Mayo values in ${theme} mode`, () => {
      cy.viewport(1440, 900)
      setTheme(theme)
      openDashboardTab(/Marketing|Mercadotecnia/i)
      assertThemeApplied(theme)
      assertNoFatalText(`marketing ${theme}`)
      cy.contains(/Meta Mayo/i, { timeout: 30000 }).should('be.visible')

      assertChartPrimitives('channel-roi-chart', 4)
      triggerTooltip('channel-roi-chart')
      cy.get('[data-testid="channel-roi-tooltip"]', { timeout: 30000 })
        .should('be.visible')
        .and('contain.text', 'ROI')
      cy.contains('[data-testid="channel-roi-tooltip"]', /patients|pacientes|spent|gastado|revenue|ingresos/i)
        .should('be.visible')

      assertChartPrimitives('cac-trend-chart', 4)
      triggerTooltip('cac-trend-chart')
      cy.get('[data-testid="cac-trend-tooltip"]', { timeout: 30000 })
        .should('be.visible')
        .and('contain.text', 'CAC')
      cy.assertNoHorizontalScroll()
    })
  }
})
