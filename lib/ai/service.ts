/**
 * AI Service
 *
 * High-level API for AI interactions.
 * This is the main interface that UI components use.
 * Provider-agnostic - changing providers doesn't affect this API.
 */

import type {
  STTProvider,
  LLMProvider,
  TTSProvider,
  Message,
  AIFunction,
  EntryContext,
  QueryContext,
  QueryResult,
} from './types'
import { AIProviderFactory } from './factory'

export class AIService {
  private stt: STTProvider
  private llm: LLMProvider
  private tts: TTSProvider

  constructor() {
    this.stt = AIProviderFactory.createSTT()
    this.llm = AIProviderFactory.createLLM()
    this.tts = AIProviderFactory.createTTS()
  }

  // ========================================================================
  // STT Methods
  // ========================================================================

  /**
   * Transcribe audio to text
   */
  async transcribe(audio: Blob, language?: string): Promise<string> {
    return this.stt.transcribe(audio, { language })
  }

  // ========================================================================
  // LLM Methods - Simple Chat
  // ========================================================================

  /**
   * Simple chat completion
   */
  async chat(messages: Message[]): Promise<string> {
    return this.llm.chat(messages)
  }

  /**
   * Chat for data entry mode
   * Guides user through form fields step by step
   */
  async chatForEntry(userInput: string, context: EntryContext): Promise<string> {
    const systemPrompt = this.buildEntrySystemPrompt(context)

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput },
    ]

    return this.llm.chat(messages)
  }

  // ========================================================================
  // LLM Methods - Function Calling (Analytics)
  // ========================================================================

  /**
   * Query database using function calling
   * For analytics/insights mode
   */
  async queryDatabase(query: string, context: QueryContext): Promise<QueryResult> {
    const systemPrompt = this.buildAnalyticsSystemPrompt(context)
    const functions = this.getAvailableFunctions(context)

    const response = await this.llm.chatWithFunctions(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      functions
    )

    // If LLM wants to call a function, execute it
    if (response.functionCall) {
      const functionResult = await this.executeFunctionCall(
        response.functionCall.name,
        response.functionCall.arguments,
        context
      )

      // Get final answer with function result
      const finalResponse = await this.llm.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
        {
          role: 'function',
          name: response.functionCall.name,
          content: JSON.stringify(functionResult),
        },
      ])

      return {
        answer: finalResponse,
        data: functionResult,
        thinking: response.thinkingProcess,
      }
    }

    // No function call needed
    return {
      answer: response.content || '',
      thinking: response.thinkingProcess,
    }
  }

  // ========================================================================
  // TTS Methods
  // ========================================================================

  /**
   * Convert text to speech
   */
  async speakText(text: string, voice?: string): Promise<ArrayBuffer> {
    return this.tts.synthesize(text, { voice })
  }

  /**
   * Get available TTS voices
   */
  async getVoices() {
    return this.tts.getSupportedVoices()
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Build system prompt for data entry mode
   */
  private buildEntrySystemPrompt(context: EntryContext): string {
    const { entityType, schema, currentField, collectedData, locale } = context

    const schemaDescription = Object.entries(schema)
      .map(([field, config]: [string, any]) => {
        const required = config.required ? '(REQUIRED)' : '(optional)'
        const type = config.type || 'string'
        return `- ${field} ${required}: ${type}`
      })
      .join('\n')

    return `You are a helpful assistant guiding a user through creating a ${entityType} record.

Language: ${locale === 'es' ? 'Spanish' : 'English'}

Schema:
${schemaDescription}

Current field: ${currentField || 'Not started'}
Collected data: ${JSON.stringify(collectedData || {}, null, 2)}

Instructions:
1. Ask for ONE field at a time
2. For required fields, insist until you get a valid answer
3. For optional fields, allow user to skip by saying "skip" or "pasar"
4. Validate the input matches the field type
5. If user provides select/enum field, show available options
6. Be conversational and friendly
7. After all fields are collected, ask for confirmation

Keep responses SHORT and DIRECT.`
  }

  /**
   * Build system prompt for analytics mode
   */
  private buildAnalyticsSystemPrompt(context: QueryContext): string {
    const { locale } = context

    return `You are an expert data analyst for a dental clinic management system.

Language: ${locale === 'es' ? 'Spanish' : 'English'}

You have access to the following database functions to answer user questions:
- query_revenue: Get revenue data
- get_top_services: Get best performing services
- analyze_expenses: Analyze spending patterns
- get_patient_stats: Get patient metrics
- compare_periods: Compare time periods
- get_inventory_alerts: Check inventory status
- calculate_break_even: Calculate break-even point
- get_treatment_frequency: Analyze treatment patterns

Instructions:
1. Understand the user's question
2. Decide which function(s) to call to get the data
3. Call the function with appropriate parameters
4. Analyze the results
5. Provide insights and recommendations in natural language
6. Be concise but informative
7. Use numbers and data to support your answers

If the question is vague, ask for clarification.`
  }

  /**
   * Get available functions for function calling
   */
  private getAvailableFunctions(context: QueryContext): AIFunction[] {
    return [
      {
        name: 'query_revenue',
        description: 'Get revenue data filtered by date range',
        parameters: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
            end_date: { type: 'string', description: 'End date in YYYY-MM-DD format' },
            group_by: {
              type: 'string',
              enum: ['day', 'week', 'month'],
              description: 'How to group the data',
            },
          },
          required: ['start_date', 'end_date'],
        },
      },
      {
        name: 'get_top_services',
        description: 'Get services sorted by revenue or frequency',
        parameters: {
          type: 'object',
          properties: {
            metric: {
              type: 'string',
              enum: ['revenue', 'frequency', 'margin'],
              description: 'What metric to sort by',
            },
            limit: { type: 'number', description: 'How many services to return' },
            start_date: { type: 'string', description: 'Optional start date filter' },
            end_date: { type: 'string', description: 'Optional end date filter' },
          },
          required: ['metric'],
        },
      },
      {
        name: 'analyze_expenses',
        description: 'Get expense breakdown by category and time period',
        parameters: {
          type: 'object',
          properties: {
            category_id: { type: 'string', description: 'Optional category filter' },
            start_date: { type: 'string' },
            end_date: { type: 'string' },
          },
        },
      },
      // More functions can be added here
    ]
  }

  /**
   * Execute a function call safely
   */
  private async executeFunctionCall(
    functionName: string,
    args: Record<string, any>,
    context: QueryContext
  ): Promise<any> {
    const { clinicId } = context

    // Build query params
    const params = new URLSearchParams({
      clinic_id: clinicId,
      ...args,
    })

    // Map function names to API endpoints
    const endpointMap: Record<string, string> = {
      query_revenue: '/api/analytics/revenue',
      get_top_services: '/api/analytics/services/top',
      analyze_expenses: '/api/analytics/expenses',
      get_patient_stats: '/api/analytics/patients/stats',
      compare_periods: '/api/analytics/compare',
      get_inventory_alerts: '/api/analytics/inventory/alerts',
      calculate_break_even: '/api/analytics/break-even',
      get_treatment_frequency: '/api/analytics/treatments/frequency',
    }

    const endpoint = endpointMap[functionName]
    if (!endpoint) {
      throw new Error(`Unknown function: ${functionName}`)
    }

    // Execute the function by calling the API
    const response = await fetch(`${endpoint}?${params}`)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get information about current providers
   */
  getProviderInfo() {
    return {
      stt: this.stt.name,
      llm: this.llm.name,
      tts: this.tts.name,
      llmCapabilities: {
        thinking: this.llm.supportsThinking,
        functionCalling: this.llm.supportsFunctionCalling,
      },
      sttCapabilities: {
        streaming: this.stt.supportsStreaming,
      },
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Singleton instance of AIService
 * Use this in your app
 */
export const aiService = new AIService()
