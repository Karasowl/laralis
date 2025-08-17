describe('Services Module', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    
    // Create test supplies first
    cy.visit('/supplies');
    cy.get('[data-cy="add-supply"]').click();
    cy.get('input[name="name"]').type('Guantes Test');
    cy.get('input[name="unit"]').type('par');
    cy.get('input[name="quantity_per_unit"]').type('1');
    cy.get('input[name="cost_per_unit_cents"]').type('500');
    cy.get('[data-cy="save-supply"]').click();
    
    cy.get('[data-cy="add-supply"]').click();
    cy.get('input[name="name"]').type('Anestesia Test');
    cy.get('input[name="unit"]').type('ml');
    cy.get('input[name="quantity_per_unit"]').type('10');
    cy.get('input[name="cost_per_unit_cents"]').type('2000');
    cy.get('[data-cy="save-supply"]').click();
    
    cy.visit('/services');
  });

  describe('Service List', () => {
    it('should display services page', () => {
      cy.contains('h1', 'Servicios').should('be.visible');
      cy.get('[data-cy="add-service"]').should('be.visible');
    });

    it('should show table headers', () => {
      cy.contains('th', 'Nombre').should('be.visible');
      cy.contains('th', 'Duración').should('be.visible');
      cy.contains('th', 'Costo Variable').should('be.visible');
      cy.contains('th', 'Margen').should('be.visible');
      cy.contains('th', 'Precio').should('be.visible');
    });
  });

  describe('Create Service', () => {
    it('should open create service form', () => {
      cy.get('[data-cy="add-service"]').click();
      cy.contains('Nuevo Servicio').should('be.visible');
    });

    it('should validate required fields', () => {
      cy.get('[data-cy="add-service"]').click();
      cy.get('[data-cy="save-service"]').click();
      cy.contains('requerido').should('be.visible');
    });

    it('should create basic service without supplies', () => {
      cy.get('[data-cy="add-service"]').click();
      
      cy.get('input[name="name"]').type('Consulta General');
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('50');
      
      // Should show price preview
      cy.contains('Precio calculado').should('be.visible');
      
      cy.get('[data-cy="save-service"]').click();
      
      // Verify created
      cy.contains('Consulta General').should('be.visible');
      cy.contains('30 min').should('be.visible');
      cy.contains('50%').should('be.visible');
    });

    it('should create service with supplies', () => {
      cy.get('[data-cy="add-service"]').click();
      
      cy.get('input[name="name"]').type('Limpieza Dental');
      cy.get('input[name="duration_minutes"]').type('45');
      cy.get('input[name="margin_percentage"]').type('60');
      
      // Add first supply
      cy.get('[data-cy="add-supply-to-service"]').click();
      cy.get('select[name="supply_id"]').select('Guantes Test');
      cy.get('input[name="quantity"]').type('2');
      cy.get('[data-cy="save-service-supply"]').click();
      
      // Add second supply
      cy.get('[data-cy="add-supply-to-service"]').click();
      cy.get('select[name="supply_id"]').select('Anestesia Test');
      cy.get('input[name="quantity"]').type('3');
      cy.get('[data-cy="save-service-supply"]').click();
      
      // Should show updated cost
      cy.contains('Costo variable total').should('be.visible');
      
      cy.get('[data-cy="save-service"]').click();
      
      // Verify created with supplies
      cy.contains('Limpieza Dental').should('be.visible');
      cy.contains('tr', 'Limpieza Dental').find('[data-cy="view-service"]').click();
      cy.contains('Guantes Test').should('be.visible');
      cy.contains('Anestesia Test').should('be.visible');
    });

    it('should calculate price based on fixed costs + variable costs + margin', () => {
      // First set up fixed costs
      cy.visit('/settings');
      cy.get('input[name="working_days_per_month"]').clear().type('20');
      cy.get('input[name="working_hours_per_day"]').clear().type('8');
      cy.get('[data-cy="save-settings"]').click();
      
      cy.visit('/fixed-costs');
      cy.get('[data-cy="add-cost"]').click();
      cy.get('input[name="name"]').type('Renta');
      cy.get('input[name="amount_cents"]').type('2000000');
      cy.get('[data-cy="save-cost"]').click();
      
      // Create service
      cy.visit('/services');
      cy.get('[data-cy="add-service"]').click();
      
      cy.get('input[name="name"]').type('Endodoncia');
      cy.get('input[name="duration_minutes"]').type('90');
      cy.get('input[name="margin_percentage"]').type('75');
      
      // Add supplies
      cy.get('[data-cy="add-supply-to-service"]').click();
      cy.get('select[name="supply_id"]').select('Anestesia Test');
      cy.get('input[name="quantity"]').type('5');
      cy.get('[data-cy="save-service-supply"]').click();
      
      // Verify price calculation
      cy.contains('Costo fijo por minuto').should('be.visible');
      cy.contains('Costo variable').should('be.visible');
      cy.contains('Precio final').should('be.visible');
      
      cy.get('[data-cy="save-service"]').click();
    });

    it('should handle different margin percentages', () => {
      const margins = [25, 50, 75, 100, 150];
      
      margins.forEach((margin, index) => {
        cy.get('[data-cy="add-service"]').click();
        cy.get('input[name="name"]').type(`Service ${margin}%`);
        cy.get('input[name="duration_minutes"]').type('30');
        cy.get('input[name="margin_percentage"]').type(margin.toString());
        
        // Verify margin display
        cy.contains(`${margin}%`).should('be.visible');
        
        cy.get('[data-cy="save-service"]').click();
        cy.contains(`Service ${margin}%`).should('be.visible');
      });
    });
  });

  describe('Edit Service', () => {
    beforeEach(() => {
      // Create a service to edit
      cy.get('[data-cy="add-service"]').click();
      cy.get('input[name="name"]').type('Editable Service');
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('50');
      cy.get('[data-cy="save-service"]').click();
    });

    it('should open edit form', () => {
      cy.contains('tr', 'Editable Service').find('[data-cy="edit-service"]').click();
      cy.get('input[name="name"]').should('have.value', 'Editable Service');
    });

    it('should update service info', () => {
      cy.contains('tr', 'Editable Service').find('[data-cy="edit-service"]').click();
      
      cy.get('input[name="name"]').clear().type('Updated Service');
      cy.get('input[name="duration_minutes"]').clear().type('60');
      cy.get('input[name="margin_percentage"]').clear().type('70');
      cy.get('[data-cy="save-service"]').click();
      
      cy.contains('Updated Service').should('be.visible');
      cy.contains('60 min').should('be.visible');
      cy.contains('70%').should('be.visible');
    });

    it('should add supplies to existing service', () => {
      cy.contains('tr', 'Editable Service').find('[data-cy="edit-service"]').click();
      
      cy.get('[data-cy="add-supply-to-service"]').click();
      cy.get('select[name="supply_id"]').select('Guantes Test');
      cy.get('input[name="quantity"]').type('3');
      cy.get('[data-cy="save-service-supply"]').click();
      
      cy.get('[data-cy="save-service"]').click();
      
      // Verify supply added
      cy.contains('tr', 'Editable Service').find('[data-cy="view-service"]').click();
      cy.contains('Guantes Test').should('be.visible');
    });

    it('should remove supplies from service', () => {
      // First add a supply
      cy.contains('tr', 'Editable Service').find('[data-cy="edit-service"]').click();
      cy.get('[data-cy="add-supply-to-service"]').click();
      cy.get('select[name="supply_id"]').select('Guantes Test');
      cy.get('input[name="quantity"]').type('2');
      cy.get('[data-cy="save-service-supply"]').click();
      cy.get('[data-cy="save-service"]').click();
      
      // Now remove it
      cy.contains('tr', 'Editable Service').find('[data-cy="edit-service"]').click();
      cy.contains('tr', 'Guantes Test').find('[data-cy="remove-supply"]').click();
      cy.get('[data-cy="save-service"]').click();
      
      // Verify removed
      cy.contains('tr', 'Editable Service').find('[data-cy="view-service"]').click();
      cy.contains('Guantes Test').should('not.exist');
    });
  });

  describe('Delete Service', () => {
    beforeEach(() => {
      // Create a service to delete
      cy.get('[data-cy="add-service"]').click();
      cy.get('input[name="name"]').type('ToDelete Service');
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('50');
      cy.get('[data-cy="save-service"]').click();
    });

    it('should delete service', () => {
      cy.contains('tr', 'ToDelete Service').find('[data-cy="delete-service"]').click();
      
      // Confirm deletion
      cy.contains('button', 'Eliminar').click();
      
      // Verify deleted
      cy.contains('ToDelete Service').should('not.exist');
    });

    it('should prevent deletion if used in treatments', () => {
      // First create a treatment using this service
      cy.visit('/treatments');
      cy.get('[data-cy="add-treatment"]').click();
      cy.get('select[name="patient_id"]').select(0); // Select first patient
      cy.get('select[name="service_id"]').select('ToDelete Service');
      cy.get('[data-cy="save-treatment"]').click();
      
      // Try to delete service
      cy.visit('/services');
      cy.contains('tr', 'ToDelete Service').find('[data-cy="delete-service"]').click();
      cy.contains('button', 'Eliminar').click();
      
      // Should show error
      cy.contains('no se puede eliminar').should('be.visible');
    });
  });

  describe('Service Details View', () => {
    beforeEach(() => {
      // Create a complete service
      cy.get('[data-cy="add-service"]').click();
      cy.get('input[name="name"]').type('Complete Service');
      cy.get('input[name="duration_minutes"]').type('60');
      cy.get('input[name="margin_percentage"]').type('65');
      cy.get('textarea[name="description"]').type('Service with complete information');
      
      // Add supplies
      cy.get('[data-cy="add-supply-to-service"]').click();
      cy.get('select[name="supply_id"]').select('Guantes Test');
      cy.get('input[name="quantity"]').type('2');
      cy.get('[data-cy="save-service-supply"]').click();
      
      cy.get('[data-cy="add-supply-to-service"]').click();
      cy.get('select[name="supply_id"]').select('Anestesia Test');
      cy.get('input[name="quantity"]').type('4');
      cy.get('[data-cy="save-service-supply"]').click();
      
      cy.get('[data-cy="save-service"]').click();
    });

    it('should show service details', () => {
      cy.contains('tr', 'Complete Service').find('[data-cy="view-service"]').click();
      
      cy.contains('Complete Service').should('be.visible');
      cy.contains('60 minutos').should('be.visible');
      cy.contains('65%').should('be.visible');
      cy.contains('Service with complete information').should('be.visible');
    });

    it('should show supply breakdown', () => {
      cy.contains('tr', 'Complete Service').find('[data-cy="view-service"]').click();
      
      cy.contains('Insumos del Servicio').should('be.visible');
      cy.contains('Guantes Test').should('be.visible');
      cy.contains('2').should('be.visible');
      cy.contains('Anestesia Test').should('be.visible');
      cy.contains('4').should('be.visible');
    });

    it('should show cost breakdown', () => {
      cy.contains('tr', 'Complete Service').find('[data-cy="view-service"]').click();
      
      cy.contains('Desglose de Costos').should('be.visible');
      cy.contains('Costo fijo').should('be.visible');
      cy.contains('Costo variable').should('be.visible');
      cy.contains('Margen').should('be.visible');
      cy.contains('Precio final').should('be.visible');
    });
  });

  describe('Service Recipe Management', () => {
    it('should update price when supply quantity changes', () => {
      cy.get('[data-cy="add-service"]').click();
      cy.get('input[name="name"]').type('Dynamic Price Service');
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('50');
      
      // Add supply with quantity 1
      cy.get('[data-cy="add-supply-to-service"]').click();
      cy.get('select[name="supply_id"]').select('Anestesia Test');
      cy.get('input[name="quantity"]').type('1');
      cy.get('[data-cy="save-service-supply"]').click();
      
      // Note the price
      cy.get('[data-cy="calculated-price"]').invoke('text').then((price1) => {
        // Update quantity to 5
        cy.contains('tr', 'Anestesia Test').find('[data-cy="edit-supply-quantity"]').click();
        cy.get('input[name="quantity"]').clear().type('5');
        cy.get('[data-cy="save-service-supply"]').click();
        
        // Price should be different
        cy.get('[data-cy="calculated-price"]').invoke('text').should('not.equal', price1);
      });
    });

    it('should prevent duplicate supplies in service', () => {
      cy.get('[data-cy="add-service"]').click();
      cy.get('input[name="name"]').type('No Duplicate Service');
      cy.get('input[name="duration_minutes"]').type('30');
      
      // Add supply first time
      cy.get('[data-cy="add-supply-to-service"]').click();
      cy.get('select[name="supply_id"]').select('Guantes Test');
      cy.get('input[name="quantity"]').type('1');
      cy.get('[data-cy="save-service-supply"]').click();
      
      // Try to add same supply again
      cy.get('[data-cy="add-supply-to-service"]').click();
      cy.get('select[name="supply_id"]').select('Guantes Test');
      cy.get('input[name="quantity"]').type('2');
      cy.get('[data-cy="save-service-supply"]').click();
      
      // Should show error or prevent
      cy.contains('ya existe').should('be.visible');
    });
  });
});