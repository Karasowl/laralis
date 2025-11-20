'use client'

/**
 * Action Confirm Card
 *
 * Displays an action suggestion from Lara with expected impact
 * and allows the user to confirm or reject execution.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle, XCircle, AlertTriangle, Loader2, ArrowRight } from 'lucide-react'
import { Button } from './button'
import { Card } from './card'
import type { ActionSuggestion, ActionResult } from '@/lib/ai/types'

interface ActionConfirmCardProps {
  suggestion: ActionSuggestion
  clinicId: string
  onConfirm?: (result: ActionResult) => void
  onReject?: () => void
}

export function ActionConfirmCard({
  suggestion,
  clinicId,
  onConfirm,
  onReject,
}: ActionConfirmCardProps) {
  const t = useTranslations('aiAssistant.actions')
  const tCommon = useTranslations('common')
  const [status, setStatus] = useState<'pending' | 'executing' | 'success' | 'error'>('pending')
  const [result, setResult] = useState<ActionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setStatus('executing')
    setError(null)

    try {
      // Call the appropriate API endpoint based on action type
      const endpoint = `/api/actions/${suggestion.action.replace(/_/g, '-')}`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...suggestion.params,
          clinic_id: clinicId,
          dry_run: false,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to execute action')
      }

      setResult(data.data)
      setStatus('success')
      onConfirm?.(data.data)
    } catch (err: any) {
      console.error('[ActionConfirmCard] Error executing action:', err)
      setError(err.message || 'Unknown error')
      setStatus('error')
    }
  }

  const handleReject = () => {
    setStatus('pending')
    onReject?.()
  }

  // Confidence badge color
  const confidenceColor = {
    low: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
    medium: 'text-primary bg-primary/10 dark:text-primary/80 dark:bg-primary/20',
    high: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30',
  }[suggestion.confidence]

  // Format action name for display
  const actionName = suggestion.action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold">💡 {t('suggestion')}</h3>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${confidenceColor}`}>
                {t(`confidence.${suggestion.confidence}`)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{actionName}</p>
          </div>
        </div>

        {/* Reasoning */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold mb-2">{t('reasoning')}:</h4>
          <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
        </div>

        {/* Expected Impact */}
        {suggestion.expected_impact.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2">{t('expectedImpact')}:</h4>
            <div className="space-y-2">
              {suggestion.expected_impact.map((impact, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-card/50 border"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{impact.metric}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>${(impact.current_value / 100).toFixed(2)}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>${(impact.new_value / 100).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-semibold ${
                        impact.change_pct > 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {impact.change_pct > 0 ? '+' : ''}
                      {impact.change_pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {status === 'executing' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 dark:bg-primary/20 text-primary dark:text-primary/80 mb-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t('executing')}</span>
          </div>
        )}

        {status === 'success' && result && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-semibold">{t('success')}</span>
            </div>
            {result.result?.changes && (
              <ul className="text-xs space-y-1 ml-6">
                {result.result.changes.map((change, idx) => (
                  <li key={idx}>• {change}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-semibold">{t('error')}</span>
            </div>
            <p className="text-xs ml-6">{error}</p>
          </div>
        )}

        {/* Actions */}
        {status === 'pending' && (
          <div className="flex items-center gap-3">
            <Button onClick={handleConfirm} className="flex-1">
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('confirm')}
            </Button>
            <Button onClick={handleReject} variant="outline" className="flex-1">
              <XCircle className="h-4 w-4 mr-2" />
              {t('reject')}
            </Button>
          </div>
        )}

        {status === 'success' && (
          <Button onClick={() => setStatus('pending')} variant="outline" className="w-full">
            {tCommon('close')}
          </Button>
        )}

        {status === 'error' && (
          <div className="flex gap-3">
            <Button onClick={handleConfirm} variant="outline" className="flex-1">
              {t('retry')}
            </Button>
            <Button onClick={handleReject} variant="outline" className="flex-1">
              {tCommon('cancel')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
