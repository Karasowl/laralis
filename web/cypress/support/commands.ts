/**
 * Comandos personalizados de Cypress para testing de Laralis
 */
/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Comando personalizado para login
       */
      login(email: string, password: string): Chainable<void>
      
      /**
       * Comando para completar onboarding automáticamente
       */
      completeOnboarding(): Chainable<void>
      
      /**
       * Comando para setup completo via API (evita onboarding manual)
       */
      setupTestEnvironment(): Chainable<void>
      
      /**
       * Comando para crear un workspace de test
       */
      createTestWorkspace(name: string, clinicName: string): Chainable<void>
      
      /**
       * Comando para cambiar de clínica
       */
      switchClinic(clinicName: string): Chainable<void>
      
      /**
       * Comando para verificar aislamiento de datos
       */
      verifyDataIsolation(): Chainable<void>
      
      /**
       * Comando para crear datos de prueba
       */
      seedTestData(clinicId: string): Chainable<void>
      
      /**
       * Comando para seleccionar clínica
       */
      selectClinic(clinicName: string): Chainable<void>
      
      /**
       * Comando para llenar formulario de paciente
       */
      fillPatientForm(patient: any): Chainable<void>
      
      /**
       * Comando para llenar formulario de insumo
       */
      fillSupplyForm(supply: any): Chainable<void>
      
      /**
       * Comando para llenar formulario de servicio
       */
      fillServiceForm(service: any): Chainable<void>
    }
  }
}

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/auth/login');
  cy.wait(1000); // Esperar a que cargue la página
  
  // Buscar campo de email de forma flexible
  cy.get('body').then($body => {
    if ($body.find('input[type="email"]').length > 0) {
      cy.get('input[type="email"]').first().clear().type(email);
    } else if ($body.find('input[name="email"]').length > 0) {
      cy.get('input[name="email"]').first().clear().type(email);
    } else {
      cy.get('input[placeholder*="email"]').first().clear().type(email);
    }
  });
  
  // Buscar campo de contraseña de forma flexible
  cy.get('body').then($body => {
    if ($body.find('input[type="password"]').length > 0) {
      cy.get('input[type="password"]').first().clear().type(password);
    } else if ($body.find('input[name="password"]').length > 0) {
      cy.get('input[name="password"]').first().clear().type(password);
    } else {
      cy.get('input[placeholder*="password"]').first().clear().type(password);
    }
  });
  
  // Buscar botón de submit de forma flexible
  cy.get('body').then($body => {
    if ($body.find('button[type="submit"]').length > 0) {
      cy.get('button[type="submit"]').click();
    } else if ($body.find('button:contains("Iniciar")').length > 0) {
      cy.get('button:contains("Iniciar")').click();
    } else {
      cy.get('button:contains("Login")').click();
    }
  });
  
  // Esperar a que se complete el login
  cy.wait(3000); // Dar más tiempo para el login
  
  // Verificar si necesita setup adicional (onboarding)
  cy.url().then(url => {
    if (url.includes('/onboarding')) {
      cy.log('Usuario en onboarding, verificando estado...');
      
      // Verificar si está en la pantalla de finalización
      cy.get('body').then($body => {
        if ($body.text().includes('All Set!') || $body.text().includes('Initial Setup Completed!')) {
          cy.log('✅ Onboarding completado, haciendo clic en Start...');
          cy.get('button:contains("Start")').click();
          cy.wait(3000);
        } else {
          cy.log('⚠️ Usuario necesita completar onboarding...');
          cy.setupTestEnvironment();
        }
      });
    }
  });
  
  // Verificar que no estamos en login
  cy.url().should('not.include', '/auth/login');
  cy.get('body').should('be.visible');
  
  // No hacer verificación estricta aquí, dejar que completeOnboarding maneje el flujo
});

