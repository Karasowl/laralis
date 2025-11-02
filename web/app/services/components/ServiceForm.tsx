'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { InputField, TextareaField, FormGrid, FormSection } from '@/components/ui/form-field'
import { SelectWithCreate } from '@/components/ui/select-with-create'
import { CategorySelect } from '@/components/ui/category-select'
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

  // PERFORMANCE FIX: Only watch fields needed for display calculations
  const categoryValue = useWatch({ control: form.control, name: 'category' })
  const estMinutes = useWatch({ control: form.control, name: 'est_minutes' })
  const descriptionValue = useWatch({ control: form.control, name: 'description' })

  // PERFORMANCE FIX: Memoize category options mapping to avoid recreation on every render
  const categoryOptions = React.useMemo(
    () => categories.map((cat: any) => ({
      value: cat.id || cat.code || cat.name,
      label: cat.display_name || cat.name || cat.code || ''
    })),
    [categories]
  )

  // PERFORMANCE FIX: Memoize supply options with formatCurrency - CRITICAL optimization
  // This was causing major lag because formatCurrency ran on every keystroke
  const supplyOptions = React.useMemo(
    () => supplies.map((supply: any) => {
      const costCents = supply.cost_per_portion_cents ?? supply.cost_per_unit_cents ?? supply.price_cents ?? 0
      const labelCost = Number.isFinite(costCents) ? formatCurrency(costCents) : t('unknown_cost')
      return {
        value: supply.id,
        label: `${supply.name} - ${labelCost}`
      }
    }),
    [supplies, t]
  )

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
    onSuppliesChange([...serviceSupplies, { supply_id: '', quantity: 1 }])
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
            placeholder={t('namePlaceholder')}
            {...form.register('name')}
            error={form.formState.errors.name?.message}
            required
          />
          <div>
            <label className="text-sm font-medium">
              {t('fields.category')}
            </label>
            <CategorySelect
              type="services"
              value={categoryValue}
              onValueChange={(value) => form.setValue('category', value)}
              placeholder={t('select_category')}
            />
            {form.formState.errors.category?.message && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.category?.message}</p>
            )}
          </div>
          <InputField
            type="number"
            label={t('fields.duration')}
            placeholder={t('durationPlaceholder')}
            {...form.register('est_minutes', { valueAsNumber: true })}
            helperText={t('duration_helper')}
            error={form.formState.errors.est_minutes?.message}
            required
          />
          <div>
            <label className="text-sm font-medium block mb-2">
              {t('fields.base_price_auto')}
            </label>
            <input
              type="text"
              value={formatCurrency(totalServiceCostCents)}
              readOnly
              className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground ring-offset-background"
            />
            <input
              type="hidden"
              {...form.register('base_price_cents', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground mt-1">{t('auto_base_price_hint')}</p>
            {form.formState.errors.base_price_cents?.message && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.base_price_cents?.message}</p>
            )}
          </div>
          <InputField
            type="number"
            label={t('fields.margin_pct')}
            placeholder="30"
            {...form.register('margin_pct', { valueAsNumber: true })}
            helperText={t('margin_pct_helper')}
            error={form.formState.errors.margin_pct?.message}
            min={0}
            max={500}
          />
        </FormGrid>
        <div className="space-y-1">
          <label className="text-sm font-medium">
            {t('fields.description')}
          </label>
          <textarea
            id="description"
            name="description"
            value={descriptionValue || ''}
            onChange={(e) => {
              form.setValue('description', e.target.value, {
                shouldValidate: false,
                shouldDirty: true
              })
            }}
            placeholder={t('description_placeholder')}
            rows={3}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {form.formState.errors.description?.message && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.description?.message}</p>
          )}
        </div>
      </FormSection>

      <FormSection title={t('supplies_section')} description={t('supplies_section_hint')}>
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
                    options={supplyOptions}
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
                  onChange={(e) => {
                    const val = typeof e === 'object' && 'target' in e ? e.target.value : e
                    handleQuantityChange(index, val)
                  }}
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
          <div className="rounded-lg border bg-card dark:bg-slate-800/50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('variableCost')}</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(variableCostCents)}</p>
          </div>
          <div className="rounded-lg border bg-card dark:bg-slate-800/50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('fixedCostTreatment')}</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(totalFixedCostCents)}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('fixedPerMinute')}: {formatCurrency(fixedCostPerMinuteCents)} x {estMinutes || 0} min</p>
          </div>
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-400">{t('baseCost')}</p>
            <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(totalServiceCostCents)}</p>
          </div>
        </div>
        {fixedCostPerMinuteCents === 0 && (
          <p className="text-xs text-amber-600 mt-3">{t('time_settings_warning')}</p>
        )}
      </FormSection>
    </div>
  )
}
