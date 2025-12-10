'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Receipt, TrendingUp, AlertTriangle, CalendarRange, Info } from 'lucide-react'

import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/button'
import { SummaryCards } from '@/components/ui/summary-cards'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FormModal } from '@/components/ui/form-modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable } from '@/components/ui/DataTable'
import { useExpenses } from '@/hooks/use-expenses'
import { expenseFormSchema, type ExpenseFormData, type ExpenseWithRelations } from '@/lib/types/expenses'
import { formatCurrency } from '@/lib/money'
import { useFilteredSummary } from '@/hooks/use-filtered-summary'
import { expenseSummaryConfig } from '@/lib/calc/summary-configs'

import {
  ExpenseForm,
  ExpenseFiltersCard,
  ExpenseSmartFilters,
  ExpenseAlertsCard,
  ExpenseCharts,
  useExpenseColumns,
  useExpenseOptions,
  getDefaultFormValues,
  mapExpenseToFormValues,
} from './components'

export default function ExpensesPage() {
  const t = useTranslations('expenses')
  const tCommon = useTranslations('common')

  const {
    expenses,
    filters,
    stats,
    alerts,
    loading,
    isSubmitting,
    createExpense,
    updateExpense,
    deleteExpense,
    setFilters,
    resetFilters,
    refresh,
    clinicId,
  } = useExpenses()

  // Get all options from hook
  const {
    categoryOptions,
    subcategoryOptions,
    getSubcategoriesForCategory,
    supplyOptions,
    campaignOptions,
    fixedCostOptions,
  } = useExpenseOptions({ clinicId })

  const [createOpen, setCreateOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<ExpenseWithRelations | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ExpenseWithRelations | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [amountMinInput, setAmountMinInput] = useState<number | ''>('')
  const [amountMaxInput, setAmountMaxInput] = useState<number | ''>('')

  useEffect(() => {
    setAmountMinInput(typeof filters.min_amount === 'number' ? Number(filters.min_amount / 100) : '')
    setAmountMaxInput(typeof filters.max_amount === 'number' ? Number(filters.max_amount / 100) : '')
  }, [filters.min_amount, filters.max_amount])

  const createForm = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: getDefaultFormValues(),
    mode: 'onBlur',
  })

  const editForm = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: getDefaultFormValues(),
    mode: 'onBlur',
  })

  // Modal handlers
  const openCreateModal = useCallback(() => {
    createForm.reset(getDefaultFormValues())
    setCreateOpen(true)
  }, [createForm])

  const openEditModal = useCallback((expense: ExpenseWithRelations) => {
    setEditExpense(expense)
    editForm.reset(mapExpenseToFormValues(expense))
  }, [editForm])

  const closeEditModal = useCallback(() => {
    setEditExpense(null)
    editForm.reset(mapExpenseToFormValues(undefined))
  }, [editForm])

  // Use columns hook
  const { columns, mobileColumns, getCategoryLabel } = useExpenseColumns({
    onEdit: openEditModal,
    onDelete: setDeleteTarget,
  })

  // Filter handlers
  const handleMinAmountChange = useCallback((value: string | number | React.ChangeEvent<HTMLInputElement>) => {
    const v = typeof value === 'object' && 'target' in value ? value.target.value : value
    if (v === '' || v === null) {
      setAmountMinInput('')
      setFilters({ min_amount: undefined })
      return
    }
    const numeric = Number(v)
    setAmountMinInput(Number.isFinite(numeric) ? numeric : '')
    if (Number.isFinite(numeric)) {
      setFilters({ min_amount: Math.round(numeric * 100) })
    }
  }, [setFilters])

  const handleMaxAmountChange = useCallback((value: string | number | React.ChangeEvent<HTMLInputElement>) => {
    const v = typeof value === 'object' && 'target' in value ? value.target.value : value
    if (v === '' || v === null) {
      setAmountMaxInput('')
      setFilters({ max_amount: undefined })
      return
    }
    const numeric = Number(v)
    setAmountMaxInput(Number.isFinite(numeric) ? numeric : '')
    if (Number.isFinite(numeric)) {
      setFilters({ max_amount: Math.round(numeric * 100) })
    }
  }, [setFilters])

  const handleSelectFilter = useCallback((field: string, value: string) => {
    setFilters({ [field]: value === 'all' ? undefined : value })
  }, [setFilters])

  const handleBooleanFilter = useCallback((field: string, value: string) => {
    setFilters({ [field]: value === 'any' ? undefined : value === 'true' })
  }, [setFilters])

  const deleteExpenseConfirmed = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const success = await deleteExpense(deleteTarget.id)
    if (success) setDeleteTarget(null)
    setDeleteLoading(false)
  }

  const handleCreateSubmit = createForm.handleSubmit(async (values) => {
    const success = await createExpense(values)
    if (success) {
      setCreateOpen(false)
      createForm.reset(getDefaultFormValues())
    }
  })

  const handleEditSubmit = editForm.handleSubmit(async (values) => {
    if (!editExpense) return
    const success = await updateExpense(editExpense.id, values)
    if (success) closeEditModal()
  })

  // Calculate summary from FILTERED expenses
  const filteredSummary = useFilteredSummary(expenses, expenseSummaryConfig)
  const { totalSpent, totalExpenses: totalCount, recurringCount } = filteredSummary

  // Planned vs actual from backend
  const planned = stats?.vs_fixed_costs?.planned ?? 0
  const variance = totalSpent - planned
  const variancePct = planned > 0 ? Math.round((variance / planned) * 100) : 0

  type CardColor = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

  const summaryCards = useMemo(() => {
    const cards: Array<{
      label: string
      value: string
      subtitle: string
      icon: typeof Receipt
      color: CardColor
    }> = [
      {
        label: t('summary.totalSpentTitle'),
        value: formatCurrency(totalSpent),
        subtitle: t('summary.totalSpentSubtitle', { count: totalCount }),
        icon: Receipt,
        color: 'primary',
      },
    ]

    if (planned > 0) {
      cards.push({
        label: t('summary.varianceTitle'),
        value: formatCurrency(variance),
        subtitle: t('summary.varianceSubtitle', { percentage: Math.abs(variancePct) }),
        icon: TrendingUp,
        color: variance > 0 ? 'danger' : 'success',
      })
    } else {
      cards.push({
        label: t('summary.planNotConfiguredTitle'),
        value: t('summary.planNotConfiguredValue'),
        subtitle: t('summary.planNotConfiguredSubtitle'),
        icon: AlertTriangle,
        color: 'warning',
      })
    }

    cards.push({
      label: t('summary.recurringTitle'),
      value: recurringCount.toString(),
      subtitle: t('summary.recurringSubtitle'),
      icon: CalendarRange,
      color: 'info',
    })

    return cards
  }, [totalSpent, totalCount, planned, recurringCount, t, variance, variancePct])

  return (
    <AppLayout>
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          actions={
            <Button onClick={openCreateModal} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('actions.new')}
            </Button>
          }
        />

        <Alert className="bg-primary/10 border-primary/30 text-primary/95">
          <Info className="h-5 w-5" />
          <AlertTitle>{t('summary.expenseGuidanceTitle')}</AlertTitle>
          <AlertDescription>{t('summary.expenseGuidanceDescription')}</AlertDescription>
        </Alert>

        <SummaryCards cards={summaryCards} columns={4} />

        <ExpenseSmartFilters
          filters={filters}
          setFilters={setFilters}
          categoryOptions={categoryOptions}
          subcategoryOptions={subcategoryOptions}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-5 w-5" />
              {t('table.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable<ExpenseWithRelations>
              data={expenses}
              columns={columns}
              mobileColumns={mobileColumns}
              loading={loading}
              searchKey="description"
              searchPlaceholder={t('table.searchPlaceholder')}
              showCount={true}
              countLabel={t('expenses.title').toLowerCase()}
              emptyState={{
                icon: Receipt,
                title: t('table.emptyTitle'),
                description: t('table.emptyDescription'),
              }}
            />
          </CardContent>
        </Card>

        <ExpenseCharts
          categoryBreakdown={stats?.by_category ?? []}
          monthlyBreakdown={stats?.by_month ?? []}
          getCategoryLabel={getCategoryLabel}
          t={t}
        />

        <ExpenseAlertsCard alerts={alerts} t={t} />

        <FormModal
          open={createOpen}
          onOpenChange={(open) => { setCreateOpen(open); if (!open) createForm.reset(getDefaultFormValues()) }}
          title={t('form.createTitle')}
          submitLabel={t('form.submit.create')}
          onSubmit={handleCreateSubmit}
          isSubmitting={isSubmitting}
        >
          <ExpenseForm
            form={createForm}
            t={t}
            categoryOptions={categoryOptions.slice(1)}
            getSubcategoriesForCategory={getSubcategoriesForCategory}
            supplyOptions={supplyOptions}
            campaignOptions={campaignOptions}
            fixedCostOptions={fixedCostOptions}
          />
        </FormModal>

        <FormModal
          open={Boolean(editExpense)}
          onOpenChange={(open) => { if (!open) closeEditModal() }}
          title={t('form.editTitle')}
          submitLabel={t('form.submit.update')}
          onSubmit={handleEditSubmit}
          isSubmitting={isSubmitting}
        >
          <ExpenseForm
            form={editForm}
            t={t}
            categoryOptions={categoryOptions.slice(1)}
            getSubcategoriesForCategory={getSubcategoriesForCategory}
            supplyOptions={supplyOptions}
            campaignOptions={campaignOptions}
            fixedCostOptions={fixedCostOptions}
          />
        </FormModal>

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
          title={t('modals.delete.title')}
          description={deleteTarget ? t('modals.delete.description', { description: deleteTarget.description || deleteTarget.vendor || '' }) : undefined}
          onConfirm={deleteExpenseConfirmed}
          confirmText={tCommon('delete')}
          cancelText={tCommon('cancel')}
          variant="destructive"
          loading={deleteLoading}
        />
      </div>
    </AppLayout>
  )
}
