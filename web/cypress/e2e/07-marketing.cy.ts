describe('Marketing System', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/settings/marketing');
  });

  describe('Marketing Platforms', () => {
    it('should display marketing settings page', () => {
      cy.contains('h1', 'Marketing').should('be.visible');
      cy.contains('Plataformas de Marketing').should('be.visible');
      cy.contains('Campañas').should('be.visible');
    });

    it('should show system platforms', () => {
      // System platforms should always be visible
      const systemPlatforms = [
        'Meta Ads',
        'Google Ads',
        'TikTok Ads',
        'LinkedIn Ads',
        'Twitter Ads'
      ];

      systemPlatforms.forEach(platform => {
        cy.contains(platform).should('be.visible');
      });
    });

    it('should not allow editing system platforms', () => {
      // System platforms should not have edit/delete buttons
      cy.contains('tr', 'Meta Ads').within(() => {
        cy.get('[data-cy="edit-platform"]').should('not.exist');
        cy.get('[data-cy="delete-platform"]').should('not.exist');
      });
    });

    it('should create custom platform', () => {
      cy.get('[data-cy="add-platform"]').click();
      
      cy.get('input[name="display_name"]').type('Instagram Influencers');
      cy.get('textarea[name="description"]').type('Colaboraciones con influencers locales');
      
      cy.get('[data-cy="save-platform"]').click();
      
      // Verify created
      cy.contains('Instagram Influencers').should('be.visible');
      
      // Custom platform should have edit/delete buttons
      cy.contains('tr', 'Instagram Influencers').within(() => {
        cy.get('[data-cy="edit-platform"]').should('be.visible');
        cy.get('[data-cy="delete-platform"]').should('be.visible');
      });
    });

    it('should edit custom platform', () => {
      // Create platform
      cy.get('[data-cy="add-platform"]').click();
      cy.get('input[name="display_name"]').type('Editable Platform');
      cy.get('[data-cy="save-platform"]').click();
      
      // Edit
      cy.contains('tr', 'Editable Platform').find('[data-cy="edit-platform"]').click();
      cy.get('input[name="display_name"]').clear().type('Updated Platform');
      cy.get('[data-cy="save-platform"]').click();
      
      cy.contains('Updated Platform').should('be.visible');
      cy.contains('Editable Platform').should('not.exist');
    });

    it('should delete custom platform', () => {
      // Create platform
      cy.get('[data-cy="add-platform"]').click();
      cy.get('input[name="display_name"]').type('ToDelete Platform');
      cy.get('[data-cy="save-platform"]').click();
      
      // Delete
      cy.contains('tr', 'ToDelete Platform').find('[data-cy="delete-platform"]').click();
      cy.contains('button', 'Eliminar').click();
      
      cy.contains('ToDelete Platform').should('not.exist');
    });

    it('should activate/deactivate platforms', () => {
      // Create platform
      cy.get('[data-cy="add-platform"]').click();
      cy.get('input[name="display_name"]').type('Toggle Platform');
      cy.get('[data-cy="save-platform"]').click();
      
      // Deactivate
      cy.contains('tr', 'Toggle Platform').find('[data-cy="toggle-platform"]').click();
      cy.contains('tr', 'Toggle Platform').should('have.class', 'inactive');
      
      // Activate
      cy.contains('tr', 'Toggle Platform').find('[data-cy="toggle-platform"]').click();
      cy.contains('tr', 'Toggle Platform').should('not.have.class', 'inactive');
    });
  });

  describe('Marketing Campaigns', () => {
    beforeEach(() => {
      // Ensure we have platforms for campaigns
      cy.get('[data-cy="add-platform"]').click();
      cy.get('input[name="display_name"]').type('Test Platform');
      cy.get('[data-cy="save-platform"]').click();
    });

    it('should create campaign', () => {
      cy.get('[data-cy="add-campaign"]').click();
      
      cy.get('input[name="display_name"]').type('Campaña Verano 2025');
      cy.get('select[name="platform_id"]').select('Meta Ads');
      cy.get('input[name="start_date"]').type('2025-06-01');
      cy.get('input[name="end_date"]').type('2025-08-31');
      cy.get('input[name="budget_cents"]').type('5000000');
      cy.get('textarea[name="description"]').type('Promoción de blanqueamiento dental');
      
      cy.get('[data-cy="save-campaign"]').click();
      
      // Verify created
      cy.contains('Campaña Verano 2025').should('be.visible');
      cy.contains('Meta Ads').should('be.visible');
      cy.contains('$50,000.00').should('be.visible');
    });

    it('should create campaign for custom platform', () => {
      cy.get('[data-cy="add-campaign"]').click();
      
      cy.get('input[name="display_name"]').type('Campaña Local');
      cy.get('select[name="platform_id"]').select('Test Platform');
      cy.get('input[name="budget_cents"]').type('1000000');
      
      cy.get('[data-cy="save-campaign"]').click();
      
      cy.contains('Campaña Local').should('be.visible');
      cy.contains('Test Platform').should('be.visible');
    });

    it('should edit campaign', () => {
      // Create campaign
      cy.get('[data-cy="add-campaign"]').click();
      cy.get('input[name="display_name"]').type('Editable Campaign');
      cy.get('select[name="platform_id"]').select('Google Ads');
      cy.get('[data-cy="save-campaign"]').click();
      
      // Edit
      cy.contains('tr', 'Editable Campaign').find('[data-cy="edit-campaign"]').click();
      cy.get('input[name="display_name"]').clear().type('Updated Campaign');
      cy.get('input[name="budget_cents"]').type('2000000');
      cy.get('[data-cy="save-campaign"]').click();
      
      cy.contains('Updated Campaign').should('be.visible');
      cy.contains('$20,000.00').should('be.visible');
    });

    it('should delete campaign', () => {
      // Create campaign
      cy.get('[data-cy="add-campaign"]').click();
      cy.get('input[name="display_name"]').type('ToDelete Campaign');
      cy.get('select[name="platform_id"]').select('TikTok Ads');
      cy.get('[data-cy="save-campaign"]').click();
      
      // Delete
      cy.contains('tr', 'ToDelete Campaign').find('[data-cy="delete-campaign"]').click();
      cy.contains('button', 'Eliminar').click();
      
      cy.contains('ToDelete Campaign').should('not.exist');
    });

    it('should show campaign status', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      // Past campaign
      cy.get('[data-cy="add-campaign"]').click();
      cy.get('input[name="display_name"]').type('Past Campaign');
      cy.get('select[name="platform_id"]').select('Meta Ads');
      cy.get('input[name="start_date"]').type('2024-01-01');
      cy.get('input[name="end_date"]').type('2024-12-31');
      cy.get('[data-cy="save-campaign"]').click();
      
      // Active campaign
      cy.get('[data-cy="add-campaign"]').click();
      cy.get('input[name="display_name"]').type('Active Campaign');
      cy.get('select[name="platform_id"]').select('Google Ads');
      cy.get('input[name="start_date"]').type(yesterday.toISOString().split('T')[0]);
      cy.get('input[name="end_date"]').type(nextMonth.toISOString().split('T')[0]);
      cy.get('[data-cy="save-campaign"]').click();
      
      // Future campaign
      cy.get('[data-cy="add-campaign"]').click();
      cy.get('input[name="display_name"]').type('Future Campaign');
      cy.get('select[name="platform_id"]').select('TikTok Ads');
      cy.get('input[name="start_date"]').type(tomorrow.toISOString().split('T')[0]);
      cy.get('input[name="end_date"]').type(nextMonth.toISOString().split('T')[0]);
      cy.get('[data-cy="save-campaign"]').click();
      
      // Verify status indicators
      cy.contains('tr', 'Past Campaign').should('have.class', 'ended');
      cy.contains('tr', 'Active Campaign').should('have.class', 'active');
      cy.contains('tr', 'Future Campaign').should('have.class', 'scheduled');
    });

    it('should track campaign performance', () => {
      // Create campaign
      cy.get('[data-cy="add-campaign"]').click();
      cy.get('input[name="display_name"]').type('Performance Campaign');
      cy.get('select[name="platform_id"]').select('Meta Ads');
      cy.get('input[name="budget_cents"]').type('3000000');
      cy.get('[data-cy="save-campaign"]').click();
      
      // Add performance metrics
      cy.contains('tr', 'Performance Campaign').find('[data-cy="track-performance"]').click();
      cy.get('input[name="impressions"]').type('50000');
      cy.get('input[name="clicks"]').type('1500');
      cy.get('input[name="conversions"]').type('25');
      cy.get('[data-cy="save-performance"]').click();
      
      // Verify metrics
      cy.contains('tr', 'Performance Campaign').within(() => {
        cy.contains('3%').should('be.visible'); // CTR
        cy.contains('1.67%').should('be.visible'); // Conversion rate
        cy.contains('$1,200').should('be.visible'); // Cost per conversion
      });
    });
  });

  describe('Patient Attribution', () => {
    beforeEach(() => {
      // Create campaigns for attribution
      cy.get('[data-cy="add-campaign"]').click();
      cy.get('input[name="display_name"]').type('Facebook Promo');
      cy.get('select[name="platform_id"]').select('Meta Ads');
      cy.get('[data-cy="save-campaign"]').click();
      
      cy.get('[data-cy="add-campaign"]').click();
      cy.get('input[name="display_name"]').type('Google Search');
      cy.get('select[name="platform_id"]').select('Google Ads');
      cy.get('[data-cy="save-campaign"]').click();
    });

    it('should attribute patient to campaign', () => {
      cy.visit('/patients');
      cy.get('[data-cy="add-patient"]').click();
      
      cy.get('input[name="first_name"]').type('Marketing');
      cy.get('input[name="last_name"]').type('Patient');
      
      // Select campaign source
      cy.get('select[name="source_id"]').select('Campaña');
      
      // Campaign selector should appear
      cy.get('select[name="campaign_id"]').should('be.visible');
      cy.get('select[name="campaign_id"]').select('Facebook Promo');
      
      cy.get('[data-cy="save-patient"]').click();
      
      // Verify attribution
      cy.contains('tr', 'Marketing Patient').find('[data-cy="view-patient"]').click();
      cy.contains('Fuente: Campaña').should('be.visible');
      cy.contains('Facebook Promo').should('be.visible');
    });

    it('should show campaign ROI', () => {
      // Create patients from campaign
      for (let i = 1; i <= 3; i++) {
        cy.visit('/patients');
        cy.get('[data-cy="add-patient"]').click();
        cy.get('input[name="first_name"]').type(`Campaign${i}`);
        cy.get('input[name="last_name"]').type('Patient');
        cy.get('select[name="source_id"]').select('Campaña');
        cy.get('select[name="campaign_id"]').select('Google Search');
        cy.get('[data-cy="save-patient"]').click();
      }
      
      // View campaign details
      cy.visit('/settings/marketing');
      cy.contains('tr', 'Google Search').find('[data-cy="view-campaign"]').click();
      
      // Should show attribution metrics
      cy.contains('Pacientes atribuidos: 3').should('be.visible');
      cy.contains('Valor de por vida').should('be.visible');
      cy.contains('ROI').should('be.visible');
    });
  });

  describe('Marketing Reports', () => {
    it('should show platform comparison', () => {
      cy.get('[data-cy="marketing-reports"]').click();
      
      cy.contains('Comparación de Plataformas').should('be.visible');
      cy.contains('Meta Ads').should('be.visible');
      cy.contains('Google Ads').should('be.visible');
      
      // Should show metrics for each platform
      cy.get('[data-cy="platform-comparison"]').within(() => {
        cy.contains('Campañas').should('be.visible');
        cy.contains('Presupuesto').should('be.visible');
        cy.contains('Pacientes').should('be.visible');
      });
    });

    it('should show campaign timeline', () => {
      cy.get('[data-cy="marketing-reports"]').click();
      cy.get('[data-cy="campaign-timeline"]').click();
      
      cy.contains('Línea de Tiempo de Campañas').should('be.visible');
      cy.get('.timeline-chart').should('be.visible');
    });

    it('should export marketing data', () => {
      cy.get('[data-cy="marketing-reports"]').click();
      cy.get('[data-cy="export-marketing"]').click();
      
      // Select export options
      cy.get('input[name="include_platforms"]').check();
      cy.get('input[name="include_campaigns"]').check();
      cy.get('input[name="include_attribution"]').check();
      
      cy.get('[data-cy="export-csv"]').click();
      
      // Verify download
      cy.readFile('cypress/downloads/marketing-report.csv').should('exist');
    });
  });

  describe('Source Categories', () => {
    it('should show all patient source categories', () => {
      cy.visit('/patients');
      cy.get('[data-cy="add-patient"]').click();
      
      cy.get('select[name="source_id"]').click();
      
      // Verify all source categories exist
      const sources = [
        'Campaña',
        'Referencia de paciente',
        'Búsqueda en Google',
        'Redes sociales',
        'Sitio web',
        'Llamada directa',
        'Walk-in',
        'Otro'
      ];
      
      sources.forEach(source => {
        cy.get('select[name="source_id"]').select(source);
      });
    });

    it('should track organic vs paid sources', () => {
      // Create patients with different sources
      const patients = [
        { name: 'Paid1', source: 'Campaña' },
        { name: 'Organic1', source: 'Búsqueda en Google' },
        { name: 'Referral1', source: 'Referencia de paciente' },
        { name: 'Direct1', source: 'Walk-in' }
      ];
      
      patients.forEach(patient => {
        cy.visit('/patients');
        cy.get('[data-cy="add-patient"]').click();
        cy.get('input[name="first_name"]').type(patient.name);
        cy.get('input[name="last_name"]').type('Test');
        cy.get('select[name="source_id"]').select(patient.source);
        
        if (patient.source === 'Campaña') {
          cy.get('select[name="campaign_id"]').select(0); // Select first campaign
        }
        
        cy.get('[data-cy="save-patient"]').click();
      });
      
      // View source analytics
      cy.visit('/settings/marketing');
      cy.get('[data-cy="source-analytics"]').click();
      
      cy.contains('Análisis de Fuentes').should('be.visible');
      cy.contains('Pagado').should('be.visible');
      cy.contains('Orgánico').should('be.visible');
      cy.contains('Referencias').should('be.visible');
      cy.contains('Directo').should('be.visible');
    });
  });
});