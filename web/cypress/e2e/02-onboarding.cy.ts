describe('Onboarding and Initial Setup', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  describe('First-time User Onboarding', () => {
    it('should complete workspace and clinic setup successfully', () => {
      // Login con usuario que no tiene workspace
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
      
      // Debería redirigir a onboarding si no tiene workspace
      cy.url({ timeout: 10000 }).should('include', 'onboarding');
      
      // Verificar página de onboarding
      cy.contains('Bienvenido', { timeout: 5000 }).should('be.visible');
      cy.contains('espacio de trabajo').or('workspace').should('be.visible');
      
      // Llenar formulario de workspace
      cy.get('input[name="name"]').first().type('Clínica Test Cypress');
      cy.get('input[name="slug"]').type('clinica-test-cypress');
      
      // Continuar al siguiente paso
      cy.contains('button', 'Siguiente').or('button', 'Continuar').click();
      
      // Llenar información de clínica
      cy.get('input[name="name"]').type('Sede Principal');
      cy.get('input[name="address"]').type('Av. Test 123, Ciudad');
      cy.get('input[name="phone"]').type('+52 555-123-4567');
      cy.get('input[name="email"]').type('contacto@clinica-test.com');
      
      // Finalizar onboarding
      cy.contains('button', 'Crear').or('button', 'Finalizar').click();
      
      // Verificar redirección exitosa
      cy.url({ timeout: 15000 }).should('not.include', 'onboarding');
      cy.url().should('match', /^\//); // Dashboard principal
    });

    it('should validate required fields in workspace creation', () => {
      cy.visit('/onboarding');
      cy.wait(1000);
      
      // Intentar continuar sin llenar campos
      cy.contains('button', 'Siguiente').or('button', 'Continuar').click();
      
      // Verificar mensajes de validación
      cy.contains('requerido').or('required').should('be.visible');
    });

    it('should validate clinic information requirements', () => {
      cy.visit('/onboarding');
      cy.wait(1000);
      
      // Llenar workspace básico
      cy.get('input[name="name"]').first().type('Test Workspace');
      cy.get('input[name="slug"]').type('test-workspace');
      
      // Ir al siguiente paso
      cy.contains('button', 'Siguiente').or('button', 'Continuar').click();
      
      // Intentar crear sin llenar información de clínica
      cy.contains('button', 'Crear').or('button', 'Finalizar').click();
      
      // Verificar validación de campos requeridos
      cy.contains('requerido').or('required').should('be.visible');
    });
  });

  describe('Workspace Management', () => {
    beforeEach(() => {
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
      // Asegurar que estamos en el dashboard
      cy.visit('/');
    });

    it('should display workspace information correctly', () => {
      // Verificar que se muestra información del workspace
      cy.get('[data-cy="workspace-name"]').should('be.visible');
      cy.get('[data-cy="clinic-name"]').should('be.visible');
    });

    it('should allow switching between clinics', () => {
      // Si hay múltiples clínicas, probar el switcher
      cy.get('body').then($body => {
        if ($body.find('[data-cy="clinic-switcher"]').length > 0) {
          cy.get('[data-cy="clinic-switcher"]').click();
          cy.get('[data-cy="clinic-list"]').should('be.visible');
        }
      });
    });
  });

  describe('Initial Configuration', () => {
    beforeEach(() => {
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
      cy.visit('/');
    });

    it('should guide user through time settings configuration', () => {
      cy.visit('/settings/time');
      cy.wait(1000);
      
      // Verificar formulario de configuración de tiempo
      cy.get('input[name="work_days"]').should('be.visible');
      cy.get('input[name="hours_per_day"]').should('be.visible');
      cy.get('input[name="real_pct"]').should('be.visible');
      
      // Llenar configuración básica
      cy.get('input[name="work_days"]').clear().type('22');
      cy.get('input[name="hours_per_day"]').clear().type('8');
      cy.get('input[name="real_pct"]').clear().type('75');
      
      // Guardar configuración
      cy.contains('button', 'Guardar').click();
      
      // Verificar mensaje de éxito
      cy.contains('guardado').or('saved').should('be.visible');
    });

    it('should allow configuration of fixed costs', () => {
      cy.visit('/fixed-costs');
      cy.wait(1000);
      
      // Verificar que se puede agregar costo fijo
      cy.contains('button', 'Agregar').or('button', 'Nuevo').click();
      
      // Llenar formulario de costo fijo
      cy.get('input[name="name"]').type('Renta del consultorio');
      cy.get('input[name="amount_cents"]').type('1500000'); // $15,000 en centavos
      cy.get('select[name="category"]').select('rent');
      
      // Guardar
      cy.contains('button', 'Guardar').click();
      
      // Verificar que se agregó a la lista
      cy.contains('Renta del consultorio').should('be.visible');
    });

    it('should help set up basic supplies', () => {
      cy.visit('/supplies');
      cy.wait(1000);
      
      // Agregar primer insumo
      cy.contains('button', 'Agregar').or('button', 'Nuevo').click();
      
      // Usar el comando personalizado
      cy.fillSupplyForm({
        name: 'Guantes de látex',
        unit: 'caja',
        quantity_per_unit: 100,
        cost_per_unit_cents: 25000 // $250 por caja
      });
      
      // Guardar
      cy.contains('button', 'Guardar').click();
      
      // Verificar en lista
      cy.contains('Guantes de látex').should('be.visible');
    });

    it('should help create basic services', () => {
      cy.visit('/services');
      cy.wait(1000);
      
      // Agregar primer servicio
      cy.contains('button', 'Agregar').or('button', 'Nuevo').click();
      
      // Usar comando personalizado
      cy.fillServiceForm({
        name: 'Limpieza dental',
        duration_minutes: 30,
        margin_percentage: 65
      });
      
      // Guardar
      cy.contains('button', 'Guardar').click();
      
      // Verificar en lista
      cy.contains('Limpieza dental').should('be.visible');
    });
  });

  describe('Onboarding Progress', () => {
    beforeEach(() => {
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    });

    it('should show progress indicators during setup', () => {
      cy.visit('/onboarding');
      cy.wait(1000);
      
      // Verificar indicadores de progreso
      cy.get('[data-cy="progress-indicator"]').should('be.visible');
      cy.get('[data-cy="step-1"]').should('have.class', 'active');
    });

    it('should provide helpful tooltips and guidance', () => {
      cy.visit('/onboarding');
      cy.wait(1000);
      
      // Buscar elementos de ayuda
      cy.get('[data-cy="help-tooltip"]').should('exist');
      cy.contains('información').or('ayuda').should('be.visible');
    });

    it('should allow skipping optional steps', () => {
      cy.visit('/onboarding');
      cy.wait(1000);
      
      // Buscar opción de saltar pasos opcionales
      cy.get('body').then($body => {
        if ($body.find('[data-cy="skip-step"]').length > 0) {
          cy.get('[data-cy="skip-step"]').click();
          cy.url().should('not.include', 'onboarding');
        }
      });
    });
  });

  describe('Post-Onboarding Experience', () => {
    beforeEach(() => {
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
      cy.visit('/');
    });

    it('should show welcome dashboard for new users', () => {
      // Verificar elementos del dashboard
      cy.contains('Dashboard').or('Inicio').should('be.visible');
      cy.get('[data-cy="dashboard-stats"]').should('be.visible');
    });

    it('should provide quick access to main modules', () => {
      // Verificar navegación principal
      cy.contains('Pacientes').should('be.visible');
      cy.contains('Servicios').should('be.visible');
      cy.contains('Insumos').should('be.visible');
      cy.contains('Tratamientos').should('be.visible');
    });

    it('should show empty states with helpful actions', () => {
      // Visitar módulos que probablemente estén vacíos
      cy.visit('/patients');
      cy.wait(1000);
      
      // Verificar empty state
      cy.get('body').then($body => {
        if ($body.find('[data-cy="empty-state"]').length > 0) {
          cy.get('[data-cy="empty-state"]').should('be.visible');
          cy.contains('Agregar').or('Crear').should('be.visible');
        }
      });
    });
  });

  describe('Error Handling During Onboarding', () => {
    it('should handle network errors gracefully', () => {
      // Simular error de red
      cy.intercept('POST', '**/api/workspaces', { forceNetworkError: true });
      
      cy.visit('/onboarding');
      cy.wait(1000);
      
      // Intentar crear workspace
      cy.get('input[name="name"]').first().type('Test Workspace');
      cy.get('input[name="slug"]').type('test-workspace');
      cy.contains('button', 'Siguiente').click();
      
      // Verificar manejo de error
      cy.contains('error').or('Error').should('be.visible');
    });

    it('should validate unique workspace slugs', () => {
      cy.visit('/onboarding');
      cy.wait(1000);
      
      // Usar slug que probablemente ya existe
      cy.get('input[name="name"]').first().type('Test Workspace');
      cy.get('input[name="slug"]').clear().type('test'); // Slug muy común
      
      cy.contains('button', 'Siguiente').click();
      
      // Verificar validación de unicidad
      cy.contains('disponible').or('existe').should('be.visible');
    });
  });
});