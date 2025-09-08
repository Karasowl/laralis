describe('Complete Integration Flow', () => {
  const testData = {
    workspace: {
      name: 'Clínica Dental Test',
      slug: 'clinica-dental-test'
    },
    clinic: {
      name: 'Sede Principal',
      address: 'Av. Reforma 123, CDMX',
      phone: '+52 555-123-4567',
      email: 'contacto@clinica-test.com'
    },
    patient: {
      first_name: 'María Elena',
      last_name: 'González Rodríguez',
      email: `maria.gonzalez.${Date.now()}@test.com`,
      phone: '+52 555-987-6543'
    },
    supply: {
      name: 'Pasta Profiláctica Premium',
      unit: 'tubo',
      quantity_per_unit: 1,
      cost_per_unit_cents: 15000
    },
    service: {
      name: 'Limpieza Dental Completa',
      duration_minutes: 45,
      margin_percentage: 65
    }
  };

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  describe('Complete Business Flow - New Clinic Setup', () => {
    it('should complete full onboarding and setup flow', () => {
      // 1. Authentication
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
      
      // 2. Onboarding (if needed)
      cy.url().then(url => {
        if (url.includes('onboarding')) {
          // Complete onboarding
          cy.get('input[name="name"]').first().type(testData.workspace.name);
          cy.get('input[name="slug"]').type(testData.workspace.slug);
          cy.contains('button', 'Siguiente').click();
          
          // Clinic setup
          cy.get('input[name="name"]').type(testData.clinic.name);
          cy.get('input[name="address"]').type(testData.clinic.address);
          cy.get('input[name="phone"]').type(testData.clinic.phone);
          cy.get('input[name="email"]').type(testData.clinic.email);
          
          cy.contains('button', 'Crear').click();
          cy.wait(2000);
        }
      });
      
      // 3. Initial Configuration
      cy.visit('/settings/time');
      cy.wait(1000);
      
      cy.get('input[name="work_days"]').clear().type('22');
      cy.get('input[name="hours_per_day"]').clear().type('8');
      cy.get('input[name="real_pct"]').clear().type('75');
      cy.contains('button', 'Guardar').click();
      cy.wait(1000);
      
      // 4. Add Fixed Costs
      cy.visit('/fixed-costs');
      cy.wait(1000);
      
      const fixedCosts = [
        { name: 'Renta mensual', amount: '2000000', category: 'rent' },
        { name: 'Servicios públicos', amount: '500000', category: 'utilities' }
      ];
      
      fixedCosts.forEach(cost => {
        cy.contains('button', 'Agregar').click();
        cy.wait(500);
        
        cy.get('input[name="name"]').type(cost.name);
        cy.get('input[name="amount_cents"]').type(cost.amount);
        cy.get('select[name="category"]').select(cost.category);
        
        cy.contains('button', 'Guardar').click();
        cy.wait(1000);
      });
      
      // 5. Add Supplies
      cy.visit('/supplies');
      cy.wait(1000);
      
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      cy.fillSupplyForm(testData.supply);
      cy.contains('button', 'Guardar').click();
      cy.wait(1000);
      
      // 6. Create Service
      cy.visit('/services');
      cy.wait(1000);
      
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      cy.fillServiceForm(testData.service);
      
      // Add supply to service
      cy.contains('button', 'Agregar insumo').click();
      cy.get('select[name="supply_id"]').select(0);
      cy.get('input[name="quantity"]').type('1');
      
      cy.contains('button', 'Guardar').click();
      cy.wait(1000);
      
      // 7. Add Patient
      cy.visit('/patients');
      cy.wait(1000);
      
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      cy.fillPatientForm(testData.patient);
      cy.contains('button', 'Guardar').click();
      cy.wait(1000);
      
      // 8. Create Treatment
      cy.visit('/treatments');
      cy.wait(1000);
      
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      cy.get('select[name="patient_id"]').select(0);
      cy.contains('button', 'Agregar servicio').click();
      cy.get('select[name="service_id"]').select(0);
      
      cy.contains('button', 'Crear tratamiento').click();
      cy.wait(1000);
      
      // 9. Verify Complete Setup
      cy.visit('/');
      cy.wait(1000);
      
      // Dashboard should show data
      cy.get('[data-cy="dashboard-stats"]').should('be.visible');
      cy.contains('1').should('be.visible'); // At least 1 patient
      cy.contains('1').should('be.visible'); // At least 1 service
    });
  });

  describe('Patient Treatment Complete Journey', () => {
    beforeEach(() => {
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
      // Ensure we have basic data
      cy.visit('/');
    });

    it('should complete patient treatment from start to finish', () => {
      // 1. Patient Registration
      cy.visit('/patients');
      cy.wait(1000);
      
      cy.contains('button', 'Agregar').click();
      cy.fillPatientForm({
        first_name: 'Carlos',
        last_name: 'Mendoza',
        email: `carlos.mendoza.${Date.now()}@test.com`,
        phone: '+52 555-456-7890'
      });
      cy.contains('button', 'Guardar').click();
      cy.wait(1000);
      
      // 2. Treatment Planning
      cy.visit('/treatments');
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      cy.get('select[name="patient_id"]').select(0); // Carlos Mendoza
      cy.contains('button', 'Agregar servicio').click();
      cy.get('select[name="service_id"]').select(0); // First service
      cy.get('input[name="notes"]').type('Tratamiento de limpieza rutinaria');
      
      cy.contains('button', 'Crear tratamiento').click();
      cy.wait(1000);
      
      // 3. Start Treatment Session
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('button', 'Iniciar sesión').click();
      cy.contains('button', 'Confirmar').click();
      cy.wait(1000);
      
      // 4. Complete Session
      cy.contains('button', 'Completar sesión').click();
      cy.get('textarea[name="session_notes"]').type('Sesión completada exitosamente. Paciente tolera bien el procedimiento.');
      cy.contains('button', 'Finalizar').click();
      cy.wait(1000);
      
      // 5. Payment Registration
      cy.contains('Pagos').click();
      cy.contains('button', 'Registrar pago').click();
      
      cy.get('input[name="amount_cents"]').type('100000'); // $1000
      cy.get('select[name="payment_method"]').select('cash');
      cy.get('textarea[name="notes"]').type('Pago completo en efectivo');
      
      cy.contains('button', 'Registrar').click();
      cy.wait(1000);
      
      // 6. Verify Complete Treatment
      cy.contains('Progreso').click();
      cy.get('[data-cy="progress-bar"]').should('contain', '100%');
      cy.contains('Completado').should('be.visible');
      
      // 7. Generate Report
      cy.contains('Reporte').click();
      cy.contains('button', 'Generar reporte').click();
      cy.get('input[name="report_title"]').type('Reporte Tratamiento Carlos Mendoza');
      cy.contains('button', 'Crear reporte').click();
      
      cy.contains('reporte generado').should('be.visible');
    });
  });

  describe('Financial Analysis Complete Flow', () => {
    beforeEach(() => {
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    });

    it('should perform complete financial analysis', () => {
      // 1. Review Fixed Costs
      cy.visit('/fixed-costs');
      cy.wait(1000);
      
      cy.get('[data-cy="total-fixed-costs"]').should('be.visible');
      cy.get('[data-cy="total-fixed-costs"]').invoke('text').as('totalFixedCosts');
      
      // 2. Review Service Pricing
      cy.visit('/services');
      cy.wait(1000);
      
      cy.get('[data-cy="service-row"]').first().click();
      cy.contains('Calculadora').click();
      
      // Verify pricing calculation
      cy.get('[data-cy="final-price"]').should('be.visible');
      cy.get('[data-cy="final-price"]').invoke('text').as('servicePrice');
      
      // 3. Calculate Break-even
      cy.visit('/equilibrium');
      cy.wait(1000);
      
      cy.get('[data-cy="breakeven-units"]').should('be.visible');
      cy.get('[data-cy="monthly-target"]').should('be.visible');
      cy.get('[data-cy="daily-target"]').should('be.visible');
      
      // 4. Generate Financial Report
      cy.visit('/reports');
      cy.wait(1000);
      
      cy.contains('button', 'Generar reporte').click();
      cy.get('input[name="report_title"]').type('Análisis Financiero Completo');
      cy.get('input[name="date_from"]').type('2024-01-01');
      cy.get('input[name="date_to"]').type('2024-12-31');
      
      cy.get('checkbox[name="include_costs"]').check();
      cy.get('checkbox[name="include_revenue"]').check();
      cy.get('checkbox[name="include_breakeven"]').check();
      
      cy.contains('button', 'Crear reporte').click();
      
      // 5. Verify Report Generation
      cy.contains('reporte generado').should('be.visible');
      cy.get('[data-cy="download-report"]').should('be.visible');
    });
  });

  describe('Multi-Clinic Operations Flow', () => {
    beforeEach(() => {
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    });

    it('should manage operations across multiple clinics', () => {
      // 1. Check Current Clinic
      cy.visit('/');
      cy.get('[data-cy="current-clinic"]').invoke('text').as('clinic1Name');
      
      // 2. Add Patient to Clinic 1
      cy.visit('/patients');
      cy.contains('button', 'Agregar').click();
      cy.fillPatientForm({
        first_name: 'Paciente',
        last_name: 'Clínica 1',
        email: `clinica1.${Date.now()}@test.com`
      });
      cy.contains('button', 'Guardar').click();
      cy.wait(1000);
      
      // 3. Switch to Clinic 2 (if exists)
      cy.get('[data-cy="clinic-switcher"]').click();
      cy.get('[data-cy="clinic-option"]').then($clinics => {
        if ($clinics.length > 1) {
          cy.wrap($clinics).eq(1).click();
          cy.wait(1000);
          
          // 4. Verify Data Isolation
          cy.visit('/patients');
          cy.contains('Paciente Clínica 1').should('not.exist');
          
          // 5. Add Different Patient to Clinic 2
          cy.contains('button', 'Agregar').click();
          cy.fillPatientForm({
            first_name: 'Paciente',
            last_name: 'Clínica 2',
            email: `clinica2.${Date.now()}@test.com`
          });
          cy.contains('button', 'Guardar').click();
          cy.wait(1000);
          
          // 6. Switch Back to Clinic 1
          cy.get('[data-cy="clinic-switcher"]').click();
          cy.get('[data-cy="clinic-option"]').eq(0).click();
          cy.wait(1000);
          
          // 7. Verify Original Data is Still There
          cy.visit('/patients');
          cy.contains('Paciente Clínica 1').should('be.visible');
          cy.contains('Paciente Clínica 2').should('not.exist');
        }
      });
    });
  });

  describe('System Performance Under Load', () => {
    beforeEach(() => {
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    });

    it('should handle rapid navigation between modules', () => {
      const modules = ['/patients', '/services', '/supplies', '/treatments', '/reports'];
      const startTime = Date.now();
      
      modules.forEach(module => {
        cy.visit(module);
        cy.wait(500);
        cy.get('body').should('be.visible');
      });
      
      cy.then(() => {
        const totalTime = Date.now() - startTime;
        expect(totalTime).to.be.lessThan(10000); // Less than 10 seconds total
      });
    });

    it('should handle form submissions under stress', () => {
      cy.visit('/patients');
      
      // Rapid form submissions
      for (let i = 0; i < 3; i++) {
        cy.contains('button', 'Agregar').click();
        cy.wait(500);
        
        cy.fillPatientForm({
          first_name: `Paciente${i}`,
          last_name: `Prueba${i}`,
          email: `paciente${i}.${Date.now()}@test.com`
        });
        
        cy.contains('button', 'Guardar').click();
        cy.wait(1000);
        
        // Verify creation
        cy.contains(`Paciente${i}`).should('be.visible');
      }
    });
  });

  describe('Data Export and Backup Flow', () => {
    beforeEach(() => {
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    });

    it('should complete full data export workflow', () => {
      // 1. Export Patients
      cy.visit('/patients');
      cy.get('[data-cy="export-button"]').click();
      cy.contains('CSV').click();
      cy.contains('descarga').should('be.visible');
      
      // 2. Export Services
      cy.visit('/services');
      cy.get('[data-cy="export-button"]').click();
      cy.contains('CSV').click();
      cy.contains('descarga').should('be.visible');
      
      // 3. Export Complete Configuration
      cy.visit('/settings/export');
      cy.wait(1000);
      
      cy.get('checkbox[name="include_patients"]').check();
      cy.get('checkbox[name="include_services"]').check();
      cy.get('checkbox[name="include_supplies"]').check();
      cy.get('checkbox[name="include_treatments"]').check();
      cy.get('checkbox[name="include_configuration"]').check();
      
      cy.contains('button', 'Exportar todo').click();
      
      // 4. Verify Export Completion
      cy.contains('exportación completada').should('be.visible');
      cy.get('[data-cy="download-backup"]').should('be.visible');
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    beforeEach(() => {
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    });

    it('should handle network interruptions gracefully', () => {
      cy.visit('/patients');
      
      // Simulate network error
      cy.intercept('POST', '/api/patients', { forceNetworkError: true }).as('networkError');
      
      cy.contains('button', 'Agregar').click();
      cy.fillPatientForm({
        first_name: 'Network',
        last_name: 'Test',
        email: `network.${Date.now()}@test.com`
      });
      
      cy.contains('button', 'Guardar').click();
      cy.wait('@networkError');
      
      // Should show error message
      cy.contains('error').should('be.visible');
      
      // Should allow retry
      cy.contains('button', 'Reintentar').should('be.visible');
    });

    it('should handle session expiration', () => {
      // Clear auth cookies to simulate session expiration
      cy.clearCookies();
      
      cy.visit('/patients');
      
      // Should redirect to login
      cy.url().should('include', '/auth/login');
      
      // Should allow re-authentication
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
      cy.url().should('not.include', '/auth/login');
    });
  });
});