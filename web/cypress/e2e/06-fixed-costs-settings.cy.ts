describe('Fixed Costs and Settings', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
  });

  describe('Time Settings', () => {
    beforeEach(() => {
      cy.visit('/settings');
    });

    it('should display settings page', () => {
      cy.contains('h1', 'Configuraciones').should('be.visible');
      cy.contains('Configuración de Tiempo').should('be.visible');
    });

    it('should show default values', () => {
      cy.get('input[name="working_days_per_month"]').should('have.value', '20');
      cy.get('input[name="working_hours_per_day"]').should('have.value', '6');
      cy.get('input[name="productive_minutes_per_hour"]').should('have.value', '50');
    });

    it('should update time settings', () => {
      cy.get('input[name="working_days_per_month"]').clear().type('22');
      cy.get('input[name="working_hours_per_day"]').clear().type('8');
      cy.get('input[name="productive_minutes_per_hour"]').clear().type('45');
      
      cy.get('[data-cy="save-settings"]').click();
      
      cy.contains('Configuración actualizada').should('be.visible');
      
      // Verify values persist
      cy.reload();
      cy.get('input[name="working_days_per_month"]').should('have.value', '22');
      cy.get('input[name="working_hours_per_day"]').should('have.value', '8');
      cy.get('input[name="productive_minutes_per_hour"]').should('have.value', '45');
    });

    it('should validate time settings', () => {
      // Try invalid values
      cy.get('input[name="working_days_per_month"]').clear().type('0');
      cy.get('[data-cy="save-settings"]').click();
      cy.contains('debe ser mayor que 0').should('be.visible');
      
      cy.get('input[name="working_days_per_month"]').clear().type('31');
      cy.get('[data-cy="save-settings"]').click();
      cy.contains('máximo 30 días').should('be.visible');
      
      cy.get('input[name="working_hours_per_day"]').clear().type('25');
      cy.get('[data-cy="save-settings"]').click();
      cy.contains('máximo 24 horas').should('be.visible');
      
      cy.get('input[name="productive_minutes_per_hour"]').clear().type('61');
      cy.get('[data-cy="save-settings"]').click();
      cy.contains('máximo 60 minutos').should('be.visible');
    });

    it('should calculate total productive minutes', () => {
      cy.get('input[name="working_days_per_month"]').clear().type('20');
      cy.get('input[name="working_hours_per_day"]').clear().type('8');
      cy.get('input[name="productive_minutes_per_hour"]').clear().type('50');
      
      // Should show calculation
      cy.contains('Total minutos productivos al mes').should('be.visible');
      cy.contains('8,000').should('be.visible'); // 20 * 8 * 50 = 8,000
    });
  });

  describe('Fixed Costs', () => {
    beforeEach(() => {
      cy.visit('/fixed-costs');
    });

    it('should display fixed costs page', () => {
      cy.contains('h1', 'Costos Fijos').should('be.visible');
      cy.get('[data-cy="add-cost"]').should('be.visible');
    });

    it('should show cost categories', () => {
      cy.get('[data-cy="add-cost"]').click();
      cy.get('select[name="category"]').should('be.visible');
      
      // Verify categories
      const categories = [
        'Renta',
        'Salarios',
        'Servicios',
        'Mantenimiento',
        'Seguros',
        'Otros'
      ];
      
      categories.forEach(category => {
        cy.get('select[name="category"]').select(category);
      });
    });

    it('should create fixed cost', () => {
      cy.get('[data-cy="add-cost"]').click();
      
      cy.get('input[name="name"]').type('Renta del Local');
      cy.get('select[name="category"]').select('Renta');
      cy.get('input[name="amount_cents"]').type('5000000');
      cy.get('textarea[name="description"]').type('Renta mensual del consultorio');
      
      cy.get('[data-cy="save-cost"]').click();
      
      // Verify created
      cy.contains('Renta del Local').should('be.visible');
      cy.contains('$50,000.00').should('be.visible');
      cy.contains('Renta').should('be.visible');
    });

    it('should create multiple fixed costs', () => {
      const costs = [
        { name: 'Salario Dentista', category: 'Salarios', amount: '3500000' },
        { name: 'Salario Asistente', category: 'Salarios', amount: '1500000' },
        { name: 'Electricidad', category: 'Servicios', amount: '50000' },
        { name: 'Internet', category: 'Servicios', amount: '100000' },
        { name: 'Seguro de Responsabilidad', category: 'Seguros', amount: '200000' }
      ];

      costs.forEach(cost => {
        cy.get('[data-cy="add-cost"]').click();
        cy.get('input[name="name"]').type(cost.name);
        cy.get('select[name="category"]').select(cost.category);
        cy.get('input[name="amount_cents"]').type(cost.amount);
        cy.get('[data-cy="save-cost"]').click();
        
        cy.contains(cost.name).should('be.visible');
      });

      // Verify total
      cy.contains('Total Mensual').should('be.visible');
      cy.get('[data-cy="total-fixed-costs"]').should('not.contain', '$0.00');
    });

    it('should edit fixed cost', () => {
      // Create cost
      cy.get('[data-cy="add-cost"]').click();
      cy.get('input[name="name"]').type('Editable Cost');
      cy.get('input[name="amount_cents"]').type('1000000');
      cy.get('[data-cy="save-cost"]').click();
      
      // Edit
      cy.contains('tr', 'Editable Cost').find('[data-cy="edit-cost"]').click();
      cy.get('input[name="name"]').clear().type('Updated Cost');
      cy.get('input[name="amount_cents"]').clear().type('1500000');
      cy.get('[data-cy="save-cost"]').click();
      
      cy.contains('Updated Cost').should('be.visible');
      cy.contains('$15,000.00').should('be.visible');
    });

    it('should delete fixed cost', () => {
      // Create cost
      cy.get('[data-cy="add-cost"]').click();
      cy.get('input[name="name"]').type('ToDelete Cost');
      cy.get('input[name="amount_cents"]').type('500000');
      cy.get('[data-cy="save-cost"]').click();
      
      // Delete
      cy.contains('tr', 'ToDelete Cost').find('[data-cy="delete-cost"]').click();
      cy.contains('button', 'Eliminar').click();
      
      cy.contains('ToDelete Cost').should('not.exist');
    });

    it('should calculate cost per minute', () => {
      // Set time settings first
      cy.visit('/settings');
      cy.get('input[name="working_days_per_month"]').clear().type('20');
      cy.get('input[name="working_hours_per_day"]').clear().type('8');
      cy.get('input[name="productive_minutes_per_hour"]').clear().type('50');
      cy.get('[data-cy="save-settings"]').click();
      
      // Add fixed costs
      cy.visit('/fixed-costs');
      cy.get('[data-cy="add-cost"]').click();
      cy.get('input[name="name"]').type('Total Costs');
      cy.get('input[name="amount_cents"]').type('4000000'); // $40,000
      cy.get('[data-cy="save-cost"]').click();
      
      // Should show cost per minute
      cy.contains('Costo por Minuto').should('be.visible');
      // $40,000 / (20 * 8 * 50) = $40,000 / 8,000 = $5.00
      cy.contains('$5.00').should('be.visible');
    });
  });

  describe('Assets', () => {
    beforeEach(() => {
      cy.visit('/assets');
    });

    it('should display assets page', () => {
      cy.contains('h1', 'Activos').should('be.visible');
      cy.get('[data-cy="add-asset"]').should('be.visible');
    });

    it('should create asset', () => {
      cy.get('[data-cy="add-asset"]').click();
      
      cy.get('input[name="name"]').type('Sillón Dental');
      cy.get('select[name="category"]').select('Equipo');
      cy.get('input[name="purchase_price_cents"]').type('15000000');
      cy.get('input[name="purchase_date"]').type('2024-01-15');
      cy.get('input[name="useful_life_years"]').type('10');
      
      cy.get('[data-cy="save-asset"]').click();
      
      // Verify created
      cy.contains('Sillón Dental').should('be.visible');
      cy.contains('$150,000.00').should('be.visible');
      cy.contains('10 años').should('be.visible');
    });

    it('should calculate depreciation', () => {
      cy.get('[data-cy="add-asset"]').click();
      
      cy.get('input[name="name"]').type('Equipo de Rayos X');
      cy.get('input[name="purchase_price_cents"]').type('8000000');
      cy.get('input[name="useful_life_years"]').type('5');
      
      // Should show monthly depreciation
      cy.contains('Depreciación mensual').should('be.visible');
      // $80,000 / (5 * 12) = $80,000 / 60 = $1,333.33
      cy.contains('$1,333.33').should('be.visible');
      
      cy.get('[data-cy="save-asset"]').click();
    });

    it('should show total assets value', () => {
      // Create multiple assets
      const assets = [
        { name: 'Compresor', price: '3000000', life: '5' },
        { name: 'Autoclave', price: '2500000', life: '7' },
        { name: 'Lámpara LED', price: '1000000', life: '3' }
      ];

      assets.forEach(asset => {
        cy.get('[data-cy="add-asset"]').click();
        cy.get('input[name="name"]').type(asset.name);
        cy.get('input[name="purchase_price_cents"]').type(asset.price);
        cy.get('input[name="useful_life_years"]').type(asset.life);
        cy.get('[data-cy="save-asset"]').click();
      });

      // Should show summary
      cy.contains('Valor Total de Activos').should('be.visible');
      cy.contains('Depreciación Total Mensual').should('be.visible');
    });
  });

  describe('Break-even Point', () => {
    beforeEach(() => {
      // Setup required data
      cy.visit('/settings');
      cy.get('input[name="working_days_per_month"]').clear().type('20');
      cy.get('input[name="working_hours_per_day"]').clear().type('8');
      cy.get('[data-cy="save-settings"]').click();
      
      cy.visit('/fixed-costs');
      cy.get('[data-cy="add-cost"]').click();
      cy.get('input[name="name"]').type('Costos Totales');
      cy.get('input[name="amount_cents"]').type('5000000');
      cy.get('[data-cy="save-cost"]').click();
      
      cy.visit('/services');
      cy.get('[data-cy="add-service"]').click();
      cy.get('input[name="name"]').type('Servicio Promedio');
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('60');
      cy.get('[data-cy="save-service"]').click();
      
      cy.visit('/equilibrium');
    });

    it('should display break-even analysis', () => {
      cy.contains('h1', 'Punto de Equilibrio').should('be.visible');
      cy.contains('Análisis de Punto de Equilibrio').should('be.visible');
    });

    it('should calculate services needed', () => {
      cy.contains('Servicios necesarios al mes').should('be.visible');
      cy.contains('Servicios necesarios al día').should('be.visible');
      
      // Should show calculations
      cy.get('[data-cy="services-per-month"]').should('not.contain', '0');
      cy.get('[data-cy="services-per-day"]').should('not.contain', '0');
    });

    it('should show revenue needed', () => {
      cy.contains('Ingresos necesarios').should('be.visible');
      cy.get('[data-cy="revenue-needed"]').should('not.contain', '$0.00');
    });

    it('should update with different service mix', () => {
      // Add another service with different price
      cy.visit('/services');
      cy.get('[data-cy="add-service"]').click();
      cy.get('input[name="name"]').type('Servicio Premium');
      cy.get('input[name="duration_minutes"]').type('60');
      cy.get('input[name="margin_percentage"]').type('100');
      cy.get('[data-cy="save-service"]').click();
      
      cy.visit('/equilibrium');
      
      // Select different service for calculation
      cy.get('select[name="service_for_calculation"]').select('Servicio Premium');
      
      // Values should update
      cy.get('[data-cy="services-per-month"]').invoke('text').then((text1) => {
        cy.get('select[name="service_for_calculation"]').select('Servicio Promedio');
        cy.get('[data-cy="services-per-month"]').invoke('text').should('not.equal', text1);
      });
    });

    it('should show profitability scenarios', () => {
      cy.contains('Escenarios de Rentabilidad').should('be.visible');
      
      // Should show different occupancy levels
      ['50%', '75%', '100%'].forEach(level => {
        cy.contains(level).should('be.visible');
      });
      
      // Should show profit/loss for each scenario
      cy.get('[data-cy="scenario-50"]').should('be.visible');
      cy.get('[data-cy="scenario-75"]').should('be.visible');
      cy.get('[data-cy="scenario-100"]').should('be.visible');
    });
  });

  describe('Currency Settings', () => {
    beforeEach(() => {
      cy.visit('/settings');
    });

    it('should show currency configuration', () => {
      cy.contains('Configuración de Moneda').should('be.visible');
      cy.get('select[name="currency"]').should('be.visible');
    });

    it('should change currency', () => {
      cy.get('select[name="currency"]').select('USD');
      cy.get('[data-cy="save-settings"]').click();
      
      // Verify currency changed in displays
      cy.visit('/services');
      cy.contains('USD').should('be.visible');
      
      // Change back to MXN
      cy.visit('/settings');
      cy.get('select[name="currency"]').select('MXN');
      cy.get('[data-cy="save-settings"]').click();
    });

    it('should format numbers according to locale', () => {
      // Create a service with specific price
      cy.visit('/services');
      cy.get('[data-cy="add-service"]').click();
      cy.get('input[name="name"]').type('Locale Test');
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('50');
      cy.get('[data-cy="save-service"]').click();
      
      // Verify Mexican peso formatting (e.g., $1,234.56)
      cy.contains(/\$[\d,]+\.\d{2}/).should('be.visible');
    });
  });
});