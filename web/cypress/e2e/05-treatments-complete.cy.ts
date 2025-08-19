/**
 * TESTS E2E COMPLETOS - MÓDULO DE TRATAMIENTOS
 * Siguiendo principios TDD con casos reales y selectores semánticos
 */

describe('Treatments Module - Complete TDD Tests', () => {
  beforeEach(() => {
    // Login con usuario real
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    
    // Preparar datos necesarios
    cy.visit('/patients');
    cy.get('button').contains('Nuevo Paciente').click();
    cy.get('input[name="first_name"]').type('Paciente');
    cy.get('input[name="last_name"]').type('Test');
    cy.get('input[name="email"]').type('paciente.test@example.com');
    cy.get('button[type="submit"]').contains('Guardar').click();
    cy.wait(1000);
    
    cy.visit('/services');
    cy.get('button').contains('Nuevo Servicio').click();
    cy.get('input[name="name"]').type('Limpieza dental');
    cy.get('input[name="minutes"]').type('30');
    cy.get('button[type="submit"]').contains('Guardar').click();
    cy.wait(1000);
    
    cy.visit('/treatments');
  });

  describe('1. Visualización y Estado Inicial', () => {
    it('debe mostrar la página de tratamientos con elementos correctos', () => {
      // Verificar encabezado
      cy.contains('h1', 'Tratamientos').should('be.visible');
      
      // Verificar botones principales
      cy.get('button').contains('Nuevo Tratamiento').should('be.visible');
      cy.get('button').contains('Calendario').should('be.visible');
      cy.get('button').contains('Reportes').should('be.visible');
      
      // Verificar filtros
      cy.get('input[placeholder*="Buscar"]').should('be.visible');
      cy.get('select[aria-label="Filtrar por estado"]').should('be.visible');
      cy.get('input[type="date"][name="date_from"]').should('be.visible');
      cy.get('input[type="date"][name="date_to"]').should('be.visible');
    });

    it('debe mostrar estado vacío cuando no hay tratamientos', () => {
      cy.contains('No hay tratamientos registrados').should('be.visible');
      cy.contains('Comienza agregando el primer tratamiento').should('be.visible');
    });

    it('debe mostrar tabla con columnas correctas cuando hay tratamientos', () => {
      // Crear un tratamiento
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-20');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Verificar columnas
      cy.get('table').should('be.visible');
      cy.get('th').contains('Fecha').should('be.visible');
      cy.get('th').contains('Paciente').should('be.visible');
      cy.get('th').contains('Servicio').should('be.visible');
      cy.get('th').contains('Doctor').should('be.visible');
      cy.get('th').contains('Estado').should('be.visible');
      cy.get('th').contains('Precio').should('be.visible');
      cy.get('th').contains('Pagado').should('be.visible');
      cy.get('th').contains('Acciones').should('be.visible');
    });
  });

  describe('2. Creación de Tratamientos - Validaciones', () => {
    beforeEach(() => {
      cy.get('button').contains('Nuevo Tratamiento').click();
    });

    it('debe validar campos requeridos', () => {
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El paciente es requerido').should('be.visible');
      cy.contains('El servicio es requerido').should('be.visible');
      cy.contains('La fecha es requerida').should('be.visible');
    });

    it('debe validar fecha no futura para tratamiento completado', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type(futureDateStr);
      cy.get('select[name="status"]').select('completed');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('No se puede completar un tratamiento futuro').should('be.visible');
    });

    it('debe validar conflicto de horarios', () => {
      // Crear primer tratamiento
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-20');
      cy.get('input[name="treatment_time"]').type('10:00');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Intentar crear otro en mismo horario
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-20');
      cy.get('input[name="treatment_time"]').type('10:00');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Ya existe un tratamiento en ese horario').should('be.visible');
    });

    it('debe validar precio mayor a cero', () => {
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-20');
      cy.get('input[name="override_price_cents"]').clear().type('0');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El precio debe ser mayor a 0').should('be.visible');
    });

    it('debe validar descuento máximo', () => {
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-20');
      cy.get('input[name="discount_percent"]').type('101');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El descuento no puede ser mayor al 100%').should('be.visible');
    });
  });

  describe('3. Creación de Tratamientos - Casos de Éxito', () => {
    it('debe crear tratamiento básico', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-20');
      cy.get('input[name="treatment_time"]').type('14:00');
      cy.get('select[name="doctor_id"]').select(1); // Primer doctor disponible
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Tratamiento creado exitosamente').should('be.visible');
      cy.contains('Paciente Test').should('be.visible');
      cy.contains('Limpieza dental').should('be.visible');
    });

    it('debe crear tratamiento con descuento', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-21');
      cy.get('input[name="discount_percent"]').type('15');
      cy.get('input[name="discount_reason"]').type('Descuento familiar');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Tratamiento creado exitosamente').should('be.visible');
      cy.contains('15% desc.').should('be.visible');
    });

    it('debe crear tratamiento con precio personalizado', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-22');
      
      // Activar precio personalizado
      cy.get('input[type="checkbox"][name="use_custom_price"]').check();
      cy.get('input[name="override_price_cents"]').type('50000'); // $500
      cy.get('input[name="price_override_reason"]').type('Precio especial por convenio');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Tratamiento creado exitosamente').should('be.visible');
      cy.contains('$500.00').should('be.visible');
    });

    it('debe crear tratamiento con notas clínicas', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-23');
      
      // Agregar notas clínicas
      cy.get('textarea[name="clinical_notes"]').type('Paciente con sensibilidad en cuadrante superior derecho');
      cy.get('textarea[name="observations"]').type('Se recomienda uso de pasta dental para sensibilidad');
      cy.get('textarea[name="post_treatment_instructions"]').type('Evitar alimentos fríos por 24 horas');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Tratamiento creado exitosamente').should('be.visible');
    });

    it('debe crear tratamiento con múltiples servicios', () => {
      // Crear servicios adicionales
      cy.visit('/services');
      cy.get('button').contains('Nuevo Servicio').click();
      cy.get('input[name="name"]').type('Aplicación de flúor');
      cy.get('input[name="minutes"]').type('15');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      cy.visit('/treatments');
      cy.get('button').contains('Nuevo Tratamiento').click();
      
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('input[name="treatment_date"]').type('2025-01-24');
      
      // Agregar múltiples servicios
      cy.get('button').contains('Agregar Servicio').click();
      cy.get('select[name="services[0].service_id"]').select('Limpieza dental');
      
      cy.get('button').contains('Agregar Servicio').click();
      cy.get('select[name="services[1].service_id"]').select('Aplicación de flúor');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Tratamiento creado exitosamente').should('be.visible');
      cy.contains('2 servicios').should('be.visible');
    });

    it('debe crear tratamiento programado (cita)', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type(futureDateStr);
      cy.get('input[name="treatment_time"]').type('10:30');
      cy.get('select[name="status"]').select('scheduled');
      
      // Agregar recordatorios
      cy.get('input[type="checkbox"][name="send_reminder"]').check();
      cy.get('select[name="reminder_type"]').select('email');
      cy.get('input[name="reminder_days_before"]').type('1');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Cita programada exitosamente').should('be.visible');
      cy.contains('Programado').should('be.visible');
    });
  });

  describe('4. Estados del Tratamiento', () => {
    beforeEach(() => {
      // Crear tratamiento base
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-20');
      cy.get('select[name="status"]').select('scheduled');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe cambiar estado de programado a en proceso', () => {
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Cambiar estado"]').click();
      cy.get('select[name="new_status"]').select('in_progress');
      cy.get('button').contains('Actualizar').click();
      
      cy.contains('Estado actualizado').should('be.visible');
      cy.contains('En Proceso').should('be.visible');
    });

    it('debe cambiar estado a completado con notas', () => {
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Cambiar estado"]').click();
      cy.get('select[name="new_status"]').select('completed');
      cy.get('textarea[name="completion_notes"]').type('Tratamiento completado sin complicaciones');
      cy.get('button').contains('Actualizar').click();
      
      cy.contains('Tratamiento completado').should('be.visible');
      cy.contains('Completado').should('be.visible');
    });

    it('debe cancelar tratamiento con motivo', () => {
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Cambiar estado"]').click();
      cy.get('select[name="new_status"]').select('cancelled');
      cy.get('textarea[name="cancellation_reason"]').type('Paciente no se presentó');
      cy.get('button').contains('Actualizar').click();
      
      cy.contains('Tratamiento cancelado').should('be.visible');
      cy.contains('Cancelado').should('be.visible');
    });

    it('debe reprogramar tratamiento', () => {
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Reprogramar"]').click();
      
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 3);
      const newDateStr = newDate.toISOString().split('T')[0];
      
      cy.get('input[name="new_date"]').type(newDateStr);
      cy.get('input[name="new_time"]').type('15:00');
      cy.get('textarea[name="reschedule_reason"]').type('Solicitud del paciente');
      cy.get('button').contains('Reprogramar').click();
      
      cy.contains('Tratamiento reprogramado').should('be.visible');
      cy.contains(newDateStr).should('be.visible');
    });

    it('debe marcar como no presentado', () => {
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Cambiar estado"]').click();
      cy.get('select[name="new_status"]').select('no_show');
      cy.get('button').contains('Actualizar').click();
      
      cy.contains('Marcado como no presentado').should('be.visible');
      cy.contains('No Presentado').should('be.visible');
    });
  });

  describe('5. Gestión de Pagos', () => {
    beforeEach(() => {
      // Crear tratamiento completado
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-20');
      cy.get('select[name="status"]').select('completed');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe registrar pago completo', () => {
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Registrar pago"]').click();
      
      cy.get('input[name="amount_cents"]').type('50000'); // $500
      cy.get('select[name="payment_method"]').select('cash');
      cy.get('input[name="payment_date"]').type('2025-01-20');
      cy.get('button[type="submit"]').contains('Registrar').click();
      
      cy.contains('Pago registrado exitosamente').should('be.visible');
      cy.contains('Pagado').should('be.visible');
    });

    it('debe registrar pago parcial', () => {
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Registrar pago"]').click();
      
      cy.get('input[name="amount_cents"]').type('20000'); // $200 (parcial)
      cy.get('select[name="payment_method"]').select('card');
      cy.get('input[name="payment_date"]').type('2025-01-20');
      cy.get('button[type="submit"]').contains('Registrar').click();
      
      cy.contains('Pago parcial registrado').should('be.visible');
      cy.contains('Parcialmente pagado').should('be.visible');
    });

    it('debe registrar múltiples pagos', () => {
      // Primer pago
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Registrar pago"]').click();
      cy.get('input[name="amount_cents"]').type('20000');
      cy.get('select[name="payment_method"]').select('cash');
      cy.get('button[type="submit"]').contains('Registrar').click();
      cy.wait(1000);
      
      // Segundo pago
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Registrar pago"]').click();
      cy.get('input[name="amount_cents"]').type('15000');
      cy.get('select[name="payment_method"]').select('transfer');
      cy.get('button[type="submit"]').contains('Registrar').click();
      
      cy.contains('Pago registrado exitosamente').should('be.visible');
      cy.contains('$350.00 de').should('be.visible'); // Total pagado
    });

    it('debe generar recibo de pago', () => {
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Registrar pago"]').click();
      
      cy.get('input[name="amount_cents"]').type('50000');
      cy.get('select[name="payment_method"]').select('cash');
      cy.get('input[type="checkbox"][name="generate_receipt"]').check();
      cy.get('button[type="submit"]').contains('Registrar').click();
      
      cy.contains('Pago registrado').should('be.visible');
      cy.get('button').contains('Descargar Recibo').should('be.visible');
    });

    it('debe aplicar plan de pagos', () => {
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Plan de pagos"]').click();
      
      cy.get('input[name="installments"]').type('3'); // 3 cuotas
      cy.get('input[name="first_payment_date"]').type('2025-02-01');
      cy.get('select[name="frequency"]').select('monthly');
      cy.get('button[type="submit"]').contains('Crear Plan').click();
      
      cy.contains('Plan de pagos creado').should('be.visible');
      cy.contains('3 cuotas').should('be.visible');
    });

    it('debe registrar devolución', () => {
      // Primero registrar un pago
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Registrar pago"]').click();
      cy.get('input[name="amount_cents"]').type('50000');
      cy.get('select[name="payment_method"]').select('card');
      cy.get('button[type="submit"]').contains('Registrar').click();
      cy.wait(1000);
      
      // Registrar devolución
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Más opciones"]').click();
      cy.contains('Registrar devolución').click();
      
      cy.get('input[name="refund_amount_cents"]').type('50000');
      cy.get('textarea[name="refund_reason"]').type('Cancelación del tratamiento');
      cy.get('button[type="submit"]').contains('Procesar Devolución').click();
      
      cy.contains('Devolución procesada').should('be.visible');
      cy.contains('Devuelto').should('be.visible');
    });
  });

  describe('6. Búsqueda y Filtrado', () => {
    beforeEach(() => {
      // Crear varios tratamientos
      const treatments = [
        { patient: 'Paciente Test', date: '2025-01-20', status: 'completed' },
        { patient: 'Paciente Test', date: '2025-01-21', status: 'scheduled' },
        { patient: 'Paciente Test', date: '2025-01-22', status: 'cancelled' }
      ];
      
      treatments.forEach(treatment => {
        cy.get('button').contains('Nuevo Tratamiento').click();
        cy.get('select[name="patient_id"]').select(treatment.patient);
        cy.get('select[name="service_id"]').select('Limpieza dental');
        cy.get('input[name="treatment_date"]').type(treatment.date);
        cy.get('select[name="status"]').select(treatment.status);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe buscar por nombre de paciente', () => {
      cy.get('input[placeholder*="Buscar"]').type('Paciente Test');
      cy.get('tbody tr').should('have.length.at.least', 3);
    });

    it('debe filtrar por estado', () => {
      cy.get('select[aria-label="Filtrar por estado"]').select('completed');
      cy.contains('Completado').should('be.visible');
      cy.contains('Programado').should('not.exist');
    });

    it('debe filtrar por rango de fechas', () => {
      cy.get('input[name="date_from"]').type('2025-01-21');
      cy.get('input[name="date_to"]').type('2025-01-22');
      cy.get('button').contains('Aplicar').click();
      
      cy.get('tbody tr').should('have.length', 2);
      cy.contains('2025-01-20').should('not.exist');
    });

    it('debe filtrar por doctor', () => {
      cy.get('select[aria-label="Filtrar por doctor"]').select(1);
      // Verificar resultados filtrados
    });

    it('debe filtrar por estado de pago', () => {
      cy.get('select[aria-label="Filtrar por pago"]').select('pending');
      cy.contains('Pendiente').should('be.visible');
    });

    it('debe combinar múltiples filtros', () => {
      cy.get('select[aria-label="Filtrar por estado"]').select('completed');
      cy.get('input[name="date_from"]').type('2025-01-20');
      cy.get('input[name="date_to"]').type('2025-01-20');
      cy.get('button').contains('Aplicar').click();
      
      cy.get('tbody tr').should('have.length', 1);
    });
  });

  describe('7. Edición de Tratamientos', () => {
    beforeEach(() => {
      // Crear tratamiento para editar
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-25');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe editar información básica', () => {
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="treatment_time"]').clear().type('16:00');
      cy.get('textarea[name="observations"]').type('Actualización de observaciones');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Tratamiento actualizado').should('be.visible');
      cy.contains('16:00').should('be.visible');
    });

    it('debe agregar servicios adicionales', () => {
      // Crear servicio adicional
      cy.visit('/services');
      cy.get('button').contains('Nuevo Servicio').click();
      cy.get('input[name="name"]').type('Radiografía');
      cy.get('input[name="minutes"]').type('10');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      cy.visit('/treatments');
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Editar"]').click();
      
      cy.get('button').contains('Agregar Servicio').click();
      cy.get('select[name="services[1].service_id"]').select('Radiografía');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Tratamiento actualizado').should('be.visible');
      cy.contains('2 servicios').should('be.visible');
    });

    it('debe actualizar precio con justificación', () => {
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Editar"]').click();
      
      cy.get('input[type="checkbox"][name="use_custom_price"]').check();
      cy.get('input[name="override_price_cents"]').type('60000');
      cy.get('input[name="price_override_reason"]').type('Ajuste por complejidad adicional');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Tratamiento actualizado').should('be.visible');
      cy.contains('$600.00').should('be.visible');
    });

    it('debe mantener historial de cambios', () => {
      // Hacer cambio
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Editar"]').click();
      cy.get('input[name="treatment_time"]').clear().type('17:00');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Ver historial
      cy.contains('tr', 'Paciente Test').find('button[aria-label="Ver historial"]').click();
      
      cy.contains('Historial de Cambios').should('be.visible');
      cy.contains('Hora cambiada').should('be.visible');
    });
  });

  describe('8. Vista de Calendario', () => {
    beforeEach(() => {
      // Crear citas en diferentes días
      const dates = ['2025-01-20', '2025-01-21', '2025-01-22'];
      dates.forEach(date => {
        cy.get('button').contains('Nuevo Tratamiento').click();
        cy.get('select[name="patient_id"]').select('Paciente Test');
        cy.get('select[name="service_id"]').select('Limpieza dental');
        cy.get('input[name="treatment_date"]').type(date);
        cy.get('input[name="treatment_time"]').type('10:00');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe mostrar vista de calendario', () => {
      cy.get('button').contains('Calendario').click();
      
      cy.contains('Calendario de Tratamientos').should('be.visible');
      cy.get('.calendar-grid').should('be.visible');
    });

    it('debe mostrar tratamientos en calendario mensual', () => {
      cy.get('button').contains('Calendario').click();
      cy.get('button').contains('Mes').click();
      
      cy.contains('20').parent().should('have.class', 'has-appointments');
      cy.contains('21').parent().should('have.class', 'has-appointments');
      cy.contains('22').parent().should('have.class', 'has-appointments');
    });

    it('debe mostrar vista semanal', () => {
      cy.get('button').contains('Calendario').click();
      cy.get('button').contains('Semana').click();
      
      cy.contains('Lun').should('be.visible');
      cy.contains('10:00').should('be.visible');
      cy.contains('Paciente Test').should('be.visible');
    });

    it('debe mostrar vista diaria con timeline', () => {
      cy.get('button').contains('Calendario').click();
      cy.get('button').contains('Día').click();
      cy.get('input[name="calendar_date"]').type('2025-01-20');
      
      cy.contains('10:00 - 10:30').should('be.visible');
      cy.contains('Paciente Test').should('be.visible');
      cy.contains('Limpieza dental').should('be.visible');
    });

    it('debe permitir arrastrar y soltar para reprogramar', () => {
      cy.get('button').contains('Calendario').click();
      cy.get('button').contains('Semana').click();
      
      // Drag and drop
      cy.get('[data-appointment-id="1"]').drag('[data-time-slot="14:00"]');
      
      cy.contains('¿Reprogramar cita?').should('be.visible');
      cy.get('button').contains('Confirmar').click();
      
      cy.contains('Cita reprogramada').should('be.visible');
    });

    it('debe crear tratamiento desde calendario', () => {
      cy.get('button').contains('Calendario').click();
      cy.get('button').contains('Día').click();
      
      // Click en slot vacío
      cy.get('[data-time-slot="15:00"]').click();
      
      cy.contains('Nueva Cita').should('be.visible');
      cy.get('input[name="treatment_time"]').should('have.value', '15:00');
    });
  });

  describe('9. Historial Clínico', () => {
    beforeEach(() => {
      // Crear varios tratamientos para el mismo paciente
      const treatments = [
        { date: '2024-12-15', service: 'Limpieza dental', notes: 'Primera visita' },
        { date: '2025-01-10', service: 'Limpieza dental', notes: 'Control rutinario' },
        { date: '2025-01-20', service: 'Limpieza dental', notes: 'Sensibilidad detectada' }
      ];
      
      treatments.forEach(treatment => {
        cy.get('button').contains('Nuevo Tratamiento').click();
        cy.get('select[name="patient_id"]').select('Paciente Test');
        cy.get('select[name="service_id"]').select(treatment.service);
        cy.get('input[name="treatment_date"]').type(treatment.date);
        cy.get('textarea[name="clinical_notes"]').type(treatment.notes);
        cy.get('select[name="status"]').select('completed');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe mostrar historial completo del paciente', () => {
      cy.get('button').contains('Historial Clínico').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      
      cy.contains('Historial Clínico - Paciente Test').should('be.visible');
      cy.contains('Primera visita').should('be.visible');
      cy.contains('Control rutinario').should('be.visible');
      cy.contains('Sensibilidad detectada').should('be.visible');
    });

    it('debe mostrar línea de tiempo', () => {
      cy.get('button').contains('Historial Clínico').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('button').contains('Vista Timeline').click();
      
      cy.get('.timeline').should('be.visible');
      cy.contains('2024-12-15').should('be.visible');
      cy.contains('2025-01-10').should('be.visible');
      cy.contains('2025-01-20').should('be.visible');
    });

    it('debe filtrar historial por tipo de servicio', () => {
      cy.get('button').contains('Historial Clínico').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="filter_service"]').select('Limpieza dental');
      
      cy.get('tbody tr').should('have.length', 3);
    });

    it('debe exportar historial clínico', () => {
      cy.get('button').contains('Historial Clínico').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('button').contains('Exportar PDF').click();
      
      cy.readFile('cypress/downloads/historial-clinico-paciente-test.pdf').should('exist');
    });

    it('debe mostrar odontograma', () => {
      cy.get('button').contains('Historial Clínico').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('button').contains('Odontograma').click();
      
      cy.get('.odontogram').should('be.visible');
      cy.get('[data-tooth="11"]').should('be.visible'); // Diente 11
    });
  });

  describe('10. Reportes de Tratamientos', () => {
    beforeEach(() => {
      // Crear datos para reportes
      const treatments = [
        { patient: 'Paciente Test', date: '2025-01-15', status: 'completed', paid: true },
        { patient: 'Paciente Test', date: '2025-01-16', status: 'completed', paid: false },
        { patient: 'Paciente Test', date: '2025-01-17', status: 'cancelled', paid: false },
        { patient: 'Paciente Test', date: '2025-01-18', status: 'scheduled', paid: false }
      ];
      
      treatments.forEach(treatment => {
        cy.get('button').contains('Nuevo Tratamiento').click();
        cy.get('select[name="patient_id"]').select(treatment.patient);
        cy.get('select[name="service_id"]').select('Limpieza dental');
        cy.get('input[name="treatment_date"]').type(treatment.date);
        cy.get('select[name="status"]').select(treatment.status);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
        
        if (treatment.paid) {
          cy.contains('tr', treatment.date).find('button[aria-label="Registrar pago"]').click();
          cy.get('input[name="amount_cents"]').type('50000');
          cy.get('select[name="payment_method"]').select('cash');
          cy.get('button[type="submit"]').contains('Registrar').click();
          cy.wait(500);
        }
      });
    });

    it('debe generar reporte de producción', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Producción').click();
      
      cy.get('input[name="report_from"]').type('2025-01-15');
      cy.get('input[name="report_to"]').type('2025-01-18');
      cy.get('button').contains('Generar').click();
      
      cy.contains('Reporte de Producción').should('be.visible');
      cy.contains('Total producido').should('be.visible');
      cy.contains('Tratamientos completados: 2').should('be.visible');
    });

    it('debe generar reporte de cobranza', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Cobranza').click();
      
      cy.get('input[name="report_from"]').type('2025-01-15');
      cy.get('input[name="report_to"]').type('2025-01-18');
      cy.get('button').contains('Generar').click();
      
      cy.contains('Reporte de Cobranza').should('be.visible');
      cy.contains('Total cobrado: $500.00').should('be.visible');
      cy.contains('Por cobrar: $500.00').should('be.visible');
    });

    it('debe generar reporte de cancelaciones', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Cancelaciones').click();
      
      cy.contains('Reporte de Cancelaciones').should('be.visible');
      cy.contains('Total cancelado: 1').should('be.visible');
      cy.contains('Tasa de cancelación: 25%').should('be.visible');
    });

    it('debe generar reporte por doctor', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Por Doctor').click();
      
      cy.get('select[name="doctor_id"]').select(1);
      cy.get('button').contains('Generar').click();
      
      cy.contains('Reporte del Doctor').should('be.visible');
      cy.contains('Tratamientos realizados').should('be.visible');
      cy.contains('Producción total').should('be.visible');
    });

    it('debe exportar reportes en diferentes formatos', () => {
      cy.get('button').contains('Reportes').click();
      cy.get('button').contains('Producción').click();
      cy.get('button').contains('Generar').click();
      
      // Exportar PDF
      cy.get('button').contains('Exportar PDF').click();
      cy.readFile('cypress/downloads/reporte-produccion.pdf').should('exist');
      
      // Exportar Excel
      cy.get('button').contains('Exportar Excel').click();
      cy.readFile('cypress/downloads/reporte-produccion.xlsx').should('exist');
    });
  });

  describe('11. Integración con Inventario', () => {
    beforeEach(() => {
      // Crear insumos y servicio con insumos
      cy.visit('/supplies');
      cy.get('button').contains('Nuevo Insumo').click();
      cy.get('input[name="name"]').type('Anestesia');
      cy.get('input[name="price_cents"]').type('5000');
      cy.get('select[name="unit"]').select('cartucho');
      cy.get('input[name="current_stock"]').type('10');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      cy.visit('/services');
      cy.get('button').contains('Nuevo Servicio').click();
      cy.get('input[name="name"]').type('Extracción con anestesia');
      cy.get('input[name="minutes"]').type('45');
      cy.get('button').contains('Agregar Insumo').click();
      cy.get('select[name="supplies[0].supply_id"]').select('Anestesia');
      cy.get('input[name="supplies[0].quantity"]').type('2');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      cy.visit('/treatments');
    });

    it('debe verificar disponibilidad de insumos', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Extracción con anestesia');
      
      // Debe mostrar disponibilidad
      cy.contains('Insumos disponibles').should('be.visible');
      cy.contains('Anestesia: 10 disponibles (requiere 2)').should('be.visible');
    });

    it('debe descontar insumos al completar tratamiento', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Extracción con anestesia');
      cy.get('input[name="treatment_date"]').type('2025-01-20');
      cy.get('select[name="status"]').select('completed');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar que se descontó del stock
      cy.visit('/supplies');
      cy.contains('tr', 'Anestesia').should('contain', '8'); // 10 - 2
    });

    it('debe alertar si no hay stock suficiente', () => {
      // Reducir stock
      cy.visit('/supplies');
      cy.contains('tr', 'Anestesia').find('button[aria-label="Editar"]').click();
      cy.get('input[name="current_stock"]').clear().type('1');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      cy.visit('/treatments');
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Extracción con anestesia');
      
      cy.contains('Stock insuficiente').should('be.visible');
      cy.contains('Anestesia: Solo 1 disponible (requiere 2)').should('be.visible');
    });
  });

  describe('12. Notificaciones y Recordatorios', () => {
    it('debe programar recordatorio de cita', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type(futureDateStr);
      cy.get('select[name="status"]').select('scheduled');
      
      cy.get('input[type="checkbox"][name="send_reminder"]').check();
      cy.get('select[name="reminder_type"]').select('email');
      cy.get('input[name="reminder_days_before"]').type('1');
      cy.get('input[name="reminder_time"]').type('10:00');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Recordatorio programado').should('be.visible');
    });

    it('debe enviar confirmación de cita', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-25');
      cy.get('input[type="checkbox"][name="send_confirmation"]').check();
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Confirmación enviada').should('be.visible');
    });

    it('debe mostrar notificaciones de tratamientos pendientes', () => {
      cy.get('button[aria-label="Notificaciones"]').click();
      
      cy.contains('Tratamientos Pendientes').should('be.visible');
      cy.contains('citas para hoy').should('be.visible');
    });
  });

  describe('13. Plantillas de Tratamiento', () => {
    it('debe crear plantilla de tratamiento', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('textarea[name="clinical_notes"]').type('Protocolo estándar de limpieza');
      
      cy.get('button').contains('Guardar como plantilla').click();
      cy.get('input[name="template_name"]').type('Limpieza estándar');
      cy.get('button[type="submit"]').contains('Guardar Plantilla').click();
      
      cy.contains('Plantilla guardada').should('be.visible');
    });

    it('debe usar plantilla para nuevo tratamiento', () => {
      // Primero crear plantilla
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('textarea[name="clinical_notes"]').type('Notas de plantilla');
      cy.get('button').contains('Guardar como plantilla').click();
      cy.get('input[name="template_name"]').type('Mi plantilla');
      cy.get('button[type="submit"]').contains('Guardar Plantilla').click();
      cy.wait(1000);
      
      // Usar plantilla
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('button').contains('Usar plantilla').click();
      cy.contains('Mi plantilla').click();
      
      cy.get('textarea[name="clinical_notes"]').should('have.value', 'Notas de plantilla');
    });
  });

  describe('14. Consentimientos y Documentos', () => {
    it('debe adjuntar consentimiento informado', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-20');
      
      cy.get('button').contains('Adjuntar documentos').click();
      cy.get('input[type="file"]').selectFile('cypress/fixtures/consentimiento.pdf');
      cy.get('select[name="document_type"]').select('consentimiento');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Documento adjuntado').should('be.visible');
    });

    it('debe generar consentimiento desde plantilla', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      
      cy.get('button').contains('Generar consentimiento').click();
      cy.get('select[name="consent_template"]').select('Consentimiento general');
      cy.get('button').contains('Generar').click();
      
      cy.contains('Consentimiento generado').should('be.visible');
      cy.get('button').contains('Descargar PDF').should('be.visible');
    });

    it('debe registrar firma digital', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      
      cy.get('button').contains('Obtener firma').click();
      
      // Simular firma
      cy.get('canvas#signature-pad').trigger('mousedown', 50, 50);
      cy.get('canvas#signature-pad').trigger('mousemove', 100, 100);
      cy.get('canvas#signature-pad').trigger('mouseup');
      
      cy.get('button').contains('Guardar firma').click();
      
      cy.contains('Firma registrada').should('be.visible');
    });
  });

  describe('15. Multi-tenancy y Permisos', () => {
    it('debe mostrar solo tratamientos de la clínica actual', () => {
      cy.get('input[placeholder*="Buscar"]').type('OtraClinica');
      cy.contains('No se encontraron tratamientos').should('be.visible');
    });

    it('debe aplicar clinic_id automáticamente', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      cy.get('input[name="treatment_date"]').type('2025-01-20');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Tratamiento creado exitosamente').should('be.visible');
    });

    it('debe respetar permisos de usuario', () => {
      // Este test depende del rol del usuario
      // Por ejemplo, solo doctores pueden completar tratamientos
    });
  });

  describe('16. Rendimiento y UX', () => {
    it('debe mostrar skeleton loaders mientras carga', () => {
      cy.visit('/treatments', {
        onBeforeLoad: (win) => {
          cy.intercept('GET', '/api/treatments*', (req) => {
            req.reply((res) => {
              res.delay(1000);
            });
          });
        }
      });
      
      cy.get('[aria-label="Cargando..."]').should('be.visible');
    });

    it('debe tener búsqueda instantánea', () => {
      // Crear varios tratamientos
      for (let i = 1; i <= 5; i++) {
        cy.get('button').contains('Nuevo Tratamiento').click();
        cy.get('select[name="patient_id"]').select('Paciente Test');
        cy.get('select[name="service_id"]').select('Limpieza dental');
        cy.get('input[name="treatment_date"]').type(`2025-01-2${i}`);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(300);
      }
      
      // Búsqueda instantánea
      cy.get('input[placeholder*="Buscar"]').type('Paciente');
      cy.get('tbody tr').should('have.length.at.least', 5);
      
      cy.get('input[placeholder*="Buscar"]').clear().type('NoExiste');
      cy.contains('No se encontraron tratamientos').should('be.visible');
    });

    it('debe tener atajos de teclado', () => {
      // Ctrl+N para nuevo tratamiento
      cy.get('body').type('{ctrl}n');
      cy.contains('Nuevo Tratamiento').should('be.visible');
      
      // Escape para cerrar
      cy.get('body').type('{esc}');
      cy.contains('Nuevo Tratamiento').should('not.exist');
      
      // Ctrl+F para buscar
      cy.get('body').type('{ctrl}f');
      cy.get('input[placeholder*="Buscar"]').should('be.focused');
    });

    it('debe auto-guardar cambios', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      
      cy.get('select[name="patient_id"]').select('Paciente Test');
      cy.get('select[name="service_id"]').select('Limpieza dental');
      
      // Esperar auto-guardado
      cy.wait(3000);
      cy.contains('Borrador guardado').should('be.visible');
      
      // Recargar página
      cy.reload();
      
      cy.get('button').contains('Recuperar borrador').should('be.visible');
    });

    it('debe mostrar confirmación antes de salir con cambios sin guardar', () => {
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').select('Paciente Test');
      
      // Intentar navegar
      cy.get('a[href="/patients"]').click();
      
      cy.contains('¿Descartar cambios?').should('be.visible');
      cy.get('button').contains('Cancelar').click();
      
      // Debe permanecer en la página
      cy.url().should('include', '/treatments');
    });
  });
});

// Comandos personalizados para este módulo
Cypress.Commands.add('createTreatment', (data) => {
  cy.get('button').contains('Nuevo Tratamiento').click();
  cy.get('select[name="patient_id"]').select(data.patient);
  cy.get('select[name="service_id"]').select(data.service);
  cy.get('input[name="treatment_date"]').type(data.date);
  if (data.status) cy.get('select[name="status"]').select(data.status);
  cy.get('button[type="submit"]').contains('Guardar').click();
  cy.wait(500);
});

Cypress.Commands.add('registerPayment', (treatmentId, amount, method) => {
  cy.get(`[data-treatment-id="${treatmentId}"]`).find('button[aria-label="Registrar pago"]').click();
  cy.get('input[name="amount_cents"]').type(amount);
  cy.get('select[name="payment_method"]').select(method);
  cy.get('button[type="submit"]').contains('Registrar').click();
});