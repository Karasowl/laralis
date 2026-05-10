'use client'

import { useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { FormGrid, FormSection, InputField, SelectField } from '@/components/ui/form-field'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { type ExpenseFormData, ALL_EXPENSE_CATEGORIES } from '@/lib/types/expenses'

interface Option {
  value: string
  label: string
}

interface ExpenseFormProps {
  form: ReturnType<typeof useForm<ExpenseFormData>>
  t: (key: string) => string
  categoryOptions: Option[]
  getSubcategoriesForCategory: (categoryName: string) => Option[]
  supplyOptions: Option[]
  campaignOptions: Option[]
  fixedCostOptions: Option[]
}

export function ExpenseForm({
  form,
  t,
  categoryOptions,
  getSubcategoriesForCategory,
  supplyOptions,
  campaignOptions,
  fixedCostOptions,
}: ExpenseFormProps) {
  const selectedCategory = form.watch('category')
  const selectedSupply = form.watch('related_supply_id') || 'none'
  const selectedCampaign = form.watch('campaign_id') || 'none'
  const createAsset = form.watch('create_asset')
  const isRecurring = form.watch('is_recurring')
  const recurrenceInterval = form.watch('recurrence_interval')
  const selectedFixedCost = form.watch('related_fixed_cost_id') || 'none'

  // Calculate subcategories dynamically based on selected category
  const subcategoryOptions = useMemo(
    () => getSubcategoriesForCategory(selectedCategory || ''),
    [selectedCategory, getSubcategoriesForCategory]
  )

  return (
    <div className="space-y-6">
      <FormSection title={t('form.sections.basic')}>
        <FormGrid columns={2}>
          <Controller
            control={form.control}
            name="expense_date"
            render={({ field, fieldState }) => (
              <InputField
                type="date"
                label={t('form.fields.date')}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                required
              />
            )}
          />
          <Controller
            control={form.control}
            name="amount_pesos"
            render={({ field, fieldState }) => (
              <InputField
                type="number"
                label={t('form.fields.amount')}
                value={field.value || ''}
                onChange={(value) => {
                  const numValue =
                    value === '' || value === null || value === undefined
                      ? 0
                      : typeof value === 'string'
                        ? parseFloat(value) || 0
                        : Number(value) || 0
                  field.onChange(numValue)
                }}
                min={0}
                step={0.01}
                error={fieldState.error?.message}
                required
              />
            )}
          />
          <Controller
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <InputField
                label={t('form.fields.description')}
                value={field.value}
                onChange={field.onChange}
                placeholder={t('form.fields.descriptionPlaceholder')}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="vendor"
            render={({ field }) => (
              <InputField
                label={t('form.fields.vendor')}
                value={field.value}
                onChange={field.onChange}
                placeholder={t('form.fields.vendorPlaceholder')}
              />
            )}
          />
          <Controller
            control={form.control}
            name="invoice_number"
            render={({ field }) => (
              <InputField
                label={t('form.fields.invoice')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FormGrid>
        <Controller
          control={form.control}
          name="notes"
          render={({ field }) => (
            <div className="space-y-1">
              <Label htmlFor="expense-notes">{t('form.fields.notes')}</Label>
              <Textarea
                id="expense-notes"
                value={field.value || ''}
                onChange={(event) => field.onChange(event.target.value)}
                rows={3}
              />
            </div>
          )}
        />
      </FormSection>

      <FormSection title={t('form.sections.classification')}>
        <FormGrid columns={2}>
          <SelectField
            label={t('form.fields.category')}
            value={form.watch('category')}
            onChange={(value) => form.setValue('category', value)}
            options={categoryOptions}
            required
            error={form.formState.errors.category?.message}
          />
          <SelectField
            label={t('form.fields.subcategory')}
            value={form.watch('subcategory') || ''}
            onChange={(value) => form.setValue('subcategory', value)}
            options={subcategoryOptions}
          />
          {selectedCategory === 'Marketing' && (
            <SelectField
              label={t('form.fields.campaign')}
              value={selectedCampaign}
              onChange={(value) => {
                form.setValue('campaign_id', value === 'none' ? undefined : value)
              }}
              options={campaignOptions}
              helperText={t('form.fields.campaignHelp')}
            />
          )}
        </FormGrid>
        <Controller
          control={form.control}
          name="is_recurring"
          render={({ field }) => (
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="expense-is-recurring"
                checked={field.value}
                onCheckedChange={(checked) => {
                  field.onChange(Boolean(checked))
                  // Clear recurrence fields when unchecking
                  if (!checked) {
                    form.setValue('recurrence_interval', undefined)
                    form.setValue('recurrence_day', undefined)
                  }
                }}
              />
              <Label htmlFor="expense-is-recurring" className="text-sm">
                {t('form.fields.isRecurring')}
              </Label>
            </div>
          )}
        />
        {isRecurring && (
          <FormGrid columns={2}>
            <SelectField
              label={t('form.fields.recurrenceInterval')}
              value={recurrenceInterval || ''}
              onChange={(value) => form.setValue('recurrence_interval', value === '' ? undefined : value as 'weekly' | 'monthly' | 'yearly')}
              options={[
                { value: '', label: t('form.fields.recurrenceIntervalNone') },
                { value: 'weekly', label: t('form.fields.recurrenceIntervalWeekly') },
                { value: 'monthly', label: t('form.fields.recurrenceIntervalMonthly') },
                { value: 'yearly', label: t('form.fields.recurrenceIntervalYearly') },
              ]}
            />
            <Controller
              control={form.control}
              name="recurrence_day"
              render={({ field }) => (
                <InputField
                  type="number"
                  label={t('form.fields.recurrenceDay')}
                  value={field.value ?? ''}
                  onChange={(value) => field.onChange(value === '' ? undefined : Number(value))}
                  min={1}
                  max={recurrenceInterval === 'weekly' ? 7 : 31}
                  step={1}
                  helperText={t('form.fields.recurrenceDayHelp')}
                  disabled={!recurrenceInterval}
                />
              )}
            />
          </FormGrid>
        )}
      </FormSection>

      <FormSection title={t('fields.expense_category')} description={t('fields.expense_category_help')}>
        <FormGrid columns={2}>
          <Controller
            control={form.control}
            name="is_variable"
            render={({ field }) => (
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="expense-is-variable"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                />
                <Label htmlFor="expense-is-variable" className="text-sm">
                  {t('fields.is_variable')}
                </Label>
              </div>
            )}
          />

          <SelectField
            label={t('fields.expense_category')}
            value={form.watch('expense_category') || 'other'}
            onChange={(value) => form.setValue('expense_category', value)}
            options={[
              { value: ALL_EXPENSE_CATEGORIES.MATERIALS, label: t('expenseCategories.materials') },
              { value: ALL_EXPENSE_CATEGORIES.LAB_FEES, label: t('expenseCategories.lab_fees') },
              { value: ALL_EXPENSE_CATEGORIES.SUPPLIES_DENTAL, label: t('expenseCategories.supplies_dental') },
              { value: ALL_EXPENSE_CATEGORIES.RENT, label: t('expenseCategories.rent') },
              { value: ALL_EXPENSE_CATEGORIES.SALARIES, label: t('expenseCategories.salaries') },
              { value: ALL_EXPENSE_CATEGORIES.UTILITIES, label: t('expenseCategories.utilities') },
              { value: ALL_EXPENSE_CATEGORIES.INSURANCE, label: t('expenseCategories.insurance') },
              { value: ALL_EXPENSE_CATEGORIES.SOFTWARE, label: t('expenseCategories.software_subscriptions') },
              { value: ALL_EXPENSE_CATEGORIES.MARKETING, label: t('expenseCategories.marketing') },
              { value: ALL_EXPENSE_CATEGORIES.MAINTENANCE, label: t('expenseCategories.maintenance') },
              { value: ALL_EXPENSE_CATEGORIES.OTHER, label: t('expenseCategories.other') },
            ]}
            helperText={form.watch('is_variable') ? t('expenseCategories.materials') : t('expenseCategories.rent')}
          />
          <SelectField
            label={t('form.fields.relatedFixedCost')}
            value={selectedFixedCost}
            onChange={(value) => {
              form.setValue('related_fixed_cost_id', value === 'none' ? undefined : value)
            }}
            options={fixedCostOptions}
            helperText={t('form.fields.relatedFixedCostHelp')}
          />
        </FormGrid>
      </FormSection>

      <FormSection title={t('form.sections.inventory')}>
        <FormGrid columns={2}>
          <SelectField
            label={t('form.fields.relatedSupply')}
            value={selectedSupply}
            onChange={(value) => {
              form.setValue('related_supply_id', value === 'none' ? undefined : value)
            }}
            options={supplyOptions}
          />
          <Controller
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <InputField
                type="number"
                label={t('form.fields.quantity')}
                value={field.value ?? ''}
                onChange={(value) => field.onChange(value === '' ? undefined : Number(value))}
                min={1}
                step={1}
                disabled={selectedSupply === 'none'}
              />
            )}
          />
        </FormGrid>
      </FormSection>

      <FormSection title={t('form.sections.asset')}>
        <Controller
          control={form.control}
          name="create_asset"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox
                id="expense-create-asset"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
              />
              <Label htmlFor="expense-create-asset" className="text-sm">
                {t('form.fields.createAsset')}
              </Label>
            </div>
          )}
        />

        {createAsset && (
          <FormGrid columns={2}>
            <Controller
              control={form.control}
              name="asset_name"
              render={({ field }) => (
                <InputField
                  label={t('form.fields.assetName')}
                  value={field.value || ''}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={form.control}
              name="asset_useful_life_years"
              render={({ field }) => (
                <InputField
                  type="number"
                  label={t('form.fields.assetLife')}
                  value={field.value ?? ''}
                  onChange={(value) => field.onChange(value === '' ? undefined : Number(value))}
                  min={1}
                  step={1}
                />
              )}
            />
          </FormGrid>
        )}
      </FormSection>
    </div>
  )
}
