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

  async chat(messages: Message[], options?: LLMOptions): Promise<string> {
    const config = getAIConfig()
    const model = options?.maxTokens
      ? config.llm.defaultModel || DEFAULT_MODELS.llm.kimi
      : DEFAULT_MODELS.llm.kimi

    try {
      const response = await fetch(
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
            stream: options?.stream ?? false,
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

  async chatWithFunctions(
    messages: Message[],
    functions: AIFunction[],
    options?: LLMOptions
  ): Promise<LLMResponse> {
    const config = getAIConfig()
    const model = config.llm.defaultModel || DEFAULT_MODELS.llm.kimi

    try {
      const response = await fetch(
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
            functions,
            function_call: 'auto',
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

      // Parse function call if present
      if (message.function_call) {
        result.functionCall = {
          name: message.function_call.name,
          arguments: JSON.parse(message.function_call.arguments),
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