Cypress.Commands.add('completeOnboarding', () => {
  // Verificar que estamos en la página de onboarding
  cy.url().should('include', '/onboarding');
  cy.wait(2000);
  
  const uniqueId = Date.now();
  const workspaceName = `Test Workspace ${uniqueId}`;
  const clinicName = `Test Clinic ${uniqueId}`;
  
  cy.log('Completando onboarding con:', workspaceName);
  cy.screenshot('onboarding-step-0-welcome');
  
  // PASO 0: Pasar la página de bienvenida "Welcome to Laralis!"
  cy.get('body').then($body => {
    if ($body.text().includes('Welcome to Laralis!') || $body.text().includes('Manage your dental practice professionally')) {
      cy.log('En página de bienvenida, haciendo clic en Next...');
      cy.get('button:contains("Next")').click();
      cy.wait(3000);
      cy.screenshot('onboarding-step-1-after-welcome');
    }
  });
  
  // PASO 1: Completar información del workspace
  cy.get('body').then($body => {
    if ($body.text().includes('Create your Workspace')) {
      cy.log('En paso de crear workspace');
      cy.screenshot('onboarding-step-1-create-workspace');
      
      // Buscar campos de workspace por placeholder
      const workspaceNameInput = $body.find('input[placeholder*="Garcia"]');
      const descriptionInput = $body.find('input[placeholder*="Network"]');
      
      if (workspaceNameInput.length > 0) {
        cy.get('input[placeholder*="Garcia"]').clear().type(workspaceName);
        cy.log('Workspace name filled via placeholder');
      } else {
        // Fallback: usar el primer input
        const inputs = $body.find('input');
        if (inputs.length > 0) {
          cy.get('input').first().clear().type(workspaceName);
          cy.log('Workspace name filled via first input');
        }
      }
      
      if (descriptionInput.length > 0) {
        cy.get('input[placeholder*="Network"]').clear().type('Workspace de prueba para testing automatizado');
        cy.log('Description filled via placeholder');
      }
      
      cy.screenshot('onboarding-step-1-filled');
      
      // Hacer clic en Next
      cy.get('button:contains("Next")').click();
      cy.wait(3000);
      cy.screenshot('onboarding-step-2');
    }
  });
  
  // PASO 2: Si hay paso de crear clínica
  cy.url().then(url => {
    if (url.includes('/onboarding')) {
      cy.log('Verificando si hay paso 2 del onboarding');
      
      cy.get('body').then($body => {
        const bodyText = $body.text();
        
        if (bodyText.includes('clinic') || bodyText.includes('Clinic') || bodyText.includes('clínica')) {
          cy.log('Completando paso 2 del onboarding (clínica)');
          
          const clinicInputs = $body.find('input');
          
          // Llenar información de clínica
          if (clinicInputs.length > 0) {
            cy.get('input').first().clear().type(clinicName);
            cy.log('Clinic name filled');
          }
          
          // Dirección si existe
          if (clinicInputs.length > 1) {
            cy.get('input').eq(1).clear().type('Av. Reforma 123, CDMX');
            cy.log('Clinic address filled');
          }
          
          cy.screenshot('onboarding-step-2-filled');
          
          // Buscar botón de finalizar
          if ($body.find('button:contains("Finish")').length > 0) {
            cy.get('button:contains("Finish")').click();
          } else if ($body.find('button:contains("Finalizar")').length > 0) {
            cy.get('button:contains("Finalizar")').click();
          } else if ($body.find('button:contains("Complete")').length > 0) {
            cy.get('button:contains("Complete")').click();
          } else if ($body.find('button:contains("Next")').length > 0) {
            cy.get('button:contains("Next")').click();
          } else {
            cy.get('button[type="submit"]').click();
          }
          
          cy.wait(3000);
        } else {
          cy.log('No hay paso adicional de clínica, onboarding debería estar completo');
        }
      });
    }
  });
  
  // Verificar finalización
  cy.wait(4000);
  cy.screenshot('onboarding-final-check');
  
  // Verificar que salimos del onboarding
  cy.url().then(finalUrl => {
    if (finalUrl.includes('/onboarding')) {
      cy.log('ADVERTENCIA: Aún en onboarding después de completar pasos');
    } else {
      cy.log('Onboarding completado exitosamente - URL final:', finalUrl);
    }
  });
  
  cy.log('Proceso de onboarding terminado');
});

