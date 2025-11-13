/**
 * Deepgram TTS Provider (Aura)
 *
 * Text-to-Speech using Deepgram's Aura model.
 * Ultra-low latency (<200ms TTFB) with enterprise-grade quality.
 *
 * Consolidates with Deepgram STT - uses same API key.
 */

import type { TTSProvider, TTSOptions, VoiceInfo } from '../../types'
import { getAIConfig, PROVIDER_ENDPOINTS } from '../../config'

/**
 * Deepgram Aura voices available in Spanish (June 2025)
 *
 * Accents: Mexican, Peninsular, Colombian, Latin American
 */
const SPANISH_VOICES: Record<string, VoiceInfo> = {
  'aura-celeste-es': {
    id: 'aura-celeste-es',
    name: 'Celeste',
    language: 'es',
    gender: 'female',
    description: 'Colombian accent, energetic and friendly',
  },
  'aura-nestor-es': {
    id: 'aura-nestor-es',
    name: 'Nestor',
    language: 'es',
    gender: 'male',
    description: 'Peninsular Spanish, calm and professional',
  },
  'aura-luna-es': {
    id: 'aura-luna-es',
    name: 'Luna',
    language: 'es',
    gender: 'female',
    description: 'Mexican accent, warm and conversational',
  },
  'aura-andres-es': {
    id: 'aura-andres-es',
    name: 'Andres',
    language: 'es',
    gender: 'male',
    description: 'Latin American, clear and professional',
  },
}

export class DeepgramTTS implements TTSProvider {
  readonly name = 'deepgram'
  readonly supportsStreaming = false // Aura doesn't support streaming yet

  /**
   * Synthesize text to speech using Deepgram Aura
   */
  async synthesize(text: string, options?: TTSOptions): Promise<ArrayBuffer> {
    const config = getAIConfig()
    // Select voice (default to Celeste - Mexican female)
    const voice = options?.voice || 'aura-celeste-es'
    const encoding = options?.format || 'mp3'

    // Build request URL with query params
    const params = new URLSearchParams({
      model: voice,
      encoding,
    })

    try {
      const response = await fetch(
        `${PROVIDER_ENDPOINTS.deepgram.base}${PROVIDER_ENDPOINTS.deepgram.tts}?${params}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${config.tts.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          `Deepgram TTS error: ${response.status} - ${error.error?.message || 'Unknown error'}`
        )
      }

      // Return audio buffer
      return response.arrayBuffer()
    } catch (error) {
      console.error('[DeepgramTTS] Synthesis error:', error)
      throw new Error(
        `Failed to synthesize speech with Deepgram: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get list of supported Spanish voices
   */
  async getSupportedVoices(): Promise<VoiceInfo[]> {
    return Object.values(SPANISH_VOICES)
  }

  /**
   * Get specific voice info
   */
  getVoiceInfo(voiceId: string): VoiceInfo | undefined {
    return SPANISH_VOICES[voiceId]
  }
}
