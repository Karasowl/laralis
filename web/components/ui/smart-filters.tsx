'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Calendar, Filter, X, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Badge } from './badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover'

// Filter types
export type FilterType = 'date-range' | 'select' | 'multi-select' | 'number-range'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterConfig {
  key: string
  label: string
  type: FilterType
  options?: FilterOption[] // For select/multi-select
  placeholder?: string
  multiplier?: number // For number-range: multiply user input by this value (e.g., 100 for cents)
}

export interface FilterValues {
  [key: string]: any
}

interface SmartFiltersProps {
  filters: FilterConfig[]
  values: FilterValues
  onChange: (values: FilterValues) => void
  className?: string
}

export function SmartFilters({ filters, values, onChange, className }: SmartFiltersProps) {
  const t = useTranslations('common')
  const tFilters = useTranslations('filters')

  const activeFiltersCount = React.useMemo(() => {
    return Object.entries(values).filter(([_, v]) => {
      if (v === null || v === undefined || v === '') return false
      if (Array.isArray(v) && v.length === 0) return false
      if (typeof v === 'object' && !Array.isArray(v)) {
        return Object.values(v).some(val => val !== null && val !== undefined && val !== '')
      }
      return true
    }).length
  }, [values])

  const clearAll = () => {
    const cleared: FilterValues = {}
    filters.forEach(f => {
      if (f.type === 'date-range' || f.type === 'number-range') {
        cleared[f.key] = { from: '', to: '' }
      } else if (f.type === 'multi-select') {
        cleared[f.key] = []
      } else {
        cleared[f.key] = ''
      }
    })
    onChange(cleared)
  }

  const updateFilter = (key: string, value: any) => {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Filter Icon with Count */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>{tFilters('title')}</span>
        {activeFiltersCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {activeFiltersCount}
          </Badge>
        )}
      </div>

      {/* Individual Filters */}
      {filters.map((filter) => (
        <FilterControl
          key={filter.key}
          config={filter}
          value={values[filter.key]}
          onChange={(v) => updateFilter(filter.key, v)}
        />
      ))}

      {/* Clear All Button */}
      {activeFiltersCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          {tFilters('clearAll')}
        </Button>
      )}
    </div>
  )
}

// Individual Filter Control
interface FilterControlProps {
  config: FilterConfig
  value: any
  onChange: (value: any) => void
}

function FilterControl({ config, value, onChange }: FilterControlProps) {
  const tFilters = useTranslations('filters')

  switch (config.type) {
    case 'date-range':
      return <DateRangeFilter config={config} value={value} onChange={onChange} />
    case 'select':
      return <SelectFilter config={config} value={value} onChange={onChange} />
    case 'multi-select':
      return <MultiSelectFilter config={config} value={value} onChange={onChange} />
    case 'number-range':
      return <NumberRangeFilter config={config} value={value} onChange={onChange} />
    default:
      return null
  }
}

// Date Range Filter
function DateRangeFilter({ config, value, onChange }: FilterControlProps) {
  const tFilters = useTranslations('filters')
  const [open, setOpen] = React.useState(false)

  const hasValue = value?.from || value?.to
  const displayValue = hasValue
    ? `${value?.from || '...'} - ${value?.to || '...'}`
    : config.label

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 border-dashed',
            hasValue && 'border-primary bg-primary/5'
          )}
        >
          <Calendar className="h-3.5 w-3.5 mr-1.5" />
          <span className="max-w-[150px] truncate">{displayValue}</span>
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {tFilters('dateFrom')}
            </label>
            <input
              type="date"
              value={value?.from || ''}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {tFilters('dateTo')}
            </label>
            <input
              type="date"
              value={value?.to || ''}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </div>
          {hasValue && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange({ from: '', to: '' })
                setOpen(false)
              }}
            >
              {tFilters('clear')}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Select Filter (single)
