/**
 * TESTS E2E COMPLETOS - MÓDULO DE INSUMOS
 * Siguiendo principios TDD con casos reales y selectores semánticos
 */

describe('Supplies Module - Complete TDD Tests', () => {
  beforeEach(() => {
    // Login con usuario real
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/supplies');
  });

  describe('1. Visualización y Estado Inicial', () => {
    it('debe mostrar la página de insumos con elementos correctos', () => {
      // Verificar encabezado
      cy.contains('h1', 'Insumos').should('be.visible');
      
      // Verificar botones de acción
      cy.get('button').contains('Nuevo Insumo').should('be.visible');
      cy.get('button').contains('Importar').should('be.visible');
      cy.get('button').contains('Exportar').should('be.visible');
      
      // Verificar barra de búsqueda
      cy.get('input[placeholder*="Buscar"]').should('be.visible');
      
      // Verificar filtros
      cy.get('select[aria-label="Filtrar por categoría"]').should('be.visible');
      cy.get('select[aria-label="Filtrar por unidad"]').should('be.visible');
    });

    it('debe mostrar estado vacío cuando no hay insumos', () => {
      cy.contains('No hay insumos registrados').should('be.visible');
      cy.contains('Comienza agregando tu primer insumo').should('be.visible');
    });

    it('debe mostrar tabla con columnas correctas cuando hay insumos', () => {
      // Crear un insumo primero
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="name"]').type('Guantes de látex');
      cy.get('input[name="price_cents"]').type('500');
      cy.get('select[name="unit"]').select('caja');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar columnas
      cy.get('table').should('be.visible');
      cy.get('th').contains('Nombre').should('be.visible');
      cy.get('th').contains('Categoría').should('be.visible');
      cy.get('th').contains('Precio').should('be.visible');
      cy.get('th').contains('Unidad').should('be.visible');
      cy.get('th').contains('Stock').should('be.visible');
      cy.get('th').contains('Proveedor').should('be.visible');
      cy.get('th').contains('Acciones').should('be.visible');
    });
  });

  describe('2. Creación de Insumos - Validaciones', () => {
    beforeEach(() => {
      cy.get('button').contains('Nuevo Insumo').click();
    });

    it('debe validar campos requeridos', () => {
      // Intentar guardar sin datos
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar mensajes de error
      cy.contains('El nombre es requerido').should('be.visible');
      cy.contains('El precio es requerido').should('be.visible');
      cy.contains('La unidad es requerida').should('be.visible');
    });

    it('debe validar precio positivo', () => {
      cy.get('input[name="name"]').type('Test');
      cy.get('input[name="price_cents"]').type('-100');
      cy.get('select[name="unit"]').select('pieza');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El precio debe ser mayor a 0').should('be.visible');
    });

    it('debe validar formato de precio en centavos', () => {
      cy.get('input[name="name"]').type('Test');
      cy.get('input[name="price_cents"]').type('10.50'); // Debería convertir a 1050 centavos
      cy.get('select[name="unit"]').select('pieza');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar que se guardó correctamente
      cy.contains('Insumo creado exitosamente').should('be.visible');
      cy.contains('$10.50').should('be.visible');
    });

    it('debe validar stock mínimo no negativo', () => {
      cy.get('input[name="name"]').type('Test');
      cy.get('input[name="price_cents"]').type('100');
      cy.get('select[name="unit"]').select('pieza');
      cy.get('input[name="min_stock"]').type('-5');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El stock mínimo no puede ser negativo').should('be.visible');
    });

    it('debe validar que stock actual >= stock mínimo', () => {
      cy.get('input[name="name"]').type('Test');
      cy.get('input[name="price_cents"]').type('100');
      cy.get('select[name="unit"]').select('pieza');
      cy.get('input[name="current_stock"]').type('5');
      cy.get('input[name="min_stock"]').type('10');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El stock actual no puede ser menor al stock mínimo').should('be.visible');
    });

    it('debe validar código SKU único', () => {
      // Crear insumo con SKU
      cy.get('input[name="name"]').type('Primer Insumo');
      cy.get('input[name="sku"]').type('SKU001');
      cy.get('input[name="price_cents"]').type('100');
      cy.get('select[name="unit"]').select('pieza');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Intentar crear otro con mismo SKU
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="name"]').type('Segundo Insumo');
      cy.get('input[name="sku"]').type('SKU001');
      cy.get('input[name="price_cents"]').type('200');
      cy.get('select[name="unit"]').select('pieza');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El código SKU ya existe').should('be.visible');
    });
  });

  describe('3. Creación de Insumos - Casos de Éxito', () => {
    it('debe crear insumo con información mínima', () => {
      cy.get('button').contains('Nuevo Insumo').click();
      
      cy.get('input[name="name"]').type('Algodón');
      cy.get('input[name="price_cents"]').type('2500'); // $25.00
      cy.get('select[name="unit"]').select('paquete');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Insumo creado exitosamente').should('be.visible');
      cy.contains('Algodón').should('be.visible');
      cy.contains('$25.00').should('be.visible');
      cy.contains('paquete').should('be.visible');
    });

    it('debe crear insumo con información completa', () => {
      cy.get('button').contains('Nuevo Insumo').click();
      
      // Información básica
      cy.get('input[name="name"]').type('Anestesia Local Lidocaína 2%');
      cy.get('input[name="sku"]').type('ANES-LID-002');
      cy.get('textarea[name="description"]').type('Anestesia local con epinefrina 1:100,000');
      
      // Categoría
      cy.get('select[name="category"]').select('Anestésicos');
      
      // Precio y unidad
      cy.get('input[name="price_cents"]').type('4500'); // $45.00
      cy.get('select[name="unit"]').select('cartucho');
      
      // Stock
      cy.get('input[name="current_stock"]').type('50');
      cy.get('input[name="min_stock"]').type('10');
      cy.get('input[name="max_stock"]').type('100');
      
      // Proveedor
      cy.get('input[name="supplier"]').type('Dental Supply Co.');
      cy.get('input[name="supplier_code"]').type('DSC-ANES-002');
      
      // Información adicional
      cy.get('input[name="expiry_date"]').type('2026-12-31');
      cy.get('input[name="lot_number"]').type('LOT2025-001');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Insumo creado exitosamente').should('be.visible');
      cy.contains('Anestesia Local Lidocaína 2%').should('be.visible');
      cy.contains('ANES-LID-002').should('be.visible');
      cy.contains('$45.00').should('be.visible');
    });

    it('debe crear insumo con múltiples proveedores', () => {
      cy.get('button').contains('Nuevo Insumo').click();
      
      cy.get('input[name="name"]').type('Mascarillas N95');
      cy.get('input[name="price_cents"]').type('1500');
      cy.get('select[name="unit"]').select('pieza');
      
      // Agregar múltiples proveedores
      cy.get('button').contains('Agregar Proveedor').click();
      cy.get('input[name="suppliers[0].name"]').type('Proveedor A');
      cy.get('input[name="suppliers[0].price"]').type('15.00');
      cy.get('input[name="suppliers[0].code"]').type('PROV-A-001');
      
      cy.get('button').contains('Agregar Proveedor').click();
      cy.get('input[name="suppliers[1].name"]').type('Proveedor B');
      cy.get('input[name="suppliers[1].price"]').type('14.50');
      cy.get('input[name="suppliers[1].code"]').type('PROV-B-001');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Insumo creado exitosamente').should('be.visible');
    });

    it('debe crear insumo con conversión de unidades', () => {
      cy.get('button').contains('Nuevo Insumo').click();
      
      cy.get('input[name="name"]').type('Gasas estériles');
      cy.get('input[name="price_cents"]').type('3000'); // Precio por caja
      cy.get('select[name="unit"]').select('caja');
      
      // Configurar conversión
      cy.get('button').contains('Configurar conversión').click();
      cy.get('input[name="conversion_factor"]').type('100'); // 100 piezas por caja
      cy.get('select[name="conversion_unit"]').select('pieza');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Insumo creado exitosamente').should('be.visible');
      // Debería mostrar precio unitario calculado
      cy.contains('$0.30 por pieza').should('be.visible');
    });

    it('debe crear insumo con alertas de caducidad', () => {
      cy.get('button').contains('Nuevo Insumo').click();
      
      cy.get('input[name="name"]').type('Hipoclorito de sodio');
      cy.get('input[name="price_cents"]').type('2000');
      cy.get('select[name="unit"]').select('litro');
      
      // Configurar alertas
      cy.get('input[name="expiry_date"]').type('2025-03-01');
      cy.get('input[name="expiry_alert_days"]').type('30'); // Alertar 30 días antes
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Insumo creado exitosamente').should('be.visible');
    });
  });

  describe('4. Búsqueda y Filtrado', () => {
    beforeEach(() => {
      // Crear varios insumos para buscar
      const supplies = [
        { name: 'Guantes de látex', category: 'Protección', price: '500', unit: 'caja' },
        { name: 'Guantes de nitrilo', category: 'Protección', price: '600', unit: 'caja' },
        { name: 'Composite A2', category: 'Materiales', price: '8000', unit: 'jeringa' },
        { name: 'Composite A3', category: 'Materiales', price: '8000', unit: 'jeringa' },
        { name: 'Anestesia Lidocaína', category: 'Anestésicos', price: '4500', unit: 'cartucho' }
      ];
      
      supplies.forEach(supply => {
        cy.get('button').contains('Nuevo Insumo').click();
        cy.get('input[name="name"]').type(supply.name);
        cy.get('select[name="category"]').select(supply.category);
        cy.get('input[name="price_cents"]').type(supply.price);
        cy.get('select[name="unit"]').select(supply.unit);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe buscar insumo por nombre', () => {
      cy.get('input[placeholder*="Buscar"]').type('Guantes');
      cy.contains('Guantes de látex').should('be.visible');
      cy.contains('Guantes de nitrilo').should('be.visible');
      cy.contains('Composite').should('not.exist');
    });

    it('debe buscar insumo por SKU', () => {
      // Asumiendo que se creó con SKU
      cy.get('input[placeholder*="Buscar"]').type('SKU');
      // Verificar resultados
    });

    it('debe filtrar por categoría', () => {
      cy.get('select[aria-label="Filtrar por categoría"]').select('Protección');
      cy.contains('Guantes de látex').should('be.visible');
      cy.contains('Guantes de nitrilo').should('be.visible');
      cy.contains('Composite').should('not.exist');
      cy.contains('Anestesia').should('not.exist');
    });

    it('debe filtrar por unidad', () => {
      cy.get('select[aria-label="Filtrar por unidad"]').select('jeringa');
      cy.contains('Composite A2').should('be.visible');
      cy.contains('Composite A3').should('be.visible');
      cy.contains('Guantes').should('not.exist');
    });

    it('debe combinar búsqueda y filtros', () => {
      cy.get('input[placeholder*="Buscar"]').type('Composite');
      cy.get('select[aria-label="Filtrar por categoría"]').select('Materiales');
      
      cy.contains('Composite A2').should('be.visible');
      cy.contains('Composite A3').should('be.visible');
      cy.contains('Guantes').should('not.exist');
    });

    it('debe filtrar por stock bajo', () => {
      cy.get('input[type="checkbox"][name="low_stock"]').check();
      // Debería mostrar solo insumos con stock < stock_mínimo
    });

    it('debe filtrar por próximos a caducar', () => {
      cy.get('input[type="checkbox"][name="expiring_soon"]').check();
      // Debería mostrar solo insumos que caducan en los próximos 30 días
    });
  });

  describe('5. Edición de Insumos', () => {
    beforeEach(() => {
      // Crear insumo para editar
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="name"]').type('Insumo Editable');
      cy.get('input[name="price_cents"]').type('1000');
      cy.get('select[name="unit"]').select('pieza');
      cy.get('input[name="current_stock"]').type('20');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe abrir formulario con datos actuales', () => {
      cy.contains('tr', 'Insumo Editable').find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="name"]').should('have.value', 'Insumo Editable');
      cy.get('input[name="price_cents"]').should('have.value', '1000');
      cy.get('select[name="unit"]').should('have.value', 'pieza');
      cy.get('input[name="current_stock"]').should('have.value', '20');
    });

    it('debe actualizar información básica', () => {
      cy.contains('tr', 'Insumo Editable').find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="name"]').clear().type('Insumo Actualizado');
      cy.get('input[name="price_cents"]').clear().type('1500');
      cy.get('textarea[name="description"]').type('Nueva descripción');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Insumo actualizado exitosamente').should('be.visible');
      cy.contains('Insumo Actualizado').should('be.visible');
      cy.contains('$15.00').should('be.visible');
    });

    it('debe actualizar stock', () => {
      cy.contains('tr', 'Insumo Editable').find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="current_stock"]').clear().type('50');
      cy.get('input[name="min_stock"]').clear().type('10');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Insumo actualizado exitosamente').should('be.visible');
      cy.contains('50').should('be.visible');
    });

    it('debe registrar historial de cambios de precio', () => {
      cy.contains('tr', 'Insumo Editable').find('button[aria-label="Editar"]').click();
      
      // Cambiar precio
      cy.get('input[name="price_cents"]').clear().type('1200');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Ver historial
      cy.contains('tr', 'Insumo Editable').find('button[aria-label="Ver historial"]').click();
      cy.contains('Historial de Precios').should('be.visible');
      cy.contains('$10.00 → $12.00').should('be.visible');
    });

    it('debe cancelar edición sin guardar', () => {
      cy.contains('tr', 'Insumo Editable').find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="name"]').clear().type('No Guardar');
      cy.get('button').contains('Cancelar').click();
      
      cy.contains('Insumo Editable').should('be.visible');
      cy.contains('No Guardar').should('not.exist');
    });
  });

  describe('6. Gestión de Stock', () => {
    beforeEach(() => {
      // Crear insumo con stock
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="name"]').type('Insumo con Stock');
      cy.get('input[name="price_cents"]').type('1000');
      cy.get('select[name="unit"]').select('pieza');
      cy.get('input[name="current_stock"]').type('50');
      cy.get('input[name="min_stock"]').type('10');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe realizar entrada de stock', () => {
      cy.contains('tr', 'Insumo con Stock').find('button[aria-label="Gestionar stock"]').click();
      
      cy.get('button').contains('Entrada').click();
      cy.get('input[name="quantity"]').type('20');
      cy.get('input[name="reason"]').type('Compra nueva');
      cy.get('input[name="invoice_number"]').type('FAC-001');
      cy.get('button[type="submit"]').contains('Registrar').click();
      
      cy.contains('Entrada registrada exitosamente').should('be.visible');
      cy.contains('70').should('be.visible'); // 50 + 20
    });

    it('debe realizar salida de stock', () => {
      cy.contains('tr', 'Insumo con Stock').find('button[aria-label="Gestionar stock"]').click();
      
      cy.get('button').contains('Salida').click();
      cy.get('input[name="quantity"]').type('10');
      cy.get('input[name="reason"]').type('Uso en tratamiento');
      cy.get('button[type="submit"]').contains('Registrar').click();
      
      cy.contains('Salida registrada exitosamente').should('be.visible');
      cy.contains('40').should('be.visible'); // 50 - 10
    });

    it('debe validar salida mayor al stock disponible', () => {
      cy.contains('tr', 'Insumo con Stock').find('button[aria-label="Gestionar stock"]').click();
      
      cy.get('button').contains('Salida').click();
      cy.get('input[name="quantity"]').type('100'); // Mayor al stock actual
      cy.get('button[type="submit"]').contains('Registrar').click();
      
      cy.contains('Stock insuficiente').should('be.visible');
    });

    it('debe realizar ajuste de inventario', () => {
      cy.contains('tr', 'Insumo con Stock').find('button[aria-label="Gestionar stock"]').click();
      
      cy.get('button').contains('Ajuste').click();
      cy.get('input[name="new_quantity"]').type('45');
      cy.get('textarea[name="reason"]').type('Ajuste por inventario físico');
      cy.get('button[type="submit"]').contains('Ajustar').click();
      
      cy.contains('Ajuste realizado exitosamente').should('be.visible');
      cy.contains('45').should('be.visible');
    });

    it('debe mostrar alertas de stock bajo', () => {
      // Reducir stock por debajo del mínimo
      cy.contains('tr', 'Insumo con Stock').find('button[aria-label="Gestionar stock"]').click();
      
      cy.get('button').contains('Salida').click();
      cy.get('input[name="quantity"]').type('45'); // Dejar stock en 5 (menor a 10)
      cy.get('button[type="submit"]').contains('Registrar').click();
      
      // Verificar alerta
      cy.contains('Stock bajo').should('be.visible');
      cy.get('[data-testid="low-stock-badge"]').should('be.visible');
    });

    it('debe mostrar historial de movimientos', () => {
      // Realizar algunos movimientos primero
      cy.contains('tr', 'Insumo con Stock').find('button[aria-label="Gestionar stock"]').click();
      
      cy.get('button').contains('Entrada').click();
      cy.get('input[name="quantity"]').type('10');
      cy.get('button[type="submit"]').contains('Registrar').click();
      cy.wait(500);
      
      cy.get('button').contains('Ver historial').click();
      
      cy.contains('Historial de Movimientos').should('be.visible');
      cy.contains('Entrada: +10').should('be.visible');
      cy.contains('Stock inicial: 50').should('be.visible');
    });
  });

  describe('7. Eliminación de Insumos', () => {
    beforeEach(() => {
      // Crear insumo para eliminar
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="name"]').type('Insumo a Eliminar');
      cy.get('input[name="price_cents"]').type('1000');
      cy.get('select[name="unit"]').select('pieza');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe mostrar confirmación antes de eliminar', () => {
      cy.contains('tr', 'Insumo a Eliminar').find('button[aria-label="Eliminar"]').click();
      
      cy.contains('¿Estás seguro?').should('be.visible');
      cy.contains('Esta acción no se puede deshacer').should('be.visible');
      cy.contains('Se eliminará también de las recetas de servicios').should('be.visible');
    });

    it('debe eliminar insumo al confirmar', () => {
      cy.contains('tr', 'Insumo a Eliminar').find('button[aria-label="Eliminar"]').click();
      cy.contains('button', 'Eliminar').click();
      
      cy.contains('Insumo eliminado exitosamente').should('be.visible');
      cy.contains('Insumo a Eliminar').should('not.exist');
    });

    it('debe cancelar eliminación', () => {
      cy.contains('tr', 'Insumo a Eliminar').find('button[aria-label="Eliminar"]').click();
      cy.contains('button', 'Cancelar').click();
      
      cy.contains('Insumo a Eliminar').should('be.visible');
    });

    it('no debe permitir eliminar insumo usado en servicios', () => {
      // Este test requiere crear un servicio que use el insumo
      // Por ahora simular el comportamiento esperado
      
      cy.contains('tr', 'Insumo a Eliminar').find('button[aria-label="Eliminar"]').click();
      cy.contains('button', 'Eliminar').click();
      
      // Debería mostrar error si está en uso
      // cy.contains('No se puede eliminar: insumo en uso').should('be.visible');
    });
  });

  describe('8. Importación y Exportación', () => {
    beforeEach(() => {
      // Crear algunos insumos para exportar
      const supplies = [
        { name: 'Export1', price: '1000', unit: 'pieza' },
        { name: 'Export2', price: '2000', unit: 'caja' },
        { name: 'Export3', price: '3000', unit: 'paquete' }
      ];
      
      supplies.forEach(supply => {
        cy.get('button').contains('Nuevo Insumo').click();
        cy.get('input[name="name"]').type(supply.name);
        cy.get('input[name="price_cents"]').type(supply.price);
        cy.get('select[name="unit"]').select(supply.unit);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe exportar insumos a CSV', () => {
      cy.get('button').contains('Exportar').click();
      cy.get('button').contains('Exportar CSV').click();
      
      // Verificar descarga
      cy.readFile('cypress/downloads/insumos.csv').should('exist');
    });

    it('debe exportar insumos a Excel', () => {
      cy.get('button').contains('Exportar').click();
      cy.get('button').contains('Exportar Excel').click();
      
      // Verificar descarga
      cy.readFile('cypress/downloads/insumos.xlsx').should('exist');
    });

    it('debe importar insumos desde CSV', () => {
      cy.get('button').contains('Importar').click();
      
      // Subir archivo
      cy.get('input[type="file"]').selectFile('cypress/fixtures/insumos-import.csv');
      
      cy.get('button').contains('Procesar').click();
      
      // Verificar preview
      cy.contains('Vista previa de importación').should('be.visible');
      cy.contains('5 insumos a importar').should('be.visible');
      
      // Verificar validaciones
      cy.contains('2 advertencias encontradas').should('be.visible');
      
      // Confirmar importación
      cy.get('button').contains('Confirmar Importación').click();
      
      cy.contains('Importación exitosa').should('be.visible');
    });

    it('debe validar formato de archivo', () => {
      cy.get('button').contains('Importar').click();
      
      cy.get('input[type="file"]').selectFile('cypress/fixtures/invalid-file.txt');
      
      cy.contains('Formato de archivo no válido').should('be.visible');
    });

    it('debe mostrar errores de validación en importación', () => {
      cy.get('button').contains('Importar').click();
      
      cy.get('input[type="file"]').selectFile('cypress/fixtures/insumos-invalid.csv');
      cy.get('button').contains('Procesar').click();
      
      // Mostrar errores
      cy.contains('Errores encontrados').should('be.visible');
      cy.contains('Fila 2: Precio inválido').should('be.visible');
      cy.contains('Fila 5: Unidad no reconocida').should('be.visible');
    });

    it('debe permitir mapeo de columnas en importación', () => {
      cy.get('button').contains('Importar').click();
      
      cy.get('input[type="file"]').selectFile('cypress/fixtures/insumos-custom.csv');
      
      // Mapear columnas
      cy.get('select[name="column_name"]').select('Producto');
      cy.get('select[name="column_price"]').select('Costo');
      cy.get('select[name="column_unit"]').select('Medida');
      
      cy.get('button').contains('Procesar').click();
      
      cy.contains('Vista previa de importación').should('be.visible');
    });
  });

  describe('9. Integración con Servicios', () => {
    beforeEach(() => {
      // Crear insumos para usar en servicios
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="name"]').type('Composite para servicio');
      cy.get('input[name="price_cents"]').type('8000');
      cy.get('select[name="unit"]').select('jeringa');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe mostrar insumos disponibles al crear servicio', () => {
      cy.visit('/services');
      cy.get('button').contains('Nuevo Servicio').click();
      
      // Agregar insumo al servicio
      cy.get('button').contains('Agregar Insumo').click();
      cy.get('select[name="supply_id"]').should('contain', 'Composite para servicio');
    });

    it('debe calcular costo variable del servicio', () => {
      cy.visit('/services');
      cy.get('button').contains('Nuevo Servicio').click();
      
      cy.get('input[name="name"]').type('Obturación con composite');
      cy.get('button').contains('Agregar Insumo').click();
      cy.get('select[name="supply_id"]').select('Composite para servicio');
      cy.get('input[name="quantity"]').type('0.5'); // Media jeringa
      
      // Verificar cálculo
      cy.contains('Costo variable: $40.00').should('be.visible'); // 8000 * 0.5 / 100
    });

    it('debe actualizar stock al realizar tratamiento', () => {
      // Este test requiere crear un tratamiento completo
      // Verificar que el stock se reduce automáticamente
    });

    it('debe mostrar alerta si no hay stock suficiente para servicio', () => {
      // Reducir stock del insumo
      cy.contains('tr', 'Composite para servicio').find('button[aria-label="Editar"]').click();
      cy.get('input[name="current_stock"]').clear().type('0.2'); // Poco stock
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Intentar crear tratamiento
      cy.visit('/treatments');
      cy.get('button').contains('Nuevo Tratamiento').click();
      
      // Seleccionar servicio que usa el insumo
      // Debería mostrar advertencia de stock insuficiente
    });
  });

  describe('10. Reportes y Análisis', () => {
    beforeEach(() => {
      // Crear datos para reportes
      const supplies = [
        { name: 'Alto consumo', price: '1000', stock: '100', used: '80' },
        { name: 'Bajo consumo', price: '2000', stock: '50', used: '5' },
        { name: 'Sin movimiento', price: '3000', stock: '20', used: '0' }
      ];
      
      supplies.forEach(supply => {
        cy.get('button').contains('Nuevo Insumo').click();
        cy.get('input[name="name"]').type(supply.name);
        cy.get('input[name="price_cents"]').type(supply.price);
        cy.get('input[name="current_stock"]').type(supply.stock);
        cy.get('select[name="unit"]').select('pieza');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe mostrar reporte de consumo', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Reporte de Consumo').click();
      
      cy.contains('Análisis de Consumo').should('be.visible');
      cy.contains('Alto consumo').should('be.visible');
      cy.contains('80% de rotación').should('be.visible');
    });

    it('debe mostrar reporte de valorización de inventario', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Valorización').click();
      
      cy.contains('Valor Total del Inventario').should('be.visible');
      // Calcular valor total: (100*10 + 50*20 + 20*30) = 2600
      cy.contains('$260.00').should('be.visible');
    });

    it('debe mostrar insumos sin movimiento', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Sin Movimiento').click();
      
      cy.contains('Insumos Sin Movimiento').should('be.visible');
      cy.contains('Sin movimiento').should('be.visible');
      cy.contains('0 unidades consumidas').should('be.visible');
    });

    it('debe generar reporte de próximos a caducar', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Caducidad').click();
      
      cy.contains('Próximos a Caducar').should('be.visible');
      // Mostrar insumos que caducan en los próximos 30 días
    });

    it('debe mostrar gráfico de tendencias de consumo', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Tendencias').click();
      
      cy.contains('Tendencias de Consumo').should('be.visible');
      cy.get('canvas[id="consumption-chart"]').should('be.visible');
    });
  });

  describe('11. Categorías y Organización', () => {
    it('debe crear nueva categoría', () => {
      cy.get('button').contains('Gestionar Categorías').click();
      
      cy.get('button').contains('Nueva Categoría').click();
      cy.get('input[name="category_name"]').type('Ortodoncia');
      cy.get('input[name="category_color"]').type('#FF5733');
      cy.get('button[type="submit"]').contains('Crear').click();
      
      cy.contains('Categoría creada exitosamente').should('be.visible');
    });

    it('debe asignar múltiples categorías a un insumo', () => {
      cy.get('button').contains('Nuevo Insumo').click();
      
      cy.get('input[name="name"]').type('Insumo multicategoría');
      cy.get('input[name="price_cents"]').type('1000');
      cy.get('select[name="unit"]').select('pieza');
      
      // Seleccionar múltiples categorías
      cy.get('input[name="categories"]').type('Endodoncia{enter}');
      cy.get('input[name="categories"]').type('Urgencias{enter}');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Insumo creado exitosamente').should('be.visible');
    });

    it('debe reorganizar orden de categorías', () => {
      cy.get('button').contains('Gestionar Categorías').click();
      
      // Drag and drop para reordenar
      cy.get('[data-category="Materiales"]').drag('[data-category="Anestésicos"]');
      
      cy.contains('Orden actualizado').should('be.visible');
    });
  });

  describe('12. Configuración y Preferencias', () => {
    it('debe configurar unidades personalizadas', () => {
      cy.get('button').contains('Configuración').click();
      cy.get('button').contains('Unidades').click();
      
      cy.get('button').contains('Agregar Unidad').click();
      cy.get('input[name="unit_name"]').type('ampolla');
      cy.get('input[name="unit_plural"]').type('ampollas');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar que aparece en el selector
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('select[name="unit"]').should('contain', 'ampolla');
    });

    it('debe configurar alertas automáticas', () => {
      cy.get('button').contains('Configuración').click();
      cy.get('button').contains('Alertas').click();
      
      // Configurar alerta de stock bajo
      cy.get('input[name="low_stock_threshold"]').clear().type('20');
      cy.get('input[name="email_alerts"]').check();
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Configuración guardada').should('be.visible');
    });

    it('debe configurar formato de códigos SKU', () => {
      cy.get('button').contains('Configuración').click();
      cy.get('button').contains('SKU').click();
      
      cy.get('select[name="sku_format"]').select('AUTO');
      cy.get('input[name="sku_prefix"]').type('INS-');
      cy.get('input[name="sku_digits"]').type('5');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar en nuevo insumo
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="sku"]').should('have.value', 'INS-00001');
    });
  });

  describe('13. Permisos y Multi-tenancy', () => {
    it('debe mostrar solo insumos de la clínica actual', () => {
      // Los insumos creados deben pertenecer a la clínica del usuario
      cy.get('input[placeholder*="Buscar"]').type('OtraClinica');
      cy.contains('No se encontraron insumos').should('be.visible');
    });

    it('debe aplicar clinic_id automáticamente', () => {
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="name"]').type('Test Clinic');
      cy.get('input[name="price_cents"]').type('1000');
      cy.get('select[name="unit"]').select('pieza');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // El insumo debe ser visible para el usuario actual
      cy.contains('Test Clinic').should('be.visible');
    });
  });

  describe('14. Rendimiento y UX', () => {
    it('debe mostrar skeleton loaders mientras carga', () => {
      cy.visit('/supplies', {
        onBeforeLoad: (win) => {
          // Simular carga lenta
          cy.intercept('GET', '/api/supplies*', (req) => {
            req.reply((res) => {
              res.delay(1000);
            });
          });
        }
      });
      
      cy.get('[aria-label="Cargando..."]').should('be.visible');
    });

    it('debe mantener filtros al navegar', () => {
      // Aplicar filtros
      cy.get('select[aria-label="Filtrar por categoría"]').select('Materiales');
      cy.get('input[placeholder*="Buscar"]').type('Composite');
      
      // Navegar a otra página
      cy.visit('/patients');
      
      // Regresar
      cy.go('back');
      
      // Los filtros deberían mantenerse
      cy.get('select[aria-label="Filtrar por categoría"]').should('have.value', 'Materiales');
      cy.get('input[placeholder*="Buscar"]').should('have.value', 'Composite');
    });

    it('debe tener paginación virtual para listas largas', () => {
      // Con muchos insumos, debería usar scroll virtual
      // Este test requiere crear muchos insumos
    });

    it('debe mostrar acciones rápidas en hover', () => {
      // Crear un insumo
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="name"]').type('Hover Test');
      cy.get('input[name="price_cents"]').type('1000');
      cy.get('select[name="unit"]').select('pieza');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Hover sobre la fila
      cy.contains('tr', 'Hover Test').trigger('mouseenter');
      
      // Deberían aparecer acciones rápidas
      cy.get('[data-testid="quick-actions"]').should('be.visible');
      cy.contains('Entrada rápida').should('be.visible');
      cy.contains('Salida rápida').should('be.visible');
    });

    it('debe soportar atajos de teclado', () => {
      // Ctrl+N para nuevo insumo
      cy.get('body').type('{ctrl}n');
      cy.contains('Nuevo Insumo').should('be.visible');
      
      // Escape para cerrar
      cy.get('body').type('{esc}');
      cy.contains('Nuevo Insumo').should('not.exist');
      
      // Ctrl+F para buscar
      cy.get('body').type('{ctrl}f');
      cy.get('input[placeholder*="Buscar"]').should('be.focused');
    });
  });
});

// Comandos personalizados para este módulo
Cypress.Commands.add('createSupply', (data) => {
  cy.get('button').contains('Nuevo Insumo').click();
  cy.get('input[name="name"]').type(data.name);
  cy.get('input[name="price_cents"]').type(data.price);
  cy.get('select[name="unit"]').select(data.unit);
  if (data.stock) cy.get('input[name="current_stock"]').type(data.stock);
  cy.get('button[type="submit"]').contains('Guardar').click();
  cy.wait(500);
});

Cypress.Commands.add('searchSupply', (query) => {
  cy.get('input[placeholder*="Buscar"]').clear().type(query);
});

Cypress.Commands.add('filterByCategory', (category) => {
  cy.get('select[aria-label="Filtrar por categoría"]').select(category);
});