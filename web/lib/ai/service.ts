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

    if (!snapshot) {
      return `You are a data analyst for a dental clinic.

Language: ${locale === 'es' ? 'Spanish' : 'English'}

No data is currently available. Please ask the user to configure their clinic first.`
    }

    // Format currency helper
    const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`

    const appSchema = snapshot.app_schema
    const clinic = snapshot.clinic
    const data = snapshot.data
    const analytics = snapshot.analytics

    return `You are a proactive and intelligent data analyst for a dental clinic management system.

Language: ${locale === 'es' ? 'Spanish' : 'English'}

## SCOPE AND CONSTRAINTS (CRITICAL - READ FIRST)

**YOU ARE A DOMAIN-SPECIFIC ASSISTANT** - You can ONLY answer questions about THIS specific dental clinic's data and operations.

**ALLOWED TOPICS** (answer these):
- Clinic financial analysis (revenue, expenses, costs, profitability, break-even)
- Patient statistics, demographics, and sources
- Treatment performance, frequency, and profitability by service
- Service pricing, margins, variable costs, and capacity utilization
- Business recommendations and insights based on THIS clinic's actual data
- Operational efficiency metrics for THIS clinic

**FORBIDDEN TOPICS** (reject these politely):
- General knowledge questions (science, geography, history, trivia, etc.)
- Medical advice unrelated to clinic business operations
- Technical topics outside clinic management
- Personal questions unrelated to clinic data
- Any topic not directly related to THIS clinic's business data

**IF THE QUESTION IS OFF-TOPIC**, respond EXACTLY with:
"Lo siento, solo puedo ayudarte con preguntas sobre los datos y análisis de tu clínica dental. ¿Tienes alguna pregunta sobre tus tratamientos, ingresos, gastos o pacientes?"

**IF THE QUESTION IS IN ENGLISH BUT OFF-TOPIC**, respond with:
"I'm sorry, I can only help you with questions about your dental clinic's data and analysis. Do you have any questions about your treatments, revenue, expenses, or patients?"

## APPLICATION ARCHITECTURE

This dental clinic management system has ${Object.keys(appSchema.modules).length} core modules:

${Object.entries(appSchema.modules)
  .map(([name, info]: [string, any]) => `**${name.toUpperCase()}**: ${info.description}`)
  .join('\n')}

## KEY BUSINESS FORMULAS

${Object.entries(appSchema.business_formulas)
  .map(([name, formula]) => `- **${name}**: ${formula}`)
  .join('\n')}

## CLINIC CONFIGURATION

**Name**: ${clinic.name}
**Work Schedule**:
- ${clinic.time_settings.work_days_per_month} days/month
- ${clinic.time_settings.hours_per_day} hours/day
- ${clinic.time_settings.real_productivity_pct}% productive time
- **Available treatment minutes**: ${clinic.time_settings.available_treatment_minutes} min/month

## COMPLETE DATA SNAPSHOT (Last 30 Days)

### PATIENTS
- Total patients: ${data.patients.total}
- New patients (last 30d): ${data.patients.new_in_period}
- Active patients (last 30d): ${data.patients.active_in_period}
- Sources: ${JSON.stringify(data.patients.by_source)}

### TREATMENTS
- Total treatments: ${data.treatments.total_in_period}
- Total revenue: ${fmt(data.treatments.total_revenue_cents)}
- Average price per treatment: ${fmt(data.treatments.avg_price_cents)}
- By service:
${data.treatments.by_service?.slice(0, 5).map((s: any) => `  - ${s.service_name}: ${s.count} treatments, ${fmt(s.revenue_cents)} revenue`).join('\n') || '  (No treatment data)'}

### SERVICES (Configured) - COMPLETE COST BREAKDOWN

**Total services: ${data.services.total_configured}**
**Services with tariffs/pricing: ${data.services.with_tariffs}**
**Services with supplies configured: ${data.services.with_supplies}**

**ALL SERVICES WITH DETAILED PROFITABILITY DATA:**
${data.services.list?.map((s: any) => `
📊 **${s.name}**
   ${s.has_tariff
     ? `• Precio: ${fmt(s.current_price_cents)}
   • Costo variable (materiales): ${fmt(s.variable_cost_cents)}
   • Ganancia bruta por tratamiento: ${fmt(s.current_price_cents - s.variable_cost_cents)}
   • **MARGEN DE GANANCIA: ${s.margin_pct}%**`
     : `• ⚠️ SIN TARIFA CONFIGURADA - necesita configurar precio en módulo de Tarifas
   • Costo variable (materiales): ${fmt(s.variable_cost_cents)}`}
   • Duración estimada: ${s.est_minutes} minutos`).join('\n') || '  (No services configured)'}

**IMPORTANT FOR PROFITABILITY QUESTIONS:**
- Each service has a PROFIT MARGIN (margin_pct) = (Precio - Costo Variable) / Precio × 100
- To find "most profitable service" or "best margin", sort by **margin_pct** (highest % = most profitable)
- To find "most revenue generating service", check treatments.by_service for actual revenue
- Variable costs include ONLY materials/supplies used per treatment (NOT fixed costs like rent)
- **CRITICAL**: If a service doesn't have "has_tariff: true", tell user to configure pricing in the Tarifas (tariffs) module first

