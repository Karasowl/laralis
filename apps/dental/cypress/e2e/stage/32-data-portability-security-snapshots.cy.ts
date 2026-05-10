export {}

type QaClinic = {
  key: string
  name: string
}

type Clinic = {
  id: string
  name: string
  workspace_id: string
}

type Workspace = {
  id: string
  name: string
}

type QaDataset = {
  clinics: QaClinic[]
  services: Array<{ supplies?: unknown[] }>
  supplies: unknown[]
  fixedCosts: unknown[]
  assets: unknown[]
  sources: unknown[]
  campaigns: unknown[]
  users: unknown[]
}

type ExportRecord = Record<string, unknown> & {
  id?: string
  name?: string
  clinic?: ExportRecord
  recordCounts?: Record<string, number>
  patient_id?: string
  service_id?: string
  campaign_id?: string
  campaign_name?: string
}

const missingSnapshotId = '00000000-0000-4000-8000-000000000001'

const workspaceClinicArrayKeys = [
  'customCategories',
  'categories',
  'patientSources',
  'invitations',
  'clinicUsers',
  'assets',
  'supplies',
  'fixedCosts',
  'services',
  'serviceSupplies',
  'marketingCampaigns',
  'marketingCampaignStatusHistory',
  'marketingCampaignChannels',
  'leads',
  'inboxConversations',
  'inboxMessages',
  'patients',
  'treatments',
  'expenses',
  'publicBookingServices',
  'publicBookings',
  'bookingBlockedSlots',
  'emailNotifications',
  'smsNotifications',
  'whatsappTemplates',
  'whatsappNotifications',
  'scheduledReminders',
  'pushSubscriptions',
  'pushNotifications',
  'notificationRetryQueue',
  'medications',
  'prescriptions',
  'prescriptionItems',
  'quotes',
  'quoteItems',
  'actionLogs',
  'chatSessions',
  'chatMessages',
  'aiFeedback',
]

const clinicFullExportArrayKeys = [
  'categories',
  'custom_categories',
  'patients',
  'patient_sources',
  'clinic_users',
  'invitations',
  'custom_role_templates',
  'treatments',
  'services',
  'supplies',
  'service_supplies',
  'expenses',
  'fixed_costs',
  'assets',
  'marketing_campaigns',
  'marketing_campaign_status_history',
  'marketing_campaign_channels',
  'leads',
  'inbox_conversations',
  'inbox_messages',
  'public_booking_services',
  'public_bookings',
  'booking_blocked_slots',
  'email_notifications',
  'sms_notifications',
  'whatsapp_templates',
  'whatsapp_notifications',
  'scheduled_reminders',
  'push_subscriptions',
  'push_notifications',
  'notification_retry_queue',
  'action_logs',
  'chat_sessions',
  'chat_messages',
  'ai_feedback',
  'medications',
  'prescriptions',
  'prescription_items',
  'quotes',
  'quote_items',
]

function expectedServiceSupplyCount(dataset: QaDataset) {
  return dataset.services.reduce((sum: number, service) => {
    return sum + (service.supplies?.length || 0)
  }, 0)
}

function expectArrayKeys(container: ExportRecord, keys: string[]) {
  for (const key of keys) {
    expect(container, `export key ${key}`).to.have.property(key)
    expect(container[key], `${key} export rows`).to.be.an('array')
  }
}

function expectMinCount(counts: Record<string, number>, key: string, minimum: number) {
  expect(counts?.[key] || 0, `recordCounts.${key}`).to.be.at.least(minimum)
}

function assertTreatmentRelationships(treatments: ExportRecord[], patients: ExportRecord[], services: ExportRecord[]) {
  const patientIds = new Set(patients.map((row) => row.id))
  const serviceIds = new Set(services.map((row) => row.id))

  treatments.forEach((treatment) => {
    expect(patientIds.has(treatment.patient_id), `treatment ${treatment.id} patient`).to.eq(true)
    expect(serviceIds.has(treatment.service_id), `treatment ${treatment.id} service`).to.eq(true)
  })
}

function rowsFromBody(body: unknown): ExportRecord[] {
  if (Array.isArray(body)) return body as ExportRecord[]
  const payload = body as { data?: unknown }
  return Array.isArray(payload.data) ? payload.data as ExportRecord[] : []
}

