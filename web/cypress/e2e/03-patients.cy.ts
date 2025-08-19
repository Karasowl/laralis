describe('Patient Management Module', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/patients');
    cy.wait(1000);
  });

  describe('Patient Listing and Navigation', () => {
    it('should display patients page correctly', () => {
      // Verificar elementos básicos de la página
      cy.contains('Pacientes').should('be.visible');
      cy.get('[data-cy="add-patient-button"]').or('button:contains("Agregar")').should('be.visible');
      
      // Verificar tabla o lista de pacientes
      cy.get('[data-cy="patients-table"]').or('[data-cy="patients-list"]').should('exist');
    });

    it('should show empty state when no patients exist', () => {
      // Si no hay pacientes, debe mostrar empty state
      cy.get('body').then($body => {
        if ($body.find('[data-cy="empty-state"]').length > 0) {
          cy.get('[data-cy="empty-state"]').should('be.visible');
          cy.contains('pacientes').should('be.visible');
          cy.contains('Agregar').should('be.visible');
        }
      });
    });

    it('should have functional search and filters', () => {
      // Buscar campo de búsqueda
      cy.get('input[placeholder*="Buscar"]').or('input[type="search"]').then($search => {
        if ($search.length > 0) {
          cy.wrap($search).type('Juan');
          cy.wait(500);
          // Verificar que se filtren los resultados
          cy.get('[data-cy="patient-row"]').should('have.length.lessThan', 10);
        }
      });
    });
  });

  describe('Patient Creation', () => {
    it('should create a new patient with basic information', () => {
      // Hacer clic en agregar paciente
      cy.contains('button', 'Agregar').or('[data-cy="add-patient-button"]').click();
      
      // Verificar que se abre el formulario
      cy.get('[data-cy="patient-form"]').or('form').should('be.visible');
      
      // Llenar información básica
      const testPatient = {
        first_name: 'Juan Carlos',
        last_name: 'Pérez García',
        email: `test.patient.${Date.now()}@example.com`,
        phone: '+52 555-123-4567'
      };
      
      cy.fillPatientForm(testPatient);
      
      // Guardar paciente
      cy.contains('button', 'Guardar').or('button', 'Crear').click();
      
      // Verificar que se creó exitosamente
      cy.contains('exitoso').or('creado').should('be.visible');
      cy.contains(testPatient.first_name).should('be.visible');
    });

    it('should validate required fields', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Intentar guardar sin llenar campos requeridos
      cy.contains('button', 'Guardar').or('button', 'Crear').click();
      
      // Verificar mensajes de validación
      cy.contains('requerido').or('required').should('be.visible');
    });

    it('should validate email format', () => {
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Llenar con email inválido
      cy.get('input[name="first_name"]').type('Test');
      cy.get('input[name="last_name"]').type('User');
      cy.get('input[name="email"]').type('invalid-email');
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar validación de email
      cy.contains('válido').or('valid').should('be.visible');
    });

    it('should handle duplicate email validation', () => {
      // Crear primer paciente
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      const duplicateEmail = `duplicate.${Date.now()}@test.com`;
      
      cy.fillPatientForm({
        first_name: 'Primer',
        last_name: 'Paciente',
        email: duplicateEmail
      });
      
      cy.contains('button', 'Guardar').click();
      cy.wait(1000);
      
      // Intentar crear segundo paciente con mismo email
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      cy.fillPatientForm({
        first_name: 'Segundo',
        last_name: 'Paciente',
        email: duplicateEmail
      });
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar mensaje de email duplicado
      cy.contains('existe').or('duplicate').should('be.visible');
    });
  });

  describe('Patient Information Management', () => {
    beforeEach(() => {
      // Crear un paciente de prueba para estas pruebas
      cy.get('body').then($body => {
        if ($body.find('[data-cy="patient-row"]').length === 0) {
          cy.contains('button', 'Agregar').click();
          cy.fillPatientForm({
            first_name: 'María',
            last_name: 'González',
            email: `maria.gonzalez.${Date.now()}@test.com`,
            phone: '+52 555-987-6543'
          });
          cy.contains('button', 'Guardar').click();
          cy.wait(1000);
        }
      });
    });

    it('should view patient details', () => {
      // Hacer clic en un paciente para ver detalles
      cy.get('[data-cy="patient-row"]').first().click()
        .or(() => cy.get('[data-cy="view-patient"]').first().click());
      
      // Verificar que se muestra información del paciente
      cy.contains('María').or('González').should('be.visible');
      cy.get('[data-cy="patient-details"]').should('be.visible');
    });

    it('should edit patient information', () => {
      // Hacer clic en editar
      cy.get('[data-cy="edit-patient"]').first().click()
        .or(() => {
          cy.get('[data-cy="patient-row"]').first().click();
          cy.contains('button', 'Editar').click();
        });
      
      // Modificar información
      cy.get('input[name="phone"]').clear().type('+52 555-111-2222');
      
      // Guardar cambios
      cy.contains('button', 'Guardar').or('button', 'Actualizar').click();
      
      // Verificar que se guardaron los cambios
      cy.contains('actualizado').or('guardado').should('be.visible');
    });

    it('should delete patient with confirmation', () => {
      // Contar pacientes iniciales
      cy.get('[data-cy="patient-row"]').then($rows => {
        const initialCount = $rows.length;
        
        // Eliminar paciente
        cy.get('[data-cy="delete-patient"]').first().click()
          .or(() => {
            cy.get('[data-cy="patient-actions"]').first().click();
            cy.contains('Eliminar').click();
          });
        
        // Confirmar eliminación
        cy.contains('button', 'Confirmar').or('button', 'Eliminar').click();
        
        // Verificar que se eliminó
        cy.contains('eliminado').should('be.visible');
        cy.get('[data-cy="patient-row"]').should('have.length', initialCount - 1);
      });
    });
  });

  describe('Patient Medical History', () => {
    beforeEach(() => {
      // Asegurar que hay un paciente y navegar a su historial
      cy.get('[data-cy="patient-row"]').first().click()
        .or(() => cy.contains('María').click());
      
      cy.contains('Historial').or('Historia').click();
    });

    it('should display medical history section', () => {
      cy.get('[data-cy="medical-history"]').should('be.visible');
      cy.contains('Historial médico').or('Medical history').should('be.visible');
    });

    it('should add medical notes', () => {
      cy.contains('button', 'Agregar nota').or('button', 'Nueva nota').click();
      
      cy.get('textarea[name="notes"]').type('Paciente presenta sensibilidad dental en molar superior derecho');
      cy.get('select[name="category"]').select('consultation');
      
      cy.contains('button', 'Guardar').click();
      
      // Verificar que se agregó la nota
      cy.contains('sensibilidad dental').should('be.visible');
    });

    it('should track treatment history', () => {
      // Verificar sección de tratamientos
      cy.get('[data-cy="treatment-history"]').should('be.visible');
      cy.contains('Tratamientos').should('be.visible');
    });
  });

  describe('Patient Search and Filtering', () => {
    it('should search patients by name', () => {
      cy.get('input[placeholder*="Buscar"]').type('María');
      cy.wait(500);
      
      // Verificar que solo se muestran pacientes que coinciden
      cy.get('[data-cy="patient-row"]').each($row => {
        cy.wrap($row).should('contain.text', 'María');
      });
    });

    it('should search patients by email', () => {
      cy.get('input[placeholder*="Buscar"]').type('@test.com');
      cy.wait(500);
      
      // Verificar que se filtran por email
      cy.get('[data-cy="patient-row"]').should('have.length.greaterThan', 0);
    });

    it('should filter by patient status', () => {
      // Si hay filtros de estado
      cy.get('body').then($body => {
        if ($body.find('[data-cy="status-filter"]').length > 0) {
          cy.get('[data-cy="status-filter"]').select('active');
          cy.wait(500);
          
          // Verificar filtrado
          cy.get('[data-cy="patient-row"]').should('exist');
        }
      });
    });
  });

  describe('Patient Appointments', () => {
    beforeEach(() => {
      cy.get('[data-cy="patient-row"]').first().click();
      cy.contains('Citas').or('Appointments').click();
    });

    it('should display appointment calendar', () => {
      cy.get('[data-cy="appointment-calendar"]').should('be.visible');
    });

    it('should schedule new appointment', () => {
      cy.contains('button', 'Nueva cita').or('button', 'Agendar').click();
      
      // Llenar formulario de cita
      cy.get('input[name="date"]').type('2024-12-25');
      cy.get('input[name="time"]').type('10:00');
      cy.get('select[name="service"]').select(0); // Primer servicio disponible
      
      cy.contains('button', 'Agendar').click();
      
      // Verificar que se agendó
      cy.contains('agendada').or('scheduled').should('be.visible');
    });
  });

  describe('Patient Data Export', () => {
    it('should export patient list to CSV', () => {
      cy.get('[data-cy="export-button"]').click()
        .or(() => cy.contains('Exportar').click());
      
      cy.contains('CSV').click();
      
      // Verificar que se inició la descarga
      cy.contains('descarga').or('download').should('be.visible');
    });
  });

  describe('Patient Module Performance', () => {
    it('should load patient list quickly', () => {
      const startTime = Date.now();
      
      cy.visit('/patients');
      cy.get('[data-cy="patients-table"]').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(3000); // Menos de 3 segundos
      });
    });

    it('should handle large patient lists efficiently', () => {
      // Simular muchos pacientes mediante scroll infinito
      cy.get('[data-cy="patients-table"]').scrollTo('bottom');
      cy.wait(1000);
      
      // Verificar que sigue siendo responsivo
      cy.get('input[placeholder*="Buscar"]').type('test');
      cy.get('[data-cy="patient-row"]').should('be.visible');
    });
  });

  describe('Accessibility', () => {
    it('should be navigable with keyboard', () => {
      // Verificar navegación con Tab
      cy.get('body').tab();
      cy.focused().should('be.visible');
      
      // Continuar navegando
      cy.focused().tab().tab();
      cy.focused().should('be.visible');
    });

    it('should have proper ARIA labels', () => {
      cy.get('[data-cy="patients-table"]').should('have.attr', 'role');
      cy.get('button').should('have.attr', 'aria-label').or('not.have.attr', 'disabled');
    });

    it('should support screen readers', () => {
      // Verificar etiquetas para lectores de pantalla
      cy.get('h1').should('contain.text', 'Pacientes');
      cy.get('table').should('have.attr', 'role', 'table')
        .or('have.attr', 'aria-label');
    });
  });
});