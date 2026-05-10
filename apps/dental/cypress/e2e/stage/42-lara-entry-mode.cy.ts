export {}

type QaDataset = {
  clinics: Array<{
    key: string
    name: string
  }>
  users: Array<{
    key: string
    email: string
  }>
}

type Clinic = {
  id: string
  name: string
}

type Patient = {
  id: string
  first_name: string
  last_name: string
}

function readDataset(): Cypress.Chainable<QaDataset> {
  return cy.readFile('../../docs/qa/dataset.json')
}

function qaUserEmail(key: string): Cypress.Chainable<string> {
  return readDataset().then((dataset) => {
    const user = dataset.users.find((item) => item.key === key)
    expect(user, `QA user ${key}`).to.exist
    return user!.email
  })
}

function selectQaClinic(key = 'clinicA'): Cypress.Chainable<Clinic> {
  return readDataset().then((dataset) => {
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

function cleanupPatientsBySearch(search: string) {
  cy.loginAsDoctor()
  selectQaClinic('clinicA').then(() => {
    cy.request(`/api/patients?search=${encodeURIComponent(search)}`).then((response) => {
      expect(response.status).to.eq(200)
      const patients = (response.body.data || []) as Patient[]
      cy.wrap(patients).each((patient) => {
        cy.request({
          method: 'DELETE',
          url: `/api/patients/${patient.id}`,
          failOnStatusCode: false,
        })
      })
    })
  })
}

function entryBody(clinicId: string, currentField = 'first_name', userInput = 'QA Direct') {
  return {
    userInput,
    mode: 'entry',
    clinicId,
    context: {
      entityType: 'patient',
      currentField,
      collectedData: {},
      locale: 'es',
    },
  }
}

function submitEntryValue(value: string) {
  cy.get('[data-testid="lara-entry-input"]').should('be.enabled').clear().type(value)
  cy.get('[data-testid="lara-entry-submit"]').should('be.enabled').click()
  cy.wait('@laraEntryChat').its('response.statusCode').should('eq', 200)
}

describe('Stage Lara entry mode', () => {
  let cleanupSearch = ''

  beforeEach(() => {
    cy.viewport(1280, 720)
  })

  afterEach(() => {
    if (cleanupSearch) {
      cleanupPatientsBySearch(cleanupSearch)
      cleanupSearch = ''
    }
  })

  it('protects the entry chat API with Lara entry permissions and stage-only mock mode', () => {
    qaUserEmail('viewer').then((viewerEmail) => {
      cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
      selectQaClinic('clinicA').then((clinic) => {
        cy.request({
          method: 'POST',
          url: '/api/ai/chat',
          headers: { 'x-laralis-qa-ai': 'mock' },
          body: entryBody(clinic.id),
          failOnStatusCode: false,
        }).then((viewerResponse) => {
          expect(viewerResponse.status).to.eq(403)
          expect(viewerResponse.body.message).to.contain('lara.use_entry_mode')
        })
      })
    })

    qaUserEmail('assistant').then((assistantEmail) => {
      cy.loginAsStageUser(assistantEmail, undefined, { allowSetup: true })
      selectQaClinic('clinicA').then((clinic) => {
        cy.request({
          method: 'POST',
          url: '/api/ai/chat',
          headers: { 'x-laralis-qa-ai': 'mock' },
          body: entryBody(clinic.id, 'first_name', 'QA Direct'),
        }).then((assistantResponse) => {
          expect(assistantResponse.status).to.eq(200)
          expect(assistantResponse.body.provider).to.eq('qa-mock')
          expect(assistantResponse.body.extracted_value).to.eq('QA Direct')
          expect(assistantResponse.body.is_valid).to.eq(true)
        })
      })
    })
  })

  it('creates a patient through the Lara entry UI without leaking provider calls', () => {
    const stamp = `QAEntry${Date.now()}`
    const firstName = stamp
    const lastName = 'Lara'
    cleanupSearch = firstName

    cleanupPatientsBySearch(firstName)

    qaUserEmail('assistant').then((assistantEmail) => {
      cy.loginAsStageUser(assistantEmail, undefined, { allowSetup: true })
      selectQaClinic('clinicA')
    })

    cy.visit('/')
    cy.assertNotInSetupFlow()

    cy.intercept('POST', '/api/ai/chat', (req) => {
      req.headers['x-laralis-qa-ai'] = 'mock'
      req.continue()
    }).as('laraEntryChat')
    cy.intercept('POST', '/api/patients').as('createPatient')

    cy.get('[data-testid="lara-fab"]', { timeout: 30000 }).should('be.visible').click()
    cy.get('[data-testid="lara-entry-mode"]', { timeout: 30000 }).should('be.visible').click()
    cy.get('[data-testid="lara-entry-assistant"]', { timeout: 30000 }).should('be.visible')
    cy.get('[data-testid="lara-entry-entity-selector"]').should('exist')
    cy.get('[data-testid="lara-entry-entity-patient"]').should('be.visible').click()

    cy.get('[data-testid="lara-entry-flow"]').should('exist')
    cy.get('[data-testid="lara-entry-current-field"]').should('contain.text', 'first name')
    submitEntryValue(firstName)

    cy.get('[data-testid="lara-entry-current-field"]', { timeout: 30000 }).should('contain.text', 'last name')
    submitEntryValue(lastName)

    cy.get('[data-testid="lara-entry-current-field"]').should('contain.text', 'phone')
    Cypress._.times(6, () => {
      cy.get('[data-testid="lara-entry-skip-field"]').should('be.enabled').click()
    })

    cy.get('[data-testid="lara-entry-preview-panel"]', { timeout: 30000 }).should('be.visible')
    cy.get('[data-testid="lara-entry-preview-panel"]').should('contain.text', firstName)
    cy.get('[data-testid="lara-entry-preview-panel"]').should('contain.text', lastName)
    cy.get('[data-testid="lara-entry-save"]').should('be.enabled').click()

    cy.wait('@createPatient').then((interception) => {
      expect(interception.response?.statusCode).to.eq(200)
    })
    cy.get('[data-testid="lara-entry-success"]', { timeout: 30000 }).should('be.visible')

    cy.request(`/api/patients?search=${encodeURIComponent(firstName)}`).then((response) => {
      expect(response.status).to.eq(200)
      const patients = (response.body.data || []) as Patient[]
      expect(patients.some((patient) => patient.first_name === firstName && patient.last_name === lastName)).to.eq(true)
    })
  })
})
