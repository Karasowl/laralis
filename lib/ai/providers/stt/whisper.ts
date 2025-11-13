/**
 * OpenAI Whisper STT Provider
 *
 * Speech-to-Text using OpenAI Whisper API.
 * Fallback option with excellent accuracy but batch-only.
 */

import type { STTProvider, STTOptions } from '../../types'
import { AI_CONFIG, PROVIDER_ENDPOINTS, DEFAULT_MODELS } from '../../config'

export class WhisperSTT implements STTProvider {
  readonly name = 'whisper'
  readonly supportsStreaming = false

  async transcribe(audio: Blob, options?: STTOptions): Promise<string> {
    const language = options?.language || AI_CONFIG.stt.defaultLanguage
    const model = options?.model || DEFAULT_MODELS.stt.whisper

    try {
      // OpenAI expects audio as file in multipart/form-data
      const formData = new FormData()
      formData.append('file', audio, 'recording.webm')
      formData.append('model', model)
      formData.append('language', language)
      formData.append('response_format', 'json')

      const response = await fetch(
        `${PROVIDER_ENDPOINTS.openai.base}${PROVIDER_ENDPOINTS.openai.transcribe}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AI_CONFIG.stt.apiKey}`,
          },
          body: formData,
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          `OpenAI Whisper API error: ${response.status} - ${error.error?.message || 'Unknown error'}`
        )
      }

      const data = await response.json()

      if (!data.text) {
        throw new Error('No transcript returned from Whisper')
      }

      return data.text
    } catch (error) {
      console.error('[WhisperSTT] Transcription error:', error)
      throw new Error(
        `Failed to transcribe audio with Whisper: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
