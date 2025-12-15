'use client'

import { useState, useCallback, useMemo } from 'react'

// Types moved here to avoid circular dependency with DateFilterBar
export type DatePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
export type Granularity = 'day' | 'week' | 'month'
export type ComparisonPeriod = 'none' | 'previous' | 'last-year'

interface DateRange {
  from: string
  to: string
}

interface UseDateFilterReturn {
  period: DatePeriod
  granularity: Granularity
  comparison: ComparisonPeriod
  customRange: DateRange
  currentRange: DateRange
  previousRange?: DateRange
  setPeriod: (period: DatePeriod) => void
  setGranularity: (granularity: Granularity) => void
  setComparison: (comparison: ComparisonPeriod) => void
  setCustomRange: (range: DateRange) => void
}

export function useDateFilter(): UseDateFilterReturn {
  const [period, setPeriod] = useState<DatePeriod>('month')
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [comparison, setComparison] = useState<ComparisonPeriod>('none')
  const [customRange, setCustomRange] = useState<DateRange>({
    from: '',
    to: ''
  })

  // Calculate current range based on period
  const currentRange = useMemo((): DateRange => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const day = now.getDate()

    // Handle custom period with fallback to current month if dates incomplete
    if (period === 'custom') {
      if (customRange.from && customRange.to) {
        return customRange
      }
      // Fallback: use current month if custom dates are incomplete
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      return {
        from: customRange.from || formatDate(firstDay),
        to: customRange.to || formatDate(lastDay)
      }
    }

    switch (period) {
      case 'today': {
        const today = new Date(year, month, day)
        return {
          from: formatDate(today),
          to: formatDate(today)
        }
      }

      case 'week': {
        const dayOfWeek = now.getDay()
        const monday = new Date(year, month, day - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)

        return {
          from: formatDate(monday),
          to: formatDate(sunday)
        }
      }

      case 'month': {
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)

        return {
          from: formatDate(firstDay),
          to: formatDate(lastDay)
        }
      }

      case 'quarter': {
        const quarterMonth = Math.floor(month / 3) * 3
        const firstDay = new Date(year, quarterMonth, 1)
        const lastDay = new Date(year, quarterMonth + 3, 0)

        return {
          from: formatDate(firstDay),
          to: formatDate(lastDay)
        }
      }

      case 'year': {
        const firstDay = new Date(year, 0, 1)
        const lastDay = new Date(year, 11, 31)

        return {
          from: formatDate(firstDay),
          to: formatDate(lastDay)
        }
      }

      default:
        return { from: '', to: '' }
    }
  }, [period, customRange])

  // Calculate previous range for comparison
  const previousRange = useMemo((): DateRange | undefined => {
    if (comparison === 'none' || !currentRange.from || !currentRange.to) {
      return undefined
    }

    const from = new Date(currentRange.from)
    const to = new Date(currentRange.to)
    const diff = to.getTime() - from.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1

    if (comparison === 'previous') {
      // Previous period of same length
      const prevTo = new Date(from)
      prevTo.setDate(prevTo.getDate() - 1)

      const prevFrom = new Date(prevTo)
      prevFrom.setDate(prevFrom.getDate() - days + 1)

      return {
        from: formatDate(prevFrom),
        to: formatDate(prevTo)
      }
    }

    if (comparison === 'last-year') {
      // Same period last year
      const prevFrom = new Date(from)
      prevFrom.setFullYear(prevFrom.getFullYear() - 1)

      const prevTo = new Date(to)
      prevTo.setFullYear(prevTo.getFullYear() - 1)

      return {
        from: formatDate(prevFrom),
        to: formatDate(prevTo)
      }
    }

    return undefined
  }, [comparison, currentRange])

  return {
    period,
    granularity,
    comparison,
    customRange,
    currentRange,
    previousRange,
    setPeriod,
    setGranularity,
    setComparison,
    setCustomRange
  }
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
