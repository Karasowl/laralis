describe('Patients Module', () => {
  beforeEach(() => {
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/patients');
  });

  describe('Patient List', () => {
    it('should display patients page', () => {
      cy.contains('h1', 'Pacientes').should('be.visible');
      cy.get('[data-cy="add-patient"]').should('be.visible');
    });

    it('should show empty state when no patients', () => {
      // Assuming clean state
      cy.contains('No hay pacientes').should('be.visible');
    });

    it('should search patients', () => {
      // First create a patient
      cy.get('[data-cy="add-patient"]').click();
      cy.get('input[name="first_name"]').type('Juan');
      cy.get('input[name="last_name"]').type('Pérez');
      cy.get('input[name="email"]').type('juan@example.com');
      cy.get('[data-cy="save-patient"]').click();
      
      // Search
      cy.get('input[placeholder*="Buscar"]').type('Juan');
      cy.contains('Juan Pérez').should('be.visible');
      
      cy.get('input[placeholder*="Buscar"]').clear().type('NoExiste');
      cy.contains('Juan Pérez').should('not.exist');
    });
  });

  describe('Create Patient', () => {
    it('should open create patient form', () => {
      cy.get('[data-cy="add-patient"]').click();
      cy.contains('Nuevo Paciente').should('be.visible');
    });

    it('should validate required fields', () => {
      cy.get('[data-cy="add-patient"]').click();
      cy.get('[data-cy="save-patient"]').click();
      cy.contains('requerido').should('be.visible');
    });

    it('should create patient with basic info', () => {
      cy.get('[data-cy="add-patient"]').click();
      
      // Fill basic info
      cy.get('input[name="first_name"]').type('María');
      cy.get('input[name="last_name"]').type('González');
      cy.get('input[name="email"]').type('maria@example.com');
      cy.get('input[name="phone"]').type('555-1234');
      
      cy.get('[data-cy="save-patient"]').click();
      
      // Verify created
      cy.contains('María González').should('be.visible');
      cy.contains('maria@example.com').should('be.visible');
    });

    it('should create patient with complete info', () => {
      cy.get('[data-cy="add-patient"]').click();
      
      // Fill all fields
      cy.get('input[name="first_name"]').type('Carlos');
      cy.get('input[name="last_name"]').type('López');
      cy.get('input[name="email"]').type('carlos@example.com');
      cy.get('input[name="phone"]').type('555-5678');
      cy.get('input[name="birth_date"]').type('1985-06-15');
      cy.get('input[name="first_visit_date"]').type('2025-01-15');
      cy.get('select[name="gender"]').select('male');
      cy.get('input[name="address"]').type('Calle Principal 123');
      cy.get('input[name="city"]').type('Ciudad de México');
      cy.get('input[name="postal_code"]').type('01234');
      cy.get('textarea[name="notes"]').type('Paciente con historial de alergias');
      
      cy.get('[data-cy="save-patient"]').click();
      
      // Verify created
      cy.contains('Carlos López').should('be.visible');
    });

    it('should create patient with marketing source', () => {
      cy.get('[data-cy="add-patient"]').click();
      
      cy.get('input[name="first_name"]').type('Ana');
      cy.get('input[name="last_name"]').type('Martínez');
      
      // Select marketing source
      cy.get('select[name="source_id"]').select('Campaña');
      
      // Should show campaign selector
      cy.get('select[name="campaign_id"]').should('be.visible');
      
      cy.get('[data-cy="save-patient"]').click();
      cy.contains('Ana Martínez').should('be.visible');
    });

    it('should create patient with referral', () => {
      // First create a patient to refer from
      cy.get('[data-cy="add-patient"]').click();
      cy.get('input[name="first_name"]').type('Referente');
      cy.get('input[name="last_name"]').type('Primero');
      cy.get('[data-cy="save-patient"]').click();
      
      // Create referred patient
      cy.get('[data-cy="add-patient"]').click();
      cy.get('input[name="first_name"]').type('Referido');
      cy.get('input[name="last_name"]').type('Segundo');
      
      // Select referral source
      cy.get('select[name="source_id"]').select('Referencia de paciente');
      
      // Should show patient selector
      cy.get('select[name="referred_by_patient_id"]').should('be.visible');
      cy.get('select[name="referred_by_patient_id"]').select('Referente Primero');
      
      cy.get('[data-cy="save-patient"]').click();
      cy.contains('Referido Segundo').should('be.visible');
    });
  });

  describe('Edit Patient', () => {
    beforeEach(() => {
      // Create a patient to edit
      cy.get('[data-cy="add-patient"]').click();
      cy.get('input[name="first_name"]').type('Editable');
      cy.get('input[name="last_name"]').type('Patient');
      cy.get('input[name="email"]').type('edit@example.com');
      cy.get('[data-cy="save-patient"]').click();
    });

    it('should open edit form', () => {
      cy.contains('tr', 'Editable Patient').find('[data-cy="edit-patient"]').click();
      cy.get('input[name="first_name"]').should('have.value', 'Editable');
    });

    it('should update patient info', () => {
      cy.contains('tr', 'Editable Patient').find('[data-cy="edit-patient"]').click();
      
      cy.get('input[name="first_name"]').clear().type('Updated');
      cy.get('input[name="phone"]').type('555-9999');
      cy.get('[data-cy="save-patient"]').click();
      
      cy.contains('Updated Patient').should('be.visible');
      cy.contains('555-9999').should('be.visible');
    });
  });

  describe('Delete Patient', () => {
    beforeEach(() => {
      // Create a patient to delete
      cy.get('[data-cy="add-patient"]').click();
      cy.get('input[name="first_name"]').type('ToDelete');
      cy.get('input[name="last_name"]').type('Patient');
      cy.get('[data-cy="save-patient"]').click();
    });

    it('should delete patient', () => {
      cy.contains('tr', 'ToDelete Patient').find('[data-cy="delete-patient"]').click();
      
      // Confirm deletion
      cy.contains('button', 'Eliminar').click();
      
      // Verify deleted
      cy.contains('ToDelete Patient').should('not.exist');
    });

    it('should cancel deletion', () => {
      cy.contains('tr', 'ToDelete Patient').find('[data-cy="delete-patient"]').click();
      
      // Cancel deletion
      cy.contains('button', 'Cancelar').click();
      
      // Verify still exists
      cy.contains('ToDelete Patient').should('be.visible');
    });
  });

  describe('Patient Details', () => {
    beforeEach(() => {
      // Create a patient with full info
      cy.get('[data-cy="add-patient"]').click();
      cy.get('input[name="first_name"]').type('Detalle');
      cy.get('input[name="last_name"]').type('Completo');
      cy.get('input[name="email"]').type('detalle@example.com');
      cy.get('input[name="phone"]').type('555-0000');
      cy.get('input[name="birth_date"]').type('1990-01-01');
      cy.get('[data-cy="save-patient"]').click();
    });

    it('should show patient details', () => {
      cy.contains('tr', 'Detalle Completo').find('[data-cy="view-patient"]').click();
      
      cy.contains('Detalle Completo').should('be.visible');
      cy.contains('detalle@example.com').should('be.visible');
      cy.contains('555-0000').should('be.visible');
      cy.contains('1990').should('be.visible');
    });

    it('should show patient treatment history', () => {
      cy.contains('tr', 'Detalle Completo').find('[data-cy="view-patient"]').click();
      
      cy.contains('Historial de Tratamientos').should('be.visible');
      // Initially empty
      cy.contains('No hay tratamientos').should('be.visible');
    });
  });
});