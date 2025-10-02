'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormModal } from '@/components/ui/form-modal'
import { FormSection, FormGrid, InputField, SelectField, TextareaField } from '@/components/ui/form-field'
import { getLocalDateISO } from '@/lib/utils'
import { Form } from '@/components/ui/form'
import { ExpenseWithRelations, ExpenseFormData, EXPENSE_SUBCATEGORIES } from '@/lib/types/expenses'
import { useCategories } from '@/hooks/use-categories'
import { CategoryModal } from '@/app/services/components/CategoryModal'

// Schema for expense form
const expenseSchema = z.object({
  expense_date: z.string(),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  amount_pesos: z.number().min(0),
  vendor: z.string().optional(),
  invoice_number: z.string().optional(),
  is_recurring: z.boolean().default(false)
})

interface EditExpenseModalProps {
  expense: ExpenseWithRelations | null
  open: boolean
  onClose: () => void
  onSave: (id: string, data: Partial<ExpenseFormData>) => Promise<boolean>
  categories?: any[]
}

export function EditExpenseModal({ expense, open, onClose, onSave, categories = [] }: EditExpenseModalProps) {
  const t = useTranslations('expenses')
  const tFields = useTranslations('fields')
  const tServices = useTranslations('services')
  const [saving, setSaving] = useState(false)
  const { categories: expenseCats, createCategory, updateCategory, deleteCategory } = useCategories('expenses')
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  
  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expense ? {
      expense_date: expense.expense_date,
      category: expense.category,
      subcategory: expense.subcategory || '',
      description: expense.description || '',
      amount_pesos: (expense.amount_cents || 0) / 100,
      vendor: expense.vendor || '',
      invoice_number: expense.invoice_number || '',
      is_recurring: expense.is_recurring || false
    } : {
      expense_date: getLocalDateISO(),
      category: '',
      subcategory: '',
      description: '',
      amount_pesos: 0,
      vendor: '',
      invoice_number: '',
      is_recurring: false
    }
  })

  const handleSubmit = async (data: z.infer<typeof expenseSchema>) => {
    if (!expense) return
    
    setSaving(true)
    const success = await onSave(expense.id, data)
    setSaving(false)
    
    if (success) {
      onClose()
      form.reset()
    }
  }

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
    return subcategoryMap[category] || []
  }

  if (!expense) return null

  return (
    <FormModal
      open={open}
      onOpenChange={onClose}
      title={t('edit_expense')}
      onSubmit={form.handleSubmit(handleSubmit)}
      isSubmitting={saving}
      maxWidth="lg"
    >
      <div className="mb-2 flex items-center justify-end">
        <button type="button" className="text-xs text-primary hover:underline" onClick={() => setCategoryModalOpen(true)}>
          {tServices('manage_categories')}
        </button>
      </div>
      <Form {...form}>
        <div className="space-y-4">
          <FormSection title={t('basic_information')}>
            <FormGrid columns={2}>
              <InputField
                type="date"
                label={tFields('date')}
                value={form.watch('expense_date')}
                onChange={(value) => form.setValue('expense_date', value as string)}
                error={form.formState.errors.expense_date?.message}
                required
              />
              
              <InputField
                type="number"
                step="0.01"
                label={tFields('amount')}
                value={form.watch('amount_pesos') || 0}
                onChange={(value) => form.setValue('amount_pesos', typeof value === 'number' ? value : parseFloat(String(value)))}
                error={form.formState.errors.amount_pesos?.message}
                required
              />
            </FormGrid>
          </FormSection>

          <FormSection title={t('categorization')}>
            <FormGrid columns={2}>
              <SelectField
                label={tFields('category')}
                value={form.watch('category')}
                onChange={(value) => {
                  form.setValue('category', value)
                  // Attempt to map to category_id if list provided
                  const match = (expenseCats || []).find((c: any) => (c.display_name || c.name) === value)
                  if (match) {
                    // @ts-ignore: category_id exists in schema (optional)
                    form.setValue('category_id', match.id)
                  }
                }}
                options={(expenseCats && expenseCats.length > 0
                  ? expenseCats.map((c: any) => ({ value: c.display_name || c.name, label: c.display_name || c.name }))
                  : [
                    { value: 'Equipos', label: 'Equipos' },
                    { value: 'Insumos', label: 'Insumos' },
                    { value: 'Servicios', label: 'Servicios' },
                    { value: 'Mantenimiento', label: 'Mantenimiento' },
                    { value: 'Marketing', label: 'Marketing' },
                    { value: 'Administrativos', label: 'Administrativos' },
                    { value: 'Personal', label: 'Personal' },
                    { value: 'Otros', label: 'Otros' }
                  ])}
                error={form.formState.errors.category?.message}
                required
              />
              
              <SelectField
                label={tFields('subcategory')}
                value={form.watch('subcategory') || ''}
                onChange={(value) => form.setValue('subcategory', value)}
                options={getSubcategoryOptions(form.watch('category')).map((subcat) => ({
                  value: EXPENSE_SUBCATEGORIES[subcat as keyof typeof EXPENSE_SUBCATEGORIES],
                  label: EXPENSE_SUBCATEGORIES[subcat as keyof typeof EXPENSE_SUBCATEGORIES]
                }))}
                error={form.formState.errors.subcategory?.message}
              />
            </FormGrid>
          </FormSection>

          <FormSection title={t('details')}>
            <TextareaField
              label={tFields('description')}
              value={form.watch('description') || ''}
              onChange={(value) => form.setValue('description', value)}
              placeholder={t('description_placeholder')}
              error={form.formState.errors.description?.message}
            />
            
            <FormGrid columns={2}>
              <InputField
                label={tFields('vendor')}
                value={form.watch('vendor') || ''}
                onChange={(value) => form.setValue('vendor', value as string)}
                placeholder={t('vendor_placeholder')}
                error={form.formState.errors.vendor?.message}
              />
              
              <InputField
                label={tFields('invoice_number')}
                value={form.watch('invoice_number') || ''}
                onChange={(value) => form.setValue('invoice_number', value as string)}
                placeholder={t('invoice_placeholder')}
                error={form.formState.errors.invoice_number?.message}
              />
            </FormGrid>
          </FormSection>
        </div>
      </Form>

      <CategoryModal
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        categories={expenseCats as any[]}
        onCreateCategory={createCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={deleteCategory}
      />
    </FormModal>
  )
}