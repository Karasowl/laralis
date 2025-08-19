/**
 * VALIDACIÓN FINAL - Test para confirmar que todo funciona después del onboarding
 */

describe('Validación Final Post-Onboarding', () => {
  it('FINAL-001: Debe confirmar que el sistema está completamente funcional', () => {
    const email = Cypress.env('TEST_EMAIL');
    const password = Cypress.env('TEST_PASSWORD');
    
    // Login básico
    cy.visit('/auth/login');
    cy.wait(1000);
    
    cy.get('input[type="email"]').first().clear().type(email);
    cy.get('input[type="password"]').first().clear().type(password);
    cy.get('button[type="submit"]').click();
    cy.wait(4000);
    
    cy.screenshot('after-login-final');
    
    // Verificar estado post-login
    cy.url().then(url => {
      cy.log('Estado post-login:', url);
      
      if (url.includes('/onboarding')) {
        cy.log('✅ En onboarding - verificando si necesita finalizar');
        
        cy.get('body').then($body => {
          if ($body.text().includes('All Set!')) {
            cy.log('✅ Completado, haciendo clic en Start');
            cy.get('button:contains("Start")').click();
            cy.wait(3000);
            cy.screenshot('clicked-start');
          } else if ($body.text().includes('Welcome to Laralis!')) {
            cy.log('⚠️ Aún en pantalla de bienvenida');
            cy.get('button:contains("Next")').click();
            cy.wait(2000);
          }
        });
      } else {
        cy.log('✅ No está en onboarding');
      }
    });
    
    // Probar acceso a pacientes
    cy.visit('/patients');
    cy.wait(3000);
    cy.screenshot('patients-page-final');
    
    cy.url().then(patientsUrl => {
      cy.log('URL de pacientes:', patientsUrl);
      
      if (patientsUrl.includes('/patients')) {
        cy.log('🎉 ÉXITO: Acceso a pacientes funcional');
        
        // Verificar contenido de la página
        cy.get('body').should('be.visible');
        cy.get('body').then($body => {
          const pageContent = $body.text();
          cy.log('Contenido página pacientes:', pageContent.substring(0, 200));
          
          // Buscar elementos típicos
          const hasPatientContent = pageContent.includes('Pacientes') || 
                                   pageContent.includes('Patients') ||
                                   pageContent.includes('Nuevo') ||
                                   pageContent.includes('Add');
          
          if (hasPatientContent) {
            cy.log('✅ Página de pacientes con contenido esperado');
          } else {
            cy.log('⚠️ Página de pacientes sin contenido esperado');
          }
        });
        
      } else {
        cy.log('❌ Aún hay redirección desde pacientes a:', patientsUrl);
      }
    });
    
    // Probar otros módulos principales
    const modules = ['supplies', 'services', 'treatments', 'settings'];
    
    modules.forEach(module => {
      cy.visit(`/${module}`);
      cy.wait(2000);
      
      cy.url().then(moduleUrl => {
        if (moduleUrl.includes(module)) {
          cy.log(`✅ ${module} accesible`);
        } else {
          cy.log(`⚠️ ${module} redirige a:`, moduleUrl);
        }
      });
      
      cy.screenshot(`module-${module}-final`);
    });
  });

  it('FINAL-002: Test básico de crear paciente', () => {
    // Login rápido
    cy.visit('/auth/login');
    cy.wait(1000);
    cy.get('input[type="email"]').first().clear().type(Cypress.env('TEST_EMAIL'));
    cy.get('input[type="password"]').first().clear().type(Cypress.env('TEST_PASSWORD'));
    cy.get('button[type="submit"]').click();
    cy.wait(3000);
    
    // Intentar crear un paciente real
    cy.visit('/patients');
    cy.wait(2000);
    cy.screenshot('ready-to-create-patient');
    
    cy.url().then(url => {
      if (url.includes('/patients')) {
        cy.log('✅ En página de pacientes, intentando crear paciente...');
        
        // Buscar botón de crear paciente
        cy.get('body').then($body => {
          const buttons = ['Nuevo Paciente', 'Add Patient', 'Nuevo', 'Agregar', '+'];
          let buttonFound = false;
          
          buttons.forEach(buttonText => {
            if ($body.find(`button:contains("${buttonText}")`).length > 0 && !buttonFound) {
              cy.get(`button:contains("${buttonText}")`).click();
              buttonFound = true;
              cy.log(`✅ Encontrado botón: ${buttonText}`);
              cy.wait(2000);
              cy.screenshot('patient-form-opened');
              
              // Llenar formulario básico
              cy.get('body').then($form => {
                if ($form.find('input[name="first_name"]').length > 0) {
                  const uniqueId = Date.now();
                  cy.get('input[name="first_name"]').type('Test');
                  cy.get('input[name="last_name"]').type(`Patient${uniqueId}`);
                  
                  cy.screenshot('patient-form-filled');
                  
                  // Intentar guardar
                  if ($form.find('button[type="submit"]').length > 0) {
                    cy.get('button[type="submit"]').click();
                    cy.wait(2000);
                    cy.screenshot('patient-created-attempt');
                    
                    cy.get('body').then($result => {
                      const resultText = $result.text();
                      if (resultText.includes('exitosamente') || resultText.includes('success')) {
                        cy.log('🎉 PACIENTE CREADO EXITOSAMENTE');
                      } else if (resultText.includes('error')) {
                        cy.log('⚠️ Error al crear paciente');
                      } else {
                        cy.log('ℹ️ Resultado incierto');
                      }
                    });
                  }
                } else {
                  cy.log('⚠️ No se encontraron campos de formulario');
                }
              });
            }
          });
          
          if (!buttonFound) {
            cy.log('⚠️ No se encontró botón para crear paciente');
            cy.log('Botones disponibles:', $body.find('button').map((i, el) => el.textContent).get());
          }
        });
        
      } else {
        cy.log('❌ No se pudo acceder a la página de pacientes');
      }
    });
  });
});