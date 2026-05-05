type QaClinic = {
  key: string
  name: string
}

type Clinic = {
  id: string
  name: string
}

type QaInboxSeed = {
  stamp: string
  clinicId: string
  leadId: string
  conversationId: string
  inboundMessageId: string
  contactName: string
  phone: string
  contactAddress: string
}

const missingConversationId = '00000000-0000-4000-8000-000000000034'

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

function assertProtectedRequest(options: Cypress.RequestOptions & { label: string }) {
  const { label, ...requestOptions } = options

  cy.request({
    failOnStatusCode: false,
    ...requestOptions,
  }).then((response) => {
    expect([401, 403], label).to.include(response.status)
  })
}

function expectStatus(response: Cypress.Response<any>, status = 200) {
  expect(response.status).to.eq(status)
  expect(response.body.data, 'response data').to.exist
}

function seedInboxConversation(stamp: string): Cypress.Chainable<QaInboxSeed> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
    const clinicDef = dataset.clinics.find((row: QaClinic) => row.key === 'clinicA')
    expect(clinicDef, 'clinic A definition').to.exist

    return cy.task('qaInboxSeed', {
      stamp,
      clinicName: clinicDef.name,
    }).then((result) => result as QaInboxSeed)
  })
}

function readInboxState(conversationId: string): Cypress.Chainable<any> {
  return cy.task('qaInboxState', { conversationId })
}

