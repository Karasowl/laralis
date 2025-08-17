describe('Treatments Module', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    
    // Setup test data
    // Create patient
    cy.visit('/patients');
    cy.get('[data-cy="add-patient"]').click();
    cy.get('input[name="first_name"]').type('Test');
    cy.get('input[name="last_name"]').type('Patient');
    cy.get('input[name="email"]').type('test@patient.com');
    cy.get('[data-cy="save-patient"]').click();
    
    // Create service
    cy.visit('/services');
    cy.get('[data-cy="add-service"]').click();
    cy.get('input[name="name"]').type('Test Service');
    cy.get('input[name="duration_minutes"]').type('45');
    cy.get('input[name="margin_percentage"]').type('60');
    cy.get('[data-cy="save-service"]').click();
    
    cy.visit('/treatments');
  });

  describe('Treatment List', () => {
    it('should display treatments page', () => {
      cy.contains('h1', 'Tratamientos').should('be.visible');
      cy.get('[data-cy="add-treatment"]').should('be.visible');
    });

    it('should show table headers', () => {
      cy.contains('th', 'Fecha').should('be.visible');
      cy.contains('th', 'Paciente').should('be.visible');
      cy.contains('th', 'Servicio').should('be.visible');
      cy.contains('th', 'Duración').should('be.visible');
      cy.contains('th', 'Precio').should('be.visible');
      cy.contains('th', 'Estado').should('be.visible');
    });

    it('should filter treatments by date', () => {
      // Create treatments with different dates
      cy.get('[data-cy="add-treatment"]').click();
      cy.get('select[name="patient_id"]').select('Test Patient');
      cy.get('select[name="service_id"]').select('Test Service');
      cy.get('input[name="treatment_date"]').type('2025-01-15');
      cy.get('[data-cy="save-treatment"]').click();
      
      cy.get('[data-cy="add-treatment"]').click();
      cy.get('select[name="patient_id"]').select('Test Patient');
      cy.get('select[name="service_id"]').select('Test Service');
      cy.get('input[name="treatment_date"]').type('2025-02-15');
      cy.get('[data-cy="save-treatment"]').click();
      
      // Filter by date range
      cy.get('input[name="date_from"]').type('2025-02-01');
      cy.get('input[name="date_to"]').type('2025-02-28');
      cy.get('[data-cy="apply-filter"]').click();
      
      // Should only show February treatment
      cy.contains('2025-02-15').should('be.visible');
      cy.contains('2025-01-15').should('not.exist');
    });

    it('should filter treatments by patient', () => {
      // Create another patient
      cy.visit('/patients');
      cy.get('[data-cy="add-patient"]').click();
      cy.get('input[name="first_name"]').type('Another');
      cy.get('input[name="last_name"]').type('Patient');
      cy.get('[data-cy="save-patient"]').click();
      
      // Create treatments for different patients
      cy.visit('/treatments');
      cy.get('[data-cy="add-treatment"]').click();
      cy.get('select[name="patient_id"]').select('Test Patient');
      cy.get('select[name="service_id"]').select('Test Service');
      cy.get('[data-cy="save-treatment"]').click();
      
      cy.get('[data-cy="add-treatment"]').click();
      cy.get('select[name="patient_id"]').select('Another Patient');
      cy.get('select[name="service_id"]').select('Test Service');
      cy.get('[data-cy="save-treatment"]').click();
      
      // Filter by patient
      cy.get('select[name="patient_filter"]').select('Test Patient');
      cy.get('[data-cy="apply-filter"]').click();
      
      cy.contains('Test Patient').should('be.visible');
      cy.contains('Another Patient').should('not.exist');
    });
  });

  describe('Create Treatment', () => {
    it('should open create treatment form', () => {
      cy.get('[data-cy="add-treatment"]').click();
      cy.contains('Nuevo Tratamiento').should('be.visible');
    });

    it('should validate required fields', () => {
      cy.get('[data-cy="add-treatment"]').click();
      cy.get('[data-cy="save-treatment"]').click();
      cy.contains('requerido').should('be.visible');
    });

    it('should create basic treatment', () => {
      cy.get('[data-cy="add-treatment"]').click();
      
      cy.get('select[name="patient_id"]').select('Test Patient');
      cy.get('select[name="service_id"]').select('Test Service');
      cy.get('input[name="treatment_date"]').type('2025-01-20');
      
      // Should show price from service
      cy.contains('Precio').should('be.visible');
      
      cy.get('[data-cy="save-treatment"]').click();
      
      // Verify created
      cy.contains('Test Patient').should('be.visible');
      cy.contains('Test Service').should('be.visible');
      cy.contains('2025-01-20').should('be.visible');
    });

    it('should allow custom price override', () => {
      cy.get('[data-cy="add-treatment"]').click();
      
      cy.get('select[name="patient_id"]').select('Test Patient');
      cy.get('select[name="service_id"]').select('Test Service');
      
      // Enable custom price
      cy.get('[data-cy="enable-custom-price"]').click();
      cy.get('input[name="custom_price_cents"]').type('50000');
      
      cy.get('[data-cy="save-treatment"]').click();
      
      // Verify custom price
      cy.contains('$500.00').should('be.visible');
    });

    it('should capture treatment snapshot', () => {
      cy.get('[data-cy="add-treatment"]').click();
      
      cy.get('select[name="patient_id"]').select('Test Patient');
      cy.get('select[name="service_id"]').select('Test Service');
      cy.get('textarea[name="notes"]').type('Treatment with snapshot');
      
      cy.get('[data-cy="save-treatment"]').click();
      
      // View treatment details
      cy.contains('tr', 'Test Service').find('[data-cy="view-treatment"]').click();
      
      // Should show snapshot data
      cy.contains('Snapshot de Costos').should('be.visible');
      cy.contains('Costo fijo capturado').should('be.visible');
      cy.contains('Costo variable capturado').should('be.visible');
      cy.contains('Margen aplicado').should('be.visible');
    });

    it('should handle different treatment statuses', () => {
      const statuses = [
        { value: 'scheduled', label: 'Programado' },
        { value: 'completed', label: 'Completado' },
        { value: 'cancelled', label: 'Cancelado' },
        { value: 'no_show', label: 'No asistió' }
      ];

      statuses.forEach(status => {
        cy.get('[data-cy="add-treatment"]').click();
        cy.get('select[name="patient_id"]').select('Test Patient');
        cy.get('select[name="service_id"]').select('Test Service');
        cy.get('select[name="status"]').select(status.value);
        cy.get('[data-cy="save-treatment"]').click();
        
        cy.contains(status.label).should('be.visible');
      });
    });

    it('should add treatment notes', () => {
      cy.get('[data-cy="add-treatment"]').click();
      
      cy.get('select[name="patient_id"]').select('Test Patient');
      cy.get('select[name="service_id"]').select('Test Service');
      cy.get('textarea[name="notes"]').type('Patient had sensitivity in upper left molar. Applied desensitizing treatment.');
      
      cy.get('[data-cy="save-treatment"]').click();
      
      // View treatment
      cy.contains('tr', 'Test Service').first().find('[data-cy="view-treatment"]').click();
      cy.contains('sensitivity in upper left molar').should('be.visible');
    });
  });

  describe('Edit Treatment', () => {
    beforeEach(() => {
      // Create a treatment to edit
      cy.get('[data-cy="add-treatment"]').click();
      cy.get('select[name="patient_id"]').select('Test Patient');
      cy.get('select[name="service_id"]').select('Test Service');
      cy.get('input[name="treatment_date"]').type('2025-01-25');
      cy.get('[data-cy="save-treatment"]').click();
    });

    it('should open edit form', () => {
      cy.contains('tr', '2025-01-25').find('[data-cy="edit-treatment"]').click();
      cy.get('input[name="treatment_date"]').should('have.value', '2025-01-25');
    });

    it('should update treatment status', () => {
      cy.contains('tr', '2025-01-25').find('[data-cy="edit-treatment"]').click();
      
      cy.get('select[name="status"]').select('completed');
      cy.get('[data-cy="save-treatment"]').click();
      
      cy.contains('Completado').should('be.visible');
    });

    it('should update treatment notes', () => {
      cy.contains('tr', '2025-01-25').find('[data-cy="edit-treatment"]').click();
      
      cy.get('textarea[name="notes"]').type('Updated: Treatment completed successfully');
      cy.get('[data-cy="save-treatment"]').click();
      
      cy.contains('tr', '2025-01-25').find('[data-cy="view-treatment"]').click();
      cy.contains('Treatment completed successfully').should('be.visible');
    });

    it('should not allow changing patient or service', () => {
      cy.contains('tr', '2025-01-25').find('[data-cy="edit-treatment"]').click();
      
      // Patient and service selectors should be disabled
      cy.get('select[name="patient_id"]').should('be.disabled');
      cy.get('select[name="service_id"]').should('be.disabled');
    });
  });

  describe('Delete Treatment', () => {
    beforeEach(() => {
      // Create a treatment to delete
      cy.get('[data-cy="add-treatment"]').click();
      cy.get('select[name="patient_id"]').select('Test Patient');
      cy.get('select[name="service_id"]').select('Test Service');
      cy.get('[data-cy="save-treatment"]').click();
    });

    it('should delete treatment', () => {
      cy.contains('tr', 'Test Service').find('[data-cy="delete-treatment"]').click();
      
      // Confirm deletion
      cy.contains('button', 'Eliminar').click();
      
      // Verify deleted
      cy.reload();
      cy.contains('No hay tratamientos').should('be.visible');
    });

    it('should cancel deletion', () => {
      cy.contains('tr', 'Test Service').find('[data-cy="delete-treatment"]').click();
      
      // Cancel deletion
      cy.contains('button', 'Cancelar').click();
      
      // Verify still exists
      cy.contains('Test Service').should('be.visible');
    });
  });

  describe('Treatment Reports', () => {
    beforeEach(() => {
      // Create multiple treatments
      const treatments = [
        { date: '2025-01-10', status: 'completed' },
        { date: '2025-01-15', status: 'completed' },
        { date: '2025-01-20', status: 'cancelled' },
        { date: '2025-01-25', status: 'no_show' }
      ];

      treatments.forEach(treatment => {
        cy.get('[data-cy="add-treatment"]').click();
        cy.get('select[name="patient_id"]').select('Test Patient');
        cy.get('select[name="service_id"]').select('Test Service');
        cy.get('input[name="treatment_date"]').type(treatment.date);
        cy.get('select[name="status"]').select(treatment.status);
        cy.get('[data-cy="save-treatment"]').click();
      });
    });

    it('should show treatment summary', () => {
      cy.get('[data-cy="treatment-summary"]').click();
      
      cy.contains('Total de Tratamientos').should('be.visible');
      cy.contains('Completados').should('be.visible');
      cy.contains('Cancelados').should('be.visible');
      cy.contains('No asistió').should('be.visible');
    });

    it('should calculate revenue from completed treatments', () => {
      cy.get('[data-cy="treatment-summary"]').click();
      
      cy.contains('Ingresos Totales').should('be.visible');
      // Should only count completed treatments
      cy.get('[data-cy="total-revenue"]').should('not.contain', '$0.00');
    });

    it('should export treatments to CSV', () => {
      cy.get('[data-cy="export-treatments"]').click();
      cy.get('[data-cy="export-csv"]').click();
      
      // Verify download started
      cy.readFile('cypress/downloads/treatments.csv').should('exist');
    });
  });

  describe('Treatment Calendar View', () => {
    it('should show calendar view', () => {
      cy.get('[data-cy="calendar-view"]').click();
      
      cy.contains('Calendario de Tratamientos').should('be.visible');
      cy.get('.calendar-grid').should('be.visible');
    });

    it('should show treatments on calendar', () => {
      // Create treatment for today
      cy.get('[data-cy="add-treatment"]').click();
      cy.get('select[name="patient_id"]').select('Test Patient');
      cy.get('select[name="service_id"]').select('Test Service');
      
      const today = new Date().toISOString().split('T')[0];
      cy.get('input[name="treatment_date"]').type(today);
      cy.get('[data-cy="save-treatment"]').click();
      
      // Switch to calendar view
      cy.get('[data-cy="calendar-view"]').click();
      
      // Should show treatment on today's date
      cy.get(`[data-date="${today}"]`).within(() => {
        cy.contains('Test Patient').should('be.visible');
      });
    });

    it('should navigate between months', () => {
      cy.get('[data-cy="calendar-view"]').click();
      
      const currentMonth = new Date().toLocaleString('es', { month: 'long' });
      cy.contains(currentMonth).should('be.visible');
      
      // Navigate to next month
      cy.get('[data-cy="next-month"]').click();
      
      // Should show different month
      cy.contains(currentMonth).should('not.exist');
      
      // Navigate back
      cy.get('[data-cy="prev-month"]').click();
      cy.contains(currentMonth).should('be.visible');
    });
  });
});