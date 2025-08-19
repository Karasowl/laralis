/**
 * TESTS CRUD ROBUSTOS - MÓDULO DE PACIENTES
 * Cobertura completa de operaciones CRUD con detección de errores
 */

describe('CRUD Robusto: Módulo de Pacientes', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/patients');
    cy.wait(1000);
  });

  describe('CREATE - Creación de Pacientes', () => {
    it('CREATE-P001: Debe crear paciente con datos mínimos requeridos', () => {
      cy.get('button').contains('Nuevo Paciente').click();
      
      const uniqueId = Date.now();
      cy.get('input[name="first_name"]').type('Test');
      cy.get('input[name="last_name"]').type(`Patient${uniqueId}`);
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificaciones
      cy.contains('Paciente creado exitosamente').should('be.visible');
      cy.contains(`Test Patient${uniqueId}`).should('be.visible');
      
      // Verificar en la lista
      cy.reload();
      cy.contains(`Test Patient${uniqueId}`).should('be.visible');
    });

    it('CREATE-P002: Debe crear paciente con todos los campos', () => {
      cy.get('button').contains('Nuevo Paciente').click();
      
      const uniqueId = Date.now();
      const patientData = {
        first_name: 'Carlos',
        last_name: `CompleteTest${uniqueId}`,
        email: `carlos.complete${uniqueId}@test.com`,
        phone: '5551234567',
        birth_date: '1990-05-15',
        first_visit_date: '2024-01-15',
        address: 'Av. Reforma 123, Col. Centro',
        city: 'Ciudad de México',
        postal_code: '06000',
        notes: 'Paciente VIP con historial completo',
        medical_history: 'Hipertensión controlada, alergia a penicilina'
      };
      
      // Llenar todos los campos
      Object.entries(patientData).forEach(([field, value]) => {
        if (field === 'notes' || field === 'medical_history') {
          cy.get(`textarea[name="${field}"]`).type(value);
        } else if (field === 'state') {
          cy.get(`select[name="${field}"]`).select(value);
        } else {
          cy.get(`input[name="${field}"]`).type(value);
        }
      });
      
      // Agregar género si está disponible
      cy.get('select[name="gender"]').then($select => {
        if ($select.length) {
          cy.wrap($select).select('male');
        }
      });
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificaciones completas
      cy.contains('Paciente creado exitosamente').should('be.visible');
      cy.contains(`Carlos CompleteTest${uniqueId}`).should('be.visible');
      cy.contains(patientData.email).should('be.visible');
      cy.contains(patientData.phone).should('be.visible');
    });

    it('CREATE-P003: Debe validar campos requeridos', () => {
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar mensajes de error
      cy.contains('El nombre es requerido').should('be.visible');
      cy.contains('El apellido es requerido').should('be.visible');
    });

    it('CREATE-P004: Debe validar formato de email', () => {
      cy.get('button').contains('Nuevo Paciente').click();
      
      cy.get('input[name="first_name"]').type('Email');
      cy.get('input[name="last_name"]').type('Test');
      cy.get('input[name="email"]').type('email-invalido');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Email inválido').should('be.visible');
    });

    it('CREATE-P005: Debe validar formato de teléfono', () => {
      cy.get('button').contains('Nuevo Paciente').click();
      
      cy.get('input[name="first_name"]').type('Phone');
      cy.get('input[name="last_name"]').type('Test');
      cy.get('input[name="phone"]').type('123');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Teléfono debe tener al menos 10 dígitos').should('be.visible');
    });

    it('CREATE-P006: Debe validar fecha de nacimiento no futura', () => {
      cy.get('button').contains('Nuevo Paciente').click();
      
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      cy.get('input[name="first_name"]').type('Future');
      cy.get('input[name="last_name"]').type('Date');
      cy.get('input[name="birth_date"]').type(futureDateStr);
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('La fecha de nacimiento no puede ser futura').should('be.visible');
    });

    it('CREATE-P007: Debe manejar errores de red al crear', () => {
      // Simular error de red
      cy.intercept('POST', '/api/patients', { forceNetworkError: true }).as('networkError');
      
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Network');
      cy.get('input[name="last_name"]').type('Error');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.wait('@networkError');
      
      // Verificar manejo del error
      cy.contains('Error de conexión').should('be.visible');
      cy.contains('Reintentar').should('be.visible');
    });

    it('CREATE-P008: Debe manejar errores del servidor al crear', () => {
      // Simular error 500 del servidor
      cy.intercept('POST', '/api/patients', { statusCode: 500 }).as('serverError');
      
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Server');
      cy.get('input[name="last_name"]').type('Error');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.wait('@serverError');
      
      cy.contains('Error del servidor').should('be.visible');
    });
  });

  describe('READ - Lectura y Listado de Pacientes', () => {
    beforeEach(() => {
      // Crear pacientes de prueba
      const testPatients = [
        { first: 'Ana', last: 'García', email: 'ana@test.com', phone: '5551111111' },
        { first: 'Luis', last: 'Martínez', email: 'luis@test.com', phone: '5552222222' },
        { first: 'Carmen', last: 'López', email: 'carmen@test.com', phone: '5553333333' }
      ];
      
      testPatients.forEach((patient, index) => {
        cy.get('button').contains('Nuevo Paciente').click();
        cy.get('input[name="first_name"]').type(patient.first);
        cy.get('input[name="last_name"]').type(patient.last);
        cy.get('input[name="email"]').type(patient.email);
        cy.get('input[name="phone"]').type(patient.phone);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('READ-P001: Debe mostrar lista de pacientes correctamente', () => {
      // Verificar que se muestran los pacientes
      cy.contains('Ana García').should('be.visible');
      cy.contains('Luis Martínez').should('be.visible');
      cy.contains('Carmen López').should('be.visible');
      
      // Verificar columnas de la tabla
      cy.get('th').contains('Nombre').should('be.visible');
      cy.get('th').contains('Email').should('be.visible');
      cy.get('th').contains('Teléfono').should('be.visible');
      cy.get('th').contains('Acciones').should('be.visible');
    });

    it('READ-P002: Debe buscar paciente por nombre', () => {
      cy.get('input[placeholder*="Buscar"]').type('Ana');
      cy.contains('Ana García').should('be.visible');
      cy.contains('Luis Martínez').should('not.exist');
    });

    it('READ-P003: Debe buscar paciente por apellido', () => {
      cy.get('input[placeholder*="Buscar"]').type('Martínez');
      cy.contains('Luis Martínez').should('be.visible');
      cy.contains('Ana García').should('not.exist');
    });

    it('READ-P004: Debe buscar paciente por email', () => {
      cy.get('input[placeholder*="Buscar"]').type('carmen@');
      cy.contains('Carmen López').should('be.visible');
      cy.contains('Ana García').should('not.exist');
    });

    it('READ-P005: Debe mostrar mensaje cuando no hay resultados', () => {
      cy.get('input[placeholder*="Buscar"]').type('NoExisteEsteNombre');
      cy.contains('No se encontraron pacientes').should('be.visible');
    });

    it('READ-P006: Debe manejar error al cargar pacientes', () => {
      // Simular error al cargar
      cy.intercept('GET', '/api/patients*', { statusCode: 500 }).as('loadError');
      
      cy.reload();
      cy.wait('@loadError');
      
      cy.contains('Error al cargar pacientes').should('be.visible');
      cy.contains('Reintentar').should('be.visible');
    });

    it('READ-P007: Debe mostrar skeleton loader mientras carga', () => {
      // Simular carga lenta
      cy.intercept('GET', '/api/patients*', (req) => {
        req.reply((res) => {
          res.delay(1000);
        });
      }).as('slowLoad');
      
      cy.reload();
      
      // Verificar skeleton
      cy.get('[data-cy="loading-skeleton"]').should('be.visible');
      cy.wait('@slowLoad');
      cy.get('[data-cy="loading-skeleton"]').should('not.exist');
    });

    it('READ-P008: Debe paginar correctamente', () => {
      // Crear más pacientes para probar paginación
      for (let i = 4; i <= 12; i++) {
        cy.get('button').contains('Nuevo Paciente').click();
        cy.get('input[name="first_name"]').type(`Pagina${i}`);
        cy.get('input[name="last_name"]').type('Test');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(300);
      }
      
      // Verificar paginación
      cy.get('tbody tr').should('have.length', 10);
      
      // Ir a siguiente página
      cy.get('button[aria-label="Siguiente página"]').click();
      cy.contains('Pagina11').should('be.visible');
    });
  });

  describe('UPDATE - Actualización de Pacientes', () => {
    beforeEach(() => {
      // Crear paciente para editar
      const uniqueId = Date.now();
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Editable');
      cy.get('input[name="last_name"]').type(`Patient${uniqueId}`);
      cy.get('input[name="email"]').type(`editable${uniqueId}@test.com`);
      cy.get('input[name="phone"]').type('5550000000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('UPDATE-P001: Debe cargar formulario con datos actuales', () => {
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Editar"]').click();
      
      // Verificar que los campos tienen los valores correctos
      cy.get('input[name="first_name"]').should('have.value', 'Editable');
      cy.get('input[name="phone"]').should('have.value', '5550000000');
    });

    it('UPDATE-P002: Debe actualizar nombre y apellido', () => {
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="first_name"]').clear().type('Updated');
      cy.get('input[name="last_name"]').clear().type('Name');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Paciente actualizado exitosamente').should('be.visible');
      cy.contains('Updated Name').should('be.visible');
    });

    it('UPDATE-P003: Debe actualizar email', () => {
      const newEmail = `updated${Date.now()}@test.com`;
      
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="email"]').clear().type(newEmail);
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Paciente actualizado exitosamente').should('be.visible');
      cy.contains(newEmail).should('be.visible');
    });

    it('UPDATE-P004: Debe actualizar información médica', () => {
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('textarea[name="medical_history"]').type('Hipertensión, Diabetes tipo 2');
      cy.get('textarea[name="notes"]').type('Paciente de alto riesgo');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Paciente actualizado exitosamente').should('be.visible');
    });

    it('UPDATE-P005: Debe validar datos al actualizar', () => {
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="email"]').clear().type('email-invalido');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Email inválido').should('be.visible');
    });

    it('UPDATE-P006: Debe cancelar edición sin guardar', () => {
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="first_name"]').clear().type('NoGuardado');
      cy.get('button').contains('Cancelar').click();
      
      // Verificar que no se guardaron los cambios
      cy.contains('Editable').should('be.visible');
      cy.contains('NoGuardado').should('not.exist');
    });

    it('UPDATE-P007: Debe manejar error al actualizar', () => {
      cy.intercept('PUT', '/api/patients/*', { statusCode: 500 }).as('updateError');
      
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="first_name"]').clear().type('ErrorTest');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.wait('@updateError');
      
      cy.contains('Error al actualizar').should('be.visible');
    });

    it('UPDATE-P008: Debe manejar conflictos de concurrencia', () => {
      // Simular que otro usuario modificó el registro
      cy.intercept('PUT', '/api/patients/*', { 
        statusCode: 409, 
        body: { error: 'El paciente fue modificado por otro usuario' } 
      }).as('conflictError');
      
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="first_name"]').clear().type('Conflict');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.wait('@conflictError');
      
      cy.contains('fue modificado por otro usuario').should('be.visible');
      cy.contains('Recargar').should('be.visible');
    });
  });

  describe('DELETE - Eliminación de Pacientes', () => {
    beforeEach(() => {
      // Crear paciente para eliminar
      const uniqueId = Date.now();
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('ToDelete');
      cy.get('input[name="last_name"]').type(`Patient${uniqueId}`);
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('DELETE-P001: Debe mostrar confirmación antes de eliminar', () => {
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Eliminar"]').click();
      
      // Verificar modal de confirmación
      cy.contains('¿Estás seguro?').should('be.visible');
      cy.contains('Esta acción no se puede deshacer').should('be.visible');
      cy.contains('Se eliminarán también todos los tratamientos asociados').should('be.visible');
    });

    it('DELETE-P002: Debe eliminar paciente al confirmar', () => {
      const patientName = cy.get('[data-cy="patient-row"]').first();
      patientName.invoke('text').then((text) => {
        const name = text.trim();
        
        cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Eliminar"]').click();
        cy.get('button').contains('Eliminar').click();
        
        cy.contains('Paciente eliminado exitosamente').should('be.visible');
        cy.contains(name).should('not.exist');
      });
    });

    it('DELETE-P003: Debe cancelar eliminación', () => {
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Cancelar').click();
      
      // Verificar que el paciente sigue existiendo
      cy.contains('ToDelete').should('be.visible');
    });

    it('DELETE-P004: Debe manejar error al eliminar', () => {
      cy.intercept('DELETE', '/api/patients/*', { statusCode: 500 }).as('deleteError');
      
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      cy.wait('@deleteError');
      
      cy.contains('Error al eliminar').should('be.visible');
    });

    it('DELETE-P005: Debe prevenir eliminación si tiene tratamientos activos', () => {
      // Simular paciente con tratamientos activos
      cy.intercept('DELETE', '/api/patients/*', { 
        statusCode: 409,
        body: { error: 'No se puede eliminar paciente con tratamientos activos' }
      }).as('treatmentConflict');
      
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      cy.wait('@treatmentConflict');
      
      cy.contains('tratamientos activos').should('be.visible');
    });

    it('DELETE-P006: Debe confirmar eliminación múltiple', () => {
      // Crear más pacientes
      for (let i = 1; i <= 3; i++) {
        cy.get('button').contains('Nuevo Paciente').click();
        cy.get('input[name="first_name"]').type(`Multi${i}`);
        cy.get('input[name="last_name"]').type('Delete');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      }
      
      // Seleccionar múltiples
      cy.get('input[type="checkbox"]').eq(1).check();
      cy.get('input[type="checkbox"]').eq(2).check();
      
      // Eliminar seleccionados
      cy.get('button').contains('Eliminar seleccionados').click();
      
      cy.contains('¿Eliminar 2 pacientes?').should('be.visible');
      cy.get('button').contains('Eliminar').click();
      
      cy.contains('2 pacientes eliminados').should('be.visible');
    });
  });

  describe('INTEGRACIÓN - Tests de Integración CRUD', () => {
    it('INTEGRATION-P001: Debe mantener consistencia CRUD completa', () => {
      const uniqueId = Date.now();
      const patientData = {
        first: 'Integration',
        last: `Test${uniqueId}`,
        email: `integration${uniqueId}@test.com`,
        phone: '5559999999'
      };
      
      // CREATE
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type(patientData.first);
      cy.get('input[name="last_name"]').type(patientData.last);
      cy.get('input[name="email"]').type(patientData.email);
      cy.get('input[name="phone"]').type(patientData.phone);
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // READ - Verificar en lista
      cy.contains(`${patientData.first} ${patientData.last}`).should('be.visible');
      
      // UPDATE
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Editar"]').click();
      cy.get('input[name="first_name"]').clear().type('Modified');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // READ - Verificar cambio
      cy.contains(`Modified ${patientData.last}`).should('be.visible');
      
      // DELETE
      cy.get('[data-cy="patient-row"]').first().find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      // READ - Verificar eliminación
      cy.contains(`Modified ${patientData.last}`).should('not.exist');
    });

    it('INTEGRATION-P002: Debe sincronizar con otros módulos', () => {
      // Crear paciente
      const uniqueId = Date.now();
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Sync');
      cy.get('input[name="last_name"]').type(`Patient${uniqueId}`);
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Verificar que aparece en tratamientos
      cy.visit('/treatments');
      cy.get('button').contains('Nuevo Tratamiento').click();
      cy.get('select[name="patient_id"]').should('contain', `Sync Patient${uniqueId}`);
    });

    it('INTEGRATION-P003: Debe mantener integridad referencial', () => {
      // Crear paciente con referido
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Referrer');
      cy.get('input[name="last_name"]').type('Patient');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Crear paciente referido
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Referred');
      cy.get('input[name="last_name"]').type('Patient');
      cy.get('select[name="source_type"]').select('referral');
      cy.get('select[name="referred_by_patient_id"]').select('Referrer Patient');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Intentar eliminar paciente que refiere
      cy.get('tr').contains('Referrer Patient').find('button[aria-label="Eliminar"]').click();
      cy.get('button').contains('Eliminar').click();
      
      // Debería mostrar advertencia sobre integridad referencial
      cy.contains('otros pacientes lo referencian').should('be.visible');
    });
  });

  describe('PERFORMANCE - Tests de Rendimiento', () => {
    it('PERF-P001: Debe cargar lista rápidamente', () => {
      const startTime = Date.now();
      
      cy.reload();
      cy.get('table').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(3000); // Menos de 3 segundos
      });
    });

    it('PERF-P002: Debe buscar sin delay perceptible', () => {
      // Crear varios pacientes
      for (let i = 1; i <= 10; i++) {
        cy.get('button').contains('Nuevo Paciente').click();
        cy.get('input[name="first_name"]').type(`Perf${i}`);
        cy.get('input[name="last_name"]').type('Test');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(200);
      }
      
      const startTime = Date.now();
      
      cy.get('input[placeholder*="Buscar"]').type('Perf5');
      cy.contains('Perf5 Test').should('be.visible');
      
      cy.then(() => {
        const searchTime = Date.now() - startTime;
        expect(searchTime).to.be.lessThan(1000); // Menos de 1 segundo
      });
    });

    it('PERF-P003: Debe manejar grandes volúmenes de datos', () => {
      // Simular respuesta con muchos registros
      cy.intercept('GET', '/api/patients*', { 
        fixture: 'large-patient-dataset.json' 
      }).as('largeDataset');
      
      cy.reload();
      cy.wait('@largeDataset');
      
      // Verificar que sigue siendo responsive
      cy.get('table').should('be.visible');
      cy.get('input[placeholder*="Buscar"]').should('be.visible');
      cy.get('button').contains('Nuevo Paciente').should('be.visible');
    });
  });
});

// Comandos personalizados para este módulo
Cypress.Commands.add('createTestPatient', (data) => {
  cy.get('button').contains('Nuevo Paciente').click();
  cy.get('input[name="first_name"]').type(data.firstName);
  cy.get('input[name="last_name"]').type(data.lastName);
  if (data.email) cy.get('input[name="email"]').type(data.email);
  if (data.phone) cy.get('input[name="phone"]').type(data.phone);
  cy.get('button[type="submit"]').contains('Guardar').click();
  cy.wait(500);
});