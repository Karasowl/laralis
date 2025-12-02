/**
 * Conversation Context Manager
 *
 * Manages multi-turn conversation context for Lara.
 * Tracks entities, actions, and focus across messages.
 *
 * Key features:
 * - Entity extraction from messages
 * - Pronoun/reference resolution
 * - Focus tracking (what entity is being discussed)
 * - Action tracking (suggested/executed)
 * - Context summarization
 */

import type {
  ConversationContext,
  TrackedEntity,
  TrackedAction,
  ConversationFocus,
  ExtractedEntities,
  ContextUpdate,
  EntityType,
  TimePeriodContext,
} from './types'

/**
 * Patterns for entity detection in Spanish/English
 */
const ENTITY_PATTERNS: Record<EntityType, RegExp[]> = {
  service: [
    /servicio\s+(?:de\s+)?["']?([^"',.]+)["']?/gi,
    /service\s+(?:called\s+)?["']?([^"',.]+)["']?/gi,
    /(?:limpieza|blanqueamiento|obturaci[oó]n|extracci[oó]n|corona|implante|endodoncia|ortodoncia)/gi,
  ],
  patient: [
    /paciente\s+["']?([^"',.]+)["']?/gi,
    /patient\s+["']?([^"',.]+)["']?/gi,
  ],
  treatment: [
    /tratamiento\s+(?:de\s+)?["']?([^"',.]+)["']?/gi,
    /treatment\s+(?:for\s+)?["']?([^"',.]+)["']?/gi,
  ],
  expense: [
    /gasto\s+(?:de\s+)?["']?([^"',.]+)["']?/gi,
    /expense\s+(?:for\s+)?["']?([^"',.]+)["']?/gi,
  ],
  supply: [
    /insumo\s+["']?([^"',.]+)["']?/gi,
    /supply\s+["']?([^"',.]+)["']?/gi,
    /material\s+["']?([^"',.]+)["']?/gi,
  ],
  asset: [
    /(?:equipo|activo)\s+["']?([^"',.]+)["']?/gi,
    /(?:equipment|asset)\s+["']?([^"',.]+)["']?/gi,
  ],
  category: [
    /categor[ií]a\s+["']?([^"',.]+)["']?/gi,
    /category\s+["']?([^"',.]+)["']?/gi,
  ],
  time_period: [
    /(?:este|último|pasado)\s+(mes|semana|año|trimestre)/gi,
    /(?:this|last|past)\s+(month|week|year|quarter)/gi,
  ],
}

/**
 * Patterns for pronoun/reference detection
 */
const REFERENCE_PATTERNS = [
  // Spanish
  /\b(ese|esta|este|esa|eso|lo|la|le|su|sus|el mismo|la misma)\b/gi,
  /\b(su precio|su margen|su costo|ese servicio|esa limpieza)\b/gi,
  // English
  /\b(it|its|that|this|the same|that one)\b/gi,
  /\b(its price|its margin|its cost|that service)\b/gi,
]

/**
 * Time period patterns
 */
const TIME_PATTERNS: Array<{ pattern: RegExp; type: TimePeriodContext['type'] }> = [
  { pattern: /(?:hoy|today)/gi, type: 'day' },
  { pattern: /(?:esta semana|this week)/gi, type: 'week' },
  { pattern: /(?:este mes|this month)/gi, type: 'month' },
  { pattern: /(?:último mes|last month|mes pasado)/gi, type: 'month' },
  { pattern: /(?:últimos? (\d+) días|last (\d+) days)/gi, type: 'custom' },
  { pattern: /(?:este año|this year)/gi, type: 'year' },
  { pattern: /(?:este trimestre|this quarter)/gi, type: 'quarter' },
]

export class ConversationContextManager {
  private context: ConversationContext

  constructor(sessionId: string, clinicId: string, existingContext?: ConversationContext) {
    this.context = existingContext || {
      sessionId,
      clinicId,
      entities: [],
      actions: [],
      focus: {
        secondaryEntities: [],
      },
      updatedAt: new Date().toISOString(),
    }
  }

