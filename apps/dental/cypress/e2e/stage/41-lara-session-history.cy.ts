export {}

type QaDataset = {
  clinics: Array<{
    key: string
    name: string
  }>
}

type Clinic = {
  id: string
  name: string
}

type ChatSession = {
  id: string
  clinic_id: string
  mode: 'entry' | 'query'
  title: string | null
  is_archived: boolean
  message_count: number
  ended_at: string | null
}

type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
  action_suggested?: {
    type?: string
    payload?: Record<string, unknown>
  } | null
  entity_type?: string | null
  audio_duration_ms?: number | null
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

function createLaraSession(clinicId: string, title: string): Cypress.Chainable<ChatSession> {
  return cy
    .request('POST', '/api/ai/sessions', {
      clinicId,
      mode: 'query',
      title,
    })
    .then((response) => {
      expect(response.status).to.eq(201)
      expect(response.body.data.clinic_id).to.eq(clinicId)
      expect(response.body.data.mode).to.eq('query')
      expect(response.body.data.title).to.eq(title)
      return response.body.data as ChatSession
    })
}

function addMessage(sessionId: string, body: Partial<ChatMessage> & Pick<ChatMessage, 'role' | 'content'>) {
  return cy.request('POST', `/api/ai/sessions/${sessionId}/messages`, body).then((response) => {
    expect(response.status).to.eq(201)
    expect(response.body.data.role).to.eq(body.role)
    expect(response.body.data.content).to.eq(body.content)
    return response.body.data as ChatMessage
  })
}

function deleteSessionIfPresent(sessionId: string) {
  return cy.request({
    method: 'DELETE',
    url: `/api/ai/sessions/${sessionId}`,
    failOnStatusCode: false,
  })
}

describe('Stage Lara persisted session history', () => {
  const viewerEmail = Cypress.env('STAGE_VIEWER_EMAIL') || 'qa-viewer@laralis.test'
  const createdSessionIds: string[] = []

  beforeEach(() => {
    cy.viewport(1280, 720)
  })

  afterEach(() => {
    if (createdSessionIds.length === 0) return

    cy.loginAsDoctor()
    selectQaClinic('clinicA').then(() => {
      cy.wrap([...createdSessionIds]).each((sessionId) => {
        deleteSessionIfPresent(String(sessionId))
      })
      createdSessionIds.length = 0
    })
  })

  it('persists messages, scopes history by clinic and owner, then archives and deletes cleanly', () => {
    cy.loginAsDoctor()

    selectQaClinic('clinicA').then((clinicA) => {
      const title = `QA Lara history ${Date.now()}`

      createLaraSession(clinicA.id, title).then((session) => {
        createdSessionIds.push(session.id)

        addMessage(session.id, {
          role: 'user',
          content: 'Resume los pacientes de Meta Mayo y recuerda este contexto.',
          entity_type: 'campaign',
          audio_duration_ms: 1800,
        })

        addMessage(session.id, {
          role: 'assistant',
          content: 'Meta Mayo tiene 22 pacientes atribuidos en la clinica QA.',
          action_suggested: {
            type: 'analyze_campaign',
            payload: {
              campaign: 'Meta Mayo',
              expectedPatients: 22,
            },
          },
        })

        cy.request(`/api/ai/sessions/${session.id}`).then((historyResponse) => {
          expect(historyResponse.status).to.eq(200)
          expect(historyResponse.body.data.session.id).to.eq(session.id)
          expect(historyResponse.body.data.session.message_count).to.eq(2)

          const messages = historyResponse.body.data.messages as ChatMessage[]
          expect(messages.map((message) => message.role)).to.deep.eq(['user', 'assistant'])
          expect(messages[0].content).to.contain('Meta Mayo')
          expect(messages[0].audio_duration_ms).to.eq(1800)
          expect(messages[1].action_suggested?.type).to.eq('analyze_campaign')
          expect(messages[1].action_suggested?.payload?.expectedPatients).to.eq(22)
        })

        cy.request(`/api/ai/sessions?clinicId=${clinicA.id}&mode=query&limit=20`).then((listResponse) => {
          expect(listResponse.status).to.eq(200)
          const sessions = listResponse.body.data as ChatSession[]
          expect(sessions.some((item) => item.id === session.id)).to.eq(true)
        })

        selectQaClinic('clinicB').then((clinicB) => {
          cy.request(`/api/ai/sessions?clinicId=${clinicB.id}&mode=query&limit=20`).then((otherClinicResponse) => {
            expect(otherClinicResponse.status).to.eq(200)
            const otherClinicSessions = otherClinicResponse.body.data as ChatSession[]
            expect(otherClinicSessions.some((item) => item.id === session.id)).to.eq(false)
          })
        })

        cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
        selectQaClinic('clinicA').then(() => {
          cy.request({
            method: 'GET',
            url: `/api/ai/sessions/${session.id}`,
            failOnStatusCode: false,
          }).then((viewerResponse) => {
            expect(viewerResponse.status).to.eq(404)
          })
        })

        cy.loginAsDoctor()
        selectQaClinic('clinicA').then(() => {
          cy.request('PATCH', `/api/ai/sessions/${session.id}`, {
            title: `${title} archived`,
            is_archived: true,
            ended_at: new Date().toISOString(),
          }).then((archiveResponse) => {
            expect(archiveResponse.status).to.eq(200)
            expect(archiveResponse.body.data.title).to.eq(`${title} archived`)
            expect(archiveResponse.body.data.is_archived).to.eq(true)
            expect(archiveResponse.body.data.ended_at).to.be.a('string')
          })

          cy.request(`/api/ai/sessions?clinicId=${clinicA.id}&mode=query&limit=20`).then((activeListResponse) => {
            expect(activeListResponse.status).to.eq(200)
            const activeSessions = activeListResponse.body.data as ChatSession[]
            expect(activeSessions.some((item) => item.id === session.id)).to.eq(false)
          })

          cy.request(`/api/ai/sessions?clinicId=${clinicA.id}&mode=query&includeArchived=true&limit=20`).then(
            (archivedListResponse) => {
              expect(archivedListResponse.status).to.eq(200)
              const archivedSessions = archivedListResponse.body.data as ChatSession[]
              expect(archivedSessions.some((item) => item.id === session.id && item.is_archived)).to.eq(true)
            }
          )

          deleteSessionIfPresent(session.id).then((deleteResponse) => {
            expect(deleteResponse.status).to.eq(200)
            createdSessionIds.splice(createdSessionIds.indexOf(session.id), 1)
          })

          cy.request({
            method: 'GET',
            url: `/api/ai/sessions/${session.id}`,
            failOnStatusCode: false,
          }).then((deletedResponse) => {
            expect(deletedResponse.status).to.eq(404)
          })
        })
      })
    })
  })
})
