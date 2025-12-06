'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isBefore,
} from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Button } from './button'

export interface CalendarProps {
  mode?: 'single' | 'range'
  selected?: Date | { from?: Date; to?: Date }
  onSelect?: (date: Date | { from?: Date; to?: Date } | undefined) => void
  locale?: 'es' | 'en'
  disabled?: (date: Date) => boolean
  className?: string
  numberOfMonths?: 1 | 2
}

export function Calendar({
  mode = 'single',
  selected,
  onSelect,
  locale = 'es',
  disabled,
  className,
  numberOfMonths = 1,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    if (mode === 'range') {
      const range = selected as { from?: Date; to?: Date } | undefined
      return range?.from || new Date()
    }
    return (selected as Date) || new Date()
  })

  const [hoverDate, setHoverDate] = React.useState<Date | null>(null)
  const dateLocale = locale === 'es' ? es : enUS

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  const handleDateClick = (date: Date) => {
    if (disabled?.(date)) return

    if (mode === 'single') {
      onSelect?.(date)
    } else {
      const range = selected as { from?: Date; to?: Date } | undefined
      if (!range?.from || (range.from && range.to)) {
        // Start new selection
        onSelect?.({ from: date, to: undefined })
      } else if (isBefore(date, range.from)) {
        // Selected date is before start, swap
        onSelect?.({ from: date, to: range.from })
      } else {
        // Complete the range
        onSelect?.({ from: range.from, to: date })
      }
    }
  }

  const isDateSelected = (date: Date) => {
    if (mode === 'single') {
      return selected && isSameDay(date, selected as Date)
    }
    const range = selected as { from?: Date; to?: Date } | undefined
    if (!range) return false
    if (range.from && isSameDay(date, range.from)) return true
    if (range.to && isSameDay(date, range.to)) return true
    return false
  }

  const isDateInRange = (date: Date) => {
    if (mode !== 'range') return false
    const range = selected as { from?: Date; to?: Date } | undefined
    if (!range?.from) return false

    const endDate = range.to || hoverDate
    if (!endDate) return false

    const start = isBefore(endDate, range.from) ? endDate : range.from
    const end = isBefore(endDate, range.from) ? range.from : endDate

    return isWithinInterval(date, { start, end }) && !isSameDay(date, start) && !isSameDay(date, end)
  }

  const isRangeStart = (date: Date) => {
    if (mode !== 'range') return false
    const range = selected as { from?: Date; to?: Date } | undefined
    return range?.from && isSameDay(date, range.from)
  }

  const isRangeEnd = (date: Date) => {
    if (mode !== 'range') return false
    const range = selected as { from?: Date; to?: Date } | undefined
    return range?.to && isSameDay(date, range.to)
  }

  const renderMonth = (monthDate: Date, monthIndex: number) => {
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const weeks: Date[][] = []
    let currentDate = startDate
    let currentWeek: Date[] = []

    while (currentDate <= endDate) {
      currentWeek.push(currentDate)
      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }
      currentDate = addDays(currentDate, 1)
    }

    const weekDays = locale === 'es'
      ? ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
      : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

    return (
      <div key={monthIndex} className="w-full">
        {/* Month header */}
        <div className="flex items-center justify-between mb-4 px-1">
          {monthIndex === 0 ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handlePrevMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          ) : (
            <div className="w-7" />
          )}
          <h2 className="text-sm font-semibold">
            {format(monthDate, 'MMMM yyyy', { locale: dateLocale })}
          </h2>
          {monthIndex === numberOfMonths - 1 ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="w-7" />
          )}
        </div>

        {/* Week days header */}
        <div className="grid grid-cols-7 gap-0 mb-1">
          {weekDays.map((day) => (
            <div
              key={day}
              className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0">
          {weeks.map((week, weekIndex) =>
            week.map((date, dayIndex) => {
              const isCurrentMonth = isSameMonth(date, monthDate)
              const isToday = isSameDay(date, new Date())
              const isSelected = isDateSelected(date)
              const inRange = isDateInRange(date)
              const rangeStart = isRangeStart(date)
              const rangeEnd = isRangeEnd(date)
              const isDisabled = disabled?.(date)

              return (
                <button
                  key={`${weekIndex}-${dayIndex}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleDateClick(date)}
                  onMouseEnter={() => mode === 'range' && setHoverDate(date)}
                  onMouseLeave={() => mode === 'range' && setHoverDate(null)}
                  className={cn(
                    'h-9 w-full text-sm font-normal transition-colors relative',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    !isCurrentMonth && 'text-muted-foreground/40',
                    isCurrentMonth && 'hover:bg-accent',
                    isToday && !isSelected && 'bg-accent text-accent-foreground',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                    inRange && 'bg-primary/10',
                    rangeStart && 'rounded-l-md',
                    rangeEnd && 'rounded-r-md',
                    isDisabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
                  )}
                >
                  {format(date, 'd')}
                </button>
              )
            })
          )}
        </div>
      </div>
    )
  }

  const months = Array.from({ length: numberOfMonths }, (_, i) =>
    addMonths(currentMonth, i)
  )

  return (
    <div className={cn('p-3', className)}>
      <div className={cn(
        'flex',
        numberOfMonths === 2 ? 'gap-8' : ''
      )}>
        {months.map((month, index) => renderMonth(month, index))}
      </div>
    </div>
  )
}
