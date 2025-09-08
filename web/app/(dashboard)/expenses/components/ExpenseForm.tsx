'use client'

import { FormGrid, InputField, SelectField, TextareaField } from '@/components/ui/form-field'
import { EXPENSE_CATEGORIES, EXPENSE_SUBCATEGORIES } from '@/lib/types/expenses'

interface ExpenseFormProps {
  watch: any
  setValue: any
  errors: any
  t: (key: string) => string // namespaced: 'expenses'
  tFields: (key: string) => string // namespaced: 'fields'
}

export function ExpenseForm({ watch, setValue, errors, t, tFields }: ExpenseFormProps) {
  const watchCategory = watch('category')
  
  // Form options
  const categoryOptions = Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => ({
    value: label,
    label
  }))

  const getSubcategoryOptions = (category: string) => {
    const subcategoryMap: Record<string, string[]> = {
      'Equipos': ['DENTAL', 'MOBILIARIO', 'TECNOLOGIA', 'HERRAMIENTAS'],
      'Insumos': ['ANESTESIA', 'MATERIALES', 'LIMPIEZA', 'PROTECCION'],
      'Servicios': ['ELECTRICIDAD', 'AGUA', 'INTERNET', 'TELEFONO', 'GAS'],
      'Mantenimiento': ['EQUIPOS_MANT', 'INSTALACIONES', 'SOFTWARE'],
      'Marketing': ['PUBLICIDAD', 'PROMOCIONES', 'EVENTOS'],
      'Administrativos': ['PAPELERIA', 'CONTABILIDAD', 'LEGAL'],
      'Personal': ['NOMINA', 'BENEFICIOS', 'CAPACITACION']
    }

    const subcats = subcategoryMap[category] || []
    return subcats.map(subcat => ({
      value: EXPENSE_SUBCATEGORIES[subcat as keyof typeof EXPENSE_SUBCATEGORIES] || subcat,
      label: EXPENSE_SUBCATEGORIES[subcat as keyof typeof EXPENSE_SUBCATEGORIES] || subcat
    }))
  }

  return (
    <div className="space-y-4">
      <FormGrid columns={2}>
        <InputField
          label={tFields('date')}
          type="date"
          value={watch('expense_date')}
          onChange={(v) => setValue('expense_date', v as string)}
          error={errors.expense_date?.message}
          required
        />
        
        <InputField
          label={tFields('amount')}
          type="number"
          value={watch('amount_pesos')}
          onChange={(v) => setValue('amount_pesos', v as number)}
          placeholder="0.00"
          step="0.01"
          error={errors.amount_pesos?.message}
          required
        />
      </FormGrid>
      
      <FormGrid columns={2}>
        <SelectField
          label={tFields('category')}
          value={watch('category')}
          onChange={(value) => {
            setValue('category', value)
            setValue('subcategory', '') // Reset subcategory when category changes
          }}
          options={categoryOptions}
          placeholder={t('select_category')}
          error={errors.category?.message}
          required
        />
        
        <SelectField
          label={tFields('subcategory')}
          value={watch('subcategory')}
          onChange={(value) => setValue('subcategory', value)}
          options={getSubcategoryOptions(watchCategory)}
          placeholder={t('select_subcategory')}
          error={errors.subcategory?.message}
          disabled={!watchCategory}
        />
      </FormGrid>
      
      <InputField
        label={tFields('vendor')}
        value={watch('vendor')}
        onChange={(v) => setValue('vendor', v as string)}
        placeholder={t('vendor_placeholder')}
        error={errors.vendor?.message}
      />
      
      <InputField
        label={tFields('description')}
        value={watch('description')}
        onChange={(v) => setValue('description', v as string)}
        placeholder={t('description_placeholder')}
        error={errors.description?.message}
      />
      
      <TextareaField
        label={tFields('notes')}
        value={watch('notes')}
        onChange={(v) => setValue('notes', v)}
        placeholder={t('notes_placeholder')}
        error={errors.notes?.message}
        rows={3}
      />
    </div>
  )
}
