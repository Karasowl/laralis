import type {
  SendMessageResult,
  WhatsAppConfig,
  MessageStatus,
  SendMessageOptions,
  WhatsAppQuickReplyButton,
} from '../types'

export interface WhatsAppProviderInterface {
  /**
   * Send a WhatsApp message
   */
  sendMessage(
    to: string,
    content: string,
    config: WhatsAppConfig,
    options?: SendMessageOptions
  ): Promise<SendMessageResult>

  /**
   * Get message status (for webhook updates)
   */
  parseStatusWebhook?(payload: unknown): {
    messageId: string
    status: MessageStatus
    timestamp?: string
    errorMessage?: string
  } | null

  /**
   * Format phone number for the provider
   */
  formatPhoneNumber(phone: string, countryCode: string): string

  /**
   * Validate configuration
   */
  validateConfig(config: WhatsAppConfig): { valid: boolean; error?: string }
}

/**
 * Base implementation with common utilities
 */
export abstract class BaseWhatsAppProvider implements WhatsAppProviderInterface {
  abstract sendMessage(
    to: string,
    content: string,
    config: WhatsAppConfig,
    options?: SendMessageOptions
  ): Promise<SendMessageResult>

  abstract validateConfig(config: WhatsAppConfig): { valid: boolean; error?: string }

  /**
   * Clean and format phone number to E.164 format
   */
  formatPhoneNumber(phone: string, countryCode: string = '52'): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/[^0-9]/g, '')

    // If starts with 0, remove it
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1)
    }

    // If doesn't have country code (<=10 digits for most countries), add it
    if (cleaned.length <= 10) {
      cleaned = countryCode + cleaned
    }

    return '+' + cleaned
  }

  /**
   * Parse Twilio-style status to our status enum
   */
  protected mapProviderStatus(providerStatus: string): MessageStatus {
    const statusMap: Record<string, MessageStatus> = {
      // Twilio statuses
      queued: 'pending',
      sending: 'pending',
      sent: 'sent',
      delivered: 'delivered',
      read: 'read',
      failed: 'failed',
      undelivered: 'undelivered',
      // 360dialog statuses
      accepted: 'sent',
      seen: 'read',
      error: 'failed',
    }

    return statusMap[providerStatus.toLowerCase()] || 'pending'
  }

  protected normalizeQuickReplyButtons(
    buttons: WhatsAppQuickReplyButton[] | undefined
  ): WhatsAppQuickReplyButton[] {
    return (buttons || [])
      .map((button) => ({
        id: button.id.trim().slice(0, 256),
        title: button.title.trim().slice(0, 20),
      }))
      .filter((button) => button.id && button.title)
      .slice(0, 3)
  }

  protected appendQuickReplyTextFallback(
    content: string,
    buttons: WhatsAppQuickReplyButton[] | undefined
  ): string {
    const normalizedButtons = this.normalizeQuickReplyButtons(buttons)
    if (normalizedButtons.length === 0) return content

    const options = normalizedButtons
      .map((button, index) => `${index + 1}. ${button.title}`)
      .join('\n')

    return `${content}\n\nResponde con una opcion:\n${options}`
  }
}
