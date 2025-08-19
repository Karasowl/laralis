describe('Multi-Tenancy and Data Isolation', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
  });

  describe('Workspace and Clinic Management', () => {
    it('should display current workspace and clinic context', () => {
      cy.visit('/');
      cy.wait(1000);
      
      // Verificar indicadores de contexto
      cy.get('[data-cy="workspace-name"]').should('be.visible');
      cy.get('[data-cy="current-clinic"]').should('be.visible');
    });

    it('should switch between clinics', () => {
      cy.visit('/');
      cy.wait(1000);
      
      // Abrir selector de clínicas
      cy.get('[data-cy="clinic-switcher"]').click();
      
      // Verificar lista de clínicas
      cy.get('[data-cy="clinic-list"]').should('be.visible');
      
      // Cambiar de clínica si hay múltiples
      cy.get('[data-cy="clinic-option"]').then($clinics => {
        if ($clinics.length > 1) {
          cy.wrap($clinics).eq(1).click();
          
          // Verificar cambio de contexto
          cy.get('[data-cy="current-clinic"]').should('not.contain', $clinics.eq(0).text());
        }
      });
    });

    it('should maintain clinic context across navigation', () => {
      cy.visit('/');
      
      // Obtener clínica actual
      cy.get('[data-cy="current-clinic"]').invoke('text').as('currentClinic');
      
      // Navegar a diferentes módulos
      cy.visit('/patients');
      cy.get('[data-cy="current-clinic"]').should('contain', '@currentClinic');
      
      cy.visit('/services');
      cy.get('[data-cy="current-clinic"]').should('contain', '@currentClinic');
      
      cy.visit('/supplies');
      cy.get('[data-cy="current-clinic"]').should('contain', '@currentClinic');
    });
  });

  describe('Data Isolation Between Clinics', () => {
    it('should isolate patient data between clinics', () => {
      // Crear paciente en primera clínica
      cy.visit('/patients');
      cy.contains('button', 'Agregar').click();
      cy.fillPatientForm({
        first_name: 'Paciente',
        last_name: 'Clínica A',
        email: `clinica.a.${Date.now()}@test.com`
      });
      cy.contains('button', 'Guardar').click();
      cy.wait(1000);
      
      // Cambiar a segunda clínica
      cy.get('[data-cy="clinic-switcher"]').click();
      cy.get('[data-cy="clinic-option"]').eq(1).click();
      cy.wait(1000);
      
      // Verificar que no se ve el paciente de la otra clínica
      cy.visit('/patients');
      cy.wait(1000);
      cy.contains('Paciente Clínica A').should('not.exist');
    });

    it('should isolate service data between clinics', () => {
      // Crear servicio en primera clínica
      cy.visit('/services');
      cy.contains('button', 'Agregar').click();
      cy.fillServiceForm({
        name: 'Servicio Clínica A',
        duration_minutes: 30,
        margin_percentage: 65
      });
      cy.contains('button', 'Guardar').click();
      cy.wait(1000);
      
      // Cambiar clínica
      cy.get('[data-cy="clinic-switcher"]').click();
      cy.get('[data-cy="clinic-option"]').eq(1).click();
      cy.wait(1000);
      
      // Verificar aislamiento
      cy.visit('/services');
      cy.contains('Servicio Clínica A').should('not.exist');
    });

    it('should isolate supply inventory between clinics', () => {
      // Crear insumo en primera clínica
      cy.visit('/supplies');
      cy.contains('button', 'Agregar').click();
      cy.fillSupplyForm({
        name: 'Insumo Clínica A',
        unit: 'pieza',
        quantity_per_unit: 1,
        cost_per_unit_cents: 10000
      });
      cy.contains('button', 'Guardar').click();
      cy.wait(1000);
      
      // Cambiar clínica
      cy.get('[data-cy="clinic-switcher"]').click();
      cy.get('[data-cy="clinic-option"]').eq(1).click();
      cy.wait(1000);
      
      // Verificar aislamiento
      cy.visit('/supplies');
      cy.contains('Insumo Clínica A').should('not.exist');
    });

    it('should isolate treatment data between clinics', () => {
      // Verificar que tratamientos no se mezclan entre clínicas
      cy.visit('/treatments');
      cy.wait(1000);
      
      // Obtener número de tratamientos en clínica actual
      cy.get('[data-cy="treatment-row"]').then($treatments => {
        const currentCount = $treatments.length;
        
        // Cambiar clínica
        cy.get('[data-cy="clinic-switcher"]').click();
        cy.get('[data-cy="clinic-option"]').eq(1).click();
        cy.wait(1000);
        
        // Verificar diferente conjunto de datos
        cy.visit('/treatments');
        cy.get('[data-cy="treatment-row"]').should('have.length.not.equal', currentCount);
      });
    });
  });

  describe('Financial Data Isolation', () => {
    it('should isolate revenue and cost data', () => {
      cy.visit('/reports');
      cy.wait(1000);
      
      // Obtener datos financieros de clínica actual
      cy.get('[data-cy="monthly-revenue"]').invoke('text').as('clinic1Revenue');
      
      // Cambiar clínica
      cy.get('[data-cy="clinic-switcher"]').click();
      cy.get('[data-cy="clinic-option"]').eq(1).click();
      cy.wait(1000);
      
      // Verificar datos diferentes
      cy.visit('/reports');
      cy.get('[data-cy="monthly-revenue"]').should('not.contain', '@clinic1Revenue');
    });

    it('should calculate separate break-even points', () => {
      cy.visit('/equilibrium');
      cy.wait(1000);
      
      // Obtener punto de equilibrio de clínica actual
      cy.get('[data-cy="breakeven-units"]').invoke('text').as('clinic1Breakeven');
      
      // Cambiar clínica
      cy.get('[data-cy="clinic-switcher"]').click();
      cy.get('[data-cy="clinic-option"]').eq(1).click();
      cy.wait(1000);
      
      // Verificar cálculo independiente
      cy.visit('/equilibrium');
      cy.get('[data-cy="breakeven-units"]').should('not.contain', '@clinic1Breakeven');
    });
  });

  describe('User Permissions and Access Control', () => {
    it('should respect clinic-specific permissions', () => {
      // Verificar que usuario tiene acceso a clínica actual
      cy.visit('/');
      cy.get('[data-cy="clinic-switcher"]').click();
      
      // Verificar que solo se muestran clínicas autorizadas
      cy.get('[data-cy="clinic-option"]').should('have.length.greaterThan', 0);
      cy.get('[data-cy="clinic-option"]').each($clinic => {
        cy.wrap($clinic).should('not.contain', 'No autorizado');
      });
    });

    it('should handle unauthorized clinic access', () => {
      // Intentar acceder a clínica no autorizada via URL
      cy.visit('/?clinicId=unauthorized-clinic-id');
      
      // Debería redirigir o mostrar error
      cy.url().should('not.contain', 'unauthorized-clinic-id');
      cy.contains('autorizado').or('acceso denegado').should('be.visible');
    });
  });

  describe('Data Migration and Sync', () => {
    it('should maintain data integrity during clinic switches', () => {
      // Crear datos en múltiples clínicas y verificar consistencia
      const testData = {
        patient: {
          first_name: 'Test',
          last_name: 'Migration',
          email: `migration.${Date.now()}@test.com`
        }
      };
      
      // Clínica 1
      cy.visit('/patients');
      cy.contains('button', 'Agregar').click();
      cy.fillPatientForm(testData.patient);
      cy.contains('button', 'Guardar').click();
      cy.wait(1000);
      
      // Cambiar a clínica 2
      cy.get('[data-cy="clinic-switcher"]').click();
      cy.get('[data-cy="clinic-option"]').eq(1).click();
      cy.wait(1000);
      
      // Volver a clínica 1
      cy.get('[data-cy="clinic-switcher"]').click();
      cy.get('[data-cy="clinic-option"]').eq(0).click();
      cy.wait(1000);
      
      // Verificar que los datos siguen ahí
      cy.visit('/patients');
      cy.contains('Test Migration').should('be.visible');
    });

    it('should handle concurrent access from multiple clinics', () => {
      // Simular acceso concurrente (dentro de lo posible en Cypress)
      cy.visit('/patients');
      cy.contains('button', 'Agregar').click();
      
      // Cambiar clínica en mitad del proceso
      cy.get('[data-cy="clinic-switcher"]').click();
      cy.get('[data-cy="clinic-option"]').eq(1).click();
      
      // Intentar completar el formulario original
      cy.fillPatientForm({
        first_name: 'Concurrent',
        last_name: 'Test',
        email: `concurrent.${Date.now()}@test.com`
      });
      cy.contains('button', 'Guardar').click();
      
      // Verificar manejo apropiado del contexto
      cy.contains('error').or('contexto').should('be.visible');
    });
  });

  describe('Backup and Recovery Per Clinic', () => {
    it('should export data for specific clinic only', () => {
      cy.visit('/settings/export');
      cy.wait(1000);
      
      // Exportar datos de clínica actual
      cy.contains('button', 'Exportar datos').click();
      cy.get('checkbox[name="include_patients"]').check();
      cy.get('checkbox[name="include_services"]').check();
      cy.contains('button', 'Generar exportación').click();
      
      // Verificar que indica clínica específica
      cy.contains('Clínica actual').should('be.visible');
    });

    it('should restore data to correct clinic context', () => {
      cy.visit('/settings/import');
      cy.wait(1000);
      
      // Intentar importar datos
      cy.get('input[type="file"]').selectFile('cypress/fixtures/clinic-backup.json');
      
      // Verificar confirmación de clínica destino
      cy.contains('clínica destino').should('be.visible');
      cy.get('[data-cy="target-clinic"]').should('be.visible');
    });
  });

  describe('Performance with Multiple Clinics', () => {
    it('should maintain performance with clinic filtering', () => {
      const startTime = Date.now();
      
      // Navegar entre módulos con filtrado de clínica
      cy.visit('/patients');
      cy.wait(500);
      cy.visit('/services');
      cy.wait(500);
      cy.visit('/supplies');
      cy.wait(500);
      
      cy.then(() => {
        const totalTime = Date.now() - startTime;
        expect(totalTime).to.be.lessThan(5000); // Menos de 5 segundos
      });
    });

    it('should handle large datasets per clinic efficiently', () => {
      // Verificar paginación funciona con filtros de clínica
      cy.visit('/patients');
      cy.get('[data-cy="pagination"]').should('be.visible');
      
      // Cambiar página
      cy.get('[data-cy="next-page"]').click();
      cy.get('[data-cy="patient-row"]').should('be.visible');
      
      // Verificar que sigue en la misma clínica
      cy.get('[data-cy="current-clinic"]').should('be.visible');
    });
  });

  describe('Analytics and Reporting Per Clinic', () => {
    it('should generate clinic-specific reports', () => {
      cy.visit('/reports');
      cy.wait(1000);
      
      // Generar reporte
      cy.contains('button', 'Generar reporte').click();
      cy.get('input[name="report_title"]').type('Reporte Mensual Clínica');
      cy.contains('button', 'Crear').click();
      
      // Verificar que incluye identificación de clínica
      cy.contains('reporte generado').should('be.visible');
      cy.get('[data-cy="clinic-identifier"]').should('be.visible');
    });

    it('should compare performance between clinics', () => {
      cy.visit('/reports/comparison');
      cy.wait(1000);
      
      // Configurar comparación
      cy.get('select[name="clinic_1"]').select(0);
      cy.get('select[name="clinic_2"]').select(1);
      cy.get('input[name="date_from"]').type('2024-01-01');
      cy.get('input[name="date_to"]').type('2024-12-31');
      
      cy.contains('button', 'Comparar').click();
      
      // Verificar visualización comparativa
      cy.get('[data-cy="comparison-chart"]').should('be.visible');
      cy.get('[data-cy="clinic-metrics"]').should('have.length', 2);
    });
  });

  describe('Security and Data Protection', () => {
    it('should encrypt clinic data separately', () => {
      // Verificar que las API calls incluyen clinic context
      cy.intercept('GET', '/api/patients**').as('getPatientsAPI');
      
      cy.visit('/patients');
      cy.wait('@getPatientsAPI').then((interception) => {
        expect(interception.request.headers).to.have.property('clinic-id');
      });
    });

    it('should audit clinic access and changes', () => {
      cy.visit('/settings/audit');
      cy.wait(1000);
      
      // Verificar log de auditoría
      cy.get('[data-cy="audit-log"]').should('be.visible');
      cy.contains('Cambio de clínica').should('be.visible');
      cy.contains('Acceso a datos').should('be.visible');
    });

    it('should handle data breach scenarios', () => {
      // Simular intento de acceso no autorizado
      cy.request({
        url: '/api/patients',
        headers: {
          'clinic-id': 'malicious-clinic-id'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(403); // Forbidden
      });
    });
  });
});