'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormModal } from '@/components/ui/form-modal'
import { FormSection, FormGrid, InputField, SelectField, TextareaField } from '@/components/ui/form-field'
import { Form } from '@/components/ui/form'
import { ExpenseWithRelations, ExpenseFormData, EXPENSE_CATEGORIES, EXPENSE_SUBCATEGORIES } from '@/lib/types/expenses'

// Schema for expense form
const expenseSchema = z.object({
  expense_date: z.string(),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  amount_cents: z.number().min(0),
  vendor: z.string().optional(),
  invoice_number: z.string().optional(),
  is_recurring: z.boolean().default(false)
})

interface EditExpenseModalProps {
  expense: ExpenseWithRelations | null
  open: boolean
  onClose: () => void
  onSave: (id: string, data: Partial<ExpenseFormData>) => Promise<boolean>
}

export function EditExpenseModal({ expense, open, onClose, onSave }: EditExpenseModalProps) {
  const t = useTranslations('expenses')
  const [saving, setSaving] = useState(false)
  
  const form = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: expense ? {
      expense_date: expense.expense_date,
      category: expense.category,
      subcategory: expense.subcategory || '',
      description: expense.description || '',
      amount_cents: expense.amount_cents,
      vendor: expense.vendor || '',
      invoice_number: expense.invoice_number || '',
      is_recurring: expense.is_recurring || false
    } : {}
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
      <Form {...form}>
        <div className="space-y-4">
          <FormSection title={t('basic_information')}>
            <FormGrid columns={2}>
              <InputField
                type="date"
                label={t('fields.date')}
                value={form.watch('expense_date')}
                onChange={(value) => form.setValue('expense_date', value as string)}
                error={form.formState.errors.expense_date?.message}
                required
              />
              
              <InputField
                type="number"
                step="0.01"
                label={t('fields.amount')}
                value={(form.watch('amount_cents') / 100).toFixed(2)}
                onChange={(value) => form.setValue('amount_cents', parseFloat(value as string) * 100)}
                error={form.formState.errors.amount_cents?.message}
                required
              />
            </FormGrid>
          </FormSection>

          <FormSection title={t('categorization')}>
            <FormGrid columns={2}>
              <SelectField
                label={t('fields.category')}
                value={form.watch('category')}
                onChange={(value) => form.setValue('category', value)}
                options={Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => ({
                  value: label,
                  label: label
                }))}
                error={form.formState.errors.category?.message}
                required
              />
              
              <SelectField
                label={t('fields.subcategory')}
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
              label={t('fields.description')}
              value={form.watch('description') || ''}
              onChange={(value) => form.setValue('description', value)}
              placeholder={t('description_placeholder')}
              error={form.formState.errors.description?.message}
            />
            
            <FormGrid columns={2}>
              <InputField
                label={t('fields.vendor')}
                value={form.watch('vendor') || ''}
                onChange={(value) => form.setValue('vendor', value as string)}
                placeholder={t('vendor_placeholder')}
                error={form.formState.errors.vendor?.message}
              />
              
              <InputField
                label={t('fields.invoice_number')}
                value={form.watch('invoice_number') || ''}
                onChange={(value) => form.setValue('invoice_number', value as string)}
                placeholder={t('invoice_placeholder')}
                error={form.formState.errors.invoice_number?.message}
              />
            </FormGrid>
          </FormSection>
        </div>
      </Form>
    </FormModal>
  )
}