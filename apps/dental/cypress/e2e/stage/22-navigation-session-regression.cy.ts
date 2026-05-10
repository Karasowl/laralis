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

function loadSeedClinic(key: 'clinicA' | 'clinicB'): Cypress.Chainable<Clinic> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
    const clinicName = dataset.clinics.find((clinic) => clinic.key === key)?.name
    expect(clinicName, `${key} name`).to.be.a('string')

    return cy.request('/api/clinics').then((response) => {
      expect(response.status).to.eq(200)
      const clinic = (response.body.data || []).find((item: Clinic) => item.name === clinicName)
      expect(clinic, `${key} seeded clinic`).to.exist
      return clinic
    })
  })
}

function selectClinic(clinicId: string) {
  return cy.request('POST', '/api/clinics', { clinicId }).then((response) => {
    expect(response.status, `select clinic ${clinicId}`).to.eq(200)
  })
}

function assertProtectedShell(path: string, expectedText: RegExp) {
  cy.visit(path, { failOnStatusCode: false })
  cy.location('pathname', { timeout: 30000 }).should('not.match', /^\/(?:auth|onboarding|setup)/)
  cy.assertAppShell()
  cy.contains(expectedText, { timeout: 30000 }).should('be.visible')
  cy.assertNoHorizontalScroll()
}

function assertNoSetupRoute() {
  cy.location('pathname', { timeout: 30000 }).should('not.match', /^\/(?:onboarding|setup)/)
}

function assertActiveClinicIsEmpty() {
  cy.request('/api/patients').then((patientsResponse) => {
    expect(patientsResponse.status).to.eq(200)
    expect(patientsResponse.body.data || [], 'active clinic patients').to.have.length(0)
  })

  cy.request('/api/treatments').then((treatmentsResponse) => {
    expect(treatmentsResponse.status).to.eq(200)
    expect(treatmentsResponse.body.data || [], 'active clinic treatments').to.have.length(0)
  })
}

describe('Stage navigation and session regressions', () => {
  beforeEach(() => {
    cy.loginAsDoctor()
  })

  it('redirects active accounts away from onboarding', () => {
    cy.visit('/onboarding', { failOnStatusCode: false })
    cy.location('pathname', { timeout: 30000 }).should('not.eq', '/onboarding')
    cy.assertNotInSetupFlow()
    cy.assertAppShell()
  })

  it('keeps the authenticated shell stable across reload, back, forward, and language changes', () => {
    cy.viewport(1280, 720)
    loadSeedClinic('clinicA').then((clinicA) => {
      selectClinic(clinicA.id)

      assertProtectedShell('/', /Dashboard|Panel|Ingresos|Revenue/i)
      cy.reload()
      cy.assertAppShell()
      cy.assertNoHorizontalScroll()

      assertProtectedShell('/patients', /Pacientes|Patients/i)
      assertProtectedShell('/treatments', /Tratamientos|Treatments/i)

      cy.go('back')
      cy.location('pathname', { timeout: 30000 }).should('eq', '/patients')
      cy.assertAppShell()
      cy.contains(/Pacientes|Patients/i, { timeout: 30000 }).should('be.visible')
      cy.assertNoHorizontalScroll()

      cy.go('forward')
      cy.location('pathname', { timeout: 30000 }).should('eq', '/treatments')
      cy.assertAppShell()
      cy.contains(/Tratamientos|Treatments/i, { timeout: 30000 }).should('be.visible')
      cy.assertNoHorizontalScroll()

      cy.switchLanguage('en')
      assertNoSetupRoute()
      cy.assertNoHorizontalScroll()

      cy.switchLanguage('es')
      assertNoSetupRoute()
      cy.assertNoHorizontalScroll()
    })
  })

  it('persists the selected empty clinic through refresh and browser history navigation', () => {
    cy.viewport(1280, 720)
    loadSeedClinic('clinicA').then((clinicA) => {
      loadSeedClinic('clinicB').then((clinicB) => {
        expect(clinicA.id, 'seed clinic ids').not.to.eq(clinicB.id)

        selectClinic(clinicB.id)
        assertProtectedShell('/patients', /Pacientes|Patients/i)
        assertActiveClinicIsEmpty()

        cy.reload()
        cy.assertAppShell()
        cy.assertNoHorizontalScroll()
        assertActiveClinicIsEmpty()

        assertProtectedShell('/treatments', /Tratamientos|Treatments/i)
        cy.go('back')
        cy.location('pathname', { timeout: 30000 }).should('eq', '/patients')
        cy.assertAppShell()
        assertActiveClinicIsEmpty()

        selectClinic(clinicA.id)
      })
    })
  })

  it('sends expired protected sessions to login instead of onboarding or setup', () => {
    assertProtectedShell('/patients', /Pacientes|Patients/i)

    cy.clearCookies()
    cy.visit('/patients', { failOnStatusCode: false })
    cy.location('pathname', { timeout: 30000 }).should('eq', '/auth/login')
    assertNoSetupRoute()
    cy.contains(/Laralis|Login|Iniciar|Sign in|Correo|Email/i, { timeout: 30000 }).should('be.visible')

    cy.loginAsDoctor()
    assertProtectedShell('/patients', /Pacientes|Patients/i)
  })
})
