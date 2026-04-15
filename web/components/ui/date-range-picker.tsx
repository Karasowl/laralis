'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  subDays,
  subWeeks,
  subMonths,
  isValid,
  parseISO,
} from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Calendar } from './calendar'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from './drawer'

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'last90days'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'allTime'
  | 'custom'

export interface DateRange {
  from: string // ISO date string YYYY-MM-DD
  to: string   // ISO date string YYYY-MM-DD
}

export interface DateRangePickerProps {
  value?: DateRange
  onChange: (value: DateRange, preset?: DatePreset) => void
  locale?: 'es' | 'en'
  className?: string
  align?: 'start' | 'center' | 'end'
  showPresetLabel?: boolean
  /** Active preset for display purposes */
  activePreset?: DatePreset
  /** Callback when preset changes */
  onPresetChange?: (preset: DatePreset) => void
}

// Helper to format date to ISO string
function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

// Helper to parse ISO date string to Date
function fromISODate(str: string): Date | null {
  if (!str) return null
  const date = parseISO(str)
  return isValid(date) ? date : null
}

// Get preset date range
export function getPresetRange(preset: DatePreset): DateRange {
  const today = new Date()

  switch (preset) {
    case 'today':
      return { from: toISODate(today), to: toISODate(today) }

    case 'yesterday':
      const yesterday = subDays(today, 1)
      return { from: toISODate(yesterday), to: toISODate(yesterday) }

    case 'last7days':
      return { from: toISODate(subDays(today, 6)), to: toISODate(today) }

    case 'last30days':
      return { from: toISODate(subDays(today, 29)), to: toISODate(today) }

    case 'last90days':
      return { from: toISODate(subDays(today, 89)), to: toISODate(today) }

    case 'thisWeek':
      return {
        from: toISODate(startOfWeek(today, { weekStartsOn: 1 })),
        to: toISODate(endOfWeek(today, { weekStartsOn: 1 })),
      }

    case 'lastWeek':
      const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })
      const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })
      return { from: toISODate(lastWeekStart), to: toISODate(lastWeekEnd) }

    case 'thisMonth':
      return {
        from: toISODate(startOfMonth(today)),
        to: toISODate(endOfMonth(today)),
      }

    case 'lastMonth':
      const lastMonthStart = startOfMonth(subMonths(today, 1))
      const lastMonthEnd = endOfMonth(subMonths(today, 1))
      return { from: toISODate(lastMonthStart), to: toISODate(lastMonthEnd) }

    case 'thisYear':
      return {
        from: toISODate(startOfYear(today)),
        to: toISODate(today),
      }

    case 'allTime':
      // Use a wide bounded range to avoid ambiguity with reset states
      return { from: '2020-01-01', to: toISODate(today) }

    case 'custom':
    default:
      return { from: '', to: '' }
  }
}

// Detect which preset matches current range
export function detectPreset(range: DateRange): DatePreset {
  if (!range.from && !range.to) return 'allTime'

  const allTimeRange = getPresetRange('allTime')
  if (range.from === allTimeRange.from && range.to === allTimeRange.to) return 'allTime'

  const presets: DatePreset[] = [
    'today',
    'yesterday',
    'last7days',
    'last30days',
    'last90days',
    'thisWeek',
    'lastWeek',
    'thisMonth',
    'lastMonth',
    'thisYear',
  ]

  for (const preset of presets) {
    const presetRange = getPresetRange(preset)
    if (presetRange.from === range.from && presetRange.to === range.to) {
      return preset
    }
  }

  return 'custom'
}

