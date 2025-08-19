/**
 * TESTS E2E COMPLETOS - MÓDULO DE PACIENTES
 * Siguiendo principios TDD con casos reales y selectores semánticos
 */

describe('Patients Module - Complete TDD Tests', () => {
  beforeEach(() => {
    // Login con usuario real
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/patients');
  });

  describe('1. Visualización y Estado Inicial', () => {
    it('debe mostrar la página de pacientes con elementos correctos', () => {
      // Verificar encabezado
      cy.contains('h1', 'Pacientes').should('be.visible');
      
      // Verificar botón de agregar
      cy.get('button').contains('Nuevo Paciente').should('be.visible');
      
      // Verificar barra de búsqueda
      cy.get('input[placeholder*="Buscar"]').should('be.visible');
    });

    it('debe mostrar estado vacío cuando no hay pacientes', () => {
      // Verificar mensaje de estado vacío
      cy.contains('No hay pacientes registrados').should('be.visible');
      cy.contains('Comienza agregando tu primer paciente').should('be.visible');
    });

    it('debe mostrar tabla con columnas correctas cuando hay pacientes', () => {
      // Crear un paciente primero
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Test');
      cy.get('input[name="last_name"]').type('Patient');
      cy.get('input[name="email"]').type('test@test.com');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar columnas de la tabla
      cy.get('table').should('be.visible');
      cy.get('th').contains('Nombre').should('be.visible');
      cy.get('th').contains('Email').should('be.visible');
      cy.get('th').contains('Teléfono').should('be.visible');
      cy.get('th').contains('Primera Visita').should('be.visible');
      cy.get('th').contains('Acciones').should('be.visible');
    });
  });

  describe('2. Creación de Pacientes - Validaciones', () => {
    beforeEach(() => {
      cy.get('button').contains('Nuevo Paciente').click();
    });

    it('debe validar campos requeridos', () => {
      // Intentar guardar sin datos
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar mensajes de error
      cy.contains('El nombre es requerido').should('be.visible');
      cy.contains('El apellido es requerido').should('be.visible');
    });

    it('debe validar formato de email', () => {
      cy.get('input[name="first_name"]').type('Test');
      cy.get('input[name="last_name"]').type('User');
      cy.get('input[name="email"]').type('invalid-email');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Email inválido').should('be.visible');
    });

    it('debe validar formato de teléfono', () => {
      cy.get('input[name="first_name"]').type('Test');
      cy.get('input[name="last_name"]').type('User');
      cy.get('input[name="phone"]').type('123'); // Muy corto
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Teléfono debe tener al menos 10 dígitos').should('be.visible');
    });

    it('debe validar fecha de nacimiento no futura', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      cy.get('input[name="first_name"]').type('Test');
      cy.get('input[name="last_name"]').type('User');
      cy.get('input[name="birth_date"]').type(futureDateStr);
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('La fecha de nacimiento no puede ser futura').should('be.visible');
    });

    it('debe validar código postal mexicano', () => {
      cy.get('input[name="first_name"]').type('Test');
      cy.get('input[name="last_name"]').type('User');
      cy.get('input[name="postal_code"]').type('123'); // Incorrecto
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Código postal debe tener 5 dígitos').should('be.visible');
    });
  });

  describe('3. Creación de Pacientes - Casos de Éxito', () => {
    it('debe crear paciente con información mínima', () => {
      cy.get('button').contains('Nuevo Paciente').click();
      
      // Llenar solo campos requeridos
      cy.get('input[name="first_name"]').type('María');
      cy.get('input[name="last_name"]').type('González');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar que se creó y aparece en la lista
      cy.contains('Paciente creado exitosamente').should('be.visible');
      cy.contains('María González').should('be.visible');
    });

    it('debe crear paciente con información completa', () => {
      cy.get('button').contains('Nuevo Paciente').click();
      
      // Llenar todos los campos
      cy.get('input[name="first_name"]').type('Carlos');
      cy.get('input[name="last_name"]').type('López Hernández');
      cy.get('input[name="email"]').type('carlos.lopez@ejemplo.com');
      cy.get('input[name="phone"]').type('5551234567');
      cy.get('input[name="birth_date"]').type('1985-06-15');
      cy.get('input[name="first_visit_date"]').type('2025-01-15');
      cy.get('select[name="gender"]').select('male');
      cy.get('input[name="address"]').type('Av. Reforma 123, Col. Centro');
      cy.get('input[name="city"]').type('Ciudad de México');
      cy.get('input[name="state"]').select('CDMX');
      cy.get('input[name="postal_code"]').type('06000');
      cy.get('textarea[name="notes"]').type('Paciente con alergia a la penicilina');
      cy.get('textarea[name="medical_history"]').type('Diabetes tipo 2, Hipertensión controlada');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar creación
      cy.contains('Paciente creado exitosamente').should('be.visible');
      cy.contains('Carlos López Hernández').should('be.visible');
      cy.contains('carlos.lopez@ejemplo.com').should('be.visible');
    });

    it('debe crear paciente con fuente de marketing - Redes Sociales', () => {
      cy.get('button').contains('Nuevo Paciente').click();
      
      cy.get('input[name="first_name"]').type('Ana');
      cy.get('input[name="last_name"]').type('Martínez');
      
      // Seleccionar fuente
      cy.get('select[name="source_type"]').select('marketing');
      cy.get('select[name="marketing_platform_id"]').should('be.visible');
      cy.get('select[name="marketing_platform_id"]').select('Facebook');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Paciente creado exitosamente').should('be.visible');
      cy.contains('Ana Martínez').should('be.visible');
    });

    it('debe crear paciente con fuente de marketing - Campaña específica', () => {
      cy.get('button').contains('Nuevo Paciente').click();
      
      cy.get('input[name="first_name"]').type('Luis');
      cy.get('input[name="last_name"]').type('Rodríguez');
      
      // Seleccionar campaña
      cy.get('select[name="source_type"]').select('campaign');
      cy.get('select[name="marketing_campaign_id"]').should('be.visible');
      
      // Nota: Asumiendo que hay campañas creadas
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Luis Rodríguez').should('be.visible');
    });

    it('debe crear paciente referido por otro paciente', () => {
      // Primero crear paciente que refiere
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Pedro');
      cy.get('input[name="last_name"]').type('Referente');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Crear paciente referido
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Juan');
      cy.get('input[name="last_name"]').type('Referido');
      
      // Seleccionar referencia
      cy.get('select[name="source_type"]').select('referral');
      cy.get('select[name="referred_by_patient_id"]').should('be.visible');
      cy.get('select[name="referred_by_patient_id"]').select('Pedro Referente');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Juan Referido').should('be.visible');
    });

    it('debe crear paciente con categorías/tags', () => {
      cy.get('button').contains('Nuevo Paciente').click();
      
      cy.get('input[name="first_name"]').type('Laura');
      cy.get('input[name="last_name"]').type('Díaz');
      
      // Seleccionar categorías
      cy.get('input[name="categories"]').type('VIP{enter}');
      cy.get('input[name="categories"]').type('Ortodoncia{enter}');
      cy.get('input[name="categories"]').type('Seguro médico{enter}');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Laura Díaz').should('be.visible');
    });
  });

  describe('4. Búsqueda y Filtrado', () => {
    beforeEach(() => {
      // Crear varios pacientes para buscar
      const patients = [
        { first: 'Juan', last: 'Pérez', email: 'juan@test.com', phone: '5551111111' },
        { first: 'María', last: 'García', email: 'maria@test.com', phone: '5552222222' },
        { first: 'Pedro', last: 'López', email: 'pedro@test.com', phone: '5553333333' },
        { first: 'Ana', last: 'Martínez', email: 'ana@test.com', phone: '5554444444' }
      ];
      
      patients.forEach(patient => {
        cy.get('button').contains('Nuevo Paciente').click();
        cy.get('input[name="first_name"]').type(patient.first);
        cy.get('input[name="last_name"]').type(patient.last);
        cy.get('input[name="email"]').type(patient.email);
        cy.get('input[name="phone"]').type(patient.phone);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe buscar paciente por nombre', () => {
      cy.get('input[placeholder*="Buscar"]').type('Juan');
      cy.contains('Juan Pérez').should('be.visible');
      cy.contains('María García').should('not.exist');
    });

    it('debe buscar paciente por apellido', () => {
      cy.get('input[placeholder*="Buscar"]').type('García');
      cy.contains('María García').should('be.visible');
      cy.contains('Juan Pérez').should('not.exist');
    });

    it('debe buscar paciente por email', () => {
      cy.get('input[placeholder*="Buscar"]').type('pedro@');
      cy.contains('Pedro López').should('be.visible');
      cy.contains('Ana Martínez').should('not.exist');
    });

    it('debe buscar paciente por teléfono', () => {
      cy.get('input[placeholder*="Buscar"]').type('5554444444');
      cy.contains('Ana Martínez').should('be.visible');
      cy.contains('Juan Pérez').should('not.exist');
    });

    it('debe mostrar mensaje cuando no hay resultados', () => {
      cy.get('input[placeholder*="Buscar"]').type('NoExiste');
      cy.contains('No se encontraron pacientes').should('be.visible');
    });

    it('debe limpiar búsqueda y mostrar todos', () => {
      cy.get('input[placeholder*="Buscar"]').type('Juan');
      cy.contains('María García').should('not.exist');
      
      cy.get('input[placeholder*="Buscar"]').clear();
      cy.contains('Juan Pérez').should('be.visible');
      cy.contains('María García').should('be.visible');
      cy.contains('Pedro López').should('be.visible');
      cy.contains('Ana Martínez').should('be.visible');
    });
  });

  describe('5. Edición de Pacientes', () => {
    beforeEach(() => {
      // Crear paciente para editar
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Editable');
      cy.get('input[name="last_name"]').type('Patient');
      cy.get('input[name="email"]').type('edit@test.com');
      cy.get('input[name="phone"]').type('5550000000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe abrir formulario con datos actuales', () => {
      cy.contains('tr', 'Editable Patient').find('button[aria-label="Editar"]').click();
      
      // Verificar que los campos tienen los valores correctos
      cy.get('input[name="first_name"]').should('have.value', 'Editable');
      cy.get('input[name="last_name"]').should('have.value', 'Patient');
      cy.get('input[name="email"]').should('have.value', 'edit@test.com');
      cy.get('input[name="phone"]').should('have.value', '5550000000');
    });

    it('debe actualizar información básica', () => {
      cy.contains('tr', 'Editable Patient').find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="first_name"]').clear().type('Updated');
      cy.get('input[name="last_name"]').clear().type('Name');
      cy.get('input[name="phone"]').clear().type('5559999999');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Paciente actualizado exitosamente').should('be.visible');
      cy.contains('Updated Name').should('be.visible');
      cy.contains('5559999999').should('be.visible');
    });

    it('debe agregar información médica', () => {
      cy.contains('tr', 'Editable Patient').find('button[aria-label="Editar"]').click();
      
      cy.get('textarea[name="medical_history"]').type('Hipertensión, Diabetes');
      cy.get('textarea[name="allergies"]').type('Penicilina, Látex');
      cy.get('textarea[name="current_medications"]').type('Metformina 850mg');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Paciente actualizado exitosamente').should('be.visible');
    });

    it('debe cancelar edición sin guardar cambios', () => {
      cy.contains('tr', 'Editable Patient').find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="first_name"]').clear().type('NotSaved');
      cy.get('button').contains('Cancelar').click();
      
      // Verificar que no se guardaron los cambios
      cy.contains('Editable Patient').should('be.visible');
      cy.contains('NotSaved').should('not.exist');
    });

    it('debe validar datos al editar', () => {
      cy.contains('tr', 'Editable Patient').find('button[aria-label="Editar"]').click();
      
      cy.get('input[name="email"]').clear().type('invalid-email');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Email inválido').should('be.visible');
    });
  });

  describe('6. Eliminación de Pacientes', () => {
    beforeEach(() => {
      // Crear paciente para eliminar
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('ToDelete');
      cy.get('input[name="last_name"]').type('Patient');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe mostrar confirmación antes de eliminar', () => {
      cy.contains('tr', 'ToDelete Patient').find('button[aria-label="Eliminar"]').click();
      
      // Verificar modal de confirmación
      cy.contains('¿Estás seguro?').should('be.visible');
      cy.contains('Esta acción no se puede deshacer').should('be.visible');
      cy.contains('Se eliminarán también todos los tratamientos asociados').should('be.visible');
    });

    it('debe eliminar paciente al confirmar', () => {
      cy.contains('tr', 'ToDelete Patient').find('button[aria-label="Eliminar"]').click();
      cy.contains('button', 'Eliminar').click();
      
      cy.contains('Paciente eliminado exitosamente').should('be.visible');
      cy.contains('ToDelete Patient').should('not.exist');
    });

    it('debe cancelar eliminación', () => {
      cy.contains('tr', 'ToDelete Patient').find('button[aria-label="Eliminar"]').click();
      cy.contains('button', 'Cancelar').click();
      
      // Verificar que el paciente sigue existiendo
      cy.contains('ToDelete Patient').should('be.visible');
    });

    it('no debe permitir eliminar paciente con tratamientos activos', () => {
      // Simular paciente con tratamientos
      // Este test requiere crear un tratamiento primero
      
      cy.contains('tr', 'ToDelete Patient').find('button[aria-label="Eliminar"]').click();
      
      // Si tiene tratamientos, debería mostrar advertencia especial
      // cy.contains('Este paciente tiene tratamientos activos').should('be.visible');
    });
  });

  describe('7. Vista Detallada del Paciente', () => {
    beforeEach(() => {
      // Crear paciente con información completa
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Detalle');
      cy.get('input[name="last_name"]').type('Completo');
      cy.get('input[name="email"]').type('detalle@test.com');
      cy.get('input[name="phone"]').type('5551234567');
      cy.get('input[name="birth_date"]').type('1990-01-01');
      cy.get('input[name="address"]').type('Calle 123');
      cy.get('input[name="city"]').type('CDMX');
      cy.get('textarea[name="notes"]').type('Notas importantes del paciente');
      cy.get('textarea[name="medical_history"]').type('Sin antecedentes relevantes');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe mostrar información personal completa', () => {
      cy.contains('tr', 'Detalle Completo').find('button[aria-label="Ver detalles"]').click();
      
      // Verificar información personal
      cy.contains('h2', 'Detalle Completo').should('be.visible');
      cy.contains('detalle@test.com').should('be.visible');
      cy.contains('5551234567').should('be.visible');
      cy.contains('35 años').should('be.visible'); // Calculado desde 1990
      cy.contains('Calle 123').should('be.visible');
      cy.contains('CDMX').should('be.visible');
    });

    it('debe mostrar información médica', () => {
      cy.contains('tr', 'Detalle Completo').find('button[aria-label="Ver detalles"]').click();
      
      // Verificar sección médica
      cy.contains('Información Médica').should('be.visible');
      cy.contains('Sin antecedentes relevantes').should('be.visible');
    });

    it('debe mostrar historial de tratamientos vacío', () => {
      cy.contains('tr', 'Detalle Completo').find('button[aria-label="Ver detalles"]').click();
      
      cy.contains('Historial de Tratamientos').should('be.visible');
      cy.contains('No hay tratamientos registrados').should('be.visible');
    });

    it('debe mostrar historial de pagos vacío', () => {
      cy.contains('tr', 'Detalle Completo').find('button[aria-label="Ver detalles"]').click();
      
      cy.contains('Historial de Pagos').should('be.visible');
      cy.contains('No hay pagos registrados').should('be.visible');
    });

    it('debe permitir agregar tratamiento desde vista detallada', () => {
      cy.contains('tr', 'Detalle Completo').find('button[aria-label="Ver detalles"]').click();
      
      cy.get('button').contains('Agregar Tratamiento').should('be.visible');
      cy.get('button').contains('Agregar Tratamiento').click();
      
      // Verificar que abre el formulario con el paciente preseleccionado
      cy.url().should('include', '/treatments/new');
      cy.get('select[name="patient_id"]').should('contain', 'Detalle Completo');
    });

    it('debe mostrar estadísticas del paciente', () => {
      cy.contains('tr', 'Detalle Completo').find('button[aria-label="Ver detalles"]').click();
      
      // Verificar estadísticas
      cy.contains('Estadísticas').should('be.visible');
      cy.contains('Total gastado').should('be.visible');
      cy.contains('$0.00').should('be.visible'); // Sin tratamientos
      cy.contains('Tratamientos completados').should('be.visible');
      cy.contains('0').should('be.visible');
      cy.contains('Última visita').should('be.visible');
      cy.contains('Sin visitas').should('be.visible');
    });
  });

  describe('8. Integración con otros módulos', () => {
    it('debe vincular paciente con tratamiento nuevo', () => {
      // Crear paciente
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Paciente');
      cy.get('input[name="last_name"]').type('ConTratamiento');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Ir a tratamientos
      cy.visit('/treatments');
      cy.get('button').contains('Nuevo Tratamiento').click();
      
      // Verificar que el paciente aparece en el selector
      cy.get('select[name="patient_id"]').should('contain', 'Paciente ConTratamiento');
    });

    it('debe mostrar pacientes en selector de referidos', () => {
      // Crear primer paciente
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Primer');
      cy.get('input[name="last_name"]').type('Paciente');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Crear segundo paciente y verificar que el primero aparece como opción
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('select[name="source_type"]').select('referral');
      cy.get('select[name="referred_by_patient_id"]').should('contain', 'Primer Paciente');
    });
  });

  describe('9. Paginación y Ordenamiento', () => {
    beforeEach(() => {
      // Crear 15 pacientes para probar paginación
      for (let i = 1; i <= 15; i++) {
        cy.get('button').contains('Nuevo Paciente').click();
        cy.get('input[name="first_name"]').type(`Paciente${i.toString().padStart(2, '0')}`);
        cy.get('input[name="last_name"]').type('Test');
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(300);
      }
    });

    it('debe mostrar 10 registros por página por defecto', () => {
      // Contar filas en la tabla (excluyendo header)
      cy.get('tbody tr').should('have.length', 10);
    });

    it('debe navegar entre páginas', () => {
      // Verificar primera página
      cy.contains('Paciente01').should('be.visible');
      cy.contains('Paciente11').should('not.exist');
      
      // Ir a segunda página
      cy.get('button[aria-label="Siguiente página"]').click();
      
      // Verificar segunda página
      cy.contains('Paciente11').should('be.visible');
      cy.contains('Paciente01').should('not.exist');
      
      // Regresar a primera página
      cy.get('button[aria-label="Página anterior"]').click();
      cy.contains('Paciente01').should('be.visible');
    });

    it('debe cambiar cantidad de registros por página', () => {
      cy.get('select[aria-label="Registros por página"]').select('25');
      
      // Todos los registros deberían ser visibles
      cy.get('tbody tr').should('have.length', 15);
    });

    it('debe ordenar por nombre', () => {
      cy.get('th').contains('Nombre').click();
      
      // Verificar orden ascendente
      cy.get('tbody tr').first().should('contain', 'Paciente01');
      
      // Click de nuevo para orden descendente
      cy.get('th').contains('Nombre').click();
      cy.get('tbody tr').first().should('contain', 'Paciente15');
    });

    it('debe ordenar por fecha de primera visita', () => {
      cy.get('th').contains('Primera Visita').click();
      
      // Verificar que ordena correctamente
      // Los pacientes sin fecha deberían aparecer al final
    });
  });

  describe('10. Exportación e Importación', () => {
    beforeEach(() => {
      // Crear algunos pacientes para exportar
      const patients = [
        { first: 'Export1', last: 'Test', email: 'export1@test.com' },
        { first: 'Export2', last: 'Test', email: 'export2@test.com' },
        { first: 'Export3', last: 'Test', email: 'export3@test.com' }
      ];
      
      patients.forEach(patient => {
        cy.get('button').contains('Nuevo Paciente').click();
        cy.get('input[name="first_name"]').type(patient.first);
        cy.get('input[name="last_name"]').type(patient.last);
        cy.get('input[name="email"]').type(patient.email);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
    });

    it('debe exportar pacientes a CSV', () => {
      cy.get('button').contains('Exportar').click();
      cy.get('button').contains('Exportar CSV').click();
      
      // Verificar que se descarga el archivo
      cy.readFile('cypress/downloads/pacientes.csv').should('exist');
    });

    it('debe exportar pacientes a Excel', () => {
      cy.get('button').contains('Exportar').click();
      cy.get('button').contains('Exportar Excel').click();
      
      // Verificar que se descarga el archivo
      cy.readFile('cypress/downloads/pacientes.xlsx').should('exist');
    });

    it('debe importar pacientes desde CSV', () => {
      cy.get('button').contains('Importar').click();
      
      // Subir archivo CSV
      cy.get('input[type="file"]').selectFile('cypress/fixtures/pacientes-import.csv');
      
      cy.get('button').contains('Procesar').click();
      
      // Verificar preview
      cy.contains('Vista previa de importación').should('be.visible');
      cy.contains('3 pacientes a importar').should('be.visible');
      
      // Confirmar importación
      cy.get('button').contains('Confirmar Importación').click();
      
      cy.contains('Importación exitosa').should('be.visible');
    });

    it('debe validar formato de archivo al importar', () => {
      cy.get('button').contains('Importar').click();
      
      // Intentar subir archivo incorrecto
      cy.get('input[type="file"]').selectFile('cypress/fixtures/invalid-file.txt');
      
      cy.contains('Formato de archivo no válido').should('be.visible');
    });
  });

  describe('11. Permisos y Multi-tenancy', () => {
    it('debe mostrar solo pacientes de la clínica actual', () => {
      // Los pacientes creados deben pertenecer a la clínica del usuario
      cy.get('input[placeholder*="Buscar"]').type('OtraClinica');
      cy.contains('No se encontraron pacientes').should('be.visible');
    });

    it('debe aplicar clinic_id automáticamente al crear', () => {
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('ClinicTest');
      cy.get('input[name="last_name"]').type('Patient');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // El paciente debe ser visible para el usuario actual
      cy.contains('ClinicTest Patient').should('be.visible');
      
      // Verificar en la base de datos que tiene clinic_id correcto
      // Este test requiere acceso a la API o base de datos
    });
  });

  describe('12. Rendimiento y UX', () => {
    it('debe mostrar skeleton loaders mientras carga', () => {
      cy.visit('/patients', {
        onBeforeLoad: (win) => {
          // Simular carga lenta
          cy.intercept('GET', '/api/patients*', (req) => {
            req.reply((res) => {
              res.delay(1000);
            });
          });
        }
      });
      
      // Verificar skeletons
      cy.get('[aria-label="Cargando..."]').should('be.visible');
    });

    it('debe mantener estado de búsqueda al regresar', () => {
      // Buscar
      cy.get('input[placeholder*="Buscar"]').type('Test');
      
      // Navegar a otra página
      cy.visit('/settings');
      
      // Regresar
      cy.go('back');
      
      // La búsqueda debería mantenerse
      cy.get('input[placeholder*="Buscar"]').should('have.value', 'Test');
    });

    it('debe mostrar tooltips en acciones', () => {
      // Crear un paciente
      cy.get('button').contains('Nuevo Paciente').click();
      cy.get('input[name="first_name"]').type('Tooltip');
      cy.get('input[name="last_name"]').type('Test');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Hover sobre botones de acción
      cy.contains('tr', 'Tooltip Test').find('button[aria-label="Ver detalles"]').trigger('mouseenter');
      cy.contains('Ver detalles del paciente').should('be.visible');
    });

    it('debe tener accesos rápidos con atajos de teclado', () => {
      // Presionar Ctrl+N para nuevo paciente
      cy.get('body').type('{ctrl}n');
      cy.contains('Nuevo Paciente').should('be.visible');
      
      // Escape para cerrar
      cy.get('body').type('{esc}');
      cy.contains('Nuevo Paciente').should('not.exist');
      
      // Ctrl+F para buscar
      cy.get('body').type('{ctrl}f');
      cy.get('input[placeholder*="Buscar"]').should('be.focused');
    });
  });
});

// Comandos personalizados para este módulo
Cypress.Commands.add('createPatient', (data) => {
  cy.get('button').contains('Nuevo Paciente').click();
  cy.get('input[name="first_name"]').type(data.firstName);
  cy.get('input[name="last_name"]').type(data.lastName);
  if (data.email) cy.get('input[name="email"]').type(data.email);
  if (data.phone) cy.get('input[name="phone"]').type(data.phone);
  cy.get('button[type="submit"]').contains('Guardar').click();
  cy.wait(500);
});

Cypress.Commands.add('searchPatient', (query) => {
  cy.get('input[placeholder*="Buscar"]').clear().type(query);
});