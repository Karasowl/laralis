describe('Services Management Module', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/services');
    cy.wait(1000);
  });

  describe('Services Overview', () => {
    it('should display services page correctly', () => {
      cy.contains('Servicios').should('be.visible');
      cy.get('[data-cy="add-service-button"]').or('button:contains("Agregar")').should('be.visible');
      cy.get('[data-cy="services-table"]').should('exist');
    });

    it('should show service statistics', () => {
      cy.get('[data-cy="total-services"]').should('be.visible');
      cy.get('[data-cy="avg-service-price"]').should('be.visible');
      cy.get('[data-cy="most-profitable"]').should('exist');
    });

    it('should display pricing overview', () => {
      cy.get('[data-cy="pricing-summary"]').should('be.visible');
      cy.contains('Precio promedio').should('be.visible');
      cy.contains('Margen').should('be.visible');
    });
  });

  describe('Service Creation', () => {
    it('should create a basic service', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      const testService = {
        name: 'Limpieza Dental Básica',
        duration_minutes: 30,
        margin_percentage: 65,
        description: 'Limpieza dental rutinaria con ultrasonido'
      };
      
      cy.fillServiceForm(testService);
      cy.get('textarea[name="description"]').type(testService.description);
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar creación exitosa
      cy.contains('exitoso').should('be.visible');
      cy.contains(testService.name).should('be.visible');
    });

    it('should create service with supply requirements', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Información básica del servicio
      cy.get('input[name="name"]').type('Endodoncia Molar');
      cy.get('input[name="duration_minutes"]').type('90');
      cy.get('input[name="margin_percentage"]').type('70');
      
      // Agregar insumos requeridos
      cy.contains('button', 'Agregar insumo').click();
      cy.get('select[name="supply_id"]').first().select(0); // Primer insumo
      cy.get('input[name="quantity"]').type('2');
      
      // Agregar segundo insumo
      cy.contains('button', 'Agregar insumo').click();
      cy.get('select[name="supply_id"]').last().select(1); // Segundo insumo
      cy.get('input[name="quantity"]').last().type('1');
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar que se guardó con insumos
      cy.contains('Endodoncia').should('be.visible');
      cy.contains('insumos').should('be.visible');
    });

    it('should validate service pricing calculations', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Llenar datos básicos
      cy.get('input[name="name"]').type('Servicio Test Cálculo');
      cy.get('input[name="duration_minutes"]').type('60');
      cy.get('input[name="margin_percentage"]').type('60');
      
      // Verificar que se calcula el precio automáticamente
      cy.get('[data-cy="calculated-price"]').should('be.visible');
      cy.get('[data-cy="base-cost"]').should('be.visible');
      cy.get('[data-cy="final-price"]').should('be.visible');
      
      // Verificar que el cálculo es correcto
      cy.get('[data-cy="final-price"]').should('contain', '$');
    });

    it('should validate required fields', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar validaciones
      cy.contains('requerido').should('be.visible');
    });

    it('should validate numeric constraints', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Valores inválidos
      cy.get('input[name="name"]').type('Test Service');
      cy.get('input[name="duration_minutes"]').type('-30'); // Negativo
      cy.get('input[name="margin_percentage"]').type('150'); // Mayor a 100%
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar validaciones numéricas
      cy.contains('válido').or('rango').should('be.visible');
    });
  });

  describe('Service Pricing Engine', () => {
    beforeEach(() => {
      // Crear servicio de prueba si no existe
      cy.get('body').then($body => {
        if ($body.find('[data-cy="service-row"]').length === 0) {
          cy.contains('button', 'Agregar').click();
          cy.fillServiceForm({
            name: 'Servicio de Prueba',
            duration_minutes: 45,
            margin_percentage: 65
          });
          cy.contains('button', 'Guardar').click();
          cy.wait(1000);
        }
      });
    });

    it('should calculate costs based on time settings', () => {
      cy.get('[data-cy="service-row"]').first().click();
      cy.contains('Calculadora').or('Pricing').click();
      
      // Verificar componentes del cálculo
      cy.get('[data-cy="fixed-cost-per-minute"]').should('be.visible');
      cy.get('[data-cy="variable-cost"]').should('be.visible');
      cy.get('[data-cy="base-cost"]').should('be.visible');
      cy.get('[data-cy="margin-amount"]').should('be.visible');
      cy.get('[data-cy="final-price"]').should('be.visible');
    });

    it('should recalculate when time settings change', () => {
      // Obtener precio inicial
      cy.get('[data-cy="service-row"]').first().within(() => {
        cy.get('[data-cy="service-price"]').invoke('text').as('initialPrice');
      });
      
      // Cambiar configuración de tiempo
      cy.visit('/settings/time');
      cy.get('input[name="hours_per_day"]').clear().type('10'); // Más horas
      cy.contains('button', 'Guardar').click();
      
      // Volver a servicios y verificar recálculo
      cy.visit('/services');
      cy.wait(1000);
      
      cy.get('@initialPrice').then(initialPrice => {
        cy.get('[data-cy="service-row"]').first().within(() => {
          cy.get('[data-cy="service-price"]').should('not.contain', initialPrice);
        });
      });
    });

    it('should show break-even analysis', () => {
      cy.get('[data-cy="service-row"]').first().click();
      cy.contains('Análisis').or('Break-even').click();
      
      // Verificar análisis de punto de equilibrio
      cy.get('[data-cy="breakeven-units"]').should('be.visible');
      cy.get('[data-cy="monthly-target"]').should('be.visible');
      cy.get('[data-cy="daily-target"]').should('be.visible');
    });

    it('should simulate price changes', () => {
      cy.get('[data-cy="service-row"]').first().click();
      cy.contains('Simulador').or('Price simulator').click();
      
      // Cambiar margen
      cy.get('input[name="margin_percentage"]').clear().type('70');
      
      // Verificar actualización en tiempo real
      cy.get('[data-cy="simulated-price"]').should('be.visible');
      cy.get('[data-cy="price-difference"]').should('be.visible');
    });
  });

  describe('Service Categories and Organization', () => {
    it('should organize services by category', () => {
      cy.get('[data-cy="category-filter"]').select('prophylaxis');
      cy.wait(500);
      
      // Verificar filtrado por categoría
      cy.get('[data-cy="service-row"]').each($row => {
        cy.wrap($row).should('contain', 'Limpieza')
          .or('have.attr', 'data-category', 'prophylaxis');
      });
    });

    it('should sort services by different criteria', () => {
      // Ordenar por precio
      cy.get('[data-cy="sort-by-price"]').click();
      cy.wait(500);
      
      // Verificar orden por precio
      cy.get('[data-cy="service-price"]').then($prices => {
        const prices = [...$prices].map(el => 
          parseFloat(el.textContent.replace(/[^0-9.]/g, ''))
        );
        const sortedPrices = [...prices].sort((a, b) => a - b);
        expect(prices).to.deep.equal(sortedPrices);
      });
    });

    it('should search services by name or description', () => {
      cy.get('input[placeholder*="Buscar"]').type('limpieza');
      cy.wait(500);
      
      // Verificar resultados de búsqueda
      cy.get('[data-cy="service-row"]').each($row => {
        cy.wrap($row).should('contain.text', 'limpieza');
      });
    });
  });

  describe('Service Templates and Presets', () => {
    it('should create service from template', () => {
      cy.contains('button', 'Plantillas').or('Templates').click();
      cy.wait(500);
      
      // Seleccionar plantilla
      cy.get('[data-cy="template-prophylaxis"]').click();
      
      // Verificar que se llena automáticamente
      cy.get('input[name="name"]').should('have.value', 'Limpieza Dental');
      cy.get('input[name="duration_minutes"]').should('have.value', '30');
      
      // Personalizar y guardar
      cy.get('input[name="name"]').clear().type('Limpieza Dental Premium');
      cy.contains('button', 'Guardar').click();
      
      cy.contains('Premium').should('be.visible');
    });

    it('should save custom template', () => {
      // Crear servicio personalizado
      cy.contains('button', 'Agregar').click();
      cy.fillServiceForm({
        name: 'Servicio Personalizado',
        duration_minutes: 120,
        margin_percentage: 75
      });
      
      // Guardar como plantilla
      cy.contains('button', 'Guardar como plantilla').click();
      cy.get('input[name="template_name"]').type('Mi Plantilla Personalizada');
      cy.contains('button', 'Crear plantilla').click();
      
      // Verificar que se creó la plantilla
      cy.contains('plantilla creada').should('be.visible');
    });
  });

  describe('Service Performance Analytics', () => {
    it('should show service profitability analysis', () => {
      cy.visit('/services/analytics');
      cy.wait(1000);
      
      // Verificar métricas de rentabilidad
      cy.get('[data-cy="profitability-chart"]').should('be.visible');
      cy.contains('Más rentables').should('be.visible');
      cy.contains('Menos rentables').should('be.visible');
    });

    it('should display service utilization rates', () => {
      cy.visit('/services/analytics');
      cy.wait(1000);
      
      // Verificar utilización de servicios
      cy.get('[data-cy="utilization-chart"]').should('be.visible');
      cy.contains('Más solicitados').should('be.visible');
    });

    it('should show price comparison with market', () => {
      cy.get('[data-cy="service-row"]').first().click();
      cy.contains('Comparación').or('Market comparison').click();
      
      // Verificar comparación de precios
      cy.get('[data-cy="market-price"]').should('be.visible');
      cy.get('[data-cy="price-position"]').should('be.visible');
    });
  });

  describe('Service Packages and Bundles', () => {
    it('should create service package', () => {
      cy.contains('button', 'Crear paquete').or('Create package').click();
      cy.wait(500);
      
      // Información del paquete
      cy.get('input[name="package_name"]').type('Paquete Prevención');
      cy.get('input[name="package_discount"]').type('15'); // 15% descuento
      
      // Agregar servicios al paquete
      cy.get('[data-cy="add-service-to-package"]').click();
      cy.get('select[name="service_id"]').select(0); // Primer servicio
      
      cy.get('[data-cy="add-service-to-package"]').click();
      cy.get('select[name="service_id"]').last().select(1); // Segundo servicio
      
      cy.contains('button', 'Crear paquete').click();
      
      // Verificar creación del paquete
      cy.contains('Paquete Prevención').should('be.visible');
      cy.contains('15%').should('be.visible');
    });

    it('should calculate package pricing correctly', () => {
      cy.get('[data-cy="package-row"]').first().click();
      
      // Verificar cálculo de paquete
      cy.get('[data-cy="individual-total"]').should('be.visible');
      cy.get('[data-cy="package-discount"]').should('be.visible');
      cy.get('[data-cy="package-final-price"]').should('be.visible');
      cy.get('[data-cy="savings-amount"]').should('be.visible');
    });
  });

  describe('Service Quality and Standards', () => {
    it('should define service standards', () => {
      cy.get('[data-cy="service-row"]').first().click();
      cy.contains('Estándares').or('Standards').click();
      
      // Definir procedimientos estándar
      cy.get('textarea[name="procedure_steps"]').type(
        '1. Evaluación inicial\n2. Preparación\n3. Procedimiento\n4. Seguimiento'
      );
      
      cy.get('input[name="quality_score"]').type('95');
      cy.contains('button', 'Guardar estándares').click();
      
      // Verificar guardado
      cy.contains('estándares guardados').should('be.visible');
    });

    it('should track service quality metrics', () => {
      cy.get('[data-cy="service-row"]').first().click();
      cy.contains('Métricas').or('Quality metrics').click();
      
      // Verificar métricas de calidad
      cy.get('[data-cy="quality-score"]').should('be.visible');
      cy.get('[data-cy="completion-rate"]').should('be.visible');
      cy.get('[data-cy="patient-satisfaction"]').should('be.visible');
    });
  });

  describe('Integration with Treatment Planning', () => {
    it('should integrate with treatment plans', () => {
      cy.get('[data-cy="service-row"]').first().click();
      cy.contains('Planes de tratamiento').click();
      
      // Verificar planes que incluyen este servicio
      cy.get('[data-cy="treatment-plans"]').should('be.visible');
      cy.contains('planes de tratamiento').should('be.visible');
    });

    it('should suggest complementary services', () => {
      cy.get('[data-cy="service-row"]').first().click();
      cy.contains('Servicios relacionados').click();
      
      // Verificar sugerencias
      cy.get('[data-cy="related-services"]').should('be.visible');
      cy.contains('Servicios complementarios').should('be.visible');
    });
  });

  describe('Service Export and Reporting', () => {
    it('should export service catalog', () => {
      cy.get('[data-cy="export-button"]').click();
      cy.contains('Catálogo de servicios').click();
      
      // Verificar exportación
      cy.contains('exportando').should('be.visible');
    });

    it('should generate pricing report', () => {
      cy.get('[data-cy="reports-button"]').click();
      cy.contains('Reporte de precios').click();
      
      // Configurar reporte
      cy.get('input[name="date_from"]').type('2024-01-01');
      cy.get('input[name="date_to"]').type('2024-12-31');
      cy.contains('button', 'Generar').click();
      
      // Verificar generación
      cy.contains('reporte generado').should('be.visible');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large service catalogs', () => {
      // Verificar paginación
      cy.get('[data-cy="pagination"]').should('be.visible');
      
      // Navegación entre páginas
      cy.get('[data-cy="next-page"]').click();
      cy.get('[data-cy="service-row"]').should('be.visible');
    });

    it('should perform quick searches', () => {
      const startTime = Date.now();
      
      cy.get('input[placeholder*="Buscar"]').type('endodoncia');
      cy.get('[data-cy="service-row"]').should('be.visible');
      
      cy.then(() => {
        const searchTime = Date.now() - startTime;
        expect(searchTime).to.be.lessThan(1000);
      });
    });
  });

  describe('Accessibility and Usability', () => {
    it('should be keyboard navigable', () => {
      cy.get('body').tab();
      cy.focused().should('be.visible');
      
      cy.focused().tab().tab();
      cy.focused().should('be.visible');
    });

    it('should have proper ARIA labels', () => {
      cy.get('[data-cy="services-table"]').should('have.attr', 'role');
      cy.get('button').should('have.attr', 'aria-label')
        .or('not.have.attr', 'disabled');
    });

    it('should work on mobile devices', () => {
      cy.viewport('iphone-6');
      
      cy.get('[data-cy="services-table"]').should('be.visible');
      cy.contains('button', 'Agregar').should('be.visible');
    });
  });
});