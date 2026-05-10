type CreatedClinicalDocumentIds = {
  patientId?: string
  medicationId?: string
  prescriptionId?: string
}

function expectStatus(response: Cypress.Response<any>, allowed = [200, 201]) {
  expect(allowed, `${response.status} is an allowed status`).to.include(response.status)
}

function expectProtected(response: Cypress.Response<any>, label: string) {
  expect([401, 403], label).to.include(response.status)
}

describe('Stage prescriptions, medications, and PDF coverage', () => {
  const ids: CreatedClinicalDocumentIds = {}
  let stamp = ''
  let patientEmail = ''
  let medicationName = ''

  afterEach(() => {
    if (!stamp) return

    cy.task('qaPrescriptionCleanup', { stamp }).then((result: any) => {
      expect(result.cleaned, 'prescription cleanup ran').to.eq(true)
    })

    ids.patientId = undefined
    ids.medicationId = undefined
    ids.prescriptionId = undefined
    stamp = ''
  })

  it('keeps prescription and medication APIs protected when unauthenticated', () => {
    cy.clearCookies()

    const protectedRequests: Array<Cypress.RequestOptions & { label: string }> = [
      { method: 'GET', url: '/api/prescriptions', failOnStatusCode: false, label: 'list prescriptions' },
      { method: 'POST', url: '/api/prescriptions', body: {}, failOnStatusCode: false, label: 'create prescription' },
      { method: 'GET', url: '/api/medications', failOnStatusCode: false, label: 'list medications' },
      { method: 'POST', url: '/api/medications', body: {}, failOnStatusCode: false, label: 'create medication' },
      {
        method: 'GET',
        url: '/api/prescriptions/00000000-0000-4000-8000-000000000000/pdf',
        failOnStatusCode: false,
        label: 'download prescription PDF',
      },
    ]

    protectedRequests.forEach(({ label, ...requestOptions }) => {
      cy.request(requestOptions).then((response) => {
        expectProtected(response, label)
      })
    })
  })

  it('creates a patient medication prescription, filters it, downloads PDF, updates status, and cleans up', () => {
    cy.loginAsDoctor()

    stamp = `qa-rx-${Date.now()}-${Cypress._.random(1000, 9999)}`
    patientEmail = `${stamp}@laralis.test`
    medicationName = `QA Rx Ibuprofeno ${stamp}`

    cy.request('POST', '/api/patients', {
      first_name: 'QA Rx',
      last_name: stamp,
      email: patientEmail,
      phone: '+15555550420',
      first_visit_date: '2026-05-24',
      acquisition_date: '2026-05-24',
      gender: 'other',
      notes: `qa-prescription ${stamp}`,
    }).then((response) => {
      expectStatus(response)
      ids.patientId = response.body.data.id
      expect(response.body.data.email).to.eq(patientEmail)
    })

    cy.then(() => {
      cy.request('POST', '/api/medications', {
        name: medicationName,
        generic_name: 'Ibuprofeno',
        brand_name: 'QA Dental',
        category: 'analgesic',
        controlled_substance: false,
        requires_prescription: true,
        dosage_form: 'tableta',
        strength: '400mg',
        unit: 'mg',
        default_dosage: '1 tableta',
        default_frequency: 'Cada 8 horas',
        default_duration: '3 dias',
        default_instructions: 'Tomar con alimentos',
        common_uses: ['dolor dental'],
        contraindications: 'Alergia a AINEs',
        side_effects: 'Irritacion gastrica',
        interactions: 'Anticoagulantes',
        is_active: true,
      }).then((response) => {
        expectStatus(response)
        ids.medicationId = response.body.data.id
        expect(response.body.data.name).to.eq(medicationName)
        expect(response.body.data.clinic_id, 'medication is clinic scoped').to.be.a('string')
      })
    })

    cy.then(() => {
      cy.request(`/api/medications?search=${encodeURIComponent(medicationName)}`).then((response) => {
        expect(response.status).to.eq(200)
        const medication = (response.body.data || []).find((row: any) => row.id === ids.medicationId)
        expect(medication, 'created medication appears in formulary search').to.exist
        expect(medication.requires_prescription).to.eq(true)
      })
    })

    cy.then(() => {
      cy.request('POST', '/api/prescriptions', {
        patient_id: ids.patientId,
        prescription_date: '2026-05-24',
        prescriber_name: `Dr. QA ${stamp}`,
        prescriber_license: 'CED-QA-12345',
        prescriber_specialty: 'Odontologia',
        diagnosis: `Dolor postoperatorio ${stamp}`,
        valid_until: '2026-06-24',
        notes: `qa-prescription ${stamp}`,
        pharmacy_notes: 'No sustituir',
        items: [
          {
            medication_id: ids.medicationId,
            medication_name: medicationName,
            medication_strength: '400mg',
            medication_form: 'tableta',
            dosage: '1 tableta',
            frequency: 'Cada 8 horas',
            duration: '3 dias',
            quantity: '9 tabletas',
            instructions: 'Tomar despues de alimentos',
            sort_order: 0,
          },
        ],
      }).then((response) => {
        expect(response.status).to.eq(201)
        const prescription = response.body.data
        ids.prescriptionId = prescription.id
        expect(prescription.patient_id).to.eq(ids.patientId)
        expect(prescription.status).to.eq('active')
        expect(prescription.prescription_number, 'generated prescription number').to.be.a('string').and.not.be.empty
        expect(prescription.items).to.have.length(1)
        expect(prescription.items[0].medication_name).to.eq(medicationName)
      })
    })

    cy.then(() => {
      const filterUrl = `/api/prescriptions?patientId=${ids.patientId}&status=active&startDate=2026-05-01&endDate=2026-05-31`
      cy.request(filterUrl).then((response) => {
        expect(response.status).to.eq(200)
        const prescription = (response.body.data || []).find((row: any) => row.id === ids.prescriptionId)
        expect(prescription, 'prescription appears under patient/status/date filters').to.exist
        expect(prescription.patient.email).to.eq(patientEmail)
      })
    })

    cy.then(() => {
      cy.request(`/api/prescriptions/${ids.prescriptionId}`).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.data.patient.email).to.eq(patientEmail)
        expect(response.body.data.items[0].medication.id).to.eq(ids.medicationId)
      })
    })

    cy.then(() => {
      cy.request({
        method: 'GET',
        url: `/api/prescriptions/${ids.prescriptionId}/pdf`,
        encoding: 'binary',
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.headers['content-type']).to.include('application/pdf')
        expect(response.headers['content-disposition']).to.match(/receta-.+\.pdf/i)
        expect(response.body.slice(0, 4), 'PDF magic header').to.eq('%PDF')
      })
    })

    cy.then(() => {
      cy.request('PUT', `/api/prescriptions/${ids.prescriptionId}`, {
        status: 'dispensed',
        prescriber_name: `Dr. QA ${stamp}`,
        diagnosis: `Entregado ${stamp}`,
        notes: `qa-prescription ${stamp}`,
        pharmacy_notes: 'Entregado en farmacia QA',
        items: [
          {
            medication_id: ids.medicationId,
            medication_name: medicationName,
            medication_strength: '400mg',
            medication_form: 'tableta',
            dosage: '1 tableta',
            frequency: 'Cada 12 horas',
            duration: '2 dias',
            quantity: '4 tabletas',
            instructions: 'Suspender si hay molestia gastrica',
            sort_order: 0,
          },
        ],
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.status).to.eq('dispensed')
        expect(response.body.data.items[0].frequency).to.eq('Cada 12 horas')
      })
    })

    cy.then(() => {
      cy.request('DELETE', `/api/prescriptions/${ids.prescriptionId}`).then((response) => {
        expect(response.status).to.eq(200)
      })

      cy.request(`/api/prescriptions/${ids.prescriptionId}`).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.data.status).to.eq('cancelled')
      })
    })
  })

  it('renders the prescriptions page on desktop and mobile without setup regressions or overflow', () => {
    cy.loginAsDoctor()

    ;[
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ].forEach((viewport) => {
      cy.viewport(viewport.width, viewport.height)
      cy.visit('/prescriptions')
      cy.assertNotInSetupFlow()
      cy.location('pathname', { timeout: 30000 }).should('eq', '/prescriptions')
      cy.get('main', { timeout: 30000 }).should('be.visible')
      cy.contains(/Recetas Medicas|Recetas Médicas|Prescriptions/i, { timeout: 30000 }).should('be.visible')
      cy.contains(/Filtros|Filters/i, { timeout: 30000 }).should('be.visible')
      cy.contains(/Application error|Internal Server Error|Unhandled Runtime Error|Something went wrong/i)
        .should('not.exist')
      cy.assertNoHorizontalScroll()
    })
  })
})

export {}