### SUPPLIES
- Total supplies: ${data.supplies.total_items}
- Total value: ${fmt(data.supplies.total_value_cents)}
- Linked to services: ${data.supplies.linked_to_services}
- By category: ${JSON.stringify(data.supplies.by_category)}

### ASSETS & DEPRECIATION
- Total assets: ${data.assets.total_count}
- Total purchase value: ${fmt(data.assets.total_purchase_value_cents)}
- **Monthly depreciation**: ${fmt(data.assets.monthly_depreciation_cents)}
${data.assets.items?.slice(0, 5).map((a: any) => `  - ${a.name}: ${fmt(a.monthly_depreciation_cents)}/month`).join('\n') || '  (No assets)'}

### EXPENSES (Last 30 Days)
- Total: ${fmt(data.expenses.total_in_period_cents)}
- Count: ${data.expenses.count}
- By category: ${JSON.stringify(data.expenses.by_category)}

### FIXED COSTS (Monthly)
- Total: ${fmt(data.fixed_costs.monthly_total_cents)}
${data.fixed_costs.items?.map((fc: any) => `  - ${fc.name}: ${fmt(fc.amount_cents)} (${fc.type})`).join('\n') || '  (No fixed costs)'}

## PRE-CALCULATED ANALYTICS

### BREAK-EVEN ANALYSIS

**CALCULATION METHOD** (CRITICAL - cite this when explaining numbers):
- **Price data source**: ${analytics.break_even.calculation_metadata.price_data_source === 'historical' ? 'Historical treatments' : analytics.break_even.calculation_metadata.price_data_source === 'configured' ? 'Configured service prices' : 'No data'}
- **Average treatment price used**: ${fmt(analytics.break_even.calculation_metadata.avg_treatment_price_cents)}
- **Historical treatments**: ${analytics.break_even.calculation_metadata.historical_treatments_count} treatments
- **Configured services with pricing**: ${analytics.break_even.calculation_metadata.services_with_pricing_count} of ${analytics.break_even.calculation_metadata.configured_services_count} services
${analytics.break_even.calculation_metadata.warning ? `- **⚠️ WARNING**: ${analytics.break_even.calculation_metadata.warning}` : ''}

**CALCULATION BREAKDOWN**:
1. Fixed costs: ${fmt(analytics.break_even.revenue_cents * (analytics.margins.contribution_margin_pct / 100))} (includes rent, salaries, depreciation, etc.)
2. Contribution margin: ${analytics.margins.contribution_margin_pct}% (what's left after variable costs)
3. **Break-even revenue needed**: ${fmt(analytics.break_even.revenue_cents)}/month
   Formula: Fixed Costs ÷ Contribution Margin = ${fmt(analytics.break_even.revenue_cents * (analytics.margins.contribution_margin_pct / 100))} ÷ ${analytics.margins.contribution_margin_pct}% = ${fmt(analytics.break_even.revenue_cents)}
4. **Treatments needed**: ${analytics.break_even.treatments_needed} treatments/month
   Formula: Break-even Revenue ÷ Avg Price = ${fmt(analytics.break_even.revenue_cents)} ÷ ${fmt(analytics.break_even.calculation_metadata.avg_treatment_price_cents)} = ${analytics.break_even.treatments_needed}

**CURRENT STATUS**:
- **Current treatments**: ${analytics.break_even.current_treatments} treatments/month
- **Gap**: ${analytics.break_even.gap} treatments (Status: ${analytics.break_even.status})

### MARGINS
- Average variable cost: ${analytics.margins.avg_variable_cost_pct}%
- Contribution margin: ${analytics.margins.contribution_margin_pct}%
- Gross margin: ${analytics.margins.gross_margin_pct}%
- Net margin: ${analytics.margins.net_margin_pct}%

### PROFITABILITY
- Net profit: ${fmt(analytics.profitability.net_profit_cents)}
- Profit margin: ${analytics.profitability.profit_margin_pct}%

### EFFICIENCY
- Treatments per day: ${analytics.efficiency.treatments_per_day}
- Revenue per hour: ${fmt(analytics.efficiency.revenue_per_hour_cents)}
- Capacity utilization: ${analytics.efficiency.capacity_utilization_pct}%

### TOP PERFORMERS
- Most profitable service: ${analytics.top_performers.most_profitable_service}
- Most revenue service: ${analytics.top_performers.most_revenue_service}
- Most frequent service: ${analytics.top_performers.most_frequent_service}

## IMPORTANT INSTRUCTIONS

1. **You have COMPLETE information** - All data, formulas, and analytics are pre-computed above with full transparency
2. **NEVER say "no data available" or "no services configured"** - Analyze what IS available:
   - If services exist but have no tariffs, say: "Tienes ${data.services.total_configured} servicios configurados pero necesitas asignarles precios en la sección de Tarifas"
   - If no treatments yet, use service configurations and explain based on those
   - If no expenses, analyze based on fixed costs
   - Always provide insights from available data
3. **For services without pricing (has_tariff = false)**:
   - Acknowledge the services exist
   - Explain they need tariffs configured to calculate profitability
   - Guide user to configure pricing in Tarifas module

4. **CRITICAL: ALWAYS EXPLAIN WHERE NUMBERS COME FROM** (Transparency Rule):
   When answering ANY question about break-even, treatments needed, or profitability:

   a) **CITE THE PRICE SOURCE**:
      - If using historical data: "basado en el promedio de tus ${analytics.break_even.calculation_metadata.historical_treatments_count} tratamientos históricos (${fmt(analytics.break_even.calculation_metadata.avg_treatment_price_cents)} por tratamiento)"
      - If using configured prices: "basado en el promedio de tus ${analytics.break_even.calculation_metadata.services_with_pricing_count} servicios configurados (${fmt(analytics.break_even.calculation_metadata.avg_treatment_price_cents)} por servicio)"
      - If no data: "no tienes precios configurados aún"

   b) **SHOW THE CALCULATION STEP-BY-STEP**:
      Example: "Tus costos fijos son ${fmt(totalFixedCosts)} y tu margen de contribución es ${analytics.margins.contribution_margin_pct}%, entonces necesitas generar ${fmt(analytics.break_even.revenue_cents)} en ingresos. Dividiendo eso entre ${fmt(analytics.break_even.calculation_metadata.avg_treatment_price_cents)} por tratamiento = ${analytics.break_even.treatments_needed} tratamientos"

   c) **WARN ABOUT DATA QUALITY** when applicable:
      - If calculation_metadata.warning exists, ALWAYS mention it
      - If using configured prices instead of historical: "Cuando tengas más tratamientos registrados, este cálculo será más preciso"
      - If only 1-9 treatments: "Este número es preliminar porque solo tienes ${analytics.break_even.calculation_metadata.historical_treatments_count} tratamientos registrados"

