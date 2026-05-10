/**
 * OpenAI LLM Provider
 *
 * Large Language Model using OpenAI GPT-4o-mini.
 * Fallback option with excellent function calling support.
 */

import type {
  LLMProvider,
  LLMOptions,
  Message,
  AIFunction,
  LLMResponse,
} from '../../types'
import { getAIConfig, PROVIDER_ENDPOINTS, DEFAULT_MODELS } from '../../config'

export class OpenAILLM implements LLMProvider {
  readonly name = 'openai'
  readonly supportsThinking = false
  readonly supportsFunctionCalling = true

  async chat(messages: Message[], options?: LLMOptions): Promise<string> {
    const config = getAIConfig()
    const model = config.llm.defaultModel || DEFAULT_MODELS.llm.openai

    try {
      const response = await fetch(
        `${PROVIDER_ENDPOINTS.openai.base}${PROVIDER_ENDPOINTS.openai.chat}`,
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
            stream: options?.stream ?? false,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          `OpenAI API error: ${response.status} - ${error.error?.message || 'Unknown error'}`
        )
      }

      const data = await response.json()
      return data.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('[OpenAILLM] Chat error:', error)
      throw new Error(
        `Failed to get response from OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async chatWithFunctions(
    messages: Message[],
    functions: AIFunction[],
    options?: LLMOptions
  ): Promise<LLMResponse> {
    const config = getAIConfig()
    const model = config.llm.defaultModel || DEFAULT_MODELS.llm.openai

    try {
      // Convert AIFunction to OpenAI tools format
      const tools = functions.map((fn) => ({
        type: 'function' as const,
        function: {
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters,
        },
      }))

      const response = await fetch(
        `${PROVIDER_ENDPOINTS.openai.base}${PROVIDER_ENDPOINTS.openai.chat}`,
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
          `OpenAI API error: ${response.status} - ${error.error?.message || 'Unknown error'}`
        )
      }

      const data = await response.json()
      const message = data.choices[0]?.message

      if (!message) {
        throw new Error('No message returned from OpenAI')
      }

      const result: LLMResponse = {
        content: message.content,
      }

      // Parse tool call if present (OpenAI uses "tool_calls" not "function_call")
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0]
        result.functionCall = {
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments),
        }
      }

      return result
    } catch (error) {
      console.error('[OpenAILLM] Function calling error:', error)
      throw new Error(
        `Failed to get response from OpenAI with functions: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
