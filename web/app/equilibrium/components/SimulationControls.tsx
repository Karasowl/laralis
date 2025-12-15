'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InputField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { Sliders, RotateCcw, Play, ChevronDown, ChevronUp } from 'lucide-react'
import { useState, ChangeEvent, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface SimulationValues {
  workDays: number
  variableCostPercentage: number
  safetyMarginPercentage: number
  manualMonthlyTarget: number | ''
}

type InputChangeHandler = (valueOrEvent: string | number | ChangeEvent<HTMLInputElement>) => void

interface SimulationControlsProps {
  values: SimulationValues
  baseWorkDays: number
  autoVariableCostPercentage: number
  autoVariableCostSampleSize: number
  autoVariableCostPeriodDays: number
  variableCostSource: 'calculated' | 'fallback'
  onFieldChange: (field: keyof SimulationValues) => (value: number | string) => void
  onApply: () => void
  onReset: () => void
}

export function SimulationControls({
  values,
  baseWorkDays,
  autoVariableCostPercentage,
  autoVariableCostSampleSize,
  autoVariableCostPeriodDays,
  variableCostSource,
  onFieldChange,
  onApply,
  onReset,
}: SimulationControlsProps) {
  const t = useTranslations('equilibrium')
  const [isExpanded, setIsExpanded] = useState(false)

  const formatPercent = (value: number) =>
    `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`

  // Wrapper to make onFieldChange compatible with InputField's onChange type
  const createChangeHandler = useCallback(
    (field: keyof SimulationValues): InputChangeHandler =>
      (valueOrEvent) => {
        if (typeof valueOrEvent === 'object' && 'target' in valueOrEvent) {
          onFieldChange(field)(valueOrEvent.target.value)
        } else {
          onFieldChange(field)(valueOrEvent)
        }
      },
    [onFieldChange]
  )

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-medium">{t('simulation.title')}</CardTitle>
                <CardDescription className="text-sm">{t('simulation.description')}</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <CardContent className="pt-0 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                type="number"
                label={t('simulation.work_days_label')}
                value={values.workDays}
                onChange={createChangeHandler('workDays')}
                min={1}
                max={31}
                helperText={t('simulation.work_days_hint', { value: baseWorkDays })}
              />
              <InputField
                type="number"
                label={t('simulation.variable_cost_label')}
                value={values.variableCostPercentage}
                onChange={createChangeHandler('variableCostPercentage')}
                min={0}
                max={100}
                step="0.1"
                helperText={
                  variableCostSource === 'calculated'
                    ? t('simulation.variable_cost_calculated', {
                        value: formatPercent(autoVariableCostPercentage),
                        sample: autoVariableCostSampleSize,
                        days: autoVariableCostPeriodDays,
                      })
                    : t('simulation.variable_cost_fallback', {
                        value: formatPercent(autoVariableCostPercentage),
                      })
                }
              />
              <InputField
                type="number"
                label={t('simulation.safety_margin_label')}
                value={values.safetyMarginPercentage}
                onChange={createChangeHandler('safetyMarginPercentage')}
                min={0}
                max={200}
                step="0.5"
                helperText={t('simulation.safety_margin_hint')}
              />
              <InputField
                type="number"
                label={t('simulation.manual_target_label')}
                value={values.manualMonthlyTarget}
                onChange={createChangeHandler('manualMonthlyTarget')}
                min={0}
                step="0.01"
                placeholder="--"
                helperText={t('simulation.manual_target_hint')}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2 border-t">
              <Button onClick={onApply} className="flex-1 sm:flex-none">
                <Play className="h-4 w-4 mr-2" />
                {t('simulation.apply')}
              </Button>
              <Button variant="outline" onClick={onReset} className="flex-1 sm:flex-none">
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('simulation.reset')}
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>
    </section>
  )
}
