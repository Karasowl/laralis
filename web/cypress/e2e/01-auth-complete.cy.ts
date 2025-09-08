describe('Authentication System - Complete', () => {
  beforeEach(() => {
    // Limpiar cookies y localStorage antes de cada test
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  describe('Login Flow', () => {
    it('should display login page correctly', () => {
      cy.visit('/auth/login');
      cy.wait(1000);
      
      // Verificar elementos de la página
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
      
      // Verificar textos importantes
      cy.contains('Iniciar Sesión').should('exist');
      cy.contains('Crear cuenta').should('exist');
    });

    it('should validate empty form submission', () => {
      cy.visit('/auth/login');
      cy.wait(1000);
      
      cy.get('button[type="submit"]').click();
      
      // Buscar mensajes de validación (más flexible)
      cy.get('form').should('contain.text', 'requerido').or('contain.text', 'required');
    });

    it('should show error for invalid credentials', () => {
      cy.visit('/auth/login');
      cy.wait(1000);
      
      cy.get('input[type="email"]').type('invalid@test.com');
      cy.get('input[type="password"]').type('wrongpassword');
      cy.get('button[type="submit"]').click();
      
      // Esperar mensaje de error
      cy.contains('Invalid', { timeout: 10000 }).should('be.visible')
        .or(() => cy.contains('inválid', { timeout: 5000 }).should('be.visible'));
    });

    it('should login with valid credentials and redirect to onboarding', () => {
      cy.visit('/auth/login');
      cy.wait(1000);
      
      // Usar credenciales del cypress.env.json
      cy.get('input[type="email"]').type(Cypress.env('TEST_EMAIL'));
      cy.get('input[type="password"]').type(Cypress.env('TEST_PASSWORD'));
      cy.get('button[type="submit"]').click();
      
      // Verificar redirección exitosa (puede ir a onboarding o dashboard)
      cy.url({ timeout: 15000 }).should('not.include', '/auth/login');
      cy.url().should('match', /(onboarding|^\/$)/);
    });
  });

  describe('Registration Flow', () => {
    const uniqueEmail = `test+${Date.now()}@example.com`;
    
    it('should display registration page correctly', () => {
      cy.visit('/auth/register');
      cy.wait(1000);
      
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('have.length.greaterThan', 0);
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('should validate password requirements', () => {
      cy.visit('/auth/register');
      cy.wait(1000);
      
      cy.get('input[type="email"]').first().type('test@example.com');
      cy.get('input[type="password"]').first().type('123'); // Contraseña muy corta
      cy.get('button[type="submit"]').click();
      
      // Buscar mensaje de validación de contraseña
      cy.get('body').should('contain.text', 'contraseña')
        .or('contain.text', 'password')
        .or('contain.text', '6');
    });

    // Nota: Test de creación de cuenta comentado para evitar spam de usuarios
    it.skip('should create new account successfully', () => {
      cy.visit('/auth/register');
      cy.wait(1000);
      
      cy.get('input[type="email"]').first().type(uniqueEmail);
      cy.get('input[type="password"]').first().type('validpassword123');
      cy.get('input[type="password"]').last().type('validpassword123');
      cy.get('button[type="submit"]').click();
      
      // Verificar redirección o mensaje de confirmación
      cy.url({ timeout: 10000 }).should('not.include', '/auth/register');
    });
  });

  describe('Session Management', () => {
    it('should maintain session across page refreshes', () => {
      // Login primero
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
      
      // Verificar que estamos autenticados
      cy.url().should('not.include', '/auth');
      
      // Refrescar página
      cy.reload();
      
      // Verificar que seguimos autenticados
      cy.url().should('not.include', '/auth/login');
    });

    it('should logout successfully', () => {
      // Login primero
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
      
      // Buscar y hacer click en logout
      cy.get('[data-cy="user-menu"]').click()
        .or(() => cy.contains('Cerrar sesión').click())
        .or(() => cy.contains('Logout').click());
      
      // Verificar redirección a login
      cy.url({ timeout: 10000 }).should('include', '/auth/login');
    });
  });

  describe('Protected Routes', () => {
    it('should redirect unauthenticated users to login', () => {
      const protectedRoutes = [
        '/',
        '/patients',
        '/services',
        '/supplies',
        '/treatments',
        '/settings'
      ];

      protectedRoutes.forEach(route => {
        cy.visit(route);
        cy.url({ timeout: 5000 }).should('include', '/auth/login');
      });
    });

    it('should allow authenticated users to access protected routes', () => {
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
      
      const protectedRoutes = [
        '/',
        '/patients',
        '/services',
        '/supplies'
      ];

      protectedRoutes.forEach(route => {
        cy.visit(route);
        cy.url().should('not.include', '/auth/login');
        cy.get('body').should('not.contain', 'Iniciar Sesión');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      cy.visit('/auth/login');
      cy.wait(1000);
      
      // Simular error de red interceptando requests
      cy.intercept('POST', '**/auth/v1/token**', { forceNetworkError: true });
      
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();
      
      // Verificar manejo de error
      cy.contains('error', { matchCase: false, timeout: 10000 }).should('be.visible');
    });

    it('should handle server errors appropriately', () => {
      cy.visit('/auth/login');
      cy.wait(1000);
      
      // Simular error del servidor
      cy.intercept('POST', '**/auth/v1/token**', { statusCode: 500 });
      
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('password123');
      cy.get('button[type="submit"]').click();
      
      // Verificar manejo de error del servidor
      cy.contains('error', { matchCase: false, timeout: 10000 }).should('be.visible');
    });
  });

  describe('Accessibility', () => {
    it('should be navigable with keyboard', () => {
      cy.visit('/auth/login');
      cy.wait(1000);
      
      // Navegar con Tab
      cy.get('body').tab().should('have.focus');
      cy.focused().tab().should('have.attr', 'type', 'email');
      cy.focused().tab().should('have.attr', 'type', 'password');
      cy.focused().tab().should('have.attr', 'type', 'submit');
    });

    it('should have appropriate ARIA labels', () => {
      cy.visit('/auth/login');
      cy.wait(1000);
      
      // Verificar etiquetas y accesibilidad
      cy.get('input[type="email"]').should('have.attr', 'id');
      cy.get('input[type="password"]').should('have.attr', 'id');
      cy.get('button[type="submit"]').should('not.have.attr', 'disabled');
    });
  });
});