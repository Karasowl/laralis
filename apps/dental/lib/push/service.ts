import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  url?: string
  tag?: string
  requireInteraction?: boolean
  actions?: Array<{ action: string; title: string; icon?: string }>
  image?: string
}

export interface SendNotificationOptions {
  userId: string
  clinicId: string
  notificationType: string
  payload: PushNotificationPayload
}

export interface SendClinicNotificationOptions {
  clinicId: string
  notificationType: string
  payload: PushNotificationPayload
}

export interface PushSubscriptionRow {
  id: string
  clinic_id: string
  user_id: string
  endpoint: string
  keys_p256dh: string
  keys_auth: string
}

export interface PushNotificationStore {
  listActiveSubscriptionsForUser(userId: string, clinicId: string): Promise<PushSubscriptionRow[]>
  listActiveSubscriptionsForClinic(clinicId: string): Promise<PushSubscriptionRow[]>
  createNotificationLog(input: {
    clinicId: string
    subscriptionId: string
    notificationType: string
    payload: PushNotificationPayload
  }): Promise<string>
  markNotificationSent(notificationId: string): Promise<void>
  markNotificationFailed(notificationId: string, errorMessage: string): Promise<void>
  deactivateSubscription(subscriptionId: string): Promise<void>
}

export interface WebPushAdapter {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  sendNotification(
    subscription: {
      endpoint: string
      keys: {
        p256dh: string
        auth: string
      }
    },
    payload?: string | Buffer | null,
    options?: {
      TTL?: number
      urgency?: 'very-low' | 'low' | 'normal' | 'high'
      topic?: string
    }
  ): Promise<unknown>
}

export interface PushSendResult {
  subscriptionId: string
  notificationId: string | null
  status: 'sent' | 'failed' | 'skipped'
  error?: string
  deactivated?: boolean
}

export interface PushSendSummary {
  attempted: number
  sent: number
  failed: number
  skipped: number
  results: PushSendResult[]
}

export interface VapidConfig {
  publicKey: string | null
  privateKey: string | null
  subject: string
  configured: boolean
}

export function normalizeVapidSubject(rawSubject?: string | null): string {
  const subject = rawSubject?.trim()

  if (!subject) {
    return 'mailto:admin@laralis.com'
  }

  if (subject.startsWith('mailto:') || subject.startsWith('https://') || subject.startsWith('http://')) {
    return subject
  }

  if (subject.includes('@')) {
    return `mailto:${subject}`
  }

  return 'mailto:admin@laralis.com'
}

export function getVapidConfig(env: NodeJS.ProcessEnv = process.env): VapidConfig {
  const publicKey = env.VAPID_PUBLIC_KEY || env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
  const privateKey = env.VAPID_PRIVATE_KEY || null
  const subject = normalizeVapidSubject(env.VAPID_SUBJECT || env.EMAIL_FROM)

  return {
    publicKey,
    privateKey,
    subject,
    configured: Boolean(publicKey && privateKey),
  }
}

export function isPushDeliveryConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getVapidConfig(env).configured
}

export function buildWebPushSubscription(subscription: PushSubscriptionRow) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys_p256dh,
      auth: subscription.keys_auth,
    },
  }
}

export function buildWebPushPayload(payload: PushNotificationPayload, notificationId: string): string {
  return JSON.stringify({
    ...payload,
    notificationId,
  })
}

export function classifyWebPushError(error: unknown): {
  message: string
  statusCode?: number
  expired: boolean
} {
  const maybeError = error as { message?: string; statusCode?: number; body?: unknown }
  const statusCode = maybeError?.statusCode
  const message =
    maybeError?.message ||
    (typeof maybeError?.body === 'string' ? maybeError.body : null) ||
    'Unknown push delivery error'

  return {
    message,
    statusCode,
    expired: statusCode === 404 || statusCode === 410,
  }
}

export class SupabasePushNotificationStore implements PushNotificationStore {
  async listActiveSubscriptionsForUser(userId: string, clinicId: string): Promise<PushSubscriptionRow[]> {
    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, clinic_id, user_id, endpoint, keys_p256dh, keys_auth')
      .eq('user_id', userId)
      .eq('clinic_id', clinicId)
      .eq('is_active', true)

    if (error) {
      throw new Error(`Failed to fetch push subscriptions: ${error.message}`)
    }

    return (data || []) as PushSubscriptionRow[]
  }

  async listActiveSubscriptionsForClinic(clinicId: string): Promise<PushSubscriptionRow[]> {
    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, clinic_id, user_id, endpoint, keys_p256dh, keys_auth')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)

    if (error) {
      throw new Error(`Failed to fetch clinic push subscriptions: ${error.message}`)
    }

    return (data || []) as PushSubscriptionRow[]
  }

