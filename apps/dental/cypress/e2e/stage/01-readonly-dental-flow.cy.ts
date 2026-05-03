describe('Stage read-only dental workflow from demo video', () => {
  beforeEach(() => {
    cy.loginAsDoctor()
  })

  it('loads patients, filters, and the create patient source fields without saving', () => {
    cy.visit('/patients')
    cy.location('pathname', { timeout: 30000 }).should('include', '/patients')
    cy.assertAppShell()
    cy.get('main').contains(/Pacientes|Patients/i, { timeout: 30000 }).should('be.visible')
    cy.get('main').contains(/Agregar paciente|Add Patient/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/Edad|Age|Deuda|Debt|Sexo|Gender|Origen|Source/i, { timeout: 30000 }).should('exist')
    cy.contains(/No hay datos disponibles|No data available/i).should('not.exist')

    cy.get('main').contains('button', /Agregar paciente|Add Patient/i).click()
    cy.contains(/Crear Paciente|Create Patient|Nuevo paciente|New Patient/i, { timeout: 30000 })
      .should('be.visible')
    cy.contains(/Origen|Source|Campaña|Campaign|Referencia|Referral/i, { timeout: 30000 })
      .should('be.visible')
    cy.contains('button', /Cancelar|Cancel/i).click()
    cy.location('pathname').should('include', '/patients')
  })

  it('loads marketing platforms and campaigns used for patient attribution', () => {
    cy.visit('/marketing')
    cy.assertAppShell()
    cy.contains(/Marketing/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/Plataformas|Platforms/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/Campañas|Campaigns/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/Meta Ads|Google Ads|Instagram|Facebook|Campaña|Campaign/i, { timeout: 30000 })
      .should('be.visible')
    cy.contains(/No hay campañas|No campaigns/i).should('not.exist')
  })

  it('loads treatments and can navigate back to patients without losing clinic context', () => {
    cy.visit('/treatments')
    cy.assertAppShell()
    cy.contains(/Tratamientos|Treatments/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/Agregar tratamiento|Add Treatment/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/Total|Ingresos|Revenue|Completados|Completed|Margen|Margin/i, { timeout: 30000 })
      .should('be.visible')

    cy.visit('/patients')
    cy.assertAppShell()
    cy.contains(/Pacientes|Patients/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/PoDent|Lara/i).should('exist')
  })
})
