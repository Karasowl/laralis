/**
 * OpenAI TTS Provider
 *
 * Text-to-Speech using OpenAI TTS API.
 * Fallback option with good quality and reasonable pricing.
 */

import type { TTSProvider, TTSOptions, Voice } from '../../types'
import { getAIConfig, PROVIDER_ENDPOINTS, DEFAULT_MODELS } from '../../config'

export class OpenAITTS implements TTSProvider {
  readonly name = 'openai'

  async synthesize(text: string, options?: TTSOptions): Promise<ArrayBuffer> {
    const config = getAIConfig()
    const voice = options?.voice || config.tts.defaultVoice || DEFAULT_MODELS.tts.openai
    const speed = options?.speed || 1.0

    try {
      const response = await fetch(
        `${PROVIDER_ENDPOINTS.openai.base}${PROVIDER_ENDPOINTS.openai.tts}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.tts.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: text,
            voice,
            speed,
            response_format: options?.format || 'mp3',
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          `OpenAI TTS API error: ${response.status} - ${error.error?.message || 'Unknown error'}`
        )
      }

      return response.arrayBuffer()
    } catch (error) {
      console.error('[OpenAITTS] Synthesis error:', error)
      throw new Error(
        `Failed to synthesize speech with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async getSupportedVoices(): Promise<Voice[]> {
    const config = getAIConfig()
    // OpenAI has 6 fixed voices
    return [
      {
        id: 'alloy',
        name: 'Alloy',
        language: 'multi',
        gender: 'neutral',
      },
      {
        id: 'echo',
        name: 'Echo',
        language: 'multi',
        gender: 'male',
      },
      {
        id: 'fable',
        name: 'Fable',
        language: 'multi',
        gender: 'neutral',
      },
      {
        id: 'onyx',
        name: 'Onyx',
        language: 'multi',
        gender: 'male',
      },
      {
        id: 'nova',
        name: 'Nova',
        language: 'multi',
        gender: 'female',
      },
      {
        id: 'shimmer',
        name: 'Shimmer',
        language: 'multi',
        gender: 'female',
      },
    ]
  }
}
