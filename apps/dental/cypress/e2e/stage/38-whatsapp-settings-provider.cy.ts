type QaClinic = {
  id?: string
  key: string
  name: string
}

type NotificationSettings = Record<string, any>

function selectQaClinicA(): Cypress.Chainable<QaClinic> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
    const clinic = dataset.clinics.find((row: QaClinic) => row.key === 'clinicA')
    expect(clinic, 'clinic A definition').to.exist

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const stageClinic = (clinicsResponse.body.data || []).find((row: QaClinic) => row.name === clinic.name)
      expect(stageClinic, 'clinic A in stage').to.exist

      return cy.request('POST', '/api/clinics', { clinicId: stageClinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)
        return { ...clinic, id: stageClinic.id }
      })
    })
  })
}

function phoneFromStamp(stamp: string) {
  const digits = stamp.replace(/\D/g, '').slice(-8).padStart(8, '0')
  return `+155${digits}`
}

function enabledWhatsAppSettings(base: NotificationSettings): NotificationSettings {
  return {
    email_enabled: base.email_enabled ?? true,
    confirmation_enabled: base.confirmation_enabled ?? true,
    reminder_enabled: base.reminder_enabled ?? true,
    reminder_hours_before: base.reminder_hours_before ?? 24,
    sender_name: base.sender_name ?? 'Laralis QA',
    reply_to_email: base.reply_to_email ?? null,
    sms: base.sms || { enabled: false },
    whatsapp: {
      enabled: true,
      provider: '360dialog',
      default_country_code: '1',
      send_confirmations: true,
      send_reminders: true,
      reminder_hours_before: 24,
      dialog360_api_key: 'qa-mock-only',
      twilio_account_sid: '',
      twilio_auth_token: '',
      twilio_phone_number: '',
    },
  }
}

describe('Stage WhatsApp settings provider test', () => {
  let previousSettings: NotificationSettings | null = null
  const cleanupProviderMessageIds: string[] = []

  afterEach(() => {
    if (previousSettings) {
      cy.request({
        method: 'PUT',
        url: '/api/settings/notifications',
        body: previousSettings,
        failOnStatusCode: false,
      })
      previousSettings = null
    }

    if (cleanupProviderMessageIds.length > 0) {
      cy.task('qaWhatsAppNotificationCleanup', {
        providerMessageIds: [...cleanupProviderMessageIds],
      }).then((result: any) => {
        expect(result.cleaned, 'WhatsApp test notification cleanup').to.eq(true)
      })
      cleanupProviderMessageIds.length = 0
    }
  })

  it('tests the saved WhatsApp provider config and persists success/failure delivery rows', () => {
    const stamp = `qa-whatsapp-settings-${Date.now()}-${Cypress._.random(1000, 9999)}`
    const phone = phoneFromStamp(stamp)

    cy.loginAsDoctor()
    selectQaClinicA()

    cy.request('/api/settings/notifications').then((settingsResponse) => {
      expect(settingsResponse.status).to.eq(200)
      previousSettings = settingsResponse.body.data

      cy.request({
        method: 'PUT',
        url: '/api/settings/notifications',
        body: enabledWhatsAppSettings(previousSettings || {}),
      }).then((saveResponse) => {
        expect(saveResponse.status).to.eq(200)
      })
    })

    cy.visit('/settings/notifications')
    cy.location('pathname', { timeout: 30000 }).should('eq', '/settings/notifications')
    cy.get('[data-testid="whatsapp-readiness-card"]', { timeout: 30000 }).should('be.visible')
    cy.get('[data-testid="whatsapp-readiness-check-external_provider_setup"]')
      .should('be.visible')
      .invoke('text')
      .should('match', /Manual/i)
    cy.get('[data-testid="whatsapp-webhook-url"]')
      .should('be.visible')
      .invoke('val')
      .should('include', '/api/whatsapp/webhook?clinicId=')
    cy.get('[data-testid="test-whatsapp-card"]', { timeout: 30000 }).should('be.visible')
    cy.get('[data-testid="test-whatsapp-phone"]').clear().type(phone)

    cy.request('/api/settings/notifications/whatsapp-readiness').then((readinessResponse) => {
      expect(readinessResponse.status).to.eq(200)
      expect(readinessResponse.body.provider).to.eq('360dialog')
      expect(readinessResponse.body.externalVerificationRequired).to.eq(true)
      expect(readinessResponse.body.webhookUrl).to.include('/api/whatsapp/webhook?clinicId=')
      const checks = readinessResponse.body.checks || []
      const credentials = checks.find((check: any) => check.id === 'provider_credentials')
      const externalProvider = checks.find((check: any) => check.id === 'external_provider_setup')
      expect(credentials.status).to.eq('pass')
      expect(externalProvider.status).to.eq('manual')
    })

    cy.intercept('POST', '/api/settings/notifications/test-whatsapp', (request) => {
      expect(request.body.phone).to.eq(phone)
      request.reply({
        statusCode: 200,
        body: { success: true, messageId: `ui-mock-${stamp}`, provider: '360dialog', status: 'sent' },
      })
    }).as('uiWhatsAppTest')

    cy.get('[data-testid="send-test-whatsapp"]').should('not.be.disabled').click()
    cy.wait('@uiWhatsAppTest')

    cy.request({
      method: 'POST',
      url: '/api/settings/notifications/test-whatsapp',
      headers: {
        'x-laralis-qa-whatsapp-test': 'mock',
      },
      body: { phone },
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body.success).to.eq(true)
      expect(response.body.provider).to.eq('360dialog')
      expect(response.body.messageId).to.match(/^qa-whatsapp-test-/)
      cleanupProviderMessageIds.push(response.body.messageId)

      cy.task('qaWhatsAppStatusState', { providerMessageId: response.body.messageId }).then((state: any) => {
        expect(state.notification, 'settings test WhatsApp notification row').to.exist
        expect(state.notification.notification_type).to.eq('custom')
        expect(state.notification.recipient_phone).to.eq(phone)
        expect(state.notification.provider).to.eq('360dialog')
        expect(state.notification.status).to.eq('sent')
        expect(state.notification.provider_status).to.eq('sent')
        expect(state.notification.metadata.source).to.eq('settings_test')
        expect(state.notification.metadata.qa).to.eq(true)
      })
    })

    cy.request({
      method: 'POST',
      url: '/api/settings/notifications/test-whatsapp',
      headers: {
        'x-laralis-qa-whatsapp-test': 'fail',
      },
      body: { phone },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(500)
      expect(response.body.error).to.match(/forced WhatsApp test failure/i)
      expect(response.body.messageId).to.match(/^qa-whatsapp-test-failed-/)
      cleanupProviderMessageIds.push(response.body.messageId)

      cy.task('qaWhatsAppStatusState', { providerMessageId: response.body.messageId }).then((state: any) => {
        expect(state.notification, 'failed settings test WhatsApp notification row').to.exist
        expect(state.notification.status).to.eq('failed')
        expect(state.notification.provider_status).to.eq('failed')
        expect(state.notification.error_message).to.match(/forced WhatsApp test failure/i)
        expect(state.notification.metadata.source).to.eq('settings_test')
      })
    })
  })
})

export {}
