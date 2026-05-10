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

type QaOracles = {
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
    }
  }
  financial: {
    completedRevenueCents: number
    actualExpenseCents: number
  }
}

type LaraSnapshot = {
  patientCount: number
  treatmentCount: number
  campaignNames: string[]
  hasMetaMayo: boolean
}

function parseSse(body: unknown) {
  const text = typeof body === 'string' ? body : String(body || '')
  const events = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6))

  const parsedEvents = events
    .filter((event) => event !== '[DONE]')
    .map((event) => JSON.parse(event))

  const content = parsedEvents
    .filter((event) => event.type === 'content')
    .map((event) => event.data)
    .join('')

  const metadata = parsedEvents.find((event) => event.type === 'metadata')?.data

  return { content, metadata }
}

function loadSeedClinics(): Cypress.Chainable<{ clinicA: Clinic; clinicB: Clinic }> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
    const clinicAName = dataset.clinics.find((clinic) => clinic.key === 'clinicA')?.name
    const clinicBName = dataset.clinics.find((clinic) => clinic.key === 'clinicB')?.name

    return cy.request('/api/clinics').then((response) => {
      expect(response.status).to.eq(200)
      const clinics = response.body.data || []
      const clinicA = clinics.find((clinic: Clinic) => clinic.name === clinicAName)
      const clinicB = clinics.find((clinic: Clinic) => clinic.name === clinicBName)

      expect(clinicA, 'seed clinic A').to.exist
      expect(clinicB, 'seed clinic B').to.exist
      expect(clinicA.id, 'different seed clinic ids').not.to.eq(clinicB.id)

      return { clinicA, clinicB }
    })
  })
}

function selectClinic(clinicId: string) {
  return cy.request('POST', '/api/clinics', { clinicId }).then((response) => {
    expect(response.status, `select clinic ${clinicId}`).to.eq(200)
  })
}

function askLara(clinicId: string | null, query: string) {
  return cy.request({
    method: 'POST',
    url: '/api/ai/query',
    headers: {
      'x-laralis-qa-ai': 'mock',
    },
    body: {
      ...(clinicId ? { clinicId } : {}),
      query,
      locale: 'es',
    },
  }).then((response) => {
    expect(response.status).to.eq(200)
    expect(String(response.headers['content-type'])).to.include('text/event-stream')
    return parseSse(response.body)
  })
}

function expectLaraSnapshot(
  label: string,
  parsed: ReturnType<typeof parseSse>,
  expectedClinicId: string,
  expected: LaraSnapshot
) {
  expect(parsed.metadata?.clinicId, `${label} metadata clinic`).to.eq(expectedClinicId)
  expect(parsed.metadata?.data?.clinicSnapshot, `${label} snapshot`).to.deep.eq(expected)
  expect(parsed.content, `${label} content patient count`).to.include(`patients=${expected.patientCount}`)
  expect(parsed.content, `${label} content treatment count`).to.include(`treatments=${expected.treatmentCount}`)

  if (expected.hasMetaMayo) {
    expect(parsed.content, `${label} content has Meta Mayo`).to.include('Meta Mayo=present')
    expect(parsed.content, `${label} content campaign names`).to.include('Meta Mayo')
  } else {
    expect(parsed.content, `${label} content has no Meta Mayo`).to.include('Meta Mayo=absent')
    expect(parsed.content, `${label} content avoids campaign leakage`).not.to.include('campaigns=Meta Mayo')
  }
}

