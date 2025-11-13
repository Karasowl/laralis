/**
 * Patient Entry Flow
 *
 * Conversational flow for creating a patient record
 * AI guides user through each field step by step
 */

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { VoiceRecorder } from '../VoiceRecorder'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import type { ZPatientForm } from '@/lib/zod'

interface PatientEntryFlowProps {
  onComplete: () => void
  onCancel: () => void
}

type FlowStep = 'collecting' | 'preview' | 'saving' | 'success' | 'error'

interface CollectedData extends Partial<ZPatientForm> {}

export function PatientEntryFlow({ onComplete, onCancel }: PatientEntryFlowProps) {
  const t = useTranslations('aiAssistant.entry')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { currentClinic } = useCurrentClinic()

  const [step, setStep] = useState<FlowStep>('collecting')
  const [collectedData, setCollectedData] = useState<CollectedData>({})
  const [conversation, setConversation] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Vamos a crear un nuevo paciente. ¿Cuál es el nombre completo?',
    },
  ])
  const [currentField, setCurrentField] = useState<keyof ZPatientForm>('first_name')
  const [error, setError] = useState<string | null>(null)

  // Patient form structure
  const patientFields: Array<{
    key: keyof ZPatientForm
    required: boolean
    type: 'text' | 'email' | 'date'
  }> = [
    { key: 'first_name', required: true, type: 'text' },
    { key: 'last_name', required: true, type: 'text' },
    { key: 'phone', required: false, type: 'text' },
    { key: 'email', required: false, type: 'email' },
    { key: 'birth_date', required: false, type: 'date' },
    { key: 'gender', required: false, type: 'text' },
    { key: 'address', required: false, type: 'text' },
    { key: 'notes', required: false, type: 'text' },
  ]

  const currentFieldIndex = patientFields.findIndex((f) => f.key === currentField)
  const progress = ((currentFieldIndex + 1) / patientFields.length) * 100

  const handleTranscript = async (text: string) => {
    // Add user message to conversation
    setConversation((prev) => [...prev, { role: 'user', text }])

    // Process with AI
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: text,
          mode: 'entry',
          context: {
            entityType: 'patient',
            schema: Object.fromEntries(
              patientFields.map((f) => [
                f.key,
                { type: f.type, required: f.required },
              ])
            ),
            currentField,
            collectedData,
            locale: 'es',
          },
        }),
      })

      if (!response.ok) {
        throw new Error('AI response failed')
      }

      const data = await response.json()

      // Add AI response to conversation
      setConversation((prev) => [...prev, { role: 'assistant', text: data.response }])

      // TODO: Parse AI response to extract field value and move to next field
      // For MVP, we'll do simple parsing
      const lowerText = text.toLowerCase()

      // Handle skip
      if (lowerText.includes('pasar') || lowerText.includes('skip')) {
        moveToNextField()
        return
      }

      // Store the value (simplified for MVP)
      const newData = { ...collectedData, [currentField]: text }
      setCollectedData(newData)

      // Move to next field
      moveToNextField()
    } catch (err) {
      console.error('[PatientEntryFlow] Error:', err)
      setError(t('errors.networkError'))
    }
  }

  const moveToNextField = () => {
    const nextIndex = currentFieldIndex + 1
    if (nextIndex < patientFields.length) {
      setCurrentField(patientFields[nextIndex].key)
    } else {
      // All fields collected, show preview
      setStep('preview')
    }
  }

  const handleSave = async () => {
    if (!currentClinic?.id) {
      setError(t('errors.noClinicSelected'))
      return
    }

    setStep('saving')

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...collectedData,
          clinic_id: currentClinic.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Save failed')
      }

      setStep('success')

      // Close after 2 seconds
      setTimeout(() => {
        router.refresh()
        onComplete()
      }, 2000)
    } catch (err) {
      console.error('[PatientEntryFlow] Save error:', err)
      setStep('error')
      setError(t('errors.saveFailed'))
    }
  }

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h3 className="text-xl font-semibold">{t('saveSuccess')}</h3>
        <p className="text-muted-foreground">{tCommon('success')}</p>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="h-16 w-16 text-red-500" />
        <h3 className="text-xl font-semibold">{error || t('saveError')}</h3>
        <button
          onClick={() => setStep('preview')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {t('restart')}
        </button>
      </div>
    )
  }

  if (step === 'preview') {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">{t('preview')}</h3>

        <div className="border rounded-lg p-4 space-y-2">
          {Object.entries(collectedData).map(([key, value]) => (
            <div key={key} className="flex justify-between py-2 border-b last:border-b-0">
              <span className="font-medium capitalize">{key.replace('_', ' ')}:</span>
              <span className="text-muted-foreground">{value || '-'}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={step === 'saving'}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {step === 'saving' ? tCommon('saving') : t('confirmAndSave')}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-3 border rounded-lg hover:bg-muted"
          >
            {tCommon('cancel')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>{t('progress', { completed: currentFieldIndex + 1, total: patientFields.length })}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Conversation */}
      <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto space-y-3">
        {conversation.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted text-foreground'
              }`}
            >
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Voice Recorder */}
      <VoiceRecorder
        onTranscript={handleTranscript}
        onError={(err) => setError(err)}
        language="es"
      />

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={moveToNextField}
          className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted"
        >
          {t('skipField')}
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
