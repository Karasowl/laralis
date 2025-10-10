'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Plus,
  Receipt,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  CalendarRange,
  Info,
} from 'lucide-react'

import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/button'
import { SummaryCards } from '@/components/ui/summary-cards'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FormModal } from '@/components/ui/form-modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { InputField, SelectField, FormGrid, FormSection } from '@/components/ui/form-field'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { ActionDropdown, createDeleteAction, createEditAction } from '@/components/ui/ActionDropdown'
import { useExpenses } from '@/hooks/use-expenses'
import { useApi } from '@/hooks/use-api'
import {
  expenseFormSchema,
  type ExpenseFormData,
  EXPENSE_CATEGORIES,
  EXPENSE_SUBCATEGORIES,
  type ExpenseWithRelations,
  type ExpenseFilters,
} from '@/lib/types/expenses'
import { formatCurrency } from '@/lib/money'
import { formatDate } from '@/lib/format'
import { getLocalDateISO } from '@/lib/utils'

type ExpenseFormValues = ExpenseFormData

interface Option {
  value: string
  label: string
}

type BudgetAlertSeverity = 'high' | 'medium' | 'low'

export default function ExpensesPage() {
  const t = useTranslations('expenses')
  const tCommon = useTranslations('common')
  const locale = useLocale()

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

  const suppliesEndpoint = clinicId ? `/api/supplies?clinicId=${clinicId}&limit=200` : null
  const suppliesApi = useApi<{ data: Array<{ id: string; name: string; category?: string }> }>(suppliesEndpoint, {
    autoFetch: Boolean(clinicId),
  })

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

  const createForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: getDefaultFormValues(),
  })

  const editForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: getDefaultFormValues(),
  })

  const categoryOptions: Option[] = useMemo(() => {
    const base: Option[] = [
      { value: 'all', label: t('filters.categoryAll') },
    ]

    const entries = Object.entries(EXPENSE_CATEGORIES).map(([key, value]) => ({
      value,
      label: t(`categories.${key.toLowerCase()}`),
    }))

    return [...base, ...entries]
  }, [t])

  const subcategoryOptions: Option[] = useMemo(() => {
    const base: Option[] = [
      { value: 'all', label: t('filters.subcategoryAll') },
    ]

    const entries = Object.entries(EXPENSE_SUBCATEGORIES).map(([key, value]) => ({
      value,
      label: t(`subcategories.${key.toLowerCase()}`),
    }))

    return [...base, ...entries]
  }, [t])

  const supplyOptions: Option[] = useMemo(() => {
    const data = suppliesApi.data?.data || []
    return [
      { value: 'none', label: t('form.fields.relatedSupplyNone') },
      ...data.map((item) => ({ value: item.id, label: item.name })),
    ]
  }, [suppliesApi.data, t])

  const handleMinAmountChange = (value: string | number) => {
    if (value === '' || value === null) {
      setAmountMinInput('')
      setFilters({ min_amount: undefined })
      return
    }
    const numeric = Number(value)
    setAmountMinInput(Number.isFinite(numeric) ? numeric : '')
    if (Number.isFinite(numeric)) {
      setFilters({ min_amount: Math.round(numeric * 100) })
    }
  }

  const handleMaxAmountChange = (value: string | number) => {
    if (value === '' || value === null) {
      setAmountMaxInput('')
      setFilters({ max_amount: undefined })
      return
    }
    const numeric = Number(value)
    setAmountMaxInput(Number.isFinite(numeric) ? numeric : '')
    if (Number.isFinite(numeric)) {
      setFilters({ max_amount: Math.round(numeric * 100) })
    }
  }

  const handleSelectFilter = (field: keyof ExpenseFilters, value: string) => {
    if (value === 'all') {
      setFilters({ [field]: undefined })
      return
    }
    setFilters({ [field]: value })
  }

  const handleBooleanFilter = (field: keyof ExpenseFilters, value: string) => {
    if (value === 'any') {
      setFilters({ [field]: undefined })
      return
    }
    setFilters({ [field]: value === 'true' })
  }

  const openCreateModal = () => {
    createForm.reset(getDefaultFormValues())
    setCreateOpen(true)
  }

  const openEditModal = (expense: ExpenseWithRelations) => {
    setEditExpense(expense)
    editForm.reset(mapExpenseToFormValues(expense))
  }

  const closeEditModal = () => {
    setEditExpense(null)
    editForm.reset(mapExpenseToFormValues(undefined))
  }

  const deleteExpenseConfirmed = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const success = await deleteExpense(deleteTarget.id)
    if (success) {
      setDeleteTarget(null)
    }
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
    if (success) {
      closeEditModal()
    }
  })

  const categoryLookup = useMemo(() => {
    const map = new Map<string, string>()
    Object.entries(EXPENSE_CATEGORIES).forEach(([key, value]) => {
      map.set(value.toLowerCase(), t(`categories.${key.toLowerCase()}`))
    })
    return map
  }, [t])

  const subcategoryLookup = useMemo(() => {
    const map = new Map<string, string>()
    Object.entries(EXPENSE_SUBCATEGORIES).forEach(([key, value]) => {
      map.set(value.toLowerCase(), t(`subcategories.${key.toLowerCase()}`))
    })
    return map
  }, [t])

  const getCategoryLabel = (value?: string | null) => {
    if (!value) return t('categories.unknown')
    return categoryLookup.get(value.toLowerCase()) || value
  }

  const getSubcategoryLabel = (value?: string | null) => {
    if (!value) return t('subcategories.unknown')
    return subcategoryLookup.get(value.toLowerCase()) || value
  }

  const columns: Column<ExpenseWithRelations>[] = useMemo(() => [
    {
      key: 'expense_date',
      label: t('table.date'),
      render: (value) => formatDate(value as string, locale === 'es' ? 'es' : 'en'),
      sortable: true,
    },
    {
      key: 'category',
      label: t('table.category'),
      render: (_, expense) => (
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            {getCategoryLabel(expense.category)}
          </Badge>
          {expense.subcategory && (
            <span className="text-xs text-muted-foreground">
              {getSubcategoryLabel(expense.subcategory)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      label: t('table.description'),
      render: (_, expense) => (
        <div className="max-w-sm">
          <p className="font-medium truncate">{expense.description || t('table.noDescription')}</p>
          {expense.vendor && (
            <p className="text-xs text-muted-foreground truncate">{expense.vendor}</p>
          )}
        </div>
      ),
    },
    {
      key: 'amount_cents',
      label: t('table.amount'),
      className: 'text-right',
      sortable: true,
      render: (value) => (
        <span className="font-semibold">{formatCurrency(Number(value) || 0)}</span>
      ),
    },
    {
      key: 'is_recurring',
      label: t('table.recurring'),
      className: 'text-center',
      render: (value) => (
        value ? (
          <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-200">
            {t('table.recurringYes')}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{t('table.recurringNo')}</span>
        )
      ),
    },
    {
      key: 'actions',
      label: tCommon('actions'),
      render: (_value, expense) => (
        <ActionDropdown
          actions={[
            createEditAction(() => openEditModal(expense), tCommon('edit')),
            createDeleteAction(() => setDeleteTarget(expense), tCommon('delete')),
          ]}
        />
      ),
    },
  ], [locale, t, tCommon, getCategoryLabel, getSubcategoryLabel])

  const mobileColumns: Column<ExpenseWithRelations>[] = useMemo(() => [
    columns[0],
    columns[3],
    columns[2],
  ], [columns])

  const totalSpent = stats?.total_amount ?? 0
  const planned = stats?.vs_fixed_costs?.planned ?? 0
  const actual = stats?.vs_fixed_costs?.actual ?? totalSpent
  const variance = stats?.vs_fixed_costs?.variance ?? (actual - planned)
  const variancePct = stats?.vs_fixed_costs?.variance_percentage ?? (planned > 0 ? Math.round((variance / planned) * 100) : 0)
  const recurringCount = useMemo(() => expenses.filter((expense) => expense.is_recurring).length, [expenses])
  const summaryCards = useMemo(() => {
    const cards = [
      {
        label: t('summary.totalSpentTitle'),
        value: formatCurrency(totalSpent),
        subtitle: t('summary.totalSpentSubtitle', { count: stats?.total_count ?? expenses.length }),
        icon: Receipt,
        color: 'primary' as const,
      }
    ]

    if (planned > 0) {
      cards.push({
        label: t('summary.varianceTitle'),
        value: formatCurrency(variance),
        subtitle: t('summary.varianceSubtitle', { percentage: Math.abs(variancePct) }),
        icon: TrendingUp,
        color: variance > 0 ? ('danger' as const) : ('success' as const),
      })
    } else {
      cards.push({
        label: t('summary.planNotConfiguredTitle'),
        value: t('summary.planNotConfiguredValue'),
        subtitle: t('summary.planNotConfiguredSubtitle'),
        icon: AlertTriangle,
        color: 'warning' as const,
      })
    }

    cards.push({
      label: t('summary.recurringTitle'),
      value: recurringCount,
      subtitle: t('summary.recurringSubtitle'),
      icon: CalendarRange,
      color: 'info' as const,
    })

    return cards
  }, [expenses.length, planned, recurringCount, stats?.total_count, t, totalSpent, variance, variancePct])

  const renderAlerts = () => {
    if (!alerts || alerts.summary.total_alerts === 0) {
      return (
        <p className="text-sm text-muted-foreground">{t('alerts.empty')}</p>
      )
    }

    return (
      <div className="space-y-4">
        {alerts.budget_alerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              {t('alerts.budgetTitle')}
            </h4>
            <div className="space-y-2">
              {alerts.budget_alerts.map((alert, index) => (
                <div key={index} className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-amber-900">{alert.message}</p>
                    <Badge variant="outline" className={severityBadgeClass(alert.severity)}>
                      {t(`alerts.severity.${alert.severity}`)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-amber-900/80">
                    <div>{t('alerts.budgetPlanned')}: {formatCurrency(alert.details.planned)}</div>
                    <div>{t('alerts.budgetActual')}: {formatCurrency(alert.details.actual)}</div>
                    <div>{t('alerts.budgetVariance')}: {formatCurrency(alert.details.variance)} ({alert.details.percentage}%)</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {alerts.low_stock.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-red-500" />
              {t('alerts.lowStockTitle')}
            </h4>
            <div className="space-y-2">
              {alerts.low_stock.map((item) => (
                <div key={item.id} className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-800">{item.name}</p>
                    <p className="text-xs text-red-700">
                      {t('alerts.lowStockIndicator', {
                        current: item.stock_quantity,
                        minimum: item.min_stock_alert,
                      })}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-red-300 text-red-700">
                    {item.category}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {alerts.price_changes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-500" />
              {t('alerts.priceChangesTitle')}
            </h4>
            <div className="space-y-2">
              {alerts.price_changes.map((item) => (
                <div key={item.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">{item.name}</p>
                    <p className="text-xs text-blue-800">
                      {item.price_change_percentage > 0
                        ? t('alerts.priceChangeUp', { value: item.price_change_percentage })
                        : t('alerts.priceChangeDown', { value: Math.abs(item.price_change_percentage) })}
                    </p>
                  </div>
                  <div className="text-xs text-blue-800">
                    <div>{formatCurrency(item.price_per_portion_cents)} → {formatCurrency(item.last_purchase_price_cents)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            {t('alerts.summaryTitle', {
              total: alerts.summary.total_alerts,
              high: alerts.summary.by_severity.high,
              medium: alerts.summary.by_severity.medium,
              low: alerts.summary.by_severity.low,
            })}
          </p>
        </div>
      </div>
    )
  }

  const categoryBreakdown = stats?.by_category ?? []
  const monthlyBreakdown = stats?.by_month ?? []

  return (
    <AppLayout>
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          actions={(
            <Button onClick={openCreateModal} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('actions.new')}
            </Button>
          )}
        />

        <Alert className="bg-blue-50 border-blue-200 text-blue-900">
          <Info className="h-5 w-5" />
          <AlertTitle>{t('summary.expenseGuidanceTitle')}</AlertTitle>
          <AlertDescription>
            {t('summary.expenseGuidanceDescription')}
          </AlertDescription>
        </Alert>

        <SummaryCards cards={summaryCards} columns={4} />

        <FiltersCard
          filters={filters}
          amountMinInput={amountMinInput}
          amountMaxInput={amountMaxInput}
          t={t}
          setFilters={setFilters}
          handleSelectFilter={handleSelectFilter}
          handleBooleanFilter={handleBooleanFilter}
          handleMinAmountChange={handleMinAmountChange}
          handleMaxAmountChange={handleMaxAmountChange}
          resetFilters={() => {
            resetFilters()
            setAmountMinInput('')
            setAmountMaxInput('')
          }}
          refresh={refresh}
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
              emptyState={{
                icon: Receipt,
                title: t('table.emptyTitle'),
                description: t('table.emptyDescription'),
              }}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('charts.byCategory.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('charts.byCategory.empty')}</p>
              ) : (
                categoryBreakdown.map((category) => (
                  <div key={category.category} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{getCategoryLabel(category.category)}</span>
                      <span className="font-semibold">{formatCurrency(category.amount)}</span>
                    </div>
                    <Progress value={category.percentage} />
                    <p className="text-xs text-muted-foreground">{category.count} {t('charts.byCategory.transactions')}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarRange className="h-5 w-5" />
                {t('charts.byMonth.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {monthlyBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('charts.byMonth.empty')}</p>
              ) : (
                monthlyBreakdown.map((month) => (
                  <div key={month.month} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{month.month}</p>
                      <p className="text-xs text-muted-foreground">{t('charts.byMonth.transactions', { count: month.count })}</p>
                    </div>
                    <span className="font-semibold">{formatCurrency(month.amount)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t('alerts.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>{renderAlerts()}</CardContent>
        </Card>

        <FormModal
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (!open) {
              createForm.reset(getDefaultFormValues())
            }
          }}
          title={t('form.createTitle')}
          submitLabel={t('form.submit.create')}
          onSubmit={handleCreateSubmit}
          isSubmitting={isSubmitting}
        >
          <ExpenseForm
            form={createForm}
            t={t}
            categoryOptions={categoryOptions.slice(1)}
            subcategoryOptions={subcategoryOptions.slice(1)}
            supplyOptions={supplyOptions}
          />
        </FormModal>

        <FormModal
          open={Boolean(editExpense)}
          onOpenChange={(open) => {
            if (!open) {
              closeEditModal()
            }
          }}
          title={t('form.editTitle')}
          submitLabel={t('form.submit.update')}
          onSubmit={handleEditSubmit}
          isSubmitting={isSubmitting}
        >
          <ExpenseForm
            form={editForm}
            t={t}
            categoryOptions={categoryOptions.slice(1)}
            subcategoryOptions={subcategoryOptions.slice(1)}
            supplyOptions={supplyOptions}
          />
        </FormModal>

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
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

function getDefaultFormValues(): ExpenseFormValues {
  const today = getLocalDateISO()
  return {
    expense_date: today,
    category: EXPENSE_CATEGORIES.OTROS,
    subcategory: '',
    description: '',
    notes: '',
    amount_pesos: 0,
    vendor: '',
    invoice_number: '',
    is_recurring: false,
    quantity: undefined,
    related_supply_id: undefined,
    create_asset: false,
    asset_name: '',
    asset_useful_life_years: undefined,
    category_id: undefined,
  }
}

function mapExpenseToFormValues(expense?: ExpenseWithRelations | null): ExpenseFormValues {
  if (!expense) {
    return getDefaultFormValues()
  }

  return {
    expense_date: expense.expense_date?.slice(0, 10) || getLocalDateISO(),
    category: expense.category || EXPENSE_CATEGORIES.OTROS,
    subcategory: expense.subcategory || '',
    description: expense.description || '',
    notes: expense.notes || '',
    amount_pesos: (expense.amount_cents || 0) / 100,
    vendor: expense.vendor || '',
    invoice_number: expense.invoice_number || '',
    is_recurring: Boolean(expense.is_recurring),
    quantity: expense.quantity ?? undefined,
    related_supply_id: expense.related_supply_id || undefined,
    create_asset: false,
    asset_name: '',
    asset_useful_life_years: undefined,
    category_id: expense.category_id || undefined,
  }
}

interface ExpenseFormProps {
  form: ReturnType<typeof useForm<ExpenseFormValues>>
  t: ReturnType<typeof useTranslations>
  categoryOptions: Option[]
  subcategoryOptions: Option[]
  supplyOptions: Option[]
}

function ExpenseForm({ form, t, categoryOptions, subcategoryOptions, supplyOptions }: ExpenseFormProps) {
  const selectedSupply = form.watch('related_supply_id') || 'none'
  const createAsset = form.watch('create_asset')

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
                onChange={(value) => field.onChange(String(value))}
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
                value={field.value}
                onChange={(value) => field.onChange(value === '' ? 0 : Number(value))}
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
                onChange={(value) => field.onChange(String(value))}
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
                onChange={(value) => field.onChange(String(value))}
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
                onChange={(value) => field.onChange(String(value))}
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
        </FormGrid>
        <Controller
          control={form.control}
          name="is_recurring"
          render={({ field }) => (
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="expense-is-recurring"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
              />
              <Label htmlFor="expense-is-recurring" className="text-sm">
                {t('form.fields.isRecurring')}
              </Label>
            </div>
          )}
        />
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
                  onChange={(value) => field.onChange(String(value))}
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

function FiltersCard({
  filters,
  amountMinInput,
  amountMaxInput,
  t,
  setFilters,
  handleSelectFilter,
  handleBooleanFilter,
  handleMinAmountChange,
  handleMaxAmountChange,
  resetFilters,
  refresh,
  categoryOptions,
  subcategoryOptions,
}: {
  filters: ExpenseFilters
  amountMinInput: number | ''
  amountMaxInput: number | ''
  t: ReturnType<typeof useTranslations>
  setFilters: (filters: Partial<ExpenseFilters>) => void
  handleSelectFilter: (field: keyof ExpenseFilters, value: string) => void
  handleBooleanFilter: (field: keyof ExpenseFilters, value: string) => void
  handleMinAmountChange: (value: string | number) => void
  handleMaxAmountChange: (value: string | number) => void
  resetFilters: () => void
  refresh: () => void
  categoryOptions: Option[]
  subcategoryOptions: Option[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="h-5 w-5" />
          {t('filters.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormGrid columns={3}>
          <SelectField
            label={t('filters.category')}
            value={filters.category ? filters.category : 'all'}
            onChange={(value) => handleSelectFilter('category', value)}
            options={categoryOptions}
          />
          <SelectField
            label={t('filters.subcategory')}
            value={filters.subcategory ? filters.subcategory : 'all'}
            onChange={(value) => handleSelectFilter('subcategory', value)}
            options={subcategoryOptions}
          />
          <InputField
            label={t('filters.vendor')}
            value={filters.vendor || ''}
            onChange={(value) => setFilters({ vendor: value ? String(value) : undefined })}
            placeholder={t('filters.vendorPlaceholder')}
          />
          <InputField
            type="date"
            label={t('filters.dateFrom')}
            value={filters.start_date || ''}
            onChange={(value) => setFilters({ start_date: value ? String(value) : undefined })}
          />
          <InputField
            type="date"
            label={t('filters.dateTo')}
            value={filters.end_date || ''}
            onChange={(value) => setFilters({ end_date: value ? String(value) : undefined })}
          />
          <InputField
            type="number"
            label={t('filters.amountMin')}
            value={amountMinInput === '' ? '' : Number(amountMinInput)}
            onChange={handleMinAmountChange}
            min={0}
            step={0.01}
          />
          <InputField
            type="number"
            label={t('filters.amountMax')}
            value={amountMaxInput === '' ? '' : Number(amountMaxInput)}
            onChange={handleMaxAmountChange}
            min={0}
            step={0.01}
          />
          <SelectField
            label={t('filters.recurring')}
            value={typeof filters.is_recurring === 'boolean' ? String(filters.is_recurring) : 'any'}
            onChange={(value) => handleBooleanFilter('is_recurring', value)}
            options={[
              { value: 'any', label: t('filters.any') },
              { value: 'true', label: t('filters.yes') },
              { value: 'false', label: t('filters.no') },
            ]}
          />
        </FormGrid>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={resetFilters}>
            {t('filters.reset')}
          </Button>
          <Button variant="outline" onClick={refresh}>
            {t('filters.refresh')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function severityBadgeClass(severity: BudgetAlertSeverity): string {
  if (severity === 'high') return 'border-red-300 text-red-700 bg-red-50'
  if (severity === 'medium') return 'border-amber-300 text-amber-700 bg-amber-50'
  return 'border-green-300 text-green-700 bg-green-50'
}
