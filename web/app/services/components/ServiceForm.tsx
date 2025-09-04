'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputField, SelectField, TextareaField, FormGrid, FormSection } from '@/components/ui/form-field'
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
          <div>
            <label className="text-sm font-medium">
              {t('fields.category')}
            </label>
            <SelectWithCreate
              value={form.watch('category')}
              onValueChange={(value) => form.setValue('category', value)}
              options={categories.map((cat: any) => ({
                value: cat.id,
                label: cat.name
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
                <div>
                  {index === 0 && (
                    <label className="text-sm font-medium mb-2 block">
                      {t('fields.supply')}
                    </label>
                  )}
                  <SelectWithCreate
                    value={ss.supply_id}
                    onValueChange={(value) => {
                      const updated = [...serviceSupplies]
                      updated[index].supply_id = value
                      onSuppliesChange(updated)
                    }}
                    options={supplies.map((supply: any) => ({
                      value: supply.id,
                      label: `${supply.name} - ${formatCurrency(supply.cost_per_unit_cents)}`
                    }))}
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
                        step: '0.01',
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