/**
 * Floating AI Assistant Button
 *
 * FAB that expands to show Entry and Query modes
 */

'use client'

import { useState } from 'react'
import { Mic, MessageSquare, FileEdit, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EntryAssistant } from './EntryMode/EntryAssistant'
import { QueryAssistant } from './QueryMode/QueryAssistant'

type AssistantMode = 'entry' | 'query' | null

export function FloatingAssistant() {
  const t = useTranslations('aiAssistant')
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeMode, setActiveMode] = useState<AssistantMode>(null)

  const [sessionId, setSessionId] = useState<string | null>(null)

  const handleOpenMode = (mode: AssistantMode) => {
    setActiveMode(mode)
    setIsExpanded(false)
  }

  const handleCloseMode = () => {
    setActiveMode(null)
  }

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Expanded Menu */}
        {isExpanded && (
          <div className="flex flex-col gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
            {/* Entry Mode Button */}
            <button
              onClick={() => handleOpenMode('entry')}
              className="flex items-center gap-3 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105"
              aria-label={t('fab.entry')}
            >
              <FileEdit className="h-5 w-5" />
              <span className="font-medium">{t('fab.entry')}</span>
            </button>

            {/* Query Mode Button */}
            <button
              onClick={() => handleOpenMode('query')}
              className="flex items-center gap-3 bg-secondary hover:bg-secondary/90 text-secondary-foreground px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105"
              aria-label={t('fab.query')}
            >
              <MessageSquare className="h-5 w-5" />
              <span className="font-medium">{t('fab.query')}</span>
            </button>
          </div>
        )}

        {/* Main FAB Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all hover:scale-110 ${isExpanded
              ? 'bg-destructive hover:bg-destructive/90 rotate-45'
              : 'bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90'
            }`}
          aria-label={t('fab.tooltip')}
        >
          {isExpanded ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Mic className="h-6 w-6 text-white" />
          )}
        </button>
      </div>

      {/* Entry Mode Modal */}
      {activeMode === 'entry' && <EntryAssistant onClose={handleCloseMode} />}

      {/* Query Mode Modal */}
      {activeMode === 'query' && (
        <QueryAssistant
          onClose={handleCloseMode}
          sessionId={sessionId}
          onSessionCreated={setSessionId}
        />
      )}
    </>
  )
}
