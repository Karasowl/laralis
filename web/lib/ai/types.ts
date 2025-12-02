/**
 * AI Provider Types
 *
 * Interfaces for interchangeable AI providers (STT, LLM, TTS).
 * Follows Strategy Pattern to allow switching providers without code changes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Common Types
// ============================================================================

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool'
  content: string | null
  name?: string // For function responses (deprecated) and tool responses (required for tool role)
  function_call?: {
    // Deprecated - use tool_calls instead
    name: string
    arguments: string
  }
  tool_call_id?: string // Required for tool role - ID from the original tool call
  tool_calls?: Array<{
    // New format for function calling (assistant response)
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
}

export interface Voice {
  id: string
  name: string
  language: string
  gender?: 'male' | 'female' | 'neutral'
}

// ============================================================================
// STT (Speech-to-Text) Provider Interface
// ============================================================================

export interface STTOptions {
  language?: string
  model?: string
  streaming?: boolean
}

export interface STTProvider {
  readonly name: string
  readonly supportsStreaming: boolean

  /**
   * Transcribe audio blob to text
   */
  transcribe(audio: Blob, options?: STTOptions): Promise<string>
}

// ============================================================================
// LLM (Large Language Model) Provider Interface
// ============================================================================

export interface LLMOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
}

export interface AIFunction {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface FunctionCall {
  name: string
  arguments: Record<string, unknown>
  toolCallId?: string // For new tool-based API (Kimi, etc)
}

export interface LLMResponse {
  content: string | null
  functionCall?: FunctionCall
  thinkingProcess?: string // Only for models with thinking capability (e.g., Kimi K2)
}

export interface LLMProvider {
  readonly name: string
  readonly supportsThinking: boolean
  readonly supportsFunctionCalling: boolean

  /**
   * Simple chat completion
   */
  chat(messages: Message[], options?: LLMOptions): Promise<string>

  /**
   * Chat with function calling support
   */
  chatWithFunctions(
    messages: Message[],
    functions: AIFunction[],
    options?: LLMOptions
  ): Promise<LLMResponse>
}

// ============================================================================
// TTS (Text-to-Speech) Provider Interface
// ============================================================================

export interface TTSOptions {
  voice?: string
  speed?: number
  format?: 'mp3' | 'wav' | 'opus'
  language?: string
}

export interface VoiceInfo {
  id: string
  name: string
  language: string
  gender?: 'male' | 'female' | 'neutral'
  description?: string
}

export interface TTSProvider {
  readonly name: string
  readonly supportsStreaming?: boolean

  /**
   * Convert text to speech audio
   */
  synthesize(text: string, options?: TTSOptions): Promise<ArrayBuffer>

  /**
   * Get available voices for this provider
   */
  getSupportedVoices(): Promise<VoiceInfo[]>
}

// ============================================================================
// AI Service Types (High-level API)
// ============================================================================

export interface EntryContext {
  entityType: string
  schema: Record<string, unknown>
  currentField?: string
  collectedData?: Record<string, unknown>
  locale: string
}

export interface QueryContext {
  clinicId: string
  availableFunctions: AIFunction[]
  locale: string
  supabase?: SupabaseClient // Supabase client for direct queries
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  model?: 'kimi-k2-thinking' | 'moonshot-v1-32k'
}

export interface QueryResult {
  answer: string
  data?: unknown
  thinking?: string
  visualizations?: unknown[]
  suggestedAction?: ActionSuggestion // New: AI can suggest an action
}

// ============================================================================
// Actions System Types (NEW)
// ============================================================================

/**
 * Action types that Lara can execute
 */
export type ActionType =
  // Original actions (5)
  | 'update_service_price'
  | 'adjust_service_margin'
  | 'simulate_price_change'
  | 'create_expense'
  | 'update_time_settings'
  // New actions (10)
  | 'bulk_update_prices'
  | 'forecast_revenue'
  | 'identify_underperforming_services'
  | 'analyze_patient_retention'
  | 'optimize_inventory'
  | 'get_break_even_analysis'
  | 'compare_periods'
  | 'get_service_profitability'
  | 'get_expense_breakdown'
  | 'get_top_services'

/**
 * Action parameters for each action type
 */
export interface ActionParams {
  // === Original actions ===
  update_service_price: {
    service_id: string
    new_price_cents: number
    reason?: string
  }
  adjust_service_margin: {
    service_id: string
    target_margin_pct: number
    adjust_price?: boolean // If true, adjust price to achieve margin
  }
  simulate_price_change: {
    service_id?: string // If null, simulates for all services
    change_type: 'percentage' | 'fixed'
    change_value: number // % or cents
  }
  create_expense: {
    amount_cents: number
    category_id: string
    description: string
    expense_date: string // ISO date
  }
  update_time_settings: {
    work_days?: number
    hours_per_day?: number
    real_productivity_pct?: number
  }