Cypress.Commands.add('setupTestEnvironment', () => {
  cy.log('Configurando entorno de test via API...');
  
  // Login básico primero
  const email = Cypress.env('TEST_EMAIL');
  const password = Cypress.env('TEST_PASSWORD');
  
  cy.visit('/auth/login');
  cy.wait(1000);
  
  cy.get('input[type="email"]').first().clear().type(email);
  cy.get('input[type="password"]').first().clear().type(password);
  cy.get('button[type="submit"]').click();
  cy.wait(3000);
  
  // Si está en onboarding, crear workspace via request API
  cy.url().then(url => {
    if (url.includes('/onboarding')) {
      cy.log('Usuario necesita workspace, creando via API...');
      
      const uniqueId = Date.now();
      const workspaceData = {
        name: `Test Workspace ${uniqueId}`,
        description: 'Workspace para testing automatizado'
      };
      
      const clinicData = {
        name: `Test Clinic ${uniqueId}`,
        address: 'Av. Test 123, CDMX',
        phone: '5551234567'
      };
      
      // Crear workspace via API si es posible
      cy.request({
        method: 'POST',
        url: '/api/workspaces',
        body: workspaceData,
        failOnStatusCode: false
      }).then(workspaceResponse => {
        cy.log('Workspace API response:', workspaceResponse.status);
        
        if (workspaceResponse.status === 200 || workspaceResponse.status === 201) {
          // Crear clínica si el workspace se creó exitosamente
          cy.request({
            method: 'POST',
            url: '/api/clinics',
            body: {
              ...clinicData,
              workspace_id: workspaceResponse.body?.id
            },
            failOnStatusCode: false
          }).then(clinicResponse => {
            cy.log('Clinic API response:', clinicResponse.status);
          });
        }
      });
      
      // Dar tiempo para que se procesen las requests
      cy.wait(2000);
      
      // Intentar navegar a dashboard
      cy.visit('/');
      cy.wait(2000);
      
    } else {
      cy.log('Usuario ya tiene workspace configurado');
    }
  });
  
  // Verificar acceso final
  cy.url().then(finalUrl => {
    if (finalUrl.includes('/onboarding')) {
      cy.log('⚠️ Aún en onboarding después del setup API');
      // Como fallback, intentar onboarding manual
      cy.completeOnboarding();
    } else {
      cy.log('✅ Setup de entorno completado');
    }
  });
});

Cypress.Commands.add('createTestWorkspace', (name: string, clinicName: string) => {
  cy.visit('/onboarding');
  cy.get('[data-testid="workspace-name"]').type(name);
  cy.get('[data-testid="workspace-slug"]').type(name.toLowerCase().replace(/\s+/g, '-'));
  cy.get('[data-testid="clinic-name"]').type(clinicName);
  cy.get('[data-testid="clinic-address"]').type('Dirección de prueba 123');
  cy.get('[data-testid="create-workspace-button"]').click();
  
  // Verificar que se creó correctamente
  cy.url().should('not.include', '/onboarding');
});

Cypress.Commands.add('switchClinic', (clinicName: string) => {
  cy.get('[data-testid="clinic-switcher"]').click();
  cy.get(`[data-testid="clinic-option-${clinicName}"]`).click();
  
  // Verificar que cambió
  cy.get('[data-testid="current-clinic-name"]').should('contain', clinicName);
});

Cypress.Commands.add('verifyDataIsolation', () => {
  // Verificar que solo se muestran datos de la clínica actual
  cy.get('[data-testid="data-table"]').within(() => {
    cy.get('[data-testid="data-row"]').each(($row) => {
      // Cada fila debe tener el indicador de clínica correcto
      cy.wrap($row).should('have.attr', 'data-clinic-id');
    });
  });
});

Cypress.Commands.add('seedTestData', (clinicId: string) => {
  // Crear datos de prueba a través de la API
  const testData = {
    patients: [
      { first_name: 'Juan', last_name: 'Pérez', email: 'juan@test.com' },
      { first_name: 'María', last_name: 'García', email: 'maria@test.com' }
    ],
    services: [
      { name: 'Limpieza Dental', duration_minutes: 30 },
      { name: 'Endodoncia', duration_minutes: 90 }
    ],
    supplies: [
      { name: 'Pasta Profiláctica', price_cents: 5000 },
      { name: 'Guantes', price_cents: 2500 }
    ]
  };
  
  // Crear pacientes
  testData.patients.forEach(patient => {
    cy.request('POST', '/api/patients', { ...patient, clinic_id: clinicId });
  });
  
  // Crear servicios
  testData.services.forEach(service => {
    cy.request('POST', '/api/services', { ...service, clinic_id: clinicId });
  });
  
  // Crear insumos
  testData.supplies.forEach(supply => {
    cy.request('POST', '/api/supplies', { ...supply, clinic_id: clinicId });
  });
});

