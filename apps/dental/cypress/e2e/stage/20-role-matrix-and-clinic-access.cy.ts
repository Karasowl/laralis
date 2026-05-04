export {}

type QaDataset = {
  clinics: Array<{
    key: string
    name: string
  }>
  users: Array<{
    key: string
    email: string
    role: string
  }>
}

type Clinic = {
  id: string
  name: string
}

type RoleCase = {
  key: string
  workspaceRole: string
  clinicRole: string
  canSelectClinicB: boolean
  permissions: Record<string, boolean>
}

const roleCases: RoleCase[] = [
  {
    key: 'owner',
    workspaceRole: 'owner',
    clinicRole: 'admin',
    canSelectClinicB: true,
    permissions: {
      'patients.delete': true,
      'treatments.mark_paid': true,
      'financial_reports.view': true,
      'team.edit_roles': true,
      'lara.execute_actions': true,
      'export_import.import': true,
    },
  },
  {
    key: 'admin',
    workspaceRole: 'admin',
    clinicRole: 'admin',
    canSelectClinicB: true,
    permissions: {
      'patients.delete': true,
      'treatments.mark_paid': true,
      'campaigns.create': true,
      'settings.edit': true,
      'team.invite': true,
      'team.edit_roles': false,
      'financial_reports.view': false,
      'lara.use_entry_mode': true,
      'lara.use_query_mode': false,
      'lara.execute_actions': false,
      'export_import.export': true,
      'export_import.import': false,
    },
  },
  {
    key: 'doctor',
    workspaceRole: 'editor',
    clinicRole: 'doctor',
    canSelectClinicB: false,
    permissions: {
      'patients.create': true,
      'patients.delete': true,
      'treatments.create': true,
      'treatments.delete': true,
      'treatments.mark_paid': false,
      'prescriptions.create': true,
      'services.create': false,
      'supplies.manage_stock': false,
      'campaigns.view': true,
      'financial_reports.view': false,
      'team.view': false,
      'lara.use_entry_mode': true,
      'lara.use_query_mode': true,
      'lara.execute_actions': false,
      'export_import.export': false,
    },
  },
  {
    key: 'assistant',
    workspaceRole: 'editor',
    clinicRole: 'assistant',
    canSelectClinicB: false,
    permissions: {
      'patients.create': true,
      'patients.delete': false,
      'treatments.create': true,
      'treatments.edit': true,
      'treatments.mark_paid': false,
      'prescriptions.create': true,
      'services.create': false,
      'supplies.view': true,
      'supplies.manage_stock': true,
      'campaigns.view': true,
      'inbox.reply': true,
      'inbox.transfer': false,
      'financial_reports.view': false,
      'lara.use_entry_mode': true,
      'lara.use_query_mode': false,
      'lara.execute_actions': false,
    },
  },
  {
    key: 'receptionist',
    workspaceRole: 'editor',
    clinicRole: 'receptionist',
    canSelectClinicB: false,
    permissions: {
      'patients.create': true,
      'patients.edit': true,
      'patients.delete': false,
      'treatments.create': true,
      'treatments.edit': true,
      'treatments.mark_paid': true,
      'prescriptions.create': true,
      'services.view': true,
      'supplies.view': true,
      'leads.create': true,
      'inbox.assign': true,
      'inbox.transfer': true,
      'financial_reports.view': false,
      'lara.use_entry_mode': true,
      'lara.use_query_mode': false,
      'lara.execute_actions': false,
    },
  },
  {
    key: 'viewer',
    workspaceRole: 'viewer',
    clinicRole: 'viewer',
    canSelectClinicB: false,
    permissions: {
      'patients.view': true,
      'patients.create': false,
      'patients.delete': false,
      'treatments.view': true,
      'treatments.create': false,
      'treatments.mark_paid': false,
      'services.view': true,
      'supplies.view': true,
      'campaigns.view': false,
      'financial_reports.view': false,
      'settings.view': false,
      'team.view': false,
      'lara.use_entry_mode': false,
      'lara.use_query_mode': false,
      'lara.execute_actions': false,
    },
  },
]

function readDataset(): Cypress.Chainable<QaDataset> {
  return cy.readFile('../../docs/qa/dataset.json')
}

