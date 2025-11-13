/**
 * AI Provider Factory
 *
 * Factory for creating AI providers based on configuration.
 * Uses Strategy Pattern to allow runtime provider switching.
 * Implements lazy loading to avoid build-time errors.
 */

import type { STTProvider, LLMProvider, TTSProvider } from './types'
import { getAIConfig } from './config'

// STT Providers
import { DeepgramSTT } from './providers/stt/deepgram'
import { WhisperSTT } from './providers/stt/whisper'

// LLM Providers
import { KimiLLM } from './providers/llm/kimi'
import { OpenAILLM } from './providers/llm/openai'
import { DeepSeekLLM } from './providers/llm/deepseek'

// TTS Providers
import { DeepgramTTS } from './providers/tts/deepgram'
import { FishAudioTTS } from './providers/tts/fishaudio'
import { OpenAITTS } from './providers/tts/openai'

/**
 * Factory for creating STT providers
 */
export class AIProviderFactory {
  private static sttInstance: STTProvider | null = null
  private static llmInstance: LLMProvider | null = null
  private static ttsInstance: TTSProvider | null = null

  /**
   * Create or get STT provider singleton
   */
  static createSTT(): STTProvider {
    if (this.sttInstance) {
      return this.sttInstance
    }

    const config = getAIConfig()
    const provider = config.stt.provider

    switch (provider) {
      case 'deepgram':
        this.sttInstance = new DeepgramSTT()
        break
      case 'whisper':
        this.sttInstance = new WhisperSTT()
        break
      default:
        throw new Error(`Unknown STT provider: ${provider}`)
    }

    console.log(`[AIProviderFactory] Created STT provider: ${provider}`)
    return this.sttInstance
  }

  /**
   * Create or get LLM provider singleton
   */
  static createLLM(): LLMProvider {
    if (this.llmInstance) {
      return this.llmInstance
    }

    const config = getAIConfig()
    const provider = config.llm.provider

    switch (provider) {
      case 'kimi':
        this.llmInstance = new KimiLLM()
        break
      case 'openai':
        this.llmInstance = new OpenAILLM()
        break
      case 'deepseek':
        this.llmInstance = new DeepSeekLLM()
        break
      default:
        throw new Error(`Unknown LLM provider: ${provider}`)
    }

    console.log(`[AIProviderFactory] Created LLM provider: ${provider}`)
    return this.llmInstance
  }

  /**
   * Create or get TTS provider singleton
   */
  static createTTS(): TTSProvider {
    if (this.ttsInstance) {
      return this.ttsInstance
    }

    const config = getAIConfig()
    const provider = config.tts.provider

    switch (provider) {
      case 'deepgram':
        this.ttsInstance = new DeepgramTTS()
        break
      case 'fishaudio':
        this.ttsInstance = new FishAudioTTS()
        break
      case 'openai':
        this.ttsInstance = new OpenAITTS()
        break
      default:
        throw new Error(`Unknown TTS provider: ${provider}`)
    }

    console.log(`[AIProviderFactory] Created TTS provider: ${provider}`)
    return this.ttsInstance
  }

  /**
   * Reset all provider instances (useful for testing)
   */
  static reset(): void {
    this.sttInstance = null
    this.llmInstance = null
    this.ttsInstance = null
  }

  /**
   * Get current provider names
   */
  static getProviderNames(): {
    stt: string
    llm: string
    tts: string
  } {
    const config = getAIConfig()
    return {
      stt: config.stt.provider,
      llm: config.llm.provider,
      tts: config.tts.provider,
    }
  }
}