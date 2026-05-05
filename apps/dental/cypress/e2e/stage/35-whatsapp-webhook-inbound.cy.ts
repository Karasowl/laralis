type QaClinic = {
  key: string
  name: string
}

type WebhookContext = {
  clinicId: string
  clinicName: string
  campaignId: string | null
  campaignName: string | null
}

const qaWebhookHeaders = {
  'x-laralis-qa-webhook': 'mock',
}

function phoneFromStamp(stamp: string, suffix: string) {
  const digits = `${stamp}-${suffix}`.replace(/\D/g, '').slice(-8).padStart(8, '0')
  return `+155${digits}`
}

function twilioSid(stamp: string, suffix: string) {
  return `SM-${stamp}-${suffix}`.replace(/[^A-Za-z0-9-]/g, '')
}

function getWebhookContext(): Cypress.Chainable<WebhookContext> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
    const clinicDef = dataset.clinics.find((row: QaClinic) => row.key === 'clinicA')
    expect(clinicDef, 'clinic A definition').to.exist

    return cy
      .task('qaWhatsAppWebhookContext', { clinicName: clinicDef.name })
      .then((result) => result as WebhookContext)
  })
}

function postWebhook(
  context: WebhookContext,
  body: Record<string, string>,
  options: {
    headers?: Record<string, string>
    campaignId?: string | null
    failOnStatusCode?: boolean
  } = {}
) {
  const campaignQuery = options.campaignId ? `&campaignId=${encodeURIComponent(options.campaignId)}` : ''

  return cy.request({
    method: 'POST',
    url: `/api/whatsapp/webhook?clinicId=${encodeURIComponent(context.clinicId)}${campaignQuery}`,
    form: true,
    body,
    headers: options.headers || qaWebhookHeaders,
    failOnStatusCode: options.failOnStatusCode,
  })
}

function readWebhookState(context: WebhookContext, phone: string): Cypress.Chainable<any> {
  return cy.task('qaWhatsAppWebhookState', {
    clinicId: context.clinicId,
    phone,
  })
}

function expectWebhookOk(response: Cypress.Response<any>) {
  expect(response.status).to.eq(200)
  expect(response.body || '').to.eq('')
}

