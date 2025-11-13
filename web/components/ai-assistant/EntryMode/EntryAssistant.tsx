/**
 * Entry Mode Assistant
 *
 * Modal for creating records using voice/text with AI guidance
 * Supports all 14 entities via GenericEntryFlow
 */

'use client'

import { useState } from 'react'
import { X, FileEdit } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EntitySelector } from './EntitySelector'
import { GenericEntryFlow } from './GenericEntryFlow'
import { getEntityDisplayName } from '@/lib/ai/contexts/EntityContextBuilder'

interface EntryAssistantProps {
  onClose: () => void
}

type SelectedEntity = string | null

export function EntryAssistant({ onClose }: EntryAssistantProps) {
  const t = useTranslations('aiAssistant.entry')
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null)

  const handleBack = () => {
    if (selectedEntity) {
      setSelectedEntity(null)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm">
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl h-[90vh] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FileEdit className="h-6 w-6" />
                {selectedEntity
                  ? getEntityDisplayName(selectedEntity as any, 'es')
                  : t('title')}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
            </div>
            <button
              onClick={handleBack}
              className="p-2 hover:bg-background/50 rounded-lg transition-colors"
              aria-label={t('cancel')}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedEntity ? (
              <EntitySelector onSelect={(entity) => setSelectedEntity(entity)} />
            ) : (
              <GenericEntryFlow
                entityType={selectedEntity}
                onComplete={onClose}
                onCancel={handleBack}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