  /**
   * Get current context
   */
  getContext(): ConversationContext {
    return this.context
  }

  /**
   * Get current focus entity
   */
  getFocusEntity(): TrackedEntity | undefined {
    return this.context.focus.primaryEntity
  }

  /**
   * Extract entities from a message using pattern matching
   * For production, this could call an LLM for better extraction
   */
  extractEntitiesFromMessage(
    message: string,
    messageIndex: number,
    knownEntities?: Array<{ type: EntityType; id: string; name: string }>
  ): ExtractedEntities {
    const result: ExtractedEntities = {
      mentioned: [],
      references: [],
      timePeriods: [],
    }

    // Check for known entities by name (case-insensitive)
    if (knownEntities) {
      for (const entity of knownEntities) {
        const nameRegex = new RegExp(`\\b${this.escapeRegex(entity.name)}\\b`, 'gi')
        if (nameRegex.test(message)) {
          result.mentioned.push({
            type: entity.type,
            name: entity.name,
            id: entity.id,
          })
        }
      }
    }

    // Check for entity patterns
    for (const [type, patterns] of Object.entries(ENTITY_PATTERNS)) {
      for (const pattern of patterns) {
        const matches = message.matchAll(new RegExp(pattern))
        for (const match of matches) {
          const name = match[1] || match[0]
          // Avoid duplicates
          if (!result.mentioned.some(e => e.name.toLowerCase() === name.toLowerCase())) {
            result.mentioned.push({
              type: type as EntityType,
              name: name.trim(),
            })
          }
        }
      }
    }

    // Check for references/pronouns
    for (const pattern of REFERENCE_PATTERNS) {
      const matches = message.matchAll(new RegExp(pattern))
      for (const match of matches) {
        const text = match[0]
        // Try to resolve to current focus entity
        const resolved = this.context.focus.primaryEntity?.name
        result.references.push({
          text,
          resolvedTo: resolved,
        })
      }
    }

    // Check for time periods
    for (const { pattern, type } of TIME_PATTERNS) {
      if (pattern.test(message)) {
        const { startDate, endDate } = this.calculateDateRange(type)
        result.timePeriods.push({
          text: message.match(pattern)?.[0] || '',
          type,
          startDate,
          endDate,
        })
      }
    }

    // Detect intent based on keywords
    result.intent = this.detectIntent(message)

    return result
  }

