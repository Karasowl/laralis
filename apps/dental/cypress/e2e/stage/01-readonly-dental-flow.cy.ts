type Oracles = {
  patients: {
    total: number
    bySource: Record<string, number>
  }
  treatments: {
    total: number
    byStatus: Record<string, number>
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
      expect(clinic, `QA clinic ${clinicName} must exist`).to.exist

      return cy.request('POST', '/api/clinics', { clinicId: clinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)
      })
    })
  })
}

function countBy<T>(rows: T[], classify: (row: T) => string) {
  return rows.reduce((acc: Record<string, number>, row) => {
    const key = classify(row)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

describe('Stage read-only dental data integrity flow from demo video', () => {
  beforeEach(() => {
    cy.loginAsDoctor()
    selectQaClinicA()
  })

  it('loads patients and verifies the seeded acquisition mix without saving', () => {
    cy.readFile('../../docs/qa/oracles.json').then((oracles: Oracles) => {
      cy.request('/api/patients').then((response) => {
        expect(response.status).to.eq(200)
        const patients = response.body.data || []
        expect(patients, 'QA clinic patient count').to.have.length(oracles.patients.total)
        expect(countBy(patients, (patient: any) => patient.source?.name || 'unknown')).to.include(
          oracles.patients.bySource
        )
      })
    })

    cy.visit('/patients')
    cy.location('pathname', { timeout: 30000 }).should('include', '/patients')
    cy.assertAppShell()
    cy.get('main').contains(/Pacientes|Patients/i, { timeout: 30000 }).should('be.visible')
    cy.get('main').contains(/Agregar paciente|Add Patient/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/Edad|Age|Deuda|Debt|Sexo|Gender|Origen|Source/i, { timeout: 30000 }).should('exist')
    cy.contains(/No hay datos disponibles|No data available/i).should('not.exist')

    cy.get('main').contains('button', /Agregar paciente|Add Patient/i).click()

    cy.get('[role="dialog"]', { timeout: 30000 }).within(() => {
      cy.contains(/Crear Paciente|Create Patient|Nuevo paciente|New Patient/i)
        .should('be.visible')
      cy.contains(/Información de Origen|Acquisition Information/i, { timeout: 30000 })
        .scrollIntoView()
        .should('be.visible')
      cy.contains(/Campañas Publicitarias|Advertising Campaigns/i).should('be.visible')
      cy.contains(/Referencias|Referrals/i).should('be.visible')
      cy.contains(/Directo|Direct/i).should('be.visible')
      cy.contains('button', /Cancelar|Cancel/i).click()
    })

    cy.location('pathname').should('include', '/patients')
  })

  it('loads marketing and verifies Meta Mayo attribution numbers', () => {
    cy.readFile('../../docs/qa/oracles.json').then((oracles: Oracles) => {
      cy.request('/api/marketing/campaigns/roi?startDate=2026-05-01&endDate=2026-05-31').then((response) => {
        expect(response.status).to.eq(200)
        const meta = (response.body.data || []).find((campaign: any) => campaign.name === 'Meta Mayo')

        expect(meta, 'Meta Mayo campaign').to.exist
        expect(meta.patientsCount, 'Meta Mayo patients').to.eq(oracles.marketing.metaMayo.patients)
        expect(meta.investmentCents, 'Meta Mayo spend').to.eq(oracles.marketing.metaMayo.spendCents)
        expect(meta.revenueCents, 'Meta Mayo revenue').to.eq(oracles.marketing.metaMayo.revenueCents)
        expect(Number((meta.revenueCents / meta.investmentCents).toFixed(4)), 'Meta Mayo ROAS').to.eq(
          oracles.marketing.metaMayo.roas
        )
      })
    })

    cy.visit('/marketing')
    cy.assertAppShell()
    cy.contains(/Marketing/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/Plataformas|Platforms/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/Campañas|Campaigns/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/Meta Ads|Google Ads|Instagram|Facebook|Campaña|Campaign/i, { timeout: 30000 })
      .should('be.visible')
    cy.contains(/No hay campañas|No campaigns/i).should('not.exist')
  })

  it('loads treatments and verifies status counts before navigating back to patients', () => {
    cy.readFile('../../docs/qa/oracles.json').then((oracles: Oracles) => {
      cy.request('/api/treatments').then((response) => {
        expect(response.status).to.eq(200)
        const treatments = response.body.data || []
        expect(treatments, 'QA clinic treatments count').to.have.length(oracles.treatments.total)
        expect(countBy(treatments, classifyTreatment)).to.include(oracles.treatments.byStatus)
      })
    })

    cy.visit('/treatments')
    cy.assertAppShell()
    cy.contains(/Tratamientos|Treatments/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/Agregar tratamiento|Add Treatment/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/Total|Ingresos|Revenue|Completados|Completed|Margen|Margin/i, { timeout: 30000 })
      .should('be.visible')

    cy.visit('/patients')
    cy.assertAppShell()
    cy.contains(/Pacientes|Patients/i, { timeout: 30000 }).should('be.visible')
    cy.contains(/PoDent|Lara/i).should('exist')
  })
})