function getSeedClinics(dataset: QaDataset): Cypress.Chainable<{ clinicA: Clinic; clinicB: Clinic }> {
  const clinicAName = dataset.clinics.find((clinic) => clinic.key === 'clinicA')?.name
  const clinicBName = dataset.clinics.find((clinic) => clinic.key === 'clinicB')?.name

  return cy.request('/api/clinics').then((response) => {
    expect(response.status).to.eq(200)
    const clinics = response.body.data || []
    const clinicA = clinics.find((clinic: Clinic) => clinic.name === clinicAName)
    const clinicB = clinics.find((clinic: Clinic) => clinic.name === clinicBName)

    expect(clinicA, 'QA clinic A').to.exist
    expect(clinicB, 'QA clinic B').to.exist
    expect(clinicA.id, 'different seeded clinic ids').not.to.eq(clinicB.id)

    return { clinicA, clinicB }
  })
}

function selectClinic(clinicId: string, expectedStatus = 200) {
  return cy.request({
    method: 'POST',
    url: '/api/clinics',
    body: { clinicId },
    failOnStatusCode: false,
  }).then((response) => {
    expect(response.status, `select clinic ${clinicId}`).to.eq(expectedStatus)
  })
}

describe('Stage role matrix and clinic access boundaries', () => {
  let clinicA: Clinic
  let clinicB: Clinic
  let usersByKey: Record<string, { email: string; role: string }>

  before(() => {
    cy.loginAsDoctor()
    readDataset().then((dataset) => {
      usersByKey = Object.fromEntries(dataset.users.map((user) => [user.key, user]))

      getSeedClinics(dataset).then((clinics) => {
        clinicA = clinics.clinicA
        clinicB = clinics.clinicB
      })
    })
  })

  it('matches the expected permission matrix for every seeded role', () => {
    cy.then(() => {
      expect(clinicA?.id, 'clinic A id').to.be.a('string')
      expect(clinicB?.id, 'clinic B id').to.be.a('string')
    })

    for (const roleCase of roleCases) {
      cy.then(() => {
        const user = usersByKey[roleCase.key]
        expect(user?.email, `${roleCase.key} user email`).to.be.a('string')

        cy.loginAsStageUser(user.email, undefined, { allowSetup: true })
        selectClinic(clinicA.id)

        cy.request('/api/permissions/my').then((response) => {
          expect(response.status, `${roleCase.key} permissions status`).to.eq(200)
          expect(response.body.workspaceRole, `${roleCase.key} workspace role`).to.eq(roleCase.workspaceRole)
          expect(response.body.clinicRole, `${roleCase.key} clinic role`).to.eq(roleCase.clinicRole)
          expect(response.body.clinicId, `${roleCase.key} selected clinic`).to.eq(clinicA.id)

          for (const [permission, expected] of Object.entries(roleCase.permissions)) {
            expect(
              response.body.permissions[permission] === true,
              `${roleCase.key} ${permission}`
            ).to.eq(expected)
          }
        })
      })
    }
  })

  it('prevents clinic B selection and explicit data reads for roles limited to clinic A', () => {
    for (const roleCase of roleCases) {
      cy.then(() => {
        const user = usersByKey[roleCase.key]
        expect(user?.email, `${roleCase.key} user email`).to.be.a('string')

        cy.loginAsStageUser(user.email, undefined, { allowSetup: true })
        selectClinic(clinicA.id)

        if (roleCase.canSelectClinicB) {
          selectClinic(clinicB.id)

          cy.request('/api/patients').then((response) => {
            expect(response.status, `${roleCase.key} can read clinic B patients`).to.eq(200)
            expect(response.body.data || [], `${roleCase.key} clinic B starts isolated`).to.have.length(0)
          })

          selectClinic(clinicA.id)
          return
        }

        selectClinic(clinicB.id, 403)

        cy.request({
          url: `/api/patients?clinicId=${clinicB.id}`,
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status, `${roleCase.key} cannot read clinic B explicitly`).to.eq(403)
        })

        cy.request('/api/patients').then((response) => {
          expect(response.status, `${roleCase.key} still reads clinic A after blocked clinic B`).to.eq(200)
          expect(response.body.data || [], `${roleCase.key} clinic A remains active`).to.have.length.greaterThan(0)
        })
      })
    }
  })
})
