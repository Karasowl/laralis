describe('Authentication System', () => {
  describe('Login', () => {
    it('should show login form', () => {
      cy.visit('/auth/login');
      cy.wait(1000); // Esperar a que cargue completamente
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('should validate required fields', () => {
      cy.visit('/auth/login');
      cy.wait(1000);
      cy.get('button[type="submit"]').click();
      cy.contains('correo').should('be.visible');
    });

    it('should show error for invalid credentials', () => {
      cy.visit('/auth/login');
      cy.wait(1000);
      cy.get('input[type="email"]').type('invalid@example.com');
      cy.get('input[type="password"]').type('wrongpassword');
      cy.get('button[type="submit"]').click();
      cy.contains('Invalid').should('be.visible');
    });

    it('should login with valid credentials', () => {
      cy.visit('/auth/login');
      cy.get('input[type="email"]').type(Cypress.env('TEST_EMAIL'));
      cy.get('input[type="password"]').type(Cypress.env('TEST_PASSWORD'));
      cy.get('button[type="submit"]').click();
      cy.url().should('not.include', '/auth/login');
      cy.url().should('include', '/');
    });
  });

  describe('Register', () => {
    const uniqueEmail = `test${Date.now()}@example.com`;

    it('should show register form', () => {
      cy.visit('/auth/register');
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('should validate password requirements', () => {
      cy.visit('/auth/register');
      cy.get('input[type="email"]').type(uniqueEmail);
      cy.get('input[type="password"]').type('weak');
      cy.contains('button', 'Crear').click();
      cy.contains('caracteres').should('be.visible');
    });

    it('should create new account', () => {
      cy.visit('/auth/register');
      cy.get('input[type="email"]').type(uniqueEmail);
      cy.get('input[type="password"]').type('StrongPassword123!');
      cy.contains('button', 'Crear').click();
      // Should redirect to onboarding or dashboard
      cy.url().should('not.include', '/auth/register');
    });
  });

  describe('Logout', () => {
    beforeEach(() => {
      cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    });

    it('should logout successfully', () => {
      cy.get('[data-cy="user-menu"]').click();
      cy.contains('Cerrar sesión').click();
      cy.url().should('include', '/auth/login');
      
      // Verify cannot access protected routes
      cy.visit('/patients');
      cy.url().should('include', '/auth/login');
    });
  });

  describe('Password Reset', () => {
    it('should show password reset form', () => {
      cy.visit('/auth/login');
      cy.contains('Olvidé mi contraseña').click();
      cy.url().should('include', '/auth/reset-password');
      cy.get('input[type="email"]').should('be.visible');
    });

    it('should send reset email', () => {
      cy.visit('/auth/reset-password');
      cy.get('input[type="email"]').type('test@example.com');
      cy.contains('button', 'Enviar').click();
      cy.contains('correo enviado').should('be.visible');
    });
  });
});