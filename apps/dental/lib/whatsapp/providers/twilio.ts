/**
 * Twilio WhatsApp Provider
 *
 * Uses Twilio's WhatsApp Business API
 * Docs: https://www.twilio.com/docs/whatsapp
 */

import { BaseWhatsAppProvider } from './base'
import type { SendMessageResult, WhatsAppConfig, MessageStatus } from '../types'

export class TwilioWhatsAppProvider extends BaseWhatsAppProvider {
  private baseUrl = 'https://api.twilio.com/2010-04-01'

  validateConfig(config: WhatsAppConfig): { valid: boolean; error?: string } {
    if (!config.twilio_account_sid) {
      return { valid: false, error: 'Twilio Account SID is required' }
    }
    if (!config.twilio_auth_token) {
      return { valid: false, error: 'Twilio Auth Token is required' }
    }
    if (!config.twilio_phone_number) {
      return { valid: false, error: 'Twilio WhatsApp phone number is required' }
    }
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
      const fromNumber = config.twilio_phone_number!

      // Twilio requires 'whatsapp:' prefix
      const whatsappTo = `whatsapp:${formattedTo}`
      const whatsappFrom = fromNumber.startsWith('whatsapp:')
        ? fromNumber
        : `whatsapp:${fromNumber}`

      const url = `${this.baseUrl}/Accounts/${config.twilio_account_sid}/Messages.json`

      const body = new URLSearchParams({
        To: whatsappTo,
        From: whatsappFrom,
        Body: content,
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(
              `${config.twilio_account_sid}:${config.twilio_auth_token}`
            ).toString('base64'),
        },
        body: body.toString(),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[twilio] Send failed:', data)
        return {
          success: false,
          error: data.message || `HTTP ${response.status}`,
        }
      }

      // Twilio charges ~$0.005 per message + WhatsApp conversation fees
      // This is an estimate, actual cost depends on conversation type
      const estimatedCostCents = 1 // $0.01 estimate

      return {
        success: true,
        messageId: data.sid,
        status: this.mapProviderStatus(data.status),
        costCents: estimatedCostCents,
      }
    } catch (error) {
      console.error('[twilio] Unexpected error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Parse Twilio webhook payload for status updates
   */
  parseStatusWebhook(payload: Record<string, string>): {
    messageId: string
    status: MessageStatus
    timestamp?: string
    errorMessage?: string
  } | null {
    if (!payload.MessageSid || !payload.MessageStatus) {
      return null
    }

    return {
      messageId: payload.MessageSid,
      status: this.mapProviderStatus(payload.MessageStatus),
      timestamp: payload.Timestamp || new Date().toISOString(),
      errorMessage: payload.ErrorMessage || undefined,
    }
  }
}
