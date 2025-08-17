/**
 * Comandos personalizados de Cypress para testing de Laralis
 */
/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Comando personalizado para login
       */
      login(email: string, password: string): Chainable<void>
      
      /**
       * Comando para crear un workspace de test
       */
      createTestWorkspace(name: string, clinicName: string): Chainable<void>
      
      /**
       * Comando para cambiar de clínica
       */
      switchClinic(clinicName: string): Chainable<void>
      
      /**
       * Comando para verificar aislamiento de datos
       */
      verifyDataIsolation(): Chainable<void>
      
      /**
       * Comando para crear datos de prueba
       */
      seedTestData(clinicId: string): Chainable<void>
      
      /**
       * Comando para seleccionar clínica
       */
      selectClinic(clinicName: string): Chainable<void>
      
      /**
       * Comando para llenar formulario de paciente
       */
      fillPatientForm(patient: any): Chainable<void>
      
      /**
       * Comando para llenar formulario de insumo
       */
      fillSupplyForm(supply: any): Chainable<void>
      
      /**
       * Comando para llenar formulario de servicio
       */
      fillServiceForm(service: any): Chainable<void>
    }
  }
}

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/auth/login');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
  cy.get('button[type="submit"]').click();
  
  // Esperar a que se complete el login
  cy.url().should('not.include', '/auth/login');
  // Verificar que cargó alguna página autenticada
  cy.get('body').should('be.visible');
});

Cypress.Commands.add('createTestWorkspace', (name: string, clinicName: string) => {
  cy.visit('/onboarding');
  cy.get('[data-testid="workspace-name"]').type(name);
  cy.get('[data-testid="workspace-slug"]').type(name.toLowerCase().replace(/\s+/g, '-'));
  cy.get('[data-testid="clinic-name"]').type(clinicName);
  cy.get('[data-testid="clinic-address"]').type('Dirección de prueba 123');
  cy.get('[data-testid="create-workspace-button"]').click();
  
  // Verificar que se creó correctamente
  cy.url().should('not.include', '/onboarding');
});

Cypress.Commands.add('switchClinic', (clinicName: string) => {
  cy.get('[data-testid="clinic-switcher"]').click();
  cy.get(`[data-testid="clinic-option-${clinicName}"]`).click();
  
  // Verificar que cambió
  cy.get('[data-testid="current-clinic-name"]').should('contain', clinicName);
});

Cypress.Commands.add('verifyDataIsolation', () => {
  // Verificar que solo se muestran datos de la clínica actual
  cy.get('[data-testid="data-table"]').within(() => {
    cy.get('[data-testid="data-row"]').each(($row) => {
      // Cada fila debe tener el indicador de clínica correcto
      cy.wrap($row).should('have.attr', 'data-clinic-id');
    });
  });
});

Cypress.Commands.add('seedTestData', (clinicId: string) => {
  // Crear datos de prueba a través de la API
  const testData = {
    patients: [
      { first_name: 'Juan', last_name: 'Pérez', email: 'juan@test.com' },
      { first_name: 'María', last_name: 'García', email: 'maria@test.com' }
    ],
    services: [
      { name: 'Limpieza Dental', duration_minutes: 30 },
      { name: 'Endodoncia', duration_minutes: 90 }
    ],
    supplies: [
      { name: 'Pasta Profiláctica', price_cents: 5000 },
      { name: 'Guantes', price_cents: 2500 }
    ]
  };
  
  // Crear pacientes
  testData.patients.forEach(patient => {
    cy.request('POST', '/api/patients', { ...patient, clinic_id: clinicId });
  });
  
  // Crear servicios
  testData.services.forEach(service => {
    cy.request('POST', '/api/services', { ...service, clinic_id: clinicId });
  });
  
  // Crear insumos
  testData.supplies.forEach(supply => {
    cy.request('POST', '/api/supplies', { ...supply, clinic_id: clinicId });
  });
});

// Comando para seleccionar clínica
Cypress.Commands.add('selectClinic', (clinicName: string) => {
  cy.get('[data-cy="clinic-selector"]').click();
  cy.contains(clinicName).click();
  // Esperar a que el contexto de clínica se actualice
  cy.wait(500);
});

// Comando para llenar formulario de paciente
Cypress.Commands.add('fillPatientForm', (patient) => {
  cy.get('input[name="first_name"]').type(patient.first_name);
  cy.get('input[name="last_name"]').type(patient.last_name);
  if (patient.email) {
    cy.get('input[name="email"]').type(patient.email);
  }
  if (patient.phone) {
    cy.get('input[name="phone"]').type(patient.phone);
  }
});

// Comando para llenar formulario de insumo
Cypress.Commands.add('fillSupplyForm', (supply) => {
  cy.get('input[name="name"]').type(supply.name);
  cy.get('input[name="unit"]').type(supply.unit);
  cy.get('input[name="quantity_per_unit"]').type(supply.quantity_per_unit.toString());
  cy.get('input[name="cost_per_unit_cents"]').type(supply.cost_per_unit_cents.toString());
});

// Comando para llenar formulario de servicio
Cypress.Commands.add('fillServiceForm', (service) => {
  cy.get('input[name="name"]').type(service.name);
  cy.get('input[name="duration_minutes"]').type(service.duration_minutes.toString());
  cy.get('input[name="margin_percentage"]').type(service.margin_percentage.toString());
});

export {};
