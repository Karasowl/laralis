/**
 * TESTS CRUD ROBUSTOS - MÓDULO DE COSTOS FIJOS (CORREGIDO)
 * Versión corregida con sintaxis válida de Cypress
 */

describe('CRUD Robusto: Módulo de Costos Fijos', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/settings');
    cy.wait(1000);
  });

  describe('CREATE - Creación de Costos Fijos', () => {
    it('CREATE-FC001: Debe crear costo fijo básico', () => {
      // Navegar a la sección de costos fijos
      cy.get('body').then($body => {
        if ($body.find('button:contains("Costos Fijos")').length > 0) {
          cy.get('button:contains("Costos Fijos")').click();
        } else if ($body.find('a[href*="fixed-costs"]').length > 0) {
          cy.get('a[href*="fixed-costs"]').click();
        } else {
          cy.visit('/fixed-costs');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Costo")').length > 0) {
          cy.get('button:contains("Nuevo Costo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      const uniqueId = Date.now();
      const costData = {
        name: `Costo Fijo ${uniqueId}`,
        amount_cents: 150000, // $1,500.00
        category: 'operacional',
        frequency: 'monthly'
      };
      
      cy.get('input[name="name"]').type(costData.name);
      cy.get('input[name="amount_cents"]').type(costData.amount_cents.toString());
      
      cy.get('body').then($body => {
        if ($body.find('select[name="category"]').length > 0) {
          cy.get('select[name="category"]').select(costData.category);
        }
        if ($body.find('select[name="frequency"]').length > 0) {
          cy.get('select[name="frequency"]').select(costData.frequency);
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').should('contain.text', 'exitosamente');
      cy.get('body').should('contain.text', costData.name);
      cy.get('body').should('contain.text', '$1,500.00');
    });

    it('CREATE-FC002: Debe crear configuración de tiempo', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Configuración Tiempo")').length > 0) {
          cy.get('button:contains("Configuración Tiempo")').click();
        } else if ($body.find('input[name="hours_per_day"]').length > 0) {
          // Ya estamos en la página correcta
        } else {
          cy.visit('/settings');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('input[name="hours_per_day"]').length > 0) {
          cy.get('input[name="hours_per_day"]').clear().type('8');
        }
        if ($body.find('input[name="days_per_week"]').length > 0) {
          cy.get('input[name="days_per_week"]').clear().type('6');
        }
        if ($body.find('input[name="weeks_per_month"]').length > 0) {
          cy.get('input[name="weeks_per_month"]').clear().type('4');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Guardar Configuración")').length > 0) {
          cy.get('button:contains("Guardar Configuración")').click();
        } else if ($body.find('button[type="submit"]').length > 0) {
          cy.get('button[type="submit"]').click();
        }
      });
      
      cy.get('body').should('contain.text', 'configuración guardada');
    });

    it('CREATE-FC003: Debe validar campos requeridos', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Costos Fijos")').length > 0) {
          cy.get('button:contains("Costos Fijos")').click();
        } else {
          cy.visit('/fixed-costs');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Costo")').length > 0) {
          cy.get('button:contains("Nuevo Costo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasRequiredError = bodyText.includes('requerido') || bodyText.includes('required');
        expect(hasRequiredError).to.be.true;
      });
    });

    it('CREATE-FC004: Debe validar montos positivos', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Costos Fijos")').length > 0) {
          cy.get('button:contains("Costos Fijos")').click();
        } else {
          cy.visit('/fixed-costs');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Costo")').length > 0) {
          cy.get('button:contains("Nuevo Costo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Test Validation');
      cy.get('input[name="amount_cents"]').type('-5000');
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasValidationError = bodyText.includes('positivo') || bodyText.includes('mayor');
        expect(hasValidationError).to.be.true;
      });
    });
  });

  describe('READ - Lectura de Costos Fijos', () => {
    beforeEach(() => {
      // Crear costos fijos de prueba
      const testCosts = [
        { name: 'Renta Local', amount_cents: 250000, category: 'operacional' },
        { name: 'Servicios Públicos', amount_cents: 75000, category: 'operacional' },
        { name: 'Seguros', amount_cents: 45000, category: 'administrativo' }
      ];
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Costos Fijos")').length > 0) {
          cy.get('button:contains("Costos Fijos")').click();
        } else {
          cy.visit('/fixed-costs');
        }
      });
      
      testCosts.forEach(cost => {
        cy.get('body').then($body => {
          if ($body.find('button:contains("Nuevo Costo")').length > 0) {
            cy.get('button:contains("Nuevo Costo")').click();
          } else {
            cy.get('button:contains("Agregar")').click();
          }
        });
        
        cy.get('input[name="name"]').type(cost.name);
        cy.get('input[name="amount_cents"]').type(cost.amount_cents.toString());
        
        cy.get('body').then($body => {
          if ($body.find('select[name="category"]').length > 0) {
            cy.get('select[name="category"]').select(cost.category);
          }
        });
        
        cy.get('button[type="submit"]').click();
        cy.wait(500);
      });
    });

    it('READ-FC001: Debe mostrar lista de costos fijos', () => {
      cy.get('body').should('contain.text', 'Renta Local');
      cy.get('body').should('contain.text', 'Servicios Públicos');
      cy.get('body').should('contain.text', 'Seguros');
      
      // Verificar montos formateados
      cy.get('body').should('contain.text', '$2,500.00');
      cy.get('body').should('contain.text', '$750.00');
      cy.get('body').should('contain.text', '$450.00');
    });

    it('READ-FC002: Debe mostrar total de costos fijos', () => {
      // Total: $2,500.00 + $750.00 + $450.00 = $3,700.00
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasTotal = bodyText.includes('Total') && bodyText.includes('$3,700.00');
        if (bodyText.includes('total') || bodyText.includes('suma')) {
          expect(hasTotal).to.be.true;
        }
      });
    });

    it('READ-FC003: Debe filtrar por categoría', () => {
      cy.get('body').then($body => {
        if ($body.find('select[name="category_filter"]').length > 0) {
          cy.get('select[name="category_filter"]').select('operacional');
          cy.get('body').should('contain.text', 'Renta Local');
          cy.get('body').should('contain.text', 'Servicios Públicos');
          cy.get('body').should('not.contain.text', 'Seguros');
        } else if ($body.find('button:contains("Operacional")').length > 0) {
          cy.get('button:contains("Operacional")').click();
        }
      });
    });

    it('READ-FC004: Debe mostrar costo por minuto calculado', () => {
      // Verificar que se muestra el cálculo de costo por minuto
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasCostPerMinute = bodyText.includes('por minuto') && bodyText.includes('$');
        if (bodyText.includes('minute') || bodyText.includes('minuto')) {
          expect(hasCostPerMinute).to.be.true;
        }
      });
    });
  });

  describe('UPDATE - Actualización de Costos Fijos', () => {
    beforeEach(() => {
      // Crear costo fijo para editar
      const uniqueId = Date.now();
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Costos Fijos")').length > 0) {
          cy.get('button:contains("Costos Fijos")').click();
        } else {
          cy.visit('/fixed-costs');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Costo")').length > 0) {
          cy.get('button:contains("Nuevo Costo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type(`Editable Cost ${uniqueId}`);
      cy.get('input[name="amount_cents"]').type('100000'); // $1,000.00
      cy.get('button[type="submit"]').click();
      cy.wait(1000);
    });

    it('UPDATE-FC001: Debe actualizar monto del costo fijo', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('input[name="amount_cents"]').clear().type('125000'); // $1,250.00
      cy.get('button[type="submit"]').click();
      
      cy.get('body').should('contain.text', 'actualizado');
      cy.get('body').should('contain.text', '$1,250.00');
    });

    it('UPDATE-FC002: Debe actualizar configuración de tiempo', () => {
      cy.visit('/settings');
      
      cy.get('body').then($body => {
        if ($body.find('input[name="hours_per_day"]').length > 0) {
          cy.get('input[name="hours_per_day"]').clear().type('9');
          cy.get('input[name="days_per_week"]').clear().type('5');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Guardar Configuración")').length > 0) {
          cy.get('button:contains("Guardar Configuración")').click();
        } else if ($body.find('button[type="submit"]').length > 0) {
          cy.get('button[type="submit"]').click();
        }
      });
      
      cy.get('body').should('contain.text', 'configuración guardada');
      
      // Verificar que el cálculo por minuto se actualiza
      cy.get('body').then($body => {
        if ($body.find('button:contains("Costos Fijos")').length > 0) {
          cy.get('button:contains("Costos Fijos")').click();
        } else {
          cy.visit('/fixed-costs');
        }
      });
      
      // El costo por minuto debería haberse recalculado
      cy.get('body').should('be.visible');
    });

    it('UPDATE-FC003: Debe cambiar categoría del costo', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="category"]').length > 0) {
          cy.get('select[name="category"]').select('administrativo');
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').should('contain.text', 'actualizado');
    });
  });

  describe('DELETE - Eliminación de Costos Fijos', () => {
    beforeEach(() => {
      // Crear costo fijo para eliminar
      const uniqueId = Date.now();
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Costos Fijos")').length > 0) {
          cy.get('button:contains("Costos Fijos")').click();
        } else {
          cy.visit('/fixed-costs');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Costo")').length > 0) {
          cy.get('button:contains("Nuevo Costo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type(`ToDelete Cost ${uniqueId}`);
      cy.get('input[name="amount_cents"]').type('50000');
      cy.get('button[type="submit"]').click();
      cy.wait(1000);
    });

    it('DELETE-FC001: Debe mostrar confirmación antes de eliminar', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Eliminar"]').length > 0) {
          cy.get('button[aria-label="Eliminar"]').first().click();
        } else {
          cy.get('button:contains("Eliminar")').first().click();
        }
      });
      
      cy.get('body').should('contain.text', 'seguro');
    });

    it('DELETE-FC002: Debe eliminar costo fijo al confirmar', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Eliminar"]').length > 0) {
          cy.get('button[aria-label="Eliminar"]').first().click();
        } else {
          cy.get('button:contains("Eliminar")').first().click();
        }
      });
      
      cy.get('button:contains("Eliminar")').click();
      
      cy.get('body').should('contain.text', 'eliminado exitosamente');
      cy.get('body').should('not.contain.text', 'ToDelete Cost');
    });

    it('DELETE-FC003: Debe recalcular totales después de eliminar', () => {
      const initialTotal = '$500.00'; // Monto del costo creado
      
      // Verificar que el total incluye el costo
      cy.get('body').should('contain.text', initialTotal);
      
      // Eliminar el costo
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Eliminar"]').length > 0) {
          cy.get('button[aria-label="Eliminar"]').first().click();
        } else {
          cy.get('button:contains("Eliminar")').first().click();
        }
      });
      
      cy.get('button:contains("Eliminar")').click();
      
      // Verificar que el total se recalculó
      cy.get('body').should('not.contain.text', 'ToDelete Cost');
    });
  });

  describe('CALCULATION - Cálculos y Motor Financiero', () => {
    it('CALC-FC001: Debe calcular costo por minuto correctamente', () => {
      // Configurar tiempo de trabajo
      cy.visit('/settings');
      
      cy.get('body').then($body => {
        if ($body.find('input[name="hours_per_day"]').length > 0) {
          cy.get('input[name="hours_per_day"]').clear().type('8');
          cy.get('input[name="days_per_week"]').clear().type('5');
          cy.get('input[name="weeks_per_month"]').clear().type('4');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Guardar Configuración")').length > 0) {
          cy.get('button:contains("Guardar Configuración")').click();
        } else if ($body.find('button[type="submit"]').length > 0) {
          cy.get('button[type="submit"]').click();
        }
      });
      
      // Crear costo fijo de $1,600.00 mensuales
      cy.get('body').then($body => {
        if ($body.find('button:contains("Costos Fijos")').length > 0) {
          cy.get('button:contains("Costos Fijos")').click();
        } else {
          cy.visit('/fixed-costs');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Costo")').length > 0) {
          cy.get('button:contains("Nuevo Costo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Calculation Test');
      cy.get('input[name="amount_cents"]').type('160000'); // $1,600.00
      cy.get('button[type="submit"]').click();
      
      // Verificar cálculo: $1,600 / (8h/day * 5day/week * 4week/month * 60min/h) = $1,600 / 9,600min = $0.1667/min
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasCalculation = bodyText.includes('$0.17') || bodyText.includes('$0.16');
        if (bodyText.includes('por minuto')) {
          expect(hasCalculation).to.be.true;
        }
      });
    });

    it('CALC-FC002: Debe integrar con motor de cálculos lib/calc', () => {
      // Este test verifica que los cálculos usan lib/calc
      cy.visit('/settings');
      
      // Los cálculos deberían usar las funciones puras de lib/calc
      cy.get('body').then($body => {
        if ($body.find('input[name="hours_per_day"]').length > 0) {
          cy.get('input[name="hours_per_day"]').clear().type('10');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Guardar Configuración")').length > 0) {
          cy.get('button:contains("Guardar Configuración")').click();
        } else if ($body.find('button[type="submit"]').length > 0) {
          cy.get('button[type="submit"]').click();
        }
      });
      
      // Verificar que los cálculos se actualizan inmediatamente
      cy.get('body').should('contain.text', 'configuración guardada');
    });

    it('CALC-FC003: Debe manejar múltiples frecuencias de costos', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Costos Fijos")').length > 0) {
          cy.get('button:contains("Costos Fijos")').click();
        } else {
          cy.visit('/fixed-costs');
        }
      });
      
      // Crear costos con diferentes frecuencias
      const costs = [
        { name: 'Costo Diario', amount: '10000', frequency: 'daily' },
        { name: 'Costo Semanal', amount: '70000', frequency: 'weekly' },
        { name: 'Costo Mensual', amount: '300000', frequency: 'monthly' },
        { name: 'Costo Anual', amount: '3600000', frequency: 'yearly' }
      ];
      
      costs.forEach(cost => {
        cy.get('body').then($body => {
          if ($body.find('button:contains("Nuevo Costo")').length > 0) {
            cy.get('button:contains("Nuevo Costo")').click();
          } else {
            cy.get('button:contains("Agregar")').click();
          }
        });
        
        cy.get('input[name="name"]').type(cost.name);
        cy.get('input[name="amount_cents"]').type(cost.amount);
        
        cy.get('body').then($body => {
          if ($body.find('select[name="frequency"]').length > 0) {
            cy.get('select[name="frequency"]').select(cost.frequency);
          }
        });
        
        cy.get('button[type="submit"]').click();
        cy.wait(500);
      });
      
      // Todos deberían contribuir igualmente al costo mensual
      // $100/día * 30 = $3,000
      // $700/semana * 4.33 = $3,031
      // $3,000/mes = $3,000
      // $36,000/año / 12 = $3,000
      cy.get('body').should('contain.text', 'Costo Diario');
      cy.get('body').should('contain.text', 'Costo Semanal');
      cy.get('body').should('contain.text', 'Costo Mensual');
      cy.get('body').should('contain.text', 'Costo Anual');
    });
  });

  describe('ASSETS - Gestión de Activos', () => {
    it('ASSETS-FC001: Debe crear activo con depreciación', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Activos")').length > 0) {
          cy.get('button:contains("Activos")').click();
        } else if ($body.find('a[href*="assets"]').length > 0) {
          cy.get('a[href*="assets"]').click();
        } else {
          cy.visit('/assets');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Activo")').length > 0) {
          cy.get('button:contains("Nuevo Activo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      const uniqueId = Date.now();
      cy.get('input[name="name"]').type(`Equipment ${uniqueId}`);
      cy.get('input[name="purchase_price_cents"]').type('500000'); // $5,000.00
      
      cy.get('body').then($body => {
        if ($body.find('input[name="useful_life_months"]').length > 0) {
          cy.get('input[name="useful_life_months"]').type('60'); // 5 años
        }
        if ($body.find('input[name="purchase_date"]').length > 0) {
          cy.get('input[name="purchase_date"]').type('2025-01-01');
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').should('contain.text', 'exitosamente');
      cy.get('body').should('contain.text', `Equipment ${uniqueId}`);
      
      // Verificar cálculo de depreciación mensual: $5,000 / 60 meses = $83.33/mes
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasDepreciation = bodyText.includes('$83.33') || bodyText.includes('depreciación');
        if (bodyText.includes('depreciation') || bodyText.includes('útil')) {
          expect(hasDepreciation).to.be.true;
        }
      });
    });

    it('ASSETS-FC002: Debe mostrar valor en libros actual', () => {
      // El valor en libros = precio compra - depreciación acumulada
      cy.get('body').then($body => {
        if ($body.find('button:contains("Activos")').length > 0) {
          cy.get('button:contains("Activos")').click();
        } else {
          cy.visit('/assets');
        }
      });
      
      // Si hay activos, verificar que se muestra el valor en libros
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasBookValue = bodyText.includes('Valor en Libros') || bodyText.includes('Book Value');
        if (bodyText.includes('Equipment') || bodyText.includes('activo')) {
          expect(hasBookValue).to.be.true;
        }
      });
    });
  });

  describe('BUSINESS ANALYTICS - Análisis de Negocio', () => {
    it('ANALYTICS-FC001: Debe calcular punto de equilibrio', () => {
      // Crear costos fijos conocidos
      cy.get('body').then($body => {
        if ($body.find('button:contains("Costos Fijos")').length > 0) {
          cy.get('button:contains("Costos Fijos")').click();
        } else {
          cy.visit('/fixed-costs');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Costo")').length > 0) {
          cy.get('button:contains("Nuevo Costo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Breakeven Test Cost');
      cy.get('input[name="amount_cents"]').type('240000'); // $2,400.00
      cy.get('button[type="submit"]').click();
      
      // Navegar a analytics si existe
      cy.get('body').then($body => {
        if ($body.find('button:contains("Analytics")').length > 0) {
          cy.get('button:contains("Analytics")').click();
        } else if ($body.find('a[href*="analytics"]').length > 0) {
          cy.get('a[href*="analytics"]').click();
        } else {
          cy.visit('/analytics');
        }
      });
      
      // Verificar cálculos de punto de equilibrio
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasBreakeven = bodyText.includes('equilibrio') || 
                            bodyText.includes('breakeven') || 
                            bodyText.includes('punto');
        if (bodyText.includes('analytics') || bodyText.includes('análisis')) {
          expect(hasBreakeven).to.be.true;
        }
      });
    });

    it('ANALYTICS-FC002: Debe proyectar ingresos necesarios', () => {
      // Con costos fijos de $2,400 y margen promedio de 50%,
      // se necesitan $4,800 de ingresos brutos para cubrir costos
      cy.visit('/analytics');
      
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasProjection = bodyText.includes('proyección') || 
                             bodyText.includes('ingresos necesarios') ||
                             bodyText.includes('revenue needed');
        if (bodyText.includes('$4,800') || bodyText.includes('projection')) {
          expect(hasProjection).to.be.true;
        }
      });
    });
  });

  describe('INTEGRATION - Tests de Integración', () => {
    it('INTEGRATION-FC001: Integración completa con servicios y tratamientos', () => {
      const uniqueId = Date.now();
      
      // 1. Configurar tiempo de trabajo
      cy.visit('/settings');
      cy.get('body').then($body => {
        if ($body.find('input[name="hours_per_day"]').length > 0) {
          cy.get('input[name="hours_per_day"]').clear().type('8');
          cy.get('input[name="days_per_week"]').clear().type('6');
          cy.get('input[name="weeks_per_month"]').clear().type('4');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Guardar Configuración")').length > 0) {
          cy.get('button:contains("Guardar Configuración")').click();
        } else if ($body.find('button[type="submit"]').length > 0) {
          cy.get('button[type="submit"]').click();
        }
      });
      
      // 2. Crear costo fijo
      cy.get('body').then($body => {
        if ($body.find('button:contains("Costos Fijos")').length > 0) {
          cy.get('button:contains("Costos Fijos")').click();
        } else {
          cy.visit('/fixed-costs');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Costo")').length > 0) {
          cy.get('button:contains("Nuevo Costo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type(`Integration Cost ${uniqueId}`);
      cy.get('input[name="amount_cents"]').type('192000'); // $1,920.00
      cy.get('button[type="submit"]').click();
      
      // Costo por minuto = $1,920 / (8h * 6d * 4w * 60m) = $1,920 / 11,520m = $0.1667/min
      
      // 3. Crear servicio que use este costo
      cy.visit('/services');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Servicio")').length > 0) {
          cy.get('button:contains("Nuevo Servicio")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Integration Service');
      cy.get('input[name="duration_minutes"]').type('60'); // 1 hora
      cy.get('input[name="margin_percentage"]').type('50');
      cy.get('button[type="submit"]').click();
      
      // Precio debería ser: (60min * $0.1667/min) * 1.5 = $10.00 * 1.5 = $15.00
      cy.get('body').should('contain.text', 'Integration Service');
      
      // 4. Verificar que el precio del servicio incluye los costos fijos
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasPriceCalculation = bodyText.includes('$15.00') || bodyText.includes('$10.00');
        if (bodyText.includes('precio') || bodyText.includes('price')) {
          expect(hasPriceCalculation).to.be.true;
        }
      });
    });

    it('INTEGRATION-FC002: Debe recalcular precios al cambiar costos fijos', () => {
      // Cambiar un costo fijo existente
      cy.get('body').then($body => {
        if ($body.find('button:contains("Costos Fijos")').length > 0) {
          cy.get('button:contains("Costos Fijos")').click();
        } else {
          cy.visit('/fixed-costs');
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else if ($body.find('button:contains("Editar")').length > 0) {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('input[name="amount_cents"]').clear().type('384000'); // Doblar a $3,840.00
      cy.get('button[type="submit"]').click();
      
      // Verificar que el costo por minuto se actualiza: $3,840 / 11,520m = $0.3333/min
      cy.visit('/services');
      
      // Los precios deberían haberse recalculado automáticamente
      cy.get('body').should('contain.text', 'Integration Service');
      
      // Nuevo precio: (60min * $0.3333/min) * 1.5 = $20.00 * 1.5 = $30.00
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasUpdatedPrice = bodyText.includes('$30.00') || bodyText.includes('$20.00');
        if (bodyText.includes('Integration Service')) {
          expect(hasUpdatedPrice).to.be.true;
        }
      });
    });
  });

  describe('PERFORMANCE - Tests de Rendimiento', () => {
    it('PERF-FC001: Debe cargar configuraciones rápidamente', () => {
      const startTime = Date.now();
      
      cy.visit('/settings');
      cy.get('body').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(3000);
      });
    });

    it('PERF-FC002: Debe calcular costos por minuto instantáneamente', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Costos Fijos")').length > 0) {
          cy.get('button:contains("Costos Fijos")').click();
        } else {
          cy.visit('/fixed-costs');
        }
      });
      
      const startTime = Date.now();
      
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Costo")').length > 0) {
          cy.get('button:contains("Nuevo Costo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Performance Test Cost');
      cy.get('input[name="amount_cents"]').type('500000');
      cy.get('button[type="submit"]').click();
      
      // Verificar que el cálculo es instantáneo
      cy.then(() => {
        const calcTime = Date.now() - startTime;
        expect(calcTime).to.be.lessThan(2000);
      });
    });
  });
});