function selectQaClinicA(): Cypress.Chainable<Clinic> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset: QaDataset) => {
    const clinicDef = dataset.clinics.find((row: QaClinic) => row.key === 'clinicA')
    expect(clinicDef, 'clinic A definition').not.to.eq(undefined)
    if (!clinicDef) throw new Error('Missing QA clinic A definition')

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = rowsFromBody(clinicsResponse.body).find((row) => row.name === clinicDef.name) as Clinic | undefined
      expect(clinic, 'clinic A in stage').not.to.eq(undefined)
      if (!clinic) throw new Error('Missing QA clinic A in stage')

      return cy.request('POST', '/api/clinics', { clinicId: clinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)
        return clinic
      })
    })
  })
}

function getActiveWorkspace(): Cypress.Chainable<Workspace> {
  return cy.request('/api/workspaces').then((response) => {
    expect(response.status).to.eq(200)
    expect(response.body.workspace, 'active workspace').not.to.eq(undefined)
    return response.body.workspace as Workspace
  })
}

function assertProtectedRequest(options: Partial<Cypress.RequestOptions>) {
  cy.request({
    failOnStatusCode: false,
    ...options,
  }).then((response) => {
    expect(response.status, `${options.method || 'GET'} ${options.url}`).to.eq(401)
    const errorText = typeof response.body?.error === 'string'
      ? response.body.error
      : JSON.stringify(response.body?.error || response.body || {})
    expect(errorText, 'unauthorized error').to.match(/unauthorized/i)
  })
}

