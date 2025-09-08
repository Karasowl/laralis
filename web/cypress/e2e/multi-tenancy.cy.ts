describe('Multi-Tenancy Isolation', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!'
  };

  const clinic1Data = {
    name: 'Clínica Dental Norte',
    patient: {
      first_name: 'Juan',
      last_name: 'Pérez',
      email: 'juan@example.com',
      phone: '555-1234'
    },
    supply: {
      name: 'Guantes Látex',
      unit: 'caja',
      quantity_per_unit: 100,
      cost_per_unit_cents: 15000
    },
    service: {
      name: 'Limpieza Dental',
      duration_minutes: 30,
      margin_percentage: 50
    }
  };

  const clinic2Data = {
    name: 'Clínica Dental Sur',
    patient: {
      first_name: 'María',
      last_name: 'González',
      email: 'maria@example.com',
      phone: '555-5678'
    },
    supply: {
      name: 'Mascarillas',
      unit: 'paquete',
      quantity_per_unit: 50,
      cost_per_unit_cents: 8000
    },
    service: {
      name: 'Extracción Simple',
      duration_minutes: 45,
      margin_percentage: 60
    }
  };

  beforeEach(() => {
    // Reset database state
    cy.task('db:reset');
    
    // Login
    cy.visit('/login');
    cy.get('input[name="email"]').type(testUser.email);
    cy.get('input[name="password"]').type(testUser.password);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });

  describe('Clinic Isolation', () => {
    it('should isolate patients between clinics', () => {
      // Create patient in clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/patients');
      cy.get('[data-cy="add-patient"]').click();
      cy.fillPatientForm(clinic1Data.patient);
      cy.get('[data-cy="save-patient"]').click();
      cy.contains(clinic1Data.patient.first_name).should('be.visible');

      // Switch to clinic 2
      cy.selectClinic(clinic2Data.name);
      cy.visit('/patients');
      
      // Patient from clinic 1 should NOT be visible
      cy.contains(clinic1Data.patient.first_name).should('not.exist');
      
      // Create patient in clinic 2
      cy.get('[data-cy="add-patient"]').click();
      cy.fillPatientForm(clinic2Data.patient);
      cy.get('[data-cy="save-patient"]').click();
      cy.contains(clinic2Data.patient.first_name).should('be.visible');

      // Switch back to clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/patients');
      
      // Should see clinic 1 patient but NOT clinic 2 patient
      cy.contains(clinic1Data.patient.first_name).should('be.visible');
      cy.contains(clinic2Data.patient.first_name).should('not.exist');
    });

    it('should isolate supplies between clinics', () => {
      // Create supply in clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/supplies');
      cy.get('[data-cy="add-supply"]').click();
      cy.fillSupplyForm(clinic1Data.supply);
      cy.get('[data-cy="save-supply"]').click();
      cy.contains(clinic1Data.supply.name).should('be.visible');

      // Switch to clinic 2
      cy.selectClinic(clinic2Data.name);
      cy.visit('/supplies');
      
      // Supply from clinic 1 should NOT be visible
      cy.contains(clinic1Data.supply.name).should('not.exist');
      
      // Create supply in clinic 2
      cy.get('[data-cy="add-supply"]').click();
      cy.fillSupplyForm(clinic2Data.supply);
      cy.get('[data-cy="save-supply"]').click();
      cy.contains(clinic2Data.supply.name).should('be.visible');

      // Switch back to clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/supplies');
      
      // Should see clinic 1 supply but NOT clinic 2 supply
      cy.contains(clinic1Data.supply.name).should('be.visible');
      cy.contains(clinic2Data.supply.name).should('not.exist');
    });

    it('should isolate services between clinics', () => {
      // Create service in clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/services');
      cy.get('[data-cy="add-service"]').click();
      cy.fillServiceForm(clinic1Data.service);
      cy.get('[data-cy="save-service"]').click();
      cy.contains(clinic1Data.service.name).should('be.visible');

      // Switch to clinic 2
      cy.selectClinic(clinic2Data.name);
      cy.visit('/services');
      
      // Service from clinic 1 should NOT be visible
      cy.contains(clinic1Data.service.name).should('not.exist');
      
      // Create service in clinic 2
      cy.get('[data-cy="add-service"]').click();
      cy.fillServiceForm(clinic2Data.service);
      cy.get('[data-cy="save-service"]').click();
      cy.contains(clinic2Data.service.name).should('be.visible');

      // Switch back to clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/services');
      
      // Should see clinic 1 service but NOT clinic 2 service
      cy.contains(clinic1Data.service.name).should('be.visible');
      cy.contains(clinic2Data.service.name).should('not.exist');
    });
  });

  describe('Marketing System Isolation', () => {
    it('should show system platforms to all clinics', () => {
      // Check clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/settings/marketing');
      
      // System platforms should be visible
      cy.contains('Meta Ads').should('be.visible');
      cy.contains('Google Ads').should('be.visible');
      cy.contains('TikTok Ads').should('be.visible');
      
      // Switch to clinic 2
      cy.selectClinic(clinic2Data.name);
      cy.visit('/settings/marketing');
      
      // Same system platforms should be visible
      cy.contains('Meta Ads').should('be.visible');
      cy.contains('Google Ads').should('be.visible');
      cy.contains('TikTok Ads').should('be.visible');
    });

    it('should isolate custom platforms between clinics', () => {
      const customPlatform1 = 'Instagram Influencer';
      const customPlatform2 = 'Radio Local';

      // Create custom platform in clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/settings/marketing');
      cy.get('[data-cy="add-platform"]').click();
      cy.get('input[name="display_name"]').type(customPlatform1);
      cy.get('[data-cy="save-platform"]').click();
      cy.contains(customPlatform1).should('be.visible');

      // Switch to clinic 2
      cy.selectClinic(clinic2Data.name);
      cy.visit('/settings/marketing');
      
      // Custom platform from clinic 1 should NOT be visible
      cy.contains(customPlatform1).should('not.exist');
      
      // But system platforms should still be visible
      cy.contains('Meta Ads').should('be.visible');
      
      // Create custom platform in clinic 2
      cy.get('[data-cy="add-platform"]').click();
      cy.get('input[name="display_name"]').type(customPlatform2);
      cy.get('[data-cy="save-platform"]').click();
      cy.contains(customPlatform2).should('be.visible');

      // Switch back to clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/settings/marketing');
      
      // Should see clinic 1 custom platform but NOT clinic 2's
      cy.contains(customPlatform1).should('be.visible');
      cy.contains(customPlatform2).should('not.exist');
      // System platforms should still be visible
      cy.contains('Meta Ads').should('be.visible');
    });

    it('should isolate campaigns between clinics', () => {
      const campaign1 = 'Campaña Verano 2025';
      const campaign2 = 'Descuento Navidad';

      // Create campaign in clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/settings/marketing');
      cy.get('[data-cy="add-campaign"]').click();
      cy.get('input[name="display_name"]').type(campaign1);
      cy.get('select[name="platform_id"]').select('Meta Ads');
      cy.get('[data-cy="save-campaign"]').click();
      cy.contains(campaign1).should('be.visible');

      // Switch to clinic 2
      cy.selectClinic(clinic2Data.name);
      cy.visit('/settings/marketing');
      
      // Campaign from clinic 1 should NOT be visible
      cy.contains(campaign1).should('not.exist');
      
      // Create campaign in clinic 2
      cy.get('[data-cy="add-campaign"]').click();
      cy.get('input[name="display_name"]').type(campaign2);
      cy.get('select[name="platform_id"]').select('Google Ads');
      cy.get('[data-cy="save-campaign"]').click();
      cy.contains(campaign2).should('be.visible');

      // Switch back to clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/settings/marketing');
      
      // Should see clinic 1 campaign but NOT clinic 2's
      cy.contains(campaign1).should('be.visible');
      cy.contains(campaign2).should('not.exist');
    });
  });

  describe('Settings Isolation', () => {
    it('should isolate time settings between clinics', () => {
      // Set time settings in clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/settings');
      cy.get('input[name="working_days_per_month"]').clear().type('22');
      cy.get('input[name="working_hours_per_day"]').clear().type('8');
      cy.get('[data-cy="save-settings"]').click();

      // Switch to clinic 2
      cy.selectClinic(clinic2Data.name);
      cy.visit('/settings');
      
      // Should have default values, not clinic 1's values
      cy.get('input[name="working_days_per_month"]').should('have.value', '20');
      cy.get('input[name="working_hours_per_day"]').should('have.value', '6');
      
      // Set different values for clinic 2
      cy.get('input[name="working_days_per_month"]').clear().type('25');
      cy.get('input[name="working_hours_per_day"]').clear().type('9');
      cy.get('[data-cy="save-settings"]').click();

      // Switch back to clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/settings');
      
      // Should still have clinic 1's values
      cy.get('input[name="working_days_per_month"]').should('have.value', '22');
      cy.get('input[name="working_hours_per_day"]').should('have.value', '8');
    });

    it('should isolate fixed costs between clinics', () => {
      // Add fixed cost in clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/fixed-costs');
      cy.get('[data-cy="add-cost"]').click();
      cy.get('input[name="name"]').type('Renta Local Norte');
      cy.get('input[name="amount_cents"]').type('5000000');
      cy.get('[data-cy="save-cost"]').click();
      cy.contains('Renta Local Norte').should('be.visible');

      // Switch to clinic 2
      cy.selectClinic(clinic2Data.name);
      cy.visit('/fixed-costs');
      
      // Fixed cost from clinic 1 should NOT be visible
      cy.contains('Renta Local Norte').should('not.exist');
      
      // Add different fixed cost in clinic 2
      cy.get('[data-cy="add-cost"]').click();
      cy.get('input[name="name"]').type('Renta Local Sur');
      cy.get('input[name="amount_cents"]').type('3500000');
      cy.get('[data-cy="save-cost"]').click();
      cy.contains('Renta Local Sur').should('be.visible');

      // Switch back to clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/fixed-costs');
      
      // Should see clinic 1 cost but NOT clinic 2's
      cy.contains('Renta Local Norte').should('be.visible');
      cy.contains('Renta Local Sur').should('not.exist');
    });
  });

  describe('Data Persistence', () => {
    it('should maintain data isolation after page refresh', () => {
      // Create data in clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/patients');
      cy.get('[data-cy="add-patient"]').click();
      cy.fillPatientForm(clinic1Data.patient);
      cy.get('[data-cy="save-patient"]').click();

      // Create data in clinic 2
      cy.selectClinic(clinic2Data.name);
      cy.visit('/patients');
      cy.get('[data-cy="add-patient"]').click();
      cy.fillPatientForm(clinic2Data.patient);
      cy.get('[data-cy="save-patient"]').click();

      // Refresh page
      cy.reload();

      // Verify clinic 2 data is still visible (current clinic)
      cy.contains(clinic2Data.patient.first_name).should('be.visible');
      cy.contains(clinic1Data.patient.first_name).should('not.exist');

      // Switch to clinic 1 after refresh
      cy.selectClinic(clinic1Data.name);
      cy.visit('/patients');
      
      // Verify clinic 1 data is visible
      cy.contains(clinic1Data.patient.first_name).should('be.visible');
      cy.contains(clinic2Data.patient.first_name).should('not.exist');
    });

    it('should maintain isolation after logout and login', () => {
      // Create data in clinic 1
      cy.selectClinic(clinic1Data.name);
      cy.visit('/patients');
      cy.get('[data-cy="add-patient"]').click();
      cy.fillPatientForm(clinic1Data.patient);
      cy.get('[data-cy="save-patient"]').click();

      // Logout
      cy.get('[data-cy="user-menu"]').click();
      cy.get('[data-cy="logout"]').click();

      // Login again
      cy.visit('/login');
      cy.get('input[name="email"]').type(testUser.email);
      cy.get('input[name="password"]').type(testUser.password);
      cy.get('button[type="submit"]').click();

      // Should be in clinic 1 (last selected)
      cy.visit('/patients');
      cy.contains(clinic1Data.patient.first_name).should('be.visible');

      // Switch to clinic 2
      cy.selectClinic(clinic2Data.name);
      cy.visit('/patients');
      
      // Should NOT see clinic 1 data
      cy.contains(clinic1Data.patient.first_name).should('not.exist');
    });
  });
});