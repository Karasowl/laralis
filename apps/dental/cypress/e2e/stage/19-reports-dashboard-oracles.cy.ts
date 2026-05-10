export {}

type Clinic = {
  id: string
  name: string
}

type QaDataset = {
  clinics: Array<{
    key: string
    name: string
  }>
}

type Oracles = {
  period: {
    from: string
    to: string
  }
  patients: {
    total: number
  }
  treatments: {
    total: number
    byStatus: {
      completed_paid: number
      partial: number
      pending: number
      cancelled: number
    }
  }
  marketing: {
    metaMayo: {
      patients: number
      spendCents: number
      revenueCents: number
      cpaCents: number
      roas: number
      roiPercent: number
    }
  }
  financial: {
    completedRevenueCents: number
    marketingSpendCents: number
    actualExpenseCents: number
  }
}

function selectQaClinic(key = 'clinicA'): Cypress.Chainable<Clinic> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
    const clinicName = dataset.clinics.find((clinic) => clinic.key === key)?.name

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = (clinicsResponse.body.data || []).find((item: Clinic) => item.name === clinicName)
      expect(clinic, `QA ${key}`).to.exist

      return cy.request('POST', '/api/clinics', { clinicId: clinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)
        return clinic as Clinic
      })
    })
  })
}

function inclusiveDays(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  const start = Date.UTC(fromYear, fromMonth - 1, fromDay)
  const end = Date.UTC(toYear, toMonth - 1, toDay)
  return Math.round((end - start) / 86_400_000) + 1
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

describe('Stage reports, dashboard, and marketing business oracles', () => {
  beforeEach(() => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA')
  })

  it('matches May 2026 report APIs with the canonical QA oracles', () => {
    cy.readFile('../../docs/qa/oracles.json').then((oracles: Oracles) => {
      const reportRange = `from=${oracles.period.from}&to=${oracles.period.to}`
      const expectedDays = inclusiveDays(oracles.period.from, oracles.period.to)

      cy.request(`/api/reports/revenue?period=month&${reportRange}`).then((response) => {
        expect(response.status).to.eq(200)
        const data = response.body.data

        expect(data.range.from).to.eq(oracles.period.from)
        expect(data.range.to).to.eq(oracles.period.to)
        expect(data.days, 'inclusive report range days').to.eq(expectedDays)
        expect(data.total_cents, 'report revenue total').to.eq(oracles.financial.completedRevenueCents)
        expect(data.completed_count, 'report completed treatment count').to.eq(
          oracles.treatments.byStatus.completed_paid
        )
        expect(data.average_daily_cents, 'report average daily revenue').to.eq(
          Math.round(oracles.financial.completedRevenueCents / expectedDays)
        )
      })

      cy.request(`/api/reports/summary?${reportRange}`).then((response) => {
        expect(response.status).to.eq(200)
        const data = response.body.data

        expect(data.range.from).to.eq(oracles.period.from)
        expect(data.range.to).to.eq(oracles.period.to)
        expect(data.counts.patients, 'summary patients in period').to.eq(oracles.patients.total)
        expect(data.counts.treatments, 'summary treatments in period').to.eq(oracles.treatments.total)
        expect(data.dashboard.patientsMonth, 'summary dashboard patient card').to.eq(oracles.patients.total)
        expect(data.dashboard.treatmentsMonth, 'summary dashboard treatment card').to.eq(oracles.treatments.total)
        expect(data.dashboard.revenueMonth, 'summary dashboard revenue card').to.eq(
          oracles.financial.completedRevenueCents
        )
      })
    })
  })

  it('keeps dashboard cards aligned with the same report period', () => {
    cy.readFile('../../docs/qa/oracles.json').then((oracles: Oracles) => {
      const dashboardRange = `period=custom&date_from=${oracles.period.from}&date_to=${oracles.period.to}`
      const nonCancelledTreatments =
        oracles.treatments.total - oracles.treatments.byStatus.cancelled
      const clinicallyCompletedTreatments =
        oracles.treatments.byStatus.completed_paid + oracles.treatments.byStatus.partial

      cy.request(`/api/dashboard/revenue?${dashboardRange}`).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.revenue.current, 'dashboard current revenue').to.eq(
          oracles.financial.completedRevenueCents
        )
        expect(response.body.totals.current_count, 'dashboard completed count').to.eq(
          oracles.treatments.byStatus.completed_paid
        )
      })

      cy.request(`/api/dashboard/expenses?${dashboardRange}`).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.expenses.current, 'dashboard expenses current').to.eq(
          oracles.financial.actualExpenseCents
        )
      })

      cy.request(`/api/dashboard/treatments?${dashboardRange}`).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.treatments.total, 'dashboard excludes cancelled from active total').to.eq(
          nonCancelledTreatments
        )
        expect(response.body.treatments.completed, 'dashboard clinically completed treatments').to.eq(
          clinicallyCompletedTreatments
        )
        expect(response.body.treatments.pending, 'dashboard pending treatments').to.eq(
          oracles.treatments.byStatus.pending
        )
      })
    })
  })

  it('matches Meta Mayo ROI, ROAS, CPA, spend, revenue, and patients', () => {
    cy.readFile('../../docs/qa/oracles.json').then((oracles: Oracles) => {
      const { metaMayo } = oracles.marketing
      const marketingRange = `startDate=${oracles.period.from}&endDate=${oracles.period.to}`

      cy.request(`/api/marketing/campaigns/roi?${marketingRange}`).then((response) => {
        expect(response.status).to.eq(200)
        const campaign = (response.body.data || []).find((item: { name: string }) => item.name === 'Meta Mayo')

        expect(campaign, 'Meta Mayo campaign').to.exist
        expect(campaign.patientsCount, 'Meta Mayo patients').to.eq(metaMayo.patients)
        expect(campaign.investmentCents, 'Meta Mayo spend').to.eq(metaMayo.spendCents)
        expect(campaign.revenueCents, 'Meta Mayo revenue').to.eq(metaMayo.revenueCents)
        expect(campaign.avgRevenuePerPatientCents, 'Meta Mayo average revenue per patient').to.eq(
          Math.round(metaMayo.revenueCents / metaMayo.patients)
        )
        expect(Math.round(campaign.investmentCents / campaign.patientsCount), 'Meta Mayo CPA').to.eq(
          metaMayo.cpaCents
        )
        expect(round(campaign.revenueCents / campaign.investmentCents), 'Meta Mayo ROAS').to.eq(metaMayo.roas)
        expect(round(campaign.roi, 2), 'Meta Mayo ROI percent').to.eq(metaMayo.roiPercent)
      })

      cy.request(`/api/analytics/channel-roi?${marketingRange}`).then((response) => {
        expect(response.status).to.eq(200)
        const channel = (response.body.channels || []).find(
          (item: { campaign: { name: string } }) => item.campaign.name === 'Meta Mayo'
        )

        expect(channel, 'Meta Mayo channel ROI').to.exist
        expect(channel.patients, 'channel patients').to.eq(metaMayo.patients)
        expect(channel.revenueCents, 'channel revenue').to.eq(metaMayo.revenueCents)
        expect(channel.investmentCents, 'channel investment').to.eq(metaMayo.spendCents)
        expect(round(channel.roi.value, 2), 'channel ROI percent').to.eq(metaMayo.roiPercent)
        expect(response.body.summary.bestChannel.name).to.eq('Meta Mayo')
      })
    })
  })

  it('keeps the /reports route from becoming a blank or setup page', () => {
    cy.visit('/reports')
    cy.location('pathname', { timeout: 30000 }).should('eq', '/')
    cy.assertAppShell()
    cy.assertNoHorizontalScroll()
  })
})