  async createNotificationLog(input: {
    clinicId: string
    subscriptionId: string
    notificationType: string
    payload: PushNotificationPayload
  }): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('push_notifications')
      .insert({
        clinic_id: input.clinicId,
        subscription_id: input.subscriptionId,
        notification_type: input.notificationType,
        title: input.payload.title,
        body: input.payload.body,
        icon_url: input.payload.icon || null,
        action_url: input.payload.url || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to create push notification log: ${error.message}`)
    }

    if (!data?.id) {
      throw new Error('Failed to create push notification log: missing id')
    }

    return data.id
  }

  async markNotificationSent(notificationId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('push_notifications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', notificationId)

    if (error) {
      throw new Error(`Failed to mark push notification sent: ${error.message}`)
    }
  }

  async markNotificationFailed(notificationId: string, errorMessage: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('push_notifications')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', notificationId)

    if (error) {
      throw new Error(`Failed to mark push notification failed: ${error.message}`)
    }
  }

  async deactivateSubscription(subscriptionId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('id', subscriptionId)

    if (error) {
      throw new Error(`Failed to deactivate push subscription: ${error.message}`)
    }
  }
}

export class PushNotificationService {
  constructor(
    private readonly adapter: WebPushAdapter = webpush,
    private readonly store: PushNotificationStore = new SupabasePushNotificationStore()
  ) {}

  async sendNotification(options: SendNotificationOptions): Promise<PushSendSummary> {
    try {
      const subscriptions = await this.store.listActiveSubscriptionsForUser(options.userId, options.clinicId)
      return this.sendToSubscriptions(subscriptions, options.clinicId, options.notificationType, options.payload)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown push subscription lookup error'
      console.error('[PushService] Failed to prepare notification:', error)
      return this.emptyFailure(message)
    }
  }

  async sendNotificationToClinic(options: SendClinicNotificationOptions): Promise<PushSendSummary> {
    try {
      const subscriptions = await this.store.listActiveSubscriptionsForClinic(options.clinicId)
      return this.sendToSubscriptions(subscriptions, options.clinicId, options.notificationType, options.payload)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown clinic push subscription lookup error'
      console.error('[PushService] Failed to prepare clinic notification:', error)
      return this.emptyFailure(message)
    }
  }

  async sendAppointmentReminder(
    userId: string,
    clinicId: string,
    appointmentDetails: {
      patientName: string
      serviceName: string
      dateTime: string
    }
  ): Promise<PushSendSummary> {
    return this.sendNotification({
      userId,
      clinicId,
      notificationType: 'appointment_reminder',
      payload: {
        title: 'Recordatorio de Cita',
        body: `${appointmentDetails.patientName} - ${appointmentDetails.serviceName} a las ${appointmentDetails.dateTime}`,
        icon: '/icons/icon-192x192.png',
        url: '/appointments',
        tag: 'appointment-reminder',
        requireInteraction: true,
      },
    })
  }

  async sendTreatmentCreated(
    userId: string,
    clinicId: string,
    treatmentDetails: {
      patientName: string
      serviceName: string
    }
  ): Promise<PushSendSummary> {
    return this.sendNotification({
      userId,
      clinicId,
      notificationType: 'treatment_created',
      payload: {
        title: 'Nuevo Tratamiento',
        body: `Tratamiento creado: ${treatmentDetails.serviceName} para ${treatmentDetails.patientName}`,
        icon: '/icons/icon-192x192.png',
        url: '/treatments',
        tag: 'treatment-created',
      },
    })
  }

  async sendLowStockAlert(
    userId: string,
    clinicId: string,
    supplyName: string,
    currentStock: number
  ): Promise<PushSendSummary> {
    return this.sendNotification({
      userId,
      clinicId,
      notificationType: 'low_stock_alert',
      payload: {
        title: 'Inventario Bajo',
        body: `${supplyName} tiene solo ${currentStock} unidades restantes`,
        icon: '/icons/icon-192x192.png',
        url: '/supplies',
        tag: 'low-stock',
        requireInteraction: true,
      },
    })
  }

  private async sendToSubscriptions(
    subscriptions: PushSubscriptionRow[],
    clinicId: string,
    notificationType: string,
    payload: PushNotificationPayload
  ): Promise<PushSendSummary> {
    const results: PushSendResult[] = []

    for (const subscription of subscriptions) {
      results.push(await this.sendToSubscription(subscription, clinicId, notificationType, payload))
    }

    return {
      attempted: results.length,
      sent: results.filter((result) => result.status === 'sent').length,
      failed: results.filter((result) => result.status === 'failed').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      results,
    }
  }

  private async sendToSubscription(
    subscription: PushSubscriptionRow,
    clinicId: string,
    notificationType: string,
    payload: PushNotificationPayload
  ): Promise<PushSendResult> {
    let notificationId: string | null = null

    try {
      notificationId = await this.store.createNotificationLog({
        clinicId,
        subscriptionId: subscription.id,
        notificationType,
        payload,
      })

      const vapidConfig = getVapidConfig()
      if (!vapidConfig.configured || !vapidConfig.publicKey || !vapidConfig.privateKey) {
        const error = 'Web Push VAPID keys are not configured'
        await this.store.markNotificationFailed(notificationId, error)
        return {
          subscriptionId: subscription.id,
          notificationId,
          status: 'failed',
          error,
        }
      }

      this.adapter.setVapidDetails(vapidConfig.subject, vapidConfig.publicKey, vapidConfig.privateKey)

      await this.adapter.sendNotification(
        buildWebPushSubscription(subscription),
        buildWebPushPayload(payload, notificationId),
        {
          TTL: 60 * 60,
          urgency: payload.requireInteraction ? 'high' : 'normal',
          topic: payload.tag,
        }
      )

      await this.store.markNotificationSent(notificationId)

      return {
        subscriptionId: subscription.id,
        notificationId,
        status: 'sent',
      }
    } catch (error) {
      const classified = classifyWebPushError(error)
      console.error('[PushService] Failed to send push notification:', error)

      if (notificationId) {
        await this.store.markNotificationFailed(notificationId, classified.message)
      }

      if (classified.expired) {
        await this.store.deactivateSubscription(subscription.id)
      }

      return {
        subscriptionId: subscription.id,
        notificationId,
        status: 'failed',
        error: classified.message,
        deactivated: classified.expired,
      }
    }
  }

  private emptyFailure(error: string): PushSendSummary {
    return {
      attempted: 0,
      sent: 0,
      failed: 1,
      skipped: 0,
      results: [
        {
          subscriptionId: 'lookup',
          notificationId: null,
          status: 'failed',
          error,
        },
      ],
    }
  }
}

export const pushNotificationService = new PushNotificationService()
