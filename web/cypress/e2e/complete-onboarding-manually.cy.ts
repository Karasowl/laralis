/**
 * TEST PARA COMPLETAR ONBOARDING MANUALMENTE
 * Este test debe ejecutarse UNA VEZ para configurar la cuenta de test
 */

describe('Completar Onboarding Manualmente', () => {
  it('SETUP-001: Debe completar onboarding paso a paso con debugging detallado', () => {
    const email = Cypress.env('TEST_EMAIL');
    const password = Cypress.env('TEST_PASSWORD');
    
    cy.log('🔧 INICIANDO SETUP MANUAL DE ONBOARDING');
    cy.log('Email:', email);
    
    // 1. LOGIN
    cy.visit('/auth/login');
    cy.wait(2000);
    cy.screenshot('1-login-page');
    
    cy.get('input[type="email"]').first().clear().type(email);
    cy.get('input[type="password"]').first().clear().type(password);
    cy.get('button[type="submit"]').click();
    cy.wait(4000);
    
    cy.screenshot('2-after-login');
    cy.url().then(url => cy.log('URL después del login:', url));
    
    // 2. VERIFICAR ONBOARDING
    cy.url().should('include', '/onboarding');
    cy.screenshot('3-onboarding-start');
    
    // 3. PASO 1 - Página de bienvenida
    cy.get('body').then($body => {
      if ($body.text().includes('Welcome to Laralis!')) {
        cy.log('📋 En página de bienvenida');
        cy.get('button:contains("Next")').click();
        cy.wait(3000);
        cy.screenshot('4-after-welcome-next');
      }
    });
    
    // 4. PASO 2 - Crear workspace
    cy.get('body').then($body => {
      if ($body.text().includes('Create your Workspace')) {
        cy.log('📋 En paso crear workspace');
        cy.screenshot('5-create-workspace-form');
        
        const uniqueId = Date.now();
        const workspaceName = `Test Workspace ${uniqueId}`;
        
        // Intentar múltiples estrategias para llenar el campo
        cy.log('Intentando llenar workspace name:', workspaceName);
        
        // Estrategia 1: Por placeholder
        cy.get('body').then($form => {
          if ($form.find('input[placeholder*="Garcia"]').length > 0) {
            cy.log('✅ Usando placeholder Garcia');
            cy.get('input[placeholder*="Garcia"]').clear().type(workspaceName);
          } else if ($form.find('input').length > 0) {
            cy.log('✅ Usando primer input');
            cy.get('input').first().clear().type(workspaceName);
          }
        });
        
        cy.screenshot('6-workspace-filled');
        cy.wait(2000);
        
        // Intentar hacer clic en Next
        cy.get('button:contains("Next")').click();
        cy.wait(4000);
        cy.screenshot('7-after-workspace-next');
      }
    });
    
    // 5. PASO 3 - Si hay paso de clínica
    cy.url().then(url => {
      cy.log('URL después de workspace:', url);
      
      if (url.includes('/onboarding')) {
        cy.log('📋 Hay paso adicional de onboarding');
        cy.screenshot('8-additional-step');
        
        cy.get('body').then($body => {
          const bodyText = $body.text();
          cy.log('Contenido del paso adicional:', bodyText.substring(0, 200));
          
          if (bodyText.includes('clinic') || bodyText.includes('Clinic')) {
            cy.log('📋 Completando información de clínica');
            
            const clinicName = `Test Clinic ${Date.now()}`;
            cy.get('input').first().clear().type(clinicName);
            
            // Llenar dirección si existe
            cy.get('body').then($form => {
              if ($form.find('input').length > 1) {
                cy.get('input').eq(1).clear().type('Av. Test 123, CDMX');
              }
            });
            
            cy.screenshot('9-clinic-filled');
            
            // Buscar botón de finalizar
            cy.get('body').then($buttons => {
              if ($buttons.find('button:contains("Finish")').length > 0) {
                cy.get('button:contains("Finish")').click();
              } else if ($buttons.find('button:contains("Complete")').length > 0) {
                cy.get('button:contains("Complete")').click();
              } else if ($buttons.find('button:contains("Next")').length > 0) {
                cy.get('button:contains("Next")').click();
              }
            });
            
            cy.wait(5000);
            cy.screenshot('10-after-clinic-submit');
          }
        });
      }
    });
    
    // 6. VERIFICAR RESULTADO FINAL
    cy.wait(3000);
    cy.url().then(finalUrl => {
      cy.log('🎯 URL FINAL:', finalUrl);
      cy.screenshot('11-final-result');
      
      if (finalUrl.includes('/onboarding')) {
        cy.log('⚠️ ATENCIÓN: Aún en onboarding');
        cy.get('body').then($body => {
          cy.log('Contenido actual:', $body.text().substring(0, 300));
        });
      } else {
        cy.log('🎉 ONBOARDING COMPLETADO EXITOSAMENTE');
      }
    });
    
    // 7. PRUEBA FINAL - Intentar acceder a pacientes
    cy.visit('/patients');
    cy.wait(3000);
    cy.screenshot('12-patients-test');
    
    cy.url().then(patientsUrl => {
      cy.log('🏥 URL de pacientes:', patientsUrl);
      
      if (patientsUrl.includes('/patients')) {
        cy.log('🎉 ÉXITO TOTAL: Acceso a pacientes funcionando');
      } else {
        cy.log('⚠️ Aún hay problemas de acceso');
      }
    });
  });
});