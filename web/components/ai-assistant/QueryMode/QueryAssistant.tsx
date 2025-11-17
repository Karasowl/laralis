/**
 * Query Mode Assistant
 *
 * Modal for asking questions about data and getting AI-powered insights
 * Uses function calling to query database and provide recommendations
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, MessageSquare, Send, Sparkles, ChevronDown, ChevronUp, AlertTriangle, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { VoiceRecorder } from '../VoiceRecorder'
import { AudioPlayer } from '../AudioPlayer'
import { DataVisualization } from '../DataVisualization'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { calculateConversationTokens, getTokenUsageStatus } from '@/lib/ai/token-counter'

interface QueryAssistantProps {
  onClose: () => void
}

interface QueryMessage {
  role: 'user' | 'assistant'
  text: string
  thinking?: string
  data?: any
}

export function QueryAssistant({ onClose }: QueryAssistantProps) {
  const t = useTranslations('aiAssistant.query')
  const tMessages = useTranslations('aiAssistant.messages')
  const { currentClinic } = useCurrentClinic()

  const [conversation, setConversation] = useState<QueryMessage[]>([])
  const [textInput, setTextInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showThinking, setShowThinking] = useState<Record<number, boolean>>({})
  const [selectedModel, setSelectedModel] = useState<'kimi-k2-thinking' | 'moonshot-v1-32k'>('kimi-k2-thinking')

  const examples = [
    t('example1'),
    t('example2'),
    t('example3'),
    t('example4'),
    t('example5'),
  ]

  // Calculate token usage
  const tokenUsage = useMemo(() => {
    const usedTokens = calculateConversationTokens(conversation)
    return getTokenUsageStatus(usedTokens, selectedModel)
  }, [conversation, selectedModel])

  // Initialize conversation with greeting
  useEffect(() => {
    if (conversation.length === 0) {
      setConversation([
        {
          role: 'assistant',
          text: tMessages('greeting'),
        },
      ])
    }
  }, [conversation.length, tMessages])

  const handleQuery = async (query: string) => {
    if (!query.trim() || isProcessing) return
    if (!currentClinic?.id) {
      setError(t('errors.noClinicSelected'))
      return
    }
    if (!tokenUsage.canSendMessage) {
      setError(t('errors.tokenLimitReached'))
      return
    }

    setIsProcessing(true)
    setError(null)

    // Add user message
    setConversation((prev) => [...prev, { role: 'user', text: query }])
    setTextInput('')

    // Add empty assistant message that we'll update with streaming
    const assistantMessageIndex = conversation.length + 1
    setConversation((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: '',
      },
    ])

    try {
      // Build conversation history from last 10 messages (excluding current query)
      const conversationHistory = conversation.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.text
      }))

      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          clinicId: currentClinic.id,
          locale: 'es',
          conversationHistory,
          model: selectedModel,
        }),
      })

      if (!response.ok) {
        // Try to read error details from response
        const errorData = await response.json().catch(() => ({ error: 'unknown', message: 'Query failed' }))

        // Set specific error message based on error type
        if (errorData.error === 'overloaded') {
          setError(t('errors.overloaded'))
        } else if (errorData.retryable) {
          setError(t('errors.serverError'))
        } else {
          setError(t('queryError'))
        }

        // Remove empty assistant message
        setConversation((prev) => prev.slice(0, -1))
        setIsProcessing(false)
        return
      }

      // Handle SSE streaming
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No reader available')
      }

      let accumulatedText = ''
      let metadata = null

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6) // Remove 'data: ' prefix

            if (data === '[DONE]') {
              continue
            }

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'content') {
                // Append content chunk
                accumulatedText += parsed.data
                setConversation((prev) => {
                  const updated = [...prev]
                  updated[assistantMessageIndex] = {
                    role: 'assistant',
                    text: accumulatedText,
                  }
                  return updated
                })
              } else if (parsed.type === 'metadata') {
                metadata = parsed.data
              }
            } catch (e) {
              console.error('[QueryAssistant] Failed to parse SSE:', e)
            }
          }
        }
      }
    } catch (err) {
      console.error('[QueryAssistant] Error:', err)
      setError(t('queryError'))
      setConversation((prev) => {
        const updated = [...prev]
        updated[assistantMessageIndex] = {
          role: 'assistant',
          text: tMessages('queryError'),
        }
        return updated
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTranscript = (text: string) => {
    handleQuery(text)
  }

  const handleExampleClick = (example: string) => {
    handleQuery(example)
  }

  const toggleThinking = (index: number) => {
    setShowThinking((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const handleNewConversation = () => {
    setConversation([
      {
        role: 'assistant',
        text: tMessages('greeting'),
      },
    ])
    setError(null)
    setShowThinking({})
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm">
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-3xl h-[90vh] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <MessageSquare className="h-6 w-6" />
                {t('title')}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
            </div>

            {/* Token Usage & Controls */}
            <div className="flex items-center gap-3">
              {/* Token Usage Indicator */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background/50">
                <div className="flex items-center gap-1.5">
                  {tokenUsage.status === 'critical' && (
                    <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
                  )}
                  {tokenUsage.status === 'warning' && (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      tokenUsage.status === 'critical'
                        ? 'text-red-600 dark:text-red-400'
                        : tokenUsage.status === 'warning'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {tokenUsage.percentage}%
                  </span>
                </div>
                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      tokenUsage.status === 'critical'
                        ? 'bg-red-500'
                        : tokenUsage.status === 'warning'
                        ? 'bg-yellow-500'
                        : 'bg-purple-500'
                    }`}
                    style={{ width: `${Math.min(tokenUsage.percentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* New Conversation Button */}
              {conversation.length > 1 && (
                <button
                  onClick={handleNewConversation}
                  className="p-2 hover:bg-background/50 rounded-lg transition-colors"
                  aria-label={t('newConversation')}
                  title={t('newConversation')}
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              )}

              {/* Model Selector */}
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as 'kimi-k2-thinking' | 'moonshot-v1-32k')}
                className="text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isProcessing}
              >
                <option value="kimi-k2-thinking">
                  🧠 K2 Thinking
                </option>
                <option value="moonshot-v1-32k">
                  ⚡ Moonshot v1
                </option>
              </select>

              <button
                onClick={onClose}
                className="p-2 hover:bg-background/50 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Conversation */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {conversation.length === 1 && (
              <div className="space-y-3 mb-6">
                <p className="text-sm font-medium text-muted-foreground">{t('examples')}</p>
                <div className="grid gap-2">
                  {examples.map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleExampleClick(example)}
                      disabled={isProcessing}
                      className="text-left p-3 text-sm border rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all disabled:opacity-50"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {conversation.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in-0 slide-in-from-bottom-2 duration-200`}
              >
                <div
                  className={`max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-muted text-foreground border'
                  } px-4 py-3 rounded-2xl`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-3 mb-2">
                      <AudioPlayer text={msg.text} />
                      {msg.thinking && (
                        <button
                          onClick={() => toggleThinking(idx)}
                          className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          <Sparkles className="h-3 w-3" />
                          {showThinking[idx] ? t('hideThinking') : t('showThinking')}
                          {showThinking[idx] ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {msg.role === 'assistant' && msg.thinking && showThinking[idx] && (
                    <div className="mb-3 p-2 bg-purple-50 dark:bg-purple-950/20 rounded text-xs text-muted-foreground border-l-2 border-purple-400">
                      <p className="font-medium mb-1">{t('thinkingProcess')}:</p>
                      <p className="whitespace-pre-wrap">{msg.thinking}</p>
                    </div>
                  )}

                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>

                  {msg.data && <DataVisualization data={msg.data} />}
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start animate-in fade-in-0">
                <div className="bg-muted px-4 py-3 rounded-2xl border">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" />
                    </div>
                    <span className="text-sm text-muted-foreground">{t('analyzing')}</span>
                    <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full">
                      {selectedModel === 'kimi-k2-thinking' ? '🧠 K2' : '⚡ v1'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg">
                <X className="h-4 w-4" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t p-4 space-y-3 bg-muted/30">
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleQuery(textInput)
                  }
                }}
                placeholder={
                  !tokenUsage.canSendMessage
                    ? t('tokenLimitReachedPlaceholder')
                    : t('askQuestion')
                }
                disabled={isProcessing || !tokenUsage.canSendMessage}
                className="flex-1 px-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              />
              <button
                onClick={() => handleQuery(textInput)}
                disabled={!textInput.trim() || isProcessing || !tokenUsage.canSendMessage}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-center">
              <div className="text-sm text-muted-foreground mr-3">o</div>
              <VoiceRecorder
                onTranscript={handleTranscript}
                onError={(err) => setError(err)}
                disabled={isProcessing}
                language="es"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
