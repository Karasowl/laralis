import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isConfirmationEnabled, isEmailEnabled, isReminderEnabled } from '@/lib/email/service'
import { formatPhoneNumber, getSMSConfigFromSettings, isEventEnabled } from '@/lib/sms/service'
import { TwilioWhatsAppProvider } from '@/lib/whatsapp/providers/twilio'
import { Dialog360WhatsAppProvider } from '@/lib/whatsapp/providers/dialog360'
import { interpolateTemplate } from '@/lib/whatsapp/service'
import type { WhatsAppConfig } from '@/lib/whatsapp/types'
import {
  buildWebPushPayload,
  buildWebPushSubscription,
  classifyWebPushError,
  getVapidConfig,
  isPushDeliveryConfigured,
  normalizeVapidSubject,
  PushNotificationService,
  type PushNotificationStore,
  type PushSubscriptionRow,
  type WebPushAdapter,
} from '@/lib/push/service'

const twilioConfig: WhatsAppConfig = {
  enabled: true,
  provider: 'twilio',
  default_country_code: '1',
  send_confirmations: true,
  send_reminders: true,
  reminder_hours_before: 24,
  twilio_account_sid: 'ACqa123',
  twilio_auth_token: 'qa-token',
  twilio_phone_number: '+15550000000',
}

const dialog360Config: WhatsAppConfig = {
  enabled: true,
  provider: '360dialog',
  default_country_code: '1',
  send_confirmations: true,
  send_reminders: true,
  reminder_hours_before: 24,
  dialog360_api_key: 'd360-qa-key',
}

const pushSubscription: PushSubscriptionRow = {
  id: 'push-subscription-1',
  clinic_id: 'clinic-qa',
  user_id: 'user-qa',
  endpoint: 'https://push.service.test/subscription-1',
  keys_p256dh: 'p256dh-qa-key',
  keys_auth: 'auth-qa-key',
}

function createPushStoreMock(subscriptions: PushSubscriptionRow[] = [pushSubscription]) {
  const listActiveSubscriptionsForUser = vi.fn().mockResolvedValue(subscriptions)
  const listActiveSubscriptionsForClinic = vi.fn().mockResolvedValue(subscriptions)
  const createNotificationLog = vi.fn().mockResolvedValue('push-notification-1')
  const markNotificationSent = vi.fn().mockResolvedValue(undefined)
  const markNotificationFailed = vi.fn().mockResolvedValue(undefined)
  const deactivateSubscription = vi.fn().mockResolvedValue(undefined)
  const store: PushNotificationStore = {
    listActiveSubscriptionsForUser,
    listActiveSubscriptionsForClinic,
    createNotificationLog,
    markNotificationSent,
    markNotificationFailed,
    deactivateSubscription,
  }

  return {
    store,
    listActiveSubscriptionsForUser,
    listActiveSubscriptionsForClinic,
    createNotificationLog,
    markNotificationSent,
    markNotificationFailed,
    deactivateSubscription,
  }
}

function createWebPushAdapterMock() {
  const setVapidDetails = vi.fn()
  const sendNotification = vi.fn().mockResolvedValue({ ok: true })
  const adapter: WebPushAdapter = {
    setVapidDetails,
    sendNotification,
  }

  return {
    adapter,
    setVapidDetails,
    sendNotification,
  }
}

function mockJsonFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Notification provider contracts', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('keeps Web Push VAPID configuration explicit and server-only', () => {
    expect(
      getVapidConfig({
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'public-from-client-env',
        VAPID_PRIVATE_KEY: 'private-server-key',
        EMAIL_FROM: 'ops@laralis.test',
      } as unknown as NodeJS.ProcessEnv)
    ).toEqual({
      publicKey: 'public-from-client-env',
      privateKey: 'private-server-key',
      subject: 'mailto:ops@laralis.test',
      configured: true,
    })

    expect(
      isPushDeliveryConfigured({
        VAPID_PUBLIC_KEY: 'public-key-only',
      } as unknown as NodeJS.ProcessEnv)
    ).toBe(false)
    expect(normalizeVapidSubject('https://laralis.test/push')).toBe('https://laralis.test/push')
    expect(normalizeVapidSubject('invalid-subject')).toBe('mailto:admin@laralis.com')
  })

  it('builds the Web Push subscription and service-worker payload contract', () => {
    const payload = buildWebPushPayload(
      {
        title: 'Cita confirmada',
        body: 'Paciente QA a las 9:00 AM',
        icon: '/icons/icon-192x192.png',
        url: '/treatments/calendar',
        tag: 'appointment-reminder',
        requireInteraction: true,
        actions: [{ action: 'open', title: 'Abrir' }],
      },
      'push-notification-1'
    )

    expect(buildWebPushSubscription(pushSubscription)).toEqual({
      endpoint: 'https://push.service.test/subscription-1',
      keys: {
        p256dh: 'p256dh-qa-key',
        auth: 'auth-qa-key',
      },
    })

    expect(JSON.parse(payload)).toEqual({
      title: 'Cita confirmada',
      body: 'Paciente QA a las 9:00 AM',
      icon: '/icons/icon-192x192.png',
      url: '/treatments/calendar',
      tag: 'appointment-reminder',
      requireInteraction: true,
      actions: [{ action: 'open', title: 'Abrir' }],
      notificationId: 'push-notification-1',
    })
  })

  it('sends Web Push notifications and marks the delivery log as sent', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', 'server-public-key')
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'server-private-key')
    vi.stubEnv('VAPID_SUBJECT', 'push@laralis.test')
    const storeMock = createPushStoreMock()
    const adapterMock = createWebPushAdapterMock()
    const service = new PushNotificationService(adapterMock.adapter, storeMock.store)

    const result = await service.sendNotification({
      userId: 'user-qa',
      clinicId: 'clinic-qa',
      notificationType: 'appointment_reminder',
      payload: {
        title: 'Recordatorio de Cita',
        body: 'Paciente QA - Limpieza QA a las 9:00 AM',
        url: '/appointments',
        tag: 'appointment-reminder',
        requireInteraction: true,
      },
    })

    expect(storeMock.listActiveSubscriptionsForUser).toHaveBeenCalledWith('user-qa', 'clinic-qa')
    expect(storeMock.createNotificationLog).toHaveBeenCalledWith({
      clinicId: 'clinic-qa',
      subscriptionId: 'push-subscription-1',
      notificationType: 'appointment_reminder',
      payload: {
        title: 'Recordatorio de Cita',
        body: 'Paciente QA - Limpieza QA a las 9:00 AM',
        url: '/appointments',
        tag: 'appointment-reminder',
        requireInteraction: true,
      },
    })
    expect(adapterMock.setVapidDetails).toHaveBeenCalledWith(
      'mailto:push@laralis.test',
      'server-public-key',
      'server-private-key'
    )

    const [subscription, payload, options] = adapterMock.sendNotification.mock.calls[0]
    expect(subscription).toEqual(buildWebPushSubscription(pushSubscription))
    expect(JSON.parse(String(payload))).toMatchObject({
      title: 'Recordatorio de Cita',
      notificationId: 'push-notification-1',
    })
    expect(options).toEqual({
      TTL: 3600,
      urgency: 'high',
      topic: 'appointment-reminder',
    })
    expect(storeMock.markNotificationSent).toHaveBeenCalledWith('push-notification-1')
    expect(result).toMatchObject({
      attempted: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
    })
  })

  it('marks Web Push delivery as failed when VAPID keys are missing', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', '')
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '')
    vi.stubEnv('VAPID_PRIVATE_KEY', '')
    const storeMock = createPushStoreMock()
    const adapterMock = createWebPushAdapterMock()
    const service = new PushNotificationService(adapterMock.adapter, storeMock.store)

    const result = await service.sendTreatmentCreated('user-qa', 'clinic-qa', {
      patientName: 'Paciente QA',
      serviceName: 'Limpieza QA',
    })

    expect(adapterMock.sendNotification).not.toHaveBeenCalled()
    expect(storeMock.markNotificationFailed).toHaveBeenCalledWith(
      'push-notification-1',
      'Web Push VAPID keys are not configured'
    )
    expect(result).toMatchObject({
      attempted: 1,
      sent: 0,
      failed: 1,
    })
  })

  it('deactivates expired Web Push subscriptions after provider 404 or 410 responses', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', 'server-public-key')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'server-private-key')
    const storeMock = createPushStoreMock()
    const adapterMock = createWebPushAdapterMock()
    adapterMock.sendNotification.mockRejectedValue(
      Object.assign(new Error('Push subscription is gone'), {
        statusCode: 410,
      })
    )
    const service = new PushNotificationService(adapterMock.adapter, storeMock.store)

    const result = await service.sendLowStockAlert('user-qa', 'clinic-qa', 'Anestesia QA', 2)

    expect(classifyWebPushError({ statusCode: 404, body: 'Not found' })).toEqual({
      message: 'Not found',
      statusCode: 404,
      expired: true,
    })
    expect(storeMock.markNotificationFailed).toHaveBeenCalledWith(
      'push-notification-1',
      'Push subscription is gone'
    )
    expect(storeMock.deactivateSubscription).toHaveBeenCalledWith('push-subscription-1')
    expect(result.results[0]).toMatchObject({
      subscriptionId: 'push-subscription-1',
      notificationId: 'push-notification-1',
      status: 'failed',
      error: 'Push subscription is gone',
      deactivated: true,
    })
  })

  it('does not create push logs or call providers when a user has no active subscriptions', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', 'server-public-key')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'server-private-key')
    const storeMock = createPushStoreMock([])
    const adapterMock = createWebPushAdapterMock()
    const service = new PushNotificationService(adapterMock.adapter, storeMock.store)

    const result = await service.sendNotification({
      userId: 'user-qa',
      clinicId: 'clinic-qa',
      notificationType: 'test',
      payload: {
        title: 'Sin suscripciones',
        body: 'No debe llamar proveedor',
      },
    })

    expect(storeMock.createNotificationLog).not.toHaveBeenCalled()
    expect(adapterMock.sendNotification).not.toHaveBeenCalled()
    expect(result).toEqual({
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      results: [],
    })
  })

  it('keeps email notification gates explicit and disabled by default', () => {
    expect(isEmailEnabled(null)).toBe(false)
    expect(isEmailEnabled({ email_enabled: false })).toBe(false)
    expect(isEmailEnabled({ email_enabled: true })).toBe(true)
    expect(isConfirmationEnabled({ email_enabled: true })).toBe(true)
    expect(isConfirmationEnabled({ email_enabled: true, confirmation_enabled: false })).toBe(false)
    expect(isReminderEnabled({ email_enabled: true })).toBe(true)
    expect(isReminderEnabled({ email_enabled: true, reminder_enabled: false })).toBe(false)
  })

  it('deep-merges SMS settings and applies patient/staff event switches', () => {
    const config = getSMSConfigFromSettings({
      sms: {
        enabled: true,
        default_country_code: '1',
        patient: {
          reminder_2h: true,
        },
        staff: {
          enabled: true,
          phone: '+15555550199',
          reminder_24h: false,
        },
      },
    })

    expect(config.enabled).toBe(true)
    expect(config.default_country_code).toBe('1')
    expect(config.patient.on_treatment_created).toBe(true)
    expect(config.patient.reminder_2h).toBe(true)
    expect(config.staff.enabled).toBe(true)
    expect(config.staff.phone).toBe('+15555550199')
    expect(isEventEnabled(config, 'patient', 'reminder_2h')).toBe(true)
    expect(isEventEnabled(config, 'staff', 'reminder_24h')).toBe(false)
  })

  it('formats SMS phones into E.164 for local and already-prefixed numbers', () => {
    expect(formatPhoneNumber('(555) 555-0123', '1')).toBe('+15555550123')
    expect(formatPhoneNumber('+52 55 1234 5678', '52')).toBe('+525512345678')
    expect(formatPhoneNumber('521234567890', '52')).toBe('+521234567890')
  })

  it('builds Twilio WhatsApp requests and maps queued status to pending', async () => {
    const fetchMock = mockJsonFetch({
      sid: 'SMqa123',
      status: 'queued',
    })
    const provider = new TwilioWhatsAppProvider()

    const result = await provider.sendMessage('5555550123', 'QA booking recibido', twilioConfig)

    expect(result).toEqual({
      success: true,
      messageId: 'SMqa123',
      status: 'pending',
      costCents: 1,
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACqa123/Messages.json')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('ACqa123:qa-token').toString('base64')}`)
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')

    const body = new URLSearchParams(String(init.body))
    expect(body.get('To')).toBe('whatsapp:+15555550123')
    expect(body.get('From')).toBe('whatsapp:+15550000000')
    expect(body.get('Body')).toBe('QA booking recibido')
  })

  it('surfaces Twilio WhatsApp provider errors without treating them as sent', async () => {
    mockJsonFetch({ message: 'Invalid To phone number' }, 400)
    const provider = new TwilioWhatsAppProvider()

    const result = await provider.sendMessage('not-a-phone', 'QA booking recibido', twilioConfig)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid To phone number')
  })

  it('parses Twilio WhatsApp delivery callbacks into internal statuses', () => {
    const provider = new TwilioWhatsAppProvider()

    expect(
      provider.parseStatusWebhook({
        MessageSid: 'SMdelivered',
        MessageStatus: 'delivered',
        Timestamp: '2026-05-05T12:00:00.000Z',
      })
    ).toEqual({
      messageId: 'SMdelivered',
      status: 'delivered',
      timestamp: '2026-05-05T12:00:00.000Z',
      errorMessage: undefined,
    })

    expect(
      provider.parseStatusWebhook({
        MessageSid: 'SMblocked',
        MessageStatus: 'undelivered',
        ErrorMessage: 'Carrier blocked message',
      })
    ).toMatchObject({
      messageId: 'SMblocked',
      status: 'undelivered',
      errorMessage: 'Carrier blocked message',
    })
    expect(provider.parseStatusWebhook({ MessageSid: 'SMmissing-status' })).toBeNull()
  })

  it('builds 360dialog text-message requests and extracts message ids', async () => {
    const fetchMock = mockJsonFetch({
      messages: [{ id: 'wamid.qa.123' }],
    })
    const provider = new Dialog360WhatsAppProvider()

    const result = await provider.sendMessage('5555550123', 'QA booking recibido', dialog360Config)

    expect(result).toEqual({
      success: true,
      messageId: 'wamid.qa.123',
      status: 'sent',
      costCents: 0,
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://waba.360dialog.io/v1/messages')
    expect(init.method).toBe('POST')
    expect(init.headers['D360-API-KEY']).toBe('d360-qa-key')

    const body = JSON.parse(String(init.body))
    expect(body).toEqual({
      to: '15555550123',
      type: 'text',
      text: {
        body: 'QA booking recibido',
      },
    })
  })

  it('parses 360dialog status callbacks and provider error payloads', async () => {
    const provider = new Dialog360WhatsAppProvider()
    const parsed = provider.parseStatusWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: 'wamid.qa.seen',
                    status: 'seen',
                    timestamp: '1777934400',
                    errors: [{ message: 'Read receipt warning' }],
                  },
                ],
              },
            },
          ],
        },
      ],
    })

    expect(parsed).toEqual({
      messageId: 'wamid.qa.seen',
      status: 'read',
      timestamp: '2026-05-04T22:40:00.000Z',
      errorMessage: 'Read receipt warning',
    })
    expect(provider.parseStatusWebhook({ entry: [] })).toBeNull()

    mockJsonFetch({ error: { message: '360dialog template rejected' } }, 422)
    const result = await provider.sendMessage('5555550123', 'QA booking recibido', dialog360Config)
    expect(result.success).toBe(false)
    expect(result.error).toBe('360dialog template rejected')
  })

  it('keeps WhatsApp template interpolation deterministic for booking notifications', () => {
    const content = 'Hola {{patient_name}}, {{clinic_name}} recibio tu solicitud para {{date}} a las {{time}}.'

    expect(
      interpolateTemplate(content, {
        patient_name: 'QA Patient',
        clinic_name: 'QA Dental',
        date: '5 mayo 2026',
        time: '9:00 AM',
      })
    ).toBe('Hola QA Patient, QA Dental recibio tu solicitud para 5 mayo 2026 a las 9:00 AM.')
  })
})
