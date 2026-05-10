'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface Treatment {
  id: string
  treatment_date: string
  treatment_time: string | null
  status: string
  duration_minutes: number
  price_cents: number
  patient?: {
    id: string
    first_name: string
    last_name: string
  }
  service?: {
    id: string
    name: string
  }
}

interface CalendarEventProps {
  treatment: Treatment
  onClick: () => void
  variant?: 'compact' | 'full'
}

// Get status color with improved palette
export function getStatusColor(status: string) {
  switch (status) {
    case 'pending':
    case 'scheduled':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800'
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800'
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800'
    case 'cancelled':
      return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700'
    default:
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800'
  }
}

// Get status dot color for legend
export function getStatusDot(status: string) {
  switch (status) {
    case 'pending':
    case 'scheduled':
      return 'bg-amber-500'
    case 'in_progress':
      return 'bg-blue-500'
    case 'completed':
      return 'bg-emerald-500'
    default:
      return 'bg-gray-400'
  }
}

export function CalendarEvent({ treatment, onClick, variant = 'compact' }: CalendarEventProps) {
  const t = useTranslations()

  if (variant === 'compact') {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onClick() }}
        className={cn(
          'text-xs p-1.5 rounded border cursor-pointer transition-colors hover:opacity-80',
          getStatusColor(treatment.status)
        )}
      >
        <div className="flex items-center gap-1">
          {treatment?.treatment_time && (
            <span className="font-medium">{treatment.treatment_time.slice(0, 5)}</span>
          )}
          <span className="truncate">
            {treatment.patient
              ? `${treatment.patient.first_name} ${treatment.patient.last_name.charAt(0)}.`
              : t('common.unknown')}
          </span>
        </div>
        <div className="truncate text-[10px] opacity-75">
          {treatment.service?.name || t('common.unknown')}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={cn(
        'text-xs p-2 rounded border cursor-pointer transition-colors hover:opacity-80',
        getStatusColor(treatment.status)
      )}
    >
      <div className="font-medium">{treatment?.treatment_time?.slice(0, 5) || '—'}</div>
      <div className="truncate">
        {treatment.patient
          ? `${treatment.patient.first_name} ${treatment.patient.last_name}`
          : t('common.unknown')}
      </div>
      <div className="truncate text-[10px] opacity-75">
        {treatment.service?.name || t('common.unknown')}
      </div>
    </div>
  )
}
