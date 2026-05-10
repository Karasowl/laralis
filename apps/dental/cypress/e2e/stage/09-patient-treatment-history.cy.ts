export {}

type QaDataset = {
  clinics: Array<{
    key: string
    name: string
  }>
}

type TreatmentRow = {
  id: string
  patient_id: string
  treatment_date: string
  price_cents: number
  status: string
  service?: {
    name?: string
  } | null
  patient?: {
    id: string
    first_name: string
    last_name: string
  } | null
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function selectQaClinic(key = 'clinicA') {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
    const clinicName = dataset.clinics.find((clinic) => clinic.key === key)?.name

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = (clinicsResponse.body.data || []).find((item: any) => item.name === clinicName)
      expect(clinic, `QA ${key}`).to.exist

      return cy.request('POST', '/api/clinics', { clinicId: clinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)
        return clinic
      })
    })
  })
}

function getPatientWithTreatmentHistory() {
  return cy.request('/api/treatments').then((response) => {
    expect(response.status).to.eq(200)

    const treatments = (response.body.data || []) as TreatmentRow[]
    const byPatient = new Map<string, { patient: NonNullable<TreatmentRow['patient']>; treatments: TreatmentRow[] }>()

    for (const treatment of treatments) {
      if (!treatment.patient?.id) continue

      const current = byPatient.get(treatment.patient.id) || {
        patient: treatment.patient,
        treatments: [],
      }
      current.treatments.push(treatment)
      byPatient.set(treatment.patient.id, current)
    }

    const selected = Array.from(byPatient.values())
      .filter((item) => item.treatments.length >= 2)
      .sort((a, b) => b.treatments.length - a.treatments.length)[0]

    expect(selected, 'seeded patient with multiple treatments').to.exist
    return selected
  })
}

describe('Stage patient treatment history', () => {
  beforeEach(() => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA')
  })

  it('shows the exact treatments and summary for a seeded patient', () => {
    getPatientWithTreatmentHistory().then(({ patient, treatments }) => {
      const completedTreatments = treatments.filter((treatment) => treatment.status === 'completed')
      const totalRevenue = completedTreatments.reduce(
        (sum, treatment) => sum + (treatment.price_cents || 0),
        0
      )
      const services = Array.from(
        new Set(treatments.map((treatment) => treatment.service?.name).filter(Boolean))
      ) as string[]
      const expectedIds = treatments.map((treatment) => treatment.id).sort()

      cy.request(`/api/treatments?patient_id=${patient.id}`).then((filteredResponse) => {
        expect(filteredResponse.status).to.eq(200)
        const filteredIds = ((filteredResponse.body.data || []) as TreatmentRow[])
          .map((treatment) => treatment.id)
          .sort()
        expect(filteredIds, 'API patient treatment filter').to.deep.eq(expectedIds)
      })

      cy.visit(`/patients/${patient.id}`)
      cy.get('[data-testid="patient-detail-page"]', { timeout: 30000 }).should('be.visible')
      cy.assertAppShell()
      cy.assertNoHorizontalScroll()

      cy.get('[data-testid="patient-detail-page"]')
        .contains(`${patient.first_name} ${patient.last_name}`)
        .should('be.visible')
      cy.get('[data-testid="patient-detail-info"]').should('be.visible')

      cy.get('[data-testid="patient-detail-summary"]').within(() => {
        cy.contains(formatCurrency(totalRevenue)).should('be.visible')
        cy.contains(new RegExp(`\\b${treatments.length}\\b`)).should('be.visible')
        cy.contains(new RegExp(`\\b${completedTreatments.length}\\b`)).should('exist')
      })

      cy.get('[data-testid="patient-treatment-history"]').should(($card) => {
        const visibleText = $card
          .find(':visible')
          .toArray()
          .map((element) => element.textContent || '')
          .join(' ')

        expect(visibleText).to.match(/Historial|History|Tratamientos|Treatments/i)
        expect(visibleText).not.to.match(/No hay tratamientos|No treatments|No data available/i)
        expect(visibleText).to.match(new RegExp(`\\b${treatments.length}\\b`))

        for (const service of services) {
          expect(visibleText).to.include(service)
        }

        for (const treatment of treatments) {
          expect(visibleText).to.include(formatCurrency(treatment.price_cents || 0))
        }

        if (treatments.some((treatment) => treatment.status === 'completed')) {
          expect(visibleText).to.match(/Completado|Completed/i)
        }
        if (treatments.some((treatment) => treatment.status === 'pending')) {
          expect(visibleText).to.match(/Pendiente|Pending/i)
        }
        if (treatments.some((treatment) => treatment.status === 'cancelled')) {
          expect(visibleText).to.match(/Cancelado|Cancelled/i)
        }
      })
    })
  })
})
