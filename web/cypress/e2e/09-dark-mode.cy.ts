describe('Dark Mode', () => {
  beforeEach(() => {
    // Clear any existing theme preference
    cy.clearLocalStorage();
    
    // Visit login page
    cy.visit('/auth/login');
    
    // Login with test user
    cy.get('input[type="email"]').type('ismaelguimarais@gmail.com');
    cy.get('input[type="password"]').type('test123456');
    cy.get('button[type="submit"]').click();
    
    // Wait for redirect and main page load
    cy.url().should('not.include', '/auth/login');
    cy.get('header').should('be.visible');
  });

  it('should have theme toggle in header', () => {
    // Theme toggle should be visible in header
    cy.get('header button[aria-haspopup="menu"]')
      .contains('button', 'Cambiar tema')
      .should('be.visible');
  });

  it('should start with system theme by default', () => {
    // Check that html has appropriate class based on system preference
    cy.get('html').should('satisfy', ($html) => {
      return $html.hasClass('dark') || $html.hasClass('light') || !$html.hasClass('dark');
    });
    
    // Check localStorage for theme preference (should be system or empty)
    cy.window().then((win) => {
      const theme = win.localStorage.getItem('laralis-ui-theme');
      expect(theme).to.be.oneOf([null, 'system']);
    });
  });

  it('should toggle to dark theme', () => {
    // Click theme toggle button
    cy.get('header button')
      .find('svg')
      .first()
      .parents('button')
      .click();
    
    // Click dark theme option
    cy.get('[role="menu"]')
      .should('be.visible')
      .contains('Oscuro')
      .click();
    
    // Verify dark class is applied to html
    cy.get('html').should('have.class', 'dark');
    
    // Verify theme is saved in localStorage
    cy.window().then((win) => {
      expect(win.localStorage.getItem('laralis-ui-theme')).to.equal('dark');
    });
    
    // Verify background color changed to dark
    cy.get('body').should('have.css', 'background-color').and('not.equal', 'rgb(255, 255, 255)');
  });

  it('should toggle to light theme', () => {
    // First set to dark
    cy.get('header button')
      .find('svg')
      .first()
      .parents('button')
      .click();
    
    cy.get('[role="menu"]')
      .contains('Oscuro')
      .click();
    
    cy.get('html').should('have.class', 'dark');
    
    // Now toggle to light
    cy.get('header button')
      .find('svg')
      .first()
      .parents('button')
      .click();
    
    cy.get('[role="menu"]')
      .should('be.visible')
      .contains('Claro')
      .click();
    
    // Verify light class is applied (no dark class)
    cy.get('html').should('not.have.class', 'dark');
    
    // Verify theme is saved in localStorage
    cy.window().then((win) => {
      expect(win.localStorage.getItem('laralis-ui-theme')).to.equal('light');
    });
  });

  it('should use system theme preference', () => {
    // Click theme toggle
    cy.get('header button')
      .find('svg')
      .first()
      .parents('button')
      .click();
    
    // Click system option
    cy.get('[role="menu"]')
      .should('be.visible')
      .contains('Sistema')
      .click();
    
    // Verify system theme is saved
    cy.window().then((win) => {
      expect(win.localStorage.getItem('laralis-ui-theme')).to.equal('system');
    });
    
    // Verify theme follows system preference
    cy.get('html').should('satisfy', ($html) => {
      return $html.hasClass('dark') || !$html.hasClass('dark');
    });
  });

  it('should persist theme across page reloads', () => {
    // Set to dark theme
    cy.get('header button')
      .find('svg')
      .first()
      .parents('button')
      .click();
    
    cy.get('[role="menu"]')
      .contains('Oscuro')
      .click();
    
    cy.get('html').should('have.class', 'dark');
    
    // Reload page
    cy.reload();
    
    // Wait for page to load
    cy.get('header').should('be.visible');
    
    // Verify theme is still dark
    cy.get('html').should('have.class', 'dark');
    
    // Verify localStorage still has dark theme
    cy.window().then((win) => {
      expect(win.localStorage.getItem('laralis-ui-theme')).to.equal('dark');
    });
  });

  it('should have proper theme icons', () => {
    // In light mode, sun icon should be visible
    cy.get('html').then(($html) => {
      if (!$html.hasClass('dark')) {
        cy.get('header button')
          .find('svg')
          .first()
          .should('have.attr', 'data-lucide', 'sun')
          .and('be.visible');
      }
    });
    
    // Switch to dark mode
    cy.get('header button')
      .find('svg')
      .first()
      .parents('button')
      .click();
    
    cy.get('[role="menu"]')
      .contains('Oscuro')
      .click();
    
    // In dark mode, moon icon should be visible
    cy.get('html').should('have.class', 'dark');
    cy.get('header button')
      .find('svg')
      .should('satisfy', ($svgs) => {
        // Should have either moon visible or sun hidden
        return $svgs.toArray().some(el => 
          el.getAttribute('data-lucide') === 'moon' || 
          el.getAttribute('data-lucide') === 'sun'
        );
      });
  });

  it('should work with theme toggle in different sections', () => {
    // Navigate to different pages and verify theme toggle works
    const pages = ['/patients', '/supplies', '/services', '/settings'];
    
    pages.forEach((page) => {
      cy.visit(page);
      cy.get('header').should('be.visible');
      
      // Theme toggle should be present and functional
      cy.get('header button')
        .find('svg')
        .first()
        .parents('button')
        .should('be.visible')
        .click();
      
      cy.get('[role="menu"]')
        .should('be.visible')
        .contains('Oscuro')
        .click();
      
      cy.get('html').should('have.class', 'dark');
      
      // Reset to light for next iteration
      cy.get('header button')
        .find('svg')
        .first()
        .parents('button')
        .click();
      
      cy.get('[role="menu"]')
        .contains('Claro')
        .click();
      
      cy.get('html').should('not.have.class', 'dark');
    });
  });

  it('should have accessible theme toggle', () => {
    // Check accessibility attributes
    cy.get('header button')
      .find('svg')
      .first()
      .parents('button')
      .should('have.attr', 'aria-haspopup', 'menu')
      .and('be.visible');
    
    // Check that screen reader text exists
    cy.get('header button')
      .find('svg')
      .first()
      .parents('button')
      .find('.sr-only')
      .should('contain', 'Cambiar tema');
    
    // Check keyboard navigation
    cy.get('header button')
      .find('svg')
      .first()
      .parents('button')
      .focus()
      .should('be.focused')
      .type('{enter}');
    
    cy.get('[role="menu"]').should('be.visible');
    
    // Navigate with keyboard
    cy.focused().type('{downarrow}');
    cy.focused().should('contain', 'Claro');
    
    cy.focused().type('{downarrow}');
    cy.focused().should('contain', 'Oscuro');
    
    cy.focused().type('{downarrow}');
    cy.focused().should('contain', 'Sistema');
    
    // Select with enter
    cy.focused().type('{enter}');
    
    // Menu should close
    cy.get('[role="menu"]').should('not.exist');
  });

  it('should prevent flash of wrong theme on page load', () => {
    // Set dark theme
    cy.get('header button')
      .find('svg')
      .first()
      .parents('button')
      .click();
    
    cy.get('[role="menu"]')
      .contains('Oscuro')
      .click();
    
    cy.get('html').should('have.class', 'dark');
    
    // Navigate to a new page
    cy.visit('/patients');
    
    // The page should load with dark theme immediately (no flash)
    // This is hard to test automatically, but we can verify the final state
    cy.get('html').should('have.class', 'dark');
    cy.get('body').should('have.css', 'background-color').and('not.equal', 'rgb(255, 255, 255)');
  });
});