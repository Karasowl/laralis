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
  EntryContext,
  QueryContext,
  QueryResult,
  ActionExecutor,
  ActionType,
  ActionParams,
  ActionResult,
  ActionContext,
  ActionSuggestion,
} from './types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AIProviderFactory } from './factory'
import { ClinicSnapshotService } from './ClinicSnapshotService'
import { ACTION_FUNCTIONS, isActionFunction } from './actions-functions'
import { snapshotCache } from './cache/snapshot-cache'

// Prompts
import { buildEntrySystemPrompt } from './prompts/entry-prompt'
import { buildAnalyticsSystemPrompt, type ConversationContextPrompt } from './prompts/query-prompt'

// Actions - all 15 action implementations
import {
  // Original 5 pricing actions
  executeUpdateServicePrice,
  executeAdjustServiceMargin,
  executeSimulatePriceChange,
  executeCreateExpense,
  executeUpdateTimeSettings,
  // 6 analytics actions
  executeGetBreakEvenAnalysis,
  executeGetTopServices,
  executeGetExpenseBreakdown,
  executeGetServiceProfitability,
  executeIdentifyUnderperformingServices,
  executeComparePeriods,
  // 4 operational actions
  executeBulkUpdatePrices,
  executeForecastRevenue,
  executeAnalyzePatientRetention,
  executeOptimizeInventory,
} from './actions'

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
    const systemPrompt = buildEntrySystemPrompt(context)

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
   * For analytics/insights mode with Actions System support
   */
  async queryDatabase(query: string, context: QueryContext): Promise<QueryResult> {
    // Pre-load ALL clinic data in one go
    const clinicSnapshot = await this.getClinicSnapshot(context)

    // Convert conversation context to prompt format
    const conversationContextPrompt: ConversationContextPrompt | undefined = context.conversationContext ? {
      primaryEntity: context.conversationContext.primaryEntity,
      secondaryEntities: context.conversationContext.secondaryEntities,
      timePeriod: context.conversationContext.timePeriod,
      currentTopic: context.conversationContext.currentTopic,
      pendingActions: context.conversationContext.pendingActions,
      summary: context.conversationContext.summary,
    } : undefined

    const systemPrompt = buildAnalyticsSystemPrompt(context, clinicSnapshot, conversationContextPrompt)

    const llm = this.getLLM()

    // Check if LLM supports function calling
    if (llm.supportsFunctionCalling) {
      // Use function calling with ACTION_FUNCTIONS
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ]

      const llmResponse = await llm.chatWithFunctions(messages, ACTION_FUNCTIONS)

      // Check if LLM wants to execute an action
      if (llmResponse.functionCall && isActionFunction(llmResponse.functionCall.name)) {
        // Convert function call to ActionSuggestion
        const actionSuggestion = this.convertFunctionCallToActionSuggestion(
          llmResponse.functionCall,
          llmResponse.content || '',
          clinicSnapshot
        )

        return {
          answer: llmResponse.content || '',
          data: clinicSnapshot,
          thinking: llmResponse.thinkingProcess,
          suggestedAction: actionSuggestion,
        }
      }

      // No action suggested, return normal response
      return {
        answer: llmResponse.content || '',
        data: clinicSnapshot,
        thinking: llmResponse.thinkingProcess,
      }
    } else {
      // Fallback: LLM doesn't support function calling
      const response = await llm.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ])

      return {
        answer: response,
        data: clinicSnapshot,
      }
    }
  }

  /**
   * Convert LLM function call to ActionSuggestion
   * Calculates expected impact and determines confidence level
   */
  private convertFunctionCallToActionSuggestion(
    functionCall: { name: string; arguments: Record<string, unknown> },
    reasoning: string,
    clinicSnapshot: any
  ): ActionSuggestion {
    const actionType = functionCall.name as ActionType
    const params = functionCall.arguments as any

    // Calculate expected impact based on action type and current data
    const expectedImpact = this.calculateExpectedImpact(actionType, params, clinicSnapshot)

    // Determine confidence level based on data quality
    const confidence = this.determineConfidence(actionType, params, clinicSnapshot)

    return {
      action: actionType,
      params,
      reasoning: reasoning || `Lara suggests executing ${actionType}`,
      expected_impact: expectedImpact,
      confidence,
    }
  }

  /**
   * Calculate expected impact of an action
   */
  private calculateExpectedImpact(
    action: ActionType,
    params: any,
    snapshot: any
  ): Array<{ metric: string; current_value: number; new_value: number; change_pct: number }> {
    const impact = []

    try {
      if (action === 'update_service_price') {
        // Find the service
        const service = snapshot?.data?.services?.list?.find((s: any) => s.id === params.service_id)
        if (service) {
          const currentPrice = service.price_cents || 0
          const newPrice = params.new_price_cents
          const changePct = currentPrice > 0 ? ((newPrice - currentPrice) / currentPrice) * 100 : 0

          impact.push({
            metric: 'Service Price',
            current_value: currentPrice,
            new_value: newPrice,
            change_pct: Math.round(changePct * 100) / 100,
          })
        }
      } else if (action === 'adjust_service_margin') {
        const service = snapshot?.data?.services?.list?.find((s: any) => s.id === params.service_id)
        if (service) {
          const totalCost = (service.fixed_cost_cents || 0) + (service.variable_cost_cents || 0)
          const currentPrice = service.price_cents || 0
          const newPrice = Math.round(totalCost * (1 + params.target_margin_pct / 100))
          const changePct = currentPrice > 0 ? ((newPrice - currentPrice) / currentPrice) * 100 : 0

          impact.push({
            metric: 'Service Price',
            current_value: currentPrice,
            new_value: newPrice,
            change_pct: Math.round(changePct * 100) / 100,
          })

          impact.push({
            metric: 'Margin (Markup)',
            current_value: service.margin_pct || 0,
            new_value: params.target_margin_pct,
            change_pct:
              service.margin_pct > 0
                ? ((params.target_margin_pct - service.margin_pct) / service.margin_pct) * 100
                : 0,
          })
        }
      } else if (action === 'simulate_price_change') {
        // For simulations, we can't calculate exact impact without running the simulation
        // Return placeholder impact
        impact.push({
          metric: 'Estimated Revenue Change',
          current_value: snapshot?.analytics?.break_even?.revenue_cents || 0,
          new_value: 0, // Will be calculated in simulation
          change_pct: params.change_value,
        })
      }
    } catch (error) {
      console.error('[AIService] Error calculating expected impact:', error)
    }

    return impact
  }

  /**
   * Determine confidence level based on data quality and action complexity
   */
  private determineConfidence(
    action: ActionType,
    params: any,
    snapshot: any
  ): 'low' | 'medium' | 'high' {
    // Simple heuristics for confidence
    const treatmentsCount = snapshot?.data?.treatments?.total_in_period || 0
    const hasHistoricalData = treatmentsCount > 10

    if (action === 'simulate_price_change') {
      // Simulations are always safe (read-only)
      return 'high'
    }

    if (action === 'update_service_price') {
      // Direct price updates are straightforward
      return hasHistoricalData ? 'high' : 'medium'
    }

    if (action === 'adjust_service_margin') {
      // Margin adjustments require cost data
      const service = snapshot?.data?.services?.list?.find((s: any) => s.id === params.service_id)
      const hasCosts =
        service &&
        ((service.fixed_cost_cents || 0) + (service.variable_cost_cents || 0)) > 0

      return hasCosts ? 'high' : 'low'
    }

    return 'medium'
  }

  /**
   * Query database with streaming response
   * Returns a ReadableStream for real-time token delivery
   */
  async queryDatabaseStream(query: string, context: QueryContext): Promise<ReadableStream> {
    // Pre-load ALL clinic data
    const clinicSnapshot = await this.getClinicSnapshot(context)

    // Convert conversation context to prompt format
    const conversationContextPrompt: ConversationContextPrompt | undefined = context.conversationContext ? {
      primaryEntity: context.conversationContext.primaryEntity,
      secondaryEntities: context.conversationContext.secondaryEntities,
      timePeriod: context.conversationContext.timePeriod,
      currentTopic: context.conversationContext.currentTopic,
      pendingActions: context.conversationContext.pendingActions,
      summary: context.conversationContext.summary,
    } : undefined

    const systemPrompt = buildAnalyticsSystemPrompt(context, clinicSnapshot, conversationContextPrompt)

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
        // ============= ORIGINAL PRICING ACTIONS (5) =============
        case 'update_service_price':
          result = await executeUpdateServicePrice(
            params as ActionParams['update_service_price'],
            context
          )
          break

        case 'adjust_service_margin':
          result = await executeAdjustServiceMargin(
            params as ActionParams['adjust_service_margin'],
            context
          )
          break

        case 'simulate_price_change':
          result = await executeSimulatePriceChange(
            params as ActionParams['simulate_price_change'],
            context
          )
          break

        case 'create_expense':
          result = await executeCreateExpense(
            params as ActionParams['create_expense'],
            context
          )
          break

        case 'update_time_settings':
          result = await executeUpdateTimeSettings(
            params as ActionParams['update_time_settings'],
            context
          )
          break

        // ============= ANALYTICS & OPERATIONAL ACTIONS (10) =============
        case 'bulk_update_prices':
          result = await executeBulkUpdatePrices(
            params as ActionParams['bulk_update_prices'],
            context
          )
          break

        case 'forecast_revenue':
          result = await executeForecastRevenue(
            params as ActionParams['forecast_revenue'],
            context
          )
          break

        case 'identify_underperforming_services':
          result = await executeIdentifyUnderperformingServices(
            params as ActionParams['identify_underperforming_services'],
            context
          )
          break

        case 'analyze_patient_retention':
          result = await executeAnalyzePatientRetention(
            params as ActionParams['analyze_patient_retention'],
            context
          )
          break

        case 'optimize_inventory':
          result = await executeOptimizeInventory(
            params as ActionParams['optimize_inventory'],
            context
          )
          break

        case 'get_break_even_analysis':
          result = await executeGetBreakEvenAnalysis(
            params as ActionParams['get_break_even_analysis'],
            context
          )
          break

        case 'compare_periods':
          result = await executeComparePeriods(
            params as ActionParams['compare_periods'],
            context
          )
          break

        case 'get_service_profitability':
          result = await executeGetServiceProfitability(
            params as ActionParams['get_service_profitability'],
            context
          )
          break

        case 'get_expense_breakdown':
          result = await executeGetExpenseBreakdown(
            params as ActionParams['get_expense_breakdown'],
            context
          )
          break

        case 'get_top_services':
          result = await executeGetTopServices(
            params as ActionParams['get_top_services'],
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

      // Log action and invalidate cache if not dry run
      if (!dryRun && result.success) {
        await this.logAction(result, context)
        // Invalidate snapshot cache since data has changed
        snapshotCache.invalidate(clinicId)
        console.log(`[AIService] Cache invalidated for clinic ${clinicId} after action ${action}`)
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

        // ============= NEW ACTION VALIDATIONS (10) =============
        case 'bulk_update_prices': {
          const p = params as ActionParams['bulk_update_prices']
          if (!['percentage', 'fixed'].includes(p.change_type)) {
            errors.push('change_type must be "percentage" or "fixed"')
          }
          if (p.change_value === undefined || p.change_value === null) {
            errors.push('change_value is required')
          }
          if (p.change_type === 'percentage' && Math.abs(p.change_value) > 100) {
            errors.push('percentage change cannot exceed ±100%')
          }
          break
        }

        case 'forecast_revenue': {
          const p = params as ActionParams['forecast_revenue']
          if (p.days && (p.days < 1 || p.days > 365)) {
            errors.push('days must be between 1 and 365')
          }
          break
        }

        case 'identify_underperforming_services': {
          const p = params as ActionParams['identify_underperforming_services']
          if (p.min_margin_pct !== undefined && (p.min_margin_pct < 0 || p.min_margin_pct > 100)) {
            errors.push('min_margin_pct must be between 0 and 100')
          }
          break
        }

        case 'analyze_patient_retention': {
          const p = params as ActionParams['analyze_patient_retention']
          if (p.period_days && (p.period_days < 1 || p.period_days > 730)) {
            errors.push('period_days must be between 1 and 730')
          }
          if (p.cohort_type && !['monthly', 'quarterly'].includes(p.cohort_type)) {
            errors.push('cohort_type must be "monthly" or "quarterly"')
          }
          break
        }

        case 'optimize_inventory': {
          const p = params as ActionParams['optimize_inventory']
          if (p.days_ahead && (p.days_ahead < 1 || p.days_ahead > 365)) {
            errors.push('days_ahead must be between 1 and 365')
          }
          if (p.reorder_threshold_pct && (p.reorder_threshold_pct < 0 || p.reorder_threshold_pct > 100)) {
            errors.push('reorder_threshold_pct must be between 0 and 100')
          }
          break
        }

        case 'get_break_even_analysis': {
          const p = params as ActionParams['get_break_even_analysis']
          if (p.period_days && (p.period_days < 1 || p.period_days > 365)) {
            errors.push('period_days must be between 1 and 365')
          }
          break
        }

        case 'compare_periods': {
          const p = params as ActionParams['compare_periods']
          if (!p.period1_start || !p.period1_end) {
            errors.push('period1_start and period1_end are required')
          }
          if (!p.period2_start || !p.period2_end) {
            errors.push('period2_start and period2_end are required')
          }
          // Validate date formats
          const dates = [p.period1_start, p.period1_end, p.period2_start, p.period2_end]
          dates.forEach((d, i) => {
            if (d && isNaN(Date.parse(d))) {
              errors.push(`period${Math.floor(i / 2) + 1}_${i % 2 === 0 ? 'start' : 'end'} must be a valid ISO date`)
            }
          })
          break
        }

        case 'get_service_profitability': {
          const p = params as ActionParams['get_service_profitability']
          if (p.period_days && (p.period_days < 1 || p.period_days > 365)) {
            errors.push('period_days must be between 1 and 365')
          }
          if (p.sort_by && !['margin', 'revenue', 'count'].includes(p.sort_by)) {
            errors.push('sort_by must be "margin", "revenue", or "count"')
          }
          break
        }

        case 'get_expense_breakdown': {
          const p = params as ActionParams['get_expense_breakdown']
          if (p.period_days && (p.period_days < 1 || p.period_days > 365)) {
            errors.push('period_days must be between 1 and 365')
          }
          if (p.group_by && !['category', 'subcategory', 'vendor'].includes(p.group_by)) {
            errors.push('group_by must be "category", "subcategory", or "vendor"')
          }
          break
        }

        case 'get_top_services': {
          const p = params as ActionParams['get_top_services']
          if (p.limit && (p.limit < 1 || p.limit > 100)) {
            errors.push('limit must be between 1 and 100')
          }
          if (p.period_days && (p.period_days < 1 || p.period_days > 365)) {
            errors.push('period_days must be between 1 and 365')
          }
          if (p.sort_by && !['revenue', 'count', 'margin'].includes(p.sort_by)) {
            errors.push('sort_by must be "revenue", "count", or "margin"')
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
