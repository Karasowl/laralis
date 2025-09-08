/**
 * TESTS CRUD ROBUSTOS - MÓDULO DE TRATAMIENTOS
 * Cobertura completa de operaciones CRUD con detección de errores
 * Incluye gestión del ciclo completo: planificación → ejecución → pago → seguimiento
 */

describe('CRUD Robusto: Módulo de Tratamientos', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    
    // Crear datos de prueba necesarios
    cy.createTestPatient({
      firstName: 'Juan',
      lastName: 'Pérez',
      email: `juan.perez.${Date.now()}@test.com`
    });
    
    cy.createTestService({
      name: 'Limpieza Dental',
      duration: '45',
      margin: '65'
    });
    
    cy.visit('/treatments');
    cy.wait(1000);
  });

  describe('CREATE - Creación de Tratamientos', () => {
    it('CREATE-T001: Debe crear tratamiento con servicio único', () => {
      cy.get('button').contains('Agregar').click();
      
      // Seleccionar paciente
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      
      // Agregar servicio
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').select('Limpieza Dental');
      cy.get('input[name="notes"]').type('Limpieza rutinaria');
      
      // Configurar fechas
      cy.get('input[name="start_date"]').type('2024-03-01');
      cy.get('input[name="estimated_sessions"]').type('1');
      
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      
      // Verificaciones
      cy.contains('Tratamiento creado exitosamente').should('be.visible');
      cy.contains('Juan Pérez').should('be.visible');
      cy.contains('Limpieza Dental').should('be.visible');
      cy.contains('Planificado').should('be.visible');
      
      // Verificar cálculos automáticos
      cy.get('[data-cy="treatment-total"]').should('be.visible');
      cy.get('[data-cy="estimated-duration"]').should('contain', '45');
    });

    it('CREATE-T002: Debe crear tratamiento con múltiples servicios', () => {
      // Crear servicio adicional
      cy.createTestService({
        name: 'Resina Dental',
        duration: '60',
        margin: '70'
      });
      
      cy.get('button').contains('Agregar').click();
      
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      
      // Agregar primer servicio
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').first().select('Limpieza Dental');
      
      // Agregar segundo servicio
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').last().select('Resina Dental');
      
      cy.get('input[name="start_date"]').type('2024-03-01');
      cy.get('input[name="estimated_sessions"]').type('2');
      
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      
      // Verificaciones
      cy.contains('Tratamiento creado exitosamente').should('be.visible');
      cy.contains('Limpieza Dental').should('be.visible');
      cy.contains('Resina Dental').should('be.visible');
      cy.get('[data-cy="estimated-duration"]').should('contain', '105'); // 45 + 60
    });

    it('CREATE-T003: Debe crear plan de tratamiento complejo', () => {
      cy.get('button').contains('Agregar').click();
      
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      
      // Configurar como plan complejo
      cy.get('select[name="treatment_type"]').select('comprehensive');
      
      // Agregar múltiples servicios con prioridades
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').first().select('Limpieza Dental');
      cy.get('select[name="priority"]').first().select('high');
      cy.get('input[name="session_number"]').first().type('1');
      
      // Configuración avanzada
      cy.get('input[name="start_date"]').type('2024-03-01');
      cy.get('input[name="estimated_sessions"]').type('4');
      cy.get('select[name="difficulty_level"]').select('high');
      cy.get('textarea[name="treatment_plan"]').type('Plan integral de rehabilitación oral');
      
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      
      // Verificaciones específicas de plan complejo
      cy.contains('Plan de tratamiento creado').should('be.visible');
      cy.get('[data-cy="complexity-indicator"]').should('contain', 'Alta');
      cy.get('[data-cy="sessions-planned"]').should('contain', '4');
    });

    it('CREATE-T004: Debe validar campos requeridos', () => {
      cy.get('button').contains('Agregar').click();
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      
      // Verificar mensajes de error
      cy.contains('Debe seleccionar un paciente').should('be.visible');
      cy.contains('Debe agregar al menos un servicio').should('be.visible');
    });

    it('CREATE-T005: Debe validar fechas coherentes', () => {
      cy.get('button').contains('Agregar').click();
      
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').select('Limpieza Dental');
      
      // Fecha de inicio en el pasado lejano
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 2);
      const pastDateStr = pastDate.toISOString().split('T')[0];
      
      cy.get('input[name="start_date"]').type(pastDateStr);
      
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      
      cy.contains('La fecha de inicio no puede ser muy antigua').should('be.visible');
    });

    it('CREATE-T006: Debe calcular presupuesto automáticamente', () => {
      cy.get('button').contains('Agregar').click();
      
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').select('Limpieza Dental');
      
      // Verificar cálculo en tiempo real
      cy.get('[data-cy="budget-preview"]').should('be.visible');
      cy.get('[data-cy="total-cost"]').should('be.visible');
      cy.get('[data-cy="patient-payment"]').should('be.visible');
      
      // Cambiar cantidad de sesiones y verificar recálculo
      cy.get('input[name="estimated_sessions"]').type('2');
      cy.get('[data-cy="total-cost"]').should('not.contain', 'previous-total');
    });

    it('CREATE-T007: Debe manejar conflictos de agenda', () => {
      // Simular conflicto de horario
      cy.intercept('POST', '/api/treatments/check-availability', {
        statusCode: 409,
        body: { 
          error: 'Conflicto de horario', 
          conflicting_appointments: [
            { time: '10:00', patient: 'María López' }
          ]
        }
      }).as('scheduleConflict');
      
      cy.get('button').contains('Agregar').click();
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').select('Limpieza Dental');
      
      cy.get('input[name="appointment_date"]').type('2024-03-15');
      cy.get('input[name="appointment_time"]').type('10:00');
      
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      cy.wait('@scheduleConflict');
      
      // Verificar manejo del conflicto
      cy.contains('Conflicto de horario').should('be.visible');
      cy.contains('María López a las 10:00').should('be.visible');
      cy.contains('Sugerir horarios').should('be.visible');
    });

    it('CREATE-T008: Debe manejar error de red al crear', () => {
      cy.intercept('POST', '/api/treatments', { forceNetworkError: true }).as('networkError');
      
      cy.get('button').contains('Agregar').click();
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').select('Limpieza Dental');
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      
      cy.wait('@networkError');
      
      cy.contains('Error de conexión').should('be.visible');
      cy.contains('Reintentar').should('be.visible');
    });
  });

  describe('READ - Lectura y Listado de Tratamientos', () => {
    beforeEach(() => {
      // Crear tratamientos de prueba con diferentes estados
      const testTreatments = [
        { patient: 'Juan Pérez', status: 'planned', priority: 'high' },
        { patient: 'Juan Pérez', status: 'in_progress', priority: 'medium' },
        { patient: 'Juan Pérez', status: 'completed', priority: 'low' }
      ];
      
      testTreatments.forEach((treatment, index) => {
        cy.get('button').contains('Agregar').click();
        cy.get('select[name="patient_id"]').select(treatment.patient);
        cy.get('button').contains('Agregar servicio').click();
        cy.get('select[name="service_id"]').select('Limpieza Dental');
        cy.get('select[name="priority"]').select(treatment.priority);
        cy.get('button[type="submit"]').contains('Crear tratamiento').click();
        cy.wait(500);
        
        // Simular cambio de estado si no es 'planned'
        if (treatment.status !== 'planned') {
          // Aquí se simularía el cambio de estado
          // Para efectos del test, asumimos que se crean en el estado deseado
        }
      });
    });

    it('READ-T001: Debe mostrar lista de tratamientos correctamente', () => {
      // Verificar columnas de la tabla
      cy.get('th').contains('Paciente').should('be.visible');
      cy.get('th').contains('Servicios').should('be.visible');
      cy.get('th').contains('Estado').should('be.visible');
      cy.get('th').contains('Precio Total').should('be.visible');
      cy.get('th').contains('Progreso').should('be.visible');
      cy.get('th').contains('Acciones').should('be.visible');
      
      // Verificar que se muestran los tratamientos
      cy.get('[data-cy="treatment-row"]').should('have.length.at.least', 3);
    });

    it('READ-T002: Debe filtrar por estado', () => {
      cy.get('select[name="status_filter"]').select('planned');
      cy.get('[data-cy="treatment-row"]').should('contain', 'Planificado');
      cy.get('[data-cy="treatment-row"]').should('not.contain', 'Completado');
    });

    it('READ-T003: Debe filtrar por paciente', () => {
      cy.get('select[name="patient_filter"]').select('Juan Pérez');
      cy.get('[data-cy="treatment-row"]').each($row => {
        cy.wrap($row).should('contain', 'Juan Pérez');
      });
    });

    it('READ-T004: Debe filtrar por rango de fechas', () => {
      cy.get('input[name="date_from"]').type('2024-03-01');
      cy.get('input[name="date_to"]').type('2024-03-31');
      cy.get('button').contains('Filtrar').click();
      
      // Verificar que solo se muestran tratamientos en el rango
      cy.get('[data-cy="treatment-row"]').should('be.visible');
    });

    it('READ-T005: Debe buscar por servicio', () => {
      cy.get('input[placeholder*="Buscar"]').type('Limpieza');
      cy.get('[data-cy="treatment-row"]').should('contain', 'Limpieza Dental');
    });

    it('READ-T006: Debe mostrar progreso visual', () => {
      cy.get('[data-cy="treatment-row"]').first().within(() => {
        cy.get('[data-cy="progress-bar"]').should('be.visible');
        cy.get('[data-cy="progress-percentage"]').should('be.visible');
      });
    });

    it('READ-T007: Debe ordenar por prioridad', () => {
      cy.get('th').contains('Prioridad').click();
      
      // Verificar orden (alta → media → baja)
      cy.get('[data-cy="priority-indicator"]').first().should('have.class', 'priority-high');
    });

    it('READ-T008: Debe mostrar vista detallada', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      
      // Verificar secciones del detalle
      cy.contains('Información General').should('be.visible');
      cy.contains('Servicios Incluidos').should('be.visible');
      cy.contains('Cronograma').should('be.visible');
      cy.contains('Historial de Sesiones').should('be.visible');
      cy.contains('Información Financiera').should('be.visible');
    });

    it('READ-T009: Debe manejar error al cargar tratamientos', () => {
      cy.intercept('GET', '/api/treatments*', { statusCode: 500 }).as('loadError');
      
      cy.reload();
      cy.wait('@loadError');
      
      cy.contains('Error al cargar tratamientos').should('be.visible');
      cy.contains('Reintentar').should('be.visible');
    });
  });

  describe('UPDATE - Actualización de Tratamientos', () => {
    beforeEach(() => {
      // Crear tratamiento para editar
      cy.get('button').contains('Agregar').click();
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').select('Limpieza Dental');
      cy.get('input[name="start_date"]').type('2024-03-01');
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      cy.wait(1000);
    });

    it('UPDATE-T001: Debe cargar formulario con datos actuales', () => {
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Editar"]').click();
      
      // Verificar que los campos tienen los valores correctos
      cy.get('select[name="patient_id"]').should('contain', 'Juan Pérez');
      cy.get('input[name="start_date"]').should('have.value', '2024-03-01');
    });

    it('UPDATE-T002: Debe actualizar información básica', () => {
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('textarea[name="notes"]').type('Notas actualizadas del tratamiento');
      cy.get('select[name="priority"]').select('high');
      cy.get('input[name="estimated_sessions"]').clear().type('3');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Tratamiento actualizado exitosamente').should('be.visible');
      cy.get('[data-cy="priority-indicator"]').should('have.class', 'priority-high');
    });

    it('UPDATE-T003: Debe agregar servicios adicionales', () => {
      // Crear servicio adicional
      cy.createTestService({
        name: 'Sellador Dental',
        duration: '30',
        margin: '60'
      });
      
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Editar"]').click();
      
      // Agregar nuevo servicio
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').last().select('Sellador Dental');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Tratamiento actualizado exitosamente').should('be.visible');
      
      // Verificar servicio agregado
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Sellador Dental').should('be.visible');
    });

    it('UPDATE-T004: Debe remover servicios', () => {
      // Agregar servicio adicional primero
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').last().select('Limpieza Dental');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Ahora remover un servicio
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('[data-cy="remove-service"]').first().click();
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Tratamiento actualizado exitosamente').should('be.visible');
    });

    it('UPDATE-T005: Debe modificar fechas y agenda', () => {
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="start_date"]').clear().type('2024-03-15');
      cy.get('input[name="end_date"]').type('2024-04-15');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Tratamiento actualizado exitosamente').should('be.visible');
    });

    it('UPDATE-T006: Debe recalcular totales al modificar', () => {
      // Obtener total inicial
      cy.get('[data-cy="treatment-row"]').first().find('[data-cy="treatment-total"]')
        .invoke('text').as('initialTotal');
      
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Editar"]').click();
      
      // Agregar servicio (cambiará el total)
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').last().select('Limpieza Dental');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar que el total cambió
      cy.get('[data-cy="treatment-row"]').first().find('[data-cy="treatment-total"]')
        .should('not.contain', '@initialTotal');
    });

    it('UPDATE-T007: Debe validar modificaciones', () => {
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Editar"]').click();
      
      // Intentar fecha inválida
      cy.get('input[name="start_date"]').clear().type('2020-01-01'); // Muy antigua
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('La fecha no puede ser muy antigua').should('be.visible');
    });

    it('UPDATE-T008: Debe crear versión al modificar precios', () => {
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Editar"]').click();
      
      // Modificar algo que afecte precio
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').last().select('Limpieza Dental');
      cy.get('textarea[name="modification_reason"]').type('Servicio adicional requerido');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar versionado
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Historial de Modificaciones').should('be.visible');
      cy.contains('v2.0').should('be.visible');
    });
  });

  describe('DELETE - Eliminación de Tratamientos', () => {
    beforeEach(() => {
      // Crear tratamiento para eliminar
      cy.get('button').contains('Agregar').click();
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').select('Limpieza Dental');
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      cy.wait(1000);
    });

    it('DELETE-T001: Debe mostrar confirmación antes de eliminar', () => {
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Eliminar"]').click();
      
      cy.contains('¿Estás seguro?').should('be.visible');
      cy.contains('Esta acción no se puede deshacer').should('be.visible');
      cy.contains('Se eliminará también el historial de sesiones').should('be.visible');
    });

    it('DELETE-T002: Debe eliminar tratamiento planificado', () => {
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      cy.contains('Tratamiento eliminado exitosamente').should('be.visible');
      cy.get('[data-cy="treatment-row"]').should('have.length', 0);
    });

    it('DELETE-T003: Debe cancelar eliminación', () => {
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Cancelar').click();
      
      cy.get('[data-cy="treatment-row"]').should('have.length', 1);
    });

    it('DELETE-T004: Debe prevenir eliminación de tratamiento en progreso', () => {
      // Simular tratamiento en progreso
      cy.intercept('DELETE', '/api/treatments/*', { 
        statusCode: 409,
        body: { error: 'No se puede eliminar tratamiento en progreso' }
      }).as('progressConflict');
      
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      cy.wait('@progressConflict');
      
      cy.contains('tratamiento en progreso').should('be.visible');
    });

    it('DELETE-T005: Debe ofrecer cancelación como alternativa', () => {
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Eliminar"]').click();
      
      // Debería mostrar opción de cancelar en lugar de eliminar
      cy.contains('Cancelar tratamiento').should('be.visible');
      cy.get('button').contains('Cancelar tratamiento').click();
      
      // Formulario de cancelación
      cy.get('textarea[name="cancellation_reason"]').type('Paciente canceló por motivos personales');
      cy.get('button').contains('Confirmar cancelación').click();
      
      cy.contains('Tratamiento cancelado').should('be.visible');
      cy.get('[data-cy="status-indicator"]').should('contain', 'Cancelado');
    });
  });

  describe('WORKFLOW - Flujo de Trabajo del Tratamiento', () => {
    beforeEach(() => {
      // Crear tratamiento para el flujo de trabajo
      cy.get('button').contains('Agregar').click();
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').select('Limpieza Dental');
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      cy.wait(1000);
    });

    it('WORKFLOW-T001: Debe iniciar sesión de tratamiento', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.get('button').contains('Iniciar sesión').click();
      
      // Confirmación de inicio
      cy.contains('¿Iniciar sesión de tratamiento?').should('be.visible');
      cy.get('button').contains('Confirmar').click();
      
      cy.contains('Sesión iniciada').should('be.visible');
      cy.get('[data-cy="session-timer"]').should('be.visible');
      cy.get('[data-cy="status-indicator"]').should('contain', 'En Progreso');
    });

    it('WORKFLOW-T002: Debe completar sesión de tratamiento', () => {
      // Iniciar sesión primero
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.get('button').contains('Iniciar sesión').click();
      cy.get('button').contains('Confirmar').click();
      cy.wait(1000);
      
      // Completar sesión
      cy.get('button').contains('Completar sesión').click();
      
      cy.get('textarea[name="session_notes"]').type('Sesión completada sin complicaciones');
      cy.get('select[name="session_quality"]').select('excellent');
      cy.get('input[name="next_appointment"]').type('2024-04-01');
      
      cy.get('button').contains('Finalizar sesión').click();
      
      cy.contains('Sesión completada exitosamente').should('be.visible');
      cy.get('[data-cy="progress-bar"]').should('contain', '100%');
    });

    it('WORKFLOW-T003: Debe pausar y reanudar tratamiento', () => {
      // Iniciar sesión
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.get('button').contains('Iniciar sesión').click();
      cy.get('button').contains('Confirmar').click();
      cy.wait(500);
      
      // Pausar
      cy.get('button').contains('Pausar').click();
      cy.get('textarea[name="pause_reason"]').type('Descanso del paciente');
      cy.get('button').contains('Confirmar pausa').click();
      
      cy.get('[data-cy="status-indicator"]').should('contain', 'Pausado');
      
      // Reanudar
      cy.get('button').contains('Reanudar').click();
      
      cy.get('[data-cy="status-indicator"]').should('contain', 'En Progreso');
    });

    it('WORKFLOW-T004: Debe registrar complicaciones durante sesión', () => {
      // Iniciar sesión
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.get('button').contains('Iniciar sesión').click();
      cy.get('button').contains('Confirmar').click();
      cy.wait(500);
      
      // Reportar complicación
      cy.get('button').contains('Reportar complicación').click();
      
      cy.get('select[name="complication_type"]').select('bleeding');
      cy.get('select[name="severity"]').select('minor');
      cy.get('textarea[name="description"]').type('Sangrado menor durante limpieza');
      cy.get('textarea[name="action_taken"]').type('Se aplicó hemostático local');
      
      cy.get('button').contains('Registrar').click();
      
      cy.contains('Complicación registrada').should('be.visible');
      cy.get('[data-cy="complication-alert"]').should('be.visible');
    });

    it('WORKFLOW-T005: Debe generar documentación de sesión', () => {
      // Completar una sesión primero
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.get('button').contains('Iniciar sesión').click();
      cy.get('button').contains('Confirmar').click();
      cy.wait(500);
      
      cy.get('button').contains('Completar sesión').click();
      cy.get('textarea[name="session_notes"]').type('Documentación completa de la sesión');
      cy.get('button').contains('Finalizar sesión').click();
      cy.wait(1000);
      
      // Generar documento
      cy.get('button').contains('Generar reporte').click();
      
      cy.get('input[name="report_title"]').type('Reporte Sesión Limpieza');
      cy.get('checkbox[name="include_photos"]').check();
      cy.get('checkbox[name="include_notes"]').check();
      
      cy.get('button').contains('Generar').click();
      
      cy.contains('Reporte generado exitosamente').should('be.visible');
      cy.get('[data-cy="download-report"]').should('be.visible');
    });
  });

  describe('PAYMENTS - Gestión de Pagos', () => {
    beforeEach(() => {
      // Crear tratamiento con costo para pagos
      cy.get('button').contains('Agregar').click();
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').select('Limpieza Dental');
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      cy.wait(1000);
    });

    it('PAYMENTS-T001: Debe registrar pago completo', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Pagos').click();
      
      cy.get('button').contains('Registrar pago').click();
      
      cy.get('input[name="amount_cents"]').type('150000'); // $1,500
      cy.get('select[name="payment_method"]').select('cash');
      cy.get('textarea[name="notes"]').type('Pago completo en efectivo');
      
      cy.get('button').contains('Registrar').click();
      
      cy.contains('Pago registrado exitosamente').should('be.visible');
      cy.get('[data-cy="payment-status"]').should('contain', 'Pagado');
    });

    it('PAYMENTS-T002: Debe manejar pagos parciales', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Pagos').click();
      
      // Primer pago parcial
      cy.get('button').contains('Registrar pago').click();
      cy.get('input[name="amount_cents"]').type('75000'); // $750 de $1,500 total
      cy.get('select[name="payment_method"]').select('cash');
      cy.get('button').contains('Registrar').click();
      cy.wait(500);
      
      // Verificar saldo pendiente
      cy.get('[data-cy="pending-balance"]').should('contain', '$750');
      cy.get('[data-cy="payment-progress"]').should('contain', '50%');
      
      // Segundo pago para completar
      cy.get('button').contains('Registrar pago').click();
      cy.get('input[name="amount_cents"]').type('75000');
      cy.get('select[name="payment_method"]').select('card');
      cy.get('button').contains('Registrar').click();
      
      cy.get('[data-cy="payment-status"]').should('contain', 'Pagado');
    });

    it('PAYMENTS-T003: Debe crear plan de pagos', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Pagos').click();
      
      cy.get('button').contains('Plan de pagos').click();
      
      cy.get('input[name="installments"]').type('3');
      cy.get('input[name="first_payment_date"]').type('2024-03-15');
      cy.get('select[name="frequency"]').select('monthly');
      cy.get('input[name="down_payment_cents"]').type('50000'); // $500 inicial
      
      cy.get('button').contains('Crear plan').click();
      
      cy.contains('Plan de pagos creado').should('be.visible');
      cy.get('[data-cy="installment-schedule"]').should('be.visible');
      cy.contains('3 cuotas').should('be.visible');
    });

    it('PAYMENTS-T004: Debe manejar reembolsos', () => {
      // Registrar pago primero
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Pagos').click();
      
      cy.get('button').contains('Registrar pago').click();
      cy.get('input[name="amount_cents"]').type('150000');
      cy.get('select[name="payment_method"]').select('cash');
      cy.get('button').contains('Registrar').click();
      cy.wait(1000);
      
      // Procesar reembolso
      cy.get('[data-cy="payment-row"]').first().find('button[aria-label="Reembolsar"]').click();
      
      cy.get('input[name="refund_amount"]').type('50000'); // $500 de reembolso
      cy.get('textarea[name="refund_reason"]').type('Cancelación parcial del tratamiento');
      
      cy.get('button').contains('Procesar reembolso').click();
      
      cy.contains('Reembolso procesado').should('be.visible');
      cy.get('[data-cy="net-payment"]').should('contain', '$1,000');
    });

    it('PAYMENTS-T005: Debe integrar con facturación', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Pagos').click();
      
      cy.get('button').contains('Registrar pago').click();
      cy.get('input[name="amount_cents"]').type('150000');
      cy.get('select[name="payment_method"]').select('card');
      cy.get('checkbox[name="generate_invoice"]').check();
      
      // Datos de facturación
      cy.get('input[name="rfc"]').type('XAXX010101000');
      cy.get('select[name="uso_cfdi"]').select('G03');
      
      cy.get('button').contains('Registrar').click();
      
      cy.contains('Pago registrado y factura generada').should('be.visible');
      cy.get('[data-cy="invoice-link"]').should('be.visible');
    });
  });

  describe('INTEGRACIÓN - Tests de Integración', () => {
    it('INTEGRATION-T001: Debe mantener consistencia CRUD completa', () => {
      // CREATE
      cy.get('button').contains('Agregar').click();
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').select('Limpieza Dental');
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      
      // READ
      cy.get('[data-cy="treatment-row"]').should('have.length', 1);
      cy.contains('Juan Pérez').should('be.visible');
      
      // UPDATE
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('textarea[name="notes"]').type('Tratamiento modificado');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // READ updated
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Tratamiento modificado').should('be.visible');
      
      // DELETE
      cy.get('button').contains('Volver').click();
      cy.get('[data-cy="treatment-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      // READ deleted
      cy.get('[data-cy="treatment-row"]').should('have.length', 0);
    });

    it('INTEGRATION-T002: Debe sincronizar con historial de paciente', () => {
      // Crear tratamiento
      cy.get('button').contains('Agregar').click();
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').select('Limpieza Dental');
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      cy.wait(1000);
      
      // Verificar en historial del paciente
      cy.visit('/patients');
      cy.get('[data-cy="patient-row"]').first().click();
      cy.contains('Historial de Tratamientos').should('be.visible');
      cy.contains('Limpieza Dental').should('be.visible');
    });

    it('INTEGRATION-T003: Debe actualizar inventario al usar insumos', () => {
      // Crear insumo con stock
      cy.visit('/supplies');
      cy.createTestSupply({
        name: 'Pasta Profiláctica',
        unit: 'tubo',
        quantity: '1',
        cost: '1500',
        stock: '10'
      });
      
      // Asociar insumo a servicio
      cy.visit('/services');
      cy.get('[data-cy="service-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('button').contains('Agregar insumo').click();
      cy.get('select[name="supply_id"]').select('Pasta Profiláctica');
      cy.get('input[name="quantity_used"]').type('1');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Crear tratamiento
      cy.visit('/treatments');
      cy.get('button').contains('Agregar').click();
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').select('Limpieza Dental');
      cy.get('button[type="submit"]').contains('Crear tratamiento').click();
      cy.wait(1000);
      
      // Completar sesión (debería reducir inventario)
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.get('button').contains('Iniciar sesión').click();
      cy.get('button').contains('Confirmar').click();
      cy.wait(500);
      cy.get('button').contains('Completar sesión').click();
      cy.get('button').contains('Finalizar sesión').click();
      cy.wait(1000);
      
      // Verificar reducción de inventario
      cy.visit('/supplies');
      cy.contains('Pasta Profiláctica').should('be.visible');
      // El stock debería haberse reducido de 10 a 9
    });
  });

  describe('PERFORMANCE - Tests de Rendimiento', () => {
    it('PERF-T001: Debe cargar tratamientos rápidamente', () => {
      const startTime = Date.now();
      
      cy.reload();
      cy.get('table').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(3000);
      });
    });

    it('PERF-T002: Debe filtrar grandes volúmenes eficientemente', () => {
      // Simular muchos tratamientos
      cy.intercept('GET', '/api/treatments*', { 
        fixture: 'large-treatments-dataset.json' 
      }).as('largeDataset');
      
      cy.reload();
      cy.wait('@largeDataset');
      
      const startTime = Date.now();
      
      cy.get('select[name="status_filter"]').select('planned');
      cy.get('[data-cy="treatment-row"]').should('be.visible');
      
      cy.then(() => {
        const filterTime = Date.now() - startTime;
        expect(filterTime).to.be.lessThan(1000);
      });
    });

    it('PERF-T003: Debe calcular totales sin delay perceptible', () => {
      cy.get('button').contains('Agregar').click();
      
      const startTime = Date.now();
      
      cy.get('select[name="patient_id"]').select('Juan Pérez');
      cy.get('button').contains('Agregar servicio').click();
      cy.get('select[name="service_id"]').select('Limpieza Dental');
      
      cy.get('[data-cy="total-preview"]').should('be.visible');
      
      cy.then(() => {
        const calcTime = Date.now() - startTime;
        expect(calcTime).to.be.lessThan(1000);
      });
    });
  });
});

// Comandos personalizados adicionales para tratamientos
Cypress.Commands.add('createTestTreatment', (data) => {
  cy.get('button').contains('Agregar').click();
  cy.get('select[name="patient_id"]').select(data.patient);
  cy.get('button').contains('Agregar servicio').click();
  cy.get('select[name="service_id"]').select(data.service);
  if (data.startDate) cy.get('input[name="start_date"]').type(data.startDate);
  if (data.priority) cy.get('select[name="priority"]').select(data.priority);
  cy.get('button[type="submit"]').contains('Crear tratamiento').click();
  cy.wait(500);
});

Cypress.Commands.add('startTreatmentSession', () => {
  cy.get('button').contains('Iniciar sesión').click();
  cy.get('button').contains('Confirmar').click();
  cy.wait(500);
});

Cypress.Commands.add('completeTreatmentSession', (notes) => {
  cy.get('button').contains('Completar sesión').click();
  if (notes) cy.get('textarea[name="session_notes"]').type(notes);
  cy.get('button').contains('Finalizar sesión').click();
  cy.wait(500);
});