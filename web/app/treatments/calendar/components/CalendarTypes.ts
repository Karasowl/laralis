// Shared types and helpers for calendar components

export type ViewMode = 'month' | 'week' | 'day'

export interface Treatment {
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

export interface CalendarViewProps {
  treatments: Treatment[]
  treatmentsByDate: Record<string, Treatment[]>
  conflictsByDate: Record<string, Set<string>>
  weekDays: string[]
  currentDate: Date
  onCreateTreatment: (date: string, time?: string) => void
  onTreatmentClick: (treatmentId: string) => void
  t: (key: string, params?: Record<string, any>) => string
}

// Get status color with improved palette
export function getStatusColor(status: string): string {
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
export function getStatusDot(status: string): string {
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
