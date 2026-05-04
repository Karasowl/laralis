export {}

type QaDataset = {
  clinics: Array<{
    key: string
    name: string
  }>
}

type InvitationToken = {
  token: string
  email: string
  role: string
  clinic_ids?: string[]
  accepted_at?: string | null
}

describe('Stage team admin invitation lifecycle', () => {
  const password = Cypress.env('QA_STAGE_DEFAULT_PASSWORD') || 'LaralisQA!2026'
  const stamp = `qa-team-admin-${Date.now()}-${Cypress._.random(1000, 9999)}`
  const adminEmail = `${stamp}@laralis.test`
  const patientEmail = `${stamp}.patient@laralis.test`
  let createdPatientId: string | undefined

  function selectClinicA() {
    return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
      const clinicAName = dataset.clinics.find((clinic) => clinic.key === 'clinicA')?.name

      return cy.request('/api/clinics').then((clinicsResponse) => {
        expect(clinicsResponse.status).to.eq(200)
        const clinicA = (clinicsResponse.body.data || []).find((clinic: any) => clinic.name === clinicAName)
        expect(clinicA, 'QA clinic A').to.exist

        return cy.request('POST', '/api/clinics', { clinicId: clinicA.id }).then((selectResponse) => {
          expect(selectResponse.status).to.eq(200)
          return clinicA
        })
      })
    })
  }

  before(() => {
    cy.task('qaDeleteUserByEmail', adminEmail)
    cy.task('qaCreateConfirmedUser', { email: adminEmail, password })
  })

  after(() => {
    cy.task('qaDeleteUserByEmail', adminEmail)
  })

  afterEach(() => {
    if (!createdPatientId) return

    cy.loginAsDoctor()
    selectClinicA()
    cy.request({
      method: 'DELETE',
      url: `/api/patients/${createdPatientId}`,
      failOnStatusCode: false,
    }).then((response) => {
      expect([200, 204, 404], 'cleanup admin-created patient').to.include(response.status)
    })
    createdPatientId = undefined
  })

  it('invites a new admin, accepts the invitation, and grants real clinic permissions', () => {
    cy.loginAsDoctor()
    selectClinicA().then((clinicA: any) => {
      cy.request('POST', '/api/team/workspace-members', {
        email: adminEmail,
        role: 'admin',
        allowed_clinics: [clinicA.id],
        message: 'QA admin invitation lifecycle',
      }).then((inviteResponse) => {
        expect(inviteResponse.status).to.eq(200)
        expect(inviteResponse.body.success).to.eq(true)
        expect(inviteResponse.body.invitation.email).to.eq(adminEmail)
        expect(inviteResponse.body.invitation.role).to.eq('admin')
      })
    })

    cy.task('qaGetLatestInvitationToken', adminEmail).then((invitation) => {
      const token = (invitation as InvitationToken).token
      expect(token, 'invitation token').to.be.a('string')

      cy.request(`/api/invitations/accept/${token}`).then((lookupResponse) => {
        expect(lookupResponse.status).to.eq(200)
        expect(lookupResponse.body.invitation.email).to.eq(adminEmail)
        expect(lookupResponse.body.invitation.role).to.eq('admin')
      })

      cy.loginAsStageUser(adminEmail, password, { allowSetup: true })
      cy.request('POST', `/api/invitations/accept/${token}`).then((acceptResponse) => {
        expect(acceptResponse.status).to.eq(200)
        expect(acceptResponse.body.success).to.eq(true)
      })
    })

    selectClinicA().then((clinicA: any) => {
      cy.request('/api/permissions/my').then((permissionsResponse) => {
        expect(permissionsResponse.status).to.eq(200)
        expect(permissionsResponse.body.workspaceRole).to.eq('admin')
        expect(permissionsResponse.body.clinicRole).to.eq('admin')
        expect(permissionsResponse.body.permissions['team.view']).to.eq(true)
        expect(permissionsResponse.body.permissions['team.invite']).to.eq(true)
        expect(permissionsResponse.body.permissions['patients.create']).to.eq(true)
      })

      cy.request('/api/team/workspace-members').then((membersResponse) => {
        expect(membersResponse.status).to.eq(200)
        const invited = (membersResponse.body.members || []).find((member: any) => member.email === adminEmail)
        expect(invited?.role, 'invited workspace admin role').to.eq('admin')
      })

      cy.request(`/api/team/clinic-members?clinicId=${clinicA.id}`).then((membersResponse) => {
        expect(membersResponse.status).to.eq(200)
        const invited = (membersResponse.body.members || []).find((member: any) => member.email === adminEmail)
        expect(invited?.role, 'invited clinic admin role').to.eq('admin')
      })

      cy.request('POST', '/api/patients', {
        first_name: 'QA Admin',
        last_name: stamp,
        email: patientEmail,
        phone: '+15555550188',
        first_visit_date: '2026-05-28',
        acquisition_date: '2026-05-28',
        gender: 'other',
      }).then((patientResponse) => {
        expect([200, 201], 'invited admin can create patients').to.include(patientResponse.status)
        createdPatientId = patientResponse.body.data.id
      })
    })
  })
})
