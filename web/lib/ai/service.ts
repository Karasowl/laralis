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
  ActionExecutor,
  ActionType,
  ActionParams,
  ActionResult,
  ActionContext,
} from './types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AIProviderFactory } from './factory'
import { ClinicSnapshotService } from './ClinicSnapshotService'

export class AIService implements ActionExecutor {
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

## ⚠️ CRITICAL CONCEPTS (READ CAREFULLY)

### 1. MARGIN VS MARKUP

**CRITICAL CLARIFICATION**: The field called "margin_pct" in this system is actually **MARKUP**, not margin.

**Difference**:
- **MARGIN** = (Price - Cost) / Price × 100  (percentage of price)
- **MARKUP** = (Price - Cost) / Cost × 100   (percentage of cost) ← **THIS IS WHAT WE USE**

**Example**:
- Cost: $100, Price: $150
- **Margin**: 33.3% (50/150)
- **MARKUP**: 50% (50/100) ← **What you see in the data as "margin_pct"**

**How to explain to users**:
✅ "Tu servicio tiene una UTILIDAD del 50% sobre el costo"
✅ "Por cada $100 que te cuesta, ganas $50"
✅ "Tu markup es 50%, tu margen real es 33%"
❌ "Tu margen es 50%" (confusing - be precise)

### 2. FIXED COSTS = MANUAL + DEPRECIATION

**CRITICAL**: Fixed costs in this system = Manual fixed costs + Asset depreciation

**Why depreciation is a fixed cost**:
- Assets (chairs, equipment, etc.) lose value over time
- This depreciation is spread monthly: purchase_price / depreciation_months
- Example: Chair costs $12,000, depreciates over 60 months = $200/month
- This $200/month is ALWAYS paid (it's the "cost" of using the asset)

**When explaining costs to users**:
✅ "Tus costos fijos totales son ${fmt((fixedCosts.monthly_total_cents || 0) + (assets.monthly_depreciation_cents || 0))} mensuales: ${fmt(fixedCosts.monthly_total_cents || 0)} en gastos fijos como renta y salarios, más ${fmt(assets.monthly_depreciation_cents || 0)} en depreciación de tus equipos"
❌ "Tus costos fijos son ${fmt(fixedCosts.monthly_total_cents || 0)}" (missing depreciation!)

### 3. VARIABLE COSTS FOR BREAK-EVEN

**CRITICAL**: DO NOT confuse variable costs with expenses!

**Variable costs** (for break-even calculation):
- Calculated from SERVICES table: SUM(supply.cost_per_portion × service_supplies.qty)
- These are direct MATERIAL costs (amalgam, cement, etc.)
- Tied directly to each treatment performed
- Used in formula: Variable Cost % = Total Variable / Total Revenue × 100

**Expenses** (tracked separately):
- Operational expenses from expenses table (rent, utilities, supplies purchases, etc.)
- May include BOTH fixed and variable costs
- Used for: Net profit calculation, NOT break-even
- Formula: Net Profit = Revenue - Total Expenses

**When user asks about costs**:
- "¿Cuál es mi costo variable?" → Use service variable costs (materials per treatment)
- "¿Cuánto gasté este mes?" → Use expenses table
- "¿Cuánto necesito vender para break-even?" → Use service variable costs

### 4. TARIFFS TABLE IS DEPRECATED

**IMPORTANT ARCHITECTURAL CHANGE** (v3):
- OLD: Services → Tariffs (versioned prices) → Treatments
- CURRENT: Services (price_cents + discounts) → Treatments
- Tariffs table is **DEPRECATED** (kept for audit only)

**When user asks about "tarifas"**:
✅ "Los precios ahora se configuran directamente en los servicios. Puedes verlos y editarlos en la página de Servicios."
❌ "No encuentro información de tarifas" (confusing)

## CLINIC CONFIGURATION

**Name**: ${clinic.name || 'Dental Clinic'}
**Work Schedule**:
- ${clinic.time_settings?.work_days_per_month || 22} days/month
- ${clinic.time_settings?.hours_per_day || 8} hours/day
- ${clinic.time_settings?.real_productivity_pct || 80}% productive time
- **Available treatment minutes**: ${clinic.time_settings?.available_treatment_minutes || 0} min/month

**How these are calculated**:
\`\`\`
Total minutes = ${clinic.time_settings?.work_days_per_month || 22} days * ${clinic.time_settings?.hours_per_day || 8} hours * 60 = ${(clinic.time_settings?.work_days_per_month || 22) * (clinic.time_settings?.hours_per_day || 8) * 60} min/month
Effective minutes = Total * (${clinic.time_settings?.real_productivity_pct || 80}% / 100) = ${clinic.time_settings?.available_treatment_minutes || 0} min/month
Fixed cost per minute = Total Fixed Costs / Effective minutes = ${fmt((fixedCosts.monthly_total_cents || 0) + (assets.monthly_depreciation_cents || 0))} / ${clinic.time_settings?.available_treatment_minutes || 0} = ${fmt(Math.round(((fixedCosts.monthly_total_cents || 0) + (assets.monthly_depreciation_cents || 0)) / (clinic.time_settings?.available_treatment_minutes || 1)))} per minute
\`\`\`

**Real productivity note**: ${clinic.time_settings?.real_productivity_pct || 80}% means not all work hours are billable (breaks, admin, cleaning). This is realistic.

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

**⚠️ DATA SOURCE (IMPORTANT)**:
- Price source: ${analytics.break_even?.calculation_metadata?.price_data_source || 'unknown'}
- Historical treatments: ${analytics.break_even?.calculation_metadata?.historical_treatments_count || 0}
- Configured services: ${analytics.break_even?.calculation_metadata?.configured_services_count || 0}
- Services with pricing: ${analytics.break_even?.calculation_metadata?.services_with_pricing_count || 0}
${analytics.break_even?.calculation_metadata?.warning ? `- ⚠️ WARNING: ${analytics.break_even?.calculation_metadata?.warning}` : ''}

**What this means**:
- If "historical": Average price is from ACTUAL treatments (reliable)
- If "configured": Average is from service prices (approximate - warn user)
- ALWAYS mention the data source when explaining break-even!

### MARGINS & COSTS
- **Average Variable Cost**: ${analytics.margins?.avg_variable_cost_pct || 0}%
- **Contribution Margin**: ${analytics.margins?.contribution_margin_pct || 0}%
- **Monthly Fixed Costs**: ${fmt(fixedCosts.monthly_total_cents || 0)}
- **Monthly Asset Depreciation**: ${fmt(assets.monthly_depreciation_cents || 0)}
- **Total Monthly Fixed**: ${fmt((fixedCosts.monthly_total_cents || 0) + (assets.monthly_depreciation_cents || 0))}

### SERVICES (Configured) - COMPLETE COST BREAKDOWN

⚠️ **REMEMBER**: "UTILIDAD/MARKUP" below is calculated as (Price - Cost) / Cost × 100
This is MARKUP, not margin. When explaining, use "utilidad" or clarify "markup del X%, margen real del Y%".

**PRICING FORMULA FOR EACH SERVICE**:
1. Fixed cost = est_minutes × fixed_cost_per_minute
2. Variable cost = SUM(supply_cost_per_portion × quantity)
3. Total cost = fixed + variable
4. Price before discount = total_cost × (1 + markup_pct/100)
5. Final price = price_before_discount - discount (if any)

${services.map((s: any) => {
  const price = s.current_price_cents || s.price_cents || 0;
  const totalCost = s.total_cost_cents || 0;
  const profit = price - totalCost;
  const trueMargin = price > 0 ? Math.round((profit / price) * 100 * 100) / 100 : 0;

  return `📊 **${s.name}**
   • Duración estimada: ${s.est_minutes || 0} minutos
   • Costo fijo (tiempo): ${fmt(s.fixed_cost_cents || 0)}
   • Costo variable (${s.supplies_count || 0} insumos): ${fmt(s.variable_cost_cents || 0)}
   • **Costo total**: ${fmt(totalCost)}
   • Precio final: ${fmt(price)}
   • Ganancia bruta: ${fmt(profit)}
   • **MARKUP (utilidad sobre costo): ${s.margin_pct}%**
   • **MARGEN REAL (sobre precio): ${trueMargin}%**
   ${s.has_pricing ? '✅ Precio configurado' : '⚠️ Sin precio configurado'}`
}).join('\n\n')}

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

## BUSINESS FORMULAS (QUICK REFERENCE)

**Service Pricing**:
\`\`\`
Price = (Fixed Cost + Variable Cost) * (1 + Markup%)
Where:
  Fixed Cost = Minutes * Fixed Cost Per Minute
  Variable Cost = SUM(Supply portions * Cost per portion)
\`\`\`

**Break-Even**:
\`\`\`
Break-even Revenue = Total Fixed Costs / (Contribution Margin % / 100)
Break-even Treatments = Break-even Revenue / Average Treatment Price
Where:
  Contribution Margin % = 100% - Variable Cost %
  Variable Cost % = (Total Variable / Total Revenue) * 100
\`\`\`

**Profitability**:
\`\`\`
Net Profit = Total Revenue - Total Expenses
Profit Margin % = (Net Profit / Total Revenue) * 100
Markup % = (Price - Cost) / Cost * 100
True Margin % = (Price - Cost) / Price * 100
\`\`\`

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

3. **Show your calculations**: Explain step-by-step how you arrived at numbers. Example: "Tus costos fijos totales son ${fmt((fixedCosts.monthly_total_cents || 0) + (assets.monthly_depreciation_cents || 0))} (${fmt(fixedCosts.monthly_total_cents || 0)} en gastos fijos + ${fmt(assets.monthly_depreciation_cents || 0)} en depreciación de equipos)".

4. **Use correct terminology**:
   - Say "UTILIDAD" or "MARKUP" (not "margen" alone)
   - Clarify: "Tu markup es X%, tu margen real es Y%"
   - Always mention data source for break-even (historical vs configured)

5. **Proactive insights**: If you notice something important (low margin service, high expenses in a category, underutilized capacity), point it out.

6. **Tone**: Professional, encouraging, and supportive. Help the clinic owner make better business decisions.

7. **Language**: Spanish (unless asked otherwise).

8. **NEVER say "no tengo información"** - you have ALL the data above. If something is 0 or empty, explain why (e.g., "No tienes tratamientos registrados aún" or "Este servicio no tiene insumos configurados todavía").

## ACTIONS - WHAT YOU CAN DO 🎯

**NEW CAPABILITY**: You can now execute actions on behalf of the user! When you identify an opportunity to help, you can suggest and execute actions.

**Available Actions**:
1. **update_service_price** - Change a service price
2. **adjust_service_margin** - Adjust service margin (markup) to hit a target
3. **simulate_price_change** - Run what-if scenarios for price changes
4. **create_expense** - Record a new expense
5. **update_time_settings** - Adjust work schedule and productivity settings

**When to Suggest Actions**:
- User explicitly asks you to do something ("Actualiza el precio de X", "Aumenta el margen de Y")
- You detect a clear opportunity ("Este servicio tiene margen negativo, ¿quieres que lo ajuste?")
- User is exploring scenarios ("¿Qué pasaría si subo todos los precios 10%?")

**How to Suggest Actions** (IMPORTANT):
1. **Explain first**: Always explain what you're going to do and why
2. **Show impact**: Calculate and show the expected impact before executing
3. **Ask permission**: Unless user explicitly said "hazlo" or "actualízalo", ask first
4. **Be specific**: Use actual service IDs, amounts, and dates from the data

**Action Suggestion Format**:
When you want to suggest an action, structure your response like this:

\`\`\`
[Explain the situation and your analysis]

💡 SUGERENCIA DE ACCIÓN:
Tipo: [action name]
Qué haré: [Clear description]
Impacto esperado:
  - [metric 1]: de [current] a [new] ([change %])
  - [metric 2]: de [current] a [new] ([change %])

¿Quieres que ejecute esta acción? (Responde "sí" para continuar)
\`\`\`

**Example Action Suggestion**:
"Veo que tu servicio 'Limpieza Dental' tiene un markup muy bajo (15%) comparado con el promedio del mercado (50-70%).

💡 SUGERENCIA DE ACCIÓN:
Tipo: adjust_service_margin
Qué haré: Ajustar el precio de 'Limpieza Dental' para lograr un markup del 50%
Impacto esperado:
  - Precio actual: $290
  - Precio propuesto: $450
  - Ganancia por servicio: de $40 a $200 (+400%)
  - Si mantienes 15 limpiezas/mes: ingresos adicionales de $2,400/mes

¿Quieres que ejecute este ajuste de precio?"

## EXAMPLES

✅ **Break-even question with DATA SOURCE clarification**:
"Necesitas aproximadamente 33 tratamientos al mes para cubrir tus gastos.

⚠️ NOTA IMPORTANTE: Este cálculo está basado en el promedio de tus 3 servicios configurados ($800 por servicio) porque solo tienes 1 tratamiento registrado. Cuando tengas más historial (mínimo 10 tratamientos), este número será más preciso.

📊 EL CÁLCULO:
1. Tus costos fijos totales: $26,315 (gastos fijos) + $3,200 (depreciación) = $29,515/mes
2. Tu margen de contribución: 42% (cada peso que cobras, $0.42 queda para cubrir fijos)
3. Break-even revenue: $29,515 ÷ 0.42 = $70,274
4. Break-even treatments: $70,274 ÷ $800 promedio = 33 tratamientos

Actualmente tienes 28 tratamientos, te faltan 5 más."

✅ **Most profitable service with MARKUP clarification**:
"Tu servicio más rentable es Resina Estética:

📊 NÚMEROS:
- Costo total: $300 (tiempo $200 + materiales $100)
- Precio: $850
- Ganancia: $550

💰 RENTABILIDAD:
- **Utilidad (markup)**: 183% ($550/$300)
- **Margen real**: 65% ($550/$850)

Esto significa que por cada peso que inviertes en este servicio, ganas $1.83.

En comparación, tu Limpieza solo tiene 45% de utilidad ($200 costo → $290 precio). Definitivamente deberías promocionar más la Resina porque te deja mucho más dinero."

✅ **Cost explanation with FIXED + DEPRECIATION**:
"Tus costos fijos mensuales son $29,515 en total:
- $26,315 en gastos operativos (renta, salarios, servicios)
- $3,200 en depreciación de equipos (desgaste de tus activos)

La depreciación es un costo fijo porque aunque no lo pagues en efectivo cada mes, es el costo de 'usar' tus equipos. Por ejemplo, tu silla dental de $60,000 se deprecia en 5 años, eso son $1,000/mes de 'costo' invisible."

**Golden Rule:** ALWAYS cite where numbers come from (historical vs configured), ALWAYS clarify markup vs margin, and ALWAYS show the simple math in plain Spanish.`
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

  // ========================================================================
  // Actions System - Execute Business Actions
  // ========================================================================

  /**
   * Execute an action
   * Main entry point for all actions execution
   */
  async execute<T extends ActionType>(
    action: T,
    params: ActionParams[T],
    context: ActionContext
  ): Promise<ActionResult> {
    const { clinicId, userId, supabase, dryRun = false } = context

    try {
      // Validate parameters first
      const validation = await this.validate(action, params, context)
      if (!validation.valid) {
        return {
          success: false,
          action,
          params,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid parameters',
            details: validation.errors,
          },
          executed_at: new Date().toISOString(),
          executed_by: userId,
        }
      }

      // Execute based on action type
      let result: ActionResult

      switch (action) {
        case 'update_service_price':
          result = await this.executeUpdateServicePrice(
            params as ActionParams['update_service_price'],
            context
          )
          break

        case 'adjust_service_margin':
          result = await this.executeAdjustServiceMargin(
            params as ActionParams['adjust_service_margin'],
            context
          )
          break

        case 'simulate_price_change':
          result = await this.executeSimulatePriceChange(
            params as ActionParams['simulate_price_change'],
            context
          )
          break

        case 'create_expense':
          result = await this.executeCreateExpense(
            params as ActionParams['create_expense'],
            context
          )
          break

        case 'update_time_settings':
          result = await this.executeUpdateTimeSettings(
            params as ActionParams['update_time_settings'],
            context
          )
          break

        default:
          return {
            success: false,
            action,
            params,
            error: {
              code: 'UNKNOWN_ACTION',
              message: `Unknown action type: ${action}`,
            },
            executed_at: new Date().toISOString(),
            executed_by: userId,
          }
      }

      // Log action if not dry run
      if (!dryRun && result.success) {
        await this.logAction(result, context)
      }

      return result
    } catch (error: any) {
      console.error(`[AIService] Error executing action ${action}:`, error)
      return {
        success: false,
        action,
        params,
        error: {
          code: 'EXECUTION_ERROR',
          message: error.message || 'Unknown error occurred',
          details: error,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }
  }

  /**
   * Validate action parameters before execution
   */
  async validate<T extends ActionType>(
    action: T,
    params: ActionParams[T],
    context: ActionContext
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = []

    try {
      switch (action) {
        case 'update_service_price': {
          const p = params as ActionParams['update_service_price']
          if (!p.service_id) errors.push('service_id is required')
          if (p.new_price_cents <= 0) errors.push('new_price_cents must be positive')

          // Check if service exists
          const { data: service, error } = await context.supabase
            .from('services')
            .select('id')
            .eq('id', p.service_id)
            .eq('clinic_id', context.clinicId)
            .single()

          if (error || !service) {
            errors.push(`Service ${p.service_id} not found in clinic ${context.clinicId}`)
          }
          break
        }

        case 'adjust_service_margin': {
          const p = params as ActionParams['adjust_service_margin']
          if (!p.service_id) errors.push('service_id is required')
          if (p.target_margin_pct < 0) errors.push('target_margin_pct must be non-negative')
          if (p.target_margin_pct > 1000)
            errors.push('target_margin_pct seems too high (max 1000%)')

          // Check if service exists
          const { data: service, error } = await context.supabase
            .from('services')
            .select('id')
            .eq('id', p.service_id)
            .eq('clinic_id', context.clinicId)
            .single()

          if (error || !service) {
            errors.push(`Service ${p.service_id} not found`)
          }
          break
        }

        case 'simulate_price_change': {
          const p = params as ActionParams['simulate_price_change']
          if (!['percentage', 'fixed'].includes(p.change_type)) {
            errors.push('change_type must be "percentage" or "fixed"')
          }
          if (p.change_value === undefined || p.change_value === null) {
            errors.push('change_value is required')
          }
          break
        }

        case 'create_expense': {
          const p = params as ActionParams['create_expense']
          if (p.amount_cents <= 0) errors.push('amount_cents must be positive')
          if (!p.category_id) errors.push('category_id is required')
          if (!p.description) errors.push('description is required')
          if (!p.expense_date) errors.push('expense_date is required')

          // Validate date format
          if (p.expense_date && isNaN(Date.parse(p.expense_date))) {
            errors.push('expense_date must be a valid ISO date')
          }

          // Check if category exists
          const { data: category, error } = await context.supabase
            .from('custom_categories')
            .select('id')
            .eq('id', p.category_id)
            .eq('clinic_id', context.clinicId)
            .single()

          if (error || !category) {
            errors.push(`Category ${p.category_id} not found`)
          }
          break
        }

        case 'update_time_settings': {
          const p = params as ActionParams['update_time_settings']
          if (p.work_days && (p.work_days < 1 || p.work_days > 31)) {
            errors.push('work_days must be between 1 and 31')
          }
          if (p.hours_per_day && (p.hours_per_day < 1 || p.hours_per_day > 24)) {
            errors.push('hours_per_day must be between 1 and 24')
          }
          if (
            p.real_productivity_pct &&
            (p.real_productivity_pct < 1 || p.real_productivity_pct > 100)
          ) {
            errors.push('real_productivity_pct must be between 1 and 100')
          }
          break
        }

        default:
          errors.push(`Unknown action type: ${action}`)
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      }
    } catch (error: any) {
      console.error(`[AIService] Error validating action ${action}:`, error)
      return {
        valid: false,
        errors: [error.message || 'Validation error'],
      }
    }
  }

  /**
   * Get action logs for audit
   */
  /**
   * Get action logs for audit
   * Retrieves historical action logs with optional filtering
   */
  async getActionHistory(
    clinicId: string,
    filters?: {
      action?: ActionType
      userId?: string
      startDate?: string
      endDate?: string
    }
  ): Promise<ActionResult[]> {
    // Note: This method requires a Supabase client to be passed
    // For now, we'll return empty array as this is typically called from API routes
    // that have their own Supabase client
    console.warn(
      '[AIService] getActionHistory called without Supabase client. Use API route instead.'
    )
    return []
  }

  /**
   * Get action logs for audit (with Supabase client)
   * Retrieves historical action logs with optional filtering
   */
  async getActionHistoryWithClient(
    supabase: SupabaseClient,
    clinicId: string,
    filters?: {
      action?: ActionType
      userId?: string
      startDate?: string
      endDate?: string
    }
  ): Promise<ActionResult[]> {
    try {
      let query = supabase
        .from('action_logs')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('executed_at', { ascending: false })

      // Apply filters
      if (filters?.action) {
        query = query.eq('action_type', filters.action)
      }

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId)
      }

      if (filters?.startDate) {
        query = query.gte('executed_at', filters.startDate)
      }

      if (filters?.endDate) {
        query = query.lte('executed_at', filters.endDate)
      }

      const { data: logs, error } = await query.limit(100) // Limit to prevent huge queries

      if (error) {
        console.error('[AIService] Error fetching action history:', error)
        return []
      }

      // Transform database records to ActionResult format
      return (
        logs?.map(log => ({
          success: log.success,
          action: log.action_type as ActionType,
          params: log.params,
          result: log.result,
          error: log.error_code
            ? {
                code: log.error_code,
                message: log.error_message,
                details: log.error_details,
              }
            : undefined,
          executed_at: log.executed_at,
          executed_by: log.user_id,
        })) || []
      )
    } catch (error) {
      console.error('[AIService] Unexpected error fetching action history:', error)
      return []
    }
  }

