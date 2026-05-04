type QaClinic = {
  key: string
  name: string
  slug: string
}

type RouteExpectation = {
  path: string
  en: RegExp
  es: RegExp
}

function selectQaClinicA(): Cypress.Chainable<QaClinic> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
    const clinic = dataset.clinics.find((row: QaClinic) => row.key === 'clinicA')
    expect(clinic, 'clinic A definition').to.exist

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const stageClinic = (clinicsResponse.body.data || []).find((row: QaClinic) => row.name === clinic.name)
      expect(stageClinic, 'clinic A in stage').to.exist

      return cy.request('POST', '/api/clinics', { clinicId: stageClinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)
        return clinic
      })
    })
  })
}

function assertNoVisibleI18nKeys() {
  cy.document().then((doc) => {
    const text = doc.body.innerText
    const leakedKeys = text.match(
      /\b(?:actions|auth|booking|common|dashboard|form|marketing|navigation|patients|reports|settings|treatments)\.[a-zA-Z0-9_.-]+\b/g
    ) || []

    expect(leakedKeys.slice(0, 10), 'visible raw i18n keys').to.deep.eq([])
    expect(text, 'fatal UI text').not.to.match(
      /Application error|Unhandled Runtime Error|Hydration failed|This page could not be found|404:|500:/i
    )
  })
}

function assertTranslatedRoute(expectation: RouteExpectation, locale: 'en' | 'es') {
  const expectedText = locale === 'en' ? expectation.en : expectation.es

  cy.switchLanguage(locale)
  cy.get('html', { timeout: 30000 }).should('have.attr', 'lang', locale)
  cy.contains(expectedText, { timeout: 30000 }).should('be.visible')
  cy.assertNotInSetupFlow()
  cy.assertNoHorizontalScroll()
  assertNoVisibleI18nKeys()
}

const privateRoutes: RouteExpectation[] = [
  { path: '/', en: /Dashboard|Overview/i, es: /Dashboard|Resumen/i },
  { path: '/patients', en: /Patients/i, es: /Pacientes/i },
  { path: '/treatments', en: /Treatments/i, es: /Tratamientos/i },
  { path: '/services', en: /Services/i, es: /Servicios/i },
  { path: '/reports', en: /Reports|Profitability|Marketing/i, es: /Reportes|Rentabilidad|Marketing/i },
  { path: '/settings/notifications', en: /Notifications|SMS|WhatsApp/i, es: /Notificaciones|SMS|WhatsApp/i },
]

describe('Stage i18n language and layout coverage', () => {
  it('keeps core private routes translated and out of setup while switching EN/ES', () => {
    cy.viewport(1366, 768)
    cy.loginAsDoctor()
    selectQaClinicA()

    for (const route of privateRoutes) {
      cy.visit(route.path)
      cy.location('pathname', { timeout: 30000 }).should('eq', route.path)
      cy.assertNotInSetupFlow()

      assertTranslatedRoute(route, 'en')
      assertTranslatedRoute(route, 'es')
    }
  })

  it('keeps mobile private routes translated without horizontal overflow', () => {
    cy.viewport(390, 844)
    cy.loginAsDoctor()
    selectQaClinicA()

    for (const route of privateRoutes.slice(1, 4)) {
      cy.visit(route.path)
      cy.location('pathname', { timeout: 30000 }).should('eq', route.path)

      assertTranslatedRoute(route, 'en')
      assertTranslatedRoute(route, 'es')
    }
  })

  it('keeps public booking translated in EN/ES without auth state', () => {
    cy.viewport(390, 844)

    cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
      const clinic = dataset.clinics.find((row: QaClinic) => row.key === 'clinicA')
      expect(clinic, 'clinic A definition').to.exist

      cy.setCookie('locale', 'en')
      cy.visit(`/book/${clinic.slug}`, {
        onBeforeLoad(win) {
          win.localStorage.setItem('preferred-locale', 'en')
        },
      })
      cy.get('html', { timeout: 30000 }).should('have.attr', 'lang', 'en')
      cy.contains(/Select a service/i, { timeout: 30000 }).should('be.visible')
      cy.assertNoHorizontalScroll()
      assertNoVisibleI18nKeys()

      cy.setCookie('locale', 'es')
      cy.visit(`/book/${clinic.slug}`, {
        onBeforeLoad(win) {
          win.localStorage.setItem('preferred-locale', 'es')
        },
      })
      cy.get('html', { timeout: 30000 }).should('have.attr', 'lang', 'es')
      cy.contains(/Selecciona un servicio/i, { timeout: 30000 }).should('be.visible')
      cy.assertNoHorizontalScroll()
      assertNoVisibleI18nKeys()
    })
  })
})
