'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { SmartFilters, FilterConfig, FilterValues } from '@/components/ui/smart-filters'
import { type ExpenseFilters } from '@/lib/types/expenses'

interface Option {
  value: string
  label: string
}

interface ExpenseSmartFiltersProps {
  filters: ExpenseFilters
  setFilters: (updates: Partial<ExpenseFilters>) => void
  categoryOptions: Option[]
  subcategoryOptions: Option[]
}

export function ExpenseSmartFilters({
  filters,
  setFilters,
  categoryOptions,
  subcategoryOptions,
}: ExpenseSmartFiltersProps) {
  const t = useTranslations('expenses')

  // Convert internal filter options to SmartFilters format
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      key: 'date_range',
      type: 'date-range',
      label: t('filters.dateRange'),
    },
    {
      key: 'category',
      type: 'select',
      label: t('filters.category'),
      options: categoryOptions.filter(o => o.value !== 'all'),
    },
    {
      key: 'subcategory',
      type: 'select',
      label: t('filters.subcategory'),
      options: subcategoryOptions.filter(o => o.value !== 'all'),
    },
    {
      key: 'amount',
      type: 'number-range',
      label: t('filters.amount'),
      multiplier: 100, // Convert pesos to cents
    },
    {
      key: 'is_recurring',
      type: 'select',
      label: t('filters.recurring'),
      options: [
        { value: 'true', label: t('filters.yes') },
        { value: 'false', label: t('filters.no') },
      ],
    },
  ], [t, categoryOptions, subcategoryOptions])

  // Convert ExpenseFilters to SmartFilters format
  const filterValues: FilterValues = useMemo(() => ({
    date_range: {
      from: filters.start_date || '',
      to: filters.end_date || '',
    },
    category: filters.category || '',
    subcategory: filters.subcategory || '',
    amount: {
      from: filters.min_amount ? (filters.min_amount / 100).toString() : '',
      to: filters.max_amount ? (filters.max_amount / 100).toString() : '',
    },
    is_recurring: typeof filters.is_recurring === 'boolean'
      ? String(filters.is_recurring)
      : '',
  }), [filters])

  // Handle changes from SmartFilters
  const handleChange = (values: FilterValues) => {
    const updates: Partial<ExpenseFilters> = {}

    // Date range
    if (values.date_range) {
      updates.start_date = values.date_range.from || undefined
      updates.end_date = values.date_range.to || undefined
    } else {
      updates.start_date = undefined
      updates.end_date = undefined
    }

    // Category
    updates.category = values.category || undefined

    // Subcategory
    updates.subcategory = values.subcategory || undefined

    // Amount range (convert back to cents)
    if (values.amount) {
      updates.min_amount = values.amount.from ? Number(values.amount.from) * 100 : undefined
      updates.max_amount = values.amount.to ? Number(values.amount.to) * 100 : undefined
    } else {
      updates.min_amount = undefined
      updates.max_amount = undefined
    }

    // Recurring filter
    if (values.is_recurring === 'true') {
      updates.is_recurring = true
    } else if (values.is_recurring === 'false') {
      updates.is_recurring = false
    } else {
      updates.is_recurring = undefined
    }

    setFilters(updates)
  }

  return (
    <SmartFilters
      filters={filterConfigs}
      values={filterValues}
      onChange={handleChange}
      className="mb-4"
    />
  )
}
