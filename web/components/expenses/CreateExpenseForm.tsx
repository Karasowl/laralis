'use client'

import { useEffect, useMemo, type ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import { UseFormReturn, useWatch } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import {
  InputField,
  TextareaField,
  SelectField,
  FormGrid,
  FormSection,
} from '@/components/ui/form-field'
import { SelectWithCreate } from '@/components/ui/select-with-create'
import { ExpenseFormData } from '@/lib/types/expenses'
import type { CategoryRow } from '@/hooks/use-categories'

interface Supply {
  id: string
  name: string
  category: string
}

type CategoryNode = CategoryRow & {
  id?: string
  parent_id?: string | null
  name?: string | null
  display_name?: string | null
}

interface CreateExpenseFormProps {
  form: UseFormReturn<ExpenseFormData>
  supplies: Supply[]
  categories?: CategoryNode[]
  showAssetFields: boolean
  setShowAssetFields: (show: boolean) => void
}

export function CreateExpenseForm({
  form,
  supplies,
  categories = [],
  showAssetFields,
  setShowAssetFields
}: CreateExpenseFormProps) {
  const t = useTranslations('expenses')
  const tFields = useTranslations('fields')

  // PERFORMANCE FIX: Use useWatch for selective subscriptions
  const watchCategory = useWatch({ control: form.control, name: 'category' })
  const watchCreateAsset = useWatch({ control: form.control, name: 'create_asset' })

  // PERFORMANCE FIX: Memoize parent categories (no parent_id)
  const parentCategories = useMemo(
    () => (categories || []).filter((c) => !c.parent_id),
    [categories]
  )

  // PERFORMANCE FIX: Memoize category options to avoid recreation on every render
  const categoryOptions = useMemo(
    () => parentCategories
      .map((c) => {
        const label = c.display_name || c.name || ''
        return { value: label, label }
      })
      .filter((option) => option.value.length > 0),
    [parentCategories]
  )

  // PERFORMANCE FIX: Memoize supply options mapping
  const supplyOptions = useMemo(
    () => supplies.map((supply) => ({
      value: supply.id,
      label: `${supply.name} (${supply.category})`
    })),
    [supplies]
  )

  // PERFORMANCE FIX: Memoize subcategory calculation using dynamic filtering
  const subcategoryOptions = useMemo(() => {
    if (!watchCategory) return []

    // Find the selected parent category
    const selectedParent = parentCategories.find(
      (c) => (c.display_name || c.name) === watchCategory
    )
    if (!selectedParent) return []

    // Filter subcategories that have this category as parent
    const subcategories = (categories || []).filter(
      (c) => c.parent_id === selectedParent.id
    )

    // Map to options format
    return subcategories
      .map((c) => {
        const label = c.display_name || c.name || ''
        return { value: label, label }
      })
      .filter((option) => option.value.length > 0)
  }, [watchCategory, categories, parentCategories])

  // Show asset fields when category is "Equipos"
  useEffect(() => {
    setShowAssetFields(watchCategory === 'Equipos')
    if (watchCategory === 'Equipos') {
      form.setValue('create_asset', true)
    } else {
      form.setValue('create_asset', false)
      form.setValue('asset_name', '')
      form.setValue('asset_useful_life_years', undefined)
    }
  }, [watchCategory, form, setShowAssetFields])

  return (
    <Form {...form}>
      <div className="space-y-6">
        {/* Basic Information */}
        <FormSection title={t('basic_information')}>
          <FormGrid columns={2}>
            <FormField
              control={form.control}
              name="expense_date"
              render={({ field, fieldState }) => (
                <InputField
                  type="date"
                  label={tFields('date')}
                  value={field.value || ''}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  required
                />
              )}
            />

            <FormField
              control={form.control}
              name="amount_pesos"
              render={({ field, fieldState }) => (
                <InputField
                  type="number"
                  step="0.01"
                  label={tFields('amount')}
                  placeholder="0.00"
                  value={field.value ?? ''}
                  onChange={(value: string | number | ChangeEvent<HTMLInputElement>) => {
                    const raw = typeof value === 'object' ? value.target.value : value
                    const num = typeof raw === 'number' ? raw : parseFloat(String(raw))
                    field.onChange(Number.isFinite(num) ? num : undefined)
                  }}
                  error={fieldState.error?.message}
                  required
                />
              )}
            />
          </FormGrid>
        </FormSection>

        {/* Category and Subcategory */}
        <FormSection title={t('categorization')}>
          <FormGrid columns={2}>
            <FormField
              control={form.control}
              name="category"
              render={({ field, fieldState }) => (
                <SelectField
                  label={tFields('category')}
                  placeholder={t('select_category')}
                  value={field.value || ''}
                  onChange={(val) => {
                    // Update both display string and category_id
                    field.onChange(val)
                    const match = categories.find((c) => (c.display_name || c.name || '') === val)
                    if (match) {
                      form.setValue('category_id', match.id)
                    }
                  }}
                  options={categoryOptions}
                  error={fieldState.error?.message}
                  required
                />
              )}
            />

            <FormField
              control={form.control}
              name="subcategory"
              render={({ field, fieldState }) => (
                <SelectField
                  label={tFields('subcategory')}
                  placeholder={t('select_subcategory')}
                  value={field.value || ''}
                  onChange={field.onChange}
                  options={subcategoryOptions}
                  error={fieldState.error?.message}
                />
              )}
            />
          </FormGrid>
        </FormSection>

        {/* Description and Details */}
        <FormSection title={t('details')}>
          <FormField
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <TextareaField
                label={tFields('description')}
                placeholder={t('description_placeholder')}
                value={field.value || ''}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />

          <FormGrid columns={2}>
            <FormField
              control={form.control}
              name="vendor"
              render={({ field, fieldState }) => (
                <InputField
                  label={tFields('vendor')}
                  placeholder={t('vendor_placeholder')}
                  value={field.value || ''}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />

            <FormField
              control={form.control}
              name="invoice_number"
              render={({ field, fieldState }) => (
                <InputField
                  label={tFields('invoice_number')}
                  placeholder={t('invoice_placeholder')}
                  value={field.value || ''}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          </FormGrid>
        </FormSection>

        {/* Supply Integration */}
        {watchCategory === 'Insumos' && (
          <FormSection 
            title={t('supply_integration')}
            className="p-4 bg-muted/50 rounded-lg"
          >
            <FormGrid columns={2}>
              <FormField
                control={form.control}
                name="related_supply_id"
                render={({ field, fieldState }) => (
                  <div className="space-y-1">
                    <label className="text-xs sm:text-sm font-medium">{tFields('supply')}</label>
                    <SelectWithCreate
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      options={supplyOptions}
                      placeholder={t('select_supply')}
                      searchPlaceholder={t('search_supply')}
                      emptyText={t('no_supplies_found')}
                    />
                    {fieldState.error?.message && (
                      <p className="text-sm text-destructive">{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field, fieldState }) => (
                  <InputField
                    type="number"
                    label={tFields('quantity')}
                    placeholder={t('quantity_placeholder')}
                    value={field.value || 0}
                    onChange={(value: string | number | ChangeEvent<HTMLInputElement>) => {
                      const raw = typeof value === 'object' ? value.target.value : value
                      const parsed = parseInt(String(raw), 10)
                      field.onChange(Number.isFinite(parsed) ? parsed : undefined)
                    }}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </FormGrid>
          </FormSection>
        )}

        {/* Asset Creation */}
        {showAssetFields && (
          <FormSection 
            title={t('asset_creation')}
            className="p-4 bg-muted/50 rounded-lg"
          >
            <FormField
              control={form.control}
              name="create_asset"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t('create_asset')}</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {watchCreateAsset && (
              <FormGrid columns={2}>
                <FormField
                  control={form.control}
                  name="asset_name"
                  render={({ field, fieldState }) => (
                    <InputField
                      label={tFields('asset_name')}
                      placeholder={t('asset_name_placeholder')}
                      value={field.value || ''}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="asset_useful_life_years"
                  render={({ field, fieldState }) => (
                    <InputField
                      type="number"
                      label={tFields('useful_life')}
                      placeholder={t('useful_life_placeholder')}
                      value={field.value || 0}
                      onChange={(value: string | number | ChangeEvent<HTMLInputElement>) => {
                        const raw = typeof value === 'object' ? value.target.value : value
                        const parsed = parseInt(String(raw), 10)
                        field.onChange(Number.isFinite(parsed) ? parsed : undefined)
                      }}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </FormGrid>
            )}
          </FormSection>
        )}

        {/* Options */}
        <FormSection title={t('options')}>
          <FormField
            control={form.control}
            name="is_recurring"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>{tFields('recurring')}</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </FormSection>
      </div>
    </Form>
  )
}