export function DateRangePicker({
  value = { from: '', to: '' },
  onChange,
  locale = 'es',
  className,
  align = 'start',
  showPresetLabel = true,
  activePreset: controlledPreset,
  onPresetChange,
}: DateRangePickerProps) {
  const t = useTranslations('filters.datePresets')
  const tFilters = useTranslations('filters')
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [open, setOpen] = React.useState(false)
  const [internalPreset, setInternalPreset] = React.useState<DatePreset>(() =>
    detectPreset(value)
  )
  // Local draft for custom range selection. Parent is only notified once
  // both endpoints are set (or user presses Apply), so partial clicks
  // never trigger re-renders that could race with the calendar UI.
  const [draftRange, setDraftRange] = React.useState<DateRange>(value)

  const currentPreset = controlledPreset ?? internalPreset
  const dateLocale = locale === 'es' ? es : enUS

  // Sync preset detection when value changes externally
  React.useEffect(() => {
    if (!controlledPreset) {
      setInternalPreset(detectPreset(value))
    }
  }, [value, controlledPreset])

  // Keep draft in sync with external value (e.g. preset changes, external resets).
  // We only rehydrate when the popover is closed to avoid overwriting an
  // in-progress selection on every parent render.
  React.useEffect(() => {
    if (!open) {
      setDraftRange(value)
    }
  }, [value, open])

  const presets: { value: DatePreset; label: string }[] = [
    { value: 'today', label: t('today') },
    { value: 'yesterday', label: t('yesterday') },
    { value: 'last7days', label: t('last7days') },
    { value: 'last30days', label: t('last30days') },
    { value: 'last90days', label: t('last90days') },
    { value: 'thisWeek', label: t('thisWeek') },
    { value: 'lastWeek', label: t('lastWeek') },
    { value: 'thisMonth', label: t('thisMonth') },
    { value: 'lastMonth', label: t('lastMonth') },
    { value: 'thisYear', label: t('thisYear') },
    { value: 'allTime', label: t('allTime') },
  ]

  const handlePresetSelect = (preset: DatePreset) => {
    const range = getPresetRange(preset)
    setInternalPreset(preset)
    setDraftRange(range)
    onPresetChange?.(preset)
    onChange(range, preset)
    if (preset !== 'custom') {
      setOpen(false)
    }
  }

  const handleCalendarSelect = (dateOrRange: Date | { from?: Date; to?: Date } | undefined) => {
    if (!dateOrRange) return

    // Handle both single date and range for type compatibility
    const range = dateOrRange instanceof Date
      ? { from: dateOrRange, to: dateOrRange }
      : dateOrRange

    const newValue: DateRange = {
      from: range.from ? toISODate(range.from) : '',
      to: range.to ? toISODate(range.to) : '',
    }

    // Only update local draft — don't notify the parent yet. This keeps the
    // selection fully controlled by this component, prevents upstream
    // re-renders from racing with clicks, and lets the user preview the range
    // before committing via "Apply".
    setDraftRange(newValue)
    setInternalPreset('custom')
  }

  const handleApply = () => {
    // If the user only picked a single date, treat it as a one-day range.
    const finalRange: DateRange = draftRange.from && !draftRange.to
      ? { from: draftRange.from, to: draftRange.from }
      : draftRange

    if (finalRange.from && finalRange.to) {
      setInternalPreset('custom')
      setDraftRange(finalRange)
      onPresetChange?.('custom')
      onChange(finalRange, 'custom')
    }
    setOpen(false)
  }

  const handleClear = () => {
    const allTime = getPresetRange('allTime')
    setInternalPreset('allTime')
    setDraftRange(allTime)
    onPresetChange?.('allTime')
    onChange(allTime, 'allTime')
    setOpen(false)
  }

  // Format display value
  const getDisplayValue = (): string => {
    if (currentPreset === 'allTime' || (!value.from && !value.to)) {
      return showPresetLabel ? t('allTime') : tFilters('dateRange')
    }

    if (currentPreset !== 'custom' && showPresetLabel) {
      const preset = presets.find(p => p.value === currentPreset)
      if (preset) return preset.label
    }

    const fromDate = fromISODate(value.from)
    const toDate = fromISODate(value.to)

    if (fromDate && toDate) {
      if (value.from === value.to) {
        return format(fromDate, 'dd MMM yyyy', { locale: dateLocale })
      }
      return `${format(fromDate, 'dd MMM', { locale: dateLocale })} - ${format(toDate, 'dd MMM yyyy', { locale: dateLocale })}`
    }

    if (fromDate) {
      return `${format(fromDate, 'dd MMM yyyy', { locale: dateLocale })} - ...`
    }

    return tFilters('dateRange')
  }

  const hasValue = Boolean(value.from || value.to) && currentPreset !== 'allTime'
  // Calendar reflects the local draft so intermediate clicks show up instantly
  // without waiting for the parent to commit the value.
  const calendarValue = React.useMemo(() => {
    const from = fromISODate(draftRange.from)
    const to = fromISODate(draftRange.to)
    if (!from && !to) return undefined
    return { from: from || undefined, to: to || undefined }
  }, [draftRange])

  const content = (
    <div className="flex flex-col md:flex-row">
      {/* Presets sidebar */}
      <div className={cn(
        'flex flex-wrap gap-1.5 p-3 border-b md:border-b-0 md:border-r md:flex-col md:w-40',
        isMobile && 'max-h-[180px] overflow-y-auto'
      )}>
        {presets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => handlePresetSelect(preset.value)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors text-left whitespace-nowrap',
              'hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              currentPreset === preset.value
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'hover:bg-accent'
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Calendar */}
      <div className="p-2">
        <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
          {t('customRange')}
        </div>
        <Calendar
          mode="range"
          selected={calendarValue}
          onSelect={handleCalendarSelect}
          locale={locale}
          numberOfMonths={isMobile ? 1 : 2}
        />
      </div>
    </div>
  )

  // Mobile: Use Drawer
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-9 border-dashed justify-start text-left font-normal',
              hasValue && 'border-primary bg-primary/5',
              className
            )}
          >
            <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
            <span className="truncate">{getDisplayValue()}</span>
            {hasValue && (
              <X
                className="h-3.5 w-3.5 ml-auto shrink-0 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClear()
                }}
              />
            )}
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{tFilters('dateRange')}</DrawerTitle>
          </DrawerHeader>
          <div className="pb-2 max-h-[65vh] overflow-y-auto">
            {content}
          </div>
          {/* Footer actions - mobile */}
          <div className="flex items-center justify-between gap-2 p-4 border-t bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-muted-foreground"
            >
              {tFilters('clear')}
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!draftRange.from}
            >
              {t('apply')}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  // Desktop: Use Popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 border-dashed justify-start text-left font-normal',
            hasValue && 'border-primary bg-primary/5',
            className
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
          <span className="truncate max-w-[180px]">{getDisplayValue()}</span>
          <ChevronDown className="h-3.5 w-3.5 ml-1 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align={align}
        side="bottom"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions={true}
      >
        {content}
        {/* Footer actions */}
        <div className="flex items-center justify-between p-3 border-t bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-muted-foreground"
          >
            {tFilters('clear')}
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!draftRange.from}
          >
            {t('apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Export utility to get human-readable period label
export function getPeriodLabel(
  range: DateRange,
  preset: DatePreset,
  t: (key: string) => string,
  locale: 'es' | 'en' = 'es'
): string {
  if (preset === 'allTime' || (!range.from && !range.to)) {
    return t('filters.datePresets.allTime')
  }

  // Return preset label for known presets
  const presetLabels: Record<DatePreset, string> = {
    today: t('filters.datePresets.today'),
    yesterday: t('filters.datePresets.yesterday'),
    last7days: t('filters.datePresets.last7days'),
    last30days: t('filters.datePresets.last30days'),
    last90days: t('filters.datePresets.last90days'),
    thisWeek: t('filters.datePresets.thisWeek'),
    lastWeek: t('filters.datePresets.lastWeek'),
    thisMonth: t('filters.datePresets.thisMonth'),
    lastMonth: t('filters.datePresets.lastMonth'),
    thisYear: t('filters.datePresets.thisYear'),
    allTime: t('filters.datePresets.allTime'),
    custom: '',
  }

  if (preset !== 'custom' && presetLabels[preset]) {
    return presetLabels[preset]
  }

  // Custom range: format dates
  const dateLocale = locale === 'es' ? es : enUS
  const fromDate = fromISODate(range.from)
  const toDate = fromISODate(range.to)

  if (fromDate && toDate) {
    if (range.from === range.to) {
      return format(fromDate, 'dd MMM yyyy', { locale: dateLocale })
    }
    return `${format(fromDate, 'dd MMM', { locale: dateLocale })} - ${format(toDate, 'dd MMM yyyy', { locale: dateLocale })}`
  }

  return t('filters.datePresets.allTime')
}

