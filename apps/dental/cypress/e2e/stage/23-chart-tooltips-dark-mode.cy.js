function selectQaClinicA() {
  cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
    const clinicName = dataset.clinics.find((clinic) => clinic.key === 'clinicA')?.name

    cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = (clinicsResponse.body.data || []).find((item) => item.name === clinicName)
      expect(clinic).to.exist
      cy.request('POST', '/api/clinics', { clinicId: clinic.id }).its('status').should('eq', 200)
    })
  })
}

function visitDashboardWithTheme(theme) {
  cy.visit('/', {
    failOnStatusCode: false,
    onBeforeLoad(win) {
      win.localStorage.setItem('laralis-theme', theme)
    },
  })
}

function assertChartDimensions(testId) {
  cy.get(`[data-testid="${testId}"]`, { timeout: 15000 }).scrollIntoView()
  cy.get(`[data-testid="${testId}"] .recharts-wrapper`, { timeout: 15000 })
    .should('be.visible')
    .then(($wrapper) => {
      const rect = $wrapper[0].getBoundingClientRect()
      expect(rect.width, `${testId} width`).to.be.greaterThan(220)
      expect(rect.height, `${testId} height`).to.be.greaterThan(140)
    })
}

function assertChartPrimitives(testId, minCount) {
  cy.get(
    `[data-testid="${testId}"] .recharts-surface path, ` +
      `[data-testid="${testId}"] .recharts-surface rect, ` +
      `[data-testid="${testId}"] .recharts-surface line, ` +
      `[data-testid="${testId}"] .recharts-surface circle, ` +
      `[data-testid="${testId}"] .recharts-surface polygon`,
    { timeout: 15000 }
  ).should('have.length.greaterThan', minCount)
}

function hoverChart(testId) {
  cy.get(`[data-testid="${testId}"] .recharts-surface`, { timeout: 15000 }).then(($surface) => {
    const rect = $surface[0].getBoundingClientRect()
    cy.wrap($surface).trigger('mousemove', {
      clientX: rect.left + rect.width * 0.65,
      clientY: rect.top + rect.height * 0.45,
      force: true,
    })
  })
}

describe('Stage chart tooltips and dark mode coverage', () => {
  it('renders overview revenue chart primitives and tooltip in light mode', () => {
    cy.viewport(1440, 900)
    cy.loginAsDoctor()
    selectQaClinicA()

    visitDashboardWithTheme('light')
    cy.get('html', { timeout: 15000 }).should('not.have.class', 'dark')
    cy.location('pathname', { timeout: 15000 }).should('eq', '/')
    cy.assertNotInSetupFlow()
    cy.contains('button[role="tab"]', /Resumen|Overview/i, { timeout: 15000 }).click()

    assertChartDimensions('revenue-chart')
    assertChartPrimitives('revenue-chart', 4)
    hoverChart('revenue-chart')

    cy.get('[data-testid="revenue-chart-tooltip"]', { timeout: 15000 })
      .should('be.visible')
      .and('contain.text', '$')
    cy.contains('[data-testid="revenue-chart-tooltip"]', /Ingresos|Revenue|Gastos|Expenses/i).should('be.visible')
    cy.assertNoHorizontalScroll()
  })

  it('renders marketing ROI and CAC chart tooltips with Meta Mayo values in dark mode', () => {
    cy.viewport(1440, 900)
    cy.loginAsDoctor()
    selectQaClinicA()

    visitDashboardWithTheme('dark')
    cy.get('html', { timeout: 15000 }).should('have.class', 'dark')
    cy.location('pathname', { timeout: 15000 }).should('eq', '/')
    cy.assertNotInSetupFlow()
    cy.contains('button[role="tab"]', /Marketing|Mercadotecnia/i, { timeout: 15000 }).click()
    cy.contains(/Meta Mayo/i, { timeout: 15000 }).should('be.visible')

    assertChartDimensions('channel-roi-chart')
    assertChartPrimitives('channel-roi-chart', 4)
    hoverChart('channel-roi-chart')
    cy.get('[data-testid="channel-roi-tooltip"]', { timeout: 15000 })
      .should('be.visible')
      .and('contain.text', 'ROI')
    cy.contains('[data-testid="channel-roi-tooltip"]', /patients|pacientes|spent|gastado|revenue|ingresos/i)
      .should('be.visible')

    assertChartDimensions('cac-trend-chart')
    assertChartPrimitives('cac-trend-chart', 4)
    hoverChart('cac-trend-chart')
    cy.get('[data-testid="cac-trend-tooltip"]', { timeout: 15000 })
      .should('be.visible')
      .and('contain.text', 'CAC')
    cy.assertNoHorizontalScroll()
  })
})
