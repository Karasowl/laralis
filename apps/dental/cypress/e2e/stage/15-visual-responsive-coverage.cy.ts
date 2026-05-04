export {}

type QaDataset = {
  clinics: Array<{
    key: string
    name: string
    slug: string
  }>
}

type PageCase = {
  label: string
  path: string
  expected: RegExp
}

const desktopPages: PageCase[] = [
  { label: 'dashboard', path: '/', expected: /Dashboard|Panel|Ingresos|Revenue/i },
  { label: 'patients', path: '/patients', expected: /Pacientes|Patients/i },
  { label: 'treatments', path: '/treatments', expected: /Tratamientos|Treatments/i },
  { label: 'services', path: '/services', expected: /Servicios|Services/i },
  { label: 'supplies', path: '/supplies', expected: /Insumos|Supplies/i },
  { label: 'expenses', path: '/expenses', expected: /Gastos|Expenses/i },
  { label: 'fixed costs', path: '/fixed-costs', expected: /Costos fijos|Fixed costs/i },
  { label: 'assets', path: '/assets', expected: /Activos|Assets/i },
  { label: 'time', path: '/time', expected: /Tiempo|Time/i },
  { label: 'marketing', path: '/marketing', expected: /Marketing|Campanas|Campaigns/i },
  { label: 'team settings', path: '/settings/team', expected: /Equipo|Team|Miembros|Members/i },
  { label: 'notifications', path: '/settings/notifications', expected: /Notificaciones|Notifications/i },
  { label: 'booking settings', path: '/settings/booking', expected: /Reservas|Booking|Citas|Appointments/i },
]

const responsivePages: PageCase[] = [
  desktopPages[0],
  desktopPages[1],
  desktopPages[2],
  desktopPages[3],
  desktopPages[5],
  desktopPages[9],
  desktopPages[10],
]

function selectQaClinic(key = 'clinicA'): Cypress.Chainable<void> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
    const clinicName = dataset.clinics.find((clinic) => clinic.key === key)?.name

    cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = (clinicsResponse.body.data || []).find((item: { name: string }) => item.name === clinicName)
      expect(clinic, `QA ${key}`).to.exist

      cy.request('POST', '/api/clinics', { clinicId: clinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)
      })
    })
  })
}

function setTheme(theme: 'dark' | 'light') {
  cy.window().then((win) => {
    win.localStorage.setItem('laralis-theme', theme)
  })
}

function visiblePageText($body: JQuery<HTMLElement>) {
  const clone = $body[0].cloneNode(true) as HTMLElement
  clone.querySelectorAll('script, style, noscript, template').forEach((element) => element.remove())
  return clone.innerText || clone.textContent || ''
}

function assertVisualHealth(page: PageCase) {
  cy.visit(page.path, { failOnStatusCode: false })
  cy.location('pathname', { timeout: 30000 }).should('not.match', /^\/(?:auth|onboarding|setup)/)
  cy.assertNotInSetupFlow()

  cy.get('body', { timeout: 30000 }).should(($body) => {
    expect(visiblePageText($body), `${page.label} fatal UI text`).not.to.match(
      /Application error|Unhandled Runtime Error|Hydration failed|This page could not be found|404:|500:/i
    )
  })

  cy.get('[data-testid="app-main-content"], main', { timeout: 30000 })
    .first()
    .should('be.visible')
    .contains(page.expected, { timeout: 30000 })
    .should('be.visible')

  cy.get('[data-testid="app-main-content"], main', { timeout: 30000 })
    .first()
    .then(($main) => {
      const rect = $main[0].getBoundingClientRect()
      expect(rect.width, `${page.label} main width`).to.be.greaterThan(280)
      expect(rect.height, `${page.label} main height`).to.be.greaterThan(220)
      expect($main.text().trim().length, `${page.label} main text`).to.be.greaterThan(20)
    })

  cy.assertNoHorizontalScroll()
}

function assertCharts(label: string, minCharts: number) {
  cy.scrollTo('bottom', { ensureScrollable: false })
  cy.assertNotInSetupFlow()
  cy.assertNoHorizontalScroll()

  cy.get('.recharts-wrapper, svg.recharts-surface, canvas', { timeout: 30000 }).should(($charts) => {
    const visibleCharts = $charts.toArray().filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width >= 120 && rect.height >= 80
    })
    expect(visibleCharts.length, `${label} visible charts`).to.be.gte(minCharts)
  })

  cy.get('.recharts-wrapper, svg.recharts-surface')
    .first()
    .find('path, rect, line, circle, polygon')
    .should('have.length.greaterThan', 2)
}

function openDashboardTab(label: RegExp) {
  cy.visit('/', { failOnStatusCode: false })
  cy.contains('button[role="tab"]', label, { timeout: 30000 })
    .should('be.visible')
    .click()
}

describe('Stage visual responsive coverage', () => {
  beforeEach(() => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA')
  })

  it('renders critical product modules on desktop without crashes or horizontal overflow', () => {
    cy.viewport(1440, 900)
    setTheme('dark')

    desktopPages.forEach((page) => {
      assertVisualHealth(page)
    })
  })

  it('renders high-risk modules on tablet and mobile without horizontal overflow', () => {
    for (const viewport of [
      { label: 'tablet', width: 768, height: 1024 },
      { label: 'mobile', width: 390, height: 844 },
    ]) {
      cy.viewport(viewport.width, viewport.height)
      setTheme('dark')

      responsivePages.forEach((page) => {
        assertVisualHealth(page)
      })
    }
  })

  it('renders dashboard and marketing charts with real dimensions', () => {
    cy.viewport(1440, 900)
    setTheme('dark')
    openDashboardTab(/Resumen|Overview/i)
    assertCharts('dashboard overview', 1)

    openDashboardTab(/Marketing|Mercadotecnia/i)
    assertCharts('dashboard marketing', 1)
  })

  it('keeps theme and ES/EN language changes from breaking the active shell', () => {
    cy.viewport(390, 844)

    for (const theme of ['dark', 'light'] as const) {
      setTheme(theme)
      assertVisualHealth(desktopPages[0])
      assertVisualHealth(desktopPages[1])
    }

    cy.viewport(1440, 900)
    cy.visit('/')
    cy.switchLanguage('en')
    cy.assertNoHorizontalScroll()
    cy.contains(/Cancel setup|Cancelar configuraci.n|setup\/cancel/i).should('not.exist')

    cy.switchLanguage('es')
    cy.assertNoHorizontalScroll()
    cy.contains(/Cancel setup|Cancelar configuraci.n|setup\/cancel/i).should('not.exist')
  })

  it('keeps the public booking page usable on desktop and mobile', () => {
    cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
      const clinicSlug = dataset.clinics.find((clinic) => clinic.key === 'clinicA')?.slug
      expect(clinicSlug, 'QA clinic booking slug').to.be.a('string')

      cy.clearCookies()
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
      ]) {
        cy.viewport(viewport.width, viewport.height)
        cy.visit(`/book/${clinicSlug}`, { failOnStatusCode: false })
        cy.location('pathname', { timeout: 30000 }).should('include', `/book/${clinicSlug}`)
        cy.contains(/Reservar|Book|Cita|Appointment|Selecciona|Select/i, { timeout: 30000 }).should('be.visible')
        cy.assertNoHorizontalScroll()
      }
    })
  })
})
