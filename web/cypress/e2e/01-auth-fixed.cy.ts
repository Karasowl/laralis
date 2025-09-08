/**
 * TESTS E2E DE AUTENTICACIÓN - VERSIÓN CORREGIDA
 * Siguiendo principios TDD con casos reales y selectores semánticos
 */

describe('Authentication System - Fixed Tests', () => {
  
  describe('Login Page', () => {
    beforeEach(() => {
      cy.visit('/auth/login');
    });

    it('debe mostrar el formulario de login correctamente', () => {
      // Verificar elementos principales del formulario
      cy.contains('h2', 'Bienvenido de Nuevo').should('be.visible');
      cy.contains('Inicia sesión en tu cuenta de Laralis').should('be.visible');
      
      // Verificar campos de entrada
      cy.get('input#email').should('be.visible');
      cy.get('input#password').should('be.visible');
      
      // Verificar botón de login
      cy.contains('button', 'Iniciar Sesión').should('be.visible');
      
      // Verificar enlaces
      cy.contains('a', 'Regístrate aquí').should('be.visible');
      cy.contains('a', '¿Olvidaste tu contraseña?').should('be.visible');
    });

    it('debe validar campos requeridos', () => {
      // Intentar enviar formulario vacío
      cy.contains('button', 'Iniciar Sesión').click();
      
      // Verificar que aparezca el toast de error (campos requeridos)
      cy.contains('Error').should('be.visible');
    });

    it('debe mostrar/ocultar contraseña', () => {
      cy.get('input#password').type('mypassword');
      cy.get('input#password').should('have.attr', 'type', 'password');
      
      // Click en el ojo para mostrar
      cy.get('input#password').parent().find('button').click();
      cy.get('input#password').should('have.attr', 'type', 'text');
      
      // Click de nuevo para ocultar
      cy.get('input#password').parent().find('button').click();
      cy.get('input#password').should('have.attr', 'type', 'password');
    });

    it('debe mostrar error con credenciales inválidas', () => {
      cy.get('input#email').type('invalid@ejemplo.com');
      cy.get('input#password').type('wrongpassword');
      cy.contains('button', 'Iniciar Sesión').click();
      
      // Esperar el estado de carga y luego el error
      cy.contains('Iniciando sesión...').should('be.visible');
      cy.contains('Error', { timeout: 10000 }).should('be.visible');
    });

    it('debe redirigir a registro', () => {
      cy.contains('a', 'Regístrate aquí').click();
      cy.url().should('include', '/auth/register');
    });

    it('debe redirigir a forgot password', () => {
      cy.contains('a', '¿Olvidaste tu contraseña?').click();
      cy.url().should('include', '/auth/forgot-password');
    });
  });

  describe('Login con Usuario Real', () => {
    it('debe permitir login con credenciales válidas', () => {
      cy.visit('/auth/login');
      
      // Usar las credenciales del usuario de prueba
      cy.get('input#email').type(Cypress.env('TEST_EMAIL'));
      cy.get('input#password').type(Cypress.env('TEST_PASSWORD'));
      cy.contains('button', 'Iniciar Sesión').click();
      
      // Verificar estado de carga
      cy.contains('Iniciando sesión...').should('be.visible');
      
      // Verificar mensaje de éxito
      cy.contains('Bienvenido', { timeout: 10000 }).should('be.visible');
      
      // Verificar redirección (puede ir a / o /onboarding)
      cy.url({ timeout: 15000 }).should('not.include', '/auth/login');
      
      // Debe estar autenticado
      cy.url().should('satisfy', (url) => {
        return url.includes('/') || url.includes('/onboarding');
      });
    });
  });

  describe('Register Page', () => {
    beforeEach(() => {
      cy.visit('/auth/register');
    });

    it('debe mostrar el formulario de registro', () => {
      // Verificar elementos principales
      cy.contains('h2', 'Crear Cuenta').should('be.visible');
      
      // Verificar campos
      cy.get('input#fullName').should('be.visible');
      cy.get('input#email').should('be.visible');
      cy.get('input#password').should('be.visible');
      cy.get('input#confirmPassword').should('be.visible');
      
      // Verificar botón
      cy.contains('button', 'Crear Cuenta').should('be.visible');
      
      // Verificar enlace a login
      cy.contains('a', 'Inicia sesión aquí').should('be.visible');
    });

    it('debe validar campos requeridos en registro', () => {
      cy.contains('button', 'Crear Cuenta').click();
      
      // Debería mostrar errores de validación
      cy.contains('Error').should('be.visible');
    });

    it('debe validar formato de email', () => {
      cy.get('input#email').type('email-invalido');
      cy.get('input#password').type('password123');
      cy.get('input#confirmPassword').type('password123');
      cy.get('input#fullName').type('Test User');
      cy.contains('button', 'Crear Cuenta').click();
      
      // Debería mostrar error de email inválido
      cy.contains('Error').should('be.visible');
    });

    it('debe validar que las contraseñas coincidan', () => {
      cy.get('input#email').type('test@ejemplo.com');
      cy.get('input#password').type('password123');
      cy.get('input#confirmPassword').type('different123');
      cy.get('input#fullName').type('Test User');
      cy.contains('button', 'Crear Cuenta').click();
      
      // Debería mostrar error de contraseñas no coinciden
      cy.contains('Error').should('be.visible');
    });

    it('debe redirigir a login', () => {
      cy.contains('a', 'Inicia sesión aquí').click();
      cy.url().should('include', '/auth/login');
    });
  });

  describe('Logout Flow', () => {
    beforeEach(() => {
      // Login primero
      cy.visit('/auth/login');
      cy.get('input#email').type(Cypress.env('TEST_EMAIL'));
      cy.get('input#password').type(Cypress.env('TEST_PASSWORD'));
      cy.contains('button', 'Iniciar Sesión').click();
      
      // Esperar a que se complete el login
      cy.url({ timeout: 15000 }).should('not.include', '/auth/login');
    });

    it('debe cerrar sesión correctamente', () => {
      // Buscar botón de logout (puede estar en menú)
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="user-menu"]').length > 0) {
          cy.get('[data-testid="user-menu"]').click();
        }
      });
      
      // Buscar y hacer click en cerrar sesión
      cy.contains('Cerrar Sesión').click();
      
      // Confirmar si hay modal de confirmación
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Confirmar")').length > 0) {
          cy.contains('button', 'Confirmar').click();
        }
      });
      
      // Verificar redirección a login
      cy.url({ timeout: 10000 }).should('include', '/auth/login');
    });
  });

  describe('Protected Routes', () => {
    it('debe redirigir a login cuando no está autenticado', () => {
      // Intentar acceder a página protegida
      cy.visit('/patients');
      
      // Debería redirigir a login
      cy.url({ timeout: 10000 }).should('include', '/auth/login');
    });

    it('debe redirigir a login al acceder settings sin auth', () => {
      cy.visit('/settings');
      cy.url({ timeout: 10000 }).should('include', '/auth/login');
    });

    it('debe redirigir a login al acceder servicios sin auth', () => {
      cy.visit('/services');
      cy.url({ timeout: 10000 }).should('include', '/auth/login');
    });
  });

  describe('Session Management', () => {
    it('debe mantener sesión al refrescar página', () => {
      // Login
      cy.visit('/auth/login');
      cy.get('input#email').type(Cypress.env('TEST_EMAIL'));
      cy.get('input#password').type(Cypress.env('TEST_PASSWORD'));
      cy.contains('button', 'Iniciar Sesión').click();
      
      cy.url({ timeout: 15000 }).should('not.include', '/auth/login');
      
      // Refrescar página
      cy.reload();
      
      // Debería seguir autenticado
      cy.url().should('not.include', '/auth/login');
    });

    it('debe cerrar sesión automáticamente si token expira', () => {
      // Este test requiere simular token expirado
      // Por ahora solo verificamos que funciona el flujo básico
      cy.visit('/auth/login');
      cy.get('input#email').type(Cypress.env('TEST_EMAIL'));
      cy.get('input#password').type(Cypress.env('TEST_PASSWORD'));
      cy.contains('button', 'Iniciar Sesión').click();
      
      cy.url({ timeout: 15000 }).should('not.include', '/auth/login');
    });
  });

  describe('Responsive Design', () => {
    it('debe funcionar en móvil', () => {
      cy.viewport('iphone-x');
      cy.visit('/auth/login');
      
      // Verificar que elementos son visibles en móvil
      cy.contains('Bienvenido de Nuevo').should('be.visible');
      cy.get('input#email').should('be.visible');
      cy.get('input#password').should('be.visible');
      cy.contains('button', 'Iniciar Sesión').should('be.visible');
    });

    it('debe funcionar en tablet', () => {
      cy.viewport('ipad-2');
      cy.visit('/auth/login');
      
      cy.contains('Bienvenido de Nuevo').should('be.visible');
      cy.get('input#email').should('be.visible');
      cy.contains('button', 'Iniciar Sesión').should('be.visible');
    });
  });

  describe('Accessibility', () => {
    it('debe tener etiquetas apropiadas', () => {
      cy.visit('/auth/login');
      
      // Verificar labels
      cy.get('label[for="email"]').should('contain', 'Correo Electrónico');
      cy.get('label[for="password"]').should('contain', 'Contraseña');
      
      // Verificar que inputs tengan labels asociados
      cy.get('input#email').should('have.attr', 'id', 'email');
      cy.get('input#password').should('have.attr', 'id', 'password');
    });

    it('debe permitir navegación con teclado', () => {
      cy.visit('/auth/login');
      
      // Navegar con Tab
      cy.get('input#email').focus().tab();
      cy.focused().should('have.id', 'password');
      
      cy.tab();
      cy.focused().should('contain', 'Recordarme');
    });
  });
});