function assertDashboardIsolation(oracles: QaOracles, expected: {
  revenueCents: number
  completedCount: number
  expensesCents: number
  treatmentsTotal: number
  patientsAttended: number
  campaigns: number
  metaPatients?: number
}) {
  const range = `period=custom&date_from=${oracles.period.from}&date_to=${oracles.period.to}`
  const marketingRange = `startDate=${oracles.period.from}&endDate=${oracles.period.to}`

  cy.request(`/api/dashboard/revenue?${range}`).then((response) => {
    expect(response.status).to.eq(200)
    expect(response.body.revenue.current, 'dashboard revenue by active clinic').to.eq(expected.revenueCents)
    expect(response.body.totals.current_count, 'dashboard completed count by active clinic').to.eq(
      expected.completedCount
    )
  })

  cy.request(`/api/dashboard/expenses?${range}`).then((response) => {
    expect(response.status).to.eq(200)
    expect(response.body.expenses.current, 'dashboard expenses by active clinic').to.eq(expected.expensesCents)
  })

  cy.request(`/api/dashboard/treatments?${range}`).then((response) => {
    expect(response.status).to.eq(200)
    expect(response.body.treatments.total, 'dashboard treatments by active clinic').to.eq(expected.treatmentsTotal)
  })

  cy.request(`/api/dashboard/patients?${range}`).then((response) => {
    expect(response.status).to.eq(200)
    expect(response.body.patients.attended, 'dashboard patients by active clinic').to.eq(expected.patientsAttended)
  })

  cy.request(`/api/marketing/campaigns/roi?${marketingRange}`).then((response) => {
    expect(response.status).to.eq(200)
    expect(response.body.data || [], 'campaign count by active clinic').to.have.length(expected.campaigns)

    const meta = (response.body.data || []).find((campaign: { name: string }) => campaign.name === 'Meta Mayo')
    if (expected.metaPatients) {
      expect(meta, 'Meta Mayo should exist only in clinic A').to.exist
      expect(meta.patientsCount, 'Meta Mayo patients by active clinic').to.eq(expected.metaPatients)
    } else {
      expect(meta, 'Meta Mayo should not leak into active clinic').not.to.exist
    }
  })
}

describe('Stage Lara and dashboard multi-clinic isolation', () => {
  beforeEach(() => {
    cy.loginAsDoctor()
  })

  it('keeps Lara mock answers bound to the selected clinic data snapshot', () => {
    cy.readFile('../../docs/qa/oracles.json').then((oracles: QaOracles) => {
      loadSeedClinics().then(({ clinicA, clinicB }) => {
        selectClinic(clinicA.id)
        askLara(clinicA.id, 'QA: resume los datos de la clinica activa').then((parsed) => {
          expectLaraSnapshot('clinic A explicit Lara query', parsed, clinicA.id, {
            patientCount: oracles.patients.total,
            treatmentCount: oracles.treatments.total,
            campaignNames: ['Meta Mayo'],
            hasMetaMayo: true,
          })
        })

        selectClinic(clinicB.id)
        askLara(null, 'QA: resume los datos de la clinica activa sin clinicId explicito').then((parsed) => {
          expectLaraSnapshot('clinic B active-cookie Lara query', parsed, clinicB.id, {
            patientCount: 0,
            treatmentCount: 0,
            campaignNames: [],
            hasMetaMayo: false,
          })
        })
      })
    })
  })

  it('keeps dashboard and marketing surfaces isolated after switching from clinic A to clinic B', () => {
    cy.readFile('../../docs/qa/oracles.json').then((oracles: QaOracles) => {
      loadSeedClinics().then(({ clinicA, clinicB }) => {
        selectClinic(clinicA.id)
        assertDashboardIsolation(oracles, {
          revenueCents: oracles.financial.completedRevenueCents,
          completedCount: oracles.treatments.byStatus.completed_paid,
          expensesCents: oracles.financial.actualExpenseCents,
          treatmentsTotal: oracles.treatments.total - oracles.treatments.byStatus.cancelled,
          patientsAttended: oracles.patients.total,
          campaigns: 1,
          metaPatients: oracles.marketing.metaMayo.patients,
        })

        selectClinic(clinicB.id)
        assertDashboardIsolation(oracles, {
          revenueCents: 0,
          completedCount: 0,
          expensesCents: 0,
          treatmentsTotal: 0,
          patientsAttended: 0,
          campaigns: 0,
        })

        cy.visit('/')
        cy.assertAppShell()
        cy.assertNoHorizontalScroll()

        selectClinic(clinicA.id)
        cy.visit('/')
        cy.assertAppShell()
        cy.assertNoHorizontalScroll()
      })
    })
  })
})
