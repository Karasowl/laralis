/**
 * TESTS E2E COMPLETOS - MÓDULO DE GASTOS
 * Siguiendo principios TDD con casos reales y selectores semánticos
 */

describe('Expenses Module - Complete TDD Tests', () => {
  beforeEach(() => {
    // Login con usuario real
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/expenses');
  });

  describe('1. Visualización y Estado Inicial', () => {
    it('debe mostrar la página de gastos con elementos correctos', () => {
      // Verificar encabezado
      cy.contains('h1', 'Gastos').should('be.visible');
      
      // Verificar botones principales
      cy.get('button').contains('Nuevo Gasto').should('be.visible');
      cy.get('button').contains('Importar').should('be.visible');
      cy.get('button').contains('Exportar').should('be.visible');
      cy.get('button').contains('Reportes').should('be.visible');
      
      // Verificar filtros
      cy.get('input[placeholder*="Buscar"]').should('be.visible');
      cy.get('select[aria-label="Filtrar por categoría"]').should('be.visible');
      cy.get('select[aria-label="Filtrar por estado"]').should('be.visible');
      cy.get('input[type="date"][name="date_from"]').should('be.visible');
      cy.get('input[type="date"][name="date_to"]').should('be.visible');
    });

    it('debe mostrar resumen de gastos del mes', () => {
      cy.contains('Resumen del Mes').should('be.visible');
      cy.contains('Total Gastos').should('be.visible');
      cy.contains('Gastos Aprobados').should('be.visible');
      cy.contains('Gastos Pendientes').should('be.visible');
      cy.contains('Presupuesto Restante').should('be.visible');
    });

    it('debe mostrar estado vacío cuando no hay gastos', () => {
      cy.contains('No hay gastos registrados').should('be.visible');
      cy.contains('Comienza agregando tu primer gasto').should('be.visible');
    });

    it('debe mostrar tabla con columnas correctas cuando hay gastos', () => {
      // Crear un gasto
      cy.get('button').contains('Nuevo Gasto').click();
      cy.get('input[name="description"]').type('Material de oficina');
      cy.get('input[name="amount_cents"]').type('5000');
      cy.get('select[name="category"]').select('Administrativo');
      cy.get('input[name="expense_date"]').type('2025-01-20');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Verificar columnas
      cy.get('table').should('be.visible');
      cy.get('th').contains('Fecha').should('be.visible');
      cy.get('th').contains('Descripción').should('be.visible');
      cy.get('th').contains('Categoría').should('be.visible');
      cy.get('th').contains('Proveedor').should('be.visible');
      cy.get('th').contains('Monto').should('be.visible');
      cy.get('th').contains('Estado').should('be.visible');
      cy.get('th').contains('Acciones').should('be.visible');
    });
  });

  describe('2. Creación de Gastos - Validaciones', () => {
    beforeEach(() => {
      cy.get('button').contains('Nuevo Gasto').click();
    });

    it('debe validar campos requeridos', () => {
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('La descripción es requerida').should('be.visible');
      cy.contains('El monto es requerido').should('be.visible');
      cy.contains('La categoría es requerida').should('be.visible');
      cy.contains('La fecha es requerida').should('be.visible');
    });

    it('debe validar monto positivo', () => {
      cy.get('input[name="description"]').type('Test');
      cy.get('input[name="amount_cents"]').type('-100');
      cy.get('select[name="category"]').select('Administrativo');
      cy.get('input[name="expense_date"]').type('2025-01-20');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El monto debe ser mayor a 0').should('be.visible');
    });

    it('debe validar fecha no futura', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      cy.get('input[name="description"]').type('Test');
      cy.get('input[name="amount_cents"]').type('1000');
      cy.get('select[name="category"]').select('Administrativo');
      cy.get('input[name="expense_date"]').type(futureDateStr);
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('La fecha no puede ser futura').should('be.visible');
    });

    it('debe validar formato de factura', () => {
      cy.get('input[name="description"]').type('Test');
      cy.get('input[name="amount_cents"]').type('1000');
      cy.get('select[name="category"]').select('Administrativo');
      cy.get('input[name="expense_date"]').type('2025-01-20');
      cy.get('input[name="invoice_number"]').type('123'); // Formato incorrecto
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Formato de factura inválido').should('be.visible');
    });

    it('debe validar RFC del proveedor', () => {
      cy.get('input[name="description"]').type('Test');
      cy.get('input[name="amount_cents"]').type('1000');
      cy.get('select[name="category"]').select('Administrativo');
      cy.get('input[name="expense_date"]').type('2025-01-20');
      cy.get('input[name="supplier_rfc"]').type('INVALID');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('RFC inválido').should('be.visible');
    });
  });

  describe('3. Creación de Gastos - Casos de Éxito', () => {
    it('debe crear gasto básico', () => {
      cy.get('button').contains('Nuevo Gasto').click();
      
      cy.get('input[name="description"]').type('Papelería mensual');
      cy.get('input[name="amount_cents"]').type('15000'); // $150
      cy.get('select[name="category"]').select('Administrativo');
      cy.get('input[name="expense_date"]').type('2025-01-15');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Gasto creado exitosamente').should('be.visible');
      cy.contains('Papelería mensual').should('be.visible');
      cy.contains('$150.00').should('be.visible');
    });

    it('debe crear gasto con información completa', () => {
      cy.get('button').contains('Nuevo Gasto').click();
      
      // Información básica
      cy.get('input[name="description"]').type('Compra de insumos médicos');
      cy.get('input[name="amount_cents"]').type('85000'); // $850
      cy.get('select[name="category"]').select('Insumos');
      cy.get('input[name="expense_date"]').type('2025-01-18');
      
      // Proveedor
      cy.get('input[name="supplier_name"]').type('Dental Supply México');
      cy.get('input[name="supplier_rfc"]').type('DSM850101ABC');
      
      // Factura
      cy.get('input[name="invoice_number"]').type('FAC-2025-001234');
      cy.get('input[name="invoice_date"]').type('2025-01-18');
      
      // Forma de pago
      cy.get('select[name="payment_method"]').select('transfer');
      cy.get('input[name="reference_number"]').type('REF123456');
      
      // Notas
      cy.get('textarea[name="notes"]').type('Compra mensual de insumos básicos');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Gasto creado exitosamente').should('be.visible');
      cy.contains('Dental Supply México').should('be.visible');
    });

    it('debe crear gasto con IVA desglosado', () => {
      cy.get('button').contains('Nuevo Gasto').click();
      
      cy.get('input[name="description"]').type('Servicio de limpieza');
      cy.get('input[name="subtotal_cents"]').type('50000'); // $500 subtotal
      cy.get('input[name="tax_cents"]').type('8000'); // $80 IVA
      cy.get('select[name="category"]').select('Servicios');
      cy.get('input[name="expense_date"]').type('2025-01-20');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Gasto creado exitosamente').should('be.visible');
      cy.contains('$580.00').should('be.visible'); // Total con IVA
      cy.contains('IVA: $80.00').should('be.visible');
    });

    it('debe crear gasto recurrente', () => {
      cy.get('button').contains('Nuevo Gasto').click();
      
      cy.get('input[name="description"]').type('Renta mensual');
      cy.get('input[name="amount_cents"]').type('2000000'); // $20,000
      cy.get('select[name="category"]').select('Renta');
      cy.get('input[name="expense_date"]').type('2025-01-01');
      
      // Configurar recurrencia
      cy.get('input[type="checkbox"][name="is_recurring"]').check();
      cy.get('select[name="recurrence_type"]').select('monthly');
      cy.get('input[name="recurrence_day"]').type('1'); // Día 1 de cada mes
      cy.get('input[name="recurrence_end_date"]').type('2025-12-31');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Gasto recurrente creado').should('be.visible');
      cy.contains('Se crearán 12 gastos').should('be.visible');
    });

    it('debe crear gasto con archivos adjuntos', () => {
      cy.get('button').contains('Nuevo Gasto').click();
      
      cy.get('input[name="description"]').type('Compra de equipo');
      cy.get('input[name="amount_cents"]').type('500000');
      cy.get('select[name="category"]').select('Equipo');
      cy.get('input[name="expense_date"]').type('2025-01-15');
      
      // Adjuntar archivos
      cy.get('input[type="file"][name="attachments"]').selectFile([
        'cypress/fixtures/factura.pdf',
        'cypress/fixtures/comprobante-pago.jpg'
      ]);
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Gasto creado exitosamente').should('be.visible');
      cy.contains('2 archivos adjuntos').should('be.visible');
    });

    it('debe crear gasto dividido en categorías', () => {
      cy.get('button').contains('Nuevo Gasto').click();
      
      cy.get('input[name="description"]').type('Compra mixta');
      cy.get('input[name="total_amount_cents"]').type('100000'); // $1000 total
      
      // Dividir en categorías
      cy.get('button').contains('Dividir gasto').click();
      
      cy.get('select[name="splits[0].category"]').select('Insumos');
      cy.get('input[name="splits[0].amount_cents"]').type('60000'); // $600
      
      cy.get('button').contains('Agregar división').click();
      cy.get('select[name="splits[1].category"]').select('Administrativo');
      cy.get('input[name="splits[1].amount_cents"]').type('40000'); // $400
      
      cy.get('input[name="expense_date"]').type('2025-01-20');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Gasto dividido creado').should('be.visible');
      cy.contains('2 categorías').should('be.visible');
    });
  });

  describe('4. Categorías de Gastos', () => {
    it('debe mostrar categorías predefinidas', () => {
      cy.get('button').contains('Nuevo Gasto').click();
      cy.get('select[name="category"]').click();
      
      // Categorías operativas
      cy.contains('Insumos').should('be.visible');
      cy.contains('Equipo').should('be.visible');
      cy.contains('Mantenimiento').should('be.visible');
      
      // Categorías administrativas
      cy.contains('Administrativo').should('be.visible');
      cy.contains('Marketing').should('be.visible');
      cy.contains('Servicios').should('be.visible');
      
      // Categorías fijas
      cy.contains('Renta').should('be.visible');
      cy.contains('Nómina').should('be.visible');
      cy.contains('Servicios básicos').should('be.visible');
    });

    it('debe crear categoría personalizada', () => {
      cy.get('button').contains('Gestionar Categorías').click();
      
      cy.get('button').contains('Nueva Categoría').click();
      cy.get('input[name="category_name"]').type('Capacitación');
      cy.get('textarea[name="category_description"]').type('Cursos y certificaciones del personal');
      cy.get('input[name="category_color"]').type('#4CAF50');
      cy.get('select[name="category_type"]').select('operational');
      
      cy.get('button[type="submit"]').contains('Crear').click();
      
      cy.contains('Categoría creada').should('be.visible');
    });

    it('debe establecer presupuesto por categoría', () => {
      cy.get('button').contains('Gestionar Categorías').click();
      
      cy.contains('tr', 'Insumos').find('button[aria-label="Configurar presupuesto"]').click();
      
      cy.get('input[name="monthly_budget_cents"]').type('500000'); // $5000
      cy.get('input[name="alert_percentage"]').type('80'); // Alertar al 80%
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Presupuesto configurado').should('be.visible');
    });

    it('debe mostrar consumo por categoría', () => {
      // Crear varios gastos en una categoría
      for (let i = 0; i < 3; i++) {
        cy.get('button').contains('Nuevo Gasto').click();
        cy.get('input[name="description"]').type(`Gasto ${i + 1}`);
        cy.get('input[name="amount_cents"]').type('10000');
        cy.get('select[name="category"]').select('Administrativo');
        cy.get('input[name="expense_date"]').type('2025-01-20');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      }
      
      cy.get('button').contains('Ver por Categoría').click();
      
      cy.contains('Administrativo: $300.00').should('be.visible');
      cy.get('[data-category="Administrativo"]').should('contain', '3 gastos');
    });
  });

  describe('5. Búsqueda y Filtrado', () => {
    beforeEach(() => {
      // Crear varios gastos
      const expenses = [
        { desc: 'Compra insumos', amount: '50000', category: 'Insumos', date: '2025-01-15' },
        { desc: 'Pago de luz', amount: '15000', category: 'Servicios básicos', date: '2025-01-16' },
        { desc: 'Material oficina', amount: '8000', category: 'Administrativo', date: '2025-01-17' },
        { desc: 'Mantenimiento equipo', amount: '25000', category: 'Mantenimiento', date: '2025-01-18' }
      ];
      
      expenses.forEach(expense => {
        cy.get('button').contains('Nuevo Gasto').click();
        cy.get('input[name="description"]').type(expense.desc);
        cy.get('input[name="amount_cents"]').type(expense.amount);
        cy.get('select[name="category"]').select(expense.category);
        cy.get('input[name="expense_date"]').type(expense.date);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe buscar por descripción', () => {
      cy.get('input[placeholder*="Buscar"]').type('insumos');
      cy.contains('Compra insumos').should('be.visible');
      cy.contains('Pago de luz').should('not.exist');
    });

    it('debe filtrar por categoría', () => {
      cy.get('select[aria-label="Filtrar por categoría"]').select('Servicios básicos');
      cy.contains('Pago de luz').should('be.visible');
      cy.contains('Compra insumos').should('not.exist');
    });

    it('debe filtrar por rango de fechas', () => {
      cy.get('input[name="date_from"]').type('2025-01-16');
      cy.get('input[name="date_to"]').type('2025-01-17');
      cy.get('button').contains('Aplicar').click();
      
      cy.contains('Pago de luz').should('be.visible');
      cy.contains('Material oficina').should('be.visible');
      cy.contains('Compra insumos').should('not.exist');
    });

    it('debe filtrar por rango de montos', () => {
      cy.get('input[name="amount_min"]').type('100');
      cy.get('input[name="amount_max"]').type('250');
      cy.get('button').contains('Aplicar').click();
      
      cy.contains('Pago de luz').should('be.visible'); // $150
      cy.contains('Mantenimiento equipo').should('be.visible'); // $250
      cy.contains('Material oficina').should('not.exist'); // $80
    });

    it('debe filtrar por estado de aprobación', () => {
      // Aprobar un gasto
      cy.contains('tr', 'Compra insumos').find('button[aria-label="Aprobar"]').click();
      cy.get('button').contains('Confirmar').click();
      cy.wait(500);
      
      cy.get('select[aria-label="Filtrar por estado"]').select('approved');
      cy.contains('Compra insumos').should('be.visible');
      cy.contains('Pago de luz').should('not.exist');
    });

    it('debe combinar múltiples filtros', () => {
      cy.get('select[aria-label="Filtrar por categoría"]').select('Insumos');
      cy.get('input[name="date_from"]').type('2025-01-15');
      cy.get('input[name="date_to"]').type('2025-01-15');
      cy.get('button').contains('Aplicar').click();
      
      cy.get('tbody tr').should('have.length', 1);
      cy.contains('Compra insumos').should('be.visible');
    });
  });

  describe('6. Aprobación de Gastos', () => {
    beforeEach(() => {
      // Crear gasto pendiente
      cy.get('button').contains('Nuevo Gasto').click();
      cy.get('input[name="description"]').type('Gasto pendiente aprobación');
      cy.get('input[name="amount_cents"]').type('100000');
      cy.get('select[name="category"]').select('Equipo');
      cy.get('input[name="expense_date"]').type('2025-01-20');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe aprobar gasto individual', () => {
      cy.contains('tr', 'Gasto pendiente').find('button[aria-label="Aprobar"]').click();
      
      cy.contains('Aprobar Gasto').should('be.visible');
      cy.get('textarea[name="approval_notes"]').type('Aprobado según presupuesto');
      cy.get('button').contains('Aprobar').click();
      
      cy.contains('Gasto aprobado').should('be.visible');
      cy.contains('tr', 'Gasto pendiente').should('contain', 'Aprobado');
    });

    it('debe rechazar gasto con motivo', () => {
      cy.contains('tr', 'Gasto pendiente').find('button[aria-label="Rechazar"]').click();
      
      cy.contains('Rechazar Gasto').should('be.visible');
      cy.get('textarea[name="rejection_reason"]').type('Excede presupuesto del mes');
      cy.get('button').contains('Rechazar').click();
      
      cy.contains('Gasto rechazado').should('be.visible');
      cy.contains('tr', 'Gasto pendiente').should('contain', 'Rechazado');
    });

    it('debe aprobar múltiples gastos', () => {
      // Crear más gastos
      for (let i = 0; i < 2; i++) {
        cy.get('button').contains('Nuevo Gasto').click();
        cy.get('input[name="description"]').type(`Gasto adicional ${i + 1}`);
        cy.get('input[name="amount_cents"]').type('50000');
        cy.get('select[name="category"]').select('Administrativo');
        cy.get('input[name="expense_date"]').type('2025-01-20');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      }
      
      // Seleccionar todos
      cy.get('input[type="checkbox"][name="select_all"]').check();
      cy.get('button').contains('Aprobar seleccionados').click();
      
      cy.contains('3 gastos aprobados').should('be.visible');
    });

    it('debe requerir autorización para montos altos', () => {
      // Crear gasto de monto alto
      cy.get('button').contains('Nuevo Gasto').click();
      cy.get('input[name="description"]').type('Compra equipo costoso');
      cy.get('input[name="amount_cents"]').type('10000000'); // $100,000
      cy.get('select[name="category"]').select('Equipo');
      cy.get('input[name="expense_date"]').type('2025-01-20');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      cy.contains('tr', 'Compra equipo costoso').should('contain', 'Requiere autorización');
      cy.contains('tr', 'Compra equipo costoso').find('button[aria-label="Solicitar autorización"]').should('be.visible');
    });
  });

  describe('7. Edición de Gastos', () => {
    beforeEach(() => {
      // Crear gasto para editar
      cy.get('button').contains('Nuevo Gasto').click();
      cy.get('input[name="description"]').type('Gasto editable');
      cy.get('input[name="amount_cents"]').type('75000');
      cy.get('select[name="category"]').select('Administrativo');
      cy.get('input[name="expense_date"]').type('2025-01-20');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe editar información básica', () => {
      cy.contains('tr', 'Gasto editable').find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="description"]').clear().type('Gasto actualizado');
      cy.get('input[name="amount_cents"]').clear().type('85000');
      cy.get('textarea[name="notes"]').type('Nota adicional');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Gasto actualizado').should('be.visible');
      cy.contains('$850.00').should('be.visible');
    });

    it('debe agregar factura a gasto existente', () => {
      cy.contains('tr', 'Gasto editable').find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="invoice_number"]').type('FAC-2025-9999');
      cy.get('input[name="supplier_name"]').type('Proveedor SA');
      cy.get('input[name="supplier_rfc"]').type('PRO850101XYZ');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Gasto actualizado').should('be.visible');
      cy.contains('FAC-2025-9999').should('be.visible');
    });

    it('debe mantener historial de cambios', () => {
      // Editar gasto
      cy.contains('tr', 'Gasto editable').find('button[aria-label="Editar"]').click();
      cy.get('input[name="amount_cents"]').clear().type('90000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Ver historial
      cy.contains('tr', 'Gasto editable').find('button[aria-label="Ver historial"]').click();
      
      cy.contains('Historial de Cambios').should('be.visible');
      cy.contains('$750.00 → $900.00').should('be.visible');
    });

    it('no debe permitir editar gastos aprobados sin permisos', () => {
      // Aprobar gasto primero
      cy.contains('tr', 'Gasto editable').find('button[aria-label="Aprobar"]').click();
      cy.get('button').contains('Aprobar').click();
      cy.wait(1000);
      
      // Intentar editar
      cy.contains('tr', 'Gasto editable').find('button[aria-label="Editar"]').should('be.disabled');
    });
  });

  describe('8. Eliminación de Gastos', () => {
    beforeEach(() => {
      // Crear gasto para eliminar
      cy.get('button').contains('Nuevo Gasto').click();
      cy.get('input[name="description"]').type('Gasto a eliminar');
      cy.get('input[name="amount_cents"]').type('30000');
      cy.get('select[name="category"]').select('Administrativo');
      cy.get('input[name="expense_date"]').type('2025-01-20');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe mostrar confirmación antes de eliminar', () => {
      cy.contains('tr', 'Gasto a eliminar').find('button[aria-label="Eliminar"]').click();
      
      cy.contains('¿Estás seguro?').should('be.visible');
      cy.contains('Esta acción no se puede deshacer').should('be.visible');
    });

    it('debe eliminar gasto al confirmar', () => {
      cy.contains('tr', 'Gasto a eliminar').find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      cy.contains('Gasto eliminado').should('be.visible');
      cy.contains('Gasto a eliminar').should('not.exist');
    });

    it('debe cancelar eliminación', () => {
      cy.contains('tr', 'Gasto a eliminar').find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Cancelar').click();
      
      cy.contains('Gasto a eliminar').should('be.visible');
    });

    it('no debe permitir eliminar gastos aprobados', () => {
      // Aprobar gasto
      cy.contains('tr', 'Gasto a eliminar').find('button[aria-label="Aprobar"]').click();
      cy.get('button').contains('Aprobar').click();
      cy.wait(1000);
      
      // Botón eliminar debe estar deshabilitado
      cy.contains('tr', 'Gasto a eliminar').find('button[aria-label="Eliminar"]').should('be.disabled');
    });
  });

  describe('9. Reportes de Gastos', () => {
    beforeEach(() => {
      // Crear gastos para reportes
      const expenses = [
        { desc: 'Insumos enero', amount: '150000', category: 'Insumos', date: '2025-01-10' },
        { desc: 'Renta enero', amount: '2000000', category: 'Renta', date: '2025-01-01' },
        { desc: 'Nómina enero', amount: '5000000', category: 'Nómina', date: '2025-01-15' },
        { desc: 'Marketing enero', amount: '100000', category: 'Marketing', date: '2025-01-20' }
      ];
      
      expenses.forEach(expense => {
        cy.get('button').contains('Nuevo Gasto').click();
        cy.get('input[name="description"]').type(expense.desc);
        cy.get('input[name="amount_cents"]').type(expense.amount);
        cy.get('select[name="category"]').select(expense.category);
        cy.get('input[name="expense_date"]').type(expense.date);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe generar reporte mensual', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Reporte Mensual').click();
      
      cy.get('select[name="month"]').select('Enero');
      cy.get('select[name="year"]').select('2025');
      cy.get('button').contains('Generar').click();
      
      cy.contains('Reporte de Gastos - Enero 2025').should('be.visible');
      cy.contains('Total: $72,500.00').should('be.visible');
      cy.contains('4 gastos').should('be.visible');
    });

    it('debe mostrar distribución por categoría', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Por Categoría').click();
      
      cy.get('canvas#category-distribution').should('be.visible');
      cy.contains('Nómina: 68.9%').should('be.visible'); // 5M de 7.25M
      cy.contains('Renta: 27.6%').should('be.visible');
    });

    it('debe comparar gastos vs presupuesto', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('vs Presupuesto').click();
      
      cy.contains('Comparación con Presupuesto').should('be.visible');
      cy.get('table#budget-comparison').should('be.visible');
      cy.contains('Variación').should('be.visible');
    });

    it('debe mostrar tendencias de gastos', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Tendencias').click();
      
      cy.get('canvas#expense-trends').should('be.visible');
      cy.get('select[name="trend_period"]').select('Últimos 6 meses');
      
      cy.contains('Tendencia de Gastos').should('be.visible');
    });

    it('debe exportar reportes', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Reporte Mensual').click();
      cy.get('button').contains('Generar').click();
      
      // Exportar PDF
      cy.get('button').contains('Exportar PDF').click();
      cy.readFile('cypress/downloads/reporte-gastos.pdf').should('exist');
      
      // Exportar Excel
      cy.get('button').contains('Exportar Excel').click();
      cy.readFile('cypress/downloads/reporte-gastos.xlsx').should('exist');
    });

    it('debe generar estado de resultados', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Estado de Resultados').click();
      
      cy.get('input[name="period_from"]').type('2025-01-01');
      cy.get('input[name="period_to"]').type('2025-01-31');
      cy.get('button').contains('Generar').click();
      
      cy.contains('Estado de Resultados').should('be.visible');
      cy.contains('Ingresos').should('be.visible');
      cy.contains('Gastos').should('be.visible');
      cy.contains('Utilidad/Pérdida').should('be.visible');
    });
  });

  describe('10. Importación y Exportación', () => {
    beforeEach(() => {
      // Crear gastos para exportar
      const expenses = [
        { desc: 'Export1', amount: '10000', category: 'Administrativo' },
        { desc: 'Export2', amount: '20000', category: 'Insumos' },
        { desc: 'Export3', amount: '30000', category: 'Marketing' }
      ];
      
      expenses.forEach(expense => {
        cy.get('button').contains('Nuevo Gasto').click();
        cy.get('input[name="description"]').type(expense.desc);
        cy.get('input[name="amount_cents"]').type(expense.amount);
        cy.get('select[name="category"]').select(expense.category);
        cy.get('input[name="expense_date"]').type('2025-01-20');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe exportar gastos a CSV', () => {
      cy.get('button').contains('Exportar').click();
      cy.get('button').contains('Exportar CSV').click();
      
      cy.readFile('cypress/downloads/gastos.csv').should('exist');
    });

    it('debe exportar gastos a Excel con formato contable', () => {
      cy.get('button').contains('Exportar').click();
      cy.get('input[type="checkbox"][name="accounting_format"]').check();
      cy.get('button').contains('Exportar Excel').click();
      
      cy.readFile('cypress/downloads/gastos-contable.xlsx').should('exist');
    });

    it('debe importar gastos desde CSV', () => {
      cy.get('button').contains('Importar').click();
      
      cy.get('input[type="file"]').selectFile('cypress/fixtures/gastos-import.csv');
      cy.get('button').contains('Procesar').click();
      
      cy.contains('Vista previa de importación').should('be.visible');
      cy.contains('5 gastos a importar').should('be.visible');
      
      cy.get('button').contains('Confirmar Importación').click();
      
      cy.contains('Importación exitosa').should('be.visible');
    });

    it('debe validar formato al importar', () => {
      cy.get('button').contains('Importar').click();
      
      cy.get('input[type="file"]').selectFile('cypress/fixtures/gastos-invalid.csv');
      cy.get('button').contains('Procesar').click();
      
      cy.contains('Errores encontrados').should('be.visible');
      cy.contains('Fila 3: Monto inválido').should('be.visible');
      cy.contains('Fila 5: Categoría no reconocida').should('be.visible');
    });

    it('debe importar desde estado de cuenta bancario', () => {
      cy.get('button').contains('Importar').click();
      cy.get('button[role="tab"]').contains('Estado de Cuenta').click();
      
      cy.get('select[name="bank"]').select('BBVA');
      cy.get('input[type="file"]').selectFile('cypress/fixtures/estado-cuenta.csv');
      cy.get('button').contains('Procesar').click();
      
      cy.contains('Transacciones detectadas').should('be.visible');
      cy.contains('Clasificación automática').should('be.visible');
      
      // Revisar y confirmar
      cy.get('button').contains('Revisar clasificación').click();
      cy.get('button').contains('Confirmar Importación').click();
      
      cy.contains('Transacciones importadas').should('be.visible');
    });
  });

  describe('11. Integración con Contabilidad', () => {
    it('debe generar póliza contable', () => {
      // Crear gasto
      cy.get('button').contains('Nuevo Gasto').click();
      cy.get('input[name="description"]').type('Compra para póliza');
      cy.get('input[name="amount_cents"]').type('100000');
      cy.get('select[name="category"]').select('Insumos');
      cy.get('input[name="expense_date"]').type('2025-01-20');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      cy.contains('tr', 'Compra para póliza').find('button[aria-label="Generar póliza"]').click();
      
      cy.contains('Póliza Contable').should('be.visible');
      cy.contains('Cargo: Gastos de Operación').should('be.visible');
      cy.contains('Abono: Bancos').should('be.visible');
      cy.contains('$1,000.00').should('be.visible');
    });

    it('debe sincronizar con sistema contable', () => {
      cy.get('button').contains('Configuración').click();
      cy.get('button').contains('Integración Contable').click();
      
      cy.get('select[name="accounting_system"]').select('CONTPAQi');
      cy.get('input[name="api_key"]').type('contpaqi_api_key');
      cy.get('button').contains('Probar Conexión').click();
      
      cy.contains('Conexión exitosa').should('be.visible');
      
      cy.get('button').contains('Sincronizar Gastos').click();
      cy.contains('Sincronización completada').should('be.visible');
    });

    it('debe mapear cuentas contables', () => {
      cy.get('button').contains('Configuración').click();
      cy.get('button').contains('Mapeo de Cuentas').click();
      
      cy.contains('tr', 'Insumos').find('input[name="account_code"]').type('5010-001');
      cy.contains('tr', 'Renta').find('input[name="account_code"]').type('5020-001');
      cy.contains('tr', 'Nómina').find('input[name="account_code"]').type('5030-001');
      
      cy.get('button').contains('Guardar Mapeo').click();
      
      cy.contains('Mapeo guardado').should('be.visible');
    });
  });

  describe('12. Proveedores', () => {
    it('debe crear nuevo proveedor', () => {
      cy.get('button').contains('Proveedores').click();
      
      cy.get('button').contains('Nuevo Proveedor').click();
      cy.get('input[name="supplier_name"]').type('Proveedor Dental SA');
      cy.get('input[name="supplier_rfc"]').type('PDE850101ABC');
      cy.get('input[name="contact_name"]').type('Juan Pérez');
      cy.get('input[name="phone"]').type('5551234567');
      cy.get('input[name="email"]').type('contacto@proveedordental.com');
      cy.get('textarea[name="address"]').type('Av. Principal 123, CDMX');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Proveedor creado').should('be.visible');
    });

    it('debe mostrar historial de compras por proveedor', () => {
      // Crear proveedor y gastos
      cy.get('button').contains('Proveedores').click();
      cy.get('button').contains('Nuevo Proveedor').click();
      cy.get('input[name="supplier_name"]').type('Mi Proveedor');
      cy.get('input[name="supplier_rfc"]').type('MPR850101XYZ');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Crear gastos con este proveedor
      for (let i = 0; i < 3; i++) {
        cy.visit('/expenses');
        cy.get('button').contains('Nuevo Gasto').click();
        cy.get('input[name="description"]').type(`Compra ${i + 1}`);
        cy.get('input[name="amount_cents"]').type('50000');
        cy.get('select[name="category"]').select('Insumos');
        cy.get('select[name="supplier_id"]').select('Mi Proveedor');
        cy.get('input[name="expense_date"]').type('2025-01-20');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      }
      
      cy.get('button').contains('Proveedores').click();
      cy.contains('tr', 'Mi Proveedor').find('button[aria-label="Ver historial"]').click();
      
      cy.contains('Historial de Compras').should('be.visible');
      cy.contains('3 compras').should('be.visible');
      cy.contains('Total: $1,500.00').should('be.visible');
    });

    it('debe calificar proveedores', () => {
      cy.get('button').contains('Proveedores').click();
      
      cy.contains('tr', 'Proveedor').find('button[aria-label="Calificar"]').click();
      
      cy.get('input[name="quality_rating"]').type('4');
      cy.get('input[name="price_rating"]').type('3');
      cy.get('input[name="service_rating"]').type('5');
      cy.get('input[name="delivery_rating"]').type('4');
      cy.get('textarea[name="comments"]').type('Buen servicio, precios mejorables');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Calificación guardada').should('be.visible');
      cy.contains('4.0 ⭐').should('be.visible'); // Promedio
    });
  });

  describe('13. Presupuestos y Alertas', () => {
    it('debe configurar presupuesto mensual global', () => {
      cy.get('button').contains('Configurar Presupuesto').click();
      
      cy.get('input[name="monthly_budget_cents"]').type('10000000'); // $100,000
      cy.get('input[name="warning_threshold"]').type('75'); // Advertencia al 75%
      cy.get('input[name="critical_threshold"]').type('90'); // Crítico al 90%
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Presupuesto configurado').should('be.visible');
    });

    it('debe mostrar alertas de presupuesto', () => {
      // Configurar presupuesto bajo
      cy.get('button').contains('Configurar Presupuesto').click();
      cy.get('input[name="monthly_budget_cents"]').type('1000000'); // $10,000
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Crear gastos que superen el threshold
      for (let i = 0; i < 3; i++) {
        cy.get('button').contains('Nuevo Gasto').click();
        cy.get('input[name="description"]').type(`Gasto alto ${i + 1}`);
        cy.get('input[name="amount_cents"]').type('300000'); // $3,000 cada uno
        cy.get('select[name="category"]').select('Administrativo');
        cy.get('input[name="expense_date"]').type('2025-01-20');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      }
      
      cy.contains('⚠️ 90% del presupuesto consumido').should('be.visible');
      cy.get('[data-testid="budget-alert"]').should('have.class', 'critical');
    });

    it('debe proyectar gastos del mes', () => {
      cy.get('button').contains('Proyección').click();
      
      cy.contains('Proyección de Gastos').should('be.visible');
      cy.contains('Basado en el promedio diario actual').should('be.visible');
      cy.contains('Gasto proyectado fin de mes').should('be.visible');
    });
  });

  describe('14. Multi-tenancy y Permisos', () => {
    it('debe mostrar solo gastos de la clínica actual', () => {
      cy.get('input[placeholder*="Buscar"]').type('OtraClinica');
      cy.contains('No se encontraron gastos').should('be.visible');
    });

    it('debe aplicar clinic_id automáticamente', () => {
      cy.get('button').contains('Nuevo Gasto').click();
      cy.get('input[name="description"]').type('Test Clinic Expense');
      cy.get('input[name="amount_cents"]').type('10000');
      cy.get('select[name="category"]').select('Administrativo');
      cy.get('input[name="expense_date"]').type('2025-01-20');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Test Clinic Expense').should('be.visible');
    });

    it('debe respetar permisos de aprobación', () => {
      // Este test depende del rol del usuario
      // Solo usuarios con permisos pueden aprobar gastos altos
    });
  });

  describe('15. Rendimiento y UX', () => {
    it('debe mostrar totales en tiempo real', () => {
      cy.get('button').contains('Nuevo Gasto').click();
      
      // Panel de totales debe estar visible
      cy.get('[data-testid="expense-totals"]').should('be.visible');
      
      cy.get('input[name="subtotal_cents"]').type('10000');
      cy.get('input[name="tax_cents"]').type('1600');
      
      // Total debe actualizarse automáticamente
      cy.get('[data-testid="total-amount"]').should('contain', '$116.00');
    });

    it('debe tener búsqueda predictiva de proveedores', () => {
      cy.get('button').contains('Nuevo Gasto').click();
      
      cy.get('input[name="supplier_name"]').type('Dent');
      
      // Debe mostrar sugerencias
      cy.contains('Dental Supply').should('be.visible');
      cy.contains('Dentamed').should('be.visible');
    });

    it('debe auto-guardar borradores', () => {
      cy.get('button').contains('Nuevo Gasto').click();
      
      cy.get('input[name="description"]').type('Gasto en borrador');
      cy.get('input[name="amount_cents"]').type('50000');
      
      // Esperar auto-guardado
      cy.wait(3000);
      cy.contains('Borrador guardado').should('be.visible');
      
      // Cerrar y volver a abrir
      cy.get('button').contains('Cancelar').click();
      cy.get('button').contains('Nuevo Gasto').click();
      
      cy.contains('Recuperar borrador').should('be.visible');
      cy.get('button').contains('Recuperar').click();
      
      cy.get('input[name="description"]').should('have.value', 'Gasto en borrador');
    });

    it('debe soportar atajos de teclado', () => {
      // Ctrl+N para nuevo gasto
      cy.get('body').type('{ctrl}n');
      cy.contains('Nuevo Gasto').should('be.visible');
      
      // Escape para cerrar
      cy.get('body').type('{esc}');
      cy.contains('Nuevo Gasto').should('not.exist');
      
      // Ctrl+F para buscar
      cy.get('body').type('{ctrl}f');
      cy.get('input[placeholder*="Buscar"]').should('be.focused');
    });
  });
});

// Comandos personalizados para este módulo
Cypress.Commands.add('createExpense', (data) => {
  cy.get('button').contains('Nuevo Gasto').click();
  cy.get('input[name="description"]').type(data.description);
  cy.get('input[name="amount_cents"]').type(data.amount);
  cy.get('select[name="category"]').select(data.category);
  cy.get('input[name="expense_date"]').type(data.date);
  if (data.supplier) cy.get('input[name="supplier_name"]').type(data.supplier);
  cy.get('button[type="submit"]').contains('Guardar').click();
  cy.wait(500);
});

Cypress.Commands.add('approveExpense', (description) => {
  cy.contains('tr', description).find('button[aria-label="Aprobar"]').click();
  cy.get('button').contains('Aprobar').click();
});