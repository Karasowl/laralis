/**
 * Cypress E2E Support File
 * Comandos personalizados y configuración global
 */
import './commands';
import './mock-auth';
import '@cypress/code-coverage/support';

// Configuración global
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevenir que errores no relacionados con tests fallen los tests
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false;
  }
  if (err.message.includes('Non-Error promise rejection captured')) {
    return false;
  }
  if (err.message.includes('Hydration failed because the initial UI does not match')) {
    return false;
  }
  if (err.message.includes('There was an error while hydrating')) {
    return false;
  }
  if (err.message.includes('Text content does not match server-rendered HTML')) {
    return false;
  }
  return true;
});

// Configurar viewport por defecto
beforeEach(() => {
  cy.viewport(1280, 720);
});