describe('Stage WhatsApp inbound webhook coverage', () => {
  const cleanupStamps: string[] = []

  afterEach(() => {
    for (const stamp of cleanupStamps) {
      cy.task('qaWhatsAppWebhookCleanup', { stamp }).then((result: any) => {
        expect(result.cleaned, `webhook cleanup ${stamp}`).to.eq(true)
      })
    }
    cleanupStamps.length = 0
  })

  it('rejects unsigned provider requests in the production preview runtime', () => {
    const stamp = `qa-webhook-unsigned-${Date.now()}-${Cypress._.random(1000, 9999)}`

    getWebhookContext().then((context) => {
      postWebhook(
        context,
        {
          From: `whatsapp:${phoneFromStamp(stamp, 'unsigned')}`,
          To: 'whatsapp:+15559990000',
          Body: `No debe crear datos ${stamp}`,
          MessageSid: twilioSid(stamp, 'unsigned'),
        },
        {
          headers: {},
          failOnStatusCode: false,
        }
      ).then((response) => {
        expect(response.status).to.eq(403)
        expect(response.body.error).to.match(/invalid signature/i)
      })
    })
  })

  it('creates and advances a lead through name and email collection without duplicating provider retries', () => {
    const stamp = `qa-webhook-flow-${Date.now()}-${Cypress._.random(1000, 9999)}`
    const phone = phoneFromStamp(stamp, 'flow')
    cleanupStamps.push(stamp)

    getWebhookContext().then((context) => {
      postWebhook(context, {
        From: `whatsapp:${phone}`,
        To: 'whatsapp:+15559990001',
        Body: `Hola desde webhook ${stamp}`,
        MessageSid: twilioSid(stamp, 'first'),
      }).then(expectWebhookOk)

      readWebhookState(context, phone).then((state) => {
        expect(state.leads, 'one lead after first inbound').to.have.length(1)
        expect(state.conversations, 'one open conversation after first inbound').to.have.length(1)
        expect(state.messages, 'one inbound message after first inbound').to.have.length(1)
        expect(state.lead.status).to.eq('new')
        expect(state.lead.full_name).to.eq(null)
        expect(state.conversation.status).to.eq('bot')
        expect(state.conversation.conversation_state).to.eq('collecting_name')
        expect(state.messages[0].content).to.eq(`Hola desde webhook ${stamp}`)
      })

      postWebhook(context, {
        From: `whatsapp:${phone}`,
        To: 'whatsapp:+15559990001',
        Body: `Maria Webhook ${stamp}`,
        MessageSid: twilioSid(stamp, 'name'),
      }).then(expectWebhookOk)

      readWebhookState(context, phone).then((state) => {
        expect(state.lead.full_name).to.eq(`Maria Webhook ${stamp}`)
        expect(state.lead.status).to.eq('contacted')
        expect(state.conversation.contact_name).to.eq(`Maria Webhook ${stamp}`)
        expect(state.conversation.conversation_state).to.eq('collecting_email')
        expect(state.messages.map((message: any) => message.content)).to.include(`Maria Webhook ${stamp}`)
      })

      const email = `${stamp}@laralis.test`
      const emailSid = twilioSid(stamp, 'email')
      postWebhook(context, {
        From: `whatsapp:${phone}`,
        To: 'whatsapp:+15559990001',
        Body: email,
        MessageSid: emailSid,
      }).then(expectWebhookOk)

      readWebhookState(context, phone).then((state) => {
        expect(state.lead.email).to.eq(email)
        expect(state.conversation.conversation_state).to.eq('chatting')
        expect(state.messages).to.have.length(3)
      })

      postWebhook(context, {
        From: `whatsapp:${phone}`,
        To: 'whatsapp:+15559990001',
        Body: email,
        MessageSid: emailSid,
      }).then(expectWebhookOk)

      readWebhookState(context, phone).then((state) => {
        expect(state.messages, 'duplicate MessageSid must not add a second message').to.have.length(3)
        expect(state.messages.filter((message: any) => message.channel_message_id === emailSid)).to.have.length(1)
      })
    })
  })

  it('moves a WhatsApp conversation to pending when the patient asks for a human', () => {
    const stamp = `qa-webhook-handoff-${Date.now()}-${Cypress._.random(1000, 9999)}`
    const phone = phoneFromStamp(stamp, 'handoff')
    cleanupStamps.push(stamp)

    getWebhookContext().then((context) => {
      postWebhook(context, {
        From: `whatsapp:${phone}`,
        To: 'whatsapp:+15559990002',
        Body: `Necesito hablar con humano ${stamp}`,
        ProfileName: `QA Handoff ${stamp}`,
        MessageSid: twilioSid(stamp, 'handoff'),
      }).then(expectWebhookOk)

      readWebhookState(context, phone).then((state) => {
        expect(state.lead.full_name).to.eq(`QA Handoff ${stamp}`)
        expect(state.conversation.status).to.eq('pending')
        expect(state.conversation.conversation_state).to.eq('chatting')
        expect(state.messages).to.have.length(1)
        expect(state.messages[0].content).to.eq(`Necesito hablar con humano ${stamp}`)
      })
    })
  })

  it('persists Click-to-WhatsApp attribution fields from Twilio referral payloads', () => {
    const stamp = `qa-webhook-ctwa-${Date.now()}-${Cypress._.random(1000, 9999)}`
    const phone = phoneFromStamp(stamp, 'ctwa')
    cleanupStamps.push(stamp)

    getWebhookContext().then((context) => {
      expect(context.campaignId, 'QA Meta Mayo campaign').to.be.a('string')

      postWebhook(
        context,
        {
          From: `whatsapp:${phone}`,
          To: 'whatsapp:+15559990003',
          Body: `Hola desde anuncio ${stamp}`,
          MessageSid: twilioSid(stamp, 'ctwa'),
          ReferralCtwaClid: `ctwa-${stamp}`,
          ReferralSourceId: `ad-${stamp}`,
          ReferralSourceType: 'ad',
          ReferralSourceUrl: `https://example.test/${stamp}`,
          ReferralHeadline: `Oferta QA ${stamp}`,
          ReferralBody: `Agenda ahora ${stamp}`,
          ReferralMediaType: 'image',
          ReferralMediaUrl: `https://example.test/${stamp}.jpg`,
        },
        { campaignId: context.campaignId }
      ).then(expectWebhookOk)

      readWebhookState(context, phone).then((state) => {
        expect(state.lead.campaign_id).to.eq(context.campaignId)
        expect(state.conversation.campaign_id).to.eq(context.campaignId)
        expect(state.lead.ctwa_clid).to.eq(`ctwa-${stamp}`)
        expect(state.lead.ad_id).to.eq(`ad-${stamp}`)
        expect(state.lead.ad_source_type).to.eq('ad')
        expect(state.lead.ad_source_url).to.eq(`https://example.test/${stamp}`)
        expect(state.messages[0].metadata.ctwa_referral.ctwa_clid).to.eq(`ctwa-${stamp}`)
      })
    })
  })
})

export {}
