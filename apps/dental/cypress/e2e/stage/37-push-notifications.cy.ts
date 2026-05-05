export {}

type QaClinic = {
  id?: string
  key: string
  name: string
}

type QaService = {
  id: string
  name: string
  est_minutes?: number
  variable_cost_cents?: number
}

type PushMockPermission = 'default' | 'denied' | 'granted'

type PushMockOptions = {
  permission: PushMockPermission
  requestPermissionResult?: PushMockPermission
  existingSubscription?: boolean
  endpoint: string
}

type PushQaState = {
  permission: PushMockPermission
  subscribeCalls: Array<{
    userVisibleOnly: boolean
    applicationServerKeyBytes: number
  }>
  unsubscribeCalls: number
}

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

function findQaService(serviceKey = 'limpieza'): Cypress.Chainable<QaService> {
  return cy.readFile('../../docs/qa/dataset.json').then((dataset) => {
    const service = dataset.services.find((row: any) => row.key === serviceKey)
    expect(service, `QA service ${serviceKey}`).to.exist

    return cy.request('/api/services').then((servicesResponse) => {
      expect(servicesResponse.status).to.eq(200)
      const stageService = (servicesResponse.body || []).find((row: QaService) => row.name === service.name)
      expect(stageService, `${service.name} service in stage`).to.exist
      return stageService
    })
  })
}

function uniqueEndpoint(label: string) {
  return `https://push.qa.laralis.test/${label}-${Date.now()}-${Cypress._.random(1000, 9999)}`
}

function subscriptionBody(endpoint: string, suffix = 'initial') {
  return {
    endpoint,
    expirationTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
    keys: {
      p256dh: `qa-p256dh-${suffix}`,
      auth: `qa-auth-${suffix}`,
    },
  }
}

function bytesBuffer(values: number[]) {
  return new Uint8Array(values).buffer
}

function installPushMocks(win: Window, options: PushMockOptions) {
  let permission = options.permission
  let subscription: any = options.existingSubscription ? createSubscription(options.endpoint) : null
  const state: PushQaState = {
    permission,
    subscribeCalls: [],
    unsubscribeCalls: 0,
  }

  function createSubscription(endpoint: string) {
    return {
      endpoint,
      expirationTime: Date.now() + 24 * 60 * 60 * 1000,
      getKey(keyName: 'p256dh' | 'auth') {
        return keyName === 'p256dh'
          ? bytesBuffer([1, 2, 3, 4, 5, 6])
          : bytesBuffer([7, 8, 9, 10])
      },
      unsubscribe() {
        state.unsubscribeCalls += 1
        subscription = null
        return Promise.resolve(true)
      },
    }
  }

  const registration = {
    pushManager: {
      getSubscription() {
        return Promise.resolve(subscription)
      },
      subscribe(subscribeOptions: PushSubscriptionOptionsInit) {
        const applicationServerKey = subscribeOptions.applicationServerKey as Uint8Array | null | undefined
        state.subscribeCalls.push({
          userVisibleOnly: Boolean(subscribeOptions.userVisibleOnly),
          applicationServerKeyBytes: applicationServerKey?.byteLength || 0,
        })
        subscription = createSubscription(options.endpoint)
        return Promise.resolve(subscription)
      },
    },
  }

  const serviceWorker = {
    ready: Promise.resolve(registration),
    getRegistration() {
      return Promise.resolve(registration)
    },
    register() {
      return Promise.resolve(registration)
    },
  }

  const notification = {
    get permission() {
      return permission
    },
    requestPermission() {
      permission = options.requestPermissionResult || 'granted'
      state.permission = permission
      return Promise.resolve(permission)
    },
  }

  Object.defineProperty(win.navigator, 'serviceWorker', {
    configurable: true,
    value: serviceWorker,
  })
  Object.defineProperty(win, 'PushManager', {
    configurable: true,
    value: function PushManager() {},
  })
  Object.defineProperty(win, 'Notification', {
    configurable: true,
    value: notification,
  })
  ;(win as any).__laralisPushQa = state
}

function visitNotificationsWithPush(options: PushMockOptions) {
  cy.visit('/settings/notifications', {
    onBeforeLoad(win) {
      installPushMocks(win, options)
    },
  })
  cy.location('pathname', { timeout: 30000 }).should('eq', '/settings/notifications')
  cy.get('[data-testid="push-notifications-card"]', { timeout: 30000 }).should('be.visible')
}

