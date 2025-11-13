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
    // Pre-load ALL clinic data in one go (faster and cheaper than function calling)
    const clinicSnapshot = await this.getClinicSnapshot(context)

    const systemPrompt = this.buildAnalyticsSystemPromptWithData(context, clinicSnapshot)

    // Single LLM call with all data in context - no function calling needed
    const response = await this.getLLM().chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ])

    return {
      answer: response,
      data: clinicSnapshot,
    }
  }

  /**
   * Query database with streaming response
   * Returns a ReadableStream for real-time token delivery
   */
  async queryDatabaseStream(query: string, context: QueryContext): Promise<ReadableStream> {
    // Pre-load ALL clinic data
    const clinicSnapshot = await this.getClinicSnapshot(context)
    const systemPrompt = this.buildAnalyticsSystemPromptWithData(context, clinicSnapshot)

    const kimiProvider = this.getLLM() as any
    if (!kimiProvider.chatStream) {
      throw new Error('Streaming not supported by current LLM provider')
    }

    return kimiProvider.chatStream([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ])
  }

  /**
   * Get complete clinic data snapshot for analysis
   * More efficient than multiple function calls
   */
  private async getClinicSnapshot(context: QueryContext): Promise<any> {
    const { supabase, clinicId } = context
    if (!supabase) return null

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    try {
      // Execute all queries in parallel
      const [
        revenueData,
        expensesData,
        servicesData,
        patientsData,
        fixedCostsData,
        tariffsData,
      ] = await Promise.all([
        // Revenue from treatments
        supabase
          .from('treatments')
          .select('price_cents, treatment_date, notes, service_id')
          .eq('clinic_id', clinicId)
          .gte('treatment_date', thirtyDaysAgo.toISOString())
          .order('treatment_date', { ascending: false }),

        // Expenses
        supabase
          .from('expenses')
          .select('amount_cents, date, category, description')
          .eq('clinic_id', clinicId)
          .gte('date', thirtyDaysAgo.toISOString())
          .order('date', { ascending: false }),

        // Services performance with full details
        supabase
          .from('treatments')
          .select(`
            service_id,
            price_cents,
            services!inner(
              name,
              variable_cost_cents,
              minutes
            )
          `)
          .eq('clinic_id', clinicId)
          .gte('treatment_date', thirtyDaysAgo.toISOString()),

        // Patient stats
        supabase
          .from('patients')
          .select('id, created_at, source')
          .eq('clinic_id', clinicId)
          .gte('created_at', thirtyDaysAgo.toISOString()),

        // Fixed costs for break-even analysis
        supabase
          .from('fixed_costs')
          .select('name, monthly_cost_cents')
          .eq('clinic_id', clinicId),

        // Current tariffs (prices) for each service
        supabase
          .from('tariffs')
          .select(`
            service_id,
            price_cents,
            services!inner(name)
          `)
          .eq('clinic_id', clinicId)
          .order('created_at', { ascending: false }),
      ])

      // Calculate total fixed costs
      const totalFixedCosts = fixedCostsData.data?.reduce((sum, fc) => sum + (fc.monthly_cost_cents || 0), 0) || 0

      return {
        period: 'last_30_days',
        revenue: {
          total_cents: revenueData.data?.reduce((sum, t) => sum + (t.price_cents || 0), 0) || 0,
          treatments_count: revenueData.data?.length || 0,
          treatments: revenueData.data || [],
        },
        expenses: {
          total_cents: expensesData.data?.reduce((sum, e) => sum + (e.amount_cents || 0), 0) || 0,
          count: expensesData.data?.length || 0,
          by_category: this.groupByCategory(expensesData.data || []),
        },
        fixed_costs: {
          monthly_total_cents: totalFixedCosts,
          items: fixedCostsData.data || [],
        },
        services: {
          top_services: this.getTopServicesWithMargins(servicesData.data || []),
          current_prices: tariffsData.data || [],
        },
        patients: {
          new_count: patientsData.data?.length || 0,
          by_source: this.groupBySource(patientsData.data || []),
        },
      }
    } catch (error) {
      console.error('[AIService] Error loading clinic snapshot:', error)
      return null
    }
  }

  private groupByCategory(expenses: any[]): Record<string, number> {
    return expenses.reduce((acc, exp) => {
      const cat = exp.category || 'otros'
      acc[cat] = (acc[cat] || 0) + exp.amount_cents
      return acc
    }, {})
  }

  private groupBySource(patients: any[]): Record<string, number> {
    return patients.reduce((acc, p) => {
      const source = p.source || 'unknown'
      acc[source] = (acc[source] || 0) + 1
      return acc
    }, {})
  }

  private getTopServicesWithMargins(treatments: any[]): any[] {
    const serviceStats = treatments.reduce((acc: any, t) => {
      const serviceName = t.services?.name || 'Unknown'
      const variableCost = t.services?.variable_cost_cents || 0
      const price = t.price_cents || 0
      const margin = price - variableCost

      if (!acc[serviceName]) {
        acc[serviceName] = {
          name: serviceName,
          revenue: 0,
          count: 0,
          total_margin: 0,
          variable_cost_cents: variableCost,
        }
      }
      acc[serviceName].revenue += price
      acc[serviceName].total_margin += margin
      acc[serviceName].count += 1
      return acc
    }, {})

    return Object.values(serviceStats)
      .map((s: any) => ({
        ...s,
        avg_margin_cents: s.count > 0 ? Math.round(s.total_margin / s.count) : 0,
        avg_price_cents: s.count > 0 ? Math.round(s.revenue / s.count) : 0,
      }))
      .sort((a: any, b: any) => b.total_margin - a.total_margin) // Sort by total margin, not revenue
      .slice(0, 5)
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
   * Build system prompt with pre-loaded clinic data
   */
  private buildAnalyticsSystemPromptWithData(context: QueryContext, snapshot: any): string {
    const { locale } = context

    const dataContext = snapshot ? `

CLINIC DATA (Last 30 Days):
========================

REVENUE:
- Total: $${((snapshot.revenue?.total_cents || 0) / 100).toFixed(2)}
- Treatments: ${snapshot.revenue?.treatments_count || 0}
- Average per treatment: $${snapshot.revenue?.treatments_count > 0 ? ((snapshot.revenue.total_cents / snapshot.revenue.treatments_count) / 100).toFixed(2) : '0.00'}

EXPENSES:
- Total: $${((snapshot.expenses?.total_cents || 0) / 100).toFixed(2)}
- Number of expenses: ${snapshot.expenses?.count || 0}
- By category: ${JSON.stringify(snapshot.expenses?.by_category || {}, null, 2)}

FIXED COSTS (Monthly):
- Total: $${((snapshot.fixed_costs?.monthly_total_cents || 0) / 100).toFixed(2)}
${snapshot.fixed_costs?.items?.map((fc: any) => `  - ${fc.name}: $${(fc.monthly_cost_cents / 100).toFixed(2)}`).join('\n') || '  (No fixed costs registered)'}

TOP SERVICES (by profit margin):
${snapshot.services?.top_services?.map((s: any) => `- ${s.name}:
  Revenue: $${(s.revenue / 100).toFixed(2)} (${s.count} treatments)
  Avg Price: $${(s.avg_price_cents / 100).toFixed(2)}
  Avg Margin: $${(s.avg_margin_cents / 100).toFixed(2)}
  Variable Cost: $${(s.variable_cost_cents / 100).toFixed(2)}`).join('\n') || 'No services data'}

PATIENTS:
- New patients: ${snapshot.patients?.new_count || 0}
- By source: ${JSON.stringify(snapshot.patients?.by_source || {}, null, 2)}

NET PROFIT: $${(((snapshot.revenue?.total_cents || 0) - (snapshot.expenses?.total_cents || 0)) / 100).toFixed(2)}
` : '\n[No data available]'

    return `You are a proactive and intelligent data analyst for a dental clinic management system.

Language: ${locale === 'es' ? 'Spanish' : 'English'}

${dataContext}

IMPORTANT RULES:
1. The data above is REAL data from the clinic - USE IT DIRECTLY in your answers
2. NEVER say "no tenemos datos" - analyze what IS available
3. If treatments=0 but services/costs ARE configured, analyze THOSE instead:
   - For "best treatment": Compare profit margins from SERVICES configuration (Avg Margin)
   - For "punto de equilibrio": Use FIXED COSTS and average margins from services
4. When asked about "best treatment", look at:
   - If treatments > 0: Use TOP SERVICES with actual performance
   - If treatments = 0: Use service configurations and explain based on potential margins
5. When asked about "punto de equilibrio":
   - Use FIXED COSTS total
   - Calculate: Fixed Costs ÷ Average Margin = treatments needed
   - Even with 0 treatments, you can calculate this!
6. ALWAYS cite specific numbers from the data above
7. Be direct and actionable - avoid generic advice

Approach for NEW clinic (0 treatments but services configured):
- Acknowledge lack of historical data briefly
- Immediately pivot to analyzing configured services
- Calculate based on potential: service prices minus variable costs
- Provide actionable numbers for break-even analysis
- Be optimistic and forward-looking

Examples of BAD responses (NEVER do this):
- "No hay información disponible..." ❌
- "No es posible identificar..." ❌
- "Comienza por recopilar datos..." ❌
- Long explanations about needing data ❌
- Generic advice without numbers ❌

NEVER ask for clarification unless the question is completely ambiguous. Always provide direct analysis based on available data - even if it's just configuration data.`
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