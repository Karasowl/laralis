'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputField, SelectField, TextareaField, FormGrid, FormSection } from '@/components/ui/form-field'
import { formatCurrency } from '@/lib/money'

interface ServiceFormProps {
  form: any
  categories: any[]
  supplies: any[]
  serviceSupplies: Array<{ supply_id: string; quantity: number }>
  onSuppliesChange: (supplies: Array<{ supply_id: string; quantity: number }>) => void
  t: (key: string) => string
}

export function ServiceForm({ 
  form, 
  categories, 
  supplies, 
  serviceSupplies, 
  onSuppliesChange, 
  t 
}: ServiceFormProps) {
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
          <SelectField
            label={t('fields.category')}
            value={form.watch('category')}
            onChange={(value) => form.setValue('category', value)}
            options={categories.map((cat: any) => ({
              value: cat.id,
              label: cat.name
            }))}
            error={form.formState.errors.category?.message}
          />
          <InputField
            type="number"
            label={t('fields.duration')}
            value={form.watch('duration_minutes')}
            onChange={(value) => form.setValue('duration_minutes', parseInt(value as string) || 0)}
            helper={t('duration_helper')}
            error={form.formState.errors.duration_minutes?.message}
            required
          />
          <InputField
            type="number"
            step="0.01"
            label={t('fields.base_price')}
            value={(form.watch('base_price_cents') / 100).toFixed(2)}
            onChange={(value) => form.setValue('base_price_cents', parseFloat(value as string) * 100 || 0)}
            error={form.formState.errors.base_price_cents?.message}
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
                <SelectField
                  label={index === 0 ? t('fields.supply') : ''}
                  value={ss.supply_id}
                  onChange={(value) => {
                    const updated = [...serviceSupplies]
                    updated[index].supply_id = value
                    onSuppliesChange(updated)
                  }}
                  options={supplies.map((supply: any) => ({
                    value: supply.id,
                    label: `${supply.name} - ${formatCurrency(supply.cost_per_unit_cents)}`
                  }))}
                  placeholder={t('select_supply')}
                />
              </div>
              <div className="w-32">
                <InputField
                  type="number"
                  label={index === 0 ? t('fields.quantity') : ''}
                  value={ss.quantity}
                  onChange={(value) => {
                    const updated = [...serviceSupplies]
                    updated[index].quantity = parseInt(value as string) || 0
                    onSuppliesChange(updated)
                  }}
                  min={1}
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
            onClick={() => {
              onSuppliesChange([...serviceSupplies, { supply_id: '', quantity: 1 }])
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('add_supply')}
          </Button>
        </div>
      </FormSection>
    </div>
  )
}