describe('Stage inbox and WhatsApp lifecycle coverage', () => {
  let cleanupStamps: string[] = []

  afterEach(() => {
    for (const stamp of cleanupStamps) {
      cy.task('qaInboxCleanup', { stamp }).then((result: any) => {
        expect(result.cleaned, `inbox cleanup ${stamp}`).to.eq(true)
      })
    }
    cleanupStamps = []
  })

  it('keeps inbox action APIs protected when unauthenticated', () => {
    cy.clearCookies()
    cy.clearLocalStorage()

    const body = { conversationId: missingConversationId }
    const protectedRequests: Array<Cypress.RequestOptions & { label: string }> = [
      { method: 'POST', url: '/api/inbox/mark-read', body, label: 'mark read' },
      { method: 'POST', url: '/api/inbox/assign', body, label: 'assign' },
      { method: 'POST', url: '/api/inbox/toggle-bot', body, label: 'toggle bot' },
      { method: 'POST', url: '/api/inbox/transfer', body, label: 'transfer' },
      { method: 'POST', url: '/api/inbox/close', body, label: 'close' },
      {
        method: 'POST',
        url: '/api/inbox/reply',
        body: { ...body, content: 'QA protected reply' },
        label: 'reply',
      },
      {
        method: 'POST',
        url: '/api/inbox/convert',
        body: { ...body, firstName: 'QA', lastName: 'Inbox' },
        label: 'convert',
      },
    ]

    protectedRequests.forEach(assertProtectedRequest)
  })

  it('manages a WhatsApp conversation through assign, bot handoff, reply, convert, and close', () => {
    const stamp = `qa-inbox-${Date.now()}-${Cypress._.random(1000, 9999)}`
    cleanupStamps.push(stamp)
    const replyContent = `Respuesta QA desde inbox ${stamp}`
    const convertedEmail = `${stamp}.patient@laralis.test`

    cy.loginAsDoctor()
    selectQaClinicA()
    seedInboxConversation(stamp).then((seed) => {
      cy.request('POST', '/api/inbox/mark-read', {
        conversationId: seed.conversationId,
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.unread_count).to.eq(0)
      })

      readInboxState(seed.conversationId).then((state) => {
        expect(state.conversation.unread_count).to.eq(0)
        expect(state.lead.status).to.eq('new')
        expect(state.messages).to.have.length(1)
        expect(state.messages[0].direction).to.eq('inbound')
      })

      cy.request('POST', '/api/inbox/assign', {
        conversationId: seed.conversationId,
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.status).to.eq('in_progress')
        expect(response.body.data.assigned_user_id).to.be.a('string')
      })

      cy.request('POST', '/api/inbox/toggle-bot', {
        conversationId: seed.conversationId,
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.status).to.eq('bot')
      })

      cy.request('POST', '/api/inbox/toggle-bot', {
        conversationId: seed.conversationId,
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.status).to.eq('in_progress')
      })

      cy.request('POST', '/api/inbox/transfer', {
        conversationId: seed.conversationId,
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.status).to.eq('pending')
        expect(response.body.data.assigned_user_id).to.eq(null)
      })

      cy.request({
        method: 'POST',
        url: '/api/inbox/reply',
        headers: { 'x-laralis-qa-notifications': 'mock' },
        body: {
          conversationId: seed.conversationId,
          content: replyContent,
        },
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.content).to.eq(replyContent)
        expect(response.body.data.direction).to.eq('outbound')
        expect(response.body.data.channel_message_id).to.match(/^qa-inbox-reply-/)
        expect(response.body.sendResult.success).to.eq(true)
      })

      readInboxState(seed.conversationId).then((state) => {
        expect(state.conversation.status).to.eq('in_progress')
        expect(state.conversation.assigned_user_id).to.be.a('string')
        expect(state.messages.map((message: any) => message.content)).to.include(replyContent)
      })

      cy.request('POST', '/api/inbox/convert', {
        conversationId: seed.conversationId,
        firstName: 'QA Inbox',
        lastName: stamp,
        email: convertedEmail,
        phone: seed.phone,
        notes: `qa-inbox converted ${stamp}`,
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.alreadyLinked).to.eq(false)
        expect(response.body.data.patient.email).to.eq(convertedEmail)
      })

      readInboxState(seed.conversationId).then((state) => {
        expect(state.lead.status).to.eq('converted')
        expect(state.lead.converted_patient_id).to.eq(state.patient.id)
        expect(state.conversation.patient_id).to.eq(state.patient.id)
        expect(state.patient.email).to.eq(convertedEmail)
      })

      cy.request('POST', '/api/inbox/convert', {
        conversationId: seed.conversationId,
        firstName: 'QA Inbox',
        lastName: stamp,
        email: convertedEmail,
        phone: seed.phone,
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.alreadyLinked).to.eq(true)
        expect(response.body.data.patient.email).to.eq(convertedEmail)
      })

      cy.request('POST', '/api/inbox/close', {
        conversationId: seed.conversationId,
      }).then((response) => {
        expectStatus(response)
        expect(response.body.data.status).to.eq('closed')
        expect(response.body.data.ended_at).to.be.a('string')
      })

      cy.request({
        method: 'POST',
        url: '/api/inbox/reply',
        headers: { 'x-laralis-qa-notifications': 'mock' },
        body: {
          conversationId: seed.conversationId,
          content: `No debe enviarse ${stamp}`,
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body.error).to.match(/closed/i)
      })
    })
  })

  it('executes inbox operator actions from the UI and persists each confirmed change', () => {
    const stamp = `qa-inbox-ui-actions-${Date.now()}-${Cypress._.random(1000, 9999)}`
    cleanupStamps.push(stamp)
    const replyContent = `Respuesta QA desde UI Inbox ${stamp}`
    const convertedEmail = `${stamp}.ui-patient@laralis.test`

    cy.loginAsDoctor()
    selectQaClinicA()
    seedInboxConversation(stamp).then((seed) => {
      cy.intercept('POST', '/api/inbox/assign').as('uiInboxAssign')
      cy.intercept('POST', '/api/inbox/toggle-bot').as('uiInboxToggleBot')
      cy.intercept('POST', '/api/inbox/transfer').as('uiInboxTransfer')
      cy.intercept('POST', '/api/inbox/convert').as('uiInboxConvert')
      cy.intercept('POST', '/api/inbox/close').as('uiInboxClose')
      cy.intercept('POST', '/api/inbox/reply', (request) => {
        request.headers['x-laralis-qa-notifications'] = 'mock'
      }).as('uiInboxReply')

      cy.visit('/inbox')
      cy.get('[data-testid="inbox-page"]', { timeout: 30000 }).should('be.visible')
      cy.get(`[data-conversation-id="${seed.conversationId}"]`, { timeout: 30000 }).click()
      cy.get('[data-testid="inbox-conversation-title"]', { timeout: 30000 })
        .should('contain.text', seed.contactName)

      cy.get('[data-testid="inbox-action-assign"]').should('be.enabled').click()
      cy.wait('@uiInboxAssign', { timeout: 30000 })
        .its('response.statusCode')
        .should('eq', 200)
      readInboxState(seed.conversationId).then((state) => {
        expect(state.conversation.status).to.eq('in_progress')
        expect(state.conversation.assigned_user_id).to.be.a('string')
        expect(state.conversation.unread_count).to.eq(0)
      })

      cy.get('[data-testid="inbox-action-toggle-bot"]').should('be.enabled').click()
      cy.wait('@uiInboxToggleBot', { timeout: 30000 })
        .its('response.statusCode')
        .should('eq', 200)
      readInboxState(seed.conversationId).then((state) => {
        expect(state.conversation.status).to.eq('bot')
      })

      cy.get('[data-testid="inbox-action-transfer"]').should('be.enabled').click()
      cy.wait('@uiInboxTransfer', { timeout: 30000 })
        .its('response.statusCode')
        .should('eq', 200)
      readInboxState(seed.conversationId).then((state) => {
        expect(state.conversation.status).to.eq('pending')
        expect(state.conversation.assigned_user_id).to.eq(null)
      })

      cy.get('[data-testid="inbox-reply-textarea"]').should('be.enabled').clear().type(replyContent)
      cy.get('[data-testid="inbox-reply-submit"]').should('be.enabled').click()
      cy.wait('@uiInboxReply', { timeout: 30000 }).then((interception) => {
        expect(interception.response?.statusCode).to.eq(200)
        expect(interception.response?.body?.sendResult?.success).to.eq(true)
      })
      cy.contains(replyContent, { timeout: 30000 }).should('be.visible')
      readInboxState(seed.conversationId).then((state) => {
        expect(state.conversation.status).to.eq('in_progress')
        expect(state.conversation.assigned_user_id).to.be.a('string')
        const outbound = state.messages.find((message: any) => message.content === replyContent)
        expect(outbound, 'outbound UI reply').to.exist
        expect(outbound.direction).to.eq('outbound')
        expect(outbound.channel_message_id).to.match(/^qa-inbox-reply-/)
      })

      cy.get('[data-testid="inbox-action-convert"]').should('be.enabled').click()
      cy.get('[data-testid="inbox-convert-dialog"]', { timeout: 30000 }).should('be.visible')
      cy.get('[data-testid="inbox-convert-first-name"]').clear().type('UI')
      cy.get('[data-testid="inbox-convert-last-name"]').clear().type(`Inbox ${stamp}`)
      cy.get('[data-testid="inbox-convert-email"]').clear().type(convertedEmail)
      cy.get('[data-testid="inbox-convert-notes"]').clear().type(`Converted from Inbox UI QA ${stamp}`)
      cy.get('[data-testid="inbox-convert-submit"]').should('be.enabled').click()
      cy.wait('@uiInboxConvert', { timeout: 30000 })
        .its('response.statusCode')
        .should('eq', 200)
      readInboxState(seed.conversationId).then((state) => {
        expect(state.lead.status).to.eq('converted')
        expect(state.patient.email).to.eq(convertedEmail)
        expect(state.conversation.patient_id).to.eq(state.patient.id)
      })

      cy.get('[data-testid="inbox-action-close"]').should('be.enabled').click()
      cy.wait('@uiInboxClose', { timeout: 30000 })
        .its('response.statusCode')
        .should('eq', 200)
      readInboxState(seed.conversationId).then((state) => {
        expect(state.conversation.status).to.eq('closed')
        expect(state.conversation.ended_at).to.be.a('string')
      })
      cy.get('[data-testid="inbox-reply-textarea"]').should('be.disabled')
      cy.get('[data-testid="inbox-reply-submit"]').should('be.disabled')
    })
  })

  it('renders the inbox conversation on desktop and mobile without setup regressions or overflow', () => {
    const stamp = `qa-inbox-ui-${Date.now()}-${Cypress._.random(1000, 9999)}`
    cleanupStamps.push(stamp)

    cy.loginAsDoctor()
    selectQaClinicA()
    seedInboxConversation(stamp).then((seed) => {
      ;[
        { width: 1366, height: 768 },
        { width: 390, height: 844 },
      ].forEach((viewport) => {
        cy.viewport(viewport.width, viewport.height)
        cy.visit('/inbox')
        cy.location('pathname', { timeout: 30000 }).should('eq', '/inbox')
        cy.assertNotInSetupFlow()
        cy.get('main', { timeout: 30000 }).should('be.visible')
        cy.get('main').contains(/Bandeja de entrada|Inbox/i, { timeout: 30000 }).should('be.visible')
        cy.get('main').contains(seed.contactName, { timeout: 30000 }).should('be.visible')
        cy.get('main').contains(`Hola, quiero una cita desde WhatsApp QA ${stamp}`, { timeout: 30000 }).should('be.visible')
        cy.contains(/Application error|Internal Server Error|Unhandled Runtime Error|Something went wrong/i)
          .should('not.exist')
        cy.assertNoHorizontalScroll()
      })
    })
  })
})

export {}
