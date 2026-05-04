function captureStageVisualSnapshot(options) {
  cy.task('captureStageVisualSnapshot', options).then((result) => {
    if (!result.passed) {
      throw new Error(result.error || `${options.baselineName} visual snapshot failed`)
    }

    expect(result.passed, `${options.baselineName} visual snapshot`).to.eq(true)
    if (!result.updated && typeof result.ratio === 'number') {
      expect(result.ratio, `${options.baselineName} diff ratio`).to.be.lte(options.maxDiffRatio ?? 0.02)
    }
  })
}

describe('Stage visual regression baselines', () => {
  it('matches the desktop dashboard overview light baseline', () => {
    captureStageVisualSnapshot({
      routePath: '/',
      theme: 'light',
      viewport: { width: 1440, height: 900 },
      tabPattern: 'Resumen|Overview',
      waitForSelectors: ['[data-testid="revenue-chart"] .recharts-wrapper'],
      snapshotSelector: 'viewport',
      baselineName: 'dashboard-overview-desktop-light',
      maxDiffRatio: 0.03,
      threshold: 0.12,
    })
  })

  it('matches the desktop marketing dark baseline', () => {
    captureStageVisualSnapshot({
      routePath: '/',
      theme: 'dark',
      viewport: { width: 1440, height: 900 },
      tabPattern: 'Marketing|Mercadotecnia',
      waitForSelectors: [
        '[data-testid="channel-roi-chart"] .recharts-wrapper',
        '[data-testid="cac-trend-chart"] .recharts-wrapper',
      ],
      waitForText: 'Meta Mayo',
      baselineName: 'dashboard-marketing-desktop-dark',
      maxDiffRatio: 0.03,
      threshold: 0.12,
    })
  })

  it('matches the mobile patients dark baseline', () => {
    captureStageVisualSnapshot({
      routePath: '/patients',
      theme: 'dark',
      viewport: { width: 390, height: 844 },
      waitForText: 'Pacientes|Patients',
      baselineName: 'patients-list-mobile-dark',
      maxDiffRatio: 0.04,
      threshold: 0.12,
    })
  })

  it('matches the desktop profitability reports dark baseline', () => {
    captureStageVisualSnapshot({
      routePath: '/',
      theme: 'dark',
      viewport: { width: 1440, height: 1000 },
      tabPattern: 'Rentabilidad|Profitability|Profitabilidad',
      waitForText: 'Rentabilidad|Profitability|Punto de equilibrio|Break-even',
      baselineName: 'reports-profitability-desktop-dark',
      maxDiffRatio: 0.04,
      threshold: 0.12,
    })
  })

  it('matches the seeded patient detail desktop baseline', () => {
    captureStageVisualSnapshot({
      routePath: '/',
      theme: 'light',
      viewport: { width: 1440, height: 1200 },
      actions: [
        { type: 'openFirstPatientWithHistory' },
      ],
      waitForSelectors: [
        '[data-testid="patient-detail-page"]',
        '[data-testid="patient-treatment-history"]',
      ],
      waitForText: 'Tratamientos|Treatments|Historial|History',
      snapshotSelector: '[data-testid="patient-detail-page"]',
      minWidth: 720,
      minHeight: 500,
      baselineName: 'patient-detail-history-desktop-light',
      maxDiffRatio: 0.04,
      threshold: 0.12,
    })
  })

  it('matches the desktop new patient form baseline', () => {
    captureStageVisualSnapshot({
      routePath: '/patients',
      theme: 'light',
      viewport: { width: 1440, height: 900 },
      actions: [
        { type: 'clickRole', name: 'Agregar paciente|Add patient|Nuevo paciente|New patient' },
        { type: 'waitForSelector', selector: '[role="dialog"]' },
      ],
      waitForText: 'Crear paciente|Create patient|Nombre|First name',
      snapshotSelector: '[role="dialog"]',
      minWidth: 520,
      minHeight: 420,
      baselineName: 'patient-form-desktop-light',
      maxDiffRatio: 0.04,
      threshold: 0.12,
    })
  })

  it('matches the desktop new treatment form baseline', () => {
    captureStageVisualSnapshot({
      routePath: '/treatments',
      theme: 'dark',
      viewport: { width: 1440, height: 900 },
      actions: [
        { type: 'clickRole', name: 'Agregar tratamiento|Add treatment|Nuevo tratamiento|New treatment' },
        { type: 'waitForSelector', selector: '[role="dialog"]' },
      ],
      waitForText: 'Nuevo tratamiento|New treatment|Paciente|Patient',
      snapshotSelector: '[role="dialog"]',
      minWidth: 520,
      minHeight: 420,
      baselineName: 'treatment-form-desktop-dark',
      maxDiffRatio: 0.04,
      threshold: 0.12,
    })
  })

  it('matches the mobile public booking baseline', () => {
    captureStageVisualSnapshot({
      routePath: '__public_booking_clinic__',
      theme: 'light',
      viewport: { width: 390, height: 844 },
      waitForText: 'Reservar|Book|Cita|Appointment|Limpieza QA',
      snapshotSelector: 'body',
      minWidth: 300,
      minHeight: 500,
      baselineName: 'public-booking-mobile-light',
      maxDiffRatio: 0.04,
      threshold: 0.12,
    })
  })

  it('matches the desktop Lara query panel baseline', () => {
    captureStageVisualSnapshot({
      routePath: '/',
      theme: 'dark',
      viewport: { width: 1440, height: 900 },
      hideAssistant: false,
      actions: [
        { type: 'clickSelector', selector: '[data-testid="lara-fab"]' },
        { type: 'clickSelector', selector: '[data-testid="lara-query-mode"]' },
        { type: 'waitForSelector', selector: '[data-testid="lara-query-assistant"]' },
      ],
      waitForText: 'Lara|Consulta|Query',
      snapshotSelector: 'viewport',
      baselineName: 'lara-query-panel-desktop-dark',
      maxDiffRatio: 0.04,
      threshold: 0.12,
    })
  })

  it('matches the mobile service form baseline', () => {
    captureStageVisualSnapshot({
      routePath: '/services',
      theme: 'light',
      viewport: { width: 390, height: 844 },
      actions: [
        { type: 'clickRole', name: 'Add service|Agregar servicio|New service|Nuevo servicio' },
        { type: 'waitForSelector', selector: '[role="dialog"]' },
      ],
      waitForText: 'Crear servicio|Create service|Nombre|Name|Precio|Price|Duraci.n|Duration',
      snapshotSelector: '[role="dialog"]',
      minWidth: 340,
      minHeight: 520,
      baselineName: 'service-form-mobile-light',
      maxDiffRatio: 0.04,
      threshold: 0.12,
    })
  })
})
