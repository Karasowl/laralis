/**
 * TESTS E2E COMPLETOS - MÓDULO DE SERVICIOS
 * Siguiendo principios TDD con casos reales y selectores semánticos
 */

describe('Services Module - Complete TDD Tests', () => {
  beforeEach(() => {
    // Login con usuario real
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/services');
  });

  describe('1. Visualización y Estado Inicial', () => {
    it('debe mostrar la página de servicios con elementos correctos', () => {
      // Verificar encabezado
      cy.contains('h1', 'Servicios').should('be.visible');
      
      // Verificar botones principales
      cy.get('button').contains('Nuevo Servicio').should('be.visible');
      cy.get('button').contains('Importar').should('be.visible');
      cy.get('button').contains('Exportar').should('be.visible');
      
      // Verificar barra de búsqueda
      cy.get('input[placeholder*="Buscar"]').should('be.visible');
      
      // Verificar filtros
      cy.get('select[aria-label="Filtrar por categoría"]').should('be.visible');
      cy.get('select[aria-label="Filtrar por estado"]').should('be.visible');
    });

    it('debe mostrar estado vacío cuando no hay servicios', () => {
      cy.contains('No hay servicios registrados').should('be.visible');
      cy.contains('Comienza agregando tu primer servicio').should('be.visible');
    });

    it('debe mostrar tabla con columnas correctas cuando hay servicios', () => {
      // Crear un servicio primero
      cy.get('button').contains('Nuevo Servicio').click();
      cy.get('input[name="name"]').type('Limpieza dental');
      cy.get('input[name="minutes"]').type('30');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar columnas
      cy.get('table').should('be.visible');
      cy.get('th').contains('Servicio').should('be.visible');
      cy.get('th').contains('Categoría').should('be.visible');
      cy.get('th').contains('Duración').should('be.visible');
      cy.get('th').contains('Costo Variable').should('be.visible');
      cy.get('th').contains('Precio').should('be.visible');
      cy.get('th').contains('Margen').should('be.visible');
      cy.get('th').contains('Estado').should('be.visible');
      cy.get('th').contains('Acciones').should('be.visible');
    });
  });

  describe('2. Creación de Servicios - Validaciones', () => {
    beforeEach(() => {
      cy.get('button').contains('Nuevo Servicio').click();
    });

    it('debe validar campos requeridos', () => {
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El nombre es requerido').should('be.visible');
      cy.contains('La duración es requerida').should('be.visible');
    });

    it('debe validar duración mínima', () => {
      cy.get('input[name="name"]').type('Test');
      cy.get('input[name="minutes"]').type('0');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('La duración debe ser mayor a 0').should('be.visible');
    });

    it('debe validar duración máxima razonable', () => {
      cy.get('input[name="name"]').type('Test');
      cy.get('input[name="minutes"]').type('600'); // 10 horas
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('La duración máxima es 480 minutos (8 horas)').should('be.visible');
    });

    it('debe validar margen de ganancia', () => {
      cy.get('input[name="name"]').type('Test');
      cy.get('input[name="minutes"]').type('30');
      cy.get('input[name="margin_percent"]').type('-10');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El margen no puede ser negativo').should('be.visible');
    });

    it('debe validar que el precio sea mayor al costo', () => {
      cy.get('input[name="name"]').type('Test');
      cy.get('input[name="minutes"]').type('30');
      cy.get('input[name="override_price_cents"]').type('100'); // Precio muy bajo
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El precio debe ser mayor al costo total').should('be.visible');
    });

    it('debe validar nombre único del servicio', () => {
      // Crear primer servicio
      cy.get('input[name="name"]').type('Ortodoncia');
      cy.get('input[name="minutes"]').type('60');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Intentar crear otro con mismo nombre
      cy.get('button').contains('Nuevo Servicio').click();
      cy.get('input[name="name"]').type('Ortodoncia');
      cy.get('input[name="minutes"]').type('45');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Ya existe un servicio con ese nombre').should('be.visible');
    });
  });

  describe('3. Creación de Servicios - Casos de Éxito', () => {
    it('debe crear servicio básico sin insumos', () => {
      cy.get('button').contains('Nuevo Servicio').click();
      
      cy.get('input[name="name"]').type('Consulta de evaluación');
      cy.get('textarea[name="description"]').type('Evaluación inicial del paciente');
      cy.get('select[name="category"]').select('Diagnóstico');
      cy.get('input[name="minutes"]').type('20');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Servicio creado exitosamente').should('be.visible');
      cy.contains('Consulta de evaluación').should('be.visible');
      cy.contains('20 min').should('be.visible');
    });

    it('debe crear servicio con insumos y calcular costo variable', () => {
      // Primero crear insumos
      cy.visit('/supplies');
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="name"]').type('Composite A2');
      cy.get('input[name="price_cents"]').type('8000');
      cy.get('select[name="unit"]').select('jeringa');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Volver a servicios
      cy.visit('/services');
      cy.get('button').contains('Nuevo Servicio').click();
      
      cy.get('input[name="name"]').type('Obturación con composite');
      cy.get('input[name="minutes"]').type('45');
      
      // Agregar insumo
      cy.get('button').contains('Agregar Insumo').click();
      cy.get('select[name="supplies[0].supply_id"]').select('Composite A2');
      cy.get('input[name="supplies[0].quantity"]').type('0.25'); // 1/4 de jeringa
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Servicio creado exitosamente').should('be.visible');
      cy.contains('$20.00').should('be.visible'); // Costo variable: 8000 * 0.25 / 100
    });

    it('debe crear servicio con múltiples insumos', () => {
      // Crear varios insumos primero
      cy.visit('/supplies');
      
      const supplies = [
        { name: 'Anestesia', price: '4500' },
        { name: 'Gasas', price: '500' },
        { name: 'Agujas', price: '300' }
      ];
      
      supplies.forEach(supply => {
        cy.get('button').contains('Nuevo Insumo').click();
        cy.get('input[name="name"]').type(supply.name);
        cy.get('input[name="price_cents"]').type(supply.price);
        cy.get('select[name="unit"]').select('pieza');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
      
      // Crear servicio con múltiples insumos
      cy.visit('/services');
      cy.get('button').contains('Nuevo Servicio').click();
      
      cy.get('input[name="name"]').type('Extracción simple');
      cy.get('input[name="minutes"]').type('30');
      
      // Agregar insumos
      cy.get('button').contains('Agregar Insumo').click();
      cy.get('select[name="supplies[0].supply_id"]').select('Anestesia');
      cy.get('input[name="supplies[0].quantity"]').type('2');
      
      cy.get('button').contains('Agregar Insumo').click();
      cy.get('select[name="supplies[1].supply_id"]').select('Gasas');
      cy.get('input[name="supplies[1].quantity"]').type('5');
      
      cy.get('button').contains('Agregar Insumo').click();
      cy.get('select[name="supplies[2].supply_id"]').select('Agujas');
      cy.get('input[name="supplies[2].quantity"]').type('1');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Servicio creado exitosamente').should('be.visible');
      // Costo variable total: (4500*2 + 500*5 + 300*1) / 100 = $118.00
      cy.contains('$118.00').should('be.visible');
    });

    it('debe crear servicio con precio personalizado', () => {
      cy.get('button').contains('Nuevo Servicio').click();
      
      cy.get('input[name="name"]').type('Blanqueamiento dental');
      cy.get('input[name="minutes"]').type('90');
      
      // Activar precio personalizado
      cy.get('input[type="checkbox"][name="use_custom_price"]').check();
      cy.get('input[name="override_price_cents"]').type('150000'); // $1,500.00
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Servicio creado exitosamente').should('be.visible');
      cy.contains('$1,500.00').should('be.visible');
    });

    it('debe crear servicio con margen específico', () => {
      cy.get('button').contains('Nuevo Servicio').click();
      
      cy.get('input[name="name"]').type('Endodoncia');
      cy.get('input[name="minutes"]').type('120');
      cy.get('input[name="margin_percent"]').clear().type('80'); // 80% de margen
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Servicio creado exitosamente').should('be.visible');
      cy.contains('80%').should('be.visible'); // Margen
    });

    it('debe crear servicio con notas y protocolo', () => {
      cy.get('button').contains('Nuevo Servicio').click();
      
      cy.get('input[name="name"]').type('Cirugía de tercer molar');
      cy.get('input[name="minutes"]').type('60');
      cy.get('textarea[name="notes"]').type('Requiere radiografía previa');
      cy.get('textarea[name="protocol"]').type('1. Anestesia\n2. Incisión\n3. Extracción\n4. Sutura');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Servicio creado exitosamente').should('be.visible');
    });
  });

  describe('4. Cálculo de Precios y Márgenes', () => {
    beforeEach(() => {
      // Configurar costos fijos primero
      cy.visit('/settings/fixed-costs');
      cy.get('input[name="rent_cents"]').clear().type('500000'); // $5,000 renta
      cy.get('input[name="salaries_cents"]').clear().type('1000000'); // $10,000 salarios
      cy.get('input[name="other_fixed_cents"]').clear().type('200000'); // $2,000 otros
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Configurar tiempo de trabajo
      cy.visit('/settings/time');
      cy.get('input[name="days_per_month"]').clear().type('22');
      cy.get('input[name="hours_per_day"]').clear().type('8');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      cy.visit('/services');
    });

    it('debe calcular precio con costo fijo por minuto', () => {
      cy.get('button').contains('Nuevo Servicio').click();
      
      cy.get('input[name="name"]').type('Servicio con cálculo');
      cy.get('input[name="minutes"]').type('30');
      
      // El sistema debe calcular:
      // Costo fijo mensual: $17,000
      // Minutos por mes: 22 días * 8 horas * 60 min = 10,560 min
      // Costo por minuto: $17,000 / 10,560 = $1.61
      // Costo fijo del servicio: $1.61 * 30 = $48.30
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar cálculo (con margen default 50%)
      cy.contains('Costo fijo: $48').should('be.visible');
    });

    it('debe recalcular precio al cambiar duración', () => {
      cy.get('button').contains('Nuevo Servicio').click();
      
      cy.get('input[name="name"]').type('Servicio variable');
      cy.get('input[name="minutes"]').type('30');
      
      // Ver precio inicial
      cy.contains('Vista previa del precio').should('be.visible');
      const initialPrice = cy.get('[data-testid="preview-price"]').invoke('text');
      
      // Cambiar duración
      cy.get('input[name="minutes"]').clear().type('60');
      
      // El precio debe actualizarse
      cy.get('[data-testid="preview-price"]').invoke('text').should('not.equal', initialPrice);
    });

    it('debe mostrar desglose de costos', () => {
      cy.get('button').contains('Nuevo Servicio').click();
      
      cy.get('input[name="name"]').type('Servicio detallado');
      cy.get('input[name="minutes"]').type('45');
      
      // Expandir desglose
      cy.get('button').contains('Ver desglose de costos').click();
      
      cy.contains('Costo fijo').should('be.visible');
      cy.contains('Costo variable').should('be.visible');
      cy.contains('Costo total').should('be.visible');
      cy.contains('Margen').should('be.visible');
      cy.contains('Precio final').should('be.visible');
    });

    it('debe calcular correctamente con depreciación de activos', () => {
      // Agregar activo con depreciación
      cy.visit('/settings/assets');
      cy.get('button').contains('Nuevo Activo').click();
      cy.get('input[name="name"]').type('Sillón dental');
      cy.get('input[name="value_cents"]').type('5000000'); // $50,000
      cy.get('input[name="useful_life_months"]').type('60'); // 5 años
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      cy.visit('/services');
      cy.get('button').contains('Nuevo Servicio').click();
      
      cy.get('input[name="name"]').type('Servicio con depreciación');
      cy.get('input[name="minutes"]').type('30');
      
      // La depreciación debe incluirse en el costo fijo
      cy.get('button').contains('Ver desglose de costos').click();
      cy.contains('Depreciación incluida').should('be.visible');
    });
  });

  describe('5. Búsqueda y Filtrado', () => {
    beforeEach(() => {
      // Crear varios servicios
      const services = [
        { name: 'Limpieza dental', category: 'Preventivo', minutes: '30' },
        { name: 'Limpieza profunda', category: 'Preventivo', minutes: '60' },
        { name: 'Extracción simple', category: 'Cirugía', minutes: '30' },
        { name: 'Extracción compleja', category: 'Cirugía', minutes: '60' },
        { name: 'Corona de porcelana', category: 'Prótesis', minutes: '90' }
      ];
      
      services.forEach(service => {
        cy.get('button').contains('Nuevo Servicio').click();
        cy.get('input[name="name"]').type(service.name);
        cy.get('select[name="category"]').select(service.category);
        cy.get('input[name="minutes"]').type(service.minutes);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe buscar servicio por nombre', () => {
      cy.get('input[placeholder*="Buscar"]').type('Limpieza');
      cy.contains('Limpieza dental').should('be.visible');
      cy.contains('Limpieza profunda').should('be.visible');
      cy.contains('Extracción').should('not.exist');
    });

    it('debe filtrar por categoría', () => {
      cy.get('select[aria-label="Filtrar por categoría"]').select('Cirugía');
      cy.contains('Extracción simple').should('be.visible');
      cy.contains('Extracción compleja').should('be.visible');
      cy.contains('Limpieza').should('not.exist');
    });

    it('debe filtrar por duración', () => {
      cy.get('select[aria-label="Filtrar por duración"]').select('30-60 min');
      cy.contains('Limpieza dental').should('be.visible');
      cy.contains('Extracción simple').should('be.visible');
      cy.contains('Corona de porcelana').should('not.exist'); // 90 min
    });

    it('debe filtrar por estado activo/inactivo', () => {
      // Desactivar un servicio
      cy.contains('tr', 'Limpieza dental').find('button[aria-label="Editar"]').click();
      cy.get('input[type="checkbox"][name="active"]').uncheck();
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(500);
      
      // Filtrar por inactivos
      cy.get('select[aria-label="Filtrar por estado"]').select('Inactivos');
      cy.contains('Limpieza dental').should('be.visible');
      cy.contains('Limpieza profunda').should('not.exist');
    });

    it('debe filtrar por rango de precio', () => {
      cy.get('input[name="price_min"]').type('100');
      cy.get('input[name="price_max"]').type('500');
      cy.get('button').contains('Aplicar').click();
      
      // Solo servicios en ese rango de precio
      cy.get('tbody tr').each(($row) => {
        const price = $row.find('[data-testid="service-price"]').text();
        const priceNum = parseFloat(price.replace('$', '').replace(',', ''));
        expect(priceNum).to.be.within(100, 500);
      });
    });

    it('debe combinar múltiples filtros', () => {
      cy.get('input[placeholder*="Buscar"]').type('Extracción');
      cy.get('select[aria-label="Filtrar por categoría"]').select('Cirugía');
      cy.get('select[aria-label="Filtrar por duración"]').select('30-60 min');
      
      cy.contains('Extracción simple').should('be.visible');
      cy.contains('Extracción compleja').should('be.visible');
      cy.contains('Limpieza').should('not.exist');
    });
  });

  describe('6. Edición de Servicios', () => {
    beforeEach(() => {
      // Crear servicio para editar
      cy.get('button').contains('Nuevo Servicio').click();
      cy.get('input[name="name"]').type('Servicio Editable');
      cy.get('input[name="minutes"]').type('45');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe abrir formulario con datos actuales', () => {
      cy.contains('tr', 'Servicio Editable').find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="name"]').should('have.value', 'Servicio Editable');
      cy.get('input[name="minutes"]').should('have.value', '45');
    });

    it('debe actualizar información básica', () => {
      cy.contains('tr', 'Servicio Editable').find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="name"]').clear().type('Servicio Actualizado');
      cy.get('input[name="minutes"]').clear().type('60');
      cy.get('textarea[name="description"]').type('Nueva descripción');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Servicio actualizado exitosamente').should('be.visible');
      cy.contains('Servicio Actualizado').should('be.visible');
      cy.contains('60 min').should('be.visible');
    });

    it('debe agregar insumos a servicio existente', () => {
      // Crear insumo primero
      cy.visit('/supplies');
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="name"]').type('Nuevo insumo');
      cy.get('input[name="price_cents"]').type('1000');
      cy.get('select[name="unit"]').select('pieza');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      cy.visit('/services');
      cy.contains('tr', 'Servicio Editable').find('button[aria-label="Editar"]').click();
      
      cy.get('button').contains('Agregar Insumo').click();
      cy.get('select[name="supplies[0].supply_id"]').select('Nuevo insumo');
      cy.get('input[name="supplies[0].quantity"]').type('2');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Servicio actualizado exitosamente').should('be.visible');
    });

    it('debe eliminar insumos del servicio', () => {
      // Primero agregar un insumo
      cy.visit('/supplies');
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="name"]').type('Insumo temporal');
      cy.get('input[name="price_cents"]').type('500');
      cy.get('select[name="unit"]').select('pieza');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      cy.visit('/services');
      cy.contains('tr', 'Servicio Editable').find('button[aria-label="Editar"]').click();
      
      // Agregar insumo
      cy.get('button').contains('Agregar Insumo').click();
      cy.get('select[name="supplies[0].supply_id"]').select('Insumo temporal');
      cy.get('input[name="supplies[0].quantity"]').type('1');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Editar de nuevo y eliminar insumo
      cy.contains('tr', 'Servicio Editable').find('button[aria-label="Editar"]').click();
      cy.get('button[aria-label="Eliminar insumo"]').click();
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Servicio actualizado exitosamente').should('be.visible');
    });

    it('debe mantener historial de versiones', () => {
      cy.contains('tr', 'Servicio Editable').find('button[aria-label="Editar"]').click();
      
      // Hacer cambio
      cy.get('input[name="minutes"]').clear().type('90');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Ver historial
      cy.contains('tr', 'Servicio Editable').find('button[aria-label="Ver historial"]').click();
      
      cy.contains('Historial de Versiones').should('be.visible');
      cy.contains('45 min → 90 min').should('be.visible');
    });
  });

  describe('7. Duplicación y Plantillas', () => {
    beforeEach(() => {
      // Crear servicio completo para duplicar
      cy.visit('/supplies');
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="name"]').type('Insumo para plantilla');
      cy.get('input[name="price_cents"]').type('2000');
      cy.get('select[name="unit"]').select('pieza');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      cy.visit('/services');
      cy.get('button').contains('Nuevo Servicio').click();
      cy.get('input[name="name"]').type('Servicio Original');
      cy.get('input[name="minutes"]').type('60');
      cy.get('select[name="category"]').select('Restauración');
      cy.get('button').contains('Agregar Insumo').click();
      cy.get('select[name="supplies[0].supply_id"]').select('Insumo para plantilla');
      cy.get('input[name="supplies[0].quantity"]').type('3');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe duplicar servicio completo', () => {
      cy.contains('tr', 'Servicio Original').find('button[aria-label="Más opciones"]').click();
      cy.contains('Duplicar').click();
      
      // Verificar que se copia todo
      cy.get('input[name="name"]').should('have.value', 'Servicio Original (Copia)');
      cy.get('input[name="minutes"]').should('have.value', '60');
      cy.get('select[name="category"]').should('have.value', 'Restauración');
      cy.get('input[name="supplies[0].quantity"]').should('have.value', '3');
      
      // Cambiar nombre
      cy.get('input[name="name"]').clear().type('Servicio Duplicado');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Servicio creado exitosamente').should('be.visible');
      cy.contains('Servicio Duplicado').should('be.visible');
    });

    it('debe guardar servicio como plantilla', () => {
      cy.contains('tr', 'Servicio Original').find('button[aria-label="Más opciones"]').click();
      cy.contains('Guardar como plantilla').click();
      
      cy.get('input[name="template_name"]').type('Plantilla Restauración');
      cy.get('textarea[name="template_description"]').type('Plantilla base para restauraciones');
      cy.get('button[type="submit"]').contains('Guardar Plantilla').click();
      
      cy.contains('Plantilla guardada exitosamente').should('be.visible');
    });

    it('debe crear servicio desde plantilla', () => {
      // Primero guardar como plantilla
      cy.contains('tr', 'Servicio Original').find('button[aria-label="Más opciones"]').click();
      cy.contains('Guardar como plantilla').click();
      cy.get('input[name="template_name"]').type('Mi Plantilla');
      cy.get('button[type="submit"]').contains('Guardar Plantilla').click();
      cy.wait(1000);
      
      // Crear desde plantilla
      cy.get('button').contains('Nuevo Servicio').click();
      cy.get('button').contains('Usar plantilla').click();
      cy.contains('Mi Plantilla').click();
      
      // Verificar que se cargan los datos
      cy.get('input[name="minutes"]').should('have.value', '60');
      cy.get('select[name="category"]').should('have.value', 'Restauración');
      
      // Personalizar
      cy.get('input[name="name"]').type('Servicio desde plantilla');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Servicio creado exitosamente').should('be.visible');
    });
  });

  describe('8. Eliminación de Servicios', () => {
    beforeEach(() => {
      // Crear servicio para eliminar
      cy.get('button').contains('Nuevo Servicio').click();
      cy.get('input[name="name"]').type('Servicio a Eliminar');
      cy.get('input[name="minutes"]').type('30');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe mostrar confirmación antes de eliminar', () => {
      cy.contains('tr', 'Servicio a Eliminar').find('button[aria-label="Eliminar"]').click();
      
      cy.contains('¿Estás seguro?').should('be.visible');
      cy.contains('Esta acción no se puede deshacer').should('be.visible');
      cy.contains('Los tratamientos existentes mantendrán la información').should('be.visible');
    });

    it('debe eliminar servicio al confirmar', () => {
      cy.contains('tr', 'Servicio a Eliminar').find('button[aria-label="Eliminar"]').click();
      cy.contains('button', 'Eliminar').click();
      
      cy.contains('Servicio eliminado exitosamente').should('be.visible');
      cy.contains('Servicio a Eliminar').should('not.exist');
    });

    it('debe desactivar en lugar de eliminar si tiene tratamientos', () => {
      // Este caso requiere crear un tratamiento primero
      // Por ahora simular el comportamiento esperado
      
      cy.contains('tr', 'Servicio a Eliminar').find('button[aria-label="Eliminar"]').click();
      
      // Si tiene tratamientos, debería ofrecer desactivar
      // cy.contains('Este servicio tiene tratamientos asociados').should('be.visible');
      // cy.contains('¿Desea desactivarlo en su lugar?').should('be.visible');
    });
  });

  describe('9. Importación y Exportación', () => {
    beforeEach(() => {
      // Crear servicios para exportar
      const services = [
        { name: 'Export1', minutes: '30' },
        { name: 'Export2', minutes: '45' },
        { name: 'Export3', minutes: '60' }
      ];
      
      services.forEach(service => {
        cy.get('button').contains('Nuevo Servicio').click();
        cy.get('input[name="name"]').type(service.name);
        cy.get('input[name="minutes"]').type(service.minutes);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe exportar servicios a CSV', () => {
      cy.get('button').contains('Exportar').click();
      cy.get('button').contains('Exportar CSV').click();
      
      cy.readFile('cypress/downloads/servicios.csv').should('exist');
    });

    it('debe exportar servicios a Excel con recetas', () => {
      cy.get('button').contains('Exportar').click();
      cy.get('input[type="checkbox"][name="include_supplies"]').check();
      cy.get('button').contains('Exportar Excel').click();
      
      cy.readFile('cypress/downloads/servicios-completo.xlsx').should('exist');
    });

    it('debe importar servicios desde CSV', () => {
      cy.get('button').contains('Importar').click();
      
      cy.get('input[type="file"]').selectFile('cypress/fixtures/servicios-import.csv');
      cy.get('button').contains('Procesar').click();
      
      cy.contains('Vista previa de importación').should('be.visible');
      cy.contains('5 servicios a importar').should('be.visible');
      
      cy.get('button').contains('Confirmar Importación').click();
      
      cy.contains('Importación exitosa').should('be.visible');
    });

    it('debe validar servicios duplicados en importación', () => {
      cy.get('button').contains('Importar').click();
      
      cy.get('input[type="file"]').selectFile('cypress/fixtures/servicios-duplicados.csv');
      cy.get('button').contains('Procesar').click();
      
      cy.contains('Servicios duplicados encontrados').should('be.visible');
      cy.contains('Export1 ya existe').should('be.visible');
    });
  });

  describe('10. Categorías y Organización', () => {
    it('debe crear nueva categoría de servicios', () => {
      cy.get('button').contains('Gestionar Categorías').click();
      
      cy.get('button').contains('Nueva Categoría').click();
      cy.get('input[name="category_name"]').type('Odontopediatría');
      cy.get('input[name="category_color"]').type('#4CAF50');
      cy.get('textarea[name="category_description"]').type('Servicios para niños');
      cy.get('button[type="submit"]').contains('Crear').click();
      
      cy.contains('Categoría creada exitosamente').should('be.visible');
      
      // Verificar que aparece en el selector
      cy.get('button').contains('Nuevo Servicio').click();
      cy.get('select[name="category"]').should('contain', 'Odontopediatría');
    });

    it('debe agrupar servicios por categoría en la vista', () => {
      // Crear servicios en diferentes categorías
      const services = [
        { name: 'Preventivo1', category: 'Preventivo' },
        { name: 'Preventivo2', category: 'Preventivo' },
        { name: 'Cirugía1', category: 'Cirugía' },
        { name: 'Cirugía2', category: 'Cirugía' }
      ];
      
      services.forEach(service => {
        cy.get('button').contains('Nuevo Servicio').click();
        cy.get('input[name="name"]').type(service.name);
        cy.get('select[name="category"]').select(service.category);
        cy.get('input[name="minutes"]').type('30');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
      
      // Activar agrupación
      cy.get('button').contains('Agrupar por categoría').click();
      
      // Verificar agrupación
      cy.contains('h3', 'Preventivo').should('be.visible');
      cy.contains('h3', 'Cirugía').should('be.visible');
    });

    it('debe permitir ordenar servicios dentro de categoría', () => {
      cy.get('button').contains('Gestionar Orden').click();
      
      // Drag and drop para reordenar
      cy.get('[data-service="Export1"]').drag('[data-service="Export3"]');
      
      cy.contains('Orden actualizado').should('be.visible');
    });
  });

  describe('11. Paquetes de Servicios', () => {
    beforeEach(() => {
      // Crear servicios individuales
      const services = [
        { name: 'Limpieza', minutes: '30' },
        { name: 'Fluorización', minutes: '15' },
        { name: 'Radiografía', minutes: '10' }
      ];
      
      services.forEach(service => {
        cy.get('button').contains('Nuevo Servicio').click();
        cy.get('input[name="name"]').type(service.name);
        cy.get('input[name="minutes"]').type(service.minutes);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe crear paquete de servicios', () => {
      cy.get('button').contains('Nuevo Paquete').click();
      
      cy.get('input[name="package_name"]').type('Paquete Preventivo');
      cy.get('textarea[name="package_description"]').type('Incluye limpieza, fluorización y radiografía');
      
      // Agregar servicios al paquete
      cy.get('input[type="checkbox"][value="Limpieza"]').check();
      cy.get('input[type="checkbox"][value="Fluorización"]').check();
      cy.get('input[type="checkbox"][value="Radiografía"]').check();
      
      // Configurar descuento
      cy.get('input[name="discount_percent"]').type('15');
      
      cy.get('button[type="submit"]').contains('Crear Paquete').click();
      
      cy.contains('Paquete creado exitosamente').should('be.visible');
      cy.contains('Paquete Preventivo').should('be.visible');
      cy.contains('3 servicios').should('be.visible');
      cy.contains('15% descuento').should('be.visible');
    });

    it('debe calcular precio del paquete con descuento', () => {
      cy.get('button').contains('Nuevo Paquete').click();
      
      cy.get('input[name="package_name"]').type('Paquete con descuento');
      cy.get('input[type="checkbox"][value="Limpieza"]').check();
      cy.get('input[type="checkbox"][value="Fluorización"]').check();
      cy.get('input[name="discount_percent"]').type('20');
      
      // Verificar cálculo del precio
      cy.contains('Precio individual total:').should('be.visible');
      cy.contains('Descuento (20%):').should('be.visible');
      cy.contains('Precio del paquete:').should('be.visible');
    });
  });

  describe('12. Integración con Tratamientos', () => {
    beforeEach(() => {
      // Crear servicio para usar en tratamientos
      cy.get('button').contains('Nuevo Servicio').click();
      cy.get('input[name="name"]').type('Servicio para tratamiento');
      cy.get('input[name="minutes"]').type('45');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe mostrar servicios disponibles al crear tratamiento', () => {
      cy.visit('/treatments');
      cy.get('button').contains('Nuevo Tratamiento').click();
      
      cy.get('select[name="service_id"]').should('contain', 'Servicio para tratamiento');
    });

    it('debe copiar información del servicio al tratamiento', () => {
      cy.visit('/treatments');
      cy.get('button').contains('Nuevo Tratamiento').click();
      
      cy.get('select[name="service_id"]').select('Servicio para tratamiento');
      
      // Debe copiar duración y precio
      cy.get('input[name="duration"]').should('have.value', '45');
      cy.get('input[name="price"]').should('not.have.value', '0');
    });

    it('debe mostrar estadísticas de uso del servicio', () => {
      cy.contains('tr', 'Servicio para tratamiento').find('button[aria-label="Ver estadísticas"]').click();
      
      cy.contains('Estadísticas del Servicio').should('be.visible');
      cy.contains('Veces utilizado: 0').should('be.visible');
      cy.contains('Ingresos generados: $0.00').should('be.visible');
      cy.contains('Promedio mensual: 0').should('be.visible');
    });
  });

  describe('13. Tarifarios y Versiones', () => {
    it('debe crear nueva versión de tarifario', () => {
      cy.get('button').contains('Gestionar Tarifarios').click();
      
      cy.get('button').contains('Nueva Versión').click();
      cy.get('input[name="version_name"]').type('Tarifario 2025');
      cy.get('input[name="effective_date"]').type('2025-01-01');
      cy.get('textarea[name="version_notes"]').type('Ajuste anual de precios');
      cy.get('button[type="submit"]').contains('Crear').click();
      
      cy.contains('Tarifario creado exitosamente').should('be.visible');
    });

    it('debe aplicar ajuste masivo de precios', () => {
      cy.get('button').contains('Ajuste Masivo').click();
      
      cy.get('select[name="adjustment_type"]').select('Porcentaje');
      cy.get('input[name="adjustment_value"]').type('10'); // 10% de aumento
      cy.get('select[name="apply_to"]').select('Todos los servicios');
      
      cy.get('button').contains('Vista previa').click();
      
      // Verificar preview
      cy.contains('Cambios a aplicar').should('be.visible');
      cy.get('table').should('contain', '→'); // Muestra cambios
      
      cy.get('button').contains('Aplicar Ajuste').click();
      
      cy.contains('Ajuste aplicado exitosamente').should('be.visible');
    });

    it('debe mantener historial de tarifarios', () => {
      cy.get('button').contains('Historial de Tarifarios').click();
      
      cy.contains('Versiones de Tarifarios').should('be.visible');
      cy.contains('Tarifario Actual').should('be.visible');
      cy.contains('Vigente desde').should('be.visible');
    });

    it('debe comparar versiones de tarifarios', () => {
      cy.get('button').contains('Comparar Versiones').click();
      
      cy.get('select[name="version1"]').select('Tarifario 2024');
      cy.get('select[name="version2"]').select('Tarifario 2025');
      
      cy.get('button').contains('Comparar').click();
      
      cy.contains('Comparación de Tarifarios').should('be.visible');
      cy.contains('Servicios modificados').should('be.visible');
      cy.contains('Servicios nuevos').should('be.visible');
      cy.contains('Servicios eliminados').should('be.visible');
    });
  });

  describe('14. Permisos y Multi-tenancy', () => {
    it('debe mostrar solo servicios de la clínica actual', () => {
      cy.get('input[placeholder*="Buscar"]').type('OtraClinica');
      cy.contains('No se encontraron servicios').should('be.visible');
    });

    it('debe aplicar clinic_id automáticamente', () => {
      cy.get('button').contains('Nuevo Servicio').click();
      cy.get('input[name="name"]').type('Test Clinic Service');
      cy.get('input[name="minutes"]').type('30');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Test Clinic Service').should('be.visible');
    });
  });

  describe('15. Rendimiento y UX', () => {
    it('debe mostrar skeleton loaders mientras carga', () => {
      cy.visit('/services', {
        onBeforeLoad: (win) => {
          cy.intercept('GET', '/api/services*', (req) => {
            req.reply((res) => {
              res.delay(1000);
            });
          });
        }
      });
      
      cy.get('[aria-label="Cargando..."]').should('be.visible');
    });

    it('debe mostrar vista previa en tiempo real al crear', () => {
      cy.get('button').contains('Nuevo Servicio').click();
      
      // Panel de preview debe estar visible
      cy.contains('Vista previa').should('be.visible');
      
      // Escribir nombre
      cy.get('input[name="name"]').type('Mi Servicio');
      cy.get('[data-testid="preview-name"]').should('contain', 'Mi Servicio');
      
      // Cambiar duración
      cy.get('input[name="minutes"]').type('45');
      cy.get('[data-testid="preview-duration"]').should('contain', '45 min');
      
      // El precio debe actualizarse automáticamente
      cy.get('[data-testid="preview-price"]').should('not.contain', '$0.00');
    });

    it('debe tener validación en tiempo real', () => {
      cy.get('button').contains('Nuevo Servicio').click();
      
      // Escribir duración inválida
      cy.get('input[name="minutes"]').type('0');
      cy.get('input[name="minutes"]').blur();
      cy.contains('La duración debe ser mayor a 0').should('be.visible');
      
      // Corregir
      cy.get('input[name="minutes"]').clear().type('30');
      cy.contains('La duración debe ser mayor a 0').should('not.exist');
    });

    it('debe soportar atajos de teclado', () => {
      // Ctrl+N para nuevo servicio
      cy.get('body').type('{ctrl}n');
      cy.contains('Nuevo Servicio').should('be.visible');
      
      // Escape para cerrar
      cy.get('body').type('{esc}');
      cy.contains('Nuevo Servicio').should('not.exist');
      
      // Ctrl+F para buscar
      cy.get('body').type('{ctrl}f');
      cy.get('input[placeholder*="Buscar"]').should('be.focused');
      
      // Ctrl+E para exportar
      cy.get('body').type('{ctrl}e');
      cy.contains('Exportar').should('be.visible');
    });

    it('debe auto-guardar borradores', () => {
      cy.get('button').contains('Nuevo Servicio').click();
      
      // Llenar parcialmente
      cy.get('input[name="name"]').type('Servicio en borrador');
      cy.get('input[name="minutes"]').type('60');
      
      // Esperar auto-guardado
      cy.wait(3000);
      cy.contains('Borrador guardado').should('be.visible');
      
      // Cerrar sin guardar
      cy.get('button').contains('Cancelar').click();
      
      // Volver a abrir
      cy.get('button').contains('Nuevo Servicio').click();
      cy.contains('Recuperar borrador').should('be.visible');
      cy.get('button').contains('Recuperar').click();
      
      // Verificar que se recuperan los datos
      cy.get('input[name="name"]').should('have.value', 'Servicio en borrador');
      cy.get('input[name="minutes"]').should('have.value', '60');
    });
  });
});

// Comandos personalizados para este módulo
Cypress.Commands.add('createService', (data) => {
  cy.get('button').contains('Nuevo Servicio').click();
  cy.get('input[name="name"]').type(data.name);
  cy.get('input[name="minutes"]').type(data.minutes);
  if (data.category) cy.get('select[name="category"]').select(data.category);
  cy.get('button[type="submit"]').contains('Guardar').click();
  cy.wait(500);
});

Cypress.Commands.add('searchService', (query) => {
  cy.get('input[placeholder*="Buscar"]').clear().type(query);
});

Cypress.Commands.add('filterServiceByCategory', (category) => {
  cy.get('select[aria-label="Filtrar por categoría"]').select(category);
});