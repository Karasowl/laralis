/**
 * DEBUG - Test para diagnosticar problemas de login
 */

describe('Debug Login Flow', () => {
  it('DEBUG-001: Debe verificar página de login', () => {
    cy.visit('/auth/login');
    cy.wait(2000);
    
    // Tomar screenshot para debug
    cy.screenshot('login-page');
    
    // Verificar elementos de la página
    cy.get('body').should('be.visible');
    
    // Verificar si hay formulario de login
    cy.get('body').then($body => {
      const bodyText = $body.text();
      cy.log('Texto de la página:', bodyText);
      
      // Buscar elementos de formulario
      const hasEmailField = $body.find('input[type="email"]').length > 0;
      const hasPasswordField = $body.find('input[type="password"]').length > 0;
      const hasSubmitButton = $body.find('button[type="submit"]').length > 0;
      
      cy.log('Email field found:', hasEmailField);
      cy.log('Password field found:', hasPasswordField);
      cy.log('Submit button found:', hasSubmitButton);
      
      if (hasEmailField) {
        cy.get('input[type="email"]').should('be.visible');
      }
      if (hasPasswordField) {
        cy.get('input[type="password"]').should('be.visible');
      }
      if (hasSubmitButton) {
        cy.get('button[type="submit"]').should('be.visible');
      }
    });
  });

  it('DEBUG-002: Debe intentar login manual', () => {
    cy.visit('/auth/login');
    cy.wait(2000);
    
    // Verificar credenciales
    const email = Cypress.env('TEST_EMAIL');
    const password = Cypress.env('TEST_PASSWORD');
    
    cy.log('Using email:', email);
    cy.log('Using password:', password ? '[HIDDEN]' : 'NOT SET');
    
    // Intentar login paso a paso
    cy.get('body').then($body => {
      if ($body.find('input[type="email"]').length > 0) {
        cy.get('input[type="email"]').first().clear().type(email);
        cy.screenshot('after-email-input');
        
        if ($body.find('input[type="password"]').length > 0) {
          cy.get('input[type="password"]').first().clear().type(password);
          cy.screenshot('after-password-input');
          
          if ($body.find('button[type="submit"]').length > 0) {
            cy.get('button[type="submit"]').click();
            cy.screenshot('after-submit-click');
            
            // Esperar respuesta
            cy.wait(3000);
            
            // Verificar redirect
            cy.url().then(url => {
              cy.log('Current URL after login:', url);
              cy.screenshot('after-login-attempt');
            });
          }
        }
      }
    });
  });

  it('DEBUG-003: Debe verificar estado de autenticación', () => {
    cy.visit('/auth/login');
    cy.wait(1000);
    
    // Intentar login
    const email = Cypress.env('TEST_EMAIL');
    const password = Cypress.env('TEST_PASSWORD');
    
    cy.get('body').then($body => {
      if ($body.find('input[type="email"]').length > 0) {
        cy.get('input[type="email"]').first().clear().type(email);
        cy.get('input[type="password"]').first().clear().type(password);
        cy.get('button[type="submit"]').click();
        
        cy.wait(3000);
        
        // Verificar si necesita onboarding
        cy.url().then(url => {
          if (url.includes('/onboarding')) {
            cy.log('Usuario necesita completar onboarding');
            cy.screenshot('needs-onboarding');
            
            // Verificar elementos de onboarding
            cy.get('body').then($onboardingBody => {
              const onboardingText = $onboardingBody.text();
              cy.log('Onboarding page text:', onboardingText);
            });
          } else if (url.includes('/auth/login')) {
            cy.log('Login falló - aún en página de login');
            cy.screenshot('login-failed');
          } else {
            cy.log('Login exitoso - redirigido a:', url);
            cy.screenshot('login-success');
          }
        });
      }
    });
  });

  it('DEBUG-004: Debe verificar si usuario existe', () => {
    // Verificar si necesitamos crear el usuario primero
    cy.visit('/auth/register');
    cy.wait(1000);
    cy.screenshot('register-page');
    
    cy.get('body').then($body => {
      const bodyText = $body.text();
      cy.log('Register page text:', bodyText);
    });
  });

  it('DEBUG-005: Debe probar navegación directa a rutas protegidas', () => {
    // Intentar ir directamente a /patients sin login
    cy.visit('/patients');
    cy.wait(2000);
    
    cy.url().then(url => {
      cy.log('URL después de intentar acceder a /patients:', url);
      cy.screenshot('direct-patients-access');
      
      if (url.includes('/auth/login')) {
        cy.log('Correctamente redirigido a login');
      } else if (url.includes('/onboarding')) {
        cy.log('Redirigido a onboarding - usuario autenticado pero sin workspace');
      } else {
        cy.log('Acceso directo permitido o error');
      }
    });
  });
});