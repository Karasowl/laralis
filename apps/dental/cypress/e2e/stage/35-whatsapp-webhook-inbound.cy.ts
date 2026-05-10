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

function postDialog360Webhook(
  context: WebhookContext,
  body: Record<string, any>,
  options: {
    campaignId?: string | null
    failOnStatusCode?: boolean
  } = {}
) {
  const campaignQuery = options.campaignId ? `&campaignId=${encodeURIComponent(options.campaignId)}` : ''

  return cy.request({
    method: 'POST',
    url: `/api/whatsapp/webhook?clinicId=${encodeURIComponent(context.clinicId)}${campaignQuery}`,
    body,
    headers: {
      ...qaWebhookHeaders,
      'content-type': 'application/json',
    },
    failOnStatusCode: options.failOnStatusCode,
  })
}

function signedWebhookUrl(context: WebhookContext, campaignId?: string | null) {
  const campaignQuery = campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : ''
  return `/api/whatsapp/webhook?clinicId=${encodeURIComponent(context.clinicId)}${campaignQuery}`
}

function postSignedWebhook(
  context: WebhookContext,
  body: Record<string, string>,
  options: {
    campaignId?: string | null
    failOnStatusCode?: boolean
  } = {}
) {
  const relativeUrl = signedWebhookUrl(context, options.campaignId)
  const baseUrl = String(Cypress.config('baseUrl') || '').replace(/\/$/, '')
  const absoluteUrl = `${baseUrl}${relativeUrl}`

  return cy
    .task('qaTwilioWebhookSignature', {
      url: absoluteUrl,
      params: body,
    })
    .then((signature) => cy.request({
      method: 'POST',
      url: relativeUrl,
      form: true,
      body,
      headers: {
        'x-twilio-signature': String(signature),
        'x-laralis-qa-whatsapp-send': 'mock',
      },
      failOnStatusCode: options.failOnStatusCode,
    }))
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

  it('accepts a valid Twilio-signed provider request without the signature bypass', () => {
    const stamp = `qa-webhook-signed-${Date.now()}-${Cypress._.random(1000, 9999)}`
    const phone = phoneFromStamp(stamp, 'signed')
    cleanupStamps.push(stamp)

    getWebhookContext().then((context) => {
      postSignedWebhook(context, {
        From: `whatsapp:${phone}`,
        To: 'whatsapp:+15559990004',
        Body: `Mensaje firmado por contrato Twilio ${stamp}`,
        MessageSid: twilioSid(stamp, 'signed'),
      }).then(expectWebhookOk)

      readWebhookState(context, phone).then((state) => {
        expect(state.leads, 'signed request created one lead').to.have.length(1)
        expect(state.conversations, 'signed request created one conversation').to.have.length(1)
        expect(state.messages, 'signed request created one inbound message').to.have.length(1)
        expect(state.lead.full_name).to.eq(null)
        expect(state.conversation.conversation_state).to.eq('collecting_name')
        expect(state.messages[0].content).to.eq(`Mensaje firmado por contrato Twilio ${stamp}`)
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

  it('persists 360dialog Cloud API text payloads and CTWA attribution', () => {
    const stamp = `qa-webhook-360-${Date.now()}-${Cypress._.random(1000, 9999)}`
    const phone = phoneFromStamp(stamp, 'dialog')
    const waId = phone.replace(/\D/g, '')
    cleanupStamps.push(stamp)

    getWebhookContext().then((context) => {
      expect(context.campaignId, 'QA Meta Mayo campaign').to.be.a('string')

      postDialog360Webhook(
        context,
        {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'qa-waba',
              changes: [
                {
                  field: 'messages',
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '+15559990005',
                      phone_number_id: 'qa-phone-number-id',
                    },
                    contacts: [
                      {
                        wa_id: waId,
                        profile: { name: `QA Dialog ${stamp}` },
                      },
                    ],
                    messages: [
                      {
                        from: waId,
                        id: `wamid.${stamp}.inbound`,
                        timestamp: '1777777777',
                        type: 'text',
                        text: { body: `Necesito humano desde 360dialog ${stamp}` },
                        referral: {
                          ctwa_clid: `d360-ctwa-${stamp}`,
                          source_id: `d360-ad-${stamp}`,
                          source_type: 'ad',
                          source_url: `https://example.test/d360/${stamp}`,
                          headline: `360 Promo ${stamp}`,
                          body: `Reserva desde WhatsApp ${stamp}`,
                          media_type: 'image',
                          image_url: `https://example.test/d360/${stamp}.jpg`,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
        { campaignId: context.campaignId }
      ).then(expectWebhookOk)

      readWebhookState(context, phone).then((state) => {
        expect(state.leads, 'one 360dialog lead').to.have.length(1)
        expect(state.conversations, 'one 360dialog conversation').to.have.length(1)
        expect(state.messages, 'one 360dialog inbound message').to.have.length(1)
        expect(state.lead.full_name).to.eq(`QA Dialog ${stamp}`)
        expect(state.lead.campaign_id).to.eq(context.campaignId)
        expect(state.lead.ctwa_clid).to.eq(`d360-ctwa-${stamp}`)
        expect(state.lead.ad_id).to.eq(`d360-ad-${stamp}`)
        expect(state.conversation.status).to.eq('pending')
        expect(state.messages[0].channel_message_id).to.eq(`wamid.${stamp}.inbound`)
        expect(state.messages[0].metadata.provider_metadata.provider).to.eq('360dialog')
        expect(state.messages[0].metadata.ctwa_referral.ad_media_url).to.eq(`https://example.test/d360/${stamp}.jpg`)
      })
    })
  })

  it('reconciles 360dialog status callbacks into notification and inbox message rows', () => {
    const stamp = `qa-webhook-status-${Date.now()}-${Cypress._.random(1000, 9999)}`
    const phone = phoneFromStamp(stamp, 'status')
    const providerMessageId = `wamid.${stamp}.status`
    cleanupStamps.push(stamp)

    getWebhookContext().then((context) => {
      cy.task('qaWhatsAppStatusSeed', {
        clinicId: context.clinicId,
        stamp,
        phone,
        providerMessageId,
        provider: '360dialog',
      })

      postDialog360Webhook(context, {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'qa-waba',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [
                    {
                      id: providerMessageId,
                      status: 'delivered',
                      timestamp: '1777777777',
                      recipient_id: phone.replace(/\D/g, ''),
                      conversation: { id: `qa-conversation-${stamp}` },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }).then(expectWebhookOk)

      cy.task('qaWhatsAppStatusState', { providerMessageId }).then((state: any) => {
        expect(state.notification.status).to.eq('delivered')
        expect(state.notification.provider_status).to.eq('delivered')
        expect(state.notification.delivered_at).to.be.a('string')
        expect(state.inboxMessage.metadata.provider).to.eq('360dialog')
        expect(state.inboxMessage.metadata.provider_status).to.eq('delivered')
        expect(state.inboxMessage.metadata.provider_delivered_at).to.be.a('string')
      })
    })
  })
})

export {}
