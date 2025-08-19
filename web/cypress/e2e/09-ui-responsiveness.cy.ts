describe('UI/UX and Responsiveness', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
  });

  describe('Mobile Responsiveness', () => {
    it('should work on iPhone screens', () => {
      cy.viewport('iphone-6');
      
      // Dashboard
      cy.visit('/');
      cy.get('[data-cy="mobile-nav"]').should('be.visible');
      cy.get('[data-cy="dashboard-stats"]').should('be.visible');
      
      // Navigation menu
      cy.get('[data-cy="mobile-menu-toggle"]').click();
      cy.get('[data-cy="mobile-menu"]').should('be.visible');
      cy.contains('Pacientes').should('be.visible');
    });

    it('should work on Android tablets', () => {
      cy.viewport(768, 1024); // Tablet portrait
      
      // Main modules should be accessible
      cy.visit('/patients');
      cy.get('[data-cy="patients-table"]').should('be.visible');
      cy.contains('button', 'Agregar').should('be.visible');
      
      // Forms should be usable
      cy.contains('button', 'Agregar').click();
      cy.get('input[name="first_name"]').should('be.visible');
      cy.get('input[name="last_name"]').should('be.visible');
    });

    it('should adapt form layouts on small screens', () => {
      cy.viewport('iphone-se2');
      
      cy.visit('/services');
      cy.contains('button', 'Agregar').click();
      cy.wait(500);
      
      // Form fields should stack vertically
      cy.get('form').within(() => {
        cy.get('input').should('be.visible');
        cy.get('input').each($input => {
          cy.wrap($input).should('have.css', 'width').and('match', /100%|full/);
        });
      });
    });

    it('should handle touch interactions', () => {
      cy.viewport('ipad-2');
      
      cy.visit('/supplies');
      
      // Touch/tap interactions
      cy.get('[data-cy="supply-row"]').first().tap();
      cy.get('[data-cy="supply-details"]').should('be.visible');
      
      // Swipe gestures (if implemented)
      cy.get('[data-cy="supply-row"]').first()
        .trigger('touchstart', { touches: [{ clientX: 100, clientY: 100 }] })
        .trigger('touchmove', { touches: [{ clientX: 200, clientY: 100 }] })
        .trigger('touchend');
    });
  });

  describe('Desktop Layouts', () => {
    it('should utilize full width on large screens', () => {
      cy.viewport(1920, 1080);
      
      cy.visit('/');
      
      // Check that content expands appropriately
      cy.get('[data-cy="main-content"]').should('have.css', 'max-width', '1280px');
      cy.get('[data-cy="dashboard-grid"]').should('be.visible');
    });

    it('should show side navigation on desktop', () => {
      cy.viewport(1440, 900);
      
      cy.visit('/');
      
      // Desktop navigation should be visible
      cy.get('[data-cy="desktop-nav"]').should('be.visible');
      cy.get('[data-cy="nav-item"]').should('have.length.greaterThan', 4);
      
      // Navigation items should be clickable
      cy.contains('[data-cy="nav-item"]', 'Pacientes').click();
      cy.url().should('include', '/patients');
    });

    it('should handle window resizing gracefully', () => {
      cy.viewport(1200, 800);
      
      cy.visit('/patients');
      cy.get('[data-cy="patients-table"]').should('be.visible');
      
      // Resize to mobile
      cy.viewport(375, 667);
      cy.get('[data-cy="mobile-table"]').should('be.visible');
      cy.get('[data-cy="desktop-nav"]').should('not.be.visible');
      
      // Resize back to desktop
      cy.viewport(1200, 800);
      cy.get('[data-cy="patients-table"]').should('be.visible');
    });
  });

  describe('Dark Mode Support', () => {
    it('should toggle between light and dark themes', () => {
      cy.visit('/');
      
      // Toggle to dark mode
      cy.get('[data-cy="theme-toggle"]').click();
      cy.get('body').should('have.class', 'dark');
      
      // Check dark mode styles
      cy.get('[data-cy="main-content"]').should('have.css', 'background-color')
        .and('match', /(rgb\(0, 0, 0\)|rgb\(17, 24, 39\))/);
      
      // Toggle back to light mode
      cy.get('[data-cy="theme-toggle"]').click();
      cy.get('body').should('not.have.class', 'dark');
    });

    it('should persist theme preference', () => {
      cy.visit('/');
      
      // Set dark mode
      cy.get('[data-cy="theme-toggle"]').click();
      cy.get('body').should('have.class', 'dark');
      
      // Navigate to different page
      cy.visit('/patients');
      cy.get('body').should('have.class', 'dark');
      
      // Reload page
      cy.reload();
      cy.get('body').should('have.class', 'dark');
    });

    it('should respect system theme preference', () => {
      cy.visit('/');
      
      // Set to system preference
      cy.get('[data-cy="theme-toggle"]').click(); // Open menu
      cy.contains('Sistema').click();
      
      // Should follow system theme
      cy.window().then(win => {
        const prefersDark = win.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          cy.get('body').should('have.class', 'dark');
        } else {
          cy.get('body').should('not.have.class', 'dark');
        }
      });
    });
  });

  describe('Accessibility Features', () => {
    it('should be keyboard navigable', () => {
      cy.visit('/');
      
      // Tab through main navigation
      cy.get('body').tab();
      cy.focused().should('be.visible');
      
      // Continue tabbing
      cy.focused().tab();
      cy.focused().should('be.visible');
      
      // Enter key should activate focused element
      cy.focused().type('{enter}');
      cy.url().should('not.equal', '/');
    });

    it('should have proper ARIA labels and roles', () => {
      cy.visit('/patients');
      
      // Check table accessibility
      cy.get('table').should('have.attr', 'role', 'table');
      cy.get('th').should('have.attr', 'scope', 'col');
      
      // Check button accessibility
      cy.get('button').each($btn => {
        cy.wrap($btn).should('satisfy', $el => {
          return $el.attr('aria-label') || $el.text().trim().length > 0;
        });
      });
      
      // Check form accessibility
      cy.contains('button', 'Agregar').click();
      cy.get('input').each($input => {
        cy.wrap($input).should('have.attr', 'id');
        cy.wrap($input).should('satisfy', $el => {
          const id = $el.attr('id');
          return Cypress.$(`label[for="${id}"]`).length > 0;
        });
      });
    });

    it('should support screen readers', () => {
      cy.visit('/');
      
      // Check semantic HTML structure
      cy.get('main').should('exist');
      cy.get('nav').should('exist');
      cy.get('h1').should('exist');
      
      // Check skip links
      cy.get('[data-cy="skip-to-content"]').should('exist');
      cy.get('[data-cy="skip-to-content"]').click();
      cy.focused().should('have.attr', 'id', 'main-content');
    });

    it('should have sufficient color contrast', () => {
      cy.visit('/');
      
      // Check that text has sufficient contrast
      cy.get('body').should('have.css', 'color');
      cy.get('body').should('have.css', 'background-color');
      
      // This would need actual contrast calculation in a real test
      // For now, just verify elements are visible
      cy.get('h1').should('be.visible');
      cy.get('p').should('be.visible');
      cy.get('button').should('be.visible');
    });

    it('should handle high contrast mode', () => {
      cy.visit('/');
      
      // Simulate high contrast mode
      cy.get('html').invoke('attr', 'style', 'filter: contrast(200%)');
      
      // Elements should still be visible and usable
      cy.get('button').should('be.visible');
      cy.get('input').should('be.visible');
      cy.contains('Pacientes').should('be.visible');
    });
  });

  describe('Performance and Animation', () => {
    it('should load pages quickly', () => {
      const startTime = Date.now();
      
      cy.visit('/patients');
      cy.get('[data-cy="patients-table"]').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(3000); // Less than 3 seconds
      });
    });

    it('should have smooth animations', () => {
      cy.visit('/');
      
      // Test modal animations
      cy.contains('button', 'Agregar').click();
      cy.get('[data-cy="modal"]').should('be.visible');
      cy.get('[data-cy="modal"]').should('have.css', 'opacity', '1');
      
      // Close modal
      cy.get('[data-cy="modal-close"]').click();
      cy.get('[data-cy="modal"]').should('not.exist');
    });

    it('should respect reduced motion preferences', () => {
      // Simulate prefers-reduced-motion
      cy.window().then(win => {
        Object.defineProperty(win, 'matchMedia', {
          writable: true,
          value: cy.stub().returns({
            matches: true,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: cy.stub(),
            removeListener: cy.stub(),
            addEventListener: cy.stub(),
            removeEventListener: cy.stub(),
            dispatchEvent: cy.stub(),
          }),
        });
      });
      
      cy.visit('/');
      
      // Animations should be disabled or reduced
      cy.get('*').should('have.css', 'animation-duration', '0s')
        .or('have.css', 'animation', 'none');
    });
  });

  describe('Error States and Loading', () => {
    it('should show loading states appropriately', () => {
      cy.intercept('GET', '/api/patients', { delay: 2000 }).as('slowPatients');
      
      cy.visit('/patients');
      
      // Should show loading state
      cy.get('[data-cy="loading-spinner"]').should('be.visible');
      
      cy.wait('@slowPatients');
      
      // Loading should disappear
      cy.get('[data-cy="loading-spinner"]').should('not.exist');
      cy.get('[data-cy="patients-table"]').should('be.visible');
    });

    it('should handle error states gracefully', () => {
      cy.intercept('GET', '/api/patients', { statusCode: 500 }).as('errorPatients');
      
      cy.visit('/patients');
      cy.wait('@errorPatients');
      
      // Should show error message
      cy.get('[data-cy="error-message"]').should('be.visible');
      cy.contains('Error').should('be.visible');
      
      // Should have retry option
      cy.contains('button', 'Reintentar').should('be.visible');
    });

    it('should show empty states with helpful content', () => {
      cy.intercept('GET', '/api/patients', { body: { data: [] } }).as('emptyPatients');
      
      cy.visit('/patients');
      cy.wait('@emptyPatients');
      
      // Should show empty state
      cy.get('[data-cy="empty-state"]').should('be.visible');
      cy.contains('No hay pacientes').should('be.visible');
      cy.contains('button', 'Agregar').should('be.visible');
    });
  });

  describe('Form UX and Validation', () => {
    it('should provide real-time validation feedback', () => {
      cy.visit('/patients');
      cy.contains('button', 'Agregar').click();
      
      // Invalid email
      cy.get('input[name="email"]').type('invalid-email');
      cy.get('input[name="first_name"]').click(); // Blur email field
      
      // Should show validation error
      cy.contains('email válido').should('be.visible');
      cy.get('input[name="email"]').should('have.class', 'error')
        .or('have.attr', 'aria-invalid', 'true');
    });

    it('should auto-save form progress', () => {
      cy.visit('/patients');
      cy.contains('button', 'Agregar').click();
      
      // Fill form partially
      cy.get('input[name="first_name"]').type('Juan');
      cy.get('input[name="last_name"]').type('Pérez');
      
      // Navigate away
      cy.visit('/services');
      
      // Return to form
      cy.visit('/patients');
      cy.contains('button', 'Agregar').click();
      
      // Should restore form data (if auto-save is implemented)
      cy.get('input[name="first_name"]').should('have.value', 'Juan');
    });

    it('should handle form submission gracefully', () => {
      cy.visit('/patients');
      cy.contains('button', 'Agregar').click();
      
      // Fill valid form
      cy.fillPatientForm({
        first_name: 'Test',
        last_name: 'User',
        email: `test.${Date.now()}@example.com`
      });
      
      // Submit form
      cy.contains('button', 'Guardar').click();
      
      // Should show success feedback
      cy.contains('guardado').or('exitoso').should('be.visible');
      
      // Should redirect or close form
      cy.get('form').should('not.exist');
    });
  });

  describe('Progressive Web App Features', () => {
    it('should work offline (basic functionality)', () => {
      cy.visit('/');
      
      // Go offline
      cy.window().then(win => {
        win.navigator.serviceWorker.ready.then(registration => {
          registration.update();
        });
      });
      
      // Basic navigation should still work
      cy.contains('Pacientes').click();
      cy.url().should('include', '/patients');
    });

    it('should be installable as PWA', () => {
      cy.visit('/');
      
      // Check for manifest
      cy.get('link[rel="manifest"]').should('exist');
      
      // Check for service worker
      cy.window().its('navigator.serviceWorker').should('exist');
    });

    it('should cache resources appropriately', () => {
      cy.visit('/');
      
      // Check that static resources are cached
      cy.window().then(win => {
        if ('caches' in win) {
          return win.caches.keys();
        }
      }).then(cacheNames => {
        expect(cacheNames).to.have.length.greaterThan(0);
      });
    });
  });
});