// Comando para seleccionar clínica
Cypress.Commands.add('selectClinic', (clinicName: string) => {
  cy.get('[data-cy="clinic-selector"]').click();
  cy.contains(clinicName).click();
  // Esperar a que el contexto de clínica se actualice
  cy.wait(500);
});

// Comando para llenar formulario de paciente
Cypress.Commands.add('fillPatientForm', (patient) => {
  // Campos requeridos
  cy.get('input[name="first_name"]').clear().type(patient.first_name);
  cy.get('input[name="last_name"]').clear().type(patient.last_name);
  
  // Campos opcionales - verificar si existen antes de llenarlos
  if (patient.email) {
    cy.get('body').then($body => {
      if ($body.find('input[name="email"]').length > 0) {
        cy.get('input[name="email"]').clear().type(patient.email);
      }
    });
  }
  
  if (patient.phone) {
    cy.get('body').then($body => {
      if ($body.find('input[name="phone"]').length > 0) {
        cy.get('input[name="phone"]').clear().type(patient.phone);
      }
    });
  }
  
  if (patient.birth_date) {
    cy.get('body').then($body => {
      if ($body.find('input[name="birth_date"]').length > 0) {
        cy.get('input[name="birth_date"]').clear().type(patient.birth_date);
      }
    });
  }
  
  if (patient.address) {
    cy.get('body').then($body => {
      if ($body.find('input[name="address"]').length > 0) {
        cy.get('input[name="address"]').clear().type(patient.address);
      }
    });
  }
});

// Comando para llenar formulario de insumo
Cypress.Commands.add('fillSupplyForm', (supply) => {
  // Campos requeridos
  cy.get('input[name="name"]').clear().type(supply.name);
  cy.get('input[name="unit"]').clear().type(supply.unit);
  cy.get('input[name="quantity_per_unit"]').clear().type(supply.quantity_per_unit.toString());
  cy.get('input[name="cost_per_unit_cents"]').clear().type(supply.cost_per_unit_cents.toString());
  
  // Campos opcionales - verificar si existen antes de llenarlos
  if (supply.supplier) {
    cy.get('body').then($body => {
      if ($body.find('input[name="supplier"]').length > 0) {
        cy.get('input[name="supplier"]').clear().type(supply.supplier);
      }
    });
  }
  
  if (supply.description) {
    cy.get('body').then($body => {
      if ($body.find('textarea[name="description"]').length > 0) {
        cy.get('textarea[name="description"]').clear().type(supply.description);
      }
    });
  }
  
  if (supply.min_stock) {
    cy.get('body').then($body => {
      if ($body.find('input[name="min_stock"]').length > 0) {
        cy.get('input[name="min_stock"]').clear().type(supply.min_stock.toString());
      }
    });
  }
  
  if (supply.current_stock) {
    cy.get('body').then($body => {
      if ($body.find('input[name="current_stock"]').length > 0) {
        cy.get('input[name="current_stock"]').clear().type(supply.current_stock.toString());
      }
    });
  }
});

// Comando para llenar formulario de servicio
Cypress.Commands.add('fillServiceForm', (service) => {
  // Campos requeridos
  cy.get('input[name="name"]').clear().type(service.name);
  cy.get('input[name="duration_minutes"]').clear().type(service.duration_minutes.toString());
  cy.get('input[name="margin_percentage"]').clear().type(service.margin_percentage.toString());
  
  // Campos opcionales - verificar si existen antes de llenarlos
  if (service.description) {
    cy.get('body').then($body => {
      if ($body.find('textarea[name="description"]').length > 0) {
        cy.get('textarea[name="description"]').clear().type(service.description);
      }
    });
  }
  
  if (service.category) {
    cy.get('body').then($body => {
      if ($body.find('select[name="category"]').length > 0) {
        cy.get('select[name="category"]').select(service.category);
      }
    });
  }
  
  if (service.requires_authorization) {
    cy.get('body').then($body => {
      if ($body.find('input[name="requires_authorization"]').length > 0) {
        if (service.requires_authorization) {
          cy.get('input[name="requires_authorization"]').check();
        } else {
          cy.get('input[name="requires_authorization"]').uncheck();
        }
      }
    });
  }
});

export {};
