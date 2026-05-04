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
})
