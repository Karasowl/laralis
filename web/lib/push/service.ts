import { supabaseAdmin } from '@/lib/supabaseAdmin'

interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  url?: string
  tag?: string
  requireInteraction?: boolean
  actions?: Array<{ action: string; title: string; icon?: string }>
  image?: string
}

interface SendNotificationOptions {
  userId: string
  clinicId: string
  notificationType: string
  payload: PushNotificationPayload
}

/**
 * Push Notification Service
 *
 * NOTE: This service currently only logs notifications to the database.
 * Actual push delivery requires the 'web-push' library which needs approval.
 *
 * To enable actual push delivery:
 * 1. Install web-push: npm install web-push
 * 2. Generate VAPID keys: npx web-push generate-vapid-keys
 * 3. Set VAPID keys in .env.local
 * 4. Implement sendPushToSubscription() using web-push library
 */
export class PushNotificationService {
  /**
   * Send a push notification to a user
   *
   * Current behavior: Logs to database only
   * Future: Will actually send via web-push library
   */
  async sendNotification({
    userId,
    clinicId,
    notificationType,
    payload
  }: SendNotificationOptions): Promise<void> {
    try {
      // Get active subscriptions for user
      const { data: subscriptions, error: fetchError } = await supabaseAdmin
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (fetchError) {
        console.error('[PushService] Failed to fetch subscriptions:', fetchError)
        return
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log('[PushService] No active subscriptions for user:', userId)
        return
      }

      // Send to each subscription
      for (const subscription of subscriptions) {
        await this.sendToSubscription(subscription, clinicId, notificationType, payload)
      }
    } catch (err) {
      console.error('[PushService] Send notification error:', err)
    }
  }

  /**
   * Send notification to a single subscription
   */
  private async sendToSubscription(
    subscription: any,
    clinicId: string,
    notificationType: string,
    payload: PushNotificationPayload
  ): Promise<void> {
    // Create notification log entry
    const { data: notification, error: insertError } = await supabaseAdmin
      .from('push_notifications')
      .insert({
        clinic_id: clinicId,
        subscription_id: subscription.id,
        notification_type: notificationType,
        title: payload.title,
        body: payload.body,
        icon_url: payload.icon,
        action_url: payload.url,
        status: 'pending'
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[PushService] Failed to create notification log:', insertError)
      return
    }

    // TODO: Implement actual push delivery with web-push library
    // For now, just log the notification
    console.log('[PushService] Notification logged (not sent):', {
      notificationId: notification.id,
      endpoint: subscription.endpoint,
      title: payload.title,
      body: payload.body
    })

    // When web-push is installed, replace the above with:
    /*
    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys_p256dh,
          auth: subscription.keys_auth
        }
      }

      const webPushPayload = JSON.stringify({
        ...payload,
        notificationId: notification.id
      })

      await webpush.sendNotification(
        pushSubscription,
        webPushPayload,
        {
          vapidDetails: {
            subject: 'mailto:admin@laralis.com',
            publicKey: process.env.VAPID_PUBLIC_KEY,
            privateKey: process.env.VAPID_PRIVATE_KEY
          }
        }
      )

      // Update status to sent
      await supabaseAdmin
        .from('push_notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', notification.id)

      console.log('[PushService] Push sent successfully:', notification.id)
    } catch (err) {
      console.error('[PushService] Failed to send push:', err)

      // Update status to failed
      await supabaseAdmin
        .from('push_notifications')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error'
        })
        .eq('id', notification.id)

      // If subscription is expired/invalid, deactivate it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', subscription.id)
      }
    }
    */
  }

  /**
   * Send appointment reminder notification
   */
  async sendAppointmentReminder(
    userId: string,
    clinicId: string,
    appointmentDetails: {
      patientName: string
      serviceName: string
      dateTime: string
    }
  ): Promise<void> {
    await this.sendNotification({
      userId,
      clinicId,
      notificationType: 'appointment_reminder',
      payload: {
        title: 'Recordatorio de Cita',
        body: `${appointmentDetails.patientName} - ${appointmentDetails.serviceName} a las ${appointmentDetails.dateTime}`,
        icon: '/icons/icon-192x192.png',
        url: '/appointments',
        tag: 'appointment-reminder',
        requireInteraction: true
      }
    })
  }

  /**
   * Send treatment created notification
   */
  async sendTreatmentCreated(
    userId: string,
    clinicId: string,
    treatmentDetails: {
      patientName: string
      serviceName: string
    }
  ): Promise<void> {
    await this.sendNotification({
      userId,
      clinicId,
      notificationType: 'treatment_created',
      payload: {
        title: 'Nuevo Tratamiento',
        body: `Tratamiento creado: ${treatmentDetails.serviceName} para ${treatmentDetails.patientName}`,
        icon: '/icons/icon-192x192.png',
        url: '/treatments',
        tag: 'treatment-created'
      }
    })
  }

  /**
   * Send low stock alert
   */
  async sendLowStockAlert(
    userId: string,
    clinicId: string,
    supplyName: string,
    currentStock: number
  ): Promise<void> {
    await this.sendNotification({
      userId,
      clinicId,
      notificationType: 'low_stock_alert',
      payload: {
        title: 'Inventario Bajo',
        body: `${supplyName} tiene solo ${currentStock} unidades restantes`,
        icon: '/icons/icon-192x192.png',
        url: '/supplies',
        tag: 'low-stock',
        requireInteraction: true
      }
    })
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService()
