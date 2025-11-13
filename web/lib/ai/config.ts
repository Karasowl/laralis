/**
 * AI Configuration
 *
 * Centralized configuration for all AI providers.
 * Providers are selected via environment variables.
 *
 * IMPORTANT: Configuration is lazy-loaded to avoid build-time errors
 * when environment variables are not available during Next.js static generation.
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

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

/**
 * Check if we have valid AI configuration
 * Returns false during build time or when env vars are missing
 */
export function hasAIConfig(): boolean {
  // Check for at least one required API key
  const provider = getOptionalEnv('AI_LLM_PROVIDER', 'kimi')
  const keyMap: Record<string, string> = {
    kimi: 'KIMI_API_KEY',
    openai: 'OPENAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
  }
  return !!process.env[keyMap[provider]]
}

/**
 * Lazy configuration getter
 * This function is called only when the config is actually needed,
 * avoiding build-time errors when env vars are not available.
 *
 * IMPORTANT: This will return a placeholder config during build time.
 * The actual validation happens when the config is first used at runtime.
 */
let _cachedConfig: AIConfig | null = null
let _configError: Error | null = null

export function getAIConfig(): AIConfig {
  // Return cached config if already loaded
  if (_cachedConfig) {
    return _cachedConfig
  }

  // If we previously had an error, throw it again
  if (_configError) {
    throw _configError
  }

  try {
    // Build the configuration object
    // We don't validate required fields here - that happens at runtime
    const sttProvider = getOptionalEnv('AI_STT_PROVIDER', 'deepgram') as 'deepgram' | 'whisper'
    const llmProvider = getOptionalEnv('AI_LLM_PROVIDER', 'kimi') as 'kimi' | 'openai' | 'deepseek'
    const ttsProvider = getOptionalEnv('AI_TTS_PROVIDER', 'deepgram') as 'deepgram' | 'fishaudio' | 'openai'

    // Map providers to their required API key env vars
    const sttKeyMap: Record<string, string> = {
      deepgram: 'DEEPGRAM_API_KEY',
      whisper: 'OPENAI_API_KEY',
    }

    const llmKeyMap: Record<string, string> = {
      kimi: 'KIMI_API_KEY',
      openai: 'OPENAI_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
    }

    const ttsKeyMap: Record<string, string> = {
      deepgram: 'DEEPGRAM_API_KEY',
      fishaudio: 'FISH_AUDIO_API_KEY',
      openai: 'OPENAI_API_KEY',
    }

    // Get API keys, using placeholder during build
    const sttApiKey = process.env[sttKeyMap[sttProvider]] || 'placeholder-key'
    const llmApiKey = process.env[llmKeyMap[llmProvider]] || 'placeholder-key'
    const ttsApiKey = process.env[ttsKeyMap[ttsProvider]] || 'placeholder-key'

    const config: AIConfig = {
      stt: {
        provider: sttProvider,
        apiKey: sttApiKey,
        defaultLanguage: getOptionalEnv('AI_DEFAULT_LANGUAGE', 'es'),
      },
      llm: {
        provider: llmProvider,
        apiKey: llmApiKey,
        defaultModel: getOptionalEnv('AI_LLM_MODEL', ''),
        temperature: parseFloat(getOptionalEnv('AI_LLM_TEMPERATURE', '0.3')),
      },
      tts: {
        provider: ttsProvider,
        apiKey: ttsApiKey,
        defaultVoice: getOptionalEnv('AI_TTS_VOICE', 'aura-celeste-es'),
      },
      rateLimiting: {
        enabled: getOptionalEnv('AI_RATE_LIMITING_ENABLED', 'true') === 'true',
        maxRequestsPerHour: parseInt(getOptionalEnv('AI_RATE_LIMIT_PER_HOUR', '100'), 10),
      },
    }

    // Cache the config for subsequent calls
    _cachedConfig = config
    return config
  } catch (error) {
    // Cache the error to avoid repeated attempts
    _configError = error as Error
    console.error('[AI Config] Failed to load configuration:', error)
    throw error
  }
}

/**
 * Validate that the AI configuration has valid API keys
 * This should be called when actually attempting to use the AI services
 * @throws Error if configuration is invalid
 */
export function validateAIConfig(): void {
  const config = getAIConfig()

  // Check for placeholder keys that indicate build-time config
  if (config.stt.apiKey === 'placeholder-key') {
    throw new Error(`Missing required environment variable for STT provider ${config.stt.provider}`)
  }
  if (config.llm.apiKey === 'placeholder-key') {
    throw new Error(`Missing required environment variable for LLM provider ${config.llm.provider}`)
  }
  if (config.tts.apiKey === 'placeholder-key') {
    throw new Error(`Missing required environment variable for TTS provider ${config.tts.provider}`)
  }
}

/**
 * DEPRECATED: Use getAIConfig() instead
 * This export is kept for backward compatibility but will trigger
 * immediate evaluation which can cause build errors.
 * @deprecated
 */
export const AI_CONFIG: AIConfig = new Proxy({} as AIConfig, {
  get(target, prop) {
    const config = getAIConfig()
    return config[prop as keyof AIConfig]
  }
})

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
    base: 'https://api.moonshot.ai/v1',
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