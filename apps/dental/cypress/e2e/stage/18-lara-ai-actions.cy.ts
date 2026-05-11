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

type TimeSettings = {
  work_days: number
  hours_per_day: number
  real_pct: number
  monthly_goal_cents?: number | null
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

function getTimeSettings(): Cypress.Chainable<TimeSettings | null> {
  return cy.request('/api/settings/time').then((response) => {
    expect(response.status).to.eq(200)
    return response.body.data as TimeSettings | null
  }) as Cypress.Chainable<TimeSettings | null>
}

function saveTimeSettings(clinicId: string, settings: TimeSettings): Cypress.Chainable<TimeSettings> {
  return cy.request('POST', '/api/settings/time', {
    clinic_id: clinicId,
    work_days: settings.work_days,
    hours_per_day: settings.hours_per_day,
    real_pct: settings.real_pct,
    monthly_goal_cents: settings.monthly_goal_cents ?? null,
  }).then((response) => {
    expect(response.status).to.eq(200)
    return response.body.data as TimeSettings
  })
}

function parseSse(body: unknown) {
  const text = typeof body === 'string' ? body : String(body || '')
  const events = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6))

  const content = events
    .filter((event) => event !== '[DONE]')
    .map((event) => JSON.parse(event))
    .filter((event) => event.type === 'content')
    .map((event) => event.data)
    .join('')

  const metadata = events
    .filter((event) => event !== '[DONE]')
    .map((event) => JSON.parse(event))
    .find((event) => event.type === 'metadata')?.data

  return { content, metadata }
}

