'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputField, TextareaField, FormGrid, FormSection } from '@/components/ui/form-field'
import { SelectWithCreate } from '@/components/ui/select-with-create'
import { formatCurrency } from '@/lib/money'

interface ServiceFormProps {
  form: any
  categories: any[]
  supplies: any[]
  serviceSupplies: Array<{ supply_id: string; quantity: number }>
  onSuppliesChange: (supplies: Array<{ supply_id: string; quantity: number }>) => void
  onCreateCategory?: (data: any) => Promise<any>
  onCreateSupply?: (data: any) => Promise<any>
  fixedCostPerMinuteCents: number
  totalFixedCostCents: number
  variableCostCents: number
  totalServiceCostCents: number
  t: (key: string) => string
}

export function ServiceForm({
  form,
  categories,
  supplies,
  serviceSupplies,
  onSuppliesChange,
  onCreateCategory,
  onCreateSupply,
  fixedCostPerMinuteCents,
  totalFixedCostCents,
  variableCostCents,
  totalServiceCostCents,
  t
}: ServiceFormProps) {
  const quantityRefs = React.useRef<Array<HTMLInputElement | null>>([])

  const handleSupplySelect = React.useCallback((value: string, index: number) => {
    const updated = [...serviceSupplies]
    updated[index] = { ...updated[index], supply_id: value }
    onSuppliesChange(updated)
    setTimeout(() => {
      quantityRefs.current[index]?.focus()
    }, 0)
  }, [serviceSupplies, onSuppliesChange])

  const handleQuantityChange = React.useCallback((index: number, value: number | string) => {
    const updated = [...serviceSupplies]
    const numeric = typeof value === 'number' ? value : parseInt(String(value), 10)
    updated[index] = { ...updated[index], quantity: Number.isFinite(numeric) ? numeric : 0 }
    onSuppliesChange(updated)
  }, [serviceSupplies, onSuppliesChange])

  const handleQuantityRef = React.useCallback((index: number, node: HTMLInputElement | null) => {
    quantityRefs.current[index] = node
  }, [])

  const handleAddSupplyRow = React.useCallback(() => {
    onSuppliesChange([...serviceSupplies, { supply_id: '', quantity: 0 }])
    setTimeout(() => {
      quantityRefs.current[serviceSupplies.length]?.focus()
    }, 0)
  }, [serviceSupplies, onSuppliesChange])

  return (
    <div className="space-y-6">
      <FormSection title={t('basic_information')}>
        <FormGrid columns={2}>
          <InputField
            label={t('fields.name')}
            value={form.watch('name')}
            onChange={(value) => form.setValue('name', value)}
            error={form.formState.errors.name?.message}
            required
          />
          <div>
            <label className="text-sm font-medium">
              {t('fields.category')}
            </label>
            <SelectWithCreate
              value={form.watch('category')}
              onValueChange={(value) => form.setValue('category', value)}
              options={categories.map((cat: any) => ({
                value: cat.id || cat.code || cat.name,
                label: cat.display_name || cat.name || cat.code || ''
              }))}
              placeholder={t('select_category')}
              canCreate={true}
              entityName={t('entities.category')}
              createDialogTitle={t('categories.create_title')}
              createDialogDescription={t('categories.create_description')}
              createFields={[
                {
                  name: 'name',
                  label: t('fields.name'),
                  type: 'text',
                  required: true
                },
                {
                  name: 'description',
                  label: t('fields.description'),
                  type: 'textarea',
                  required: false
                }
              ]}
              onCreateSubmit={onCreateCategory}
            />
            {form.formState.errors.category?.message && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.category?.message}</p>
            )}
          </div>
          <InputField
            type="number"
            label={t('fields.duration')}
            value={form.watch('duration_minutes')}
            onChange={(value) => form.setValue('duration_minutes', typeof value === 'number' ? value : parseInt(String(value), 10) || 0)}
            helperText={t('duration_helper')}
            error={form.formState.errors.duration_minutes?.message}
            required
          />
          <InputField
            type="number"
            step="0.01"
            label={t('fields.base_price')}
            value={(form.watch('base_price_cents') || 0) / 100}
            onChange={() => {}}
            disabled
            helperText={t('auto_base_price_hint')}
          />
        </FormGrid>
        <TextareaField
          label={t('fields.description')}
          value={form.watch('description')}
          onChange={(value) => form.setValue('description', value)}
          placeholder={t('description_placeholder')}
          rows={3}
          error={form.formState.errors.description?.message}
        />
      </FormSection>

      <FormSection title={t('supplies_section')}>
        <div className="space-y-4">
          {serviceSupplies.map((ss: any, index: number) => (
            <div key={index} className="flex gap-2 items-end">
              <div className="flex-1">
                <div>
                  {index === 0 && (
                    <label className="text-sm font-medium mb-2 block">
                      {t('fields.supply')}
                    </label>
                  )}
                  <SelectWithCreate
                    value={ss.supply_id}
                    onValueChange={(value) => handleSupplySelect(value, index)}
                    options={supplies.map((supply: any) => {
                      const costCents = supply.cost_per_portion_cents ?? supply.cost_per_unit_cents ?? supply.price_cents ?? 0
                      const labelCost = Number.isFinite(costCents) ? formatCurrency(costCents) : t('unknown_cost')
                      return ({
                        value: supply.id,
                        label: `${supply.name} - ${labelCost}`
                      })
                    })}
                    placeholder={t('select_supply')}
                    canCreate={true}
                    entityName={t('entities.supply')}
                    createDialogTitle={t('supplies.create_title')}
                    createDialogDescription={t('supplies.create_quick_description')}
                    createFields={[
                      {
                        name: 'name',
                        label: t('fields.name'),
                        type: 'text',
                        required: true
                      },
                      {
                        name: 'unit',
                        label: t('fields.unit'),
                        type: 'text',
                        placeholder: 'pza, ml, gr',
                        required: true
                      },
                      {
                        name: 'cost_per_unit',
                        label: t('fields.cost_per_unit'),
                        type: 'number',
                                                placeholder: '0.00',
                        required: true
                      }
                    ]}
                    onCreateSubmit={onCreateSupply}
                  />
                </div>
              </div>
              <div className="w-32">
                <InputField
                  type="number"
                  label={index === 0 ? t('fields.quantity') : ''}
                  value={ss.quantity ?? 0}
                  onChange={(value) => handleQuantityChange(index, value)}
                  min={0}
                  inputRef={(node) => handleQuantityRef(index, node)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  onSuppliesChange(serviceSupplies.filter((_: any, i: number) => i !== index))
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={handleAddSupplyRow}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('add_supply')}
          </Button>
        </div>
      </FormSection>

      <FormSection title={t('costSummary')}>
        <p className="text-sm text-muted-foreground">{t('cost_summary_note')}</p>
        <div className="grid gap-4 sm:grid-cols-3 pt-4">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('variableCost')}</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(variableCostCents)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('fixedCostTreatment')}</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(totalFixedCostCents)}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('fixedPerMinute')}: {formatCurrency(fixedCostPerMinuteCents)} x {form.watch('duration_minutes') || 0} min</p>
          </div>
          <div className="rounded-lg border bg-blue-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-blue-700">{t('baseCost')}</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{formatCurrency(totalServiceCostCents)}</p>
          </div>
        </div>
        {fixedCostPerMinuteCents === 0 && (
          <p className="text-xs text-amber-600 mt-3">{t('time_settings_warning')}</p>
        )}
      </FormSection>
    </div>
  )
}