  /**
   * Process a user message and update context
   */
  processUserMessage(
    message: string,
    messageIndex: number,
    knownEntities?: Array<{ type: EntityType; id: string; name: string }>
  ): ContextUpdate {
    const extracted = this.extractEntitiesFromMessage(message, messageIndex, knownEntities)
    const update: ContextUpdate = {
      newEntities: [],
      referencedEntityIds: [],
    }

    // Process mentioned entities
    for (const mentioned of extracted.mentioned) {
      const existing = this.findEntity(mentioned.name, mentioned.type)

      if (existing) {
        // Update existing entity
        existing.lastReferenced = messageIndex
        existing.referenceCount++
        if (mentioned.id && !existing.id) {
          existing.id = mentioned.id
        }
        update.referencedEntityIds.push(existing.id || existing.name)
      } else {
        // Add new entity
        const newEntity: TrackedEntity = {
          type: mentioned.type,
          id: mentioned.id,
          name: mentioned.name,
          attributes: mentioned.attributes,
          firstMentioned: messageIndex,
          lastReferenced: messageIndex,
          referenceCount: 1,
        }
        this.context.entities.push(newEntity)
        update.newEntities.push(newEntity)
      }
    }

    // Update focus based on what was mentioned
    if (extracted.mentioned.length > 0) {
      const primary = extracted.mentioned[0]
      const primaryEntity = this.findEntity(primary.name, primary.type)

      if (primaryEntity) {
        // Move current primary to secondary if different
        if (
          this.context.focus.primaryEntity &&
          this.context.focus.primaryEntity.name !== primaryEntity.name
        ) {
          this.context.focus.secondaryEntities.unshift(this.context.focus.primaryEntity)
          // Keep only last 3 secondary entities
          this.context.focus.secondaryEntities = this.context.focus.secondaryEntities.slice(0, 3)
        }
        this.context.focus.primaryEntity = primaryEntity
        update.newFocus = { primaryEntity }
      }
    }

    // Handle references (pronouns) - use current focus
    if (extracted.references.length > 0 && this.context.focus.primaryEntity) {
      const focusEntity = this.context.focus.primaryEntity
      focusEntity.lastReferenced = messageIndex
      focusEntity.referenceCount++
      update.referencedEntityIds.push(focusEntity.id || focusEntity.name)
    }

    // Update time period context
    if (extracted.timePeriods.length > 0) {
      const timePeriod = extracted.timePeriods[0]
      this.context.focus.timePeriod = {
        type: timePeriod.type,
        startDate: timePeriod.startDate,
        endDate: timePeriod.endDate,
        label: timePeriod.text,
      }
      update.newFocus = {
        ...update.newFocus,
        timePeriod: this.context.focus.timePeriod,
      }
    }

    // Update topic
    if (extracted.intent) {
      this.context.focus.currentTopic = extracted.intent
      update.newFocus = {
        ...update.newFocus,
        currentTopic: extracted.intent,
      }
    }

    this.context.updatedAt = new Date().toISOString()

    return update
  }

  /**
   * Process assistant response and extract entities mentioned
   */
  processAssistantMessage(
    message: string,
    messageIndex: number,
    suggestedAction?: TrackedAction
  ): ContextUpdate {
    const extracted = this.extractEntitiesFromMessage(message, messageIndex)
    const update: ContextUpdate = {
      newEntities: [],
      referencedEntityIds: [],
    }

    // Track any new entities mentioned by assistant
    for (const mentioned of extracted.mentioned) {
      const existing = this.findEntity(mentioned.name, mentioned.type)

      if (!existing) {
        const newEntity: TrackedEntity = {
          type: mentioned.type,
          id: mentioned.id,
          name: mentioned.name,
          firstMentioned: messageIndex,
          lastReferenced: messageIndex,
          referenceCount: 1,
        }
        this.context.entities.push(newEntity)
        update.newEntities.push(newEntity)

        // If assistant introduces an entity, it becomes the focus
        if (!this.context.focus.primaryEntity) {
          this.context.focus.primaryEntity = newEntity
          update.newFocus = { primaryEntity: newEntity }
        }
      }
    }

    // Track suggested action
    if (suggestedAction) {
      this.context.actions.push(suggestedAction)
      update.newAction = suggestedAction
    }

    this.context.updatedAt = new Date().toISOString()

    return update
  }

  /**
   * Record when an action is executed
   */
  recordActionExecuted(actionType: string, result: Record<string, unknown>): void {
    const action = this.context.actions.find(
      a => a.type === actionType && a.status === 'suggested'
    )
    if (action) {
      action.status = 'executed'
      action.result = result
    }
    this.context.updatedAt = new Date().toISOString()
  }

