/**
 * DeepSeek LLM Provider
 *
 * Large Language Model using DeepSeek V3.
 * Ultra-budget option with good performance.
 */

import type {
  LLMProvider,
  LLMOptions,
  Message,
  AIFunction,
  LLMResponse,
} from '../../types'
import { AI_CONFIG, PROVIDER_ENDPOINTS, DEFAULT_MODELS } from '../../config'

export class DeepSeekLLM implements LLMProvider {
  readonly name = 'deepseek'
  readonly supportsThinking = false
  readonly supportsFunctionCalling = true

  async chat(messages: Message[], options?: LLMOptions): Promise<string> {
    const model = AI_CONFIG.llm.defaultModel || DEFAULT_MODELS.llm.deepseek

    try {
      const response = await fetch(
        `${PROVIDER_ENDPOINTS.deepseek.base}${PROVIDER_ENDPOINTS.deepseek.chat}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AI_CONFIG.llm.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options?.temperature ?? AI_CONFIG.llm.temperature,
            max_tokens: options?.maxTokens,
            top_p: options?.topP,
            stream: options?.stream ?? false,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          `DeepSeek API error: ${response.status} - ${error.error?.message || 'Unknown error'}`
        )
      }

      const data = await response.json()
      return data.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('[DeepSeekLLM] Chat error:', error)
      throw new Error(
        `Failed to get response from DeepSeek: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async chatWithFunctions(
    messages: Message[],
    functions: AIFunction[],
    options?: LLMOptions
  ): Promise<LLMResponse> {
    const model = AI_CONFIG.llm.defaultModel || DEFAULT_MODELS.llm.deepseek

    try {
      // DeepSeek uses OpenAI-compatible API
      const tools = functions.map((fn) => ({
        type: 'function' as const,
        function: {
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters,
        },
      }))

      const response = await fetch(
        `${PROVIDER_ENDPOINTS.deepseek.base}${PROVIDER_ENDPOINTS.deepseek.chat}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AI_CONFIG.llm.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            tools,
            tool_choice: 'auto',
            temperature: options?.temperature ?? AI_CONFIG.llm.temperature,
            max_tokens: options?.maxTokens,
            top_p: options?.topP,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          `DeepSeek API error: ${response.status} - ${error.error?.message || 'Unknown error'}`
        )
      }

      const data = await response.json()
      const message = data.choices[0]?.message

      if (!message) {
        throw new Error('No message returned from DeepSeek')
      }

      const result: LLMResponse = {
        content: message.content,
      }

      // Parse tool call if present
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0]
        result.functionCall = {
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments),
        }
      }

      return result
    } catch (error) {
      console.error('[DeepSeekLLM] Function calling error:', error)
      throw new Error(
        `Failed to get response from DeepSeek with functions: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
