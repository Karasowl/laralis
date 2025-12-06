/**
 * Query Mode Assistant
 *
 * Modal for asking questions about data and getting AI-powered insights
 * Uses function calling to query database and provide recommendations
 */

'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { X, MessageSquare, Send, Sparkles, ChevronDown, ChevronUp, AlertTriangle, RotateCcw, ArrowDown, Minimize2, Menu, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { VoiceRecorder } from '../VoiceRecorder'
import { AudioPlayer } from '../AudioPlayer'
import { DataVisualization } from '../DataVisualization'
import { MessageContent } from '../MessageContent'
import { ActionConfirmCard } from '@/components/ui/action-confirm-card'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { calculateConversationTokens, getTokenUsageStatus } from '@/lib/ai/token-counter'
import ChatHistoryList from './ChatHistoryList'
import type { ActionSuggestion, ActionResult } from '@/lib/ai/types'

interface QueryAssistantProps {
  onClose: () => void
  sessionId?: string | null
  onSessionCreated?: (sessionId: string) => void
}

interface QueryMessage {
  role: 'user' | 'assistant'
  text: string
  thinking?: string
  data?: any
  responseTimeMs?: number
  suggestedAction?: ActionSuggestion
}

export function QueryAssistant({ onClose, sessionId, onSessionCreated }: QueryAssistantProps) {
  const t = useTranslations('aiAssistant.query')
  const tMessages = useTranslations('aiAssistant.messages')
  const tCommon = useTranslations('common')
  const { currentClinic } = useCurrentClinic()

  const [conversation, setConversation] = useState<QueryMessage[]>([])
  const [textInput, setTextInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showThinking, setShowThinking] = useState<Record<number, boolean>>({})
  const [selectedModel, setSelectedModel] = useState<'kimi-k2-thinking' | 'moonshot-v1-32k'>('kimi-k2-thinking')
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Chat History State
  const [showHistory, setShowHistory] = useState(false)
  const [currentSessionTitle, setCurrentSessionTitle] = useState<string>('')
  const [hasAutoNamed, setHasAutoNamed] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lara-sidebar-collapsed') === 'true'
    }
    return false
  })
  const [isExportingData, setIsExportingData] = useState(false)

  // Set default title once translations are loaded
  const defaultTitle = t('defaultSessionTitle')

  // Smart Scroll State
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false)

  const examples = [
    t('example1'),
    t('example2'),
    t('example3'),
    t('example4'),
    t('example5'),
  ]

  // Initialize session title with default if empty
  useEffect(() => {
    if (!currentSessionTitle && defaultTitle) {
      setCurrentSessionTitle(defaultTitle)
    }
  }, [currentSessionTitle, defaultTitle])

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('lara-sidebar-collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  // Calculate token usage
  const tokenUsage = useMemo(() => {
    const usedTokens = calculateConversationTokens(conversation)
    return getTokenUsageStatus(usedTokens, selectedModel)
  }, [conversation, selectedModel])

  // Load user preference on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings/user?key=ai_model_preference')
        if (res.ok) {
          const data = await res.json()
          if (data.settings?.ai_model_preference) {
            setSelectedModel(data.settings.ai_model_preference)
          }
        }
      } catch (e) {
        console.error('Failed to load user settings:', e)
      } finally {
        setIsLoadingSettings(false)
      }
    }
    loadSettings()
  }, [])

  // Load Chat History
  useEffect(() => {
    const loadHistory = async () => {
      if (!currentClinic?.id) return

      setIsLoadingHistory(true)
      try {
        let url = `/api/ai/chat/history?clinicId=${currentClinic.id}`
        if (sessionId) {
          url = `/api/ai/chat/history?sessionId=${sessionId}`
        }

        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          if (data.session) {
            if (!sessionId && onSessionCreated) {
              onSessionCreated(data.session.id)
            }

            // Update session title and auto-naming state
            setCurrentSessionTitle(data.session.title || defaultTitle)
            setHasAutoNamed(data.session.title !== defaultTitle)

            if (data.messages && data.messages.length > 0) {
              const mappedMessages = data.messages.map((msg: any) => ({
                role: msg.role,
                text: msg.content,
                thinking: msg.metadata?.thinking,
                data: msg.metadata?.data,
                responseTimeMs: msg.metadata?.responseTimeMs,
                suggestedAction: msg.metadata?.suggestedAction
              }))
              setConversation(mappedMessages)
              // Scroll to bottom initially
              setTimeout(scrollToBottom, 100)
            } else {
              // Initialize with greeting if new session
              setConversation([{ role: 'assistant', text: tMessages('greeting') }])
            }
          } else {
            // No session found, start fresh
            setConversation([{ role: 'assistant', text: tMessages('greeting') }])
          }
        }
      } catch (e) {
        console.error('Failed to load history:', e)
        setConversation([{ role: 'assistant', text: tMessages('greeting') }])
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadHistory()
  }, [currentClinic?.id, sessionId]) // Dependency on sessionId to reload if it changes

  // Smart Auto-scroll Logic
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setUserHasScrolledUp(false)
    setShowScrollButton(false)
  }

  const handleScroll = () => {
    if (!scrollContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100

    if (isAtBottom) {
      setUserHasScrolledUp(false)
      setShowScrollButton(false)
    } else {
      setUserHasScrolledUp(true)
      setShowScrollButton(true)
    }
  }

  // Auto-scroll effect (only if user hasn't scrolled up)
  useEffect(() => {
    if (!userHasScrolledUp) {
      scrollToBottom()
    }
  }, [conversation, userHasScrolledUp])

  // Save preference when changed
  const handleModelChange = async (model: 'kimi-k2-thinking' | 'moonshot-v1-32k') => {
    setSelectedModel(model)
    try {
      await fetch('/api/settings/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'ai_model_preference',
          value: model
        })
      })
    } catch (e) {
      console.error('Failed to save user settings:', e)
    }
  }

  const saveMessageToDB = async (role: 'user' | 'assistant', text: string, metadata?: any) => {
    if (!currentClinic?.id) return

    try {
      // Create session if doesn't exist
      let currentSessionId = sessionId
      if (!currentSessionId) {
        const sessionRes = await fetch('/api/ai/chat/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_session',
            clinicId: currentClinic.id
          })
        })
        const sessionData = await sessionRes.json()
        currentSessionId = sessionData.session.id
        if (onSessionCreated) onSessionCreated(currentSessionId!)
      }

      // Save message
      await fetch('/api/ai/chat/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_message',
          sessionId: currentSessionId,
          role,
          message: text,
          metadata
        })
      })
    } catch (e) {
      console.error('Failed to save message:', e)
    }
  }

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
    setUserHasScrolledUp(false) // Force scroll to bottom on new message

    // Add user message
    setConversation((prev) => [...prev, { role: 'user', text: query }])
    saveMessageToDB('user', query)
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

    // Track response time
    const startTime = Date.now()

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
      let metadata: any = null

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6) // Remove 'data: ' prefix

            if (data === '[DONE]') {
              // Calculate response time when done
              const responseTimeMs = Date.now() - startTime
              setConversation((prev) => {
                const updated = [...prev]
                updated[assistantMessageIndex] = {
                  ...updated[assistantMessageIndex],
                  responseTimeMs,
                  thinking: metadata?.thinking,
                  data: metadata?.data,
                  suggestedAction: metadata?.suggestedAction,
                }
                return updated
              })

              // Save assistant message to DB
              saveMessageToDB('assistant', accumulatedText, { ...metadata, responseTimeMs })

              // Auto-name session after first assistant response
              if (!hasAutoNamed && sessionId && conversation.length === 1) {
                autoNameSession(query, accumulatedText)
              }

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

  const autoNameSession = async (userMessage: string, assistantMessage: string) => {
    if (!sessionId || hasAutoNamed) return

    try {
      const conversationContext = `Usuario: ${userMessage}\nAsistente: ${assistantMessage.substring(0, 200)}`

      const response = await fetch('/api/ai/chat/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_title',
          sessionId,
          message: conversationContext
        })
      })

      if (response.ok) {
        const { session } = await response.json()
        setCurrentSessionTitle(session.title)
        setHasAutoNamed(true)
      }
    } catch (e) {
      console.error('Failed to auto-name session:', e)
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

  const handleNewConversation = async () => {
    // Create new session in DB
    if (currentClinic?.id) {
      try {
        const res = await fetch('/api/ai/chat/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_session',
            clinicId: currentClinic.id
          })
        })
        const data = await res.json()
        if (data.session && onSessionCreated) {
          onSessionCreated(data.session.id)
        }
      } catch (e) {
        console.error('Failed to create new session:', e)
      }
    }

    setConversation([
      {
        role: 'assistant',
        text: tMessages('greeting'),
      },
    ])
    setError(null)
    setShowThinking({})
    setHasAutoNamed(false)
    setCurrentSessionTitle(defaultTitle)
  }

  const handleExportForAI = async () => {
    if (!currentClinic?.id) return

    setIsExportingData(true)
    try {
      const response = await fetch(`/api/clinic/${currentClinic.id}/export?type=both`)
      if (!response.ok) throw new Error('Export failed')

      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `clinic-ai-export-${currentClinic.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed:', e)
      setError(t('exportError'))
    } finally {
      setIsExportingData(false)
    }
  }

  const handleActionConfirm = async (messageIndex: number, result: ActionResult) => {
    // Add success message to conversation
    const successMessage = result.result?.changes?.join('\n') || tMessages('actionExecutedSuccess')

    setConversation((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: `✅ ${successMessage}`,
      },
    ])

    // Save success message to DB
    saveMessageToDB('assistant', `✅ ${successMessage}`)

    // Remove suggestedAction from the original message
    setConversation((prev) => {
      const updated = [...prev]
      if (updated[messageIndex]) {
        updated[messageIndex] = {
          ...updated[messageIndex],
          suggestedAction: undefined,
        }
      }
      return updated
    })
  }

  const handleActionReject = (messageIndex: number) => {
    // Simply remove the suggestedAction from the message
    setConversation((prev) => {
      const updated = [...prev]
      if (updated[messageIndex]) {
        updated[messageIndex] = {
          ...updated[messageIndex],
          suggestedAction: undefined,
        }
      }
      return updated
    })
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background sm:bg-black/50 sm:backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="relative w-full h-full sm:h-[90vh] sm:max-w-5xl bg-background sm:border sm:rounded-2xl shadow-2xl flex overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-200">
        {/* Chat History Sidebar (Mobile Overlay) */}
        {showHistory && (
          <div className="absolute inset-0 z-50 bg-background sm:hidden">
            <ChatHistoryList
              clinicId={currentClinic?.id || ''}
              currentSessionId={sessionId || null}
              onSelectSession={(newSessionId) => {
                if (onSessionCreated) onSessionCreated(newSessionId)
                setShowHistory(false)
              }}
              onCreateNewSession={() => {
                handleNewConversation()
                setShowHistory(false)
              }}
              onClose={() => setShowHistory(false)}
            />
          </div>
        )}

        {/* Desktop Sidebar */}
        <div
          className={`hidden sm:flex flex-col border-r bg-muted/30 transition-all duration-300 ease-in-out ${
            sidebarCollapsed ? 'w-0 opacity-0' : 'w-[280px] opacity-100'
          }`}
        >
          {!sidebarCollapsed && (
            <ChatHistoryList
              clinicId={currentClinic?.id || ''}
              currentSessionId={sessionId || null}
              onSelectSession={(newSessionId) => {
                if (onSessionCreated) onSessionCreated(newSessionId)
              }}
              onCreateNewSession={handleNewConversation}
            />
          )}
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-gradient-to-r from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Sidebar Toggle (Desktop Only) */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden sm:flex p-2 hover:bg-background/50 rounded-lg transition-colors shrink-0"
                aria-label={sidebarCollapsed ? t('history.showSidebar') : t('history.hideSidebar')}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <ChevronLeft className="h-5 w-5" />
                )}
              </button>

              {/* Menu Button (Mobile Only) */}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 hover:bg-background/50 rounded-lg transition-colors sm:hidden shrink-0"
                aria-label={t('history.title')}
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 truncate">
                  <MessageSquare className="h-6 w-6 shrink-0" />
                  <span className="truncate">{currentSessionTitle}</span>
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block">{t('subtitle')}</p>
              </div>
            </div>

            {/* Token Usage & Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Token Usage Indicator (Simplified for mobile) */}
              <div className="flex items-center gap-2 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg border bg-background/50">
                <div className="flex items-center gap-1.5">
                  {tokenUsage.status === 'critical' && (
                    <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive animate-pulse" />
                  )}
                  <span className={`text-xs sm:text-sm font-medium ${tokenUsage.status === 'critical' ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                    {tokenUsage.percentage}%
                  </span>
                </div>
                <div className="w-10 sm:w-20 h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden hidden sm:block">
                  <div
                    className={`h-full transition-all duration-300 ${tokenUsage.status === 'critical' ? 'bg-destructive' : 'bg-primary'
                      }`}
                    style={{ width: `${Math.min(tokenUsage.percentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* New Conversation Button */}
              <button
                onClick={handleNewConversation}
                className="p-2 hover:bg-background/50 rounded-lg transition-colors"
                aria-label={t('newConversation')}
              >
                <RotateCcw className="h-5 w-5" />
              </button>

              {/* Export for AI Button */}
              <button
                onClick={handleExportForAI}
                disabled={isExportingData || !currentClinic}
                className="p-2 hover:bg-background/50 rounded-lg transition-colors disabled:opacity-50 hidden sm:block"
                aria-label={t('exportForAI')}
                title={t('exportForAI')}
              >
                <Download className={`h-5 w-5 ${isExportingData ? 'animate-pulse' : ''}`} />
              </button>

              {/* Model Selector (Compact on mobile) */}
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value as 'kimi-k2-thinking' | 'moonshot-v1-32k')}
                className="text-xs sm:text-sm border rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary max-w-[100px] sm:max-w-none"
                disabled={isProcessing}
              >
                <option value="kimi-k2-thinking">K2 Thinking</option>
                <option value="moonshot-v1-32k">Moonshot v1</option>
              </select>

              {/* Minimize/Close Button */}
              <button
                onClick={onClose}
                className="p-2 hover:bg-background/50 rounded-lg transition-colors"
                aria-label="Close"
              >
                <Minimize2 className="h-5 w-5 sm:hidden" />
                <X className="h-6 w-6 hidden sm:block" />
              </button>
            </div>
          </div>

          {/* Conversation */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scroll-smooth"
          >
            {isLoadingHistory && conversation.length === 0 && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}

            {conversation.length === 1 && !isLoadingHistory && (
              <div className="space-y-3 mb-6">
                <p className="text-sm font-medium text-muted-foreground">{t('examples')}</p>
                <div className="grid gap-2">
                  {examples.map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleExampleClick(example)}
                      disabled={isProcessing}
                      className="text-left p-3 text-sm border rounded-lg hover:border-primary hover:bg-primary/10 dark:hover:bg-primary/20 transition-all disabled:opacity-50"
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
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200`}
              >
                <div
                  className={`max-w-[95%] sm:max-w-[80%] ${msg.role === 'user'
                    ? 'bg-primary text-primary-foreground px-4 py-3'
                    : 'bg-muted/50 text-foreground border backdrop-blur-sm px-5 py-4'
                    } rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-medium text-primary dark:text-primary/80">Lara</span>
                      {msg.text && <AudioPlayer text={msg.text} />}
                      {msg.thinking && (
                        <button
                          onClick={() => toggleThinking(idx)}
                          className="flex items-center gap-1 text-xs text-primary dark:text-primary/80 hover:underline"
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
                    <div className="mb-3 p-2 bg-primary/10 dark:bg-primary/20 rounded text-xs text-muted-foreground border-l-2 border-primary/40 backdrop-blur-sm">
                      <p className="font-medium mb-1">{t('thinkingProcess')}:</p>
                      <p className="whitespace-pre-wrap">{msg.thinking}</p>
                    </div>
                  )}

                  <MessageContent text={msg.text} role={msg.role} />

                  {msg.data && <DataVisualization data={msg.data} />}

                  {/* Response time indicator for assistant messages */}
                  {msg.role === 'assistant' && msg.responseTimeMs && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {msg.responseTimeMs < 1000
                        ? `${msg.responseTimeMs}ms`
                        : `${(msg.responseTimeMs / 1000).toFixed(1)}s`}
                    </div>
                  )}
                </div>

                {/* Action Confirmation Card (below assistant message) */}
                {msg.role === 'assistant' && msg.suggestedAction && currentClinic?.id && (
                  <ActionConfirmCard
                    suggestion={msg.suggestedAction}
                    clinicId={currentClinic.id}
                    onConfirm={(result) => handleActionConfirm(idx, result)}
                    onReject={() => handleActionReject(idx)}
                  />
                )}
              </div>
            ))}

            {/* Auto-scroll anchor */}
            <div ref={messagesEndRef} />

            {isProcessing && (
              <div className="flex justify-start animate-in fade-in-0">
                <div className="bg-muted/50 px-4 py-3 rounded-2xl border backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                    </div>
                    <span className="text-sm text-muted-foreground">{t('analyzing')}</span>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary/80 rounded-full">
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

          {/* Scroll to Bottom Button */}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-24 right-6 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all animate-in fade-in zoom-in duration-200 z-10"
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="h-5 w-5" />
            </button>
          )}

          {/* Input Area */}
          <div className="border-t p-4 space-y-3 bg-muted/30 shrink-0 pb-safe">
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
                className="flex-1 px-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
              <button
                onClick={() => handleQuery(textInput)}
                disabled={!textInput.trim() || isProcessing || !tokenUsage.canSendMessage}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-3">
              <div className="flex-1 h-px bg-border max-w-[60px]" />
              <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 bg-muted/50 rounded-full border border-border">
                {tCommon('or')}
              </span>
              <div className="flex-1 h-px bg-border max-w-[60px]" />
              <VoiceRecorder
                onTranscript={handleTranscript}
                onError={(err) => setError(err)}
                disabled={isProcessing}
                language="es"
              />
            </div>
          </div>
        </div>
        {/* End Main Chat Area */}
      </div>
    </div>
  )
}
