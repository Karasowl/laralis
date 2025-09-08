describe('Treatment Management Module', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/treatments');
    cy.wait(1000);
  });

  describe('Treatment Overview and Listing', () => {
    it('should display treatments page correctly', () => {
      cy.contains('Tratamientos').should('be.visible');
      cy.get('[data-cy="add-treatment-button"]').or('button:contains("Agregar")').should('be.visible');
      cy.get('[data-cy="treatments-table"]').should('exist');
    });

    it('should filter treatments by status', () => {
      cy.get('[data-cy="status-filter"]').select('pending');
      cy.wait(500);
      
      cy.get('[data-cy="treatment-row"]').each($row => {
        cy.wrap($row).should('contain', 'Pendiente')
          .or('have.attr', 'data-status', 'pending');
      });
    });

    it('should filter treatments by date range', () => {
      cy.get('[data-cy="date-filter-from"]').type('2024-01-01');
      cy.get('[data-cy="date-filter-to"]').type('2024-12-31');
      cy.get('[data-cy="apply-filter"]').click();
      
      cy.get('[data-cy="treatment-row"]').should('be.visible');
    });
  });

  describe('Treatment Creation and Planning', () => {
    it('should create a new treatment plan', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Seleccionar paciente
      cy.get('select[name="patient_id"]').select(0); // Primer paciente
      
      // Agregar servicios al tratamiento
      cy.contains('button', 'Agregar servicio').click();
      cy.get('select[name="service_id"]').select(0); // Primer servicio
      cy.get('input[name="notes"]').type('Tratamiento de limpieza rutinaria');
      
      // Agregar segundo servicio
      cy.contains('button', 'Agregar servicio').click();
      cy.get('select[name="service_id"]').last().select(1);
      
      // Configurar fechas
      cy.get('input[name="start_date"]').type('2024-02-15');
      cy.get('input[name="estimated_sessions"]').type('2');
      
      cy.contains('button', 'Crear tratamiento').click();
      
      // Verificar creación
      cy.contains('tratamiento creado').should('be.visible');
    });

    it('should calculate treatment totals automatically', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      cy.get('select[name="patient_id"]').select(0);
      cy.contains('button', 'Agregar servicio').click();
      cy.get('select[name="service_id"]').select(0);
      
      // Verificar cálculos automáticos
      cy.get('[data-cy="service-price"]').should('be.visible');
      cy.get('[data-cy="treatment-total"]').should('be.visible');
      cy.get('[data-cy="estimated-duration"]').should('be.visible');
    });

    it('should validate treatment requirements', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Intentar crear sin paciente
      cy.contains('button', 'Crear tratamiento').click();
      
      cy.contains('requerido').or('paciente').should('be.visible');
    });
  });

  describe('Treatment Execution and Progress', () => {
    beforeEach(() => {
      // Crear tratamiento de prueba si no existe
      cy.get('body').then($body => {
        if ($body.find('[data-cy="treatment-row"]').length === 0) {
          cy.contains('button', 'Agregar').click();
          cy.get('select[name="patient_id"]').select(0);
          cy.contains('button', 'Agregar servicio').click();
          cy.get('select[name="service_id"]').select(0);
          cy.contains('button', 'Crear tratamiento').click();
          cy.wait(1000);
        }
      });
    });

    it('should start treatment session', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('button', 'Iniciar sesión').click();
      
      // Confirmar inicio de sesión
      cy.contains('button', 'Confirmar').click();
      
      // Verificar que cambió el estado
      cy.contains('En progreso').should('be.visible');
      cy.get('[data-cy="session-timer"]').should('be.visible');
    });

    it('should complete treatment session', () => {
      // Iniciar sesión primero
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('button', 'Iniciar sesión').click();
      cy.contains('button', 'Confirmar').click();
      cy.wait(1000);
      
      // Completar sesión
      cy.contains('button', 'Completar sesión').click();
      cy.get('textarea[name="session_notes"]').type('Sesión completada exitosamente');
      cy.contains('button', 'Finalizar').click();
      
      // Verificar finalización
      cy.contains('sesión completada').should('be.visible');
    });

    it('should track treatment progress', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Progreso').click();
      
      // Verificar indicadores de progreso
      cy.get('[data-cy="progress-bar"]').should('be.visible');
      cy.get('[data-cy="completed-sessions"]').should('be.visible');
      cy.get('[data-cy="remaining-sessions"]').should('be.visible');
    });

    it('should manage treatment modifications', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('button', 'Modificar').click();
      
      // Agregar servicio adicional
      cy.contains('button', 'Agregar servicio').click();
      cy.get('select[name="service_id"]').last().select(1);
      cy.get('textarea[name="modification_reason"]').type('Complicación requiere servicio adicional');
      
      cy.contains('button', 'Guardar cambios').click();
      
      // Verificar modificación
      cy.contains('tratamiento modificado').should('be.visible');
    });
  });

  describe('Treatment Financial Management', () => {
    it('should handle treatment payments', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Pagos').click();
      
      // Registrar pago
      cy.contains('button', 'Registrar pago').click();
      cy.get('input[name="amount_cents"]').type('50000'); // $500
      cy.get('select[name="payment_method"]').select('cash');
      cy.get('textarea[name="notes"]').type('Pago parcial en efectivo');
      
      cy.contains('button', 'Registrar').click();
      
      // Verificar registro de pago
      cy.contains('pago registrado').should('be.visible');
      cy.get('[data-cy="payment-history"]').should('contain', '$500');
    });

    it('should calculate outstanding balances', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Financiero').click();
      
      // Verificar cálculos financieros
      cy.get('[data-cy="total-cost"]').should('be.visible');
      cy.get('[data-cy="paid-amount"]').should('be.visible');
      cy.get('[data-cy="outstanding-balance"]').should('be.visible');
      cy.get('[data-cy="payment-percentage"]').should('be.visible');
    });

    it('should generate payment plans', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Plan de pagos').click();
      
      // Crear plan de pagos
      cy.contains('button', 'Crear plan').click();
      cy.get('input[name="installments"]').type('3');
      cy.get('input[name="first_payment"]').type('2024-03-01');
      cy.get('select[name="frequency"]').select('monthly');
      
      cy.contains('button', 'Generar plan').click();
      
      // Verificar plan generado
      cy.contains('plan creado').should('be.visible');
      cy.get('[data-cy="installment-schedule"]').should('be.visible');
    });
  });

  describe('Treatment Documentation', () => {
    it('should manage treatment photos', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Fotos').click();
      
      // Subir foto
      cy.get('input[type="file"]').selectFile('cypress/fixtures/treatment-photo.jpg');
      cy.get('input[name="photo_description"]').type('Antes del tratamiento');
      cy.get('select[name="photo_category"]').select('before');
      
      cy.contains('button', 'Subir foto').click();
      
      // Verificar subida
      cy.contains('foto subida').should('be.visible');
      cy.get('[data-cy="treatment-photos"]').should('contain', 'Antes');
    });

    it('should manage treatment notes', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Notas').click();
      
      // Agregar nota
      cy.contains('button', 'Nueva nota').click();
      cy.get('textarea[name="note_content"]').type('Paciente tolera bien el tratamiento');
      cy.get('select[name="note_type"]').select('progress');
      
      cy.contains('button', 'Guardar nota').click();
      
      // Verificar nota
      cy.contains('nota guardada').should('be.visible');
      cy.contains('tolera bien').should('be.visible');
    });

    it('should generate treatment reports', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Reporte').click();
      
      // Generar reporte
      cy.contains('button', 'Generar reporte').click();
      cy.get('input[name="report_title"]').type('Reporte de Tratamiento Completo');
      cy.get('checkbox[name="include_photos"]').check();
      cy.get('checkbox[name="include_payments"]').check();
      
      cy.contains('button', 'Crear reporte').click();
      
      // Verificar generación
      cy.contains('reporte generado').should('be.visible');
    });
  });

  describe('Treatment Analytics and Insights', () => {
    it('should show treatment success rates', () => {
      cy.visit('/treatments/analytics');
      cy.wait(1000);
      
      // Verificar métricas de éxito
      cy.get('[data-cy="success-rate"]').should('be.visible');
      cy.get('[data-cy="completion-rate"]').should('be.visible');
      cy.get('[data-cy="average-duration"]').should('be.visible');
    });

    it('should display treatment profitability', () => {
      cy.visit('/treatments/analytics');
      cy.wait(1000);
      
      // Verificar análisis de rentabilidad
      cy.get('[data-cy="revenue-chart"]').should('be.visible');
      cy.get('[data-cy="cost-analysis"]').should('be.visible');
      cy.get('[data-cy="profit-margins"]').should('be.visible');
    });

    it('should show patient satisfaction metrics', () => {
      cy.visit('/treatments/analytics');
      cy.wait(1000);
      
      // Verificar satisfacción del paciente
      cy.get('[data-cy="satisfaction-score"]').should('be.visible');
      cy.get('[data-cy="feedback-summary"]').should('be.visible');
    });
  });

  describe('Treatment Scheduling and Calendar', () => {
    it('should schedule treatment appointments', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Citas').click();
      
      // Agendar nueva cita
      cy.contains('button', 'Agendar cita').click();
      cy.get('input[name="appointment_date"]').type('2024-03-15');
      cy.get('input[name="appointment_time"]').type('10:00');
      cy.get('select[name="service_id"]').select(0);
      
      cy.contains('button', 'Agendar').click();
      
      // Verificar agendamiento
      cy.contains('cita agendada').should('be.visible');
    });

    it('should manage appointment conflicts', () => {
      // Intentar agendar en horario ocupado
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Citas').click();
      cy.contains('button', 'Agendar cita').click();
      
      cy.get('input[name="appointment_date"]').type('2024-03-15');
      cy.get('input[name="appointment_time"]').type('10:00'); // Mismo horario
      
      cy.contains('button', 'Agendar').click();
      
      // Verificar detección de conflicto
      cy.contains('conflicto').or('ocupado').should('be.visible');
    });
  });

  describe('Treatment Quality Control', () => {
    it('should define treatment protocols', () => {
      cy.visit('/treatments/protocols');
      cy.wait(1000);
      
      // Crear protocolo
      cy.contains('button', 'Nuevo protocolo').click();
      cy.get('input[name="protocol_name"]').type('Protocolo Endodoncia');
      cy.get('textarea[name="steps"]').type('1. Anestesia\n2. Acceso\n3. Limpieza\n4. Obturación');
      
      cy.contains('button', 'Guardar protocolo').click();
      
      // Verificar creación
      cy.contains('protocolo creado').should('be.visible');
    });

    it('should track protocol compliance', () => {
      cy.get('[data-cy="treatment-row"]').first().click();
      cy.contains('Cumplimiento').click();
      
      // Verificar seguimiento de protocolo
      cy.get('[data-cy="protocol-checklist"]').should('be.visible');
      cy.get('[data-cy="compliance-score"]').should('be.visible');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large treatment lists efficiently', () => {
      // Verificar paginación
      cy.get('[data-cy="pagination"]').should('be.visible');
      
      // Cambiar página
      cy.get('[data-cy="next-page"]').click();
      cy.get('[data-cy="treatment-row"]').should('be.visible');
    });

    it('should search treatments quickly', () => {
      const startTime = Date.now();
      
      cy.get('input[placeholder*="Buscar"]').type('limpieza');
      cy.get('[data-cy="treatment-row"]').should('be.visible');
      
      cy.then(() => {
        const searchTime = Date.now() - startTime;
        expect(searchTime).to.be.lessThan(1000);
      });
    });
  });

  describe('Mobile and Accessibility', () => {
    it('should work on mobile devices', () => {
      cy.viewport('iphone-6');
      
      cy.get('[data-cy="treatments-table"]').should('be.visible');
      cy.contains('button', 'Agregar').should('be.visible');
    });

    it('should be accessible via keyboard', () => {
      cy.get('body').tab();
      cy.focused().should('be.visible');
      
      cy.focused().tab().tab();
      cy.focused().should('be.visible');
    });
  });
});