'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormModal } from '@/components/ui/form-modal'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { 
  expenseFormSchema, 
  type ExpenseFormData
} from '@/lib/types/expenses'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { useExpenses } from '@/hooks/use-expenses'
import { useSupplies } from '@/hooks/use-supplies'
import { parseMoney } from '@/lib/money'
import { CreateExpenseForm } from './CreateExpenseForm'

export default function CreateExpenseDialog() {
  const t = useTranslations('expenses')
  const { currentClinic } = useCurrentClinic()
  const { createExpense, categories } = useExpenses({ clinicId: currentClinic?.id })
  const { supplies } = useSupplies({ clinicId: currentClinic?.id })
  
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showAssetFields, setShowAssetFields] = useState(false)
  
  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      expense_date: new Date().toISOString().split('T')[0],
      category: '',
      subcategory: '',
      description: '',
      amount_pesos: 0,
      vendor: '',
      invoice_number: '',
      is_recurring: false,
      quantity: undefined,
      related_supply_id: undefined,
      create_asset: false,
      asset_name: '',
      asset_useful_life_years: undefined
    }
  })


  const onSubmit = async (data: ExpenseFormData) => {
    if (!currentClinic?.id) {
      toast.error(t('no_business_selected'))
      return
    }

    setLoading(true)

    const success = await createExpense(data)
    
    setLoading(false)
    
    if (success) {
      form.reset()
      setOpen(false)
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={setOpen}
      title={t('create_expense')}
      onSubmit={form.handleSubmit(onSubmit)}
      cancelLabel={t('cancel')}
      submitLabel={t('create')}
      isSubmitting={loading}
      maxWidth="2xl"
      trigger={
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t('create_expense')}
        </Button>
      }
    >
      <CreateExpenseForm 
        form={form} 
        supplies={supplies} 
        categories={categories}
        showAssetFields={showAssetFields}
        setShowAssetFields={setShowAssetFields}
      />
    </FormModal>
  )
}
