/**
 * AI Configuration
 *
 * Centralized configuration for all AI providers.
 * Providers are selected via environment variables.
 */

export interface AIConfig {
  stt: {
    provider: 'deepgram' | 'whisper'
    apiKey: string
    defaultLanguage: string
  }
  llm: {
    provider: 'kimi' | 'openai' | 'deepseek'
    apiKey: string
    defaultModel?: string
    temperature: number
  }
  tts: {
    provider: 'deepgram' | 'fishaudio' | 'openai'
    apiKey: string
    defaultVoice?: string
  }
  rateLimiting: {
    enabled: boolean
    maxRequestsPerHour: number
  }
}

function getRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

/**
 * AI Configuration loaded from environment variables
 */
export const AI_CONFIG: AIConfig = {
  stt: {
    provider: getOptionalEnv('AI_STT_PROVIDER', 'deepgram') as 'deepgram' | 'whisper',
    apiKey: getRequiredEnv(
      getOptionalEnv('AI_STT_PROVIDER', 'deepgram') === 'deepgram'
        ? 'DEEPGRAM_API_KEY'
        : 'OPENAI_API_KEY'
    ),
    defaultLanguage: getOptionalEnv('AI_DEFAULT_LANGUAGE', 'es'),
  },
  llm: {
    provider: getOptionalEnv('AI_LLM_PROVIDER', 'kimi') as 'kimi' | 'openai' | 'deepseek',
    apiKey: (() => {
      const provider = getOptionalEnv('AI_LLM_PROVIDER', 'kimi')
      const keyMap: Record<string, string> = {
        kimi: 'KIMI_API_KEY',
        openai: 'OPENAI_API_KEY',
        deepseek: 'DEEPSEEK_API_KEY',
      }
      return getRequiredEnv(keyMap[provider])
    })(),
    defaultModel: getOptionalEnv('AI_LLM_MODEL', ''),
    temperature: parseFloat(getOptionalEnv('AI_LLM_TEMPERATURE', '0.3')),
  },
  tts: {
    provider: getOptionalEnv('AI_TTS_PROVIDER', 'deepgram') as 'deepgram' | 'fishaudio' | 'openai',
    apiKey: (() => {
      const provider = getOptionalEnv('AI_TTS_PROVIDER', 'deepgram')
      const keyMap: Record<string, string> = {
        deepgram: 'DEEPGRAM_API_KEY',
        fishaudio: 'FISH_AUDIO_API_KEY',
        openai: 'OPENAI_API_KEY',
      }
      return getRequiredEnv(keyMap[provider])
    })(),
    defaultVoice: getOptionalEnv('AI_TTS_VOICE', 'aura-celeste-es'),
  },
  rateLimiting: {
    enabled: getOptionalEnv('AI_RATE_LIMITING_ENABLED', 'true') === 'true',
    maxRequestsPerHour: parseInt(getOptionalEnv('AI_RATE_LIMIT_PER_HOUR', '100'), 10),
  },
}

/**
 * Provider-specific endpoints and configuration
 */
export const PROVIDER_ENDPOINTS = {
  deepgram: {
    base: 'https://api.deepgram.com/v1',
    transcribe: '/listen',
    tts: '/speak',
  },
  openai: {
    base: 'https://api.openai.com/v1',
    transcribe: '/audio/transcriptions',
    chat: '/chat/completions',
    tts: '/audio/speech',
  },
  kimi: {
    base: 'https://api.moonshot.cn/v1',
    chat: '/chat/completions',
  },
  deepseek: {
    base: 'https://api.deepseek.com/v1',
    chat: '/chat/completions',
  },
  fishaudio: {
    base: 'https://api.fish.audio/v1',
    tts: '/tts',
    voices: '/voices',
  },
} as const

/**
 * Default models for each provider
 */
export const DEFAULT_MODELS = {
  stt: {
    deepgram: 'nova-3',
    whisper: 'whisper-1',
  },
  llm: {
    kimi: 'kimi-k2-thinking',
    openai: 'gpt-4o-mini',
    deepseek: 'deepseek-chat',
  },
  tts: {
    deepgram: 'aura-celeste-es',
    fishaudio: 'es-mx-female-1',
    openai: 'nova',
  },
} as const
