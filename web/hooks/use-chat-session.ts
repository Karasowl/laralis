/**
 * Hook: useChatSession
 *
 * Manages chat sessions with Lara AI assistant.
 * Provides methods to create, load, and manage conversations.
 */

import { useState, useCallback, useEffect } from 'react'
import { useCurrentClinic } from './use-current-clinic'

// Types
export interface ChatSession {
  id: string
  clinic_id: string
  user_id: string
  mode: 'entry' | 'query'
  title: string | null
  started_at: string
  ended_at: string | null
  last_message_at: string
  message_count: number
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking_process?: string
  model_used?: string
  tokens_used?: number
  action_suggested?: any
  action_executed?: boolean
  action_result?: any
  entity_type?: string
  extracted_data?: any
  audio_duration_ms?: number
  created_at: string
}

interface UseChatSessionOptions {
  mode: 'entry' | 'query'
  autoCreate?: boolean // Auto-create session on mount
}

interface UseChatSessionReturn {
  // State
  session: ChatSession | null
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null

  // Session management
  createSession: () => Promise<ChatSession | null>
  loadSession: (sessionId: string) => Promise<void>
  endSession: () => Promise<void>
  archiveSession: () => Promise<void>

  // Message management
  addMessage: (message: Omit<ChatMessage, 'id' | 'session_id' | 'created_at'>) => Promise<ChatMessage | null>

  // History
  loadHistory: (limit?: number) => Promise<ChatSession[]>
  history: ChatSession[]
}

export function useChatSession(options: UseChatSessionOptions): UseChatSessionReturn {
  const { mode, autoCreate = false } = options
  const { clinicId } = useCurrentClinic()

  const [session, setSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<ChatSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Create a new chat session
   */
  const createSession = useCallback(async (): Promise<ChatSession | null> => {
    if (!clinicId) {
      setError('No clinic selected')
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          clinicId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create session')
      }

      const { data } = await response.json()
      setSession(data)
      setMessages([])
      return data
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [clinicId, mode])

  /**
   * Load an existing session with messages
   */
  const loadSession = useCallback(async (sessionId: string): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/ai/sessions/${sessionId}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load session')
      }

      const { data } = await response.json()
      setSession(data.session)
      setMessages(data.messages)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * End the current session
   */
  const endSession = useCallback(async (): Promise<void> => {
    if (!session) return

    try {
      await fetch(`/api/ai/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ended_at: new Date().toISOString(),
        }),
      })

      setSession(null)
      setMessages([])
    } catch (err: any) {
      setError(err.message)
    }
  }, [session])

  /**
   * Archive the current session
   */
  const archiveSession = useCallback(async (): Promise<void> => {
    if (!session) return

    try {
      await fetch(`/api/ai/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_archived: true,
          ended_at: new Date().toISOString(),
        }),
      })

      setSession(null)
      setMessages([])
    } catch (err: any) {
      setError(err.message)
    }
  }, [session])

  /**
   * Add a message to the current session
   */
  const addMessage = useCallback(async (
    message: Omit<ChatMessage, 'id' | 'session_id' | 'created_at'>
  ): Promise<ChatMessage | null> => {
    if (!session) {
      setError('No active session')
      return null
    }

    try {
      const response = await fetch(`/api/ai/sessions/${session.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add message')
      }

      const { data } = await response.json()
      setMessages(prev => [...prev, data])
      return data
    } catch (err: any) {
      setError(err.message)
      return null
    }
  }, [session])

  /**
   * Load session history
   */
  const loadHistory = useCallback(async (limit = 20): Promise<ChatSession[]> => {
    if (!clinicId) return []

    try {
      const response = await fetch(
        `/api/ai/sessions?clinicId=${clinicId}&mode=${mode}&limit=${limit}`
      )

      if (!response.ok) {
        throw new Error('Failed to load history')
      }

      const { data } = await response.json()
      setHistory(data)
      return data
    } catch (err: any) {
      setError(err.message)
      return []
    }
  }, [clinicId, mode])

  // Auto-create session on mount if enabled
  useEffect(() => {
    if (autoCreate && clinicId && !session) {
      createSession()
    }
  }, [autoCreate, clinicId, session, createSession])

  return {
    session,
    messages,
    isLoading,
    error,
    createSession,
    loadSession,
    endSession,
    archiveSession,
    addMessage,
    loadHistory,
    history,
  }
}

/**
 * Hook for submitting feedback on AI messages
 */
export function useAIFeedback() {
  const { clinicId } = useCurrentClinic()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitFeedback = useCallback(async (
    messageId: string,
    rating: 'positive' | 'negative',
    comment?: string,
    queryType?: string
  ): Promise<boolean> => {
    if (!clinicId) return false

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          rating,
          comment,
          query_type: queryType,
          clinicId,
        }),
      })

      return response.ok
    } catch {
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [clinicId])

  return { submitFeedback, isSubmitting }
}
