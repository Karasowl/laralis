describe('Supplies Module', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/supplies');
  });

  describe('Supply List', () => {
    it('should display supplies page', () => {
      cy.contains('h1', 'Insumos').should('be.visible');
      cy.get('[data-cy="add-supply"]').should('be.visible');
    });

    it('should show table headers', () => {
      cy.contains('th', 'Nombre').should('be.visible');
      cy.contains('th', 'Unidad').should('be.visible');
      cy.contains('th', 'Cantidad').should('be.visible');
      cy.contains('th', 'Costo').should('be.visible');
      cy.contains('th', 'Costo Unitario').should('be.visible');
    });

    it('should search supplies', () => {
      // Create a supply first
      cy.get('[data-cy="add-supply"]').click();
      cy.get('input[name="name"]').type('Guantes Látex');
      cy.get('input[name="unit"]').type('caja');
      cy.get('input[name="quantity_per_unit"]').type('100');
      cy.get('input[name="cost_per_unit_cents"]').type('15000');
      cy.get('[data-cy="save-supply"]').click();
      
      // Search
      cy.get('input[placeholder*="Buscar"]').type('Guantes');
      cy.contains('Guantes Látex').should('be.visible');
      
      cy.get('input[placeholder*="Buscar"]').clear().type('NoExiste');
      cy.contains('Guantes Látex').should('not.exist');
    });
  });

  describe('Create Supply', () => {
    it('should open create supply form', () => {
      cy.get('[data-cy="add-supply"]').click();
      cy.contains('Nuevo Insumo').should('be.visible');
    });

    it('should validate required fields', () => {
      cy.get('[data-cy="add-supply"]').click();
      cy.get('[data-cy="save-supply"]').click();
      cy.contains('requerido').should('be.visible');
    });

    it('should calculate unit cost automatically', () => {
      cy.get('[data-cy="add-supply"]').click();
      
      cy.get('input[name="quantity_per_unit"]').type('50');
      cy.get('input[name="cost_per_unit_cents"]').type('10000');
      
      // Should show unit cost preview
      cy.contains('$2.00').should('be.visible'); // 10000 cents / 50 = 200 cents = $2.00
    });

    it('should create basic supply', () => {
      cy.get('[data-cy="add-supply"]').click();
      
      cy.get('input[name="name"]').type('Mascarillas');
      cy.get('input[name="unit"]').type('paquete');
      cy.get('input[name="quantity_per_unit"]').type('50');
      cy.get('input[name="cost_per_unit_cents"]').type('8000');
      
      cy.get('[data-cy="save-supply"]').click();
      
      // Verify created
      cy.contains('Mascarillas').should('be.visible');
      cy.contains('paquete').should('be.visible');
      cy.contains('50').should('be.visible');
      cy.contains('$80.00').should('be.visible'); // 8000 cents
      cy.contains('$1.60').should('be.visible'); // Unit cost
    });

    it('should create supply with description', () => {
      cy.get('[data-cy="add-supply"]').click();
      
      cy.get('input[name="name"]').type('Anestesia Local');
      cy.get('input[name="unit"]').type('cartucho');
      cy.get('input[name="quantity_per_unit"]').type('10');
      cy.get('input[name="cost_per_unit_cents"]').type('25000');
      cy.get('textarea[name="description"]').type('Lidocaína al 2% con epinefrina');
      
      cy.get('[data-cy="save-supply"]').click();
      
      cy.contains('Anestesia Local').should('be.visible');
    });

    it('should handle different unit types', () => {
      const supplies = [
        { name: 'Algodón', unit: 'rollo', quantity: 1, cost: 5000 },
        { name: 'Jeringas', unit: 'pieza', quantity: 1, cost: 300 },
        { name: 'Hilo Dental', unit: 'metro', quantity: 50, cost: 2000 },
        { name: 'Resina', unit: 'gramo', quantity: 5, cost: 15000 }
      ];

      supplies.forEach(supply => {
        cy.get('[data-cy="add-supply"]').click();
        cy.get('input[name="name"]').type(supply.name);
        cy.get('input[name="unit"]').type(supply.unit);
        cy.get('input[name="quantity_per_unit"]').type(supply.quantity.toString());
        cy.get('input[name="cost_per_unit_cents"]').type(supply.cost.toString());
        cy.get('[data-cy="save-supply"]').click();
        
        cy.contains(supply.name).should('be.visible');
        cy.contains(supply.unit).should('be.visible');
      });
    });
  });

  describe('Edit Supply', () => {
    beforeEach(() => {
      // Create a supply to edit
      cy.get('[data-cy="add-supply"]').click();
      cy.get('input[name="name"]').type('Editable Supply');
      cy.get('input[name="unit"]').type('unidad');
      cy.get('input[name="quantity_per_unit"]').type('10');
      cy.get('input[name="cost_per_unit_cents"]').type('5000');
      cy.get('[data-cy="save-supply"]').click();
    });

    it('should open edit form', () => {
      cy.contains('tr', 'Editable Supply').find('[data-cy="edit-supply"]').click();
      cy.get('input[name="name"]').should('have.value', 'Editable Supply');
    });

    it('should update supply info', () => {
      cy.contains('tr', 'Editable Supply').find('[data-cy="edit-supply"]').click();
      
      cy.get('input[name="name"]').clear().type('Updated Supply');
      cy.get('input[name="quantity_per_unit"]').clear().type('20');
      cy.get('[data-cy="save-supply"]').click();
      
      cy.contains('Updated Supply').should('be.visible');
      cy.contains('20').should('be.visible');
    });

    it('should recalculate unit cost on edit', () => {
      cy.contains('tr', 'Editable Supply').find('[data-cy="edit-supply"]').click();
      
      cy.get('input[name="quantity_per_unit"]').clear().type('25');
      cy.get('input[name="cost_per_unit_cents"]').clear().type('10000');
      
      // Preview should update
      cy.contains('$4.00').should('be.visible'); // 10000 / 25 = 400 cents = $4.00
      
      cy.get('[data-cy="save-supply"]').click();
      cy.contains('$4.00').should('be.visible');
    });
  });

  describe('Delete Supply', () => {
    beforeEach(() => {
      // Create a supply to delete
      cy.get('[data-cy="add-supply"]').click();
      cy.get('input[name="name"]').type('ToDelete Supply');
      cy.get('input[name="unit"]').type('unidad');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      cy.get('[data-cy="save-supply"]').click();
    });

    it('should delete supply', () => {
      cy.contains('tr', 'ToDelete Supply').find('[data-cy="delete-supply"]').click();
      
      // Confirm deletion
      cy.contains('button', 'Eliminar').click();
      
      // Verify deleted
      cy.contains('ToDelete Supply').should('not.exist');
    });

    it('should prevent deletion if used in services', () => {
      // First create a service using this supply
      cy.visit('/services');
      cy.get('[data-cy="add-service"]').click();
      cy.get('input[name="name"]').type('Service with Supply');
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('[data-cy="add-supply-to-service"]').click();
      cy.get('select[name="supply_id"]').select('ToDelete Supply');
      cy.get('input[name="quantity"]').type('2');
      cy.get('[data-cy="save-service-supply"]').click();
      cy.get('[data-cy="save-service"]').click();
      
      // Try to delete supply
      cy.visit('/supplies');
      cy.contains('tr', 'ToDelete Supply').find('[data-cy="delete-supply"]').click();
      cy.contains('button', 'Eliminar').click();
      
      // Should show error
      cy.contains('no se puede eliminar').should('be.visible');
    });
  });

  describe('Supply Costs Display', () => {
    it('should format costs correctly', () => {
      cy.get('[data-cy="add-supply"]').click();
      
      cy.get('input[name="name"]').type('Test Formatting');
      cy.get('input[name="unit"]').type('caja');
      cy.get('input[name="quantity_per_unit"]').type('100');
      cy.get('input[name="cost_per_unit_cents"]').type('123456');
      
      cy.get('[data-cy="save-supply"]').click();
      
      // Verify formatting
      cy.contains('$1,234.56').should('be.visible'); // Total cost
      cy.contains('$12.35').should('be.visible'); // Unit cost (rounded)
    });

    it('should handle zero and negative validations', () => {
      cy.get('[data-cy="add-supply"]').click();
      
      cy.get('input[name="name"]').type('Invalid Supply');
      cy.get('input[name="unit"]').type('unidad');
      
      // Try zero quantity
      cy.get('input[name="quantity_per_unit"]').type('0');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      cy.get('[data-cy="save-supply"]').click();
      
      cy.contains('mayor que cero').should('be.visible');
      
      // Try negative cost
      cy.get('input[name="quantity_per_unit"]').clear().type('10');
      cy.get('input[name="cost_per_unit_cents"]').clear().type('-1000');
      cy.get('[data-cy="save-supply"]').click();
      
      cy.contains('positivo').should('be.visible');
    });
  });
});