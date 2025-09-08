describe('Smoke Test', () => {
  it('should load the application', () => {
    cy.visit('http://localhost:3000');
    
    // Should redirect to login or show main page
    cy.url().should('include', 'localhost:3000');
    
    // Check if page loaded
    cy.get('body').should('be.visible');
  });

  it('should navigate to login page', () => {
    cy.visit('http://localhost:3000/auth/login');
    
    // Should show login form - check for button with type submit or contains Login/Sign
    cy.get('button[type="submit"]').should('be.visible');
    
    // Should have email and password fields
    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
  });
});