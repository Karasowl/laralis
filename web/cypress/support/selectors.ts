/**
 * Centralized selectors for Cypress tests
 * Maps logical elements to actual DOM selectors
 */

export const selectors = {
  // Auth pages
  auth: {
    emailInput: 'input[type="email"]',
    passwordInput: 'input[type="password"]',
    submitButton: 'button[type="submit"]',
    errorMessage: '[role="alert"]',
    rememberCheckbox: 'input[type="checkbox"]',
    forgotPasswordLink: 'a[href*="reset"]',
    registerLink: 'a[href*="register"]',
  },

  // Navigation
  nav: {
    userMenu: 'button:has(svg)', // Button with icon
    logoutButton: 'button:contains("Logout"), button:contains("Cerrar")',
    clinicSelector: 'button:contains("Clinic"), button:contains("Clínica")',
  },

  // Patients
  patients: {
    addButton: 'button:contains("Add"), button:contains("Agregar"), button:contains("Nuevo")',
    searchInput: 'input[placeholder*="Search"], input[placeholder*="Buscar"]',
    table: 'table',
    tableRow: 'tbody tr',
    editButton: 'button:has(svg.lucide-edit)',
    deleteButton: 'button:has(svg.lucide-trash)',
    viewButton: 'button:has(svg.lucide-eye)',
  },

  // Forms
  form: {
    input: (name: string) => `input[name="${name}"]`,
    select: (name: string) => `select[name="${name}"]`,
    textarea: (name: string) => `textarea[name="${name}"]`,
    submitButton: 'button[type="submit"]',
    cancelButton: 'button:contains("Cancel"), button:contains("Cancelar")',
    saveButton: 'button:contains("Save"), button:contains("Guardar")',
  },

  // Modals/Dialogs
  modal: {
    container: '[role="dialog"]',
    title: '[role="dialog"] h2',
    closeButton: '[role="dialog"] button[aria-label*="Close"], [role="dialog"] button:has(svg.lucide-x)',
    confirmButton: '[role="dialog"] button:contains("Confirm"), [role="dialog"] button:contains("Confirmar")',
    cancelButton: '[role="dialog"] button:contains("Cancel"), [role="dialog"] button:contains("Cancelar")',
  },

  // Tables
  table: {
    header: 'thead',
    headerCell: 'thead th',
    body: 'tbody',
    row: 'tbody tr',
    cell: 'td',
    emptyState: ':contains("No data"), :contains("No hay datos")',
  },

  // Messages
  toast: {
    container: '[role="status"], [role="alert"]',
    success: '[role="status"]:contains("success"), [role="status"]:contains("éxito")',
    error: '[role="alert"]:contains("error"), [role="alert"]:contains("Error")',
  },

  // Loading states
  loading: {
    spinner: 'svg.animate-spin, .spinner, .loading',
    skeleton: '[class*="skeleton"]',
  }
};

// Helper functions to wait for elements
export const waitFor = {
  pageLoad: () => cy.get('body').should('be.visible'),
  formReady: () => cy.get('form').should('be.visible'),
  tableLoad: () => cy.get('table').should('be.visible'),
  modalOpen: () => cy.get('[role="dialog"]').should('be.visible'),
  modalClose: () => cy.get('[role="dialog"]').should('not.exist'),
  toastAppear: () => cy.get('[role="status"], [role="alert"]').should('be.visible'),
  toastDisappear: () => cy.get('[role="status"], [role="alert"]').should('not.exist'),
};

// Helper to handle both English and Spanish text
export const textMatchers = {
  login: ['Sign In', 'Log In', 'Iniciar Sesión', 'Iniciar'],
  logout: ['Sign Out', 'Log Out', 'Cerrar Sesión', 'Salir'],
  save: ['Save', 'Guardar'],
  cancel: ['Cancel', 'Cancelar'],
  delete: ['Delete', 'Eliminar'],
  edit: ['Edit', 'Editar'],
  add: ['Add', 'Agregar', 'New', 'Nuevo', 'Nueva'],
  search: ['Search', 'Buscar'],
  submit: ['Submit', 'Enviar'],
  confirm: ['Confirm', 'Confirmar'],
  close: ['Close', 'Cerrar'],
};