  // === New actions ===
  bulk_update_prices: {
    change_type: 'percentage' | 'fixed'
    change_value: number // % or cents
    service_ids?: string[] // If null, applies to all services
    category?: string // Filter by category
  }
  forecast_revenue: {
    days: number // Number of days to forecast (default: 30)
    include_treatments?: boolean
    include_trends?: boolean
  }
  identify_underperforming_services: {
    min_margin_pct?: number // Threshold for "underperforming" (default: 30)
    include_suggestions?: boolean
  }
  analyze_patient_retention: {
    period_days?: number // Analysis period (default: 90)
    cohort_type?: 'monthly' | 'quarterly'
  }
  optimize_inventory: {
    days_ahead?: number // Days to forecast needs (default: 30)
    reorder_threshold_pct?: number // Alert when stock below this % of monthly usage
  }
  get_break_even_analysis: {
    period_days?: number // Period for calculations (default: 30)
    include_projections?: boolean
  }
  compare_periods: {
    period1_start: string // ISO date
    period1_end: string
    period2_start: string
    period2_end: string
    metrics?: ('revenue' | 'expenses' | 'treatments' | 'patients')[]
  }
  get_service_profitability: {
    service_id?: string // If null, returns all services
    period_days?: number // Period for calculations (default: 30)
    sort_by?: 'margin' | 'revenue' | 'count'
  }
  get_expense_breakdown: {
    period_days?: number // Period (default: 30)
    group_by?: 'category' | 'subcategory' | 'vendor'
  }
  get_top_services: {
    limit?: number // Number of services to return (default: 5)
    sort_by?: 'revenue' | 'count' | 'margin'
    period_days?: number
  }
}

/**
 * Action suggestion from AI
 */
export interface ActionSuggestion {
  action: ActionType
  params: ActionParams[ActionType]
  reasoning: string
  expected_impact: {
    metric: string
    current_value: number
    new_value: number
    change_pct: number
  }[]
  confidence: 'low' | 'medium' | 'high'
}

/**
 * Action execution result
 */
export interface ActionResult {
  success: boolean
  action: ActionType
  params: ActionParams[ActionType]
  result?: {
    before?: unknown
    after?: unknown
    changes: string[]
    // Additional fields for specific actions
    preview?: unknown       // For dry run previews (create_expense)
    created?: unknown       // For create actions (create_expense)
    simulation_by_service?: unknown  // For simulate_price_change
    [key: string]: unknown  // Allow additional fields for extensibility
  }
  error?: {
    code: string
    message: string
    details?: unknown
  }
  executed_at: string // ISO timestamp
  executed_by: string // user_id
}

/**
 * Action execution context
 */
export interface ActionContext {
  clinicId: string
  userId: string
  supabase: SupabaseClient
  dryRun?: boolean // If true, simulate without executing
}

/**
 * Action executor interface
 */
export interface ActionExecutor {
  /**
   * Execute an action
   */
  execute<T extends ActionType>(
    action: T,
    params: ActionParams[T],
    context: ActionContext
  ): Promise<ActionResult>

  /**
   * Validate action parameters before execution
   */
  validate<T extends ActionType>(
    action: T,
    params: ActionParams[T],
    context: ActionContext
  ): Promise<{ valid: boolean; errors?: string[] }>

  /**
   * Get action logs for audit
   */
  getActionHistory(
    clinicId: string,
    filters?: {
      action?: ActionType
      userId?: string
      startDate?: string
      endDate?: string
    }
  ): Promise<ActionResult[]>
}
