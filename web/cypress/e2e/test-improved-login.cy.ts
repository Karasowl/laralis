/**
 * TEST para validar el login mejorado con onboarding automático
 */

describe('Test Improved Login with Onboarding', () => {
  it('LOGIN-001: Debe hacer login completo incluyendo onboarding', () => {
    const email = Cypress.env('TEST_EMAIL');
    const password = Cypress.env('TEST_PASSWORD');
    
    cy.log('Intentando login completo con:', email);
    
    // Usar comando mejorado que incluye onboarding
    cy.login(email, password);
    
    // Verificar que llegamos a una página autenticada
    cy.url().should('not.include', '/auth/login');
    cy.url().should('not.include', '/onboarding');
    
    // Tomar screenshot del estado final
    cy.screenshot('login-complete');
    
    // Verificar elementos de aplicación autenticada
    cy.get('body').should('be.visible');
    cy.get('body').should('contain.text', 'Laralis');
  });

  it('LOGIN-002: Debe navegar a pacientes después del login', () => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    
    // Intentar navegar a pacientes
    cy.visit('/patients');
    cy.wait(2000);
    
    // Verificar que no fuimos redirigidos al login
    cy.url().should('include', '/patients');
    cy.screenshot('patients-page-after-login');
    
    // Buscar elementos típicos de la página de pacientes
    cy.get('body').then($body => {
      const bodyText = $body.text();
      const hasPatientElements = bodyText.includes('Pacientes') || 
                                bodyText.includes('Patients') ||
                                bodyText.includes('Nuevo Paciente') ||
                                bodyText.includes('New Patient');
      
      cy.log('Página de pacientes cargada:', hasPatientElements);
    });
  });

  it('LOGIN-003: Debe poder acceder a todas las rutas principales', () => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    
    const routes = ['/patients', '/supplies', '/services', '/treatments', '/settings'];
    
    routes.forEach(route => {
      cy.visit(route);
      cy.wait(1000);
      
      // Verificar que no fuimos redirigidos al login
      cy.url().should('include', route);
      cy.get('body').should('be.visible');
      
      cy.log(`Ruta ${route} accesible`);
    });
  });
});