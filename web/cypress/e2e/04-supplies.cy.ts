describe('Supplies Management Module', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/supplies');
    cy.wait(1000);
  });

  describe('Supplies Listing and Overview', () => {
    it('should display supplies page correctly', () => {
      cy.contains('Insumos').should('be.visible');
      cy.get('[data-cy="add-supply-button"]').or('button:contains("Agregar")').should('be.visible');
      cy.get('[data-cy="supplies-table"]').should('exist');
    });

    it('should show supplies statistics', () => {
      // Verificar estadísticas de inventario
      cy.get('[data-cy="total-supplies"]').should('be.visible');
      cy.get('[data-cy="low-stock-alert"]').should('exist');
      cy.get('[data-cy="total-inventory-value"]').should('be.visible');
    });

    it('should display empty state appropriately', () => {
      cy.get('body').then($body => {
        if ($body.find('[data-cy="supply-row"]').length === 0) {
          cy.get('[data-cy="empty-state"]').should('be.visible');
          cy.contains('insumos').should('be.visible');
          cy.contains('Agregar').should('be.visible');
        }
      });
    });
  });

  describe('Supply Creation', () => {
    it('should create a new supply with complete information', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      const testSupply = {
        name: 'Pasta Profiláctica Premium',
        unit: 'tubo',
        quantity_per_unit: 1,
        cost_per_unit_cents: 15000, // $150
        supplier: 'Dental Supply Co.',
        category: 'prophylaxis'
      };
      
      // Llenar formulario básico
      cy.fillSupplyForm(testSupply);
      
      // Información adicional
      cy.get('input[name="supplier"]').type(testSupply.supplier);
      cy.get('select[name="category"]').select(testSupply.category);
      
      // Guardar
      cy.contains('button', 'Guardar').click();
      
      // Verificar creación exitosa
      cy.contains('exitoso').or('creado').should('be.visible');
      cy.contains(testSupply.name).should('be.visible');
    });

    it('should validate required fields', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Intentar guardar sin campos requeridos
      cy.contains('button', 'Guardar').click();
      
      // Verificar validaciones
      cy.contains('requerido').or('required').should('be.visible');
    });

    it('should validate numeric fields', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Llenar con valores inválidos
      cy.get('input[name="name"]').type('Test Supply');
      cy.get('input[name="unit"]').type('unidad');
      cy.get('input[name="quantity_per_unit"]').type('-5'); // Negativo
      cy.get('input[name="cost_per_unit_cents"]').type('abc'); // No numérico
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar validación numérica
      cy.contains('válido').or('number').should('be.visible');
    });

    it('should calculate cost per portion automatically', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Llenar campos que afectan cálculo
      cy.get('input[name="quantity_per_unit"]').type('100');
      cy.get('input[name="cost_per_unit_cents"]').type('50000'); // $500
      
      // Verificar cálculo automático
      cy.get('[data-cy="cost-per-portion"]').should('contain', '5.00'); // $5 por porción
    });
  });

  describe('Supply Inventory Management', () => {
    beforeEach(() => {
      // Crear insumo de prueba si no existe
      cy.get('body').then($body => {
        if ($body.find('[data-cy="supply-row"]').length === 0) {
          cy.contains('button', 'Agregar').click();
          cy.fillSupplyForm({
            name: 'Guantes de Látex',
            unit: 'caja',
            quantity_per_unit: 100,
            cost_per_unit_cents: 25000
          });
          cy.contains('button', 'Guardar').click();
          cy.wait(1000);
        }
      });
    });

    it('should update stock levels', () => {
      // Hacer clic en gestión de inventario
      cy.get('[data-cy="manage-stock"]').first().click()
        .or(() => {
          cy.get('[data-cy="supply-row"]').first().click();
          cy.contains('Inventario').click();
        });
      
      // Agregar stock
      cy.contains('button', 'Agregar stock').click();
      cy.get('input[name="quantity"]').type('50');
      cy.get('input[name="cost_cents"]').type('25000');
      cy.contains('button', 'Confirmar').click();
      
      // Verificar actualización
      cy.contains('actualizado').should('be.visible');
    });

    it('should track stock movements', () => {
      cy.get('[data-cy="supply-row"]').first().click();
      cy.contains('Movimientos').or('Historial').click();
      
      // Verificar tabla de movimientos
      cy.get('[data-cy="stock-movements"]').should('be.visible');
      cy.contains('Entrada').or('Salida').should('be.visible');
    });

    it('should alert on low stock', () => {
      // Configurar alerta de stock bajo
      cy.get('[data-cy="supply-row"]').first().click();
      cy.contains('Editar').click();
      
      cy.get('input[name="min_stock"]').clear().type('10');
      cy.contains('button', 'Guardar').click();
      
      // Verificar que aparece alerta si stock es bajo
      cy.visit('/supplies');
      cy.get('[data-cy="low-stock-alert"]').should('be.visible');
    });

    it('should calculate inventory value correctly', () => {
      // Verificar cálculo de valor total
      cy.get('[data-cy="total-inventory-value"]').should('be.visible');
      cy.get('[data-cy="total-inventory-value"]').should('contain', '$');
      
      // Verificar desglose por categoría
      cy.get('[data-cy="category-breakdown"]').should('be.visible');
    });
  });

  describe('Supply Categories and Organization', () => {
    it('should filter supplies by category', () => {
      cy.get('[data-cy="category-filter"]').select('prophylaxis');
      cy.wait(500);
      
      // Verificar que solo se muestran insumos de esa categoría
      cy.get('[data-cy="supply-row"]').each($row => {
        cy.wrap($row).should('contain', 'Profiláctica')
          .or('have.attr', 'data-category', 'prophylaxis');
      });
    });

    it('should create custom categories', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Buscar opción de nueva categoría
      cy.get('select[name="category"]').then($select => {
        if ($select.find('option[value="custom"]').length > 0) {
          cy.wrap($select).select('custom');
          cy.get('input[name="custom_category"]').type('Categoría Personalizada');
        }
      });
    });

    it('should sort supplies by different criteria', () => {
      // Ordenar por nombre
      cy.get('[data-cy="sort-by-name"]').click();
      cy.wait(500);
      
      // Verificar orden alfabético
      cy.get('[data-cy="supply-name"]').then($names => {
        const names = [...$names].map(el => el.textContent);
        const sortedNames = [...names].sort();
        expect(names).to.deep.equal(sortedNames);
      });
    });
  });

  describe('Supply Costs and Pricing', () => {
    it('should track price history', () => {
      cy.get('[data-cy="supply-row"]').first().click();
      cy.contains('Precios').or('Historial de precios').click();
      
      // Verificar historial de precios
      cy.get('[data-cy="price-history"]').should('be.visible');
      cy.contains('Precio anterior').should('exist');
    });

    it('should update supply costs', () => {
      cy.get('[data-cy="supply-row"]').first().click();
      cy.contains('Editar').click();
      
      // Cambiar precio
      const newPrice = '30000'; // $300
      cy.get('input[name="cost_per_unit_cents"]').clear().type(newPrice);
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar actualización
      cy.contains('actualizado').should('be.visible');
      cy.contains('300').should('be.visible');
    });

    it('should calculate impact on service costs', () => {
      // Cambiar precio de insumo
      cy.get('[data-cy="supply-row"]').first().click();
      cy.contains('Editar').click();
      
      cy.get('input[name="cost_per_unit_cents"]').clear().type('40000');
      cy.contains('button', 'Guardar').click();
      
      // Verificar alerta de impacto en servicios
      cy.contains('afectará').or('impact').should('be.visible');
    });
  });

  describe('Supply Usage Analytics', () => {
    it('should show usage statistics', () => {
      cy.get('[data-cy="supply-row"]').first().click();
      cy.contains('Estadísticas').or('Analytics').click();
      
      // Verificar métricas de uso
      cy.get('[data-cy="usage-chart"]').should('be.visible');
      cy.contains('Consumo mensual').should('be.visible');
    });

    it('should predict stock needs', () => {
      cy.get('[data-cy="supply-row"]').first().click();
      cy.contains('Predicción').or('Forecast').click();
      
      // Verificar predicciones
      cy.get('[data-cy="stock-prediction"]').should('be.visible');
      cy.contains('días restantes').should('be.visible');
    });

    it('should show top consuming supplies', () => {
      cy.visit('/supplies/analytics');
      cy.wait(1000);
      
      // Verificar ranking de consumo
      cy.get('[data-cy="top-supplies"]').should('be.visible');
      cy.contains('Más utilizados').should('be.visible');
    });
  });

  describe('Supplier Management', () => {
    it('should manage supplier information', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Agregar nuevo proveedor
      cy.get('input[name="supplier"]').type('Nuevo Proveedor S.A.');
      cy.get('input[name="supplier_contact"]').type('contacto@proveedor.com');
      cy.get('input[name="supplier_phone"]').type('+52 555-000-0000');
      
      // Guardar con nuevo proveedor
      cy.get('input[name="name"]').type('Insumo de Nuevo Proveedor');
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('5000');
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar que se guardó proveedor
      cy.contains('Nuevo Proveedor').should('be.visible');
    });

    it('should filter supplies by supplier', () => {
      cy.get('[data-cy="supplier-filter"]').select('Dental Supply Co.');
      cy.wait(500);
      
      // Verificar filtrado
      cy.get('[data-cy="supply-row"]').each($row => {
        cy.wrap($row).should('contain', 'Dental Supply');
      });
    });
  });

  describe('Supply Import/Export', () => {
    it('should export supplies to CSV', () => {
      cy.get('[data-cy="export-button"]').click();
      cy.contains('CSV').click();
      
      // Verificar descarga
      cy.contains('descarga').or('exportando').should('be.visible');
    });

    it('should validate CSV import format', () => {
      cy.get('[data-cy="import-button"]').click();
      
      // Subir archivo de ejemplo
      cy.get('input[type="file"]').selectFile('cypress/fixtures/supplies-invalid.csv');
      
      // Verificar validación
      cy.contains('formato').or('error').should('be.visible');
    });

    it('should import supplies from valid CSV', () => {
      cy.get('[data-cy="import-button"]').click();
      
      // Subir archivo válido
      cy.get('input[type="file"]').selectFile('cypress/fixtures/supplies-valid.csv');
      cy.contains('button', 'Importar').click();
      
      // Verificar importación exitosa
      cy.contains('importados').should('be.visible');
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large supply lists efficiently', () => {
      // Verificar paginación
      cy.get('[data-cy="pagination"]').should('be.visible');
      
      // Cambiar página
      cy.get('[data-cy="next-page"]').click();
      cy.get('[data-cy="supply-row"]').should('be.visible');
    });

    it('should search supplies quickly', () => {
      const startTime = Date.now();
      
      cy.get('input[placeholder*="Buscar"]').type('Pasta');
      cy.get('[data-cy="supply-row"]').should('be.visible');
      
      cy.then(() => {
        const searchTime = Date.now() - startTime;
        expect(searchTime).to.be.lessThan(1000); // Menos de 1 segundo
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should work on mobile devices', () => {
      cy.viewport('iphone-6');
      
      // Verificar que los elementos se adaptan
      cy.get('[data-cy="supplies-table"]').should('be.visible');
      cy.contains('button', 'Agregar').should('be.visible');
      
      // Verificar navegación móvil
      cy.get('[data-cy="mobile-menu"]').click();
      cy.contains('Insumos').should('be.visible');
    });

    it('should handle touch interactions', () => {
      cy.viewport('ipad-2');
      
      // Verificar gestos táctiles
      cy.get('[data-cy="supply-row"]').first().tap();
      cy.get('[data-cy="supply-details"]').should('be.visible');
    });
  });
});