describe('Debug Tests', () => {
  it('should load the login page and show its content', () => {
    cy.visit('/auth/login');
    cy.wait(3000); // Esperar a que cargue completamente
    
    // Tomar screenshot inicial
    cy.screenshot('login-page-loaded');
    
    // Verificar que la página no esté en blanco
    cy.get('body').should('not.be.empty');
    
    // Buscar inputs específicos - más permisivo
    cy.get('input').should('have.length.greaterThan', 0);
    
    // Buscar cualquier botón
    cy.get('button').should('have.length.greaterThan', 0);
    
    // Buscar específicamente el botón de submit
    cy.get('button[type="submit"]').should('exist');
    
    // Ver si está en estado de loading o normal - capturar el texto real
    cy.get('button[type="submit"]').should(($btn) => {
      const text = $btn.text().trim();
      // Primero, capturar qué texto tiene realmente
      console.log('Texto real del botón:', text);
      // Aceptar cualquiera de las variaciones posibles
      expect(text.length).to.be.greaterThan(0);
    });
  });
  
  it('should visit home page', () => {
    cy.visit('/');
    cy.wait(2000);
    
    // Ver a dónde redirige
    cy.url().then((url) => {
      console.log('Redirected to:', url);
    });
  });
});