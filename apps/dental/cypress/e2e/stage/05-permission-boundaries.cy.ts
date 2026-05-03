describe('Stage permission boundaries', () => {
  const viewerEmail = 'qa-viewer@laralis.test'
  const stamp = `qa-permission-${Date.now()}-${Cypress._.random(1000, 9999)}`
  const patientEmail = `${stamp}@laralis.test`
  let ownerCreatedPatientId: string | undefined

  function selectClinicA() {
    cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
      const clinicAName = dataset.clinics.find((clinic: any) => clinic.key === 'clinicA')?.name

      cy.request('/api/clinics').then((clinicsResponse) => {
        expect(clinicsResponse.status).to.eq(200)
        const clinicA = (clinicsResponse.body.data || []).find((clinic: any) => clinic.name === clinicAName)
        expect(clinicA, 'current user can access QA clinic A').to.exist

        cy.request('POST', '/api/clinics', { clinicId: clinicA.id }).then((selectResponse) => {
          expect(selectResponse.status).to.eq(200)
        })
      })
    })
  }

  afterEach(() => {
    if (!ownerCreatedPatientId) return

    cy.loginAsDoctor()
    cy.request({
      method: 'DELETE',
      url: `/api/patients/${ownerCreatedPatientId}`,
      failOnStatusCode: false,
    }).then((response) => {
      expect([200, 204, 404], 'owner cleanup patient').to.include(response.status)
    })
    ownerCreatedPatientId = undefined
  })

  it('exposes viewer permissions as read-only for patients', () => {
    cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
    selectClinicA()

    cy.request('/api/permissions/my').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.workspaceRole).to.eq('viewer')
      expect(response.body.clinicRole).to.eq('viewer')
      expect(response.body.permissions['patients.view']).to.eq(true)
      expect(response.body.permissions['patients.create']).to.eq(false)
      expect(response.body.permissions['patients.edit']).to.eq(false)
      expect(response.body.permissions['patients.delete']).to.eq(false)
    })
  })

  it('blocks viewer patient writes at the API and still allows owner writes', () => {
    cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
    selectClinicA()

    cy.request({
      method: 'POST',
      url: '/api/patients',
      failOnStatusCode: false,
      body: {
        first_name: 'QA Viewer',
        last_name: stamp,
        email: patientEmail,
        first_visit_date: '2026-05-25',
        acquisition_date: '2026-05-25',
        gender: 'other',
      },
    }).then((response) => {
      expect(response.status, 'viewer cannot create patients').to.eq(403)
      expect(response.body.error).to.eq('Forbidden')
    })

    cy.loginAsDoctor()
    cy.request('POST', '/api/patients', {
      first_name: 'QA Owner',
      last_name: stamp,
      email: patientEmail,
      first_visit_date: '2026-05-25',
      acquisition_date: '2026-05-25',
      gender: 'other',
    }).then((response) => {
      expect([200, 201], 'owner can create patients').to.include(response.status)
      ownerCreatedPatientId = response.body.data.id
    })
  })
})
