'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CrudPageLayout } from '@/components/ui/crud-page-layout'
import { FormModal } from '@/components/ui/form-modal'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useCrudOperations } from '@/hooks/use-crud-operations'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/format'
import { Receipt, Eye } from 'lucide-react'
import { type ExpenseWithRelations } from '@/lib/types/expenses'
import { toast } from 'sonner'
import { ExpenseForm } from './components/ExpenseForm'
import { ExpenseStats } from './components/ExpenseStats'
import { CategoryBreakdown } from './components/CategoryBreakdown'

// Form schema for expenses
const expenseFormSchema = z.object({
  expense_date: z.string().min(1, 'Date is required'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  vendor: z.string().optional(),
  amount_pesos: z.number().min(0.01, 'Amount must be greater than 0'),
  notes: z.string().optional(),
})

type ExpenseFormData = z.infer<typeof expenseFormSchema>

interface ExpenseStatsData {
  total_amount: number
  total_count: number
  by_category: Array<{
    category: string
    amount: number
    count: number
    percentage: number
  }>
  vs_fixed_costs: {
    planned: number
    actual: number
    variance: number
    variance_percentage: number
  }
  by_month: Array<{
    month: string
    amount: number
    count: number
  }>
}

export default function ExpensesPage() {
  const t = useTranslations('expenses')
  const [stats, setStats] = useState<ExpenseStatsData | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  
  // CRUD operations
  const crud = useCrudOperations<ExpenseWithRelations>({
    endpoint: '/api/expenses',
    entityName: t('entity'),
    includeClinicId: true,
  })
  
  // Form handling
  const {
    setValue,
    watch,
    reset,
    handleSubmit,
    formState: { errors }
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      expense_date: new Date().toISOString().split('T')[0],
      category: '',
      subcategory: '',
      description: '',
      vendor: '',
      amount_pesos: 0,
      notes: '',
    },
  })

  // Load expense statistics
  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const dateRange = {
        start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
      }
      
      const params = new URLSearchParams(dateRange)
      const response = await fetch(`/api/expenses/stats?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  // Form submission
  const onSubmit = async (data: ExpenseFormData) => {
    const payload = {
      expense_date: data.expense_date,
      category: data.category,
      subcategory: data.subcategory || undefined,
      description: data.description || undefined,
      vendor: data.vendor || undefined,
      amount_cents: data.amount_pesos * 100, // Convert to cents
      notes: data.notes || undefined,
    }
    
    const success = crud.editingItem
      ? await crud.handleUpdate(crud.editingItem.id, payload)
      : await crud.handleCreate(payload)
    
    if (success) {
      crud.closeDialog()
      reset()
      // Reload stats after creating/updating
      loadStats()
    }
  }

  // Handle edit
  const handleEdit = (expense: ExpenseWithRelations) => {
    crud.handleEdit(expense)
    reset({
      expense_date: expense.expense_date,
      category: expense.category,
      subcategory: expense.subcategory || '',
      description: expense.description || '',
      vendor: expense.vendor || '',
      amount_pesos: expense.amount_cents / 100,
      notes: expense.notes || '',
    })
  }

  // Handle dialog open
  const handleOpenDialog = () => {
    reset({
      expense_date: new Date().toISOString().split('T')[0],
      category: '',
      subcategory: '',
      description: '',
      vendor: '',
      amount_pesos: 0,
      notes: '',
    })
    crud.openDialog()
  }

  // Handle view expense details
  const handleView = (expense: ExpenseWithRelations) => {
    toast.info(`Viewing expense: ${expense.description || expense.category}`)
  }

  // Table columns
  const columns = [
    {
      key: 'expense_date',
      label: t('fields.date'),
      render: (expense: ExpenseWithRelations) => formatDate(expense.expense_date)
    },
    {
      key: 'category',
      label: t('fields.category'),
      render: (expense: ExpenseWithRelations) => (
        <div className="space-y-1">
          <Badge variant="outline">{expense.category}</Badge>
          {expense.subcategory && (
            <div className="text-xs text-muted-foreground">{expense.subcategory}</div>
          )}
        </div>
      )
    },
    {
      key: 'description',
      label: t('fields.description'),
      render: (expense: ExpenseWithRelations) => (
        <div className="space-y-1">
          <div className="font-medium">{expense.description || '-'}</div>
          {expense.vendor && (
            <div className="text-xs text-muted-foreground">{expense.vendor}</div>
          )}
        </div>
      )
    },
    {
      key: 'amount_cents',
      label: t('fields.amount'),
      render: (expense: ExpenseWithRelations) => (
        <div className="text-right font-mono">
          {formatMoney(expense.amount_cents)}
        </div>
      ),
      className: 'text-right'
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (expense: ExpenseWithRelations) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleView(expense)}
            className="p-1 hover:bg-gray-100 rounded"
            title={t('actions.view')}
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ]

  return (
    <>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
            <TabsTrigger value="list">{t('tabs.list')}</TabsTrigger>
            <TabsTrigger value="alerts">{t('tabs.alerts')}</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <ExpenseStats stats={stats} t={t} />
            <CategoryBreakdown categories={stats?.by_category || []} t={t} />
          </TabsContent>
          
          {/* List Tab */}
          <TabsContent value="list" className="space-y-4">
            <CrudPageLayout
              title=""
              items={crud.items}
              loading={crud.loading}
              columns={columns}
              onAdd={handleOpenDialog}
              onEdit={handleEdit}
              onDelete={crud.handleDeleteClick}
              addButtonLabel={t('create_expense')}
              searchable={true}
              searchValue={crud.searchTerm}
              onSearchChange={crud.setSearchTerm}
              searchPlaceholder={t('search_placeholder')}
              emptyIcon={<Receipt className="h-8 w-8" />}
              emptyTitle={t('no_expenses')}
              emptyDescription={t('no_expenses_description')}
              deleteConfirmOpen={crud.deleteConfirmOpen}
              onDeleteConfirmChange={(open) => { if (!open) crud.closeDialog() }}
              deletingItem={crud.deletingItem}
              onDeleteConfirm={crud.handleDeleteConfirm}
            />
          </TabsContent>
          
          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">{t('expense_alerts')}</h3>
              <p className="text-muted-foreground">
                {t('alerts_coming_soon')}
              </p>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add/Edit Modal */}
        <FormModal
          open={crud.isDialogOpen}
          onOpenChange={crud.closeDialog}
          title={crud.editingItem ? t('edit_expense') : t('create_expense')}
          onSubmit={handleSubmit(onSubmit)}
          isSubmitting={crud.isSubmitting}
          cancelLabel={t('cancel')}
          submitLabel={crud.editingItem ? t('save') : t('create')}
          maxWidth="2xl"
        >
          <ExpenseForm 
            watch={watch}
            setValue={setValue}
            errors={errors}
            t={t}
          />
        </FormModal>
      </div>
    </>
  )
}