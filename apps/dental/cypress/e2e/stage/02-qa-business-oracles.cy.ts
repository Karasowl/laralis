type Oracles = {
  patients: {
    total: number
    bySource: Record<string, number>
  }
  treatments: {
    total: number
    byStatus: Record<string, number>
  }
  financial: {
    completedRevenueCents: number
    completedVariableCostCents: number
    allocatedFixedCostCents: number
    cashCollectedCents: number
  }
  marketing: {
    metaMayo: {
      patients: number
      spendCents: number
      revenueCents: number
      roas: number
    }
  }
}

type QaDataset = {
  clinics: Array<{ key: string; name: string }>
}

function classifyTreatment(row: any) {
  if (row.status === 'cancelled') return 'cancelled'
  if (row.status === 'pending' || row.status === 'scheduled') return 'pending'

  const price = row.price_cents || 0
  const paid = row.amount_paid_cents || 0
  if (row.status === 'completed' && paid >= price && price > 0) return 'completed_paid'
  if (row.status === 'completed' && paid > 0 && paid < price) return 'partial'
  return row.status || 'unknown'
}

function selectQaClinicA() {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
    const clinicName = dataset.clinics.find((clinic) => clinic.key === 'clinicA')?.name
    expect(clinicName, 'QA clinic A name').to.be.a('string')

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = (clinicsResponse.body.data || []).find((item: any) => item.name === clinicName)
      expect(clinic, `QA clinic ${clinicName} must exist before business oracles run`).to.exist

      return cy.request('POST', '/api/clinics', { clinicId: clinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)
      })
    })
  })
}

describe('Stage QA business oracles', () => {
  beforeEach(() => {
    cy.loginAsDoctor()
    selectQaClinicA()
  })

  it('matches seeded patient and treatment counts through authenticated APIs', () => {
    cy.readFile('../../docs/qa/oracles.json').then((oracles: Oracles) => {
      cy.request('/api/patients').then((response) => {
        expect(response.status).to.eq(200)
        const patients = response.body.data || []
        expect(
          patients,
          `patients total in QA clinic A. If this is not ${oracles.patients.total}, stage is dirty: run qa:stage:prepare before trusting business oracles.`
        ).to.have.length(oracles.patients.total)

        const bySource = patients.reduce((acc: Record<string, number>, patient: any) => {
          const sourceName = patient.source?.name || 'unknown'
          acc[sourceName] = (acc[sourceName] || 0) + 1
          return acc
        }, {})

        expect(bySource).to.include(oracles.patients.bySource)
      })

      cy.request('/api/treatments').then((response) => {
        expect(response.status).to.eq(200)
        const treatments = response.body.data || []
        expect(
          treatments,
          `treatments total in QA clinic A. If this is not ${oracles.treatments.total}, stage is dirty: run qa:stage:prepare before trusting business oracles.`
        ).to.have.length(oracles.treatments.total)

        const byStatus = treatments.reduce((acc: Record<string, number>, treatment: any) => {
          const status = classifyTreatment(treatment)
          acc[status] = (acc[status] || 0) + 1
          return acc
        }, {})

        expect(byStatus).to.include(oracles.treatments.byStatus)

        const completedPaid = treatments.filter((treatment: any) => classifyTreatment(treatment) === 'completed_paid')
        const completedRevenue = completedPaid.reduce((sum: number, treatment: any) => sum + (treatment.price_cents || 0), 0)
        const completedVariable = completedPaid.reduce((sum: number, treatment: any) => sum + (treatment.variable_cost_cents || 0), 0)
        const allocatedFixed = completedPaid.reduce((sum: number, treatment: any) => {
          return sum + (treatment.fixed_per_minute_cents || 0) * (treatment.minutes || 0)
        }, 0)
        const cashCollected = treatments.reduce((sum: number, treatment: any) => sum + (treatment.amount_paid_cents || 0), 0)

        expect(completedRevenue, 'completed revenue').to.eq(oracles.financial.completedRevenueCents)
        expect(completedVariable, 'completed variable cost').to.eq(oracles.financial.completedVariableCostCents)
        expect(allocatedFixed, 'allocated fixed cost').to.eq(oracles.financial.allocatedFixedCostCents)
        expect(cashCollected, 'cash collected').to.eq(oracles.financial.cashCollectedCents)
      })
    })
  })

  it('matches Meta Mayo ROI through the marketing API', () => {
    cy.readFile('../../docs/qa/oracles.json').then((oracles: Oracles) => {
      cy.request('/api/marketing/campaigns/roi?startDate=2026-05-01&endDate=2026-05-31').then((response) => {
        expect(response.status).to.eq(200)
        const meta = (response.body.data || []).find((campaign: any) => campaign.name === 'Meta Mayo')

        expect(meta, 'Meta Mayo campaign').to.exist
        expect(meta.patientsCount, 'Meta Mayo patients with treatments').to.eq(oracles.marketing.metaMayo.patients)
        expect(meta.investmentCents, 'Meta Mayo spend').to.eq(oracles.marketing.metaMayo.spendCents)
        expect(meta.revenueCents, 'Meta Mayo revenue').to.eq(oracles.marketing.metaMayo.revenueCents)
        expect(Number(((meta.revenueCents / meta.investmentCents)).toFixed(4)), 'Meta Mayo ROAS').to.eq(
          oracles.marketing.metaMayo.roas
        )
      })
    })
  })

  it('renders critical pages without setup regressions or horizontal overflow', () => {
    const viewports = [
      { label: 'desktop', width: 1280, height: 720 },
      { label: 'tablet', width: 768, height: 1024 },
      { label: 'mobile', width: 390, height: 844 },
    ]

    for (const viewport of viewports) {
      cy.viewport(viewport.width, viewport.height)

      for (const path of ['/', '/patients', '/treatments', '/marketing']) {
        cy.visit(path)
        cy.assertNotInSetupFlow()
        cy.assertNoHorizontalScroll()
        cy.log(`checked ${viewport.label} ${path}`)
      }
    }
  })
})