  /**
   * Generate context string for LLM prompt
   */
  generateContextPrompt(): string {
    const parts: string[] = []

    // Focus entity
    if (this.context.focus.primaryEntity) {
      const entity = this.context.focus.primaryEntity
      parts.push(
        `**Current Focus**: ${entity.type} "${entity.name}"${entity.id ? ` (ID: ${entity.id})` : ''}`
      )

      if (entity.attributes && Object.keys(entity.attributes).length > 0) {
        parts.push(`  Attributes: ${JSON.stringify(entity.attributes)}`)
      }
    }

    // Secondary entities
    if (this.context.focus.secondaryEntities.length > 0) {
      const names = this.context.focus.secondaryEntities.map(e => `${e.type}:"${e.name}"`).join(', ')
      parts.push(`**Also discussed**: ${names}`)
    }

    // Time period
    if (this.context.focus.timePeriod) {
      parts.push(`**Time context**: ${this.context.focus.timePeriod.label}`)
    }

    // Current topic
    if (this.context.focus.currentTopic) {
      parts.push(`**Current topic**: ${this.context.focus.currentTopic}`)
    }

    // Pending actions
    const pendingActions = this.context.actions.filter(a => a.status === 'suggested')
    if (pendingActions.length > 0) {
      parts.push(`**Pending suggested actions**: ${pendingActions.map(a => a.type).join(', ')}`)
    }

    // Summary
    if (this.context.summary) {
      parts.push(`**Conversation summary**: ${this.context.summary}`)
    }

    if (parts.length === 0) {
      return ''
    }

    return `
## Conversation Context (IMPORTANT)

${parts.join('\n')}

**Instructions for handling context:**
- When user says "it", "this", "that", "su", "ese", "esta" → refer to the **Current Focus** entity
- When user asks about price, margin, cost without specifying → assume Current Focus entity
- If user asks about a different entity, update your mental focus to that entity
- Use the Time context for any date-based queries unless user specifies otherwise
`
  }

  /**
   * Serialize context for storage
   */
  serialize(): string {
    return JSON.stringify(this.context)
  }

  /**
   * Deserialize context from storage
   */
  static deserialize(json: string): ConversationContext {
    return JSON.parse(json)
  }

  // ==================== Private Helpers ====================

  private findEntity(name: string, type?: EntityType): TrackedEntity | undefined {
    return this.context.entities.find(
      e => e.name.toLowerCase() === name.toLowerCase() && (!type || e.type === type)
    )
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private detectIntent(message: string): string | undefined {
    const lowerMessage = message.toLowerCase()

    // Price-related
    if (/(?:precio|price|cuesta|cobrar|tarifa|rate)/i.test(lowerMessage)) {
      return 'pricing'
    }

    // Margin/profit
    if (/(?:margen|margin|ganancia|profit|rentab)/i.test(lowerMessage)) {
      return 'profitability'
    }

    // Cost
    if (/(?:costo|cost|gasto|expense)/i.test(lowerMessage)) {
      return 'costs'
    }

    // Comparison
    if (/(?:compar|versus|vs|mejor|peor|best|worst)/i.test(lowerMessage)) {
      return 'comparison'
    }

    // Trend/analysis
    if (/(?:tendencia|trend|análisis|analysis|históri)/i.test(lowerMessage)) {
      return 'analysis'
    }

    // Recommendation
    if (/(?:recomiend|suggest|debería|should|puede|can i)/i.test(lowerMessage)) {
      return 'recommendation'
    }

    return undefined
  }

  private calculateDateRange(type: TimePeriodContext['type']): { startDate: string; endDate: string } {
    const now = new Date()
    const endDate = now.toISOString().split('T')[0]
    let startDate: string

    switch (type) {
      case 'day':
        startDate = endDate
        break
      case 'week':
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        startDate = weekAgo.toISOString().split('T')[0]
        break
      case 'month':
        const monthAgo = new Date(now)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        startDate = monthAgo.toISOString().split('T')[0]
        break
      case 'quarter':
        const quarterAgo = new Date(now)
        quarterAgo.setMonth(quarterAgo.getMonth() - 3)
        startDate = quarterAgo.toISOString().split('T')[0]
        break
      case 'year':
        const yearAgo = new Date(now)
        yearAgo.setFullYear(yearAgo.getFullYear() - 1)
        startDate = yearAgo.toISOString().split('T')[0]
        break
      default:
        // Default to last 30 days
        const defaultStart = new Date(now)
        defaultStart.setDate(defaultStart.getDate() - 30)
        startDate = defaultStart.toISOString().split('T')[0]
    }

    return { startDate, endDate }
  }
}
