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

const missingSnapshotId = '00000000-0000-4000-8000-000000000001'

function rowsFromBody(body: any) {
  return Array.isArray(body) ? body : (body.data || [])
}

function selectQaClinicA(): Cypress.Chainable<Clinic> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
    const clinicDef = dataset.clinics.find((row: QaClinic) => row.key === 'clinicA')
    expect(clinicDef, 'clinic A definition').to.exist

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = rowsFromBody(clinicsResponse.body).find((row: Clinic) => row.name === clinicDef.name)
      expect(clinic, 'clinic A in stage').to.exist

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
    expect(response.body.workspace, 'active workspace').to.exist
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

        const bundle = exportResponse.body.bundle

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
          expect(importResponse.body.workspaceId).to.be.undefined
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
