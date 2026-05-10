/**
 * Conversation Context Types
 *
 * Types for multi-turn conversation context management.
 * Enables Lara to remember entities, actions, and context across messages.
 */

/**
 * Entity types that can be tracked in conversation
 */
export type EntityType =
  | 'service'
  | 'patient'
  | 'treatment'
  | 'expense'
  | 'supply'
  | 'asset'
  | 'category'
  | 'time_period'

/**
 * A tracked entity from the conversation
 */
export interface TrackedEntity {
  /** Entity type */
  type: EntityType
  /** Database ID if known */
  id?: string
  /** Display name */
  name: string
  /** Key attributes for context */
  attributes?: Record<string, unknown>
  /** When this entity was first mentioned */
  firstMentioned: number // message index
  /** When this entity was last referenced */
  lastReferenced: number // message index
  /** How many times referenced */
  referenceCount: number
}

/**
 * A suggested or executed action
 */
export interface TrackedAction {
  /** Action type */
  type: string
  /** Action parameters */
  params: Record<string, unknown>
  /** When suggested */
  suggestedAt: string // ISO timestamp
  /** Status */
  status: 'suggested' | 'accepted' | 'rejected' | 'executed'
  /** Result if executed */
  result?: Record<string, unknown>
  /** Related entity */
  relatedEntityId?: string
}

/**
 * Time period reference in conversation
 */
export interface TimePeriodContext {
  /** Period type */
  type: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
  /** Start date */
  startDate?: string
  /** End date */
  endDate?: string
  /** Natural language reference */
  label: string
}

/**
 * The active focus of the conversation
 */
export interface ConversationFocus {
  /** Primary entity being discussed */
  primaryEntity?: TrackedEntity
  /** Secondary entities in context */
  secondaryEntities: TrackedEntity[]
  /** Current time period context */
  timePeriod?: TimePeriodContext
  /** Current topic/intent */
  currentTopic?: string
}

/**
 * Full conversation context
 */
export interface ConversationContext {
  /** Session ID */
  sessionId: string
  /** Clinic ID */
  clinicId: string
  /** All tracked entities */
  entities: TrackedEntity[]
  /** Tracked actions */
  actions: TrackedAction[]
  /** Current focus */
  focus: ConversationFocus
  /** Summary of conversation so far */
  summary?: string
  /** Last updated */
  updatedAt: string
}

/**
 * Entity extraction result from LLM
 */
export interface ExtractedEntities {
  /** Entities mentioned in the message */
  mentioned: Array<{
    type: EntityType
    name: string
    id?: string
    attributes?: Record<string, unknown>
  }>
  /** Pronouns/references that need resolution */
  references: Array<{
    text: string // "it", "that service", "su precio"
    resolvedTo?: string // entity name if resolved
  }>
  /** Time periods mentioned */
  timePeriods: Array<{
    text: string
    type: TimePeriodContext['type']
    startDate?: string
    endDate?: string
  }>
  /** Intent/topic detected */
  intent?: string
}

/**
 * Context update from processing a message
 */
export interface ContextUpdate {
  /** New entities to add */
  newEntities: TrackedEntity[]
  /** Entity IDs to update lastReferenced */
  referencedEntityIds: string[]
  /** New focus */
  newFocus?: Partial<ConversationFocus>
  /** New action if suggested */
  newAction?: TrackedAction
  /** Updated summary */
  summary?: string
}
