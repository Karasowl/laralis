/**
 * TESTS CRUD ROBUSTOS - MÓDULO DE SERVICIOS
 * Cobertura completa de operaciones CRUD con detección de errores
 * Incluye integración con motor de cálculos y gestión de insumos
 */

describe('CRUD Robusto: Módulo de Servicios', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/services');
    cy.wait(1000);
  });

  describe('CREATE - Creación de Servicios', () => {
    it('CREATE-SV001: Debe crear servicio con datos mínimos requeridos', () => {
      cy.get('button').contains('Agregar').click();
      
      const uniqueId = Date.now();
      cy.get('input[name="name"]').type(`Limpieza Dental ${uniqueId}`);
      cy.get('input[name="duration_minutes"]').type('45');
      cy.get('input[name="margin_percentage"]').type('65');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificaciones
      cy.contains('Servicio creado exitosamente').should('be.visible');
      cy.contains(`Limpieza Dental ${uniqueId}`).should('be.visible');
      cy.contains('45 min').should('be.visible');
      cy.contains('65%').should('be.visible');
      
      // Verificar cálculo automático de precio
      cy.get('[data-cy="calculated-price"]').should('be.visible');
    });

    it('CREATE-SV002: Debe crear servicio con información completa', () => {
      cy.get('button').contains('Agregar').click();
      
      const uniqueId = Date.now();
      const serviceData = {
        name: `Endodoncia Completa ${uniqueId}`,
        description: 'Tratamiento de conductos radiculares con obturación',
        category: 'Endodoncia',
        duration_minutes: '120',
        margin_percentage: '75',
        difficulty_level: 'high',
        requires_anesthesia: true,
        sessions_required: '2'
      };
      
      // Llenar campos básicos
      cy.get('input[name="name"]').type(serviceData.name);
      cy.get('textarea[name="description"]').type(serviceData.description);
      cy.get('select[name="category"]').then($select => {
        if ($select.length) {
          cy.wrap($select).select(serviceData.category);
        }
      });
      cy.get('input[name="duration_minutes"]').type(serviceData.duration_minutes);
      cy.get('input[name="margin_percentage"]').type(serviceData.margin_percentage);
      cy.get('select[name="difficulty_level"]').select(serviceData.difficulty_level);
      cy.get('input[name="sessions_required"]').type(serviceData.sessions_required);
      
      // Checkbox de anestesia
      if (serviceData.requires_anesthesia) {
        cy.get('input[name="requires_anesthesia"]').check();
      }
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificaciones completas
      cy.contains('Servicio creado exitosamente').should('be.visible');
      cy.contains(serviceData.name).should('be.visible');
      cy.contains('120 min').should('be.visible');
      cy.contains('75%').should('be.visible');
      cy.contains('Alta').should('be.visible'); // Dificultad
    });

    it('CREATE-SV003: Debe crear servicio con insumos asociados', () => {
      // Primero crear un insumo
      cy.visit('/supplies');
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Anestesia Local');
      cy.get('input[name="unit"]').type('ampolla');
      cy.get('input[name="quantity_per_unit"]').type('2');
      cy.get('input[name="cost_per_unit_cents"]').type('1500'); // $15.00
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Crear servicio con insumo
      cy.visit('/services');
      cy.get('button').contains('Agregar').click();
      
      const uniqueId = Date.now();
      cy.get('input[name="name"]').type(`Extracción Simple ${uniqueId}`);
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('60');
      
      // Agregar insumo
      cy.get('button').contains('Agregar insumo').click();
      cy.get('select[name="supply_id"]').select('Anestesia Local');
      cy.get('input[name="quantity_used"]').type('1');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificaciones
      cy.contains('Servicio creado exitosamente').should('be.visible');
      cy.contains(`Extracción Simple ${uniqueId}`).should('be.visible');
      
      // Verificar cálculo con costos de insumos
      cy.get('[data-cy="service-row"]').first().click();
      cy.contains('Costos Variables').should('be.visible');
      cy.contains('Anestesia Local').should('be.visible');
      cy.contains('$15.00').should('be.visible');
    });

    it('CREATE-SV004: Debe validar campos requeridos', () => {
      cy.get('button').contains('Agregar').click();
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar mensajes de error
      cy.contains('El nombre es requerido').should('be.visible');
      cy.contains('La duración es requerida').should('be.visible');
      cy.contains('El margen es requerido').should('be.visible');
    });

    it('CREATE-SV005: Debe validar duración positiva', () => {
      cy.get('button').contains('Agregar').click();
      
      cy.get('input[name="name"]').type('Duración Inválida');
      cy.get('input[name="duration_minutes"]').type('-30');
      cy.get('input[name="margin_percentage"]').type('50');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('La duración debe ser mayor a cero').should('be.visible');
    });

    it('CREATE-SV006: Debe validar rango de margen (0-100%)', () => {
      cy.get('button').contains('Agregar').click();
      
      cy.get('input[name="name"]').type('Margen Inválido');
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('150');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El margen debe estar entre 0% y 100%').should('be.visible');
    });

    it('CREATE-SV007: Debe calcular precio automáticamente', () => {
      cy.get('button').contains('Agregar').click();
      
      cy.get('input[name="name"]').type('Test Cálculo');
      cy.get('input[name="duration_minutes"]').type('60');
      cy.get('input[name="margin_percentage"]').type('70');
      
      // Verificar que se muestra preview del cálculo
      cy.get('[data-cy="price-preview"]').should('be.visible');
      cy.get('[data-cy="cost-breakdown"]').should('be.visible');
      
      // Cambiar duración y verificar recálculo
      cy.get('input[name="duration_minutes"]').clear().type('90');
      cy.get('[data-cy="price-preview"]').should('not.contain', 'previous-price');
    });

    it('CREATE-SV008: Debe manejar error de red al crear', () => {
      cy.intercept('POST', '/api/services', { forceNetworkError: true }).as('networkError');
      
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Network Error');
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('50');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.wait('@networkError');
      
      cy.contains('Error de conexión').should('be.visible');
      cy.contains('Reintentar').should('be.visible');
    });
  });

  describe('READ - Lectura y Listado de Servicios', () => {
    beforeEach(() => {
      // Crear servicios de prueba
      const testServices = [
        { name: 'Limpieza Básica', duration: '30', margin: '60', category: 'Preventiva' },
        { name: 'Resina Dental', duration: '60', margin: '70', category: 'Restaurativa' },
        { name: 'Ortodoncia Inicial', duration: '90', margin: '80', category: 'Ortodoncia' }
      ];
      
      testServices.forEach(service => {
        cy.get('button').contains('Agregar').click();
        cy.get('input[name="name"]').type(service.name);
        cy.get('input[name="duration_minutes"]').type(service.duration);
        cy.get('input[name="margin_percentage"]').type(service.margin);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('READ-SV001: Debe mostrar lista de servicios correctamente', () => {
      // Verificar que se muestran los servicios
      cy.contains('Limpieza Básica').should('be.visible');
      cy.contains('Resina Dental').should('be.visible');
      cy.contains('Ortodoncia Inicial').should('be.visible');
      
      // Verificar columnas de la tabla
      cy.get('th').contains('Servicio').should('be.visible');
      cy.get('th').contains('Duración').should('be.visible');
      cy.get('th').contains('Precio').should('be.visible');
      cy.get('th').contains('Margen').should('be.visible');
      cy.get('th').contains('Acciones').should('be.visible');
    });

    it('READ-SV002: Debe buscar servicio por nombre', () => {
      cy.get('input[placeholder*="Buscar"]').type('Limpieza');
      cy.contains('Limpieza Básica').should('be.visible');
      cy.contains('Resina Dental').should('not.exist');
    });

    it('READ-SV003: Debe filtrar por categoría', () => {
      cy.get('select[name="category_filter"]').then($select => {
        if ($select.length) {
          cy.wrap($select).select('Ortodoncia');
          cy.contains('Ortodoncia Inicial').should('be.visible');
          cy.contains('Limpieza Básica').should('not.exist');
        }
      });
    });

    it('READ-SV004: Debe filtrar por rango de duración', () => {
      cy.get('input[name="duration_min"]').type('60');
      cy.get('input[name="duration_max"]').type('120');
      cy.get('button').contains('Filtrar').click();
      
      cy.contains('Resina Dental').should('be.visible');
      cy.contains('Ortodoncia Inicial').should('be.visible');
      cy.contains('Limpieza Básica').should('not.exist');
    });

    it('READ-SV005: Debe filtrar por rango de precios', () => {
      cy.get('input[name="price_min"]').type('500');
      cy.get('input[name="price_max"]').type('1500');
      cy.get('button').contains('Filtrar').click();
      
      // Los servicios filtrados deberían estar en el rango
      cy.get('[data-cy="service-price"]').each($price => {
        const price = parseFloat($price.text().replace('$', ''));
        expect(price).to.be.within(500, 1500);
      });
    });

    it('READ-SV006: Debe ordenar por precio', () => {
      cy.get('th').contains('Precio').click();
      
      // Verificar orden ascendente
      cy.get('[data-cy="service-price"]').then($prices => {
        const prices = [...$prices].map(el => 
          parseFloat(el.textContent.replace('$', ''))
        );
        
        for (let i = 1; i < prices.length; i++) {
          expect(prices[i]).to.be.greaterThan(prices[i-1]);
        }
      });
    });

    it('READ-SV007: Debe mostrar detalles de servicio', () => {
      cy.get('[data-cy="service-row"]').first().click();
      
      // Verificar información detallada
      cy.contains('Información General').should('be.visible');
      cy.contains('Cálculo de Precios').should('be.visible');
      cy.contains('Costos Variables').should('be.visible');
      cy.contains('Historial de Precios').should('be.visible');
    });

    it('READ-SV008: Debe manejar error al cargar servicios', () => {
      cy.intercept('GET', '/api/services*', { statusCode: 500 }).as('loadError');
      
      cy.reload();
      cy.wait('@loadError');
      
      cy.contains('Error al cargar servicios').should('be.visible');
      cy.contains('Reintentar').should('be.visible');
    });

    it('READ-SV009: Debe mostrar estadísticas de servicios', () => {
      // Verificar panel de estadísticas
      cy.get('[data-cy="total-services"]').should('be.visible');
      cy.get('[data-cy="avg-duration"]').should('be.visible');
      cy.get('[data-cy="avg-price"]').should('be.visible');
      cy.get('[data-cy="most-expensive"]').should('be.visible');
    });
  });

  describe('UPDATE - Actualización de Servicios', () => {
    beforeEach(() => {
      // Crear servicio para editar
      const uniqueId = Date.now();
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type(`Editable Service ${uniqueId}`);
      cy.get('input[name="duration_minutes"]').type('45');
      cy.get('input[name="margin_percentage"]').type('65');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('UPDATE-SV001: Debe cargar formulario con datos actuales', () => {
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Editar"]').click();
      
      // Verificar que los campos tienen los valores correctos
      cy.get('input[name="name"]').should('contain.value', 'Editable Service');
      cy.get('input[name="duration_minutes"]').should('have.value', '45');
      cy.get('input[name="margin_percentage"]').should('have.value', '65');
    });

    it('UPDATE-SV002: Debe actualizar información básica', () => {
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="name"]').clear().type('Servicio Actualizado');
      cy.get('textarea[name="description"]').type('Descripción actualizada del servicio');
      cy.get('input[name="duration_minutes"]').clear().type('60');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Servicio actualizado exitosamente').should('be.visible');
      cy.contains('Servicio Actualizado').should('be.visible');
      cy.contains('60 min').should('be.visible');
    });

    it('UPDATE-SV003: Debe recalcular precio al cambiar margen', () => {
      // Obtener precio inicial
      cy.get('[data-cy="service-row"]').first().find('[data-cy="service-price"]')
        .invoke('text').as('initialPrice');
      
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="margin_percentage"]').clear().type('80');
      
      // Verificar preview de nuevo precio
      cy.get('[data-cy="price-preview"]').should('not.contain', '@initialPrice');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar precio actualizado
      cy.get('[data-cy="service-row"]').first().find('[data-cy="service-price"]')
        .should('not.contain', '@initialPrice');
    });

    it('UPDATE-SV004: Debe actualizar insumos asociados', () => {
      // Crear insumo adicional
      cy.visit('/supplies');
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Guantes Desechables');
      cy.get('input[name="unit"]').type('par');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('200');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Editar servicio
      cy.visit('/services');
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Editar"]').click();
      
      // Agregar insumo
      cy.get('button').contains('Agregar insumo').click();
      cy.get('select[name="supply_id"]').last().select('Guantes Desechables');
      cy.get('input[name="quantity_used"]').last().type('2');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar insumo agregado
      cy.contains('Servicio actualizado exitosamente').should('be.visible');
      cy.get('[data-cy="service-row"]').first().click();
      cy.contains('Guantes Desechables').should('be.visible');
      cy.contains('2 par').should('be.visible');
    });

    it('UPDATE-SV005: Debe remover insumos', () => {
      // Primero agregar un insumo
      cy.visit('/supplies');
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Insumo Temporal');
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('500');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Agregar insumo al servicio
      cy.visit('/services');
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('button').contains('Agregar insumo').click();
      cy.get('select[name="supply_id"]').select('Insumo Temporal');
      cy.get('input[name="quantity_used"]').type('1');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Remover insumo
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('[data-cy="remove-supply"]').first().click();
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar remoción
      cy.get('[data-cy="service-row"]').first().click();
      cy.contains('Insumo Temporal').should('not.exist');
    });

    it('UPDATE-SV006: Debe validar datos al actualizar', () => {
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="duration_minutes"]').clear().type('-30');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('La duración debe ser mayor a cero').should('be.visible');
    });

    it('UPDATE-SV007: Debe crear nueva versión al cambiar precios', () => {
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="margin_percentage"]').clear().type('75');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Verificar historial de versiones
      cy.get('[data-cy="service-row"]').first().click();
      cy.contains('Historial de Precios').should('be.visible');
      cy.contains('v2.0').should('be.visible'); // Nueva versión
    });

    it('UPDATE-SV008: Debe manejar conflictos de concurrencia', () => {
      cy.intercept('PUT', '/api/services/*', { 
        statusCode: 409,
        body: { error: 'El servicio fue modificado por otro usuario' }
      }).as('conflictError');
      
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="name"]').clear().type('Conflicto');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.wait('@conflictError');
      
      cy.contains('fue modificado por otro usuario').should('be.visible');
      cy.contains('Recargar').should('be.visible');
    });
  });

  describe('DELETE - Eliminación de Servicios', () => {
    beforeEach(() => {
      // Crear servicio para eliminar
      const uniqueId = Date.now();
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type(`ToDelete Service ${uniqueId}`);
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('50');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('DELETE-SV001: Debe mostrar confirmación antes de eliminar', () => {
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Eliminar"]').click();
      
      cy.contains('¿Estás seguro?').should('be.visible');
      cy.contains('Esta acción no se puede deshacer').should('be.visible');
      cy.contains('Se eliminará también el historial de precios').should('be.visible');
    });

    it('DELETE-SV002: Debe eliminar servicio al confirmar', () => {
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      cy.contains('Servicio eliminado exitosamente').should('be.visible');
      cy.contains('ToDelete Service').should('not.exist');
    });

    it('DELETE-SV003: Debe cancelar eliminación', () => {
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Cancelar').click();
      
      cy.contains('ToDelete Service').should('be.visible');
    });

    it('DELETE-SV004: Debe prevenir eliminación si está en uso', () => {
      // Simular servicio en uso en tratamientos
      cy.intercept('DELETE', '/api/services/*', { 
        statusCode: 409,
        body: { error: 'No se puede eliminar servicio que está siendo usado en tratamientos' }
      }).as('usageConflict');
      
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      cy.wait('@usageConflict');
      
      cy.contains('está siendo usado en tratamientos').should('be.visible');
    });

    it('DELETE-SV005: Debe ofrecer archivado como alternativa', () => {
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Eliminar"]').click();
      
      // Debería mostrar opción de archivar
      cy.contains('Archivar en lugar de eliminar').should('be.visible');
      cy.get('button').contains('Archivar').click();
      
      cy.contains('Servicio archivado').should('be.visible');
      
      // Verificar filtro de archivados
      cy.get('button').contains('Ver archivados').click();
      cy.contains('ToDelete Service').should('be.visible');
    });
  });

  describe('CALCULATOR - Motor de Cálculo Integrado', () => {
    it('CALC-SV001: Debe calcular precio base correctamente', () => {
      // Navegar a la calculadora
      cy.visit('/services/calculator');
      
      // Configurar parámetros
      cy.get('input[name="duration_minutes"]').type('60');
      cy.get('input[name="margin_percentage"]').type('70');
      cy.get('button').contains('Calcular').click();
      
      // Verificar componentes del cálculo
      cy.get('[data-cy="fixed-cost-per-minute"]').should('be.visible');
      cy.get('[data-cy="variable-cost"]').should('be.visible');
      cy.get('[data-cy="total-cost"]').should('be.visible');
      cy.get('[data-cy="final-price"]').should('be.visible');
      
      // Verificar fórmula mostrada
      cy.contains('Costo Fijo = (Costos Mensuales / Minutos Disponibles)').should('be.visible');
      cy.contains('Precio Final = (Costo Total / (1 - Margen))').should('be.visible');
    });

    it('CALC-SV002: Debe recalcular con cambios en tiempo', () => {
      cy.visit('/services/calculator');
      
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('60');
      cy.get('button').contains('Calcular').click();
      
      cy.get('[data-cy="final-price"]').invoke('text').as('price30min');
      
      // Cambiar duración
      cy.get('input[name="duration_minutes"]').clear().type('60');
      cy.get('button').contains('Calcular').click();
      
      cy.get('[data-cy="final-price"]').should('not.contain', '@price30min');
    });

    it('CALC-SV003: Debe incluir costos de insumos en cálculo', () => {
      cy.visit('/services/calculator');
      
      // Calcular sin insumos
      cy.get('input[name="duration_minutes"]').type('45');
      cy.get('input[name="margin_percentage"]').type('65');
      cy.get('button').contains('Calcular').click();
      cy.get('[data-cy="final-price"]').invoke('text').as('priceWithoutSupplies');
      
      // Agregar insumo
      cy.get('button').contains('Agregar insumo').click();
      cy.get('select[name="supply_id"]').select(0); // Primer insumo disponible
      cy.get('input[name="quantity"]').type('1');
      cy.get('button').contains('Calcular').click();
      
      // Precio debe ser mayor
      cy.get('[data-cy="final-price"]').should('not.contain', '@priceWithoutSupplies');
      
      // Verificar desglose de costos variables
      cy.get('[data-cy="variable-costs-breakdown"]').should('be.visible');
    });

    it('CALC-SV004: Debe mostrar punto de equilibrio', () => {
      cy.visit('/services/calculator');
      
      cy.get('input[name="duration_minutes"]').type('60');
      cy.get('input[name="margin_percentage"]').type('50');
      cy.get('button').contains('Calcular').click();
      
      // Verificar análisis de equilibrio
      cy.get('[data-cy="breakeven-analysis"]').should('be.visible');
      cy.get('[data-cy="breakeven-price"]').should('be.visible');
      cy.get('[data-cy="target-margin"]').should('be.visible');
    });

    it('CALC-SV005: Debe comparar con servicios similares', () => {
      // Crear servicios de referencia
      cy.visit('/services');
      
      const services = [
        { name: 'Limpieza Estándar', duration: '30', margin: '60' },
        { name: 'Limpieza Premium', duration: '45', margin: '70' }
      ];
      
      services.forEach(service => {
        cy.get('button').contains('Agregar').click();
        cy.get('input[name="name"]').type(service.name);
        cy.get('input[name="duration_minutes"]').type(service.duration);
        cy.get('input[name="margin_percentage"]').type(service.margin);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
      
      // Usar calculadora
      cy.visit('/services/calculator');
      cy.get('select[name="category"]').select('Preventiva');
      cy.get('input[name="duration_minutes"]').type('35');
      cy.get('input[name="margin_percentage"]').type('65');
      cy.get('button').contains('Calcular').click();
      
      // Verificar comparación
      cy.get('[data-cy="similar-services"]').should('be.visible');
      cy.contains('Limpieza Estándar').should('be.visible');
      cy.contains('Limpieza Premium').should('be.visible');
    });
  });

  describe('INTEGRACIÓN - Tests de Integración', () => {
    it('INTEGRATION-SV001: Debe mantener consistencia CRUD completa', () => {
      const uniqueId = Date.now();
      const serviceData = {
        name: `Integration Service ${uniqueId}`,
        duration: '75',
        margin: '70'
      };
      
      // CREATE
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type(serviceData.name);
      cy.get('input[name="duration_minutes"]').type(serviceData.duration);
      cy.get('input[name="margin_percentage"]').type(serviceData.margin);
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // READ
      cy.contains(serviceData.name).should('be.visible');
      
      // UPDATE
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="name"]').clear().type('Modified Service');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // READ updated
      cy.contains('Modified Service').should('be.visible');
      
      // DELETE
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      // READ deleted
      cy.contains('Modified Service').should('not.exist');
    });

    it('INTEGRATION-SV002: Debe sincronizar con tratamientos', () => {
      // Crear servicio
      const uniqueId = Date.now();
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type(`Treatment Service ${uniqueId}`);
      cy.get('input[name="duration_minutes"]').type('60');
      cy.get('input[name="margin_percentage"]').type('65');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Verificar en tratamientos
      cy.visit('/treatments');
      cy.get('button').contains('Agregar').click();
      cy.get('button').contains('Agregar servicio').click();
      
      cy.get('select[name="service_id"]').should('contain', `Treatment Service ${uniqueId}`);
    });

    it('INTEGRATION-SV003: Debe actualizar tratamientos al cambiar precio', () => {
      // Crear servicio
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Price Update Service');
      cy.get('input[name="duration_minutes"]').type('45');
      cy.get('input[name="margin_percentage"]').type('60');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Actualizar precio
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="margin_percentage"]').clear().type('75');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar notificación
      cy.contains('Los tratamientos que usan este servicio serán recalculados').should('be.visible');
    });

    it('INTEGRATION-SV004: Debe mantener integridad con insumos', () => {
      // Crear insumo y servicio vinculado
      cy.visit('/supplies');
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Linked Supply');
      cy.get('input[name="unit"]').type('pieza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('1000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      cy.visit('/services');
      cy.get('button').contains('Agregar').click();
      cy.get('input[name="name"]').type('Service With Supply');
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('60');
      cy.get('button').contains('Agregar insumo').click();
      cy.get('select[name="supply_id"]').select('Linked Supply');
      cy.get('input[name="quantity_used"]').type('2');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Intentar eliminar insumo
      cy.visit('/supplies');
      cy.get('tr').contains('Linked Supply').find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      // Debería mostrar advertencia
      cy.contains('está siendo usado en servicios').should('be.visible');
    });
  });

  describe('PERFORMANCE - Tests de Rendimiento', () => {
    it('PERF-SV001: Debe cargar servicios rápidamente', () => {
      const startTime = Date.now();
      
      cy.reload();
      cy.get('table').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(3000);
      });
    });

    it('PERF-SV002: Debe calcular precios sin delay perceptible', () => {
      cy.visit('/services/calculator');
      
      const startTime = Date.now();
      
      cy.get('input[name="duration_minutes"]').type('60');
      cy.get('input[name="margin_percentage"]').type('70');
      cy.get('button').contains('Calcular').click();
      
      cy.get('[data-cy="final-price"]').should('be.visible');
      
      cy.then(() => {
        const calcTime = Date.now() - startTime;
        expect(calcTime).to.be.lessThan(1000);
      });
    });

    it('PERF-SV003: Debe manejar catálogo grande de servicios', () => {
      // Simular catálogo grande
      cy.intercept('GET', '/api/services*', { 
        fixture: 'large-services-dataset.json' 
      }).as('largeDataset');
      
      cy.reload();
      cy.wait('@largeDataset');
      
      // Verificar que sigue siendo responsive
      cy.get('table').should('be.visible');
      cy.get('input[placeholder*="Buscar"]').should('be.visible');
      cy.get('button').contains('Agregar').should('be.visible');
      
      // Filtrado rápido
      const startTime = Date.now();
      cy.get('input[placeholder*="Buscar"]').type('Limpieza');
      cy.get('[data-cy="service-row"]').should('be.visible');
      
      cy.then(() => {
        const filterTime = Date.now() - startTime;
        expect(filterTime).to.be.lessThan(1000);
      });
    });
  });
});

// Comandos personalizados
Cypress.Commands.add('createTestService', (data) => {
  cy.get('button').contains('Agregar').click();
  cy.get('input[name="name"]').type(data.name);
  cy.get('input[name="duration_minutes"]').type(data.duration);
  cy.get('input[name="margin_percentage"]').type(data.margin);
  if (data.description) cy.get('textarea[name="description"]').type(data.description);
  cy.get('button[type="submit"]').contains('Guardar').click();
  cy.wait(500);
});

Cypress.Commands.add('addSupplyToService', (supplyName, quantity) => {
  cy.get('button').contains('Agregar insumo').click();
  cy.get('select[name="supply_id"]').last().select(supplyName);
  cy.get('input[name="quantity_used"]').last().type(quantity);
});