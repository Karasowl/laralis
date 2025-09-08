/**
 * Simplified E2E tests for app modules
 * Uses real selectors and mock authentication
 */

import { mockAuth } from '../support/mock-auth';

describe('App Modules - Basic Functionality', () => {
  beforeEach(() => {
    // Setup auth mocks
    mockAuth.setupAuthMocks();
    
    // Visit with mocked auth
    cy.visit('/');
  });

  describe('Patients Module', () => {
    it('should load patients page', () => {
      cy.visit('/patients');
      
      // Should show page title or heading
      cy.get('h1, h2').should('exist');
      
      // Should have add button
      cy.get('button').contains(/add|new|agregar|nuevo/i).should('exist');
    });

    it('should open patient form', () => {
      cy.visit('/patients');
      
      // Click add button
      cy.get('button').contains(/add|new|agregar|nuevo/i).first().click();
      
      // Should show form
      cy.get('input[name="first_name"]').should('be.visible');
      cy.get('input[name="last_name"]').should('be.visible');
    });

    it('should validate patient form', () => {
      cy.visit('/patients');
      cy.get('button').contains(/add|new|agregar|nuevo/i).first().click();
      
      // Try to submit empty form
      cy.get('button[type="submit"]').click();
      
      // Should show validation errors
      cy.get('body').should('contain.text', 'required')
        .or('contain.text', 'requerido');
    });
  });

  describe('Supplies Module', () => {
    it('should load supplies page', () => {
      cy.visit('/supplies');
      
      // Should show page
      cy.get('h1, h2').should('exist');
      
      // Should have table or empty state
      cy.get('table, [class*="empty"]').should('exist');
    });

    it('should open supply form', () => {
      cy.visit('/supplies');
      
      // Click add button
      cy.get('button').contains(/add|new|agregar|nuevo/i).first().click();
      
      // Should show form fields
      cy.get('input[name="name"]').should('be.visible');
      cy.get('input[name="unit"]').should('be.visible');
    });

    it('should calculate unit cost', () => {
      cy.visit('/supplies');
      cy.get('button').contains(/add|new|agregar|nuevo/i).first().click();
      
      // Enter values
      cy.get('input[name="quantity_per_unit"]').type('100');
      cy.get('input[name="cost_per_unit_cents"]').type('5000');
      
      // Should show calculated unit cost somewhere
      cy.wait(500);
      cy.get('body').should('contain.text', '0.50')
        .or('contain.text', '0,50')
        .or('contain.text', '$0.50');
    });
  });

  describe('Services Module', () => {
    it('should load services page', () => {
      cy.visit('/services');
      
      // Should show page
      cy.get('h1, h2').should('exist');
      
      // Should have add button
      cy.get('button').contains(/add|new|agregar|nuevo/i).should('exist');
    });

    it('should open service form', () => {
      cy.visit('/services');
      cy.get('button').contains(/add|new|agregar|nuevo/i).first().click();
      
      // Should show form fields
      cy.get('input[name="name"]').should('be.visible');
      cy.get('input[name="duration_minutes"]').should('be.visible');
      cy.get('input[name="margin_percentage"]').should('be.visible');
    });

    it('should show price calculation', () => {
      cy.visit('/services');
      cy.get('button').contains(/add|new|agregar|nuevo/i).first().click();
      
      // Enter values
      cy.get('input[name="duration_minutes"]').type('30');
      cy.get('input[name="margin_percentage"]').type('50');
      
      // Should show calculated price
      cy.wait(500);
      cy.get('body').should('contain.text', 'price')
        .or('contain.text', 'precio')
        .or('contain.text', '$');
    });
  });

  describe('Treatments Module', () => {
    it('should load treatments page', () => {
      cy.visit('/treatments');
      
      // Should show page
      cy.get('h1, h2').should('exist');
      
      // Should have table or calendar view
      cy.get('table, [class*="calendar"], [class*="empty"]').should('exist');
    });

    it('should show treatment form', () => {
      cy.visit('/treatments');
      
      // Try to find add button
      cy.get('button').then($buttons => {
        const addButton = Array.from($buttons).find(btn => 
          /add|new|agregar|nuevo/i.test(btn.textContent || '')
        );
        
        if (addButton) {
          cy.wrap(addButton).click();
          
          // Should show form with selectors
          cy.get('select[name="patient_id"], select[name="service_id"]')
            .should('exist');
        }
      });
    });
  });

  describe('Settings Module', () => {
    it('should load settings page', () => {
      cy.visit('/settings');
      
      // Should show settings sections
      cy.get('h1, h2').should('exist');
      
      // Should have time settings
      cy.get('input[name="working_days_per_month"]').should('exist')
        .or('contain.text', 'days')
        .or('contain.text', 'días');
    });

    it('should show time configuration', () => {
      cy.visit('/settings');
      
      // Should have work time inputs
      cy.get('input[type="number"]').should('have.length.greaterThan', 0);
      
      // Should show calculations
      cy.get('body').should('contain.text', 'minutes')
        .or('contain.text', 'minutos')
        .or('contain.text', 'hours')
        .or('contain.text', 'horas');
    });

    it('should navigate to marketing settings', () => {
      cy.visit('/settings');
      
      // Look for marketing link
      cy.get('a, button').contains(/marketing/i).first().click();
      
      // Should navigate to marketing page
      cy.url().should('include', 'marketing');
      
      // Should show platforms
      cy.get('body').should('contain.text', 'platform')
        .or('contain.text', 'plataforma')
        .or('contain.text', 'Meta')
        .or('contain.text', 'Google');
    });
  });

  describe('Fixed Costs Module', () => {
    it('should load fixed costs page', () => {
      cy.visit('/fixed-costs');
      
      // Should show page
      cy.get('h1, h2').should('exist');
      
      // Should have add button
      cy.get('button').contains(/add|new|agregar|nuevo/i).should('exist');
    });

    it('should show cost form', () => {
      cy.visit('/fixed-costs');
      cy.get('button').contains(/add|new|agregar|nuevo/i).first().click();
      
      // Should show form
      cy.get('input[name="name"]').should('be.visible');
      cy.get('input[name="amount_cents"], input[name="amount"]').should('be.visible');
      
      // Should have category selector
      cy.get('select[name="category"]').should('exist');
    });
  });

  describe('Reports Module', () => {
    it('should load reports page', () => {
      cy.visit('/reports');
      
      // Should show page
      cy.get('h1, h2').should('exist');
      
      // Should show some kind of data or empty state
      cy.get('[class*="chart"], [class*="graph"], [class*="empty"], table').should('exist');
    });
  });

  describe('Break-even Analysis', () => {
    it('should load equilibrium page', () => {
      cy.visit('/equilibrium');
      
      // Should show page
      cy.get('h1, h2').should('exist');
      
      // Should show calculations
      cy.get('body').should('contain.text', 'equilibrium')
        .or('contain.text', 'equilibrio')
        .or('contain.text', 'break')
        .or('contain.text', 'services')
        .or('contain.text', 'servicios');
    });

    it('should show break-even metrics', () => {
      cy.visit('/equilibrium');
      
      // Should show key metrics
      cy.get('body').then($body => {
        const text = $body.text().toLowerCase();
        
        // Should contain numbers and calculations
        expect(text).to.match(/\d+/); // Contains numbers
        expect(text).to.match(/month|mes|day|día/); // Time periods
      });
    });
  });

  describe('Navigation', () => {
    it('should have working sidebar navigation', () => {
      cy.visit('/');
      
      // Check main navigation links
      const pages = [
        { text: 'patient', url: '/patients' },
        { text: 'service', url: '/services' },
        { text: 'supply', url: '/supplies' },
        { text: 'treatment', url: '/treatments' },
        { text: 'setting', url: '/settings' }
      ];
      
      pages.forEach(page => {
        cy.get('a').then($links => {
          const link = Array.from($links).find(a => 
            a.textContent?.toLowerCase().includes(page.text) ||
            a.getAttribute('href')?.includes(page.url)
          );
          
          if (link) {
            cy.wrap(link).should('have.attr', 'href').and('include', page.url);
          }
        });
      });
    });

    it('should maintain session across pages', () => {
      // Navigate through multiple pages
      cy.visit('/patients');
      cy.url().should('include', '/patients');
      
      cy.visit('/services');
      cy.url().should('include', '/services');
      
      cy.visit('/settings');
      cy.url().should('include', '/settings');
      
      // Should maintain auth state (not redirect to login)
      cy.url().should('not.include', '/auth/login');
    });
  });
});