/**
 * 360dialog WhatsApp Provider
 *
 * Uses 360dialog's WhatsApp Business API (direct Meta integration)
 * Docs: https://docs.360dialog.com/
 */

import { BaseWhatsAppProvider } from './base'
import type { SendMessageResult, WhatsAppConfig, MessageStatus } from '../types'

export class Dialog360WhatsAppProvider extends BaseWhatsAppProvider {
  private baseUrl = 'https://waba.360dialog.io/v1'

  validateConfig(config: WhatsAppConfig): { valid: boolean; error?: string } {
    if (!config.dialog360_api_key) {
      return { valid: false, error: '360dialog API key is required' }
    }
    // Phone number ID is optional for some setups
    return { valid: true }
  }

  async sendMessage(
    to: string,
    content: string,
    config: WhatsAppConfig
  ): Promise<SendMessageResult> {
    const validation = this.validateConfig(config)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    try {
      const formattedTo = this.formatPhoneNumber(to, config.default_country_code)
      // 360dialog expects phone without + prefix
      const phone = formattedTo.replace('+', '')

      const url = `${this.baseUrl}/messages`

      const body = {
        to: phone,
        type: 'text',
        text: {
          body: content,
        },
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'D360-API-KEY': config.dialog360_api_key!,
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[360dialog] Send failed:', data)
        return {
          success: false,
          error: data.error?.message || data.message || `HTTP ${response.status}`,
        }
      }

      // 360dialog charges monthly fee + WhatsApp conversation rates
      // No per-message markup
      const estimatedCostCents = 0 // Only Meta charges apply

      return {
        success: true,
        messageId: data.messages?.[0]?.id || data.id,
        status: 'sent',
        costCents: estimatedCostCents,
      }
    } catch (error) {
      console.error('[360dialog] Unexpected error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Parse 360dialog webhook payload for status updates
   */
  parseStatusWebhook(payload: any): {
    messageId: string
    status: MessageStatus
    timestamp?: string
    errorMessage?: string
  } | null {
    // 360dialog uses Cloud API webhook format
    const statuses = payload?.entry?.[0]?.changes?.[0]?.value?.statuses
    if (!statuses || statuses.length === 0) {
      return null
    }

    const status = statuses[0]
    return {
      messageId: status.id,
      status: this.mapProviderStatus(status.status),
      timestamp: status.timestamp
        ? new Date(parseInt(status.timestamp) * 1000).toISOString()
        : undefined,
      errorMessage: status.errors?.[0]?.message,
    }
  }

  /**
   * Override format for 360dialog (they prefer without + but we keep it for consistency)
   */
  formatPhoneNumber(phone: string, countryCode: string = '52'): string {
    const formatted = super.formatPhoneNumber(phone, countryCode)
    return formatted // Keep the + for consistency, remove in sendMessage
  }
}
