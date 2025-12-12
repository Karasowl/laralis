/**
 * WhatsApp Provider Factory
 */

import type { WhatsAppProvider, WhatsAppConfig } from '../types'
import type { WhatsAppProviderInterface } from './base'
import { TwilioWhatsAppProvider } from './twilio'
import { Dialog360WhatsAppProvider } from './dialog360'

const providers: Record<WhatsAppProvider, new () => WhatsAppProviderInterface> = {
  twilio: TwilioWhatsAppProvider,
  '360dialog': Dialog360WhatsAppProvider,
}

let cachedProviders: Map<WhatsAppProvider, WhatsAppProviderInterface> = new Map()

/**
 * Get a WhatsApp provider instance
 */
export function getWhatsAppProvider(
  provider: WhatsAppProvider
): WhatsAppProviderInterface {
  if (!cachedProviders.has(provider)) {
    const ProviderClass = providers[provider]
    if (!ProviderClass) {
      throw new Error(`Unknown WhatsApp provider: ${provider}`)
    }
    cachedProviders.set(provider, new ProviderClass())
  }
  return cachedProviders.get(provider)!
}

/**
 * Get provider from config
 */
export function getProviderFromConfig(
  config: WhatsAppConfig
): WhatsAppProviderInterface {
  return getWhatsAppProvider(config.provider)
}

export { TwilioWhatsAppProvider } from './twilio'
export { Dialog360WhatsAppProvider } from './dialog360'
export type { WhatsAppProviderInterface } from './base'
