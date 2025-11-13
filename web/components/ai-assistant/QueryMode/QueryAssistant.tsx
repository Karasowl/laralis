/**
 * Query Mode Assistant
 *
 * Modal for asking questions about data and getting AI-powered insights
 * Uses function calling to query database and provide recommendations
 */

'use client'

import { useState, useEffect } from 'react'
import { X, MessageSquare, Send, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { VoiceRecorder } from '../VoiceRecorder'
import { AudioPlayer } from '../AudioPlayer'
import { DataVisualization } from '../DataVisualization'
import { useCurrentClinic } from '@/hooks/use-current-clinic'

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

  const examples = [
    t('example1'),
    t('example2'),
    t('example3'),
    t('example4'),
    t('example5'),
  ]

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

    setIsProcessing(true)
    setError(null)

    // Add user message
    setConversation((prev) => [...prev, { role: 'user', text: query }])
    setTextInput('')

    // Add placeholder for streaming response
    const streamingMessageIndex = conversation.length + 1
    setConversation((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: '',
      },
    ])

    try {
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          clinicId: currentClinic.id,
          locale: 'es',
        }),
      })

      if (!response.ok) {
        throw new Error('Query failed')
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // Read streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ''
      let buffer = '' // Buffer for incomplete chunks

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Append to buffer
        buffer += decoder.decode(value, { stream: true })

        // Process complete lines (ending with \n\n for SSE)
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim()
              if (jsonStr) {
                const data = JSON.parse(jsonStr)
                if (data.content) {
                  accumulatedText += data.content
                  // Update message in real-time
                  setConversation((prev) => {
                    const newConv = [...prev]
                    newConv[streamingMessageIndex] = {
                      role: 'assistant',
                      text: accumulatedText,
                    }
                    return newConv
                  })
                }
              }
            } catch (e) {
              // Skip invalid JSON
              console.warn('[QueryAssistant] Failed to parse SSE data:', e)
            }
          }
        }
      }
    } catch (err) {
      console.error('[QueryAssistant] Error:', err)
      setError(t('queryError'))
      setConversation((prev) => {
        const newConv = [...prev]
        newConv[streamingMessageIndex] = {
          role: 'assistant',
          text: tMessages('queryError'),
        }
        return newConv
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
            <button
              onClick={onClose}
              className="p-2 hover:bg-background/50 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
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
                placeholder={t('askQuestion')}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              />
              <button
                onClick={() => handleQuery(textInput)}
                disabled={!textInput.trim() || isProcessing}
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