describe('Stage push notification contracts', () => {
  const cleanupEndpoints: string[] = []
  const cleanupSupplyIds: string[] = []
  const cleanupTreatmentIds: string[] = []
  const cleanupPatientIds: string[] = []

  afterEach(() => {
    for (const treatmentId of cleanupTreatmentIds) {
      cy.request({
        method: 'DELETE',
        url: `/api/treatments/${treatmentId}`,
        failOnStatusCode: false,
      })
    }
    cleanupTreatmentIds.length = 0

    for (const patientId of cleanupPatientIds) {
      cy.request({
        method: 'DELETE',
        url: `/api/patients/${patientId}`,
        failOnStatusCode: false,
      })
    }
    cleanupPatientIds.length = 0

    for (const supplyId of cleanupSupplyIds) {
      cy.request({
        method: 'DELETE',
        url: `/api/supplies/${supplyId}`,
        failOnStatusCode: false,
      })
    }
    cleanupSupplyIds.length = 0

    for (const endpoint of cleanupEndpoints) {
      cy.task('qaPushCleanup', { endpoint }).then((result: any) => {
        expect(result.cleaned, `push cleanup ${endpoint}`).to.eq(true)
      })
    }
    cleanupEndpoints.length = 0
  })

  it('protects subscription APIs and validates click tracking input', () => {
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.request({
      method: 'POST',
      url: '/api/notifications/push/subscribe',
      body: subscriptionBody(uniqueEndpoint('unauth')),
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(401)
    })

    cy.request({
      method: 'POST',
      url: '/api/notifications/push/unsubscribe',
      body: { endpoint: uniqueEndpoint('unauth-unsub') },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(401)
    })

    cy.request({
      method: 'POST',
      url: '/api/notifications/push/track-click',
      body: { notificationId: 'not-a-uuid' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400)
    })
  })

  it('creates, updates, deactivates and tracks push records in Supabase stage', () => {
    const endpoint = uniqueEndpoint('api-lifecycle')
    cleanupEndpoints.push(endpoint)

    cy.loginAsDoctor()
    selectQaClinicA().then((clinic) => {
      cy.request({
        method: 'POST',
        url: '/api/notifications/push/subscribe',
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome Laralis QA',
        },
        body: subscriptionBody(endpoint, 'initial'),
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.eq(true)
        expect(response.body.message).to.eq('Subscription created')
        expect(response.body.id).to.match(/[0-9a-f-]{36}/)
      })

      cy.task('qaPushSubscriptionState', { endpoint }).then((result: any) => {
        expect(result.subscription, 'created subscription').to.exist
        expect(result.subscription.clinic_id).to.eq(clinic.id)
        expect(result.subscription.endpoint).to.eq(endpoint)
        expect(result.subscription.keys_p256dh).to.eq('qa-p256dh-initial')
        expect(result.subscription.keys_auth).to.eq('qa-auth-initial')
        expect(result.subscription.device_name).to.eq('Chrome')
        expect(result.subscription.is_active).to.eq(true)
      })

      cy.request({
        method: 'POST',
        url: '/api/notifications/push/subscribe',
        headers: {
          'user-agent': 'Mozilla/5.0 Firefox Laralis QA',
        },
        body: subscriptionBody(endpoint, 'updated'),
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.eq(true)
        expect(response.body.message).to.eq('Subscription updated')
      })

      cy.task('qaPushSubscriptionState', { endpoint }).then((result: any) => {
        expect(result.subscription.keys_p256dh).to.eq('qa-p256dh-updated')
        expect(result.subscription.keys_auth).to.eq('qa-auth-updated')
        expect(result.subscription.device_name).to.eq('Firefox')
        expect(result.subscription.expiration_time).to.be.a('string')
        expect(result.subscription.is_active).to.eq(true)
      })

      cy.task('qaPushNotificationSeed', {
        endpoint,
        title: 'QA Push Click',
        body: 'Click tracking contract',
      }).then((seedResult: any) => {
        expect(seedResult.notification.status).to.eq('sent')

        cy.request({
          method: 'POST',
          url: '/api/notifications/push/track-click',
          body: { notificationId: seedResult.notification.id },
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.success).to.eq(true)
        })

        cy.task('qaPushNotificationState', { notificationId: seedResult.notification.id }).then((state: any) => {
          expect(state.notification.status).to.eq('clicked')
          expect(state.notification.clicked_at).to.be.a('string')
        })
      })

      cy.request({
        method: 'POST',
        url: '/api/notifications/push/unsubscribe',
        body: { endpoint },
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.success).to.eq(true)
      })

      cy.task('qaPushSubscriptionState', { endpoint }).then((result: any) => {
        expect(result.subscription.is_active).to.eq(false)
      })
    })
  })

  it('lets a granted browser subscribe when permission exists but no subscription exists', () => {
    const endpoint = uniqueEndpoint('browser-granted')

    cy.loginAsDoctor()
    selectQaClinicA()

    cy.intercept('POST', '/api/notifications/push/subscribe', (request) => {
      expect(request.body.endpoint).to.eq(endpoint)
      expect(request.body.keys.p256dh).to.be.a('string').and.not.eq('')
      expect(request.body.keys.auth).to.be.a('string').and.not.eq('')
      request.reply({ success: true, message: 'Subscription created', id: Cypress._.uniqueId('push_') })
    }).as('pushSubscribe')

    visitNotificationsWithPush({
      permission: 'granted',
      existingSubscription: false,
      endpoint,
    })

    cy.get('[data-testid="push-notifications-enable"]').should('be.visible')
    cy.get('[data-testid="push-notifications-enabled"]').should('not.exist')
    cy.contains('button', /activar notificaciones push|enable push notifications/i).click()
    cy.wait('@pushSubscribe')

    cy.window().then((win) => {
      const state = (win as any).__laralisPushQa as PushQaState
      expect(state.subscribeCalls, 'browser subscribe calls').to.have.length(1)
      expect(state.subscribeCalls[0].userVisibleOnly).to.eq(true)
      expect(state.subscribeCalls[0].applicationServerKeyBytes).to.be.greaterThan(0)
    })
    cy.get('[data-testid="push-notifications-enabled"]', { timeout: 30000 }).should('be.visible')
  })

  it('does not call the subscribe API when browser permission is denied', () => {
    const endpoint = uniqueEndpoint('browser-denied')

    cy.loginAsDoctor()
    selectQaClinicA()

    cy.intercept('POST', '/api/notifications/push/subscribe').as('pushSubscribe')

    visitNotificationsWithPush({
      permission: 'default',
      requestPermissionResult: 'denied',
      existingSubscription: false,
      endpoint,
    })

    cy.get('[data-testid="push-notifications-enable"]').should('be.visible')
    cy.contains('button', /activar notificaciones push|enable push notifications/i).click()
    cy.wait(500)

    cy.window().then((win) => {
      const state = (win as any).__laralisPushQa as PushQaState
      expect(state.permission).to.eq('denied')
      expect(state.subscribeCalls, 'browser subscribe calls').to.have.length(0)
    })
    cy.get('@pushSubscribe.all').should('have.length', 0)
    cy.get('[data-testid="push-notifications-enable"]').should('be.visible')
  })

  it('shows an enabled state for an existing subscription and can unsubscribe it', () => {
    const endpoint = uniqueEndpoint('browser-existing')

    cy.loginAsDoctor()
    selectQaClinicA()

    cy.intercept('POST', '/api/notifications/push/unsubscribe', (request) => {
      expect(request.body.endpoint).to.eq(endpoint)
      request.reply({ success: true, message: 'Subscription removed' })
    }).as('pushUnsubscribe')

    visitNotificationsWithPush({
      permission: 'granted',
      existingSubscription: true,
      endpoint,
    })

    cy.get('[data-testid="push-notifications-enabled"]', { timeout: 30000 }).should('be.visible')
    cy.get('[data-testid="push-notifications-disable"]').click()
    cy.wait('@pushUnsubscribe')

    cy.window().then((win) => {
      const state = (win as any).__laralisPushQa as PushQaState
      expect(state.unsubscribeCalls).to.eq(1)
    })
    cy.get('[data-testid="push-notifications-enable"]', { timeout: 30000 }).should('be.visible')
  })

  it('records a low stock push log from the real supplies API event', () => {
    const endpoint = uniqueEndpoint('low-stock-event')
    const supplyName = `QA Push Low Stock ${Date.now()}-${Cypress._.random(1000, 9999)}`
    cleanupEndpoints.push(endpoint)

    cy.loginAsDoctor()
    selectQaClinicA().then((clinic) => {
      cy.request({
        method: 'POST',
        url: '/api/notifications/push/subscribe',
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome Laralis QA',
        },
        body: subscriptionBody(endpoint, 'low-stock'),
      }).then((response) => {
        expect(response.status).to.eq(200)
      })

      cy.request({
        method: 'POST',
        url: '/api/supplies',
        headers: {
          'x-laralis-qa-notifications': 'mock',
        },
        body: {
          clinic_id: clinic.id,
          name: supplyName,
          category: 'QA',
          presentation: 'Unidad',
          price_cents: 5000,
          portions: 10,
          stock_quantity: 1,
          min_stock_alert: 2,
        },
      }).then((response) => {
        expect(response.status).to.eq(201)
        expect(response.body.data.name).to.eq(supplyName)
        cleanupSupplyIds.push(response.body.data.id)
        cy.task('qaPushNotificationsForEndpoint', {
          endpoint,
          notificationType: 'low_stock_alert',
        }).then((state: any) => {
          expect(state.notifications, 'low stock push logs').to.have.length(1)
          const notification = state.notifications[0]
          expect(notification.status).to.eq('sent')
          expect(notification.title).to.match(/inventario bajo/i)
          expect(notification.body).to.include(supplyName)
          expect(notification.action_url).to.eq('/supplies')
        })
      })
    })
  })

  it('records a treatment-created push log from the real treatments API event', () => {
    const endpoint = uniqueEndpoint('treatment-created-event')
    const stamp = `qa-push-treatment-${Date.now()}-${Cypress._.random(1000, 9999)}`
    cleanupEndpoints.push(endpoint)

    cy.loginAsDoctor()
    selectQaClinicA().then((clinic) => {
      cy.request({
        method: 'POST',
        url: '/api/notifications/push/subscribe',
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome Laralis QA',
        },
        body: subscriptionBody(endpoint, 'treatment-created'),
      }).then((response) => {
        expect(response.status).to.eq(200)
      })

      findQaService().then((service) => {
        cy.request({
          method: 'POST',
          url: '/api/patients',
          body: {
            clinic_id: clinic.id,
            first_name: 'QA Push',
            last_name: stamp,
            email: `${stamp}@laralis.test`,
            first_visit_date: '2026-05-04',
            acquisition_date: '2026-05-04',
            notes: stamp,
          },
        }).then((patientResponse) => {
          expect(patientResponse.status).to.eq(200)
          const patient = patientResponse.body.data
          cleanupPatientIds.push(patient.id)

          cy.request({
            method: 'POST',
            url: '/api/treatments',
            headers: {
              'x-laralis-qa-notifications': 'mock',
            },
            body: {
              clinic_id: clinic.id,
              patient_id: patient.id,
              service_id: service.id,
              treatment_date: '2026-05-04',
              duration_minutes: service.est_minutes || 45,
              price_cents: 150000,
              amount_paid_cents: 150000,
              pending_balance_cents: 0,
              variable_cost_cents: service.variable_cost_cents || 2500,
              margin_pct: 55,
              status: 'completed',
              notes: stamp,
            },
          }).then((treatmentResponse) => {
            expect(treatmentResponse.status).to.eq(200)
            expect(treatmentResponse.body.pushSummary.sent).to.be.greaterThan(0)
            cleanupTreatmentIds.push(treatmentResponse.body.data.id)
            cy.task('qaPushNotificationsForEndpoint', {
              endpoint,
              notificationType: 'treatment_created',
            }).then((state: any) => {
              expect(state.notifications, 'treatment-created push logs').to.have.length(1)
              const notification = state.notifications[0]
              expect(notification.status).to.eq('sent')
              expect(notification.title).to.match(/nuevo tratamiento/i)
              expect(notification.body).to.include(stamp)
              expect(notification.action_url).to.eq('/treatments')
            })
          })
        })
      })
    })
  })
})
