/**
 * AI Library - Public API
 *
 * This is the main entry point for the AI module.
 * Import from here instead of individual files.
 */

// Main service (use this in your app)
export { aiService, AIService } from './service'

// Types (for TypeScript users)
export type {
  STTProvider,
  LLMProvider,
  TTSProvider,
  Message,
  Voice,
  AIFunction,
  FunctionCall,
  LLMResponse,
  EntryContext,
  QueryContext,
  QueryResult,
  STTOptions,
  LLMOptions,
  TTSOptions,
} from './types'

// Factory (if you need to create custom instances)
export { AIProviderFactory } from './factory'

// Configuration (if you need to access config)
// NOTE: Use getAIConfig() for lazy loading to avoid build-time errors
export { getAIConfig, hasAIConfig, validateAIConfig, type AIConfig } from './config'

// Legacy export (deprecated - use getAIConfig() instead)
export { AI_CONFIG } from './config'