/**
 * Token Counter Utility
 *
 * Estimates token usage for conversation management.
 * Uses rough estimation: ~4 characters per token for mixed ES/EN text.
 */

export interface TokenLimits {
  model: 'kimi-k2-thinking' | 'moonshot-v1-32k'
  maxTokens: number
  warningThreshold: number // 70%
  hardLimit: number // 90%
}

/**
 * Get token limits for a given model
 */
export function getTokenLimits(model: 'kimi-k2-thinking' | 'moonshot-v1-32k'): TokenLimits {
  const limits = {
    'kimi-k2-thinking': {
      model: 'kimi-k2-thinking' as const,
      maxTokens: 128000, // 128k context window
      warningThreshold: 89600, // 70% of 128k
      hardLimit: 115200, // 90% of 128k
    },
    'moonshot-v1-32k': {
      model: 'moonshot-v1-32k' as const,
      maxTokens: 32000, // 32k context window
      warningThreshold: 22400, // 70% of 32k
      hardLimit: 28800, // 90% of 32k
    },
  }

  return limits[model]
}

/**
 * Estimate token count for a given text
 * Rough estimation: ~4 characters per token (conservative for ES/EN mix)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Calculate total tokens used in a conversation
 */
export function calculateConversationTokens(
  messages: Array<{ role: 'user' | 'assistant'; text: string }>,
  systemPrompt?: string
): number {
  let total = 0

  // Add system prompt if provided
  if (systemPrompt) {
    total += estimateTokens(systemPrompt)
  }

  // Add all messages
  for (const msg of messages) {
    // Add role overhead (~4 tokens per message for formatting)
    total += 4
    // Add message content
    total += estimateTokens(msg.text)
  }

  return total
}

/**
 * Get usage percentage and status
 */
export function getTokenUsageStatus(
  usedTokens: number,
  model: 'kimi-k2-thinking' | 'moonshot-v1-32k'
): {
  percentage: number
  status: 'normal' | 'warning' | 'critical'
  canSendMessage: boolean
} {
  const limits = getTokenLimits(model)
  const percentage = Math.round((usedTokens / limits.maxTokens) * 100)

  let status: 'normal' | 'warning' | 'critical' = 'normal'
  if (usedTokens >= limits.hardLimit) {
    status = 'critical'
  } else if (usedTokens >= limits.warningThreshold) {
    status = 'warning'
  }

  return {
    percentage,
    status,
    canSendMessage: usedTokens < limits.hardLimit,
  }
}
