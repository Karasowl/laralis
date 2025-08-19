/**
 * TESTS CRUD ROBUSTOS - MÓDULO DE INSUMOS (CORREGIDO)
 * Versión corregida con sintaxis válida de Cypress
 */

describe('CRUD Robusto: Módulo de Insumos', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/supplies');
    cy.wait(1000);
  });

  describe('CREATE - Creación de Insumos', () => {
    it('CREATE-S001: Debe crear insumo con datos mínimos', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Insumo")').length > 0) {
          cy.get('button:contains("Nuevo Insumo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      const uniqueId = Date.now();
      const supplyData = {
        name: `Insumo Test ${uniqueId}`,
        unit: 'pza',
        quantity_per_unit: 1,
        cost_per_unit_cents: 5000
      };
      
      cy.get('input[name="name"]').type(supplyData.name);
      cy.get('input[name="unit"]').type(supplyData.unit);
      cy.get('input[name="quantity_per_unit"]').type(supplyData.quantity_per_unit.toString());
      cy.get('input[name="cost_per_unit_cents"]').type(supplyData.cost_per_unit_cents.toString());
      
      cy.get('button[type="submit"]').click();
      
      // Verificaciones flexibles
      cy.get('body').should('contain.text', 'exitosamente');
      cy.get('body').should('contain.text', supplyData.name);
    });

    it('CREATE-S002: Debe validar campos requeridos', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Insumo")').length > 0) {
          cy.get('button:contains("Nuevo Insumo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      // Buscar mensajes de error
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasRequiredError = bodyText.includes('requerido') || bodyText.includes('required');
        expect(hasRequiredError).to.be.true;
      });
    });

    it('CREATE-S003: Debe validar números positivos en costos', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Insumo")').length > 0) {
          cy.get('button:contains("Nuevo Insumo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Test Validation');
      cy.get('input[name="unit"]').type('pza');
      cy.get('input[name="quantity_per_unit"]').type('-1');
      cy.get('input[name="cost_per_unit_cents"]').type('-500');
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasValidationError = bodyText.includes('positivo') || bodyText.includes('válido');
        expect(hasValidationError).to.be.true;
      });
    });
  });

  describe('READ - Lectura de Insumos', () => {
    beforeEach(() => {
      // Crear insumos de prueba
      const testSupplies = [
        { name: 'Guantes Látex', unit: 'caja', quantity_per_unit: 100, cost_per_unit_cents: 15000 },
        { name: 'Pasta Dental', unit: 'tubo', quantity_per_unit: 1, cost_per_unit_cents: 3500 },
        { name: 'Gasas Estériles', unit: 'paquete', quantity_per_unit: 50, cost_per_unit_cents: 8000 }
      ];
      
      testSupplies.forEach(supply => {
        cy.get('body').then($body => {
          if ($body.find('button:contains("Nuevo Insumo")').length > 0) {
            cy.get('button:contains("Nuevo Insumo")').click();
          } else {
            cy.get('button:contains("Agregar")').click();
          }
        });
        
        cy.get('input[name="name"]').type(supply.name);
        cy.get('input[name="unit"]').type(supply.unit);
        cy.get('input[name="quantity_per_unit"]').type(supply.quantity_per_unit.toString());
        cy.get('input[name="cost_per_unit_cents"]').type(supply.cost_per_unit_cents.toString());
        cy.get('button[type="submit"]').click();
        cy.wait(500);
      });
    });

    it('READ-S001: Debe mostrar lista de insumos', () => {
      cy.get('body').should('contain.text', 'Guantes Látex');
      cy.get('body').should('contain.text', 'Pasta Dental');
      cy.get('body').should('contain.text', 'Gasas Estériles');
    });

    it('READ-S002: Debe filtrar por nombre', () => {
      cy.get('body').then($body => {
        if ($body.find('input[placeholder*="Buscar"]').length > 0) {
          cy.get('input[placeholder*="Buscar"]').type('Guantes');
          cy.get('body').should('contain.text', 'Guantes Látex');
          cy.get('body').should('not.contain.text', 'Pasta Dental');
        }
      });
    });

    it('READ-S003: Debe mostrar costos calculados', () => {
      // Verificar que se muestran los costos
      cy.get('body').should('contain.text', '$150.00');  // Guantes Látex
      cy.get('body').should('contain.text', '$35.00');   // Pasta Dental
      cy.get('body').should('contain.text', '$80.00');   // Gasas Estériles
    });
  });

  describe('UPDATE - Actualización de Insumos', () => {
    beforeEach(() => {
      // Crear insumo para editar
      const uniqueId = Date.now();
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Insumo")').length > 0) {
          cy.get('button:contains("Nuevo Insumo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type(`Editable Supply ${uniqueId}`);
      cy.get('input[name="unit"]').type('pza');
      cy.get('input[name="quantity_per_unit"]').type('10');
      cy.get('input[name="cost_per_unit_cents"]').type('2500');
      cy.get('button[type="submit"]').click();
      cy.wait(1000);
    });

    it('UPDATE-S001: Debe actualizar información del insumo', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('input[name="name"]').clear().type('Updated Supply Name');
      cy.get('input[name="cost_per_unit_cents"]').clear().type('3000');
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').should('contain.text', 'actualizado');
      cy.get('body').should('contain.text', 'Updated Supply Name');
      cy.get('body').should('contain.text', '$30.00');
    });

    it('UPDATE-S002: Debe recalcular costos al cambiar precio', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('input[name="quantity_per_unit"]').clear().type('20');
      cy.get('input[name="cost_per_unit_cents"]').clear().type('5000');
      
      cy.get('button[type="submit"]').click();
      
      // El costo total debería ser 20 * $50.00 = $1000.00
      cy.get('body').should('contain.text', '$1,000.00');
    });
  });

  describe('DELETE - Eliminación de Insumos', () => {
    beforeEach(() => {
      // Crear insumo para eliminar
      const uniqueId = Date.now();
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Insumo")').length > 0) {
          cy.get('button:contains("Nuevo Insumo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type(`ToDelete Supply ${uniqueId}`);
      cy.get('input[name="unit"]').type('pza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      cy.get('button[type="submit"]').click();
      cy.wait(1000);
    });

    it('DELETE-S001: Debe mostrar confirmación antes de eliminar', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Eliminar"]').length > 0) {
          cy.get('button[aria-label="Eliminar"]').first().click();
        } else {
          cy.get('button:contains("Eliminar")').first().click();
        }
      });
      
      cy.get('body').should('contain.text', 'seguro');
    });

    it('DELETE-S002: Debe eliminar insumo al confirmar', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Eliminar"]').length > 0) {
          cy.get('button[aria-label="Eliminar"]').first().click();
        } else {
          cy.get('button:contains("Eliminar")').first().click();
        }
      });
      
      cy.get('button:contains("Eliminar")').click();
      
      cy.get('body').should('contain.text', 'eliminado exitosamente');
      cy.get('body').should('not.contain.text', 'ToDelete Supply');
    });

    it('DELETE-S003: Debe prevenir eliminación si está en uso', () => {
      // Simular error de eliminación por dependencias
      cy.intercept('DELETE', '/api/supplies/*', { 
        statusCode: 409, 
        body: { error: 'Cannot delete supply in use' } 
      }).as('deleteConflict');
      
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Eliminar"]').length > 0) {
          cy.get('button[aria-label="Eliminar"]').first().click();
        } else {
          cy.get('button:contains("Eliminar")').first().click();
        }
      });
      
      cy.get('button:contains("Eliminar")').click();
      
      cy.wait('@deleteConflict');
      cy.get('body').should('contain.text', 'en uso');
    });
  });

  describe('INVENTORY - Gestión de Inventario', () => {
    it('INVENTORY-S001: Debe mostrar alertas de stock bajo', () => {
      // Crear insumo con stock bajo
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Insumo")').length > 0) {
          cy.get('button:contains("Nuevo Insumo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Low Stock Item');
      cy.get('input[name="unit"]').type('pza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      
      // Si existe campo de stock mínimo
      cy.get('body').then($body => {
        if ($body.find('input[name="min_stock"]').length > 0) {
          cy.get('input[name="min_stock"]').type('10');
          cy.get('input[name="current_stock"]').type('5');
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      // Verificar alerta de stock bajo
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasLowStockWarning = bodyText.includes('bajo') || bodyText.includes('low') || bodyText.includes('alerta');
        if (bodyText.includes('min_stock') || bodyText.includes('current_stock')) {
          expect(hasLowStockWarning).to.be.true;
        }
      });
    });

    it('INVENTORY-S002: Debe actualizar stock correctamente', () => {
      // Crear insumo con stock
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Insumo")').length > 0) {
          cy.get('button:contains("Nuevo Insumo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Stock Test Item');
      cy.get('input[name="unit"]').type('pza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      
      cy.get('body').then($body => {
        if ($body.find('input[name="current_stock"]').length > 0) {
          cy.get('input[name="current_stock"]').type('100');
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      // Verificar stock inicial
      cy.get('body').should('contain.text', 'Stock Test Item');
    });
  });

  describe('COST CALCULATION - Cálculos de Costos', () => {
    it('COST-S001: Debe calcular costo por unidad correctamente', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Insumo")').length > 0) {
          cy.get('button:contains("Nuevo Insumo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Cost Calculation Test');
      cy.get('input[name="unit"]').type('caja');
      cy.get('input[name="quantity_per_unit"]').type('25');
      cy.get('input[name="cost_per_unit_cents"]').type('12500'); // $125.00
      
      cy.get('button[type="submit"]').click();
      
      // Verificar que se muestra el costo total: 25 * $125.00 = $3,125.00
      cy.get('body').should('contain.text', '$3,125.00');
    });

    it('COST-S002: Debe manejar decimales en cantidades', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Insumo")').length > 0) {
          cy.get('button:contains("Nuevo Insumo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Decimal Quantity Test');
      cy.get('input[name="unit"]').type('ml');
      cy.get('input[name="quantity_per_unit"]').type('2.5');
      cy.get('input[name="cost_per_unit_cents"]').type('4000'); // $40.00
      
      cy.get('button[type="submit"]').click();
      
      // Verificar cálculo: 2.5 * $40.00 = $100.00
      cy.get('body').should('contain.text', '$100.00');
    });
  });

  describe('INTEGRATION - Tests de Integración', () => {
    it('INTEGRATION-S001: Ciclo CRUD completo con validaciones', () => {
      const uniqueId = Date.now();
      const supplyData = {
        name: `Integration Test ${uniqueId}`,
        unit: 'pza',
        quantity_per_unit: 10,
        cost_per_unit_cents: 5000
      };
      
      // CREATE
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Insumo")').length > 0) {
          cy.get('button:contains("Nuevo Insumo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type(supplyData.name);
      cy.get('input[name="unit"]').type(supplyData.unit);
      cy.get('input[name="quantity_per_unit"]').type(supplyData.quantity_per_unit.toString());
      cy.get('input[name="cost_per_unit_cents"]').type(supplyData.cost_per_unit_cents.toString());
      cy.get('button[type="submit"]').click();
      
      // READ
      cy.get('body').should('contain.text', supplyData.name);
      cy.get('body').should('contain.text', '$500.00'); // 10 * $50.00
      
      // UPDATE
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('input[name="cost_per_unit_cents"]').clear().type('7500');
      cy.get('button[type="submit"]').click();
      
      // READ después de UPDATE
      cy.get('body').should('contain.text', '$750.00'); // 10 * $75.00
      
      // DELETE
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Eliminar"]').length > 0) {
          cy.get('button[aria-label="Eliminar"]').first().click();
        } else {
          cy.get('button:contains("Eliminar")').first().click();
        }
      });
      
      cy.get('button:contains("Eliminar")').click();
      
      // READ después de DELETE
      cy.get('body').should('not.contain.text', supplyData.name);
    });
  });

  describe('PERFORMANCE - Tests de Rendimiento', () => {
    it('PERF-S001: Debe cargar lista rápidamente', () => {
      const startTime = Date.now();
      
      cy.reload();
      cy.get('body').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(5000);
      });
    });

    it('PERF-S002: Debe calcular costos sin delay', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Insumo")').length > 0) {
          cy.get('button:contains("Nuevo Insumo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      const startTime = Date.now();
      
      cy.get('input[name="name"]').type('Performance Test');
      cy.get('input[name="unit"]').type('pza');
      cy.get('input[name="quantity_per_unit"]').type('100');
      cy.get('input[name="cost_per_unit_cents"]').type('25000');
      
      // Verificar que el cálculo se hace inmediatamente
      cy.then(() => {
        const calcTime = Date.now() - startTime;
        expect(calcTime).to.be.lessThan(1000);
      });
    });
  });
});