/**
 * Mock authentication helpers for testing without real users
 * Simulates the complete onboarding flow
 */

export const mockAuth = {
  /**
   * Intercept auth calls to simulate logged in user
   */
  setupAuthMocks: () => {
    // Mock user session
    cy.intercept('GET', '**/auth/v1/user', {
      statusCode: 200,
      body: {
        user: {
          id: 'mock-user-123',
          email: 'test@example.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2024-01-01T00:00:00.000Z'
        }
      }
    }).as('getUser');

    // Mock successful login
    cy.intercept('POST', '**/auth/v1/token*', {
      statusCode: 200,
      body: {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: {
          id: 'mock-user-123',
          email: 'test@example.com'
        }
      }
    }).as('login');

    // Mock workspace/clinic data
    cy.intercept('GET', '**/api/workspaces*', {
      statusCode: 200,
      body: {
        data: [{
          id: 'workspace-1',
          name: 'Test Workspace',
          slug: 'test-workspace',
          onboarding_completed: true
        }]
      }
    }).as('getWorkspaces');

    cy.intercept('GET', '**/api/clinics*', {
      statusCode: 200,
      body: {
        data: [{
          id: 'clinic-1',
          workspace_id: 'workspace-1',
          name: 'Test Clinic',
          address: '123 Test St',
          is_active: true
        }]
      }
    }).as('getClinics');
  },

  /**
   * Mock the complete onboarding flow
   */
  mockOnboarding: () => {
    cy.intercept('POST', '**/api/workspaces', {
      statusCode: 200,
      body: {
        data: {
          id: 'workspace-new',
          name: 'New Workspace',
          slug: 'new-workspace'
        }
      }
    }).as('createWorkspace');

    cy.intercept('POST', '**/api/clinics', {
      statusCode: 200,
      body: {
        data: {
          id: 'clinic-new',
          workspace_id: 'workspace-new',
          name: 'New Clinic'
        }
      }
    }).as('createClinic');
  },

  /**
   * Simulate authenticated state in localStorage
   */
  setAuthState: () => {
    // Supabase stores auth in localStorage
    window.localStorage.setItem('supabase.auth.token', JSON.stringify({
      currentSession: {
        access_token: 'mock-token',
        expires_at: Date.now() + 3600000,
        user: {
          id: 'mock-user-123',
          email: 'test@example.com'
        }
      }
    }));

    // Set selected clinic
    window.localStorage.setItem('selectedClinicId', 'clinic-1');
    window.localStorage.setItem('selectedWorkspaceId', 'workspace-1');
  },

  /**
   * Clear auth state
   */
  clearAuthState: () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }
};

/**
 * Command to bypass login and go directly to authenticated state
 */
Cypress.Commands.add('bypassLogin', () => {
  cy.window().then((win) => {
    // Set auth tokens
    win.localStorage.setItem('supabase.auth.token', JSON.stringify({
      currentSession: {
        access_token: 'mock-token',
        expires_at: Date.now() + 3600000,
        refresh_token: 'mock-refresh',
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          app_metadata: {
            provider: 'email'
          },
          user_metadata: {},
          created_at: '2024-01-01T00:00:00.000Z'
        }
      }
    }));

    // Set workspace and clinic
    win.localStorage.setItem('selectedClinicId', 'test-clinic-id');
    win.localStorage.setItem('selectedWorkspaceId', 'test-workspace-id');
  });

  // Setup API mocks
  mockAuth.setupAuthMocks();
});

// Add to Cypress namespace
declare global {
  namespace Cypress {
    interface Chainable {
      bypassLogin(): Chainable<void>
    }
  }
}