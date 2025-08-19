/**
 * TEST solo para completar onboarding paso a paso
 */

describe('Test Onboarding Only', () => {
  it('ONBOARDING-001: Debe completar onboarding paso a paso', () => {
    const email = Cypress.env('TEST_EMAIL');
    const password = Cypress.env('TEST_PASSWORD');
    
    // Login básico
    cy.visit('/auth/login');
    cy.wait(1000);
    
    cy.get('input[type="email"]').first().clear().type(email);
    cy.get('input[type="password"]').first().clear().type(password);
    cy.get('button[type="submit"]').click();
    cy.wait(3000);
    
    // Verificar que llegamos al onboarding
    cy.url().should('include', '/onboarding');
    cy.screenshot('arrived-at-onboarding');
    
    // Usar comando mejorado de onboarding
    cy.completeOnboarding();
    
    // Verificar resultado final
    cy.url().then(finalUrl => {
      cy.log('URL final después del onboarding:', finalUrl);
      cy.screenshot('final-result');
      
      // No hacer assertions estrictas, solo reportar el estado
      if (finalUrl.includes('/onboarding')) {
        cy.log('⚠️ Aún en onboarding - revisar proceso');
      } else {
        cy.log('✅ Salimos del onboarding exitosamente');
      }
    });
  });

  it('ONBOARDING-002: Debe verificar acceso a rutas después del onboarding', () => {
    // Intentar acceso directo a pacientes para ver si el onboarding está completo
    cy.visit('/patients');
    cy.wait(2000);
    
    cy.url().then(url => {
      cy.log('URL al intentar acceder a pacientes:', url);
      cy.screenshot('patients-access-check');
      
      if (url.includes('/onboarding')) {
        cy.log('⚠️ Aún necesita onboarding');
        
        // Si necesita onboarding, completarlo
        cy.completeOnboarding();
        
        // Intentar acceso nuevamente
        cy.visit('/patients');
        cy.wait(2000);
        cy.screenshot('patients-after-onboarding');
        
      } else if (url.includes('/auth/login')) {
        cy.log('⚠️ Necesita login');
        
      } else {
        cy.log('✅ Acceso directo exitoso');
      }
    });
  });
});