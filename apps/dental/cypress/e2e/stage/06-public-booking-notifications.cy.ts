type BookingContext = {
  clinicId: string
  clinicSlug: string
  clinicName: string
  serviceId: string
  serviceName: string
}

type BookingSlot = {
  date: string
  time: string
}

function rowsFromBody(body: any) {
  return Array.isArray(body) ? body : (body.data || [])
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeTime(value: string) {
  return value.slice(0, 5)
}

function candidateDates() {
  const today = new Date()
  const dates: string[] = []

  for (let offset = 3; offset <= 30; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
    if (date.getDay() === 0) continue
    dates.push(formatDate(date))
  }

  return dates
}

function bookingConfig() {
  return {
    enabled: true,
    allow_new_patients: true,
    require_phone: true,
    require_notes: false,
    max_advance_days: 60,
    min_advance_hours: 2,
    slot_duration_minutes: 30,
    buffer_minutes: 0,
    working_hours: {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      saturday: { start: '09:00', end: '13:00' },
      sunday: null,
    },
    welcome_message: 'Agenda QA publica de Laralis',
    confirmation_message: 'Solicitud recibida por QA',
  }
}

function enabledNotificationSettings() {
  return {
    email_enabled: true,
    confirmation_enabled: true,
    reminder_enabled: false,
    reminder_hours_before: 24,
    sender_name: 'Laralis QA',
    reply_to_email: null,
    sms: {
      enabled: true,
      default_country_code: '1',
      provider: 'twilio',
      twilio_account_sid: 'qa-mock-only',
      twilio_auth_token: 'qa-mock-only',
      twilio_phone_number: '+15555550000',
      patient: {
        on_treatment_created: true,
        on_treatment_updated: true,
        reminder_24h: false,
        reminder_2h: false,
      },
      staff: {
        enabled: false,
        phone: '',
        extra_phone: '',
        on_treatment_created: false,
        on_treatment_updated: false,
        reminder_24h: false,
        reminder_2h: false,
      },
    },
    whatsapp: {
      enabled: true,
      provider: 'twilio',
      default_country_code: '1',
      send_confirmations: true,
      send_reminders: false,
      reminder_hours_before: 24,
      twilio_account_sid: 'qa-mock-only',
      twilio_auth_token: 'qa-mock-only',
      twilio_phone_number: 'whatsapp:+15555550000',
    },
  }
}

function disabledNotificationSettings() {
  const settings = enabledNotificationSettings()
  return {
    ...settings,
    email_enabled: false,
    confirmation_enabled: false,
    sms: {
      ...settings.sms,
      enabled: false,
    },
    whatsapp: {
      ...settings.whatsapp,
      enabled: false,
    },
  }
}

function configurePublicBooking(): Cypress.Chainable<BookingContext> {
  cy.loginAsDoctor()

  return cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
    const clinicA = dataset.clinics.find((clinic: any) => clinic.key === 'clinicA')
    const serviceDef = dataset.services.find((service: any) => service.key === 'limpieza')

    expect(clinicA, 'QA clinic A definition').to.exist
    expect(serviceDef, 'QA limpieza service definition').to.exist

    return cy.request('/api/clinics').then((clinicsResponse) => {
      expect(clinicsResponse.status).to.eq(200)
      const clinic = rowsFromBody(clinicsResponse.body).find((row: any) => row.name === clinicA.name)
      expect(clinic, 'QA clinic A in stage').to.exist

      return cy.request('POST', '/api/clinics', { clinicId: clinic.id }).then((selectResponse) => {
        expect(selectResponse.status).to.eq(200)

        return cy.request('/api/services').then((servicesResponse) => {
          expect(servicesResponse.status).to.eq(200)
          const service = rowsFromBody(servicesResponse.body).find((row: any) => row.name === serviceDef.name)
          expect(service, 'QA public booking service').to.exist

          return cy
            .request('PUT', '/api/settings/booking', {
              slug: clinicA.slug,
              booking_config: bookingConfig(),
              service_ids: [service.id],
            })
            .then((bookingResponse) => {
              expect(bookingResponse.status).to.eq(200)

              return cy
                .request('PUT', '/api/settings/notifications', enabledNotificationSettings())
                .then((notificationResponse) => {
                  expect(notificationResponse.status).to.eq(200)

                  return {
                    clinicId: clinic.id,
                    clinicSlug: clinicA.slug,
                    clinicName: clinicA.name,
                    serviceId: service.id,
                    serviceName: serviceDef.name,
                  }
                })
            })
        })
      })
    })
  })
}

function restoreNotificationSettings() {
  cy.loginAsDoctor()
  cy.request({
    method: 'PUT',
    url: '/api/settings/notifications',
    body: disabledNotificationSettings(),
    failOnStatusCode: false,
  })
}

function findAvailableSlot(ctx: BookingContext): Cypress.Chainable<BookingSlot> {
  const dates = candidateDates()
  let found: BookingSlot | undefined

  return cy.wrap(dates).each((rawDate: any) => {
    const date = String(rawDate)
    if (found) return false

    return cy
      .request(`/api/public/availability?clinic_id=${ctx.clinicId}&date=${date}&service_id=${ctx.serviceId}`)
      .then((response) => {
        expect(response.status, `availability ${date}`).to.eq(200)
        const slot = (response.body.data?.slots || []).find((row: any) => row.available)

        if (slot) {
          found = { date, time: slot.time }
          return false
        }
      })
  }).then(() => {
    if (!found) {
      throw new Error('No available public booking slot found in the next 30 days')
    }

    return found
  }) as Cypress.Chainable<BookingSlot>
}