  // ========================================================================
  // Action Executors - Private Methods
  // ========================================================================

  /**
   * Execute: Update service price
   */
  private async executeUpdateServicePrice(
    params: ActionParams['update_service_price'],
    context: ActionContext
  ): Promise<ActionResult> {
    const { supabase, clinicId, userId, dryRun } = context
    const { service_id, new_price_cents, reason } = params

    try {
      // Get current service data
      const { data: serviceBefore, error: fetchError } = await supabase
        .from('services')
        .select('*')
        .eq('id', service_id)
        .eq('clinic_id', clinicId)
        .single()

      if (fetchError || !serviceBefore) {
        return {
          success: false,
          action: 'update_service_price',
          params,
          error: {
            code: 'SERVICE_NOT_FOUND',
            message: `Service ${service_id} not found`,
            details: fetchError,
          },
          executed_at: new Date().toISOString(),
          executed_by: userId,
        }
      }

      // If dry run, just return what would change
      if (dryRun) {
        return {
          success: true,
          action: 'update_service_price',
          params,
          result: {
            before: {
              price_cents: serviceBefore.price_cents,
            },
            after: {
              price_cents: new_price_cents,
            },
            changes: [
              `Price would change from $${(serviceBefore.price_cents / 100).toFixed(2)} to $${(new_price_cents / 100).toFixed(2)}`,
              reason ? `Reason: ${reason}` : '',
            ].filter(Boolean),
          },
          executed_at: new Date().toISOString(),
          executed_by: userId,
        }
      }

      // Execute the update
      const { data: serviceAfter, error: updateError } = await supabase
        .from('services')
        .update({
          price_cents: new_price_cents,
          updated_at: new Date().toISOString(),
        })
        .eq('id', service_id)
        .eq('clinic_id', clinicId)
        .select()
        .single()

      if (updateError) {
        return {
          success: false,
          action: 'update_service_price',
          params,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Failed to update service price',
            details: updateError,
          },
          executed_at: new Date().toISOString(),
          executed_by: userId,
        }
      }

      return {
        success: true,
        action: 'update_service_price',
        params,
        result: {
          before: {
            price_cents: serviceBefore.price_cents,
            name: serviceBefore.name,
          },
          after: {
            price_cents: serviceAfter.price_cents,
            name: serviceAfter.name,
          },
          changes: [
            `Updated price for service "${serviceBefore.name}"`,
            `From: $${(serviceBefore.price_cents / 100).toFixed(2)}`,
            `To: $${(serviceAfter.price_cents / 100).toFixed(2)}`,
            `Change: ${((new_price_cents - serviceBefore.price_cents) / serviceBefore.price_cents * 100).toFixed(1)}%`,
            reason ? `Reason: ${reason}` : '',
          ].filter(Boolean),
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    } catch (error: any) {
      return {
        success: false,
        action: 'update_service_price',
        params,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: error.message || 'Unexpected error',
          details: error,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }
  }

  /**
   * Execute: Adjust service margin
   * Calculates new price to achieve target margin and optionally updates it
   */
  private async executeAdjustServiceMargin(
    params: ActionParams['adjust_service_margin'],
    context: ActionContext
  ): Promise<ActionResult> {
    const { supabase, clinicId, userId, dryRun } = context
    const { service_id, target_margin_pct, adjust_price = false } = params

    try {
      // Get current service with cost data
      const { data: service, error: fetchError } = await supabase
        .from('services')
        .select('*')
        .eq('id', service_id)
        .eq('clinic_id', clinicId)
        .single()

      if (fetchError || !service) {
        return {
          success: false,
          action: 'adjust_service_margin',
          params,
          error: {
            code: 'SERVICE_NOT_FOUND',
            message: `Service ${service_id} not found`,
            details: fetchError,
          },
          executed_at: new Date().toISOString(),
          executed_by: userId,
        }
      }

      // Calculate current costs
      const fixedCostCents = service.fixed_cost_cents || 0
      const variableCostCents = service.variable_cost_cents || 0
      const totalCostCents = fixedCostCents + variableCostCents

      if (totalCostCents === 0) {
        return {
          success: false,
          action: 'adjust_service_margin',
          params,
          error: {
            code: 'ZERO_COST',
            message: 'Service has zero cost. Cannot calculate margin. Please configure service costs first.',
          },
          executed_at: new Date().toISOString(),
          executed_by: userId,
        }
      }

      // Calculate new price for target margin
      // Formula: Price = Cost × (1 + Margin/100)
      const newPriceCents = Math.round(totalCostCents * (1 + target_margin_pct / 100))

      // Calculate current margin for comparison
      const currentPriceCents = service.price_cents || 0
      const currentProfitCents = currentPriceCents - totalCostCents
      const currentMarginPct = totalCostCents > 0
        ? Math.round((currentProfitCents / totalCostCents) * 100 * 100) / 100
        : 0

      const newProfitCents = newPriceCents - totalCostCents

      // Build changes description
      const changes = [
        `Service: "${service.name}"`,
        `Total cost: $${(totalCostCents / 100).toFixed(2)} (Fixed: $${(fixedCostCents / 100).toFixed(2)}, Variable: $${(variableCostCents / 100).toFixed(2)})`,
        `Current price: $${(currentPriceCents / 100).toFixed(2)} (${currentMarginPct}% markup)`,
        `Target margin: ${target_margin_pct}%`,
        `Calculated price: $${(newPriceCents / 100).toFixed(2)}`,
        `New profit per service: $${(newProfitCents / 100).toFixed(2)}`,
        `Price change: ${((newPriceCents - currentPriceCents) / currentPriceCents * 100).toFixed(1)}%`,
      ]

      // If not adjusting price or dry run, just return calculation
      if (!adjust_price || dryRun) {
        changes.push(
          adjust_price
            ? '⚠️ DRY RUN - Price would be updated'
            : 'ℹ️ Calculation only - use adjust_price=true to update'
        )

        return {
          success: true,
          action: 'adjust_service_margin',
          params,
          result: {
            before: {
              price_cents: currentPriceCents,
              margin_pct: currentMarginPct,
              profit_cents: currentProfitCents,
            },
            after: {
              price_cents: newPriceCents,
              margin_pct: target_margin_pct,
              profit_cents: newProfitCents,
            },
            changes,
          },
          executed_at: new Date().toISOString(),
          executed_by: userId,
        }
      }

      // Execute price update
      const { data: updatedService, error: updateError } = await supabase
        .from('services')
        .update({
          price_cents: newPriceCents,
          margin_pct: target_margin_pct,
          updated_at: new Date().toISOString(),
        })
        .eq('id', service_id)
        .eq('clinic_id', clinicId)
        .select()
        .single()

      if (updateError) {
        return {
          success: false,
          action: 'adjust_service_margin',
          params,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Failed to update service margin',
            details: updateError,
          },
          executed_at: new Date().toISOString(),
          executed_by: userId,
        }
      }

      changes.push('✅ Price updated successfully')

      return {
        success: true,
        action: 'adjust_service_margin',
        params,
        result: {
          before: {
            price_cents: currentPriceCents,
            margin_pct: currentMarginPct,
            profit_cents: currentProfitCents,
            name: service.name,
          },
          after: {
            price_cents: updatedService.price_cents,
            margin_pct: updatedService.margin_pct,
            profit_cents: newProfitCents,
            name: updatedService.name,
          },
          changes,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    } catch (error: any) {
      return {
        success: false,
        action: 'adjust_service_margin',
        params,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: error.message || 'Unexpected error',
          details: error,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }
  }

  /**
   * Execute: Simulate price change
   * Read-only simulation of price changes and their impact on revenue
   */
  private async executeSimulatePriceChange(
    params: ActionParams['simulate_price_change'],
    context: ActionContext
  ): Promise<ActionResult> {
    const { supabase, clinicId, userId } = context
    const { service_id, change_type, change_value } = params

    try {
      // Build services query
      let servicesQuery = supabase
        .from('services')
        .select('id, name, price_cents, fixed_cost_cents, variable_cost_cents, margin_pct')
        .eq('clinic_id', clinicId)

      if (service_id) {
        servicesQuery = servicesQuery.eq('id', service_id)
      }

      const { data: services, error: servicesError } = await servicesQuery

      if (servicesError || !services || services.length === 0) {
        return {
          success: false,
          action: 'simulate_price_change',
          params,
          error: {
            code: 'NO_SERVICES_FOUND',
            message: service_id
              ? `Service ${service_id} not found`
              : 'No services found in clinic',
          },
          executed_at: new Date().toISOString(),
          executed_by: userId,
        }
      }

      // Get historical treatment data for volume estimation (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: treatments } = await supabase
        .from('treatments')
        .select('service_id, price_cents')
        .eq('clinic_id', clinicId)
        .gte('treatment_date', thirtyDaysAgo.toISOString().split('T')[0])

      // Count treatments by service
      const treatmentCounts: Record<string, number> = {}
      const treatmentRevenue: Record<string, number> = {}

      treatments?.forEach(t => {
        treatmentCounts[t.service_id] = (treatmentCounts[t.service_id] || 0) + 1
        treatmentRevenue[t.service_id] = (treatmentRevenue[t.service_id] || 0) + (t.price_cents || 0)
      })

      // Calculate simulation results
      const simulationResults = services.map(service => {
        const currentPrice = service.price_cents || 0
        const treatmentCount = treatmentCounts[service.id] || 0
        const currentMonthlyRevenue = treatmentRevenue[service.id] || 0

        // Calculate new price based on change type
        let newPrice: number
        if (change_type === 'percentage') {
          newPrice = Math.round(currentPrice * (1 + change_value / 100))
        } else {
          // fixed - change_value is in cents
          newPrice = currentPrice + change_value
        }

        // Ensure price doesn't go negative
        newPrice = Math.max(0, newPrice)

        // Calculate new revenue estimate (assuming same volume)
        const newMonthlyRevenue = treatmentCount > 0
          ? Math.round((newPrice / currentPrice) * currentMonthlyRevenue)
          : 0

        // Calculate profit changes
        const totalCost = (service.fixed_cost_cents || 0) + (service.variable_cost_cents || 0)
        const currentProfit = currentPrice - totalCost
        const newProfit = newPrice - totalCost

        const currentMargin = totalCost > 0 ? (currentProfit / totalCost) * 100 : 0
        const newMargin = totalCost > 0 ? (newProfit / totalCost) * 100 : 0

        return {
          service_id: service.id,
          service_name: service.name,
          treatment_count: treatmentCount,
          current_price_cents: currentPrice,
          new_price_cents: newPrice,
          price_change_pct: currentPrice > 0 ? ((newPrice - currentPrice) / currentPrice) * 100 : 0,
          current_monthly_revenue_cents: currentMonthlyRevenue,
          new_monthly_revenue_cents: newMonthlyRevenue,
          revenue_change_cents: newMonthlyRevenue - currentMonthlyRevenue,
          revenue_change_pct: currentMonthlyRevenue > 0
            ? ((newMonthlyRevenue - currentMonthlyRevenue) / currentMonthlyRevenue) * 100
            : 0,
          current_margin_pct: Math.round(currentMargin * 100) / 100,
          new_margin_pct: Math.round(newMargin * 100) / 100,
          current_profit_per_treatment_cents: currentProfit,
          new_profit_per_treatment_cents: newProfit,
        }
      })

      // Calculate totals
      const totalCurrentRevenue = simulationResults.reduce(
        (sum, r) => sum + r.current_monthly_revenue_cents,
        0
      )
      const totalNewRevenue = simulationResults.reduce(
        (sum, r) => sum + r.new_monthly_revenue_cents,
        0
      )
      const totalRevenueChange = totalNewRevenue - totalCurrentRevenue
      const totalRevenueChangePct = totalCurrentRevenue > 0
        ? (totalRevenueChange / totalCurrentRevenue) * 100
        : 0

      const totalTreatments = simulationResults.reduce((sum, r) => sum + r.treatment_count, 0)

      // Build summary
      const changes = [
        `Simulation Type: ${change_type === 'percentage' ? 'Percentage' : 'Fixed Amount'}`,
        `Change Value: ${change_type === 'percentage' ? `${change_value}%` : `$${(change_value / 100).toFixed(2)}`}`,
        `Services Affected: ${services.length}`,
        `Historical Data: ${totalTreatments} treatments in last 30 days`,
        '',
        '📊 AGGREGATE IMPACT:',
        `  Current Monthly Revenue: $${(totalCurrentRevenue / 100).toFixed(2)}`,
        `  Projected Monthly Revenue: $${(totalNewRevenue / 100).toFixed(2)}`,
        `  Revenue Change: ${totalRevenueChange >= 0 ? '+' : ''}$${(totalRevenueChange / 100).toFixed(2)} (${totalRevenueChangePct.toFixed(1)}%)`,
        '',
        '⚠️ ASSUMPTIONS:',
        `  • Treatment volume remains constant`,
        `  • No price elasticity considered (demand may change with price)`,
        `  • Based on last 30 days of data`,
      ]

      return {
        success: true,
        action: 'simulate_price_change',
        params,
        result: {
          before: {
            total_monthly_revenue_cents: totalCurrentRevenue,
            services_count: services.length,
            total_treatments: totalTreatments,
          },
          after: {
            total_monthly_revenue_cents: totalNewRevenue,
            revenue_change_cents: totalRevenueChange,
            revenue_change_pct: Math.round(totalRevenueChangePct * 100) / 100,
          },
          changes,
          simulation_by_service: simulationResults,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    } catch (error: any) {
      return {
        success: false,
        action: 'simulate_price_change',
        params,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: error.message || 'Unexpected error',
          details: error,
        },
        executed_at: new Date().toISOString(),
        executed_by: userId,
      }
    }
  }

  /**
   * Execute: Create expense
   * TODO: Implement
   */
  private async executeCreateExpense(
    params: ActionParams['create_expense'],
    context: ActionContext
  ): Promise<ActionResult> {
    return {
      success: false,
      action: 'create_expense',
      params,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This action is not yet implemented',
      },
      executed_at: new Date().toISOString(),
      executed_by: context.userId,
    }
  }

  /**
   * Execute: Update time settings
   * TODO: Implement
   */
  private async executeUpdateTimeSettings(
    params: ActionParams['update_time_settings'],
    context: ActionContext
  ): Promise<ActionResult> {
    return {
      success: false,
      action: 'update_time_settings',
      params,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This action is not yet implemented',
      },
      executed_at: new Date().toISOString(),
      executed_by: context.userId,
    }
  }

  /**
   * Log action execution to database
   * TODO: Create action_logs table and implement
   */
  /**
   * Log action execution to database for audit trail
   */
  private async logAction(result: ActionResult, context: ActionContext): Promise<void> {
    const { supabase, clinicId, userId, dryRun } = context

    try {
      const logEntry = {
        clinic_id: clinicId,
        user_id: userId,
        action_type: result.action,
        success: result.success,
        params: result.params,
        result: result.result || null,
        error_code: result.error?.code || null,
        error_message: result.error?.message || null,
        error_details: result.error?.details || null,
        dry_run: dryRun || false,
        executed_at: result.executed_at,
      }

      const { error } = await supabase.from('action_logs').insert(logEntry)

      if (error) {
        // Log to console but don't throw - logging failure shouldn't break action execution
        console.error('[AIService] Failed to log action to database:', error)
      }
    } catch (error) {
      console.error('[AIService] Unexpected error logging action:', error)
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