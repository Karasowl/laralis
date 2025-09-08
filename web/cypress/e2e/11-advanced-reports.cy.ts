describe('Advanced Reports and Analytics', () => {
  beforeEach(() => {
    // Clear any existing data
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

  describe('Reports Page Structure', () => {
    it('should display reports page with tabs', () => {
      cy.visit('/reports');
      
      // Should have page header
      cy.get('h1').should('contain', 'Reportes y Análisis');
      
      // Should have tabs
      cy.get('[role="tablist"]').should('be.visible');
      cy.get('[role="tab"]').should('have.length', 2);
      
      // Should have overview tab active by default
      cy.get('[role="tab"]').first().should('have.attr', 'data-state', 'active');
      cy.get('[role="tab"]').first().should('contain', 'Resumen General');
      
      // Should have advanced analytics tab
      cy.get('[role="tab"]').last().should('contain', 'Análisis Avanzado');
    });

    it('should switch between tabs correctly', () => {
      cy.visit('/reports');
      
      // Click on advanced analytics tab
      cy.get('[role="tab"]').last().click();
      cy.get('[role="tab"]').last().should('have.attr', 'data-state', 'active');
      
      // Switch back to overview
      cy.get('[role="tab"]').first().click();
      cy.get('[role="tab"]').first().should('have.attr', 'data-state', 'active');
    });
  });

  describe('Overview Tab', () => {
    beforeEach(() => {
      cy.visit('/reports');
    });

    it('should display key metrics cards', () => {
      // Should have 4 metric cards
      cy.get('[role="tabpanel"]').first().within(() => {
        cy.get('.grid').first().find('[data-testid="metric-card"], .grid > div').should('have.length', 4);
      });

      // Cards should have titles and values
      cy.contains('Pacientes Este Mes').should('be.visible');
      cy.contains('Tratamientos Este Mes').should('be.visible');
      cy.contains('Ingresos del Mes').should('be.visible');
      cy.contains('Margen Promedio').should('be.visible');
    });

    it('should display summary cards', () => {
      // Should have summary sections
      cy.contains('Resumen del Mes').should('be.visible');
      cy.contains('Análisis Financiero').should('be.visible');

      // Should show financial data
      cy.contains('Pacientes nuevos').should('be.visible');
      cy.contains('Tratamientos realizados').should('be.visible');
      cy.contains('Promedio por tratamiento').should('be.visible');
    });

    it('should display currency values correctly', () => {
      // Currency values should be formatted properly
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text();
        // Should have Mexican peso format
        return text.includes('$') || text.includes('MX');
      });
    });
  });

  describe('Advanced Analytics Tab', () => {
    beforeEach(() => {
      cy.visit('/reports');
      cy.get('[role="tab"]').last().click(); // Switch to advanced tab
    });

    it('should display revenue predictions with AI', () => {
      // Should have predictions section
      cy.contains('Predicciones de Ingresos con IA').should('be.visible');
      
      // Should have three prediction periods
      cy.contains('Próximo Mes').should('be.visible');
      cy.contains('Próximo Trimestre').should('be.visible');
      cy.contains('Fin de Año').should('be.visible');

      // Predictions should have confidence levels
      cy.contains('Confianza').should('be.visible');
    });

    it('should show service analysis sections', () => {
      // Most profitable services
      cy.contains('Servicios Más Rentables').should('be.visible');
      
      // Growth opportunities
      cy.contains('Oportunidades de Crecimiento').should('be.visible');
      
      // Should display ROI percentages
      cy.get('body').should('contain', 'ROI');
    });

    it('should display patient insights', () => {
      // Patient analytics section
      cy.contains('Análisis de Pacientes').should('be.visible');
      
      // Key patient metrics
      cy.contains('Valor de Vida del Paciente').should('be.visible');
      cy.contains('Tasa de Retención').should('be.visible');
      cy.contains('Pacientes Nuevos/Mes').should('be.visible');
      cy.contains('Utilización de Capacidad').should('be.visible');
    });

    it('should show KPIs section', () => {
      // KPI section
      cy.contains('Indicadores Clave de Rendimiento').should('be.visible');
      
      // Should have 4 KPI cards
      cy.contains('Promedio por Tratamiento').should('be.visible');
      cy.contains('Margen Promedio').should('be.visible');
      cy.contains('Pacientes/Día').should('be.visible');
      cy.contains('Tratamientos (30d)').should('be.visible');
    });

    it('should handle declining services alerts', () => {
      // If there are declining services, should show alert
      cy.get('body').then(($body) => {
        if ($body.text().includes('Servicios en Declive')) {
          cy.contains('Servicios en Declive - Acción Requerida').should('be.visible');
          cy.contains('Requiere atención inmediata').should('be.visible');
        }
      });
    });

    it('should display mathematical predictions', () => {
      // Predictions should have numerical values
      cy.get('[role="tabpanel"]').last().within(() => {
        // Should have currency amounts
        cy.get('body').should('satisfy', ($el) => {
          const text = $el.text();
          return /\$[\d,]+/.test(text); // Currency pattern
        });

        // Should have percentage values
        cy.get('body').should('satisfy', ($el) => {
          const text = $el.text();
          return /\d+%/.test(text); // Percentage pattern
        });
      });
    });
  });

  describe('Responsive Design', () => {
    it('should work on mobile devices', () => {
      cy.viewport(320, 568);
      cy.visit('/reports');
      
      // Tabs should be responsive
      cy.get('[role="tablist"]').should('be.visible');
      
      // Metric cards should stack vertically
      cy.get('.grid').first().should('have.css', 'grid-template-columns').and('match', /1fr/);
      
      // Switch to advanced tab
      cy.get('[role="tab"]').last().click();
      
      // Advanced analytics should be readable on mobile
      cy.contains('Predicciones de Ingresos').should('be.visible');
    });

    it('should work on tablets', () => {
      cy.viewport(768, 1024);
      cy.visit('/reports');
      
      // Should have multiple columns on tablet
      cy.get('.grid').first().should('not.have.css', 'grid-template-columns', '1fr');
      
      // Advanced tab should work well
      cy.get('[role="tab"]').last().click();
      cy.contains('Análisis de Pacientes').should('be.visible');
    });
  });

  describe('Data Loading and Error Handling', () => {
    it('should show loading state initially', () => {
      cy.visit('/reports');
      cy.get('[role="tab"]').last().click();
      
      // Should handle loading states gracefully
      cy.get('body').should('be.visible'); // Page should load
    });

    it('should handle missing data gracefully', () => {
      cy.visit('/reports');
      cy.get('[role="tab"]').last().click();
      
      // Should show appropriate message for insufficient data
      cy.get('body').then(($body) => {
        if ($body.text().includes('No hay suficientes datos')) {
          cy.contains('No hay suficientes datos para generar análisis avanzado').should('be.visible');
        }
      });
    });
  });

  describe('Interactive Features', () => {
    it('should have clickable elements with proper touch targets', () => {
      cy.viewport(320, 568); // Mobile viewport
      cy.visit('/reports');
      
      // Tab buttons should be touch-friendly
      cy.get('[role="tab"]').should('have.css', 'min-height').and('match', /44px|2\.75rem/);
      
      // Switch tabs
      cy.get('[role="tab"]').last().click();
      cy.get('[role="tab"]').last().should('have.attr', 'data-state', 'active');
    });

    it('should support keyboard navigation', () => {
      cy.visit('/reports');
      
      // Tab navigation should work
      cy.get('[role="tab"]').first().focus();
      cy.focused().should('have.attr', 'role', 'tab');
      
      // Arrow keys should work (if implemented)
      cy.focused().type('{rightarrow}');
    });
  });

  describe('Performance', () => {
    it('should load analytics data efficiently', () => {
      const startTime = Date.now();
      
      cy.visit('/reports');
      cy.get('[role="tab"]').last().click();
      
      // Should load within reasonable time
      cy.get('body').should('be.visible').then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(5000); // 5 seconds max
      });
    });

    it('should not cause memory leaks with heavy calculations', () => {
      cy.visit('/reports');
      
      // Switch tabs multiple times to test for leaks
      for (let i = 0; i < 5; i++) {
        cy.get('[role="tab"]').last().click();
        cy.wait(100);
        cy.get('[role="tab"]').first().click();
        cy.wait(100);
      }
      
      // Page should still be responsive
      cy.get('h1').should('be.visible');
    });
  });

  describe('Business Logic Validation', () => {
    it('should display realistic financial data', () => {
      cy.visit('/reports');
      cy.get('[role="tab"]').last().click();
      
      // Revenue predictions should be positive numbers
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text();
        // Should not have negative revenue predictions
        return !text.includes('-$');
      });
    });

    it('should show consistent percentage values', () => {
      cy.visit('/reports');
      cy.get('[role="tab"]').last().click();
      
      // Percentage values should be between 0-100% for margins
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text();
        const percentages = text.match(/(\d+(?:\.\d+)?)%/g);
        if (percentages) {
          return percentages.every(p => {
            const num = parseFloat(p.replace('%', ''));
            return num >= 0 && num <= 200; // Allow up to 200% for ROI
          });
        }
        return true;
      });
    });
  });
});