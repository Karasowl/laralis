/**
 * AI Service
 *
 * High-level API for AI interactions.
 * This is the main interface that UI components use.
 * Provider-agnostic - changing providers doesn't affect this API.
 *
 * IMPORTANT: Implements lazy initialization to avoid build-time errors
 * when environment variables are not available during Next.js static generation.
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
import type { SupabaseClient } from '@supabase/supabase-js'
import { AIProviderFactory } from './factory'

export class AIService {
  private stt: STTProvider | null = null
  private llm: LLMProvider | null = null
  private tts: TTSProvider | null = null

  /**
   * Get or create STT provider (lazy initialization)
   */
  private getSTT(): STTProvider {
    if (!this.stt) {
      this.stt = AIProviderFactory.createSTT()
    }
    return this.stt
  }

  /**
   * Get or create LLM provider (lazy initialization)
   */
  private getLLM(): LLMProvider {
    if (!this.llm) {
      this.llm = AIProviderFactory.createLLM()
    }
    return this.llm
  }

  /**
   * Get or create TTS provider (lazy initialization)
   */
  private getTTS(): TTSProvider {
    if (!this.tts) {
      this.tts = AIProviderFactory.createTTS()
    }
    return this.tts
  }

  // ========================================================================
  // STT Methods
  // ========================================================================

  /**
   * Transcribe audio to text
   */
  async transcribe(audio: Blob, language?: string): Promise<string> {
    return this.getSTT().transcribe(audio, { language })
  }

  // ========================================================================
  // LLM Methods - Simple Chat
  // ========================================================================

  /**
   * Simple chat completion
   */
  async chat(messages: Message[]): Promise<string> {
    return this.getLLM().chat(messages)
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

    return this.getLLM().chat(messages)
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
    const functions = this.getAvailableFunctions()

    const response = await this.getLLM().chatWithFunctions(
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
      const finalResponse = await this.getLLM().chat([
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
    return this.getTTS().synthesize(text, { voice })
  }

  /**
   * Get available TTS voices
   */
  async getVoices() {
    return this.getTTS().getSupportedVoices()
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
      .map(([field, config]: [string, Record<string, unknown>]) => {
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

    return `You are a proactive and intelligent data analyst for a dental clinic management system.

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
1. ALWAYS be proactive - infer reasonable defaults from context
2. If user asks for a "resume" (summary), provide a comprehensive overview using ALL available data
3. For date ranges: If not specified, use intelligent defaults (last month, last quarter, etc.)
4. For analysis types: If user asks generally, provide the most relevant metrics (revenue, top services, expenses, patient stats)
5. Call the necessary functions immediately with reasonable parameters
6. Analyze the results and provide actionable insights
7. Be concise but comprehensive
8. Use numbers and visualizations in your explanations

DEFAULT BEHAVIOR:
- When asked for a "resumen" or "summary" → Query revenue, top services, expenses, and patient stats for the last 30 days
- When time period is unclear → Use last month as default
- When asked about "todo en general" (everything) → Provide comprehensive multi-dimensional analysis

NEVER ask for clarification unless the question is completely ambiguous. Always make intelligent assumptions and act.`
  }

  /**
   * Get available functions for function calling
   */
  private getAvailableFunctions(): AIFunction[] {
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
   * Uses direct Supabase queries instead of HTTP calls to avoid auth issues
   */
  private async executeFunctionCall(
    functionName: string,
    args: Record<string, unknown>,
    context: QueryContext
  ): Promise<Record<string, unknown>> {
    const { clinicId, supabase } = context

    if (!supabase) {
      throw new Error('Supabase client is required for function execution')
    }

    // Route to appropriate handler based on function name
    switch (functionName) {
      case 'query_revenue':
        return this.executeQueryRevenue(supabase, clinicId, args)

      case 'get_top_services':
        return this.executeGetTopServices(supabase, clinicId, args)

      case 'analyze_expenses':
        return this.executeAnalyzeExpenses(supabase, clinicId, args)

      case 'get_patient_stats':
        return this.executeGetPatientStats(supabase, clinicId, args)

      default:
        throw new Error(`Unknown function: ${functionName}`)
    }
  }

  /**
   * Query revenue data
   */
  private async executeQueryRevenue(
    supabase: SupabaseClient,
    clinicId: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const start_date = args.start_date as string | undefined
    const end_date = args.end_date as string | undefined

    // Build query
    let query = supabase
      .from('treatments')
      .select('treatment_date, price_cents')
      .eq('clinic_id', clinicId)

    if (start_date) {
      query = query.gte('treatment_date', start_date)
    }
    if (end_date) {
      query = query.lte('treatment_date', end_date)
    }

    const { data: treatments, error } = await query

    if (error) {
      throw error
    }

    // Calculate total revenue
    const totalRevenueCents =
      treatments?.reduce((sum: number, t: { price_cents?: number }) => sum + (t.price_cents || 0), 0) || 0

    // Group by date
    const revenueByDate = treatments?.reduce(
      (acc: Record<string, number>, treatment: { treatment_date: string; price_cents?: number }) => {
        const date = treatment.treatment_date
        if (!acc[date]) {
          acc[date] = 0
        }
        acc[date] += treatment.price_cents || 0
        return acc
      },
      {} as Record<string, number>
    )

    return {
      total_revenue_cents: totalRevenueCents,
      revenue_by_date: revenueByDate,
      period: {
        start: start_date || null,
        end: end_date || null,
      },
      treatments_count: treatments?.length || 0,
    }
  }

  /**
   * Get top performing services
   */
  private async executeGetTopServices(
    supabase: SupabaseClient,
    clinicId: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const metric = (args.metric as string) || 'revenue'
    const limit = (args.limit as number) || 10
    const start_date = args.start_date as string | undefined
    const end_date = args.end_date as string | undefined

    // Query treatments with service info
    let query = supabase
      .from('treatments')
      .select(`
        service_id,
        price_cents,
        services (
          id,
          name
        )
      `)
      .eq('clinic_id', clinicId)

    if (start_date) {
      query = query.gte('treatment_date', start_date)
    }
    if (end_date) {
      query = query.lte('treatment_date', end_date)
    }

    const { data: treatments, error } = await query

    if (error) {
      throw error
    }

    // Aggregate by service
    const serviceMap: Record<
      string,
      { id: string; name: string; revenue: number; count: number }
    > = {}

    type TreatmentWithService = {
      service_id?: string
      price_cents?: number
      services?: { name: string }
    }

    treatments?.forEach((t: TreatmentWithService) => {
      if (!t.service_id || !t.services) return

      const serviceId = t.service_id
      if (!serviceMap[serviceId]) {
        serviceMap[serviceId] = {
          id: serviceId,
          name: t.services.name,
          revenue: 0,
          count: 0,
        }
      }
      serviceMap[serviceId].revenue += t.price_cents || 0
      serviceMap[serviceId].count += 1
    })

    // Convert to array and sort
    let services = Object.values(serviceMap)

    if (metric === 'revenue') {
      services.sort((a, b) => b.revenue - a.revenue)
    } else if (metric === 'frequency') {
      services.sort((a, b) => b.count - a.count)
    }

    // Apply limit
    services = services.slice(0, limit)

    return {
      services,
      total_services: services.length,
      metric,
    }
  }

  /**
   * Analyze expenses
   */
  private async executeAnalyzeExpenses(
    supabase: SupabaseClient,
    clinicId: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const category_id = args.category_id as string | undefined
    const start_date = args.start_date as string | undefined
    const end_date = args.end_date as string | undefined

    // Build query
    let query = supabase
      .from('expenses')
      .select(`
        id,
        amount_cents,
        category_id,
        expense_date,
        description,
        custom_categories (
          id,
          name
        )
      `)
      .eq('clinic_id', clinicId)

    if (category_id) {
      query = query.eq('category_id', category_id)
    }
    if (start_date) {
      query = query.gte('expense_date', start_date)
    }
    if (end_date) {
      query = query.lte('expense_date', end_date)
    }

    const { data: expenses, error } = await query

    if (error) {
      throw error
    }

    // Calculate total
    const totalExpensesCents =
      expenses?.reduce((sum: number, e: { amount_cents?: number }) => sum + (e.amount_cents || 0), 0) || 0

    // Group by category
    const expensesByCategory: Record<string, { name: string; amount: number; count: number }> = {}

    type ExpenseWithCategory = {
      amount_cents?: number
      custom_categories?: { name: string }
    }

    expenses?.forEach((e: ExpenseWithCategory) => {
      const categoryName = e.custom_categories?.name || 'Sin categoría'
      if (!expensesByCategory[categoryName]) {
        expensesByCategory[categoryName] = { name: categoryName, amount: 0, count: 0 }
      }
      expensesByCategory[categoryName].amount += e.amount_cents || 0
      expensesByCategory[categoryName].count += 1
    })

    return {
      total_expenses_cents: totalExpensesCents,
      expenses_by_category: Object.values(expensesByCategory),
      expenses_count: expenses?.length || 0,
      period: {
        start: start_date || null,
        end: end_date || null,
      },
    }
  }

  /**
   * Get patient statistics
   */
  private async executeGetPatientStats(
    supabase: SupabaseClient,
    clinicId: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const start_date = args.start_date as string | undefined
    const end_date = args.end_date as string | undefined

    // Get all patients for the clinic
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, created_at')
      .eq('clinic_id', clinicId)

    if (patientsError) {
      throw patientsError
    }

    // Get treatments for date range to calculate active patients
    let treatmentsQuery = supabase
      .from('treatments')
      .select('patient_id')
      .eq('clinic_id', clinicId)

    if (start_date) {
      treatmentsQuery = treatmentsQuery.gte('treatment_date', start_date)
    }
    if (end_date) {
      treatmentsQuery = treatmentsQuery.lte('treatment_date', end_date)
    }

    const { data: treatments, error: treatmentsError } = await treatmentsQuery

    if (treatmentsError) {
      throw treatmentsError
    }

    // Calculate unique active patients in period
    const activePatientIds = new Set(
      treatments?.map((t: { patient_id: string }) => t.patient_id) || []
    )

    return {
      total_patients: patients?.length || 0,
      active_patients_in_period: activePatientIds.size,
      period: {
        start: start_date || null,
        end: end_date || null,
      },
    }
  }

  /**
   * Get information about current providers
   * Uses lazy initialization to avoid build-time errors
   */
  getProviderInfo() {
    // Safe to check if providers exist without creating them
    const hasProviders = this.stt || this.llm || this.tts

    if (!hasProviders) {
      // Return default info during build time
      return {
        stt: 'not-initialized',
        llm: 'not-initialized',
        tts: 'not-initialized',
        llmCapabilities: {
          thinking: false,
          functionCalling: false,
        },
        sttCapabilities: {
          streaming: false,
        },
      }
    }

    return {
      stt: this.getSTT().name,
      llm: this.getLLM().name,
      tts: this.getTTS().name,
      llmCapabilities: {
        thinking: this.getLLM().supportsThinking,
        functionCalling: this.getLLM().supportsFunctionCalling,
      },
      sttCapabilities: {
        streaming: this.getSTT().supportsStreaming,
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
 *
 * IMPORTANT: This instance is created immediately but providers are initialized
 * lazily on first use to avoid build-time errors with missing env vars.
 */
export const aiService = new AIService()