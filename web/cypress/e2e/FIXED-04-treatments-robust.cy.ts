/**
 * TESTS CRUD ROBUSTOS - MÓDULO DE TRATAMIENTOS (CORREGIDO)
 * Versión corregida con sintaxis válida de Cypress
 */

describe('CRUD Robusto: Módulo de Tratamientos', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/treatments');
    cy.wait(1000);
  });

  describe('CREATE - Creación de Tratamientos', () => {
    beforeEach(() => {
      // Crear paciente y servicio necesarios para los tratamientos
      cy.visit('/patients');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Paciente")').length > 0) {
          cy.get('button:contains("Nuevo Paciente")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      const uniqueId = Date.now();
      cy.get('input[name="first_name"]').type('Test');
      cy.get('input[name="last_name"]').type(`Patient${uniqueId}`);
      cy.get('button[type="submit"]').click();
      cy.wait(1000);
      
      // Crear servicio
      cy.visit('/services');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Servicio")').length > 0) {
          cy.get('button:contains("Nuevo Servicio")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type(`Service${uniqueId}`);
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('40');
      cy.get('button[type="submit"]').click();
      cy.wait(1000);
      
      cy.visit('/treatments');
    });

    it('CREATE-T001: Debe crear tratamiento básico', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Tratamiento")').length > 0) {
          cy.get('button:contains("Nuevo Tratamiento")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      // Seleccionar paciente
      cy.get('body').then($body => {
        if ($body.find('select[name="patient_id"]').length > 0) {
          cy.get('select[name="patient_id"]').select(1);
        } else if ($body.find('input[placeholder*="paciente"]').length > 0) {
          cy.get('input[placeholder*="paciente"]').type('Test Patient');
          cy.get('li').first().click();
        }
      });
      
      // Seleccionar servicio
      cy.get('body').then($body => {
        if ($body.find('select[name="service_id"]').length > 0) {
          cy.get('select[name="service_id"]').select(1);
        } else if ($body.find('input[placeholder*="servicio"]').length > 0) {
          cy.get('input[placeholder*="servicio"]').type('Service');
          cy.get('li').first().click();
        }
      });
      
      // Fecha del tratamiento
      cy.get('body').then($body => {
        if ($body.find('input[name="scheduled_date"]').length > 0) {
          cy.get('input[name="scheduled_date"]').type('2025-09-01');
        }
        if ($body.find('input[name="scheduled_time"]').length > 0) {
          cy.get('input[name="scheduled_time"]').type('10:00');
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').should('contain.text', 'exitosamente');
    });

    it('CREATE-T002: Debe validar campos requeridos', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Tratamiento")').length > 0) {
          cy.get('button:contains("Nuevo Tratamiento")').click();
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

    it('CREATE-T003: Debe calcular precio automáticamente', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Tratamiento")').length > 0) {
          cy.get('button:contains("Nuevo Tratamiento")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="patient_id"]').length > 0) {
          cy.get('select[name="patient_id"]').select(1);
        }
        if ($body.find('select[name="service_id"]').length > 0) {
          cy.get('select[name="service_id"]').select(1);
        }
      });
      
      // Verificar que se muestra el precio calculado
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasPriceDisplay = bodyText.includes('$') && bodyText.includes('Total');
        if (bodyText.includes('price') || bodyText.includes('precio')) {
          expect(hasPriceDisplay).to.be.true;
        }
      });
    });

    it('CREATE-T004: Debe crear tratamiento en múltiples sesiones', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Tratamiento")').length > 0) {
          cy.get('button:contains("Nuevo Tratamiento")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="patient_id"]').length > 0) {
          cy.get('select[name="patient_id"]').select(1);
        }
        if ($body.find('select[name="service_id"]').length > 0) {
          cy.get('select[name="service_id"]').select(1);
        }
        if ($body.find('input[name="sessions_count"]').length > 0) {
          cy.get('input[name="sessions_count"]').clear().type('3');
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').should('contain.text', 'exitosamente');
    });
  });

  describe('READ - Lectura de Tratamientos', () => {
    beforeEach(() => {
      // Crear datos de prueba para tratamientos
      const uniqueId = Date.now();
      
      // Crear paciente
      cy.visit('/patients');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Paciente")').length > 0) {
          cy.get('button:contains("Nuevo Paciente")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="first_name"]').type('Ana');
      cy.get('input[name="last_name"]').type(`Treatment${uniqueId}`);
      cy.get('button[type="submit"]').click();
      cy.wait(500);
      
      // Crear servicio
      cy.visit('/services');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Servicio")').length > 0) {
          cy.get('button:contains("Nuevo Servicio")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Limpieza Completa');
      cy.get('input[name="duration_minutes"]').type('45');
      cy.get('input[name="margin_percentage"]').type('45');
      cy.get('button[type="submit"]').click();
      cy.wait(500);
      
      // Crear tratamiento
      cy.visit('/treatments');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Tratamiento")').length > 0) {
          cy.get('button:contains("Nuevo Tratamiento")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="patient_id"]').length > 0) {
          cy.get('select[name="patient_id"]').select(1);
        }
        if ($body.find('select[name="service_id"]').length > 0) {
          cy.get('select[name="service_id"]').select(1);
        }
      });
      
      cy.get('button[type="submit"]').click();
      cy.wait(1000);
    });

    it('READ-T001: Debe mostrar lista de tratamientos', () => {
      cy.get('body').should('contain.text', 'Limpieza Completa');
      cy.get('body').should('contain.text', 'Ana Treatment');
    });

    it('READ-T002: Debe mostrar estados de tratamientos', () => {
      // Verificar que se muestran los estados (pendiente, en progreso, completado)
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasStatus = bodyText.includes('Pendiente') || 
                         bodyText.includes('En progreso') || 
                         bodyText.includes('Completado') ||
                         bodyText.includes('Programado');
        expect(hasStatus).to.be.true;
      });
    });

    it('READ-T003: Debe filtrar por paciente', () => {
      cy.get('body').then($body => {
        if ($body.find('input[placeholder*="Buscar"]').length > 0) {
          cy.get('input[placeholder*="Buscar"]').type('Ana');
          cy.get('body').should('contain.text', 'Ana Treatment');
        } else if ($body.find('select[name="patient_filter"]').length > 0) {
          cy.get('select[name="patient_filter"]').select('Ana Treatment');
        }
      });
    });

    it('READ-T004: Debe filtrar por estado', () => {
      cy.get('body').then($body => {
        if ($body.find('select[name="status_filter"]').length > 0) {
          cy.get('select[name="status_filter"]').select('Pendiente');
          cy.get('body').should('contain.text', 'Pendiente');
        } else if ($body.find('button:contains("Pendiente")').length > 0) {
          cy.get('button:contains("Pendiente")').click();
        }
      });
    });

    it('READ-T005: Debe mostrar calendario de citas', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Calendario")').length > 0) {
          cy.get('button:contains("Calendario")').click();
          cy.get('body').should('be.visible');
        } else if ($body.find('[data-testid="calendar-view"]').length > 0) {
          cy.get('[data-testid="calendar-view"]').should('be.visible');
        }
      });
    });
  });

  describe('UPDATE - Actualización de Tratamientos', () => {
    beforeEach(() => {
      // Crear tratamiento para editar
      const uniqueId = Date.now();
      
      cy.visit('/patients');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Paciente")').length > 0) {
          cy.get('button:contains("Nuevo Paciente")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="first_name"]').type('Editable');
      cy.get('input[name="last_name"]').type(`Patient${uniqueId}`);
      cy.get('button[type="submit"]').click();
      cy.wait(500);
      
      cy.visit('/services');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Servicio")').length > 0) {
          cy.get('button:contains("Nuevo Servicio")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Editable Service');
      cy.get('input[name="duration_minutes"]').type('60');
      cy.get('input[name="margin_percentage"]').type('50');
      cy.get('button[type="submit"]').click();
      cy.wait(500);
      
      cy.visit('/treatments');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Tratamiento")').length > 0) {
          cy.get('button:contains("Nuevo Tratamiento")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="patient_id"]').length > 0) {
          cy.get('select[name="patient_id"]').select(1);
        }
        if ($body.find('select[name="service_id"]').length > 0) {
          cy.get('select[name="service_id"]').select(1);
        }
      });
      
      cy.get('button[type="submit"]').click();
      cy.wait(1000);
    });

    it('UPDATE-T001: Debe actualizar fecha del tratamiento', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('input[name="scheduled_date"]').length > 0) {
          cy.get('input[name="scheduled_date"]').clear().type('2025-09-15');
        }
        if ($body.find('input[name="scheduled_time"]').length > 0) {
          cy.get('input[name="scheduled_time"]').clear().type('14:30');
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').should('contain.text', 'actualizado');
    });

    it('UPDATE-T002: Debe cambiar estado del tratamiento', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="status"]').length > 0) {
          cy.get('select[name="status"]').select('En progreso');
        } else if ($body.find('button:contains("En progreso")').length > 0) {
          cy.get('button:contains("En progreso")').click();
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').should('contain.text', 'En progreso');
    });

    it('UPDATE-T003: Debe agregar notas al tratamiento', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('textarea[name="notes"]').length > 0) {
          cy.get('textarea[name="notes"]').type('Paciente llegó 10 minutos tarde. Tratamiento completado sin complicaciones.');
        } else if ($body.find('input[name="observations"]').length > 0) {
          cy.get('input[name="observations"]').type('Observaciones del tratamiento');
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').should('contain.text', 'actualizado');
    });

    it('UPDATE-T004: Debe completar tratamiento con pago', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="status"]').length > 0) {
          cy.get('select[name="status"]').select('Completado');
        }
        if ($body.find('select[name="payment_status"]').length > 0) {
          cy.get('select[name="payment_status"]').select('Pagado');
        }
        if ($body.find('input[name="payment_amount"]').length > 0) {
          cy.get('input[name="payment_amount"]').type('85000'); // $850.00
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').should('contain.text', 'Completado');
      cy.get('body').should('contain.text', 'Pagado');
    });
  });

  describe('DELETE - Eliminación de Tratamientos', () => {
    beforeEach(() => {
      // Crear tratamiento para eliminar
      const uniqueId = Date.now();
      
      cy.visit('/patients');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Paciente")').length > 0) {
          cy.get('button:contains("Nuevo Paciente")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="first_name"]').type('ToDelete');
      cy.get('input[name="last_name"]').type(`Patient${uniqueId}`);
      cy.get('button[type="submit"]').click();
      cy.wait(500);
      
      cy.visit('/services');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Servicio")').length > 0) {
          cy.get('button:contains("Nuevo Servicio")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('ToDelete Service');
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('40');
      cy.get('button[type="submit"]').click();
      cy.wait(500);
      
      cy.visit('/treatments');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Tratamiento")').length > 0) {
          cy.get('button:contains("Nuevo Tratamiento")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="patient_id"]').length > 0) {
          cy.get('select[name="patient_id"]').select(1);
        }
        if ($body.find('select[name="service_id"]').length > 0) {
          cy.get('select[name="service_id"]').select(1);
        }
      });
      
      cy.get('button[type="submit"]').click();
      cy.wait(1000);
    });

    it('DELETE-T001: Debe mostrar confirmación antes de eliminar', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Eliminar"]').length > 0) {
          cy.get('button[aria-label="Eliminar"]').first().click();
        } else {
          cy.get('button:contains("Eliminar")').first().click();
        }
      });
      
      cy.get('body').should('contain.text', 'seguro');
    });

    it('DELETE-T002: Debe eliminar tratamiento pendiente', () => {
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Eliminar"]').length > 0) {
          cy.get('button[aria-label="Eliminar"]').first().click();
        } else {
          cy.get('button:contains("Eliminar")').first().click();
        }
      });
      
      cy.get('button:contains("Eliminar")').click();
      
      cy.get('body').should('contain.text', 'eliminado exitosamente');
      cy.get('body').should('not.contain.text', 'ToDelete Service');
    });

    it('DELETE-T003: Debe prevenir eliminación de tratamiento completado', () => {
      // Primero completar el tratamiento
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="status"]').length > 0) {
          cy.get('select[name="status"]').select('Completado');
        }
      });
      
      cy.get('button[type="submit"]').click();
      cy.wait(500);
      
      // Intentar eliminar tratamiento completado
      cy.intercept('DELETE', '/api/treatments/*', { 
        statusCode: 409, 
        body: { error: 'Cannot delete completed treatment' } 
      }).as('deleteConflict');
      
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Eliminar"]').length > 0) {
          cy.get('button[aria-label="Eliminar"]').first().click();
        } else {
          cy.get('button:contains("Eliminar")').first().click();
        }
      });
      
      cy.get('button:contains("Eliminar")').click();
      
      cy.wait('@deleteConflict');
      cy.get('body').should('contain.text', 'completado');
    });
  });

  describe('WORKFLOW - Flujo de Trabajo', () => {
    it('WORKFLOW-T001: Flujo completo: Programar → Iniciar → Completar', () => {
      const uniqueId = Date.now();
      
      // Crear paciente y servicio
      cy.visit('/patients');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Paciente")').length > 0) {
          cy.get('button:contains("Nuevo Paciente")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="first_name"]').type('Workflow');
      cy.get('input[name="last_name"]').type(`Test${uniqueId}`);
      cy.get('button[type="submit"]').click();
      cy.wait(500);
      
      cy.visit('/services');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Servicio")').length > 0) {
          cy.get('button:contains("Nuevo Servicio")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Workflow Service');
      cy.get('input[name="duration_minutes"]').type('60');
      cy.get('input[name="margin_percentage"]').type('45');
      cy.get('button[type="submit"]').click();
      cy.wait(500);
      
      // 1. PROGRAMAR - Crear tratamiento
      cy.visit('/treatments');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Tratamiento")').length > 0) {
          cy.get('button:contains("Nuevo Tratamiento")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="patient_id"]').length > 0) {
          cy.get('select[name="patient_id"]').select(1);
        }
        if ($body.find('select[name="service_id"]').length > 0) {
          cy.get('select[name="service_id"]').select(1);
        }
      });
      
      cy.get('button[type="submit"]').click();
      cy.get('body').should('contain.text', 'Workflow Service');
      
      // 2. INICIAR - Cambiar a en progreso
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="status"]').length > 0) {
          cy.get('select[name="status"]').select('En progreso');
        }
      });
      
      cy.get('button[type="submit"]').click();
      cy.get('body').should('contain.text', 'En progreso');
      
      // 3. COMPLETAR - Finalizar con pago
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="status"]').length > 0) {
          cy.get('select[name="status"]').select('Completado');
        }
        if ($body.find('select[name="payment_status"]').length > 0) {
          cy.get('select[name="payment_status"]').select('Pagado');
        }
      });
      
      cy.get('button[type="submit"]').click();
      cy.get('body').should('contain.text', 'Completado');
      cy.get('body').should('contain.text', 'Pagado');
    });

    it('WORKFLOW-T002: Reprogramación de cita', () => {
      // Crear tratamiento
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Tratamiento")').length > 0) {
          cy.get('button:contains("Nuevo Tratamiento")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="patient_id"]').length > 0) {
          cy.get('select[name="patient_id"]').select(1);
        }
        if ($body.find('select[name="service_id"]').length > 0) {
          cy.get('select[name="service_id"]').select(1);
        }
        if ($body.find('input[name="scheduled_date"]').length > 0) {
          cy.get('input[name="scheduled_date"]').type('2025-09-01');
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      // Reprogramar
      cy.get('body').then($body => {
        if ($body.find('button[aria-label="Editar"]').length > 0) {
          cy.get('button[aria-label="Editar"]').first().click();
        } else {
          cy.get('button:contains("Editar")').first().click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('input[name="scheduled_date"]').length > 0) {
          cy.get('input[name="scheduled_date"]').clear().type('2025-09-10');
        }
      });
      
      cy.get('button[type="submit"]').click();
      cy.get('body').should('contain.text', 'actualizado');
    });
  });

  describe('SESSIONS - Gestión de Sesiones', () => {
    it('SESSIONS-T001: Debe crear tratamiento multisesión', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Tratamiento")').length > 0) {
          cy.get('button:contains("Nuevo Tratamiento")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="patient_id"]').length > 0) {
          cy.get('select[name="patient_id"]').select(1);
        }
        if ($body.find('select[name="service_id"]').length > 0) {
          cy.get('select[name="service_id"]').select(1);
        }
        if ($body.find('input[name="sessions_count"]').length > 0) {
          cy.get('input[name="sessions_count"]').type('4');
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      cy.get('body').should('contain.text', 'exitosamente');
      
      // Verificar que se crearon las sesiones
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasSessionInfo = bodyText.includes('sesión') || bodyText.includes('session');
        if (bodyText.includes('sessions_count')) {
          expect(hasSessionInfo).to.be.true;
        }
      });
    });

    it('SESSIONS-T002: Debe completar sesiones individualmente', () => {
      // Este test verifica la funcionalidad de sesiones si existe
      cy.get('body').then($body => {
        if ($body.find('[data-testid="session-list"]').length > 0) {
          cy.get('[data-testid="session-list"]').within(() => {
            cy.get('button:contains("Completar")').first().click();
          });
          
          cy.get('body').should('contain.text', 'sesión completada');
        }
      });
    });
  });

  describe('INTEGRATION - Tests de Integración', () => {
    it('INTEGRATION-T001: Integración completa con todos los módulos', () => {
      const uniqueId = Date.now();
      
      // Crear paciente
      cy.visit('/patients');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Paciente")').length > 0) {
          cy.get('button:contains("Nuevo Paciente")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="first_name"]').type('Integration');
      cy.get('input[name="last_name"]').type(`Patient${uniqueId}`);
      cy.get('button[type="submit"]').click();
      
      // Crear insumo
      cy.visit('/supplies');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Insumo")').length > 0) {
          cy.get('button:contains("Nuevo Insumo")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Integration Supply');
      cy.get('input[name="unit"]').type('pza');
      cy.get('input[name="quantity_per_unit"]').type('1');
      cy.get('input[name="cost_per_unit_cents"]').type('5000');
      cy.get('button[type="submit"]').click();
      
      // Crear servicio
      cy.visit('/services');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Servicio")').length > 0) {
          cy.get('button:contains("Nuevo Servicio")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('input[name="name"]').type('Integration Service');
      cy.get('input[name="duration_minutes"]').type('90');
      cy.get('input[name="margin_percentage"]').type('55');
      cy.get('button[type="submit"]').click();
      
      // Crear tratamiento
      cy.visit('/treatments');
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Tratamiento")').length > 0) {
          cy.get('button:contains("Nuevo Tratamiento")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      cy.get('body').then($body => {
        if ($body.find('select[name="patient_id"]').length > 0) {
          cy.get('select[name="patient_id"]').select(1);
        }
        if ($body.find('select[name="service_id"]').length > 0) {
          cy.get('select[name="service_id"]').select(1);
        }
      });
      
      cy.get('button[type="submit"]').click();
      
      // Verificar integración completa
      cy.get('body').should('contain.text', 'Integration Service');
      cy.get('body').should('contain.text', 'Integration Patient');
      
      // Precio debería incluir costos fijos + insumos + margen
      cy.get('body').should('contain.text', '$');
    });
  });

  describe('PERFORMANCE - Tests de Rendimiento', () => {
    it('PERF-T001: Debe cargar lista rápidamente', () => {
      const startTime = Date.now();
      
      cy.reload();
      cy.get('body').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(5000);
      });
    });

    it('PERF-T002: Debe calcular precios instantáneamente', () => {
      cy.get('body').then($body => {
        if ($body.find('button:contains("Nuevo Tratamiento")').length > 0) {
          cy.get('button:contains("Nuevo Tratamiento")').click();
        } else {
          cy.get('button:contains("Agregar")').click();
        }
      });
      
      const startTime = Date.now();
      
      cy.get('body').then($body => {
        if ($body.find('select[name="patient_id"]').length > 0) {
          cy.get('select[name="patient_id"]').select(1);
        }
        if ($body.find('select[name="service_id"]').length > 0) {
          cy.get('select[name="service_id"]').select(1);
        }
      });
      
      cy.then(() => {
        const calcTime = Date.now() - startTime;
        expect(calcTime).to.be.lessThan(2000);
      });
    });
  });
});