describe('Stage Lara AI assistant actions and audio', () => {
  const viewerEmail = 'qa-viewer@laralis.test'
  const baselineTimeSettings: TimeSettings = {
    work_days: 26,
    hours_per_day: 8,
    real_pct: 75,
    monthly_goal_cents: null,
  }
  let clinicId = ''
  let originalTimeSettings: TimeSettings | null = null

  afterEach(() => {
    const restoreClinicId = clinicId
    const settingsToRestore = originalTimeSettings

    clinicId = ''
    originalTimeSettings = null

    if (!restoreClinicId || !settingsToRestore) return

    cy.loginAsDoctor()
    selectQaClinic('clinicA').then((clinic) => {
      saveTimeSettings(clinic.id, settingsToRestore)
    })
  })

  it('streams a deterministic Lara answer with a suggested action in stage', () => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA').then((clinic) => {
      clinicId = clinic.id

      cy.request({
        method: 'POST',
        url: '/api/ai/query',
        headers: {
          'x-laralis-qa-ai': 'mock',
        },
        body: {
          clinicId: clinic.id,
          query: 'QA: propon una mejora de tiempo',
          locale: 'es',
        },
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(String(response.headers['content-type'])).to.include('text/event-stream')

        const { content, metadata } = parseSse(response.body)
        expect(content).to.include('Lara QA respondio de forma deterministica')
        expect(metadata.clinicId).to.eq(clinic.id)
        expect(metadata.suggestedAction.action).to.eq('update_time_settings')
        expect(metadata.suggestedAction.params.work_days).to.eq(25)
        expect(metadata.suggestedAction.params.hours_per_day).to.eq(7)
        expect(metadata.suggestedAction.params.real_productivity_pct).to.eq(82)
      })
    })
  })

  it('threads conversation context through the stage query pipeline', () => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA').then((clinic) => {
      cy.request({
        method: 'POST',
        url: '/api/ai/query',
        headers: {
          'x-laralis-qa-ai': 'mock',
        },
        body: {
          clinicId: clinic.id,
          query: 'Y su margen?',
          locale: 'es',
          conversationHistory: [
            {
              role: 'user',
              content: 'Analiza el servicio "Limpieza QA" este mes',
            },
            {
              role: 'assistant',
              content: 'Limpieza QA mantiene buen margen este mes.',
            },
          ],
        },
      }).then((response) => {
        expect(response.status).to.eq(200)

        const { metadata } = parseSse(response.body)
        const conversationContext = metadata.data.conversationContext

        expect(metadata.data.checked).to.include('conversation_context')
        expect(conversationContext.primaryEntity).to.deep.eq({
          type: 'service',
          name: 'Limpieza QA',
        })
        expect(conversationContext.timePeriod.label).to.eq('este mes')
        expect(conversationContext.currentTopic).to.eq('profitability')
        expect(conversationContext.pendingActions).to.deep.eq([])
      })
    })
  })

  it('opens Lara, confirms a suggested action, and persists the database effect', () => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA').then((clinic) => {
      clinicId = clinic.id
    })
    getTimeSettings().then((settings) => {
      originalTimeSettings = settings || { ...baselineTimeSettings }
      if (!settings) {
        return saveTimeSettings(clinicId, baselineTimeSettings)
      }
    })

    cy.intercept('POST', '/api/ai/query', (req) => {
      req.headers['x-laralis-qa-ai'] = 'mock'
    }).as('laraQuery')
    cy.intercept('POST', '/api/actions/update-time-settings').as('updateTimeSettings')

    cy.visit('/')
    cy.assertAppShell()
    cy.get('[data-testid="lara-fab"]', { timeout: 30000 }).should('be.visible').click()
    cy.get('[data-testid="lara-query-mode"]', { timeout: 30000 }).should('be.visible').click()
    cy.get('[data-testid="lara-query-assistant"]', { timeout: 30000 }).should('be.visible')
    cy.get('[data-testid="lara-new-conversation"]').click()
    cy.get('[data-testid="lara-query-input"]').should('be.enabled').clear().type('QA: ajusta mi tiempo operativo')
    cy.get('[data-testid="lara-query-submit"]').should('be.enabled').click()

    cy.wait('@laraQuery', { timeout: 45000 })
    cy.contains('Lara QA respondio de forma deterministica', { timeout: 45000 }).should('exist')
    cy.get('[data-testid="lara-action-card"]', { timeout: 45000 }).scrollIntoView().should('be.visible')
    const actionStartedAt = new Date(Date.now() - 5000).toISOString()
    cy.get('[data-testid="lara-action-confirm"]').click()

    cy.wait('@updateTimeSettings', { timeout: 45000 }).then((interception) => {
      expect(interception.response?.statusCode).to.eq(200)
      expect(interception.response?.body?.success).to.eq(true)
    })

    getTimeSettings().then((settings) => {
      expect(settings?.work_days).to.eq(25)
      expect(settings?.hours_per_day).to.eq(7)
      expect(settings?.real_pct).to.eq(82)
    })

    cy.then(() => {
      expect(clinicId, 'QA clinic id for Lara audit').to.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )

      return cy.task('qaFindActionLogs', {
        clinicId,
        actionType: 'update_time_settings',
        sinceIso: actionStartedAt,
      })
    }).then((result) => {
      const audit = result as {
        count: number
        logs: Array<{ success: boolean; dry_run: boolean; error_code: string | null }>
      }

      expect(audit.count, 'Lara action audit rows').to.be.greaterThan(0)
      expect(audit.logs[0].success).to.eq(true)
      expect(audit.logs[0].dry_run).to.eq(false)
      expect(audit.logs[0].error_code).to.eq(null)
    })
  })

  it('blocks viewer users from Lara query mocks and mutable Lara actions', () => {
    cy.loginAsStageUser(viewerEmail, undefined, { allowSetup: true })
    selectQaClinic('clinicA').then((clinic) => {
      cy.request({
        method: 'POST',
        url: '/api/ai/query',
        headers: {
          'x-laralis-qa-ai': 'mock',
        },
        body: {
          clinicId: clinic.id,
          query: 'QA viewer should be forbidden',
          locale: 'es',
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status, 'viewer cannot query Lara mock').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })

      cy.request({
        method: 'POST',
        url: '/api/actions/update-time-settings',
        body: {
          clinic_id: clinic.id,
          work_days: 25,
          hours_per_day: 7,
          real_productivity_pct: 82,
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status, 'viewer cannot execute Lara actions').to.eq(403)
        expect(response.body.error).to.eq('Forbidden')
      })
    })
  })

  it('mocks audio input and output providers without hitting external services', () => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA')

    cy.request({
      method: 'POST',
      url: '/api/ai/synthesize',
      headers: {
        'x-laralis-qa-ai': 'mock',
      },
      body: {
        text: 'Hola Lara QA',
      },
      encoding: 'binary',
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(String(response.headers['content-type'])).to.include('audio/mpeg')
      expect(String(response.body).length).to.be.greaterThan(0)
    })

    cy.visit('/')
    cy.window().then((win) => {
      const formData = new win.FormData()
      formData.append('audio', new win.Blob(['qa-audio'], { type: 'audio/webm' }), 'qa.webm')
      formData.append('language', 'es')

      return win
        .fetch('/api/ai/transcribe', {
          method: 'POST',
          headers: {
            'x-laralis-qa-ai': 'mock',
          },
          body: formData,
          credentials: 'same-origin',
        })
        .then(async (response) => ({
          status: response.status,
          body: await response.json(),
        }))
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.provider).to.eq('qa-mock')
      expect(response.body.transcript).to.eq('Lara QA transcribio audio de prueba')
    })
  })

  it('surfaces deterministic provider failures for Lara query, STT, and TTS', () => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA').then((clinic) => {
      cy.request({
        method: 'POST',
        url: '/api/ai/query',
        headers: {
          'x-laralis-qa-ai': 'fail',
        },
        body: {
          clinicId: clinic.id,
          query: 'QA: fuerza un fallo del proveedor de IA',
          locale: 'es',
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(503)
        expect(response.body.error).to.eq('qa_ai_failure')
        expect(response.body.retryable).to.eq(true)
      })
    })

    cy.request({
      method: 'POST',
      url: '/api/ai/synthesize',
      headers: {
        'x-laralis-qa-ai': 'fail',
      },
      body: {
        text: 'QA: fuerza un fallo TTS',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(503)
      expect(response.body.error).to.eq('qa_tts_failure')
      expect(response.body.retryable).to.eq(true)
    })

    cy.visit('/')
    cy.window().then((win) => {
      const formData = new win.FormData()
      formData.append('audio', new win.Blob(['qa-audio-failure'], { type: 'audio/webm' }), 'qa-failure.webm')
      formData.append('language', 'es')

      return win
        .fetch('/api/ai/transcribe', {
          method: 'POST',
          headers: {
            'x-laralis-qa-ai': 'fail',
          },
          body: formData,
          credentials: 'same-origin',
        })
        .then(async (response) => ({
          status: response.status,
          body: await response.json(),
        }))
    }).then((response) => {
      expect(response.status).to.eq(503)
      expect(response.body.error).to.eq('qa_stt_failure')
      expect(response.body.retryable).to.eq(true)
    })
  })

  it('plays Lara response audio from the UI with browser audio mocked', () => {
    cy.loginAsDoctor()
    selectQaClinic('clinicA')

    cy.intercept('POST', '/api/ai/query', (req) => {
      req.headers['x-laralis-qa-ai'] = 'mock'
    }).as('laraQuery')

    cy.intercept('POST', '/api/ai/synthesize', {
      statusCode: 200,
      headers: {
        'content-type': 'audio/mpeg',
      },
      body: 'qa-audio-bytes',
    }).as('laraTts')

    cy.visit('/', {
      onBeforeLoad(win) {
        const events: string[] = []
        ;(win as any).__laraAudioEvents = events
        win.URL.createObjectURL = () => 'blob:laralis-qa-audio'
        win.URL.revokeObjectURL = () => undefined

        class QaAudio {
          onended: null | (() => void) = null
          onerror: null | (() => void) = null
          src: string

          constructor(src: string) {
            this.src = src
            events.push(`create:${src}`)
          }

          play() {
            events.push('play')
            setTimeout(() => {
              this.onended?.()
            }, 0)
            return Promise.resolve()
          }

          pause() {
            events.push('pause')
          }
        }

        ;(win as any).Audio = QaAudio
      },
    })

    cy.assertAppShell()
    cy.get('[data-testid="lara-fab"]', { timeout: 30000 }).should('be.visible').click()
    cy.get('[data-testid="lara-query-mode"]', { timeout: 30000 }).should('be.visible').click()
    cy.get('[data-testid="lara-query-assistant"]', { timeout: 30000 }).should('be.visible')
    cy.get('[data-testid="lara-new-conversation"]').click()
    cy.get('[data-testid="lara-query-input"]').should('be.enabled').clear().type('QA: quiero escuchar esta respuesta')
    cy.get('[data-testid="lara-query-submit"]').should('be.enabled').click()

    cy.wait('@laraQuery', { timeout: 45000 })
    const responseText = 'Lara QA respondio de forma deterministica'
    cy.get('[data-testid="lara-query-scroll"]', { timeout: 30000 }).scrollTo('bottom', { ensureScrollable: false })
    cy.get('[data-testid="lara-message-assistant"]', { timeout: 45000 }).should(($messages) => {
      const hasMatchingMessage = $messages.toArray().some((message) =>
        message.textContent?.includes(responseText)
      )
      expect(hasMatchingMessage, 'rendered Lara QA response').to.eq(true)
    })
    cy.get('[data-testid="lara-message-assistant"]').then(($messages) => {
      const latestMatchingMessage = $messages.toArray().reverse().find((message) =>
        message.textContent?.includes(responseText)
      )

      expect(latestMatchingMessage, 'latest Lara QA response').to.exist
      latestMatchingMessage?.scrollIntoView({ block: 'center', inline: 'nearest' })

      cy.wrap(latestMatchingMessage)
        .should('be.visible')
        .within(() => {
          cy.contains(responseText).should('be.visible')
          cy.get('[data-testid="lara-audio-play"], button[title="Escuchar"], button[title="Listen"]')
            .should('be.visible')
            .click()
        })
    })
    cy.wait('@laraTts', { timeout: 30000 }).its('response.statusCode').should('eq', 200)

    cy.window().its('__laraAudioEvents').should((events) => {
      expect(events).to.include('create:blob:laralis-qa-audio')
      expect(events).to.include('play')
    })
  })
})
