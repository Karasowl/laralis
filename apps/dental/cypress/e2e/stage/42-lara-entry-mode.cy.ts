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

type ApiRecord = {
  id: string
  name?: string
  concept?: string
  vendor?: string
  description?: string
  category?: string
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

function responseRecords(body: unknown): ApiRecord[] {
  if (Array.isArray(body)) return body as ApiRecord[]
  if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: ApiRecord[] }).data
  }
  return []
}

function cleanupRecordsByQuery(
  endpoint: string,
  query: string,
  matches: (record: ApiRecord) => boolean
) {
  cy.loginAsDoctor()
  selectQaClinic('clinicA').then(() => {
    cy.request(`${endpoint}?${query}`).then((response) => {
      expect(response.status).to.eq(200)
      const records = responseRecords(response.body).filter(matches)

      cy.wrap(records).each((record) => {
        const item = record as ApiRecord
        cy.request({
          method: 'DELETE',
          url: `${endpoint}/${item.id}`,
          failOnStatusCode: false,
        })
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

function cleanupServicesBySearch(search: string) {
  cleanupRecordsByQuery(
    '/api/services',
    `search=${encodeURIComponent(search)}`,
    (record) => record.name === search
  )
}

function cleanupSuppliesBySearch(search: string) {
  cleanupRecordsByQuery(
    '/api/supplies',
    `search=${encodeURIComponent(search)}`,
    (record) => record.name === search
  )
}

function cleanupExpensesByVendor(vendor: string) {
  cleanupRecordsByQuery(
    '/api/expenses',
    `vendor=${encodeURIComponent(vendor)}`,
    (record) => record.vendor === vendor
  )
}

function cleanupAssetsBySearch(search: string) {
  cleanupRecordsByQuery(
    '/api/assets',
    `search=${encodeURIComponent(search)}`,
    (record) => record.name === search
  )
}

function cleanupFixedCostsByCategory(category: string, concept: string) {
  cleanupRecordsByQuery(
    '/api/fixed-costs',
    `category=${encodeURIComponent(category)}`,
    (record) => record.concept === concept
  )
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

function submitEntryField(expectedField: string, value: string) {
  cy.get('[data-testid="lara-entry-current-field"]', { timeout: 30000 }).should(
    'contain.text',
    expectedField
  )
  submitEntryValue(value)
}

function setupEntryIntercept() {
  cy.intercept('POST', '/api/ai/chat', (req) => {
    req.headers['x-laralis-qa-ai'] = 'mock'
    req.continue()
  }).as('laraEntryChat')
}

function loginOwnerAtQaClinic() {
  cy.loginAsDoctor()
  selectQaClinic('clinicA')
  cy.visit('/')
  cy.assertNotInSetupFlow()
}

function openEntryEntity(entityId: string) {
  cy.get('[data-testid="lara-fab"]', { timeout: 30000 }).should('be.visible').click()
  cy.get('[data-testid="lara-entry-mode"]', { timeout: 30000 }).should('be.visible').click()
  cy.get('[data-testid="lara-entry-assistant"]', { timeout: 30000 }).should('be.visible')
  cy.get('[data-testid="lara-entry-entity-selector"]').should('exist')
  cy.get(`[data-testid="lara-entry-entity-${entityId}"]`).should('be.visible').click()
  cy.get('[data-testid="lara-entry-flow"]').should('exist')
}

function saveEntry(alias: string, expectedStatus = 201) {
  cy.get('[data-testid="lara-entry-preview-panel"]', { timeout: 30000 }).should('be.visible')
  cy.get('[data-testid="lara-entry-save"]').should('be.enabled').click()
  cy.wait(alias).then((interception) => {
    expect(interception.response?.statusCode).to.eq(expectedStatus)
  })
  cy.get('[data-testid="lara-entry-success"]', { timeout: 30000 }).should('be.visible')
}

describe('Stage Lara entry mode', () => {
  let cleanupSearch = ''
  let cleanupServiceSearch = ''
  let cleanupSupplySearch = ''
  let cleanupExpenseVendor = ''
  let cleanupAssetSearch = ''
  let cleanupFixedCostCategory = ''
  let cleanupFixedCostConcept = ''

  beforeEach(() => {
    cy.viewport(1280, 720)
  })

  afterEach(() => {
    if (cleanupSearch) {
      cleanupPatientsBySearch(cleanupSearch)
      cleanupSearch = ''
    }
    if (cleanupServiceSearch) {
      cleanupServicesBySearch(cleanupServiceSearch)
      cleanupServiceSearch = ''
    }
    if (cleanupSupplySearch) {
      cleanupSuppliesBySearch(cleanupSupplySearch)
      cleanupSupplySearch = ''
    }
    if (cleanupExpenseVendor) {
      cleanupExpensesByVendor(cleanupExpenseVendor)
      cleanupExpenseVendor = ''
    }
    if (cleanupAssetSearch) {
      cleanupAssetsBySearch(cleanupAssetSearch)
      cleanupAssetSearch = ''
    }
    if (cleanupFixedCostCategory && cleanupFixedCostConcept) {
      cleanupFixedCostsByCategory(cleanupFixedCostCategory, cleanupFixedCostConcept)
      cleanupFixedCostCategory = ''
      cleanupFixedCostConcept = ''
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

    setupEntryIntercept()
    cy.intercept('POST', '/api/patients').as('createPatient')

    openEntryEntity('patient')
    submitEntryField('first name', firstName)
    submitEntryField('last name', lastName)
    cy.get('[data-testid="lara-entry-current-field"]', { timeout: 30000 }).should('contain.text', 'phone')
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

  it('creates a service through Lara entry with typed numeric extraction', () => {
    const name = `QAEntryService${Date.now()}`
    cleanupServiceSearch = name
    cleanupServicesBySearch(name)

    loginOwnerAtQaClinic()
    setupEntryIntercept()
    cy.intercept('POST', '/api/services').as('createService')

    openEntryEntity('service')
    submitEntryField('name', name)
    submitEntryField('category', 'preventivo')
    submitEntryField('description', 'Servicio QA creado por Lara')
    submitEntryField('est minutes', '45')
    submitEntryField('base price cents', '25')

    cy.get('[data-testid="lara-entry-preview-panel"]').should('contain.text', name)
    cy.get('[data-testid="lara-entry-preview-panel"]').should('contain.text', '2500')
    saveEntry('@createService')

    cy.request(`/api/services?search=${encodeURIComponent(name)}`).then((response) => {
      expect(response.status).to.eq(200)
      const services = responseRecords(response.body)
      expect(services.some((service) => service.name === name)).to.eq(true)
    })
  })

  it('creates a supply through Lara entry using the form-level peso field', () => {
    const name = `QAEntrySupply${Date.now()}`
    cleanupSupplySearch = name
    cleanupSuppliesBySearch(name)

    loginOwnerAtQaClinic()
    setupEntryIntercept()
    cy.intercept('POST', '/api/supplies').as('createSupply')

    openEntryEntity('supply')
    submitEntryField('name', name)
    submitEntryField('category', 'material')
    submitEntryField('presentation', 'Caja')
    submitEntryField('price pesos', '120')
    submitEntryField('portions', '12')

    cy.get('[data-testid="lara-entry-preview-panel"]').should('contain.text', name)
    cy.get('[data-testid="lara-entry-preview-panel"]').should('contain.text', '120')
    saveEntry('@createSupply')

    cy.request(`/api/supplies?search=${encodeURIComponent(name)}`).then((response) => {
      expect(response.status).to.eq(200)
      const supplies = responseRecords(response.body)
      expect(supplies.some((supply) => supply.name === name)).to.eq(true)
    })
  })

  it('creates an expense through Lara entry and persists the vendor/date context', () => {
    const vendor = `QAEntryVendor${Date.now()}`
    cleanupExpenseVendor = vendor
    cleanupExpensesByVendor(vendor)

    loginOwnerAtQaClinic()
    setupEntryIntercept()
    cy.intercept('POST', '/api/expenses').as('createExpense')

    openEntryEntity('expense')
    submitEntryField('expense date', '2026-05-10')
    submitEntryField('category', 'Insumos')
    submitEntryField('amount cents', '17')
    submitEntryField('description', 'Gasto QA creado por Lara')
    submitEntryField('vendor', vendor)

    cy.get('[data-testid="lara-entry-preview-panel"]').should('contain.text', vendor)
    cy.get('[data-testid="lara-entry-preview-panel"]').should('contain.text', '1700')
    saveEntry('@createExpense')

    cy.request(`/api/expenses?vendor=${encodeURIComponent(vendor)}`).then((response) => {
      expect(response.status).to.eq(200)
      const expenses = responseRecords(response.body)
      expect(expenses.some((expense) => expense.vendor === vendor)).to.eq(true)
    })
  })

  it('creates an asset through Lara entry using the form-level purchase peso field', () => {
    const name = `QAEntryAsset${Date.now()}`
    cleanupAssetSearch = name
    cleanupAssetsBySearch(name)

    loginOwnerAtQaClinic()
    setupEntryIntercept()
    cy.intercept('POST', '/api/assets').as('createAsset')

    openEntryEntity('asset')
    submitEntryField('name', name)
    submitEntryField('category', 'equipo')
    submitEntryField('purchase price pesos', '12000')
    submitEntryField('depreciation months', '60')
    submitEntryField('purchase date', '2026-05-10')

    cy.get('[data-testid="lara-entry-preview-panel"]').should('contain.text', name)
    cy.get('[data-testid="lara-entry-preview-panel"]').should('contain.text', '12000')
    saveEntry('@createAsset')

    cy.request(`/api/assets?search=${encodeURIComponent(name)}`).then((response) => {
      expect(response.status).to.eq(200)
      const assets = responseRecords(response.body)
      expect(assets.some((asset) => asset.name === name)).to.eq(true)
    })
  })

  it('creates a fixed cost through Lara entry and converts pesos before persistence', () => {
    const stamp = Date.now()
    const category = `qa-entry-${stamp}`
    const concept = `QAEntryFixedCost${stamp}`
    cleanupFixedCostCategory = category
    cleanupFixedCostConcept = concept
    cleanupFixedCostsByCategory(category, concept)

    loginOwnerAtQaClinic()
    setupEntryIntercept()
    cy.intercept('POST', '/api/fixed-costs').as('createFixedCost')

    openEntryEntity('fixedCost')
    submitEntryField('category', category)
    submitEntryField('concept', concept)
    submitEntryField('frequency', 'monthly')
    submitEntryField('amount pesos', '5000')

    cy.get('[data-testid="lara-entry-preview-panel"]').should('contain.text', concept)
    cy.get('[data-testid="lara-entry-preview-panel"]').should('contain.text', '5000')
    saveEntry('@createFixedCost')

    cy.request(`/api/fixed-costs?category=${encodeURIComponent(category)}`).then((response) => {
      expect(response.status).to.eq(200)
      const fixedCosts = responseRecords(response.body)
      expect(fixedCosts.some((fixedCost) => fixedCost.concept === concept)).to.eq(true)
    })
  })
})