describe('Stage data portability, snapshots, and security coverage', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  it('keeps critical portability and security APIs protected when unauthenticated', () => {
    assertProtectedRequest({
      method: 'POST',
      url: '/api/export/generate',
      body: { workspaceId: missingSnapshotId },
    })

    assertProtectedRequest({
      method: 'POST',
      url: '/api/export/validate',
      body: { metadata: {}, data: {} },
    })

    assertProtectedRequest({ method: 'GET', url: '/api/snapshots' })

    assertProtectedRequest({
      method: 'POST',
      url: `/api/snapshots/${missingSnapshotId}/restore`,
      body: { dryRun: true, createBackupFirst: false },
    })

    assertProtectedRequest({ method: 'GET', url: '/api/settings/security/mfa' })
    assertProtectedRequest({ method: 'POST', url: '/api/settings/security/mfa/setup' })
  })

  it('exports the QA workspace, validates the bundle, and dry-runs import without creating data', () => {
    cy.loginAsDoctor()
    selectQaClinicA()

    cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
      getActiveWorkspace().then((workspace) => {
        cy.request({
          method: 'POST',
          url: '/api/export/generate',
          body: {
            workspaceId: workspace.id,
            options: {
              includeAuditLogs: false,
              includeHistorical: false,
              compress: false,
            },
          },
          timeout: 120000,
        }).then((exportResponse) => {
          expect(exportResponse.status).to.eq(200)
          expect(exportResponse.body.success).to.eq(true)
          expect(exportResponse.body.bundle.metadata.workspaceId).to.eq(workspace.id)
          expect(exportResponse.body.bundle.metadata.workspaceName).to.eq(workspace.name)
          expect(exportResponse.body.stats.totalRecords).to.be.greaterThan(0)

          const bundle = exportResponse.body.bundle as {
            data: {
              clinics: ExportRecord[]
              customRoleTemplates: unknown[]
            }
          }
          const clinicA = bundle.data.clinics.find((row) => row.clinic?.name === 'QA Dental Centro')
          const clinicB = bundle.data.clinics.find((row) => row.clinic?.name === 'QA Dental Norte')
          expect(clinicA, 'workspace export clinic A').not.to.eq(undefined)
          expect(clinicB, 'workspace export clinic B').not.to.eq(undefined)
          if (!clinicA || !clinicB) throw new Error('Missing QA clinics in workspace export')
          expectArrayKeys(clinicA, workspaceClinicArrayKeys)
          expect(bundle.data.customRoleTemplates, 'workspace custom role templates').to.be.an('array')
          expectMinCount(clinicA.recordCounts || {}, 'patients', 30)
          expectMinCount(clinicA.recordCounts || {}, 'treatments', 32)
          expectMinCount(clinicA.recordCounts || {}, 'services', dataset.services.length)
          expectMinCount(clinicA.recordCounts || {}, 'supplies', dataset.supplies.length)
          expectMinCount(clinicA.recordCounts || {}, 'fixed_costs', dataset.fixedCosts.length)
          expectMinCount(clinicA.recordCounts || {}, 'assets', dataset.assets.length)
          expectMinCount(clinicA.recordCounts || {}, 'patient_sources', dataset.sources.length)
          expectMinCount(clinicA.recordCounts || {}, 'marketing_campaigns', dataset.campaigns.length)
          expectMinCount(clinicA.recordCounts || {}, 'service_supplies', expectedServiceSupplyCount(dataset))
          expectMinCount(clinicA.recordCounts || {}, 'expenses', 3)
          expectMinCount(clinicA.recordCounts || {}, 'public_booking_services', 1)
          expectMinCount(clinicA.recordCounts || {}, 'public_bookings', 1)
          expect(clinicA.clinicUsers as unknown[], 'clinic A users').to.have.length.at.least(dataset.users.length)
          expect(clinicB.patients as unknown[], 'clinic B exported patients').to.have.length(0)
          expect(clinicB.treatments as unknown[], 'clinic B exported treatments').to.have.length(0)
          assertTreatmentRelationships(
            clinicA.treatments as ExportRecord[],
            clinicA.patients as ExportRecord[],
            clinicA.services as ExportRecord[]
          )

          cy.request({
            method: 'POST',
            url: '/api/export/validate',
            body: bundle,
            timeout: 120000,
          }).then((validateResponse) => {
            expect(validateResponse.status).to.eq(200)
            expect(validateResponse.body.valid).to.eq(true)
            expect(validateResponse.body.bundleInfo.workspaceName).to.eq(workspace.name)
            expect(validateResponse.body.bundleInfo.recordCounts).to.be.an('object')
          })

          cy.request({
            method: 'POST',
            url: '/api/export/import',
            body: {
              bundle,
              options: {
                dryRun: true,
                mode: 'create',
                skipValidation: false,
              },
            },
            timeout: 120000,
          }).then((importResponse) => {
            expect(importResponse.status).to.eq(200)
            expect(importResponse.body.success).to.eq(true)
            expect(importResponse.body.recordsImported).to.deep.eq({})
            expect(importResponse.body).not.to.have.property('workspaceId')
          })
        })
      })
    })
  })

  it('exports a complete clinic full data bundle for AI and external audits', () => {
    cy.loginAsDoctor()

    cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
      selectQaClinicA().then((clinic) => {
        cy.request({
          method: 'GET',
          url: `/api/clinic/${clinic.id}/export?type=full&period=31`,
          timeout: 120000,
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.headers['content-disposition']).to.match(/clinic-export-.*full.*\.json/)
          expect(response.body.metadata.clinicId).to.eq(clinic.id)
          expect(response.body.metadata.exportType).to.eq('full')
          expect(response.body, 'full export snapshot payload').not.to.have.property('snapshot')

          const data = response.body.data as ExportRecord
          const counts = response.body.metadata.recordCounts as Record<string, number>
          expect(data, 'full clinic export data').not.to.eq(undefined)
          expectArrayKeys(data, clinicFullExportArrayKeys)
          expect(data.clinic?.name).to.eq(clinic.name)
          expect(data.settings_time, 'settings_time object').not.to.eq(undefined)

          expectMinCount(counts, 'patients', 30)
          expectMinCount(counts, 'treatments', 32)
          expectMinCount(counts, 'services', dataset.services.length)
          expectMinCount(counts, 'supplies', dataset.supplies.length)
          expectMinCount(counts, 'fixed_costs', dataset.fixedCosts.length)
          expectMinCount(counts, 'assets', dataset.assets.length)
          expectMinCount(counts, 'patient_sources', dataset.sources.length)
          expectMinCount(counts, 'marketing_campaigns', dataset.campaigns.length)
          expectMinCount(counts, 'service_supplies', expectedServiceSupplyCount(dataset))
          expectMinCount(counts, 'expenses', 3)
          expectMinCount(counts, 'public_booking_services', 1)
          expectMinCount(counts, 'public_bookings', 1)
          expect(data.clinic_users as unknown[], 'clinic users').to.have.length.at.least(dataset.users.length)
          assertTreatmentRelationships(
            data.treatments as ExportRecord[],
            data.patients as ExportRecord[],
            data.services as ExportRecord[]
          )

          const metaCampaign = (data.marketing_campaigns as ExportRecord[]).find((campaign) => campaign.name === 'Meta Mayo')
          expect(metaCampaign, 'Meta Mayo campaign').not.to.eq(undefined)
          if (!metaCampaign) throw new Error('Missing Meta Mayo campaign in full export')
          expect((data.patients as ExportRecord[]).filter((patient) => patient.campaign_id === metaCampaign.id)).to.have.length(22)
          expect((data.patients as ExportRecord[]).filter((patient) => patient.campaign_name === 'Meta Mayo')).to.have.length(22)

          const exportedBytes = JSON.stringify(response.body).length
          expect(exportedBytes, 'QA full export should stay compact').to.be.lessThan(2_000_000)
          expect(Number(response.headers['x-record-count']), 'X-Record-Count').to.eq(
            Object.values(counts).reduce((sum: number, value: number) => sum + Number(value || 0), 0)
          )
        })
      })
    })
  })

  it('creates a snapshot, verifies metadata, dry-runs restore, and deletes it', () => {
    cy.loginAsDoctor()
    selectQaClinicA().then((clinic) => {
      let snapshotId = ''

      cy.request({
        method: 'POST',
        url: '/api/snapshots',
        body: { type: 'manual' },
        timeout: 180000,
      }).then((createResponse) => {
        expect(createResponse.status).to.eq(201)
        snapshotId = createResponse.body.snapshotId
        expect(snapshotId, 'snapshot id').to.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        )
        expect(createResponse.body.stats.totalRecords).to.be.greaterThan(0)

        cy.request(`/api/snapshots/${snapshotId}?metadata=true`).then((metadataResponse) => {
          expect(metadataResponse.status).to.eq(200)
          expect(metadataResponse.body.id).to.eq(snapshotId)
          expect(metadataResponse.body.clinicId).to.eq(clinic.id)
          expect(metadataResponse.body.status).to.eq('completed')
          expect(metadataResponse.body.recordCounts).to.be.an('object')
        })

        cy.request({
          method: 'POST',
          url: `/api/snapshots/${snapshotId}/restore`,
          body: {
            dryRun: true,
            createBackupFirst: false,
            mode: 'merge',
          },
          timeout: 180000,
        }).then((restoreResponse) => {
          expect(restoreResponse.status).to.eq(200)
          expect(restoreResponse.body.success).to.eq(true)
          expect(restoreResponse.body.restoredRecords).to.be.an('object')
        })
      }).then(() => {
        expect(snapshotId, 'snapshot id before cleanup').to.not.eq('')

        cy.request({
          method: 'DELETE',
          url: `/api/snapshots/${snapshotId}`,
          timeout: 120000,
        }).then((deleteResponse) => {
          expect(deleteResponse.status).to.eq(200)
          expect(deleteResponse.body.success).to.eq(true)
          expect(deleteResponse.body.deletedId).to.eq(snapshotId)
        })
      })
    })
  })

  it('checks MFA setup, rejects invalid confirmation, and clears pending security state', () => {
    cy.loginAsDoctor()

    cy.request('DELETE', '/api/settings/security/mfa').its('status').should('eq', 200)

    cy.request('/api/settings/security/mfa').then((statusResponse) => {
      expect(statusResponse.status).to.eq(200)
      expect(statusResponse.body.data.enabled).to.eq(false)
      expect(statusResponse.body.data.hasPendingSetup).to.eq(false)
    })

    cy.request('POST', '/api/settings/security/mfa/setup').then((setupResponse) => {
      expect(setupResponse.status).to.eq(200)
      expect(setupResponse.body.data.secret).to.be.a('string').and.have.length.greaterThan(10)
      expect(setupResponse.body.data.otpauth).to.match(/^otpauth:\/\/totp\//)
      expect(setupResponse.body.data.qrCodeDataUrl).to.match(/^data:image\/png;base64,/)
    })

    cy.request({
      method: 'POST',
      url: '/api/settings/security/mfa/confirm',
      body: { code: '000000' },
      failOnStatusCode: false,
    }).then((confirmResponse) => {
      expect(confirmResponse.status).to.eq(400)
      expect(confirmResponse.body.error).to.match(/invalid verification code/i)
    })

    cy.request('DELETE', '/api/settings/security/mfa').its('status').should('eq', 200)
    cy.request('/api/settings/security/mfa').then((statusResponse) => {
      expect(statusResponse.status).to.eq(200)
      expect(statusResponse.body.data.enabled).to.eq(false)
      expect(statusResponse.body.data.hasPendingSetup).to.eq(false)
    })
  })

  it('renders critical settings pages on desktop and mobile without setup regressions or overflow', () => {
    const routes = [
      { path: '/settings/export-import', text: /Exportar|Export|Importar|Import/i },
      { path: '/settings/snapshots', text: /Snapshots|Instant.neas|Restaurar|Restore|Backup/i },
      { path: '/settings/security', text: /Seguridad|Security|Contrase.a|Password|Autenticaci.n|Authentication/i },
    ]

    const viewports = [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]

    cy.loginAsDoctor()
    selectQaClinicA()

    for (const viewport of viewports) {
      cy.viewport(viewport.width, viewport.height)

      for (const route of routes) {
        cy.visit(route.path)
        cy.location('pathname', { timeout: 30000 }).should('eq', route.path)
        cy.assertNotInSetupFlow()
        cy.contains(route.text, { timeout: 30000 }).should('be.visible')
        cy.assertNoHorizontalScroll()
      }
    }
  })
})
