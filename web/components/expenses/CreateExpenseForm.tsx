'use client'

import { useEffect, useMemo, useCallback } from 'react'
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
import {
  ExpenseFormData,
  EXPENSE_SUBCATEGORIES
} from '@/lib/types/expenses'

interface Supply {
  id: string
  name: string
  category: string
}

interface CreateExpenseFormProps {
  form: UseFormReturn<ExpenseFormData>
  supplies: Supply[]
  categories?: any[]
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

  // DEBUG: Ver qué categorías llegan
  console.log('=== DEBUG CreateExpenseForm ===');
  console.log('Total categories received:', categories?.length);
  console.log('Categories sample:', categories?.slice(0, 3));

  // PERFORMANCE FIX: Memoize parent categories (no parent_id)
  const parentCategories = useMemo(
    () => {
      const parents = (categories || []).filter((c: any) => !c.parent_id);
      console.log('Parent categories:', parents.length, parents.map(p => p.display_name || p.name));
      return parents;
    },
    [categories]
  )

  // PERFORMANCE FIX: Memoize category options to avoid recreation on every render
  const categoryOptions = useMemo(
    () => parentCategories.map((c: any) => ({
      value: c.display_name || c.name,
      label: c.display_name || c.name
    })),
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
    console.log('=== CALCULATING SUBCATEGORIES ===');
    console.log('watchCategory:', watchCategory);

    if (!watchCategory) {
      console.log('No category selected, returning empty');
      return []
    }

    // Find the selected parent category
    const selectedParent = parentCategories.find(
      (c: any) => (c.display_name || c.name) === watchCategory
    )

    console.log('Selected parent:', selectedParent);

    if (!selectedParent) {
      console.log('Selected parent not found!');
      return []
    }

    // Filter subcategories that have this category as parent
    const subcategories = (categories || []).filter(
      (c: any) => c.parent_id === selectedParent.id
    )

    console.log(`Subcategories for ${watchCategory}:`, subcategories.length);
    console.log('Subcategory names:', subcategories.map(s => s.display_name || s.name));

    // Map to options format
    const options = subcategories.map((c: any) => ({
      value: c.display_name || c.name,
      label: c.display_name || c.name
    }));

    console.log('Subcategory options:', options);
    return options;
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
                  onChange={(value) => {
                    const num = typeof value === 'number' ? value : parseFloat(String(value))
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
                    const match = categories.find((c: any) => (c.display_name || c.name) === val)
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
                  <SelectField
                    label={tFields('supply')}
                    placeholder={t('select_supply')}
                    value={field.value || ''}
                    onChange={field.onChange}
                    options={supplyOptions}
                    error={fieldState.error?.message}
                  />
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
                    onChange={(value) => field.onChange(parseInt(value.toString()) || undefined)}
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
                      onChange={(value) => field.onChange(parseInt(value.toString()) || undefined)}
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
