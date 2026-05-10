type DeliveryWebhookSeed = {
  clinicId: string
  clinicName: string
  emailId: string
  smsId: string
  emailProviderMessageId: string
  smsProviderMessageId: string
}

function formBody(params: Record<string, string>) {
  return new URLSearchParams(params).toString()
}

describe('Stage notification delivery webhooks', () => {
  let seed: DeliveryWebhookSeed | null = null

  before(() => {
    cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
      const clinic = dataset.clinics.find((row: any) => row.key === 'clinicA')
      expect(clinic, 'QA clinic A').to.exist

      const stamp = `qa-delivery-webhook-${Date.now()}-${Cypress._.random(1000, 9999)}`
      cy.task('qaNotificationDeliveryWebhookSeed', {
        stamp,
        clinicName: clinic.name,
      }).then((result) => {
        seed = result as DeliveryWebhookSeed
      })
    })
  })

  after(() => {
    if (!seed) return
    cy.task('qaNotificationDeliveryWebhookCleanup', {
      providerMessageIds: [
        seed.emailProviderMessageId,
        seed.smsProviderMessageId,
      ],
    })
  })

  it('rejects unsigned external delivery callbacks in the production preview runtime', () => {
    cy.request({
      method: 'POST',
      url: '/api/webhooks/resend',
      failOnStatusCode: false,
      body: {
        type: 'email.delivered',
        created_at: '2026-05-08T12:00:00.000Z',
        data: {
          email_id: seed?.emailProviderMessageId || 'qa-email-missing',
        },
      },
    }).then((response) => {
      expect(response.status).to.eq(403)
    })

    cy.request({
      method: 'POST',
      url: '/api/webhooks/twilio/sms-status',
      failOnStatusCode: false,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: formBody({
        MessageSid: seed?.smsProviderMessageId || 'qa-sms-missing',
        MessageStatus: 'delivered',
      }),
    }).then((response) => {
      expect(response.status).to.eq(403)
    })
  })

  it('reconciles Resend bounce callbacks into email_notifications', () => {
    expect(seed, 'seeded delivery webhook rows').to.exist

    cy.request({
      method: 'POST',
      url: '/api/webhooks/resend',
      headers: {
        'x-laralis-qa-webhook': 'mock',
      },
      body: {
        type: 'email.bounced',
        created_at: '2026-05-08T12:05:00.000Z',
        data: {
          email_id: seed!.emailProviderMessageId,
          created_at: '2026-05-08T12:04:30.000Z',
          from: 'Laralis <no-reply@laralis.test>',
          to: ['qa-patient@laralis.test'],
          subject: 'QA delivery webhook',
          bounce: {
            message: 'Mailbox unavailable',
            type: 'permanent',
            subType: 'suppressed',
          },
        },
      },
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.success).to.eq(true)
      expect(response.body.providerMessageId).to.eq(seed!.emailProviderMessageId)
      expect(response.body.status).to.eq('bounced')
      expect(response.body.updatedCount).to.eq(1)
    })

    cy.task('qaNotificationDeliveryWebhookState', {
      emailProviderMessageId: seed!.emailProviderMessageId,
      smsProviderMessageId: seed!.smsProviderMessageId,
    }).then((state: any) => {
      expect(state.email.status).to.eq('bounced')
      expect(state.email.error_message).to.eq('Mailbox unavailable')
      expect(state.email.metadata.resend_event).to.eq('email.bounced')
      expect(state.email.metadata.provider_status).to.eq('bounced')
    })
  })

  it('reconciles Twilio SMS delivery callbacks into sms_notifications', () => {
    expect(seed, 'seeded delivery webhook rows').to.exist

    cy.request({
      method: 'POST',
      url: '/api/webhooks/twilio/sms-status',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-laralis-qa-webhook': 'mock',
      },
      body: formBody({
        MessageSid: seed!.smsProviderMessageId,
        MessageStatus: 'delivered',
        Timestamp: '2026-05-08T12:10:00.000Z',
      }),
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.success).to.eq(true)
      expect(response.body.providerMessageId).to.eq(seed!.smsProviderMessageId)
      expect(response.body.status).to.eq('delivered')
      expect(response.body.updatedCount).to.eq(1)
    })

    cy.task('qaNotificationDeliveryWebhookState', {
      emailProviderMessageId: seed!.emailProviderMessageId,
      smsProviderMessageId: seed!.smsProviderMessageId,
    }).then((state: any) => {
      expect(state.sms.status).to.eq('delivered')
      expect(state.sms.delivered_at).to.include('2026-05-08T12:10:00')
      expect(state.sms.error_message).to.be.null
    })
  })
})

export {}