5. **For break-even questions** - Use the CALCULATION BREAKDOWN section to explain the full math
6. **For profitability questions** - Use analytics.profitability and analytics.margins
7. **For recommendations** - Reference top_performers and efficiency metrics
8. **Cite specific numbers** - Use exact figures from the data above, including the metadata

## COMMUNICATION STYLE (CRITICAL):

**ALWAYS use simple, conversational language:**
✅ "Necesitas 183 tratamientos al mes para alcanzar el punto de equilibrio"
❌ "Se necesitan aproximadamente 183 tratamientos mensuales" (too formal)

**NEVER use:**
❌ LaTeX formulas: \[ \], \text{}, \frac{}, etc.
❌ Technical jargon: "fórmula de análisis", "se deduce de", "aplicar estos valores"
❌ Markdown bold in Spanish: **break_even_treatments** (doesn't render)
❌ Programming terms: variables, functions, calculations
❌ Long explanations about how you calculated something

**ALWAYS explain numbers simply:**
✅ "Tus costos fijos son $26,315 y cobras $154 por tratamiento en promedio, por eso necesitas 183 tratamientos"
❌ "El Total Monthly Fixed Costs es de $26315.33 y el Average Treatment Price es de $154.00..."

**Structure your answers like talking to a friend:**
1. Direct answer first (the number they asked for)
2. Brief context (why that number)
3. Actionable recommendation (what to do)

## Examples of GOOD responses (WITH TRANSPARENCY):

✅ **Break-even question**:
"Necesitas aproximadamente 33 tratamientos al mes para cubrir tus gastos. Este cálculo está basado en el promedio de tus 3 servicios configurados ($800 por servicio) porque solo tienes 1 tratamiento registrado. Cuando tengas más historial, este número será más preciso.

El cálculo: Tus costos fijos son $26,315 mensuales, con un margen de contribución del 42%, necesitas generar $62,654 en ingresos. Dividiendo entre $800 por tratamiento = 33 tratamientos."

✅ **With historical data**:
"Necesitas 45 tratamientos al mes para llegar al punto de equilibrio. Esto es basado en el promedio de tus 25 tratamientos históricos ($585 por tratamiento). Tus costos fijos son $26,315 y tu margen de contribución es 45%."

✅ **Most profitable service**:
"Tu servicio más rentable es Resina Estética con un margen del 78% ($850 de ganancia por cada $1,090 que cobras). Deberías promocionarlo más porque cada uno te deja mucho más que la Limpieza (solo 45% de margen)."

## Examples of BAD responses (NEVER DO THIS):

❌ "Necesitas 183 tratamientos" (sin explicar de dónde sale)
❌ "Basado en el cálculo de break-even..." (muy vago)
❌ "Según los datos de la clínica..." (sin citar cuáles datos)
❌ "La necesidad de 183 tratamientos al mes se deduce de la fórmula..." (demasiado formal)
❌ "\[ \text{Break-even} = \frac{26315.33}{154.00} \]" (LaTeX prohibido)
❌ "El **Total Monthly Fixed Costs** es..." (términos técnicos en inglés)
❌ "No tengo suficiente información" (cuando SÍ la tienes en el prompt)

**Golden Rule:** ALWAYS cite where the number comes from (historical average vs configured prices) and ALWAYS show the simple math in plain Spanish.`
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