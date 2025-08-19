/**
 * TESTS CRUD ROBUSTOS - MÓDULO DE INSUMOS
 * Cobertura completa de operaciones CRUD con detección de errores
 */

describe('CRUD Robusto: Módulo de Insumos', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/supplies');
    cy.wait(1000);
  });

  describe('CREATE - Creación de Insumos', () => {
    it('CREATE-S001: Debe crear insumo con datos mínimos requeridos', () => {
      cy.get('button').contains('Agregar').click();
      
      const uniqueId = Date.now();
      cy.get('input[name="name"]').type(`Insumo Test ${uniqueId}`);
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('1500'); // $15.00
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificaciones
      cy.contains('Insumo creado exitosamente').should('be.visible');
      cy.contains(`Insumo Test ${uniqueId}`).should('be.visible');
      cy.contains('$15.00').should('be.visible');
      
      // Verificar en la lista tras reload
      cy.reload();
      cy.contains(`Insumo Test ${uniqueId}`).should('be.visible');
    });

    it('CREATE-S002: Debe crear insumo con información completa', () => {
      cy.get('button').contains('Agregar').click();
      
      const uniqueId = Date.now();
      const supplyData = {
        name: `Pasta Dental Premium ${uniqueId}`,
        description: 'Pasta dental con flúor para blanqueamiento',
        unit: 'tubo',
        quantity_per_unit: '100', // ml por tubo
        cost_per_unit_cents: '2500', // $25.00
        category: 'Materiales',
        supplier: 'Dental Supply Co.',
        sku: `SKU${uniqueId}`,
        minimum_stock: '5',
        maximum_stock: '50',
        expiry_months: '24'
      };
      
      // Llenar todos los campos
      cy.get('input[name="name"]').type(supplyData.name);
      cy.get('textarea[name="description"]').type(supplyData.description);
      cy.get('input[name="unit"]').type(supplyData.unit);
      cy.get('input[name="quantity_per_unit"]').type(supplyData.quantity_per_unit);
      cy.get('input[name="cost_per_unit_cents"]').type(supplyData.cost_per_unit_cents);
      cy.get('select[name="category"]').then($select => {
        if ($select.length) {
          cy.wrap($select).select(supplyData.category);
        }
      });
      cy.get('input[name="supplier"]').type(supplyData.supplier);
      cy.get('input[name="sku"]').type(supplyData.sku);
      cy.get('input[name="minimum_stock"]').type(supplyData.minimum_stock);
      cy.get('input[name="maximum_stock"]').type(supplyData.maximum_stock);
      cy.get('input[name="expiry_months"]').type(supplyData.expiry_months);
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificaciones completas
      cy.contains('Insumo creado exitosamente').should('be.visible');
      cy.contains(supplyData.name).should('be.visible');
      cy.contains('$25.00').should('be.visible');
      cy.contains(supplyData.supplier).should('be.visible');
    });

    it('CREATE-S003: Debe validar campos requeridos', () => {
      cy.get('button').contains('Agregar').click();
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar mensajes de error
      cy.contains('El nombre es requerido').should('be.visible');
      cy.contains('La unidad es requerida').should('be.visible');
      cy.contains('La cantidad por unidad es requerida').should('be.visible');
      cy.contains('El costo por unidad es requerido').should('be.visible');
    });

    it('CREATE-S004: Debe validar que el costo sea positivo', () => {
      cy.get('button').contains('Agregar').click();
      
      cy.get('input[name="name"]').type('Insumo Costo Negativo');
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('-100');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El costo debe ser mayor a cero').should('be.visible');
    });

    it('CREATE-S005: Debe validar que la cantidad sea positiva', () => {
      cy.get('button').contains('Agregar').click();
      
      cy.get('input[name="name"]').type('Insumo Cantidad Negativa');
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('-1');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('La cantidad debe ser mayor a cero').should('be.visible');
    });

    it('CREATE-S006: Debe validar SKU único', () => {
      const sku = `DUPLICATE${Date.now()}`;
      
      // Crear primer insumo con SKU
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Primer Insumo');
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      cy.get('input[name="sku"]').type(sku);
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Intentar crear segundo insumo con mismo SKU
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Segundo Insumo');
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      cy.get('input[name="sku"]').type(sku);
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El SKU ya existe').should('be.visible');
    });

    it('CREATE-S007: Debe validar stock mínimo menor que máximo', () => {
      cy.get('button').contains('Agregar').click();
      
      cy.get('input[name="name"]').type('Stock Inválido');
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      cy.get('input[name="minimum_stock"]').type('50');
      cy.get('input[name="maximum_stock"]').type('25');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El stock máximo debe ser mayor al mínimo').should('be.visible');
    });

    it('CREATE-S008: Debe manejar error de red al crear', () => {
      cy.intercept('POST', '/api/supplies', { forceNetworkError: true }).as('networkError');
      
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Network Error');
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.wait('@networkError');
      
      cy.contains('Error de conexión').should('be.visible');
      cy.contains('Reintentar').should('be.visible');
    });
  });

  describe('READ - Lectura y Listado de Insumos', () => {
    beforeEach(() => {
      // Crear insumos de prueba
      const testSupplies = [
        { name: 'Jeringa Desechable', unit: 'pieza', qty: '1', cost: '500', category: 'Instrumentos' },
        { name: 'Guantes de Latex', unit: 'caja', qty: '100', cost: '15000', category: 'Protección' },
        { name: 'Anestesia Local', unit: 'ampolla', qty: '2', cost: '8000', category: 'Medicamentos' }
      ];
      
      testSupplies.forEach(supply => {
        cy.get('button').contains('Agregar').click();
        cy.get('input[name="name"]').type(supply.name);
        cy.get('input[name="unit"]').type(supply.unit);
        cy.get('input[name="quantity_per_unit"]').type(supply.qty);
        cy.get('input[name="cost_per_unit_cents"]').type(supply.cost);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('READ-S001: Debe mostrar lista de insumos correctamente', () => {
      // Verificar que se muestran los insumos
      cy.contains('Jeringa Desechable').should('be.visible');
      cy.contains('Guantes de Latex').should('be.visible');
      cy.contains('Anestesia Local').should('be.visible');
      
      // Verificar columnas de la tabla
      cy.get('th').contains('Nombre').should('be.visible');
      cy.get('th').contains('Unidad').should('be.visible');
      cy.get('th').contains('Costo').should('be.visible');
      cy.get('th').contains('Stock').should('be.visible');
      cy.get('th').contains('Acciones').should('be.visible');
    });

    it('READ-S002: Debe buscar insumo por nombre', () => {
      cy.get('input[placeholder*="Buscar"]').type('Jeringa');
      cy.contains('Jeringa Desechable').should('be.visible');
      cy.contains('Guantes de Latex').should('not.exist');
    });

    it('READ-S003: Debe buscar insumo por categoría', () => {
      cy.get('select[name="category_filter"]').then($select => {
        if ($select.length) {
          cy.wrap($select).select('Medicamentos');
          cy.contains('Anestesia Local').should('be.visible');
          cy.contains('Jeringa Desechable').should('not.exist');
        }
      });
    });

    it('READ-S004: Debe filtrar por rango de precios', () => {
      cy.get('input[name="price_min"]').type('5000');
      cy.get('input[name="price_max"]').type('10000');
      cy.get('button').contains('Filtrar').click();
      
      cy.contains('Anestesia Local').should('be.visible');
      cy.contains('Jeringa Desechable').should('not.exist');
    });

    it('READ-S005: Debe mostrar insumos con stock bajo', () => {
      cy.get('button').contains('Stock Bajo').click();
      
      // Si hay insumos con stock bajo, se deben mostrar
      cy.get('[data-cy="low-stock-alert"]').should('be.visible');
    });

    it('READ-S006: Debe ordenar por costo ascendente/descendente', () => {
      cy.get('th').contains('Costo').click();
      
      // Verificar orden ascendente
      cy.get('[data-cy="supply-row"]').first().should('contain', '$5.00'); // Jeringa
      
      // Click de nuevo para orden descendente
      cy.get('th').contains('Costo').click();
      cy.get('[data-cy="supply-row"]').first().should('contain', '$150.00'); // Guantes
    });

    it('READ-S007: Debe manejar error al cargar insumos', () => {
      cy.intercept('GET', '/api/supplies*', { statusCode: 500 }).as('loadError');
      
      cy.reload();
      cy.wait('@loadError');
      
      cy.contains('Error al cargar insumos').should('be.visible');
      cy.contains('Reintentar').should('be.visible');
    });

    it('READ-S008: Debe mostrar cálculos de inventario', () => {
      // Verificar totales
      cy.get('[data-cy="total-items"]').should('be.visible');
      cy.get('[data-cy="total-value"]').should('be.visible');
      cy.get('[data-cy="low-stock-count"]').should('be.visible');
    });
  });

  describe('UPDATE - Actualización de Insumos', () => {
    beforeEach(() => {
      // Crear insumo para editar
      const uniqueId = Date.now();
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type(`Editable Supply ${uniqueId}`);
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('2000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('UPDATE-S001: Debe cargar formulario con datos actuales', () => {
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Editar"]').click();
      
      // Verificar que los campos tienen los valores correctos
      cy.get('input[name="name"]').should('contain.value', 'Editable Supply');
      cy.get('input[name="unit"]').should('have.value', 'pieza');
      cy.get('input[name="cost_per_unit_cents"]').should('have.value', '2000');
    });

    it('UPDATE-S002: Debe actualizar nombre y descripción', () => {
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="name"]').clear().type('Insumo Actualizado');
      cy.get('textarea[name="description"]').type('Descripción actualizada del insumo');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Insumo actualizado exitosamente').should('be.visible');
      cy.contains('Insumo Actualizado').should('be.visible');
    });

    it('UPDATE-S003: Debe actualizar precios', () => {
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="cost_per_unit_cents"]').clear().type('3500'); // $35.00
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Insumo actualizado exitosamente').should('be.visible');
      cy.contains('$35.00').should('be.visible');
    });

    it('UPDATE-S004: Debe actualizar stock y alertas', () => {
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="current_stock"]').clear().type('25');
      cy.get('input[name="minimum_stock"]').clear().type('5');
      cy.get('input[name="maximum_stock"]').clear().type('100');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Insumo actualizado exitosamente').should('be.visible');
      cy.contains('25').should('be.visible');
    });

    it('UPDATE-S005: Debe validar datos al actualizar', () => {
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="cost_per_unit_cents"]').clear().type('-500');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El costo debe ser mayor a cero').should('be.visible');
    });

    it('UPDATE-S006: Debe crear historial de cambios de precio', () => {
      // Actualizar precio
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="cost_per_unit_cents"]').clear().type('4000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Ver historial
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Ver historial"]').click();
      
      cy.contains('Historial de Precios').should('be.visible');
      cy.contains('$20.00 → $40.00').should('be.visible');
    });

    it('UPDATE-S007: Debe manejar conflictos de concurrencia', () => {
      cy.intercept('PUT', '/api/supplies/*', { 
        statusCode: 409,
        body: { error: 'El insumo fue modificado por otro usuario' }
      }).as('conflictError');
      
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="name"]').clear().type('Conflicto');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.wait('@conflictError');
      
      cy.contains('fue modificado por otro usuario').should('be.visible');
      cy.contains('Recargar').should('be.visible');
    });
  });

  describe('DELETE - Eliminación de Insumos', () => {
    beforeEach(() => {
      // Crear insumo para eliminar
      const uniqueId = Date.now();
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type(`ToDelete Supply ${uniqueId}`);
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('DELETE-S001: Debe mostrar confirmación antes de eliminar', () => {
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Eliminar"]').click();
      
      cy.contains('¿Estás seguro?').should('be.visible');
      cy.contains('Esta acción no se puede deshacer').should('be.visible');
      cy.contains('Se eliminará también el historial de precios').should('be.visible');
    });

    it('DELETE-S002: Debe eliminar insumo al confirmar', () => {
      const supplyName = 'ToDelete Supply';
      
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      cy.contains('Insumo eliminado exitosamente').should('be.visible');
      cy.contains(supplyName).should('not.exist');
    });

    it('DELETE-S003: Debe cancelar eliminación', () => {
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Cancelar').click();
      
      cy.contains('ToDelete Supply').should('be.visible');
    });

    it('DELETE-S004: Debe prevenir eliminación si está en uso', () => {
      // Simular insumo en uso en servicios
      cy.intercept('DELETE', '/api/supplies/*', { 
        statusCode: 409,
        body: { error: 'No se puede eliminar insumo que está siendo usado en servicios' }
      }).as('usageConflict');
      
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      cy.wait('@usageConflict');
      
      cy.contains('está siendo usado en servicios').should('be.visible');
    });

    it('DELETE-S005: Debe manejar error al eliminar', () => {
      cy.intercept('DELETE', '/api/supplies/*', { statusCode: 500 }).as('deleteError');
      
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      cy.wait('@deleteError');
      
      cy.contains('Error al eliminar').should('be.visible');
    });

    it('DELETE-S006: Debe archivar en lugar de eliminar si tiene historial', () => {
      // Simular insumo con historial
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Eliminar"]').click();
      
      // Debería mostrar opción de archivar
      cy.contains('Archivar en lugar de eliminar').should('be.visible');
      cy.get('button').contains('Archivar').click();
      
      cy.contains('Insumo archivado').should('be.visible');
      
      // Verificar filtro de archivados
      cy.get('button').contains('Ver archivados').click();
      cy.contains('ToDelete Supply').should('be.visible');
    });
  });

  describe('STOCK - Gestión de Inventario', () => {
    beforeEach(() => {
      // Crear insumo con stock
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Insumo Stock Test');
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      cy.get('input[name="current_stock"]').type('50');
      cy.get('input[name="minimum_stock"]').type('10');
      cy.get('input[name="maximum_stock"]').type('100');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('STOCK-S001: Debe registrar entrada de stock', () => {
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Gestionar stock"]').click();
      cy.get('button').contains('Entrada').click();
      
      cy.get('input[name="quantity"]').type('25');
      cy.get('input[name="unit_cost"]').type('1200'); // Precio actualizado
      cy.get('textarea[name="notes"]').type('Compra de inventario mensual');
      
      cy.get('button').contains('Registrar Entrada').click();
      
      cy.contains('Entrada registrada exitosamente').should('be.visible');
      cy.contains('75').should('be.visible'); // Stock actualizado
    });

    it('STOCK-S002: Debe registrar salida de stock', () => {
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Gestionar stock"]').click();
      cy.get('button').contains('Salida').click();
      
      cy.get('input[name="quantity"]').type('15');
      cy.get('select[name="reason"]').select('used_in_treatment');
      cy.get('textarea[name="notes"]').type('Usado en tratamiento del paciente');
      
      cy.get('button').contains('Registrar Salida').click();
      
      cy.contains('Salida registrada exitosamente').should('be.visible');
      cy.contains('35').should('be.visible'); // Stock actualizado
    });

    it('STOCK-S003: Debe validar stock suficiente para salida', () => {
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Gestionar stock"]').click();
      cy.get('button').contains('Salida').click();
      
      cy.get('input[name="quantity"]').type('100'); // Más del stock disponible
      cy.get('select[name="reason"]').select('used_in_treatment');
      cy.get('button').contains('Registrar Salida').click();
      
      cy.contains('Stock insuficiente').should('be.visible');
      cy.contains('Stock disponible: 50').should('be.visible');
    });

    it('STOCK-S004: Debe mostrar alerta de stock bajo', () => {
      // Reducir stock por debajo del mínimo
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Gestionar stock"]').click();
      cy.get('button').contains('Salida').click();
      
      cy.get('input[name="quantity"]').type('45'); // Dejar solo 5, menos del mínimo (10)
      cy.get('select[name="reason"]').select('expired');
      cy.get('button').contains('Registrar Salida').click();
      
      // Verificar alerta
      cy.get('[data-cy="low-stock-alert"]').should('be.visible');
      cy.contains('Stock bajo').should('be.visible');
    });

    it('STOCK-S005: Debe calcular valor total del inventario', () => {
      cy.visit('/supplies/inventory');
      
      // Verificar cálculos
      cy.get('[data-cy="total-inventory-value"]').should('be.visible');
      cy.get('[data-cy="items-by-category"]').should('be.visible');
      cy.get('[data-cy="turnover-rate"]').should('be.visible');
    });

    it('STOCK-S006: Debe generar órdenes de compra automáticas', () => {
      // Reducir stock por debajo del mínimo
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Gestionar stock"]').click();
      cy.get('button').contains('Salida').click();
      cy.get('input[name="quantity"]').type('45');
      cy.get('select[name="reason"]').select('used_in_treatment');
      cy.get('button').contains('Registrar Salida').click();
      
      // Verificar sugerencia de orden de compra
      cy.contains('Generar orden de compra').should('be.visible');
      cy.get('button').contains('Generar orden de compra').click();
      
      // Verificar orden generada
      cy.contains('Orden de compra generada').should('be.visible');
      cy.get('[data-cy="purchase-order"]').should('contain', 'Insumo Stock Test');
    });
  });

  describe('INTEGRACIÓN - Tests de Integración', () => {
    it('INTEGRATION-S001: Debe mantener consistencia CRUD completa', () => {
      const uniqueId = Date.now();
      const supplyData = {
        name: `Integration Supply ${uniqueId}`,
        unit: 'tubo',
        qty: '50',
        cost: '2500'
      };
      
      // CREATE
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type(supplyData.name);
      cy.get('input[name="unit"]').type(supplyData.unit);
      cy.get('input[name="quantity_per_unit"]').type(supplyData.qty);
      cy.get('input[name="cost_per_unit_cents"]').type(supplyData.cost);
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // READ
      cy.contains(supplyData.name).should('be.visible');
      
      // UPDATE
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="name"]').clear().type('Modified Supply');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // READ updated
      cy.contains('Modified Supply').should('be.visible');
      
      // DELETE
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      // READ deleted
      cy.contains('Modified Supply').should('not.exist');
    });

    it('INTEGRATION-S002: Debe sincronizar con módulo de servicios', () => {
      // Crear insumo
      const uniqueId = Date.now();
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type(`Service Supply ${uniqueId}`);
      cy.get('input[name="unit"]').type('ml');
      cy.get('input[name="quantity_per_unit"]').type('10');
      cy.get('input[name="cost_per_unit_cents"]').type('1500');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Verificar en servicios
      cy.visit('/services');
      cy.get('button').contains('Agregar').click();
      cy.get('button').contains('Agregar insumo').click();
      
      cy.get('select[name="supply_id"]').should('contain', `Service Supply ${uniqueId}`);
    });

    it('INTEGRATION-S003: Debe actualizar costos en servicios al cambiar precio', () => {
      // Crear insumo y servicio
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Cost Update Supply');
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Actualizar precio
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="cost_per_unit_cents"]').clear().type('2000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar notificación de actualización en servicios
      cy.contains('Los servicios que usan este insumo serán recalculados').should('be.visible');
    });
  });

  describe('PERFORMANCE - Tests de Rendimiento', () => {
    it('PERF-S001: Debe cargar inventario rápidamente', () => {
      const startTime = Date.now();
      
      cy.reload();
      cy.get('table').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(3000);
      });
    });

    it('PERF-S002: Debe filtrar grandes inventarios eficientemente', () => {
      // Simular inventario grande
      cy.intercept('GET', '/api/supplies*', { 
        fixture: 'large-supplies-dataset.json' 
      }).as('largeDataset');
      
      cy.reload();
      cy.wait('@largeDataset');
      
      const startTime = Date.now();
      
      cy.get('input[placeholder*="Buscar"]').type('Jeringa');
      cy.get('[data-cy="supply-row"]').should('be.visible');
      
      cy.then(() => {
        const filterTime = Date.now() - startTime;
        expect(filterTime).to.be.lessThan(1000);
      });
    });

    it('PERF-S003: Debe manejar movimientos de stock masivos', () => {
      // Simular entrada masiva de stock
      cy.get('[data-cy="supply-row"]').first().find('button[aria-label="Gestionar stock"]').click();
      cy.get('button').contains('Entrada Masiva').click();
      
      // Subir archivo CSV con movimientos
      cy.get('input[type="file"]').selectFile('cypress/fixtures/stock-movements.csv');
      
      const startTime = Date.now();
      
      cy.get('button').contains('Procesar').click();
      cy.contains('movimientos procesados exitosamente').should('be.visible');
      
      cy.then(() => {
        const processTime = Date.now() - startTime;
        expect(processTime).to.be.lessThan(5000);
      });
    });
  });
});

// Comandos personalizados
Cypress.Commands.add('createTestSupply', (data) => {
  cy.get('button').contains('Agregar').click();
  cy.get('input[name="name"]').type(data.name);
  cy.get('input[name="unit"]').type(data.unit);
  cy.get('input[name="quantity_per_unit"]').type(data.quantity);
  cy.get('input[name="cost_per_unit_cents"]').type(data.cost);
  if (data.stock) cy.get('input[name="current_stock"]').type(data.stock);
  cy.get('button[type="submit"]').contains('Guardar').click();
  cy.wait(500);
});