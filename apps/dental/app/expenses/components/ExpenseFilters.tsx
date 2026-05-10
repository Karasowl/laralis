'use client'

import React from 'react'
import { CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { FormGrid, InputField, SelectField } from '@/components/ui/form-field'
import { type ExpenseFilters as ExpenseFiltersType } from '@/lib/types/expenses'

interface Option {
  value: string
  label: string
}

interface ExpenseFiltersProps {
  filters: ExpenseFiltersType
  amountMinInput: number | ''
  amountMaxInput: number | ''
  t: (key: string) => string
  setFilters: (filters: Partial<ExpenseFiltersType>) => void
  handleSelectFilter: (field: keyof ExpenseFiltersType, value: string) => void
  handleBooleanFilter: (field: keyof ExpenseFiltersType, value: string) => void
  handleMinAmountChange: (value: string | number | React.ChangeEvent<HTMLInputElement>) => void
  handleMaxAmountChange: (value: string | number | React.ChangeEvent<HTMLInputElement>) => void
  resetFilters: () => void
  refresh: () => void
  categoryOptions: Option[]
  subcategoryOptions: Option[]
}

export function ExpenseFiltersCard({
  filters,
  amountMinInput,
  amountMaxInput,
  t,
  setFilters,
  handleSelectFilter,
  handleBooleanFilter,
  handleMinAmountChange,
  handleMaxAmountChange,
  resetFilters,
  refresh,
  categoryOptions,
  subcategoryOptions,
}: ExpenseFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="h-5 w-5" />
          {t('filters.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormGrid columns={3}>
          <SelectField
            label={t('filters.category')}
            value={filters.category ? filters.category : 'all'}
            onChange={(value) => handleSelectFilter('category', value)}
            options={categoryOptions}
          />
          <SelectField
            label={t('filters.subcategory')}
            value={filters.subcategory ? filters.subcategory : 'all'}
            onChange={(value) => handleSelectFilter('subcategory', value)}
            options={subcategoryOptions}
          />
          <InputField
            label={t('filters.vendor')}
            value={filters.vendor || ''}
            onChange={(value) => setFilters({ vendor: String(value) || undefined })}
            placeholder={t('filters.vendorPlaceholder')}
          />
          <InputField
            type="date"
            label={t('filters.dateFrom')}
            value={filters.start_date || ''}
            onChange={(value) => setFilters({ start_date: String(value) || undefined })}
          />
          <InputField
            type="date"
            label={t('filters.dateTo')}
            value={filters.end_date || ''}
            onChange={(value) => setFilters({ end_date: String(value) || undefined })}
          />
          <InputField
            type="number"
            label={t('filters.amountMin')}
            value={amountMinInput === '' ? '' : Number(amountMinInput)}
            onChange={handleMinAmountChange}
            min={0}
            step={0.01}
          />
          <InputField
            type="number"
            label={t('filters.amountMax')}
            value={amountMaxInput === '' ? '' : Number(amountMaxInput)}
            onChange={handleMaxAmountChange}
            min={0}
            step={0.01}
          />
          <SelectField
            label={t('filters.recurring')}
            value={typeof filters.is_recurring === 'boolean' ? String(filters.is_recurring) : 'any'}
            onChange={(value) => handleBooleanFilter('is_recurring', value)}
            options={[
              { value: 'any', label: t('filters.any') },
              { value: 'true', label: t('filters.yes') },
              { value: 'false', label: t('filters.no') },
            ]}
          />
        </FormGrid>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={resetFilters}>
            {t('filters.reset')}
          </Button>
          <Button variant="outline" onClick={refresh}>
            {t('filters.refresh')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