function SelectFilter({ config, value, onChange }: FilterControlProps) {
  const [open, setOpen] = React.useState(false)
  const tFilters = useTranslations('filters')

  const selectedOption = config.options?.find(o => o.value === value)
  const displayValue = selectedOption?.label || config.label

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 border-dashed',
            value && 'border-primary bg-primary/5'
          )}
        >
          <span className="max-w-[120px] truncate">{displayValue}</span>
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="space-y-0.5">
          {config.options?.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value === value ? '' : option.value)
                setOpen(false)
              }}
              className={cn(
                'w-full flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors',
                option.value === value
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              )}
            >
              {option.label}
              {option.value === value && <Check className="h-4 w-4" />}
            </button>
          ))}
          {value && (
            <>
              <div className="border-t my-1" />
              <button
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="w-full flex items-center rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                {tFilters('clear')}
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Multi-Select Filter
function MultiSelectFilter({ config, value = [], onChange }: FilterControlProps) {
  const [open, setOpen] = React.useState(false)
  const tFilters = useTranslations('filters')

  const selectedCount = Array.isArray(value) ? value.length : 0
  const displayValue = selectedCount > 0
    ? `${config.label} (${selectedCount})`
    : config.label

  const toggleOption = (optionValue: string) => {
    const currentValues = Array.isArray(value) ? value : []
    const newValues = currentValues.includes(optionValue)
      ? currentValues.filter(v => v !== optionValue)
      : [...currentValues, optionValue]
    onChange(newValues)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 border-dashed',
            selectedCount > 0 && 'border-primary bg-primary/5'
          )}
        >
          <span className="max-w-[120px] truncate">{displayValue}</span>
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
          {config.options?.map((option) => {
            const isSelected = Array.isArray(value) && value.includes(option.value)
            return (
              <button
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className={cn(
                  'w-full flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors',
                  isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                )}
              >
                {option.label}
                {isSelected && <Check className="h-4 w-4" />}
              </button>
            )
          })}
          {selectedCount > 0 && (
            <>
              <div className="border-t my-1" />
              <button
                onClick={() => onChange([])}
                className="w-full flex items-center rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                {tFilters('clearAll')}
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Number Range Filter
function NumberRangeFilter({ config, value, onChange }: FilterControlProps) {
  const [open, setOpen] = React.useState(false)
  const tFilters = useTranslations('filters')

  const hasValue = value?.from || value?.to
  const displayValue = hasValue
    ? `$${value?.from || '0'} - $${value?.to || '∞'}`
    : config.label

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 border-dashed',
            hasValue && 'border-primary bg-primary/5'
          )}
        >
          <span className="max-w-[120px] truncate">{displayValue}</span>
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {tFilters('min')}
            </label>
            <input
              type="number"
              value={value?.from || ''}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              placeholder="0"
              className="w-28 rounded-md border px-3 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {tFilters('max')}
            </label>
            <input
              type="number"
              value={value?.to || ''}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              placeholder="∞"
              className="w-28 rounded-md border px-3 py-1.5 text-sm"
            />
          </div>
          {hasValue && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange({ from: '', to: '' })
                setOpen(false)
              }}
            >
              {tFilters('clear')}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Hook to filter data based on filter values
export function useSmartFilter<T>(
  data: T[],
  filterValues: FilterValues,
  filterConfigs: FilterConfig[]
): T[] {
  return React.useMemo(() => {
    if (!data || !Array.isArray(data)) return []

    return data.filter(item => {
      return filterConfigs.every(config => {
        const filterValue = filterValues[config.key]

        // Skip if no filter value
        if (filterValue === null || filterValue === undefined || filterValue === '') return true
        if (Array.isArray(filterValue) && filterValue.length === 0) return true
        if (typeof filterValue === 'object' && !Array.isArray(filterValue)) {
          const hasValue = Object.values(filterValue).some(v => v !== null && v !== undefined && v !== '')
          if (!hasValue) return true
        }

        // Get item value (support dot notation)
        const itemValue = config.key.includes('.')
          ? config.key.split('.').reduce((obj: any, k) => obj?.[k], item)
          : (item as any)[config.key]

        switch (config.type) {
          case 'date-range': {
            if (!itemValue) return false
            const date = new Date(itemValue)
            if (filterValue.from && date < new Date(filterValue.from)) return false
            if (filterValue.to) {
              const toDate = new Date(filterValue.to)
              toDate.setHours(23, 59, 59, 999)
              if (date > toDate) return false
            }
            return true
          }
          case 'number-range': {
            const num = Number(itemValue)
            if (isNaN(num)) return false
            const mult = config.multiplier || 1
            if (filterValue.from && num < Number(filterValue.from) * mult) return false
            if (filterValue.to && num > Number(filterValue.to) * mult) return false
            return true
          }
          case 'select': {
            return String(itemValue) === String(filterValue)
          }
          case 'multi-select': {
            return filterValue.includes(String(itemValue))
          }
          default:
            return true
        }
      })
    })
  }, [data, filterValues, filterConfigs])
}
