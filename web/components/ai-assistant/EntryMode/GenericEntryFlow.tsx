/**
 * Generic Entry Flow
 *
 * Universal conversational flow for creating any entity
 * Works with EntityContextBuilder to handle all 18 entities
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertCircle, Send, Loader2 } from 'lucide-react'
import { VoiceRecorder } from '../VoiceRecorder'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import {
  buildEntityContext,
  getFieldOrder,
  validateEntityData,
  getEntityEndpoint,
} from '@/lib/ai/contexts/EntityContextBuilder'

interface GenericEntryFlowProps {
  entityType: string
  onComplete: () => void
  onCancel: () => void
}

type FlowStep = 'collecting' | 'preview' | 'saving' | 'success' | 'error'

export function GenericEntryFlow({ entityType, onComplete, onCancel }: GenericEntryFlowProps) {
  const t = useTranslations('aiAssistant.entry')
  const tCommon = useTranslations('common')
  const tMessages = useTranslations('aiAssistant.messages')
  const router = useRouter()
  const { currentClinic } = useCurrentClinic()

  const [step, setStep] = useState<FlowStep>('collecting')
  const [collectedData, setCollectedData] = useState<Record<string, any>>({})
  const [conversation, setConversation] = useState<
    Array<{ role: 'user' | 'assistant'; text: string }>
  >([])
  const [fieldOrder, setFieldOrder] = useState<string[]>([])
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [textInput, setTextInput] = useState('')

  // Handle text input submission
  const handleTextSubmit = () => {
    if (!textInput.trim() || isProcessing) return
    handleTranscript(textInput.trim())
    setTextInput('')
  }

  // Initialize field order and first message
  useEffect(() => {
    const fields = getFieldOrder(entityType as any)
    setFieldOrder(fields)

    // Add initial AI greeting
    setConversation([
      {
        role: 'assistant',
        text: tMessages('creating', { entity: entityType }),
      },
    ])
  }, [entityType, tMessages])

  const currentField = fieldOrder[currentFieldIndex]
  const progress = fieldOrder.length > 0 ? ((currentFieldIndex + 1) / fieldOrder.length) * 100 : 0

  const handleTranscript = async (text: string) => {
    if (isProcessing) return

    setIsProcessing(true)
    setError(null)

    // Add user message to conversation
    setConversation((prev) => [...prev, { role: 'user', text }])

    try {
      // Build context for AI
      const context = buildEntityContext(
        entityType as any,
        currentField,
        collectedData,
        'es'
      )

      // Send to AI for processing
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: text,
          mode: 'entry',
          context,
        }),
      })

      if (!response.ok) {
        throw new Error('AI response failed')
      }

      const data = await response.json()

      // Add AI response to conversation
      setConversation((prev) => [...prev, { role: 'assistant', text: data.response }])

      // Handle validation result from AI
      if (data.is_valid) {
        // User wants to skip (extracted_value is null but is_valid is true)
        // OR AI successfully extracted a value
        if (data.extracted_value !== null && data.extracted_value !== undefined) {
          // Store the EXTRACTED value (not the raw text)
          const newData = { ...collectedData, [currentField]: data.extracted_value }
          setCollectedData(newData)
        }
        // Move to next field automatically
        moveToNextField()
      } else {
        // Validation failed - don't move to next field
        // The AI message should explain what's wrong
        if (data.validation_error && data.validation_error !== 'awaiting_input') {
          setError(data.response) // Show the AI's explanation as the error
        }
        // Stay on current field so user can try again
      }
    } catch (err) {
      console.error('[GenericEntryFlow] Error:', err)
      setError(t('errors.networkError'))
    } finally {
      setIsProcessing(false)
    }
  }

  const moveToNextField = () => {
    const nextIndex = currentFieldIndex + 1
    if (nextIndex < fieldOrder.length) {
      setCurrentFieldIndex(nextIndex)
    } else {
      // All fields collected, show preview
      setStep('preview')
    }
  }

  const moveToPreviousField = () => {
    if (currentFieldIndex > 0) {
      setCurrentFieldIndex(currentFieldIndex - 1)
    }
  }

  const handleSave = async () => {
    if (!currentClinic?.id) {
      setError(t('errors.noClinicSelected'))
      return
    }

    // Validate data
    const validation = validateEntityData(entityType as any, collectedData)
    if (!validation.valid) {
      setError(validation.errors.join(', '))
      return
    }

    setStep('saving')

    try {
      const endpoint = getEntityEndpoint(entityType as any)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...collectedData,
          clinic_id: currentClinic.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Save failed')
      }

      setStep('success')

      // Close after 2 seconds
      setTimeout(() => {
        router.refresh()
        onComplete()
      }, 2000)
    } catch (err) {
      console.error('[GenericEntryFlow] Save error:', err)
      setStep('error')
      setError(err instanceof Error ? err.message : t('errors.saveFailed'))
    }
  }

  // Success state
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-500 animate-in zoom-in duration-300" />
        <h3 className="text-xl font-semibold">{t('saveSuccess')}</h3>
        <p className="text-muted-foreground">{tCommon('success')}</p>
      </div>
    )
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="h-16 w-16 text-red-500" />
        <h3 className="text-xl font-semibold">{error || t('saveError')}</h3>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setStep('preview')
              setError(null)
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            {t('restart')}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            {tCommon('cancel')}
          </button>
        </div>
      </div>
    )
  }

  // Preview state
  if (step === 'preview') {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">{t('preview')}</h3>

        <div className="border rounded-lg overflow-hidden">
          {Object.entries(collectedData).map(([key, value], idx) => (
            <div
              key={key}
              className={`flex justify-between p-3 ${
                idx % 2 === 0 ? 'bg-muted/30' : ''
              }`}
            >
              <span className="font-medium capitalize text-sm">
                {key.replace(/_/g, ' ')}:
              </span>
              <span className="text-sm text-muted-foreground">{value || '-'}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={step === 'saving'}
            className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {step === 'saving' ? tCommon('saving') : t('confirmAndSave')}
          </button>
          <button
            onClick={() => {
              setStep('collecting')
              setError(null)
            }}
            className="px-4 py-3 border rounded-lg hover:bg-muted transition-colors"
          >
            {t('restart')}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-3 border rounded-lg hover:bg-muted transition-colors"
          >
            {tCommon('cancel')}
          </button>
        </div>
      </div>
    )
  }

  // Collecting state (main conversation)
  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>
            {t('progress', {
              completed: currentFieldIndex + 1,
              total: fieldOrder.length,
            })}
          </span>
          <span className="font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Field Info */}
      <div className="flex items-center justify-between p-3 bg-primary/10 dark:bg-primary/20 rounded-lg backdrop-blur-sm">
        <div>
          <p className="text-sm font-medium text-primary dark:text-primary/80">
            {tMessages('currentField')}
          </p>
          <p className="text-xs text-primary dark:text-primary/80 capitalize">
            {currentField?.replace(/_/g, ' ')}
          </p>
        </div>
        {currentFieldIndex > 0 && (
          <button
            onClick={moveToPreviousField}
            className="text-xs px-3 py-1 border border-primary/30 dark:border-primary/40 rounded hover:bg-primary/10 dark:hover:bg-primary/20"
          >
            {tMessages('previousField')}
          </button>
        )}
      </div>

      {/* Conversation */}
      <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto space-y-3">
        {conversation.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in-0 slide-in-from-bottom-2 duration-200`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-foreground backdrop-blur-sm'
              }`}
            >
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Text Input + Voice Recorder */}
      <div className="space-y-3">
        {/* Text input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleTextSubmit()
              }
            }}
            placeholder={t('textInputPlaceholder')}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <button
            onClick={handleTextSubmit}
            disabled={isProcessing || !textInput.trim()}
            className="px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Voice recorder as alternative */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex-1 border-t" />
          <span>{tCommon('or')}</span>
          <span className="flex-1 border-t" />
        </div>
        <VoiceRecorder
          onTranscript={handleTranscript}
          onError={(err) => setError(err)}
          disabled={isProcessing}
          language="es"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg animate-in fade-in-0">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={moveToNextField}
          disabled={isProcessing}
          className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        >
          {t('skipField')}
        </button>
        <button
          onClick={() => setStep('preview')}
          disabled={isProcessing || Object.keys(collectedData).length === 0}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('preview')}
        </button>
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="px-4 py-2 border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        >
          {tCommon('cancel')}
        </button>
      </div>
    </div>
  )
}
