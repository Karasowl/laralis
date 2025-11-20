/**
 * Chat History List Component
 *
 * Displays a list of past chat sessions with:
 * - Inline edit for session titles
 * - Delete functionality with confirmation
 * - Relative timestamps
 * - Active session highlighting
 * - Mobile-optimized full-screen layout
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react'

interface ChatSession {
  id: string
  title: string
  updated_at: string
  created_at: string
}

interface ChatHistoryListProps {
  clinicId: string
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onCreateNewSession: () => void
  onClose?: () => void
}

export default function ChatHistoryList({
  clinicId,
  currentSessionId,
  onSelectSession,
  onCreateNewSession,
  onClose
}: ChatHistoryListProps) {
  const t = useTranslations('aiAssistant.query.history')
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Load sessions on mount and when clinicId changes
  useEffect(() => {
    loadSessions()
  }, [clinicId])

  const loadSessions = async () => {
    if (!clinicId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/ai/chat/history?mode=list&clinicId=${clinicId}`)
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch (e) {
      console.error('Failed to load chat history:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleEditStart = (session: ChatSession) => {
    setEditingId(session.id)
    setEditTitle(session.title)
  }

  const handleEditSave = async (sessionId: string) => {
    if (!editTitle.trim()) {
      setEditingId(null)
      return
    }

    try {
      const res = await fetch('/api/ai/chat/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          title: editTitle.trim()
        })
      })

      if (res.ok) {
        // Update local state
        setSessions(prev =>
          prev.map(s => (s.id === sessionId ? { ...s, title: editTitle.trim() } : s))
        )
      }
    } catch (e) {
      console.error('Failed to update title:', e)
    } finally {
      setEditingId(null)
    }
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditTitle('')
  }

  const handleDeleteConfirm = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/ai/chat/history?sessionId=${sessionId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        // Remove from local state
        setSessions(prev => prev.filter(s => s.id !== sessionId))

        // If the deleted session was the current one, create a new session
        if (sessionId === currentSessionId) {
          onCreateNewSession()
        }
      }
    } catch (e) {
      console.error('Failed to delete session:', e)
    } finally {
      setDeleteConfirmId(null)
    }
  }

  // Relative time formatting
  const getRelativeTime = (dateString: string): string => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)
    const diffWeek = Math.floor(diffDay / 7)
    const diffMonth = Math.floor(diffDay / 30)

    if (diffSec < 10) return t('now')
    if (diffSec < 60) return t('justNow')
    if (diffMin < 60) return t('minutesAgo', { minutes: diffMin })
    if (diffHour < 24) return t('hoursAgo', { hours: diffHour })
    if (diffDay < 7) return t('daysAgo', { days: diffDay })
    if (diffWeek < 4) return t('weeksAgo', { weeks: diffWeek })
    return t('monthsAgo', { months: diffMonth })
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* New Chat Button */}
      <div className="p-4">
        <button
          onClick={onCreateNewSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-medium shadow-lg hover:shadow-xl"
        >
          <Plus className="h-5 w-5" />
          {t('newChat')}
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-2">{t('emptyHistory')}</div>
            <div className="text-sm text-muted-foreground">{t('emptyHistoryDesc')}</div>
          </div>
        )}

        {!loading && sessions.map((session) => {
          const isActive = session.id === currentSessionId
          const isEditing = editingId === session.id
          const isDeleting = deleteConfirmId === session.id

          return (
            <div
              key={session.id}
              className={`group relative p-3 rounded-lg border transition-all ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-500'
                  : 'hover:bg-muted border-transparent'
              }`}
            >
              {/* Delete Confirmation Overlay */}
              {isDeleting && (
                <div className="absolute inset-0 bg-background/95 rounded-lg flex flex-col items-center justify-center gap-3 z-10 p-4">
                  <p className="text-sm font-medium text-center">{t('confirmDelete')}</p>
                  <p className="text-xs text-muted-foreground text-center">{t('confirmDeleteDesc')}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteConfirm(session.id)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                    >
                      {t('confirmDelete')}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1.5 bg-muted rounded-lg hover:bg-muted/70 text-sm"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              )}

              {/* Session Content */}
              <div
                className="cursor-pointer"
                onClick={() => !isEditing && !isDeleting && onSelectSession(session.id)}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditSave(session.id)
                        if (e.key === 'Escape') handleEditCancel()
                      }}
                      className="flex-1 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handleEditSave(session.id)}
                      className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/20 rounded"
                      aria-label={t('save')}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </button>
                    <button
                      onClick={handleEditCancel}
                      className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                      aria-label={t('cancel')}
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium line-clamp-2 flex-1">
                        {session.title}
                      </h4>

                      {/* Action Buttons (visible on hover or active) */}
                      <div className={`flex items-center gap-1 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditStart(session)
                          }}
                          className="p-1.5 hover:bg-background/50 rounded"
                          aria-label={t('editTitle')}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirmId(session.id)
                          }}
                          className="p-1.5 hover:bg-background/50 rounded"
                          aria-label={t('deleteSession')}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-600" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-1">
                      {getRelativeTime(session.updated_at)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
