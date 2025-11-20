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
import { ClinicSnapshotService } from './ClinicSnapshotService'

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

    // Build messages array with conversation history
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(context.conversationHistory || []).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: query },
    ]

    // Use specified model or default to K2 Thinking
    const model = context.model || 'kimi-k2-thinking'

    return kimiProvider.chatStream(messages, { model })
  }

  /**
   * Get complete clinic data snapshot for analysis
   * Uses ClinicSnapshotService to load ALL data and pre-computed analytics
   */
  private async getClinicSnapshot(context: QueryContext): Promise<any> {
    const { supabase, clinicId } = context
    if (!supabase) return null

    try {
      const snapshotService = new ClinicSnapshotService()
      return await snapshotService.getFullSnapshot(supabase, clinicId, {
        period: 30, // Last 30 days
      })
    } catch (error) {
      console.error('[AIService] Error loading clinic snapshot:', error)
      return null
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
  // Prompt Builders
  // ========================================================================

  private buildEntrySystemPrompt(context: EntryContext): string {
    const { formName, currentField, fields, language = 'es' } = context

    return `You are Lara, a helpful assistant for a dental clinic management system called Laralis.
Your goal is to help the user fill out the "${formName}" form.

Current status:
- Form: ${formName}
- Current field to fill: ${currentField}
- Fields: ${JSON.stringify(fields)}

Instructions:
1. Ask the user for the information needed for the "${currentField}" field.
2. If the user provides valid information, confirm it and move to the next field (if any).
3. If the user asks for help, explain what is needed for this field.
4. Be concise, professional, and friendly.
5. Speak in ${language === 'es' ? 'Spanish' : 'English'}.`
  }

  private buildAnalyticsSystemPromptWithData(context: QueryContext, snapshot: any): string {
    const { clinicId } = context
    const clinic = snapshot?.clinic || {}
    const analytics = snapshot?.analytics || {}
    const data = snapshot?.data || {}
    const services = data?.services?.list || []
    const expenses = data?.expenses || []
    const treatments = data?.treatments || {}
    const patients = data?.patients || {}
    const fixedCosts = data?.fixed_costs || {}
    const assets = data?.assets || {}

    // Format currency
    const fmt = (cents: number) => {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
      }).format(cents / 100)
    }

    return `You are Lara, a proactive and intelligent data analyst for a dental clinic management system called Laralis.
Your goal is to help the clinic owner understand their business performance and make better decisions.

## CLINIC CONFIGURATION

**Name**: ${clinic.name || 'Dental Clinic'}
**Work Schedule**:
- ${clinic.time_settings?.work_days_per_month || 22} days/month
- ${clinic.time_settings?.hours_per_day || 8} hours/day
- ${clinic.time_settings?.real_productivity_pct || 80}% productive time
- **Available treatment minutes**: ${clinic.time_settings?.available_treatment_minutes || 0} min/month

## COMPLETE DATA SNAPSHOT (Last 30 Days)

### FINANCIAL OVERVIEW
- **Total Revenue**: ${fmt(treatments.total_revenue_cents || 0)}
- **Total Expenses**: ${fmt(expenses.total_in_period_cents || 0)}
- **Net Income**: ${fmt((treatments.total_revenue_cents || 0) - (expenses.total_in_period_cents || 0))}
- **Profit Margin**: ${analytics.profitability?.profit_margin_pct || 0}%
- **Net Profit**: ${fmt(analytics.profitability?.net_profit_cents || 0)}

### KEY METRICS
- **Treatments Performed**: ${treatments.total_in_period || 0}
- **Total Patients**: ${patients.total || 0}
- **Active Patients**: ${patients.active_in_period || 0}
- **New Patients**: ${patients.new_in_period || 0}

### BREAK-EVEN ANALYSIS
- **Break-even Revenue Needed**: ${fmt(analytics.break_even?.revenue_cents || 0)}
- **Break-even Treatments Needed**: ${analytics.break_even?.treatments_needed || 0} treatments/month
- **Current Treatments**: ${analytics.break_even?.current_treatments || 0}
- **Gap**: ${analytics.break_even?.gap || 0} treatments (${analytics.break_even?.status || 'unknown'})
- **Average Treatment Price**: ${fmt(analytics.break_even?.calculation_metadata?.avg_treatment_price_cents || 0)}

### MARGINS & COSTS
- **Average Variable Cost**: ${analytics.margins?.avg_variable_cost_pct || 0}%
- **Contribution Margin**: ${analytics.margins?.contribution_margin_pct || 0}%
- **Monthly Fixed Costs**: ${fmt(fixedCosts.monthly_total_cents || 0)}
- **Monthly Asset Depreciation**: ${fmt(assets.monthly_depreciation_cents || 0)}
- **Total Monthly Fixed**: ${fmt((fixedCosts.monthly_total_cents || 0) + (assets.monthly_depreciation_cents || 0))}

### SERVICES (Configured) - COMPLETE COST BREAKDOWN
${services.map((s: any) => `📊 **${s.name}**
   • Precio: ${fmt(s.current_price_cents || s.price_cents || 0)}
   • Costo fijo (tiempo): ${fmt(s.fixed_cost_cents || 0)}
   • Costo variable (materiales): ${fmt(s.variable_cost_cents || 0)}
   • **Costo total**: ${fmt(s.total_cost_cents || 0)}
   • Ganancia bruta por tratamiento: ${fmt((s.current_price_cents || s.price_cents || 0) - (s.total_cost_cents || 0))}
   • **UTILIDAD/MARKUP: ${s.margin_pct}%**`).join('\n')}

### EXPENSES BY CATEGORY (Last 30 Days)
Total: ${fmt(expenses.total_in_period_cents || 0)} (${expenses.count || 0} registros)
${Object.entries(expenses.by_category || {}).map(([category, amount]: [string, any]) => `- ${category}: ${fmt(amount)}`).join('\n')}

### TOP PERFORMING SERVICES
- **Most Profitable**: ${analytics.top_performers?.most_profitable_service || 'N/A'}
- **Highest Revenue**: ${analytics.top_performers?.most_revenue_service || 'N/A'}
- **Most Frequent**: ${analytics.top_performers?.most_frequent_service || 'N/A'}

### EFFICIENCY METRICS
- **Treatments per Day**: ${analytics.efficiency?.treatments_per_day || 0}
- **Revenue per Hour**: ${fmt(analytics.efficiency?.revenue_per_hour_cents || 0)}
- **Capacity Utilization**: ${analytics.efficiency?.capacity_utilization_pct || 0}%

### TREATMENTS BY SERVICE (Last 30 Days)
${treatments.by_service && treatments.by_service.length > 0
  ? treatments.by_service.map((ts: any) => `- **${ts.service_name}**: ${ts.count} tratamientos, ${fmt(ts.revenue_cents)} ingresos`).join('\n')
  : 'No hay tratamientos registrados en este período.'}

### PATIENT SOURCES (New Patients)
${Object.entries(patients.by_source || {}).map(([source, count]: [string, any]) => `- ${source}: ${count} pacientes`).join('\n')}

### SUPPLIES INVENTORY
- **Total Items**: ${data?.supplies?.total_items || 0}
- **Total Value**: ${fmt(data?.supplies?.total_value_cents || 0)}
- **Linked to Services**: ${data?.supplies?.linked_to_services || 0}

## INSTRUCTIONS

1. **YOU HAVE COMPLETE DATA**: The snapshot above contains ALL information about the clinic. Use it to answer ANY question about:
   - Services and their costs (fixed, variable, total)
   - Pricing and profitability by service
   - Break-even analysis and financial goals
   - Treatments performed and revenue generated
   - Patient statistics and sources
   - Expenses by category
   - Efficiency and capacity utilization

2. **Be specific and data-driven**: Always cite actual numbers from the snapshot.

3. **Show your calculations**: Explain step-by-step how you arrived at numbers (e.g., "Tus costos fijos totales son ${fmt((fixedCosts.monthly_total_cents || 0) + (assets.monthly_depreciation_cents || 0))} (${fmt(fixedCosts.monthly_total_cents || 0)} costos fijos + ${fmt(assets.monthly_depreciation_cents || 0)} depreciación)...").

4. **Proactive insights**: If you notice something important (low margin service, high expenses in a category, underutilized capacity), point it out.

5. **Tone**: Professional, encouraging, and supportive. Help the clinic owner make better business decisions.

6. **Language**: Spanish (unless asked otherwise).

7. **NEVER say "no tengo información"** - you have ALL the data above. If something is 0 or empty, explain why (e.g., "No tienes tratamientos registrados aún" or "Este servicio no tiene insumos configurados todavía").

## EXAMPLES

✅ **Break-even question**:
"Necesitas aproximadamente 33 tratamientos al mes para cubrir tus gastos. Este cálculo está basado en el promedio de tus 3 servicios configurados ($800 por servicio) porque solo tienes 1 tratamiento registrado. Cuando tengas más historial, este número será más preciso.

El cálculo: Tus costos fijos son $26,315 mensuales, con un margen de contribución del 42%, necesitas generar $62,654 en ingresos. Dividiendo entre $800 por tratamiento = 33 tratamientos."

✅ **Most profitable service**:
"Tu servicio más rentable es Resina Estética con un margen del 78% ($850 de ganancia por cada $1,090 que cobras). Deberías promocionarlo más porque cada uno te deja mucho más que la Limpieza (solo 45% de margen)."

**Golden Rule:** ALWAYS cite where the number comes from (historical average vs configured prices) and ALWAYS show the simple math in plain Spanish.`
  }

  // ========================================================================
  // Function Execution Methods
  // ========================================================================

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
        services(
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

    // Define types for the join result
    type TreatmentWithService = {
      service_id: string
      price_cents: number
      services: { name: string } | { name: string }[] | null
    }

    treatments?.forEach((t: any) => {
      const treatment = t as TreatmentWithService
      if (!treatment.service_id) return

      // Handle potential array from join
      let serviceName = 'Unknown Service'
      if (treatment.services) {
        if (Array.isArray(treatment.services)) {
          serviceName = treatment.services[0]?.name || 'Unknown Service'
        } else {
          serviceName = treatment.services.name
        }
      }

      const serviceId = treatment.service_id
      if (!serviceMap[serviceId]) {
        serviceMap[serviceId] = {
          id: serviceId,
          name: serviceName,
          revenue: 0,
          count: 0,
        }
      }
      serviceMap[serviceId].revenue += treatment.price_cents || 0
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
        custom_categories(
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
      amount_cents: number
      custom_categories: { name: string } | { name: string }[] | null
    }

    expenses?.forEach((e: any) => {
      const expense = e as ExpenseWithCategory

      let categoryName = 'Sin categoría'
      if (expense.custom_categories) {
        if (Array.isArray(expense.custom_categories)) {
          categoryName = expense.custom_categories[0]?.name || 'Sin categoría'
        } else {
          categoryName = expense.custom_categories.name
        }
      }

      if (!expensesByCategory[categoryName]) {
        expensesByCategory[categoryName] = { name: categoryName, amount: 0, count: 0 }
      }
      expensesByCategory[categoryName].amount += expense.amount_cents || 0
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