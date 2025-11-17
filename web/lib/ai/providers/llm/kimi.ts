/**
 * Kimi K2 Thinking LLM Provider
 *
 * Large Language Model using Moonshot AI's Kimi K2 with thinking capability.
 * Best for complex reasoning and multi-step queries.
 */

import type {
  LLMProvider,
  LLMOptions,
  Message,
  AIFunction,
  LLMResponse,
} from '../../types'
import { getAIConfig, PROVIDER_ENDPOINTS, DEFAULT_MODELS } from '../../config'

export class KimiLLM implements LLMProvider {
  readonly name = 'kimi'
  readonly supportsThinking = true
  readonly supportsFunctionCalling = true

  /**
   * Fetch with automatic retry for temporary errors (429, 503)
   * Implements exponential backoff: 2s -> 4s -> 8s
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 3
  ): Promise<Response> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const response = await fetch(url, options)

      // Success - return immediately
      if (response.ok) {
        return response
      }

      // Check if it's a retryable error (429 or 503)
      const isRetryable = response.status === 429 || response.status === 503

      if (isRetryable && attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s (capped at 10s)
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
        console.log(`[KimiLLM] Error ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`)

        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // Not retryable or max retries exceeded - return error response
      return response
    }

    throw new Error('Max retries exceeded')
  }

  async chat(messages: Message[], options?: LLMOptions): Promise<string> {
    const config = getAIConfig()
    const model = config.llm.defaultModel || DEFAULT_MODELS.llm.kimi

    try {
      const response = await this.fetchWithRetry(
        `${PROVIDER_ENDPOINTS.kimi.base}${PROVIDER_ENDPOINTS.kimi.chat}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.llm.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options?.temperature ?? config.llm.temperature,
            max_tokens: options?.maxTokens,
            top_p: options?.topP,
            stream: false, // Non-streaming version
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          `Kimi API error: ${response.status} - ${error.error?.message || 'Unknown error'}`
        )
      }

      const data = await response.json()
      return data.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('[KimiLLM] Chat error:', error)
      throw new Error(
        `Failed to get response from Kimi: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Chat with streaming support
   * Returns a ReadableStream that yields SSE-formatted chunks
   */
  async chatStream(messages: Message[], options?: LLMOptions): Promise<ReadableStream> {
    const config = getAIConfig()
    const model = options?.model || config.llm.defaultModel || DEFAULT_MODELS.llm.kimi

    const response = await this.fetchWithRetry(
      `${PROVIDER_ENDPOINTS.kimi.base}${PROVIDER_ENDPOINTS.kimi.chat}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.llm.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? config.llm.temperature,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
          stream: true, // Enable streaming
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        `Kimi API error: ${response.status} - ${error.error?.message || 'Unknown error'}`
      )
    }

    if (!response.body) {
      throw new Error('Response body is null')
    }

    return response.body
  }

  async chatWithFunctions(
    messages: Message[],
    functions: AIFunction[],
    options?: LLMOptions
  ): Promise<LLMResponse> {
    const config = getAIConfig()
    const model = config.llm.defaultModel || DEFAULT_MODELS.llm.kimi

    try {
      // Convert functions to tools format (new OpenAI standard)
      const tools = functions.map((fn) => ({
        type: 'function' as const,
        function: {
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters,
        },
      }))

      const response = await this.fetchWithRetry(
        `${PROVIDER_ENDPOINTS.kimi.base}${PROVIDER_ENDPOINTS.kimi.chat}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.llm.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            tools,
            tool_choice: 'auto',
            temperature: options?.temperature ?? config.llm.temperature,
            max_tokens: options?.maxTokens,
            top_p: options?.topP,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          `Kimi API error: ${response.status} - ${error.error?.message || 'Unknown error'}`
        )
      }

      const data = await response.json()
      const message = data.choices[0]?.message

      if (!message) {
        throw new Error('No message returned from Kimi')
      }

      const result: LLMResponse = {
        content: message.content,
      }

      // Parse tool calls if present (new format)
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0]
        result.functionCall = {
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments),
          toolCallId: toolCall.id, // Save tool_call_id for response
        }
      }

      // Kimi K2 Thinking provides reasoning process
      if (data.thinking) {
        result.thinkingProcess = data.thinking
      }

      return result
    } catch (error) {
      console.error('[KimiLLM] Function calling error:', error)
      throw new Error(
        `Failed to get response from Kimi with functions: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