function expectMockedChannels(results: any[]) {
  const byChannel = Object.fromEntries(results.map((row) => [row.channel, row]))

  for (const channel of ['email', 'sms', 'whatsapp']) {
    expect(byChannel[channel], `${channel} result`).to.exist
    expect(byChannel[channel].attempted, `${channel} attempted`).to.eq(true)
    expect(byChannel[channel].mocked, `${channel} mocked`).to.eq(true)
    expect(byChannel[channel].success, `${channel} success`).to.eq(true)
  }
}

function monthDiff(from: Date, to: Date) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

describe('Stage public booking and mocked notifications', () => {
  afterEach(() => {
    restoreNotificationSettings()
  })

  it('publishes the QA booking page, reserves a real slot, and mocks email/SMS/WhatsApp', () => {
    configurePublicBooking().then((ctx) => {
      cy.request(`/api/public/clinic/${ctx.clinicSlug}`).then((clinicResponse) => {
        expect(clinicResponse.status).to.eq(200)
        expect(clinicResponse.body.data.name).to.eq(ctx.clinicName)
        expect(clinicResponse.body.data.booking_config.enabled).to.eq(true)
        expect(clinicResponse.body.data.services.map((service: any) => service.id)).to.include(ctx.serviceId)
      })

      findAvailableSlot(ctx).then((slot) => {
        const stamp = `qa-booking-${Date.now()}-${Cypress._.random(1000, 9999)}`

        cy.request({
          method: 'POST',
          url: '/api/public/book',
          headers: {
            'x-laralis-qa-notifications': 'mock',
          },
          body: {
            clinic_id: ctx.clinicId,
            service_id: ctx.serviceId,
            patient_name: `QA Booking ${stamp}`,
            patient_email: `${stamp}@laralis.test`,
            patient_phone: '+15555550123',
            patient_notes: 'Created by public booking QA spec',
            requested_date: slot.date,
            requested_time: slot.time,
            utm_source: 'qa',
            utm_medium: 'cypress',
            utm_campaign: 'meta-mayo',
          },
        }).then((bookResponse) => {
          expect(bookResponse.status).to.eq(201)
          expect(bookResponse.body.data.status).to.eq('pending')
          expect(bookResponse.body.data.requested_date).to.eq(slot.date)
          expect(normalizeTime(bookResponse.body.data.requested_time)).to.eq(normalizeTime(slot.time))
          expect(bookResponse.body.data.service_name).to.eq(ctx.serviceName)
          expectMockedChannels(bookResponse.body.data.notification_results || [])
        })

        cy.request(`/api/public/availability?clinic_id=${ctx.clinicId}&date=${slot.date}&service_id=${ctx.serviceId}`)
          .then((availabilityResponse) => {
            expect(availabilityResponse.status).to.eq(200)
            const reservedSlot = (availabilityResponse.body.data?.slots || [])
              .find((row: any) => normalizeTime(row.time) === normalizeTime(slot.time))
            expect(reservedSlot, 'reserved slot still listed').to.exist
            expect(reservedSlot.available, 'reserved slot should no longer be available').to.eq(false)
          })
      })
    })
  })

  it('completes the public booking UI on desktop, tablet, and mobile without horizontal overflow', () => {
    const viewports = [
      { label: 'desktop', width: 1280, height: 720 },
      { label: 'tablet', width: 768, height: 1024 },
      { label: 'mobile', width: 390, height: 844 },
    ]

    for (const viewport of viewports) {
      cy.viewport(viewport.width, viewport.height)

      configurePublicBooking().then((ctx) => {
        findAvailableSlot(ctx).then((slot) => {
          const stamp = `qa-ui-booking-${viewport.label}-${Date.now()}-${Cypress._.random(1000, 9999)}`
          const targetDate = new Date(`${slot.date}T12:00:00`)
          const todayMonth = new Date()
          const diff = monthDiff(new Date(todayMonth.getFullYear(), todayMonth.getMonth(), 1), new Date(targetDate.getFullYear(), targetDate.getMonth(), 1))

          cy.intercept('POST', '/api/public/book', (request) => {
            request.headers['x-laralis-qa-notifications'] = 'mock'
          }).as(`publicBook${viewport.label}`)

          cy.visit(`/book/${ctx.clinicSlug}`)
          cy.get('[data-testid="public-booking-page"]', { timeout: 30000 }).should('be.visible')
          cy.assertNoHorizontalScroll()
          cy.contains('[data-testid="public-booking-service-card"]', ctx.serviceName, { timeout: 30000 }).click()

          for (let index = 0; index < diff; index += 1) {
            cy.get('[data-testid="public-booking-next-month"]').click()
          }

          cy.get(`[data-testid="public-booking-date"][data-date="${slot.date}"]`, { timeout: 30000 }).click()
          cy.get(`[data-testid="public-booking-time-slot"][data-time="${slot.time}"]`, { timeout: 30000 }).click()

          cy.get('[data-testid="public-booking-name"]').clear().type(`QA UI Booking ${viewport.label}`)
          cy.get('[data-testid="public-booking-email"]').clear().type(`${stamp}@laralis.test`)
          cy.get('[data-testid="public-booking-phone"]').clear().type('+15555550123')
          cy.get('[data-testid="public-booking-notes"]').clear().type('Created by public booking UI QA spec')
          cy.get('[data-testid="public-booking-submit"]').click()

          cy.wait(`@publicBook${viewport.label}`, { timeout: 30000 }).then((interception) => {
            expect(interception.response?.statusCode).to.eq(201)
            expectMockedChannels(interception.response?.body?.data?.notification_results || [])
          })

          cy.get('[data-testid="public-booking-confirmation"]', { timeout: 30000 }).should('be.visible')
          cy.assertNoHorizontalScroll()
        })
      })
    }
  })
})
