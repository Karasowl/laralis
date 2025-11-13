/**
 * Deepgram STT Provider
 *
 * Speech-to-Text using Deepgram Nova-3 model.
 * Best for real-time streaming and high accuracy Spanish.
 */

import type { STTProvider, STTOptions } from '../../types'
import { getAIConfig, PROVIDER_ENDPOINTS, DEFAULT_MODELS } from '../../config'

export class DeepgramSTT implements STTProvider {
  readonly name = 'deepgram'
  readonly supportsStreaming = true

  async transcribe(audio: Blob, options?: STTOptions): Promise<string> {
    const config = getAIConfig()
    const language = options?.language || config.stt.defaultLanguage
    const model = options?.model || DEFAULT_MODELS.stt.deepgram

    try {
      // Deepgram expects audio as file in multipart/form-data
      const formData = new FormData()
      formData.append('audio', audio, 'recording.webm')

      const params = new URLSearchParams({
        model,
        language,
        punctuate: 'true',
        diarize: 'false',
        smart_format: 'true',
      })

      const response = await fetch(
        `${PROVIDER_ENDPOINTS.deepgram.base}${PROVIDER_ENDPOINTS.deepgram.transcribe}?${params}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${config.stt.apiKey}`,
          },
          body: formData,
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Deepgram API error: ${response.status} - ${error}`)
      }

      const data = await response.json()

      // Extract transcript from Deepgram response structure
      const transcript =
        data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''

      if (!transcript) {
        throw new Error('No transcript returned from Deepgram')
      }

      return transcript
    } catch (error) {
      console.error('[DeepgramSTT] Transcription error:', error)
      throw new Error(
        `Failed to transcribe audio with Deepgram: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
