'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign,
  Users,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Target
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

interface BusinessMetricsGridProps {
  ticketPromedioCents: number
  ticketChange?: number
  pacientesNecesariosPorDia: number
  pacientesActualesPorDia: number
  pacientesChange?: number
  gananciaNetaCents: number // Cambio: ingresos - gastos (no duplicar "Ingresos del Mes")
  gananciaNetaChange?: number
  workDays?: number
  monthlyTargetCents?: number
  daysElapsed?: number
}

export function BusinessMetricsGrid({
  ticketPromedioCents,
  ticketChange,
  pacientesNecesariosPorDia,
  pacientesActualesPorDia,
  pacientesChange,
  gananciaNetaCents,
  gananciaNetaChange,
  workDays = 20,
  monthlyTargetCents,
  daysElapsed
}: BusinessMetricsGridProps) {
  const t = useTranslations('dashboardComponents.businessMetrics')

  // Calculate if we're on track based on patients/day
  const pacientesStatus: 'success' | 'warning' = pacientesActualesPorDia >= pacientesNecesariosPorDia ? 'success' : 'warning'

  // Determine net profit status
  const netProfitStatus: 'success' | 'warning' | 'danger' =
    gananciaNetaCents > 0 ? 'success'
    : gananciaNetaCents === 0 ? 'warning'
    : 'danger'

  const pacientesDiff = pacientesActualesPorDia - pacientesNecesariosPorDia
  const pacientesDiffPercent = pacientesNecesariosPorDia > 0
    ? ((pacientesDiff / pacientesNecesariosPorDia) * 100)
    : 0

  const getTrendIcon = (change?: number) => {
    if (change === undefined || change === 0) return Minus
    return change > 0 ? TrendingUp : TrendingDown
  }

  const getTrendColor = (change?: number) => {
    if (change === undefined || change === 0) return 'text-muted-foreground'
    return change > 0 ? 'text-emerald-600' : 'text-red-600'
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Ticket Promedio */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            {ticketChange !== undefined && (
              <Badge variant="outline" className={cn('gap-1', getTrendColor(ticketChange))}>
                {React.createElement(getTrendIcon(ticketChange), { className: 'h-3 w-3' })}
                {Math.abs(ticketChange).toFixed(1)}%
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t('avgTicket')}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(ticketPromedioCents)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('perTreatment')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pacientes Necesarios */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl" />
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
              <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t('patientsNeeded')}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {pacientesNecesariosPorDia}
              <span className="text-sm text-muted-foreground font-normal ml-1">
                /{t('day')}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t('toReachBreakEven')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pacientes Actuales */}
      <Card className={cn(
        'relative overflow-hidden border-2',
        pacientesStatus === 'success'
          ? 'border-emerald-200 dark:border-emerald-900'
          : 'border-amber-200 dark:border-amber-900'
      )}>
        <div className={cn(
          'absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl',
          pacientesStatus === 'success' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
        )} />
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between mb-4">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              pacientesStatus === 'success'
                ? 'bg-emerald-100 dark:bg-emerald-950/30'
                : 'bg-amber-100 dark:bg-amber-950/30'
            )}>
              <Users className={cn(
                'h-5 w-5',
                pacientesStatus === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              )} />
            </div>
            {pacientesDiff !== 0 && (
              <Badge
                variant="outline"
                className={cn(
                  'gap-1',
                  pacientesStatus === 'success' ? 'text-emerald-600' : 'text-amber-600'
                )}
              >
                {pacientesDiff > 0 ? '+' : ''}
                {pacientesDiffPercent.toFixed(0)}%
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t('currentPatients')}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {pacientesActualesPorDia.toFixed(1)}
              <span className="text-sm text-muted-foreground font-normal ml-1">
                /{t('day')}
              </span>
            </p>
            <p className={cn(
              'text-xs font-medium',
              pacientesStatus === 'success' ? 'text-emerald-600' : 'text-amber-600'
            )}>
              {pacientesStatus === 'success'
                ? t('onTrack')
                : t('belowTarget', { diff: Math.abs(pacientesDiff).toFixed(1) })
              }
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Ganancia Neta */}
      <Card className={cn(
        'relative overflow-hidden border-2',
        netProfitStatus === 'success'
          ? 'border-emerald-200 dark:border-emerald-900'
          : netProfitStatus === 'warning'
          ? 'border-amber-200 dark:border-amber-900'
          : 'border-red-200 dark:border-red-900'
      )}>
        <div className={cn(
          'absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl',
          netProfitStatus === 'success' ? 'bg-emerald-500/10'
          : netProfitStatus === 'warning' ? 'bg-amber-500/10'
          : 'bg-red-500/10'
        )} />
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between mb-4">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              netProfitStatus === 'success'
                ? 'bg-emerald-100 dark:bg-emerald-950/30'
                : netProfitStatus === 'warning'
                ? 'bg-amber-100 dark:bg-amber-950/30'
                : 'bg-red-100 dark:bg-red-950/30'
            )}>
              <DollarSign className={cn(
                'h-5 w-5',
                netProfitStatus === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : netProfitStatus === 'warning'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
              )} />
            </div>
            {gananciaNetaChange !== undefined && (
              <Badge variant="outline" className={cn('gap-1', getTrendColor(gananciaNetaChange))}>
                {React.createElement(getTrendIcon(gananciaNetaChange), { className: 'h-3 w-3' })}
                {Math.abs(gananciaNetaChange).toFixed(1)}%
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t('netProfit')}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(gananciaNetaCents)}
            </p>
            <p className={cn(
              'text-xs font-medium',
              netProfitStatus === 'success' ? 'text-emerald-600'
              : netProfitStatus === 'warning' ? 'text-amber-600'
              : 'text-red-600'
            )}>
              {netProfitStatus === 'success' ? t('profitable')
               : netProfitStatus === 'warning' ? t('breakEven')
               : t('losses')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
