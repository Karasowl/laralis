/**
 * Base WhatsApp Provider Interface
 */

import type { SendMessageResult, WhatsAppConfig, MessageStatus } from '../types'

export interface WhatsAppProviderInterface {
  /**
   * Send a WhatsApp message
   */
  sendMessage(
    to: string,
    content: string,
    config: WhatsAppConfig
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
    config: WhatsAppConfig
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
      delivered: 'delivered',
      seen: 'read',
      error: 'failed',
    }

    return statusMap[providerStatus.toLowerCase()] || 'pending'
  }
}
