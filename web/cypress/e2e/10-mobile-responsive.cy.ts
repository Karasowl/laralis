describe('Mobile Responsive Design', () => {
  beforeEach(() => {
    // Clear any existing theme preference
    cy.clearLocalStorage();
    
    // Visit login page
    cy.visit('/auth/login');
    
    // Login with test user
    cy.get('input[type="email"]').type(Cypress.env('TEST_EMAIL'));
    cy.get('input[type="password"]').type(Cypress.env('TEST_PASSWORD'));
    cy.get('button[type="submit"]').click();
    
    // Wait for redirect and main page load
    cy.url().should('not.include', '/auth/login');
    cy.get('header').should('be.visible');
  });

  describe('Mobile Viewport (320px)', () => {
    beforeEach(() => {
      cy.viewport(320, 568); // iPhone SE
    });

    it('should display mobile-optimized header', () => {
      // Header should be shorter on mobile
      cy.get('header').should('have.css', 'height').and('match', /56px|3.5rem/);
      
      // Logo should be smaller
      cy.get('header').find('[data-testid="logo"]').should('exist');
      
      // App name should be shortened on mobile
      cy.get('header').should('contain', 'Dental');
      cy.get('header').should('not.contain', 'Laralis');
      
      // Navigation should be accessible
      cy.get('header button').should('have.class', 'touch-target');
    });

    it('should have touch-friendly buttons', () => {
      cy.visit('/settings');
      
      // All interactive elements should be at least 44px
      cy.get('[role="button"], button, a').each(($el) => {
        cy.wrap($el).should('satisfy', ($element) => {
          const rect = $element[0].getBoundingClientRect();
          return rect.height >= 44 || rect.width >= 44;
        });
      });
    });

    it('should stack content vertically', () => {
      cy.visit('/settings');
      
      // Cards should stack in single column
      cy.get('.grid').should('have.css', 'grid-template-columns', '1fr');
      
      // Content should be readable
      cy.get('h1, h2, h3').should('be.visible');
      
      // Text should not overflow
      cy.get('body').then(($body) => {
        const bodyWidth = $body.width();
        cy.get('p, span').each(($text) => {
          cy.wrap($text).should('satisfy', ($element) => {
            return $element.width() <= bodyWidth;
          });
        });
      });
    });

    it('should hide non-essential elements', () => {
      // Some elements should be hidden on mobile
      cy.get('.hidden-mobile').should('not.be.visible');
      
      // Mobile-only elements should be visible
      cy.get('.mobile-only').should('be.visible');
    });
  });

  describe('Tablet Viewport (768px)', () => {
    beforeEach(() => {
      cy.viewport(768, 1024); // iPad
    });

    it('should display tablet-optimized layout', () => {
      cy.visit('/settings');
      
      // Should show more content in grid
      cy.get('.grid').should('not.have.css', 'grid-template-columns', '1fr');
      
      // Header should be full height
      cy.get('header').should('have.css', 'height').and('match', /64px|4rem/);
      
      // Full app name should be visible
      cy.get('header').should('contain', 'Laralis');
    });

    it('should have appropriate spacing', () => {
      cy.visit('/settings');
      
      // Spacing should be intermediate between mobile and desktop
      cy.get('main').should('have.css', 'padding-top').and('match', /24px|1.5rem/);
    });
  });

  describe('Desktop Viewport (1280px)', () => {
    beforeEach(() => {
      cy.viewport(1280, 720); // Desktop
    });

    it('should display full desktop layout', () => {
      cy.visit('/settings');
      
      // Should show full grid layout
      cy.get('.grid').should('not.have.css', 'grid-template-columns', '1fr');
      
      // Full navigation should be visible
      cy.get('nav').should('be.visible');
      
      // Maximum content width should be constrained
      cy.get('main').should('have.css', 'max-width').and('match', /1280px|80rem/);
    });
  });

  describe('Navigation and Interactions', () => {
    it('should work across all viewport sizes', () => {
      const viewports = [
        { width: 320, height: 568, name: 'Mobile' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 1280, height: 720, name: 'Desktop' }
      ];

      viewports.forEach((viewport) => {
        cy.viewport(viewport.width, viewport.height);
        
        // Navigation should work
        cy.visit('/settings');
        cy.get('header').should('be.visible');
        
        // Theme toggle should work
        cy.get('header button').contains('button', 'Cambiar tema').should('be.visible');
        
        // User menu should work
        cy.get('header button').last().click();
        cy.get('[role="menu"]').should('be.visible');
        cy.get('body').click(); // Close menu
        
        // Page navigation should work
        cy.get('a').first().should('be.visible');
      });
    });
  });

  describe('Form Interactions on Mobile', () => {
    beforeEach(() => {
      cy.viewport(320, 568);
    });

    it('should have mobile-friendly forms', () => {
      cy.visit('/profile');
      
      // Input fields should be appropriately sized
      cy.get('input').should('have.css', 'min-height').and('match', /44px|2.75rem/);
      
      // Labels should be clearly visible
      cy.get('label').should('be.visible');
      
      // Form should not cause horizontal scroll
      cy.get('form').should('satisfy', ($form) => {
        if ($form.length > 0) {
          const formWidth = $form[0].scrollWidth;
          const viewportWidth = 320;
          return formWidth <= viewportWidth;
        }
        return true;
      });
    });
  });

  describe('Accessibility on Mobile', () => {
    beforeEach(() => {
      cy.viewport(320, 568);
    });

    it('should maintain accessibility standards', () => {
      cy.visit('/settings');
      
      // Text should be readable (minimum 16px on mobile)
      cy.get('body').should('have.css', 'font-size').and('match', /16px|1rem/);
      
      // Interactive elements should have proper contrast
      cy.get('button, a').should('be.visible');
      
      // Focus should be visible on interactive elements
      cy.get('button').first().focus().should('be.focused');
    });

    it('should support keyboard navigation', () => {
      cy.visit('/settings');
      
      // Tab navigation should work
      cy.get('body').tab();
      cy.focused().should('be.visible');
      
      // Enter/Space should activate buttons
      cy.get('button').first().focus().type('{enter}');
    });
  });

  describe('Performance on Mobile', () => {
    beforeEach(() => {
      cy.viewport(320, 568);
    });

    it('should load quickly on mobile', () => {
      const startTime = Date.now();
      
      cy.visit('/settings');
      cy.get('header').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        // Should load within 3 seconds
        expect(loadTime).to.be.lessThan(3000);
      });
    });

    it('should not cause layout shifts', () => {
      cy.visit('/settings');
      
      // Wait for content to load
      cy.get('main').should('be.visible');
      
      // Check that elements are stable
      cy.get('h1').should('be.visible').and('not.move');
      cy.get('nav').should('be.visible').and('not.move');
    });
  });

  describe('Content Readability', () => {
    it('should be readable across viewport sizes', () => {
      const viewports = [320, 768, 1280];
      
      viewports.forEach((width) => {
        cy.viewport(width, 720);
        cy.visit('/settings');
        
        // Text should not be too small
        cy.get('p, span').should('have.css', 'font-size').and('match', /14px|0.875rem|16px|1rem/);
        
        // Headings should be appropriately sized
        cy.get('h1').should('have.css', 'font-size').and('match', /1.5rem|1.875rem|2.25rem/);
        
        // Line height should be appropriate for readability
        cy.get('p').should('have.css', 'line-height').and('match', /1.5|1.6|1.625/);
      });
    });
  });

  describe('Image and Media Responsiveness', () => {
    beforeEach(() => {
      cy.viewport(320, 568);
    });

    it('should handle images responsively', () => {
      cy.visit('/');
      
      // Images should not exceed container width
      cy.get('img').each(($img) => {
        cy.wrap($img).should('satisfy', ($element) => {
          const img = $element[0];
          return img.offsetWidth <= img.parentElement.offsetWidth;
        });
      });
    });
  });
});

// Custom command to check if element doesn't move
Cypress.Commands.add('not.move', { prevSubject: true }, (subject) => {
  const initialRect = subject[0].getBoundingClientRect();
  
  cy.wait(100); // Small delay
  
  cy.wrap(subject).should('satisfy', ($el) => {
    const newRect = $el[0].getBoundingClientRect();
    return (
      Math.abs(newRect.top - initialRect.top) < 1 &&
      Math.abs(newRect.left - initialRect.left) < 1
    );
  });
});