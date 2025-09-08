describe('Configuration and Fixed Costs', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
  });

  describe('Time Settings Configuration', () => {
    it('should configure basic time settings', () => {
      cy.visit('/settings/time');
      cy.wait(1000);
      
      // Configurar horarios de trabajo
      cy.get('input[name="work_days"]').clear().type('22');
      cy.get('input[name="hours_per_day"]').clear().type('8');
      cy.get('input[name="real_pct"]').clear().type('75');
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar guardado exitoso
      cy.contains('configuración guardada').should('be.visible');
    });

    it('should validate time settings constraints', () => {
      cy.visit('/settings/time');
      cy.wait(1000);
      
      // Valores inválidos
      cy.get('input[name="work_days"]').clear().type('35'); // Más de 31
      cy.get('input[name="hours_per_day"]').clear().type('25'); // Más de 24
      cy.get('input[name="real_pct"]').clear().type('150'); // Más de 100%
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar validaciones
      cy.contains('válido').or('rango').should('be.visible');
    });

    it('should show impact of time changes on pricing', () => {
      cy.visit('/settings/time');
      cy.wait(1000);
      
      // Cambiar configuración
      cy.get('input[name="hours_per_day"]').clear().type('10');
      
      // Verificar preview de impacto
      cy.get('[data-cy="pricing-impact"]').should('be.visible');
      cy.contains('afectará').or('impacto').should('be.visible');
    });
  });

  describe('Fixed Costs Management', () => {
    it('should add different types of fixed costs', () => {
      cy.visit('/fixed-costs');
      cy.wait(1000);
      
      const fixedCosts = [
        { name: 'Renta del consultorio', amount: '1500000', category: 'rent' },
        { name: 'Servicios públicos', amount: '500000', category: 'utilities' },
        { name: 'Seguros', amount: '200000', category: 'insurance' },
        { name: 'Salarios base', amount: '3000000', category: 'salaries' }
      ];
      
      fixedCosts.forEach(cost => {
        cy.contains('button', 'Agregar').click();
        cy.wait(500);
        
        cy.get('input[name="name"]').type(cost.name);
        cy.get('input[name="amount_cents"]').type(cost.amount);
        cy.get('select[name="category"]').select(cost.category);
        
        cy.contains('button', 'Guardar').click();
        cy.wait(1000);
        
        // Verificar que se agregó
        cy.contains(cost.name).should('be.visible');
      });
    });

    it('should calculate total fixed costs correctly', () => {
      cy.visit('/fixed-costs');
      cy.wait(1000);
      
      // Verificar cálculo total
      cy.get('[data-cy="total-fixed-costs"]').should('be.visible');
      cy.get('[data-cy="total-fixed-costs"]').should('contain', '$');
      
      // Verificar desglose por categoría
      cy.get('[data-cy="category-breakdown"]').should('be.visible');
    });

    it('should handle recurring vs one-time costs', () => {
      cy.visit('/fixed-costs');
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Costo recurrente
      cy.get('input[name="name"]').type('Mantenimiento mensual');
      cy.get('input[name="amount_cents"]').type('100000');
      cy.get('select[name="frequency"]').select('monthly');
      
      cy.contains('button', 'Guardar').click();
      cy.wait(1000);
      
      // Costo único
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      cy.get('input[name="name"]').type('Equipo dental');
      cy.get('input[name="amount_cents"]').type('5000000');
      cy.get('select[name="frequency"]').select('one-time');
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar diferenciación en lista
      cy.contains('Mensual').should('be.visible');
      cy.contains('Único').should('be.visible');
    });

    it('should track cost history and changes', () => {
      cy.visit('/fixed-costs');
      cy.wait(1000);
      
      // Editar costo existente
      cy.get('[data-cy="edit-cost"]').first().click();
      cy.get('input[name="amount_cents"]').clear().type('1600000');
      cy.contains('button', 'Guardar').click();
      
      // Ver historial
      cy.get('[data-cy="cost-row"]').first().click();
      cy.contains('Historial').click();
      
      // Verificar registro de cambios
      cy.get('[data-cy="cost-history"]').should('be.visible');
      cy.contains('$1,500').should('be.visible'); // Valor anterior
      cy.contains('$1,600').should('be.visible'); // Valor nuevo
    });
  });

  describe('Asset Management and Depreciation', () => {
    it('should manage dental equipment assets', () => {
      cy.visit('/assets');
      cy.wait(1000);
      
      // Agregar activo
      cy.contains('button', 'Agregar activo').click();
      cy.wait(500);
      
      cy.get('input[name="name"]').type('Sillón dental premium');
      cy.get('input[name="purchase_price_cents"]').type('15000000'); // $150,000
      cy.get('input[name="purchase_date"]').type('2024-01-15');
      cy.get('input[name="useful_life_years"]').type('10');
      cy.get('select[name="depreciation_method"]').select('straight-line');
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar creación
      cy.contains('activo agregado').should('be.visible');
      cy.contains('Sillón dental').should('be.visible');
    });

    it('should calculate depreciation automatically', () => {
      cy.visit('/assets');
      cy.wait(1000);
      
      // Ver detalles de activo
      cy.get('[data-cy="asset-row"]').first().click();
      
      // Verificar cálculos de depreciación
      cy.get('[data-cy="monthly-depreciation"]').should('be.visible');
      cy.get('[data-cy="accumulated-depreciation"]').should('be.visible');
      cy.get('[data-cy="book-value"]').should('be.visible');
    });

    it('should include depreciation in fixed costs', () => {
      cy.visit('/fixed-costs');
      cy.wait(1000);
      
      // Verificar que la depreciación aparece
      cy.get('[data-cy="depreciation-total"]').should('be.visible');
      cy.contains('Depreciación').should('be.visible');
      
      // Verificar impacto en total
      cy.get('[data-cy="total-including-depreciation"]').should('be.visible');
    });
  });

  describe('Advanced Configuration', () => {
    it('should configure tax rates and regulations', () => {
      cy.visit('/settings/taxes');
      cy.wait(1000);
      
      // Configurar impuestos
      cy.get('input[name="iva_rate"]').clear().type('16'); // 16% IVA
      cy.get('input[name="isr_rate"]').clear().type('30'); // 30% ISR
      cy.get('select[name="tax_regime"]').select('general');
      
      cy.contains('button', 'Guardar configuración').click();
      
      // Verificar guardado
      cy.contains('configuración fiscal guardada').should('be.visible');
    });

    it('should configure business rules and policies', () => {
      cy.visit('/settings/business-rules');
      cy.wait(1000);
      
      // Configurar reglas de negocio
      cy.get('input[name="min_appointment_duration"]').type('15');
      cy.get('input[name="max_appointment_duration"]').type('240');
      cy.get('input[name="appointment_buffer_minutes"]').type('10');
      cy.get('select[name="cancellation_policy"]').select('24-hours');
      
      cy.contains('button', 'Guardar reglas').click();
      
      // Verificar aplicación de reglas
      cy.contains('reglas guardadas').should('be.visible');
    });

    it('should configure notification preferences', () => {
      cy.visit('/settings/notifications');
      cy.wait(1000);
      
      // Configurar notificaciones
      cy.get('checkbox[name="email_appointments"]').check();
      cy.get('checkbox[name="sms_reminders"]').check();
      cy.get('checkbox[name="low_stock_alerts"]').check();
      cy.get('input[name="stock_threshold"]').type('10');
      
      cy.contains('button', 'Guardar preferencias').click();
      
      // Verificar configuración
      cy.contains('preferencias guardadas').should('be.visible');
    });
  });

  describe('Integration Settings', () => {
    it('should configure payment gateway settings', () => {
      cy.visit('/settings/payments');
      cy.wait(1000);
      
      // Configurar gateway de pagos
      cy.get('select[name="payment_provider"]').select('stripe');
      cy.get('input[name="public_key"]').type('pk_test_example');
      cy.get('input[name="webhook_url"]').type('https://example.com/webhook');
      
      cy.contains('button', 'Guardar configuración').click();
      
      // Verificar conexión
      cy.contains('button', 'Probar conexión').click();
      cy.contains('conexión exitosa').should('be.visible');
    });

    it('should configure backup and sync settings', () => {
      cy.visit('/settings/backup');
      cy.wait(1000);
      
      // Configurar respaldos automáticos
      cy.get('checkbox[name="auto_backup"]').check();
      cy.get('select[name="backup_frequency"]').select('daily');
      cy.get('input[name="backup_time"]').type('02:00');
      cy.get('select[name="backup_retention"]').select('30-days');
      
      cy.contains('button', 'Guardar configuración').click();
      
      // Probar respaldo manual
      cy.contains('button', 'Crear respaldo ahora').click();
      cy.contains('respaldo creado').should('be.visible');
    });
  });

  describe('Performance and Cost Analysis', () => {
    it('should show cost impact analysis', () => {
      cy.visit('/analytics/costs');
      cy.wait(1000);
      
      // Verificar análisis de costos
      cy.get('[data-cy="cost-breakdown-chart"]').should('be.visible');
      cy.get('[data-cy="cost-per-service"]').should('be.visible');
      cy.get('[data-cy="monthly-cost-trend"]').should('be.visible');
    });

    it('should simulate cost scenarios', () => {
      cy.visit('/analytics/scenarios');
      cy.wait(1000);
      
      // Crear escenario de simulación
      cy.contains('button', 'Nuevo escenario').click();
      cy.get('input[name="scenario_name"]').type('Expansión clínica');
      
      // Modificar costos en simulación
      cy.get('input[name="sim_rent"]').type('2000000'); // Aumentar renta
      cy.get('input[name="sim_staff"]').type('4000000'); // Más personal
      
      cy.contains('button', 'Calcular impacto').click();
      
      // Verificar resultados
      cy.get('[data-cy="scenario-results"]').should('be.visible');
      cy.get('[data-cy="new-breakeven"]').should('be.visible');
    });

    it('should optimize cost allocation', () => {
      cy.visit('/analytics/optimization');
      cy.wait(1000);
      
      // Ejecutar análisis de optimización
      cy.contains('button', 'Analizar optimización').click();
      
      // Verificar recomendaciones
      cy.get('[data-cy="optimization-suggestions"]').should('be.visible');
      cy.contains('Recomendaciones').should('be.visible');
      cy.get('[data-cy="potential-savings"]').should('be.visible');
    });
  });

  describe('Data Validation and Consistency', () => {
    it('should validate configuration consistency', () => {
      cy.visit('/settings/validation');
      cy.wait(1000);
      
      // Ejecutar validación de configuración
      cy.contains('button', 'Validar configuración').click();
      
      // Verificar resultado de validación
      cy.get('[data-cy="validation-results"]').should('be.visible');
      cy.contains('Validación completada').should('be.visible');
    });

    it('should detect configuration conflicts', () => {
      // Crear configuración conflictiva
      cy.visit('/settings/time');
      cy.get('input[name="real_pct"]').clear().type('110'); // Imposible
      
      cy.visit('/settings/validation');
      cy.contains('button', 'Validar configuración').click();
      
      // Verificar detección de conflictos
      cy.contains('Conflictos detectados').should('be.visible');
      cy.get('[data-cy="validation-errors"]').should('be.visible');
    });

    it('should suggest configuration improvements', () => {
      cy.visit('/settings/recommendations');
      cy.wait(1000);
      
      // Obtener recomendaciones
      cy.contains('button', 'Generar recomendaciones').click();
      
      // Verificar sugerencias
      cy.get('[data-cy="config-recommendations"]').should('be.visible');
      cy.contains('Recomendaciones').should('be.visible');
    });
  });

  describe('Import/Export Configuration', () => {
    it('should export complete configuration', () => {
      cy.visit('/settings/export');
      cy.wait(1000);
      
      // Exportar configuración
      cy.get('checkbox[name="include_time_settings"]').check();
      cy.get('checkbox[name="include_fixed_costs"]').check();
      cy.get('checkbox[name="include_business_rules"]').check();
      
      cy.contains('button', 'Exportar configuración').click();
      
      // Verificar exportación
      cy.contains('configuración exportada').should('be.visible');
    });

    it('should import configuration with validation', () => {
      cy.visit('/settings/import');
      cy.wait(1000);
      
      // Importar configuración
      cy.get('input[type="file"]').selectFile('cypress/fixtures/config-backup.json');
      
      // Verificar validación antes de importar
      cy.contains('Validar antes de importar').should('be.visible');
      cy.contains('button', 'Validar e importar').click();
      
      // Verificar resultado
      cy.contains('configuración importada').should('be.visible');
    });
  });
});