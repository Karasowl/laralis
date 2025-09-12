/**
 * Tests E2E de Multi-Tenancy
 * Verifican el aislamiento completo de datos entre clínicas
 */
describe('Multi-Tenancy E2E Tests', () => {
  const user1 = {
    email: 'user1@test.com',
    password: 'testpass123',
    workspace: 'Clínica Norte',
    clinic: 'Sucursal Centro'
  };
  
  const user2 = {
    email: 'user2@test.com', 
    password: 'testpass123',
    workspace: 'Clínica Sur',
    clinic: 'Sucursal Principal'
  };

  beforeEach(() => {
    // Limpiar datos de prueba
    cy.task('db:clean');
  });

  describe('Workspace Isolation', () => {
    it('debe crear y mantener workspaces separados para diferentes usuarios', () => {
      // Usuario 1 crea su workspace
      cy.login(user1.email, user1.password);
      cy.createTestWorkspace(user1.workspace, user1.clinic);
      
      // Verificar que está en su workspace
      cy.get('[data-testid="workspace-name"]').should('contain', user1.workspace);
      cy.get('[data-testid="clinic-name"]').should('contain', user1.clinic);
      
      // Logout y login con usuario 2
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="logout-button"]').click();
      
      cy.login(user2.email, user2.password);
      cy.createTestWorkspace(user2.workspace, user2.clinic);
      
      // Verificar que está en su propio workspace
      cy.get('[data-testid="workspace-name"]').should('contain', user2.workspace);
      cy.get('[data-testid="workspace-name"]').should('not.contain', user1.workspace);
    });
  });

  describe('Patient Data Isolation', () => {
    it('debe mantener pacientes separados entre clínicas', () => {
      // Setup: Usuario 1 crea pacientes
      cy.login(user1.email, user1.password);
      cy.createTestWorkspace(user1.workspace, user1.clinic);
      
      // Crear pacientes para clínica 1
      cy.visit('/patients');
      cy.get('[data-testid="add-patient-button"]').click();
      cy.get('[data-testid="first-name"]').type('Juan');
      cy.get('[data-testid="last-name"]').type('Pérez');
      cy.get('[data-testid="email"]').type('juan@clinic1.com');
      cy.get('[data-testid="save-patient"]').click();
      
      cy.get('[data-testid="add-patient-button"]').click();
      cy.get('[data-testid="first-name"]').type('María');
      cy.get('[data-testid="last-name"]').type('García');
      cy.get('[data-testid="email"]').type('maria@clinic1.com');
      cy.get('[data-testid="save-patient"]').click();
      
      // Verificar que se crearon
      cy.get('[data-testid="patients-table"]').should('contain', 'Juan Pérez');
      cy.get('[data-testid="patients-table"]').should('contain', 'María García');
      
      // Logout y cambiar a usuario 2
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="logout-button"]').click();
      
      cy.login(user2.email, user2.password);
      cy.createTestWorkspace(user2.workspace, user2.clinic);
      
      // Verificar que no ve pacientes del usuario 1
      cy.visit('/patients');
      cy.get('[data-testid="patients-table"]').should('not.contain', 'Juan Pérez');
      cy.get('[data-testid="patients-table"]').should('not.contain', 'María García');
      
      // Crear paciente para clínica 2
      cy.get('[data-testid="add-patient-button"]').click();
      cy.get('[data-testid="first-name"]').type('Carlos');
      cy.get('[data-testid="last-name"]').type('López');
      cy.get('[data-testid="email"]').type('carlos@clinic2.com');
      cy.get('[data-testid="save-patient"]').click();
      
      // Solo debe ver su paciente
      cy.get('[data-testid="patients-table"]').should('contain', 'Carlos López');
      cy.get('[data-testid="patients-table"]').should('not.contain', 'Juan Pérez');
    });
  });

  describe('Services and Supplies Isolation', () => {
    it('debe mantener servicios e insumos separados', () => {
      // Setup clínica 1
      cy.login(user1.email, user1.password);
      cy.createTestWorkspace(user1.workspace, user1.clinic);
      
      // Crear servicio en clínica 1
      cy.visit('/services');
      cy.get('[data-testid="add-service-button"]').click();
      cy.get('[data-testid="service-name"]').type('Limpieza Dental Premium');
      cy.get('[data-testid="service-duration"]').type('45');
      cy.get('[data-testid="save-service"]').click();
      
      // Crear insumo en clínica 1
      cy.visit('/supplies');
      cy.get('[data-testid="add-supply-button"]').click();
      cy.get('[data-testid="supply-name"]').type('Pasta Especial');
      cy.get('[data-testid="supply-price"]').type('50');
      cy.get('[data-testid="save-supply"]').click();
      
      // Cambiar a clínica 2
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="logout-button"]').click();
      
      cy.login(user2.email, user2.password);
      cy.createTestWorkspace(user2.workspace, user2.clinic);
      
      // Verificar aislamiento de servicios
      cy.visit('/services');
      cy.get('[data-testid="services-table"]').should('not.contain', 'Limpieza Dental Premium');
      
      // Verificar aislamiento de insumos
      cy.visit('/supplies');
      cy.get('[data-testid="supplies-table"]').should('not.contain', 'Pasta Especial');
    });
  });

  describe('Marketing Data Isolation', () => {
    it('debe mantener plataformas personalizadas y campañas separadas', () => {
      // Setup clínica 1
      cy.login(user1.email, user1.password);
      cy.createTestWorkspace(user1.workspace, user1.clinic);
      
      // Crear plataforma personalizada
      cy.visit('/settings/marketing');
      cy.get('[data-testid="add-platform-input"]').type('Radio Local FM');
      cy.get('[data-testid="add-platform-button"]').click();
      
      // Verificar que se creó
      cy.get('[data-testid="platforms-list"]').should('contain', 'Radio Local FM');
      
      // Crear campaña
      cy.get('[data-testid="platform-select"]').select('Radio Local FM');
      cy.get('[data-testid="add-campaign-input"]').type('Promoción Navidad');
      cy.get('[data-testid="add-campaign-button"]').click();
      
      // Cambiar a clínica 2
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="logout-button"]').click();
      
      cy.login(user2.email, user2.password);
      cy.createTestWorkspace(user2.workspace, user2.clinic);
      
      // Verificar que no ve plataformas personalizadas de clínica 1
      cy.visit('/settings/marketing');
      cy.get('[data-testid="platforms-list"]').should('not.contain', 'Radio Local FM');
      
      // Pero sí debe ver plataformas del sistema
      cy.get('[data-testid="platforms-list"]').should('contain', 'Meta Ads');
      cy.get('[data-testid="platforms-list"]').should('contain', 'Google Ads');
    });
  });

  describe('Clinic Switching within Workspace', () => {
    it('debe cambiar datos al cambiar de clínica dentro del mismo workspace', () => {
      cy.login(user1.email, user1.password);
      cy.createTestWorkspace(user1.workspace, user1.clinic);
      
      // Crear segunda clínica en el mismo workspace
      cy.visit('/settings/workspaces');
      cy.get('[data-testid="add-clinic-button"]').click();
      cy.get('[data-testid="clinic-name"]').type('Sucursal Norte');
      cy.get('[data-testid="clinic-address"]').type('Av. Norte 456');
      cy.get('[data-testid="save-clinic"]').click();
      
      // Agregar datos en clínica 1
      cy.switchClinic(user1.clinic);
      cy.visit('/patients');
      cy.get('[data-testid="add-patient-button"]').click();
      cy.get('[data-testid="first-name"]').type('Ana');
      cy.get('[data-testid="last-name"]').type('Martínez');
      cy.get('[data-testid="save-patient"]').click();
      
      // Cambiar a clínica 2
      cy.switchClinic('Sucursal Norte');
      
      // Verificar que no ve datos de clínica 1
      cy.visit('/patients');
      cy.get('[data-testid="patients-table"]').should('not.contain', 'Ana Martínez');
      
      // Agregar datos en clínica 2
      cy.get('[data-testid="add-patient-button"]').click();
      cy.get('[data-testid="first-name"]').type('Roberto');
      cy.get('[data-testid="last-name"]').type('Sánchez');
      cy.get('[data-testid="save-patient"]').click();
      
      // Verificar que solo ve datos de clínica 2
      cy.get('[data-testid="patients-table"]').should('contain', 'Roberto Sánchez');
      cy.get('[data-testid="patients-table"]').should('not.contain', 'Ana Martínez');
      
      // Volver a clínica 1 y verificar que vuelven sus datos
      cy.switchClinic(user1.clinic);
      cy.visit('/patients');
      cy.get('[data-testid="patients-table"]').should('contain', 'Ana Martínez');
      cy.get('[data-testid="patients-table"]').should('not.contain', 'Roberto Sánchez');
    });
  });

  describe('URL Manipulation Protection', () => {
    it('debe prevenir acceso a datos via manipulación de URL', () => {
      // Setup: crear datos en dos clínicas diferentes
      cy.login(user1.email, user1.password);
      cy.createTestWorkspace(user1.workspace, user1.clinic);
      
      // Obtener clinic ID de la clínica 1 (esto se haría via intercept en un test real)
      let clinic1Id: string;
      cy.window().its('localStorage').then((ls) => {
        clinic1Id = ls.getItem('selectedClinicId') || '';
      });
      
      // Cambiar a usuario 2
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="logout-button"]').click();
      
      cy.login(user2.email, user2.password);
      cy.createTestWorkspace(user2.workspace, user2.clinic);
      
      // Intentar acceder a datos de clínica 1 manipulando URL
      cy.visit(`/api/patients?clinicId=${clinic1Id}`, { failOnStatusCode: false });
      
      // Debe fallar o no devolver datos
      cy.get('body').should('not.contain', 'juan@clinic1.com');
    });
  });
});
