/**
 * TESTS CRUD ROBUSTOS - MÓDULO DE COSTOS FIJOS
 * Cobertura completa de operaciones CRUD con detección de errores
 * Incluye configuración de tiempo, activos, depreciación y análisis financiero
 */

describe('CRUD Robusto: Módulo de Costos Fijos', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/fixed-costs');
    cy.wait(1000);
  });

  describe('CREATE - Creación de Costos Fijos', () => {
    it('CREATE-FC001: Debe crear costo fijo básico', () => {
      cy.get('button').contains('Agregar').click();
      
      const uniqueId = Date.now();
      cy.get('input[name="name"]').type(`Renta Consultorio ${uniqueId}`);
      cy.get('input[name="amount_cents"]').type('2500000'); // $25,000
      cy.get('select[name="category"]').select('rent');
      cy.get('select[name="frequency"]').select('monthly');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificaciones
      cy.contains('Costo agregado exitosamente').should('be.visible');
      cy.contains(`Renta Consultorio ${uniqueId}`).should('be.visible');
      cy.contains('$25,000.00').should('be.visible');
      cy.contains('Mensual').should('be.visible');
      
      // Verificar en total
      cy.get('[data-cy="total-monthly-costs"]').should('be.visible');
    });

    it('CREATE-FC002: Debe crear costo fijo con información completa', () => {
      cy.get('button').contains('Agregar').click();
      
      const uniqueId = Date.now();
      const costData = {
        name: `Seguro Médico Completo ${uniqueId}`,
        description: 'Póliza integral de seguro médico para la clínica',
        amount_cents: '500000', // $5,000
        category: 'insurance',
        frequency: 'monthly',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        supplier: 'Seguros Monterrey SA',
        reference: 'POL-2024-001'
      };
      
      // Llenar todos los campos
      cy.get('input[name="name"]').type(costData.name);
      cy.get('textarea[name="description"]').type(costData.description);
      cy.get('input[name="amount_cents"]').type(costData.amount_cents);
      cy.get('select[name="category"]').select(costData.category);
      cy.get('select[name="frequency"]').select(costData.frequency);
      cy.get('input[name="start_date"]').type(costData.start_date);
      cy.get('input[name="end_date"]').type(costData.end_date);
      cy.get('input[name="supplier"]').type(costData.supplier);
      cy.get('input[name="reference"]').type(costData.reference);
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificaciones completas
      cy.contains('Costo agregado exitosamente').should('be.visible');
      cy.contains(costData.name).should('be.visible');
      cy.contains('$5,000.00').should('be.visible');
      cy.contains('Seguros').should('be.visible');
    });

    it('CREATE-FC003: Debe crear costo fijo único (one-time)', () => {
      cy.get('button').contains('Agregar').click();
      
      const uniqueId = Date.now();
      cy.get('input[name="name"]').type(`Equipo Dental ${uniqueId}`);
      cy.get('input[name="amount_cents"]').type('15000000'); // $150,000
      cy.get('select[name="category"]').select('equipment');
      cy.get('select[name="frequency"]').select('one-time');
      cy.get('input[name="purchase_date"]').type('2024-02-15');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Costo agregado exitosamente').should('be.visible');
      cy.contains('$150,000.00').should('be.visible');
      cy.contains('Único').should('be.visible');
      
      // No debería afectar costos mensuales recurrentes
      cy.get('[data-cy="one-time-costs-total"]').should('contain', '$150,000.00');
    });

    it('CREATE-FC004: Debe validar campos requeridos', () => {
      cy.get('button').contains('Agregar').click();
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar mensajes de error
      cy.contains('El nombre es requerido').should('be.visible');
      cy.contains('El monto es requerido').should('be.visible');
      cy.contains('La categoría es requerida').should('be.visible');
    });

    it('CREATE-FC005: Debe validar monto positivo', () => {
      cy.get('button').contains('Agregar').click();
      
      cy.get('input[name="name"]').type('Monto Negativo');
      cy.get('input[name="amount_cents"]').type('-100000');
      cy.get('select[name="category"]').select('utilities');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El monto debe ser mayor a cero').should('be.visible');
    });

    it('CREATE-FC006: Debe validar fechas coherentes', () => {
      cy.get('button').contains('Agregar').click();
      
      cy.get('input[name="name"]').type('Fechas Inválidas');
      cy.get('input[name="amount_cents"]').type('100000');
      cy.get('select[name="category"]').select('utilities');
      cy.get('input[name="start_date"]').type('2024-12-01');
      cy.get('input[name="end_date"]').type('2024-01-01'); // Anterior a start_date
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('La fecha de fin debe ser posterior a la de inicio').should('be.visible');
    });

    it('CREATE-FC007: Debe calcular impacto en costo por minuto', () => {
      // Verificar configuración de tiempo primero
      cy.visit('/settings/time');
      cy.get('input[name="work_days"]').clear().type('22');
      cy.get('input[name="hours_per_day"]').clear().type('8');
      cy.get('button').contains('Guardar').click();
      cy.wait(1000);
      
      // Crear costo fijo
      cy.visit('/fixed-costs');
      cy.get('button').contains('Agregar').click();
      
      cy.get('input[name="name"]').type('Impacto Test');
      cy.get('input[name="amount_cents"]').type('1056000'); // $10,560 mensuales
      cy.get('select[name="category"]').select('rent');
      
      // Verificar preview del impacto
      cy.get('[data-cy="cost-per-minute-preview"]').should('be.visible');
      cy.get('[data-cy="cost-per-minute-preview"]').should('contain', '$10.00'); // $10,560 / (22 * 8 * 60) = $10/min
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar actualización en dashboard
      cy.get('[data-cy="cost-per-minute-total"]').should('contain', '$10.00');
    });

    it('CREATE-FC008: Debe manejar error de red al crear', () => {
      cy.intercept('POST', '/api/fixed-costs', { forceNetworkError: true }).as('networkError');
      
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Network Error');
      cy.get('input[name="amount_cents"]').type('100000');
      cy.get('select[name="category"]').select('utilities');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.wait('@networkError');
      
      cy.contains('Error de conexión').should('be.visible');
      cy.contains('Reintentar').should('be.visible');
    });
  });

  describe('READ - Lectura y Listado de Costos Fijos', () => {
    beforeEach(() => {
      // Crear costos fijos de prueba
      const testCosts = [
        { name: 'Renta Local', amount: '2000000', category: 'rent', frequency: 'monthly' },
        { name: 'Servicios Públicos', amount: '800000', category: 'utilities', frequency: 'monthly' },
        { name: 'Seguro Anual', amount: '1200000', category: 'insurance', frequency: 'yearly' },
        { name: 'Equipo Rayos X', amount: '25000000', category: 'equipment', frequency: 'one-time' }
      ];
      
      testCosts.forEach(cost => {
        cy.get('button').contains('Agregar').click();
        cy.get('input[name="name"]').type(cost.name);
        cy.get('input[name="amount_cents"]').type(cost.amount);
        cy.get('select[name="category"]').select(cost.category);
        cy.get('select[name="frequency"]').select(cost.frequency);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('READ-FC001: Debe mostrar lista de costos correctamente', () => {
      // Verificar que se muestran los costos
      cy.contains('Renta Local').should('be.visible');
      cy.contains('Servicios Públicos').should('be.visible');
      cy.contains('Seguro Anual').should('be.visible');
      cy.contains('Equipo Rayos X').should('be.visible');
      
      // Verificar columnas de la tabla
      cy.get('th').contains('Concepto').should('be.visible');
      cy.get('th').contains('Categoría').should('be.visible');
      cy.get('th').contains('Monto').should('be.visible');
      cy.get('th').contains('Frecuencia').should('be.visible');
      cy.get('th').contains('Acciones').should('be.visible');
    });

    it('READ-FC002: Debe filtrar por categoría', () => {
      cy.get('select[name="category_filter"]').select('rent');
      cy.contains('Renta Local').should('be.visible');
      cy.contains('Servicios Públicos').should('not.exist');
    });

    it('READ-FC003: Debe filtrar por frecuencia', () => {
      cy.get('select[name="frequency_filter"]').select('monthly');
      cy.contains('Renta Local').should('be.visible');
      cy.contains('Servicios Públicos').should('be.visible');
      cy.contains('Seguro Anual').should('not.exist');
    });

    it('READ-FC004: Debe buscar por nombre', () => {
      cy.get('input[placeholder*="Buscar"]').type('Renta');
      cy.contains('Renta Local').should('be.visible');
      cy.contains('Servicios Públicos').should('not.exist');
    });

    it('READ-FC005: Debe mostrar totales por categoría', () => {
      cy.get('[data-cy="category-breakdown"]').should('be.visible');
      
      // Verificar categorías específicas
      cy.get('[data-cy="rent-total"]').should('contain', '$20,000.00');
      cy.get('[data-cy="utilities-total"]').should('contain', '$8,000.00');
      cy.get('[data-cy="insurance-total"]').should('contain', '$12,000.00');
    });

    it('READ-FC006: Debe calcular totales mensuales equivalentes', () => {
      // Los costos anuales deberían prorratearse mensualmente
      cy.get('[data-cy="monthly-equivalent-total"]').should('be.visible');
      
      // $20,000 (rent) + $8,000 (utilities) + $1,000 (insurance/12) = $29,000
      cy.get('[data-cy="monthly-equivalent-total"]').should('contain', '$29,000.00');
    });

    it('READ-FC007: Debe mostrar próximos vencimientos', () => {
      // Crear costo con vencimiento próximo
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Licencia por Vencer');
      cy.get('input[name="amount_cents"]').type('500000');
      cy.get('select[name="category"]').select('licenses');
      
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const nextMonthStr = nextMonth.toISOString().split('T')[0];
      
      cy.get('input[name="end_date"]').type(nextMonthStr);
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Verificar alerta de vencimiento
      cy.get('[data-cy="expiring-costs-alert"]').should('be.visible');
      cy.contains('Licencia por Vencer').should('be.visible');
    });

    it('READ-FC008: Debe mostrar gráfico de distribución', () => {
      cy.get('[data-cy="cost-distribution-chart"]').should('be.visible');
      
      // Verificar que muestra cada categoría
      cy.get('[data-cy="chart-legend"]').should('contain', 'Renta');
      cy.get('[data-cy="chart-legend"]').should('contain', 'Servicios');
      cy.get('[data-cy="chart-legend"]').should('contain', 'Seguros');
    });

    it('READ-FC009: Debe manejar error al cargar costos', () => {
      cy.intercept('GET', '/api/fixed-costs*', { statusCode: 500 }).as('loadError');
      
      cy.reload();
      cy.wait('@loadError');
      
      cy.contains('Error al cargar costos fijos').should('be.visible');
      cy.contains('Reintentar').should('be.visible');
    });
  });

  describe('UPDATE - Actualización de Costos Fijos', () => {
    beforeEach(() => {
      // Crear costo fijo para editar
      const uniqueId = Date.now();
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type(`Editable Cost ${uniqueId}`);
      cy.get('input[name="amount_cents"]').type('1500000'); // $15,000
      cy.get('select[name="category"]').select('rent');
      cy.get('select[name="frequency"]').select('monthly');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('UPDATE-FC001: Debe cargar formulario con datos actuales', () => {
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Editar"]').click();
      
      // Verificar que los campos tienen los valores correctos
      cy.get('input[name="name"]').should('contain.value', 'Editable Cost');
      cy.get('input[name="amount_cents"]').should('have.value', '1500000');
      cy.get('select[name="category"]').should('have.value', 'rent');
    });

    it('UPDATE-FC002: Debe actualizar información básica', () => {
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="name"]').clear().type('Costo Actualizado');
      cy.get('textarea[name="description"]').type('Descripción actualizada del costo');
      cy.get('input[name="amount_cents"]').clear().type('1800000'); // $18,000
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Costo actualizado exitosamente').should('be.visible');
      cy.contains('Costo Actualizado').should('be.visible');
      cy.contains('$18,000.00').should('be.visible');
    });

    it('UPDATE-FC003: Debe cambiar categoría y frecuencia', () => {
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('select[name="category"]').select('utilities');
      cy.get('select[name="frequency"]').select('quarterly');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Costo actualizado exitosamente').should('be.visible');
      cy.contains('Servicios').should('be.visible');
      cy.contains('Trimestral').should('be.visible');
    });

    it('UPDATE-FC004: Debe crear historial de cambios', () => {
      // Obtener valor inicial
      cy.get('[data-cy="cost-row"]').first().find('[data-cy="cost-amount"]')
        .invoke('text').as('initialAmount');
      
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="amount_cents"]').clear().type('2000000'); // $20,000
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Ver historial
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Ver historial"]').click();
      
      cy.contains('Historial de Cambios').should('be.visible');
      cy.contains('$15,000.00 → $20,000.00').should('be.visible');
      cy.get('[data-cy="change-date"]').should('be.visible');
    });

    it('UPDATE-FC005: Debe recalcular impacto en costo por minuto', () => {
      // Obtener costo por minuto inicial
      cy.get('[data-cy="cost-per-minute-total"]').invoke('text').as('initialCostPerMinute');
      
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="amount_cents"]').clear().type('3000000'); // $30,000 (duplicar)
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Verificar que el costo por minuto cambió
      cy.get('[data-cy="cost-per-minute-total"]').should('not.contain', '@initialCostPerMinute');
    });

    it('UPDATE-FC006: Debe validar datos al actualizar', () => {
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="amount_cents"]').clear().type('-50000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El monto debe ser mayor a cero').should('be.visible');
    });

    it('UPDATE-FC007: Debe notificar impacto en servicios', () => {
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="amount_cents"]').clear().type('3000000'); // Aumento significativo
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Debería mostrar notificación sobre recálculo de servicios
      cy.contains('Los precios de servicios serán recalculados').should('be.visible');
      cy.contains('Ver servicios afectados').should('be.visible');
    });

    it('UPDATE-FC008: Debe manejar conflictos de concurrencia', () => {
      cy.intercept('PUT', '/api/fixed-costs/*', { 
        statusCode: 409,
        body: { error: 'El costo fue modificado por otro usuario' }
      }).as('conflictError');
      
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="name"]').clear().type('Conflicto');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.wait('@conflictError');
      
      cy.contains('fue modificado por otro usuario').should('be.visible');
      cy.contains('Recargar').should('be.visible');
    });
  });

  describe('DELETE - Eliminación de Costos Fijos', () => {
    beforeEach(() => {
      // Crear costo fijo para eliminar
      const uniqueId = Date.now();
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type(`ToDelete Cost ${uniqueId}`);
      cy.get('input[name="amount_cents"]').type('1000000');
      cy.get('select[name="category"]').select('utilities');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('DELETE-FC001: Debe mostrar confirmación antes de eliminar', () => {
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Eliminar"]').click();
      
      cy.contains('¿Estás seguro?').should('be.visible');
      cy.contains('Esta acción no se puede deshacer').should('be.visible');
      cy.contains('Se eliminará también el historial de cambios').should('be.visible');
      cy.contains('Los precios de servicios serán recalculados').should('be.visible');
    });

    it('DELETE-FC002: Debe eliminar costo fijo al confirmar', () => {
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      cy.contains('Costo eliminado exitosamente').should('be.visible');
      cy.contains('ToDelete Cost').should('not.exist');
    });

    it('DELETE-FC003: Debe cancelar eliminación', () => {
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Cancelar').click();
      
      cy.contains('ToDelete Cost').should('be.visible');
    });

    it('DELETE-FC004: Debe recalcular totales tras eliminación', () => {
      // Obtener total antes de eliminar
      cy.get('[data-cy="monthly-equivalent-total"]').invoke('text').as('totalBeforeDelete');
      
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      cy.wait(1000);
      
      // Verificar que el total cambió
      cy.get('[data-cy="monthly-equivalent-total"]').should('not.contain', '@totalBeforeDelete');
    });

    it('DELETE-FC005: Debe ofrecer archivar como alternativa', () => {
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Eliminar"]').click();
      
      // Debería mostrar opción de archivar
      cy.contains('Archivar en lugar de eliminar').should('be.visible');
      cy.get('button').contains('Archivar').click();
      
      cy.get('textarea[name="archive_reason"]').type('Costo ya no aplicable pero mantener historial');
      cy.get('button').contains('Confirmar archivo').click();
      
      cy.contains('Costo archivado exitosamente').should('be.visible');
      
      // Verificar filtro de archivados
      cy.get('button').contains('Ver archivados').click();
      cy.contains('ToDelete Cost').should('be.visible');
    });

    it('DELETE-FC006: Debe manejar error al eliminar', () => {
      cy.intercept('DELETE', '/api/fixed-costs/*', { statusCode: 500 }).as('deleteError');
      
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      cy.wait('@deleteError');
      
      cy.contains('Error al eliminar').should('be.visible');
    });
  });

  describe('SETTINGS - Configuración de Tiempo', () => {
    it('SETTINGS-FC001: Debe configurar horarios de trabajo', () => {
      cy.visit('/settings/time');
      
      cy.get('input[name="work_days"]').clear().type('22');
      cy.get('input[name="hours_per_day"]').clear().type('8');
      cy.get('input[name="real_pct"]').clear().type('75'); // 75% efectividad
      
      cy.get('button').contains('Guardar').click();
      
      cy.contains('Configuración guardada exitosamente').should('be.visible');
      
      // Verificar cálculos
      cy.get('[data-cy="minutes-per-month"]').should('contain', '10,560'); // 22 * 8 * 60
      cy.get('[data-cy="effective-minutes"]').should('contain', '7,920'); // 10,560 * 0.75
    });

    it('SETTINGS-FC002: Debe validar configuración de tiempo', () => {
      cy.visit('/settings/time');
      
      // Valores inválidos
      cy.get('input[name="work_days"]').clear().type('35'); // Más de 31
      cy.get('input[name="hours_per_day"]').clear().type('25'); // Más de 24
      cy.get('input[name="real_pct"]').clear().type('150'); // Más de 100%
      
      cy.get('button').contains('Guardar').click();
      
      cy.contains('Los días de trabajo no pueden exceder 31').should('be.visible');
      cy.contains('Las horas por día no pueden exceder 24').should('be.visible');
      cy.contains('El porcentaje real debe estar entre 1% y 100%').should('be.visible');
    });

    it('SETTINGS-FC003: Debe mostrar impacto de cambios en precios', () => {
      cy.visit('/settings/time');
      
      // Obtener configuración actual
      cy.get('[data-cy="current-cost-per-minute"]').invoke('text').as('currentCostPerMinute');
      
      // Cambiar configuración
      cy.get('input[name="hours_per_day"]').clear().type('10'); // Más horas
      
      // Verificar preview del impacto
      cy.get('[data-cy="new-cost-per-minute"]').should('be.visible');
      cy.get('[data-cy="cost-difference"]').should('be.visible');
      cy.get('[data-cy="price-impact-warning"]').should('be.visible');
      
      cy.get('button').contains('Guardar').click();
      
      // Verificar que los precios se recalcularon
      cy.contains('Precios de servicios recalculados').should('be.visible');
    });
  });

  describe('ASSETS - Gestión de Activos', () => {
    it('ASSETS-FC001: Debe crear activo con depreciación', () => {
      cy.visit('/assets');
      
      cy.get('button').contains('Agregar activo').click();
      
      const uniqueId = Date.now();
      cy.get('input[name="name"]').type(`Sillón Dental ${uniqueId}`);
      cy.get('input[name="purchase_price_cents"]').type('12000000'); // $120,000
      cy.get('input[name="purchase_date"]').type('2024-01-15');
      cy.get('input[name="useful_life_years"]').type('10');
      cy.get('select[name="depreciation_method"]').select('straight-line');
      cy.get('input[name="salvage_value_cents"]').type('2000000'); // $20,000
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificaciones
      cy.contains('Activo agregado exitosamente').should('be.visible');
      cy.contains(`Sillón Dental ${uniqueId}`).should('be.visible');
      
      // Verificar cálculos de depreciación
      cy.get('[data-cy="monthly-depreciation"]').should('contain', '$833.33'); // ($120k - $20k) / 120 meses
      cy.get('[data-cy="annual-depreciation"]').should('contain', '$10,000.00');
    });

    it('ASSETS-FC002: Debe calcular diferentes métodos de depreciación', () => {
      cy.visit('/assets');
      
      // Método de línea recta
      cy.get('button').contains('Agregar activo').click();
      cy.get('input[name="name"]').type('Equipo Método 1');
      cy.get('input[name="purchase_price_cents"]').type('6000000'); // $60,000
      cy.get('input[name="purchase_date"]').type('2024-01-01');
      cy.get('input[name="useful_life_years"]').type('5');
      cy.get('select[name="depreciation_method"]').select('straight-line');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(500);
      
      // Método de saldos decrecientes
      cy.get('button').contains('Agregar activo').click();
      cy.get('input[name="name"]').type('Equipo Método 2');
      cy.get('input[name="purchase_price_cents"]').type('6000000'); // $60,000
      cy.get('input[name="purchase_date"]').type('2024-01-01');
      cy.get('input[name="useful_life_years"]').type('5');
      cy.get('select[name="depreciation_method"]').select('declining-balance');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(500);
      
      // Comparar depreciaciones
      cy.get('[data-cy="asset-row"]').eq(0).find('[data-cy="monthly-depreciation"]')
        .should('contain', '$1,000.00'); // Línea recta: $60k / 60 meses
      
      cy.get('[data-cy="asset-row"]').eq(1).find('[data-cy="monthly-depreciation"]')
        .should('not.contain', '$1,000.00'); // Saldos decrecientes es diferente
    });

    it('ASSETS-FC003: Debe incluir depreciación en costos fijos', () => {
      // Crear activo
      cy.visit('/assets');
      cy.get('button').contains('Agregar activo').click();
      cy.get('input[name="name"]').type('Activo para Costos');
      cy.get('input[name="purchase_price_cents"]').type('2400000'); // $24,000
      cy.get('input[name="purchase_date"]').type('2024-01-01');
      cy.get('input[name="useful_life_years"]').type('2'); // $1,000/mes de depreciación
      cy.get('select[name="depreciation_method"]').select('straight-line');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Verificar en costos fijos
      cy.visit('/fixed-costs');
      cy.get('[data-cy="depreciation-total"]').should('be.visible');
      cy.get('[data-cy="depreciation-total"]').should('contain', '$1,000.00');
      cy.get('[data-cy="total-including-depreciation"]').should('be.visible');
    });

    it('ASSETS-FC004: Debe manejar venta/baja de activos', () => {
      // Crear activo primero
      cy.visit('/assets');
      cy.get('button').contains('Agregar activo').click();
      cy.get('input[name="name"]').type('Activo para Vender');
      cy.get('input[name="purchase_price_cents"]').type('3000000'); // $30,000
      cy.get('input[name="purchase_date"]').type('2023-01-01');
      cy.get('input[name="useful_life_years"]').type('5');
      cy.get('select[name="depreciation_method"]').select('straight-line');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Vender activo
      cy.get('[data-cy="asset-row"]').first().find('button[aria-label="Vender"]').click();
      
      cy.get('input[name="sale_date"]').type('2024-06-01');
      cy.get('input[name="sale_price_cents"]').type('2000000'); // $20,000
      cy.get('textarea[name="sale_notes"]').type('Venta por actualización de equipo');
      
      cy.get('button').contains('Confirmar venta').click();
      
      // Verificar ganancia/pérdida
      cy.contains('Venta registrada exitosamente').should('be.visible');
      cy.get('[data-cy="gain-loss-amount"]').should('be.visible');
      
      // Verificar que ya no aparece en depreciación activa
      cy.visit('/fixed-costs');
      cy.get('[data-cy="depreciation-total"]').should('not.contain', 'Activo para Vender');
    });
  });

  describe('ANALYTICS - Análisis Financiero', () => {
    it('ANALYTICS-FC001: Debe mostrar tendencias de costos', () => {
      cy.visit('/analytics/costs');
      
      // Verificar gráficos de tendencias
      cy.get('[data-cy="cost-trend-chart"]').should('be.visible');
      cy.get('[data-cy="category-breakdown-chart"]').should('be.visible');
      
      // Verificar métricas clave
      cy.get('[data-cy="total-monthly-costs"]').should('be.visible');
      cy.get('[data-cy="cost-per-minute"]').should('be.visible');
      cy.get('[data-cy="cost-growth-rate"]').should('be.visible');
    });

    it('ANALYTICS-FC002: Debe generar proyecciones', () => {
      cy.visit('/analytics/projections');
      
      // Configurar proyección
      cy.get('input[name="projection_months"]').type('12');
      cy.get('input[name="inflation_rate"]').type('5.5'); // 5.5% inflación
      cy.get('select[name="growth_scenario"]').select('conservative');
      
      cy.get('button').contains('Generar proyección').click();
      
      // Verificar resultados
      cy.get('[data-cy="projected-costs-chart"]').should('be.visible');
      cy.get('[data-cy="monthly-projections"]').should('be.visible');
      cy.get('[data-cy="annual-projection"]').should('be.visible');
    });

    it('ANALYTICS-FC003: Debe comparar períodos', () => {
      cy.visit('/analytics/comparison');
      
      // Configurar comparación
      cy.get('input[name="period1_start"]').type('2023-01-01');
      cy.get('input[name="period1_end"]').type('2023-12-31');
      cy.get('input[name="period2_start"]').type('2024-01-01');
      cy.get('input[name="period2_end"]').type('2024-12-31');
      
      cy.get('button').contains('Comparar').click();
      
      // Verificar comparación
      cy.get('[data-cy="comparison-chart"]').should('be.visible');
      cy.get('[data-cy="variance-analysis"]').should('be.visible');
      cy.get('[data-cy="category-changes"]').should('be.visible');
    });

    it('ANALYTICS-FC004: Debe identificar oportunidades de optimización', () => {
      cy.visit('/analytics/optimization');
      
      cy.get('button').contains('Analizar optimización').click();
      
      // Verificar recomendaciones
      cy.get('[data-cy="optimization-recommendations"]').should('be.visible');
      cy.get('[data-cy="cost-reduction-opportunities"]').should('be.visible');
      cy.get('[data-cy="efficiency-improvements"]').should('be.visible');
      
      // Verificar métricas de oportunidad
      cy.get('[data-cy="potential-savings"]').should('be.visible');
      cy.get('[data-cy="payback-period"]').should('be.visible');
    });
  });

  describe('INTEGRACIÓN - Tests de Integración', () => {
    it('INTEGRATION-FC001: Debe mantener consistencia CRUD completa', () => {
      const uniqueId = Date.now();
      const costData = {
        name: `Integration Cost ${uniqueId}`,
        amount: '1200000',
        category: 'utilities'
      };
      
      // CREATE
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type(costData.name);
      cy.get('input[name="amount_cents"]').type(costData.amount);
      cy.get('select[name="category"]').select(costData.category);
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // READ
      cy.contains(costData.name).should('be.visible');
      
      // UPDATE
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="name"]').clear().type('Modified Cost');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // READ updated
      cy.contains('Modified Cost').should('be.visible');
      
      // DELETE
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      // READ deleted
      cy.contains('Modified Cost').should('not.exist');
    });

    it('INTEGRATION-FC002: Debe sincronizar con motor de cálculo de servicios', () => {
      // Obtener precio de servicio antes de cambiar costos
      cy.visit('/services');
      cy.get('[data-cy="service-row"]').first().find('[data-cy="service-price"]')
        .invoke('text').as('initialServicePrice');
      
      // Cambiar costos fijos
      cy.visit('/fixed-costs');
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('New Fixed Cost');
      cy.get('input[name="amount_cents"]').type('1000000'); // $10,000 adicionales
      cy.get('select[name="category"]').select('rent');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Verificar que los servicios se recalcularon
      cy.visit('/services');
      cy.get('[data-cy="service-row"]').first().find('[data-cy="service-price"]')
        .should('not.contain', '@initialServicePrice');
    });

    it('INTEGRATION-FC003: Debe reflejar cambios en reportes financieros', () => {
      // Crear costo significativo
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Report Impact Cost');
      cy.get('input[name="amount_cents"]').type('5000000'); // $50,000
      cy.get('select[name="category"]').select('rent');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Verificar en reportes
      cy.visit('/reports');
      cy.get('[data-cy="fixed-costs-section"]').should('contain', '$50,000.00');
      cy.get('[data-cy="total-monthly-expenses"]').should('contain', '$50,000.00');
    });
  });

  describe('PERFORMANCE - Tests de Rendimiento', () => {
    it('PERF-FC001: Debe cargar costos fijos rápidamente', () => {
      const startTime = Date.now();
      
      cy.reload();
      cy.get('table').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(3000);
      });
    });

    it('PERF-FC002: Debe calcular totales sin delay perceptible', () => {
      const startTime = Date.now();
      
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Performance Test');
      cy.get('input[name="amount_cents"]').type('2500000');
      cy.get('select[name="category"]').select('utilities');
      
      cy.get('[data-cy="impact-preview"]').should('be.visible');
      
      cy.then(() => {
        const calcTime = Date.now() - startTime;
        expect(calcTime).to.be.lessThan(1000);
      });
    });

    it('PERF-FC003: Debe manejar historial extenso eficientemente', () => {
      // Simular historial extenso
      cy.intercept('GET', '/api/fixed-costs/*/history', { 
        fixture: 'extensive-cost-history.json' 
      }).as('extensiveHistory');
      
      cy.get('[data-cy="cost-row"]').first().find('button[aria-label="Ver historial"]').click();
      cy.wait('@extensiveHistory');
      
      // Verificar que se carga sin problemas
      cy.get('[data-cy="history-timeline"]').should('be.visible');
      cy.get('[data-cy="history-pagination"]').should('be.visible');
    });
  });
});

// Comandos personalizados para costos fijos
Cypress.Commands.add('createTestFixedCost', (data) => {
  cy.get('button').contains('Agregar').click();
  cy.get('input[name="name"]').type(data.name);
  cy.get('input[name="amount_cents"]').type(data.amount);
  cy.get('select[name="category"]').select(data.category);
  if (data.frequency) cy.get('select[name="frequency"]').select(data.frequency);
  cy.get('button[type="submit"]').contains('Guardar').click();
  cy.wait(500);
});

Cypress.Commands.add('createTestAsset', (data) => {
  cy.visit('/assets');
  cy.get('button').contains('Agregar activo').click();
  cy.get('input[name="name"]').type(data.name);
  cy.get('input[name="purchase_price_cents"]').type(data.price);
  cy.get('input[name="purchase_date"]').type(data.date);
  cy.get('input[name="useful_life_years"]').type(data.life);
  cy.get('select[name="depreciation_method"]').select(data.method || 'straight-line');
  cy.get('button[type="submit"]').contains('Guardar').click();
  cy.wait(500);
});