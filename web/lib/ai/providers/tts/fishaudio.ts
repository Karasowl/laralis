/**
 * Fish Audio TTS Provider
 *
 * Text-to-Speech using Fish Audio API.
 * Best value option with excellent Spanish voices (20x cheaper than alternatives).
 */

import type { TTSProvider, TTSOptions, Voice } from '../../types'
import { getAIConfig, PROVIDER_ENDPOINTS, DEFAULT_MODELS } from '../../config'

export class FishAudioTTS implements TTSProvider {
  readonly name = 'fishaudio'

  async synthesize(text: string, options?: TTSOptions): Promise<ArrayBuffer> {
    const config = getAIConfig()
    const voice = options?.voice || config.tts.defaultVoice || DEFAULT_MODELS.tts.fishaudio
    const speed = options?.speed || 1.0
    const format = options?.format || 'mp3'

    try {
      const response = await fetch(
        `${PROVIDER_ENDPOINTS.fishaudio.base}${PROVIDER_ENDPOINTS.fishaudio.tts}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.tts.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            voice,
            format,
            speed,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Fish Audio API error: ${response.status} - ${error}`)
      }

      return response.arrayBuffer()
    } catch (error) {
      console.error('[FishAudioTTS] Synthesis error:', error)
      throw new Error(
        `Failed to synthesize speech with Fish Audio: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async getSupportedVoices(): Promise<Voice[]> {
    const config = getAIConfig()
    try {
      const response = await fetch(
        `${PROVIDER_ENDPOINTS.fishaudio.base}${PROVIDER_ENDPOINTS.fishaudio.voices}`,
        {
          headers: {
            Authorization: `Bearer ${config.tts.apiKey}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Fish Audio API error: ${response.status}`)
      }

      const voices = await response.json()

      // Map Fish Audio voice format to our Voice interface
      return voices.map((v: any) => ({
        id: v.id,
        name: v.name,
        language: v.language || 'unknown',
        gender: v.gender,
      }))
    } catch (error) {
      console.error('[FishAudioTTS] Failed to fetch voices:', error)
      // Return default voices if API fails
      return [
        {
          id: 'es-mx-female-1',
          name: 'Spanish (Mexico) Female',
          language: 'es-MX',
          gender: 'female',
        },
        {
          id: 'es-mx-male-1',
          name: 'Spanish (Mexico) Male',
          language: 'es-MX',
          gender: 'male',
        },
        {
          id: 'es-es-female-1',
          name: 'Spanish (Spain) Female',
          language: 'es-ES',
          gender: 'female',
        },
        {
          id: 'en-us-female-1',
          name: 'English (US) Female',
          language: 'en-US',
          gender: 'female',
        },
      ]
    }
  }
}
