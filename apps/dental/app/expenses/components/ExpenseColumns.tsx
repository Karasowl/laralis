'use client'

import { useMemo, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { ActionDropdown, createDeleteAction, createEditAction } from '@/components/ui/ActionDropdown'
import { type Column } from '@/components/ui/DataTable'
import { type ExpenseWithRelations, EXPENSE_CATEGORIES, EXPENSE_SUBCATEGORIES } from '@/lib/types/expenses'
import { formatCurrency } from '@/lib/money'
import { formatDate } from '@/lib/format'

interface UseExpenseColumnsProps {
  onEdit: (expense: ExpenseWithRelations) => void
  onDelete: (expense: ExpenseWithRelations) => void
  canEdit?: boolean
  canDelete?: boolean
}

export function useExpenseColumns({
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true
}: UseExpenseColumnsProps) {
  const t = useTranslations('expenses')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  // Label lookups
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

  const getCategoryLabel = useCallback(
    (value?: string | null) => {
      if (!value) return t('categories.unknown')
      return categoryLookup.get(value.toLowerCase()) || value
    },
    [categoryLookup, t]
  )

  const getSubcategoryLabel = useCallback(
    (value?: string | null) => {
      if (!value) return t('subcategories.unknown')
      return subcategoryLookup.get(value.toLowerCase()) || value
    },
    [subcategoryLookup, t]
  )

  const columns: Column<ExpenseWithRelations>[] = useMemo(
    () => [
      {
        key: 'expense_date',
        label: t('table.date'),
        render: (value) => (
          <span className="whitespace-nowrap">
            {formatDate(value as string, locale === 'es' ? 'es' : 'en')}
          </span>
        ),
        sortable: true,
        minWidth: '100px',
      },
      {
        key: 'category',
        label: t('table.category'),
        render: (_, expense) => (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="w-fit whitespace-nowrap">
              {getCategoryLabel(expense.category)}
            </Badge>
            {expense.subcategory && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {getSubcategoryLabel(expense.subcategory)}
              </span>
            )}
          </div>
        ),
        minWidth: '120px',
      },
      {
        key: 'description',
        label: t('table.description'),
        render: (_, expense) => (
          <div className="min-w-0">
            <p className="font-medium truncate">{expense.description || t('table.noDescription')}</p>
            {expense.vendor && <p className="text-xs text-muted-foreground truncate">{expense.vendor}</p>}
          </div>
        ),
      },
      {
        key: 'amount_cents',
        label: t('table.amount'),
        className: 'text-right',
        sortable: true,
        render: (value) => (
          <span className="font-semibold whitespace-nowrap">{formatCurrency(Number(value) || 0)}</span>
        ),
        minWidth: '100px',
      },
      {
        key: 'is_recurring',
        label: t('table.recurring'),
        className: 'text-center',
        hideOnTablet: true,
        render: (value) =>
          value ? (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30">
              {t('table.recurringYes')}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">{t('table.recurringNo')}</span>
          ),
      },
      {
        key: 'actions',
        label: tCommon('actions'),
        sortable: false,
        render: (_value, expense) => {
          const actions = []
          if (canEdit) actions.push(createEditAction(() => onEdit(expense), tCommon('edit')))
          if (canDelete) actions.push(createDeleteAction(() => onDelete(expense), tCommon('delete')))
          if (actions.length === 0) return null
          return <ActionDropdown actions={actions} />
        },
      },
    ],
    [locale, t, tCommon, getCategoryLabel, getSubcategoryLabel, onEdit, onDelete, canEdit, canDelete]
  )

  const mobileColumns: Column<ExpenseWithRelations>[] = useMemo(
    () => [
      {
        key: 'description',
        label: t('table.expense'),
        render: (_, expense) => (
          <div className="space-y-0.5">
            <p className="font-medium text-foreground">{expense.description || t('table.noDescription')}</p>
            <p className="text-xs text-muted-foreground">
              {getCategoryLabel(expense.category)}
              {expense.subcategory && ` - ${getSubcategoryLabel(expense.subcategory)}`}
            </p>
          </div>
        ),
      },
      {
        key: 'expense_date',
        label: t('table.date'),
        render: (value) => formatDate(value as string, locale === 'es' ? 'es' : 'en'),
      },
      {
        key: 'amount_cents',
        label: t('table.amount'),
        render: (value) => (
          <span className="font-semibold text-foreground">{formatCurrency(Number(value) || 0)}</span>
        ),
      },
      {
        key: 'actions',
        label: tCommon('actions'),
        sortable: false,
        render: (_value, expense) => {
          const actions = []
          if (canEdit) actions.push(createEditAction(() => onEdit(expense), tCommon('edit')))
          if (canDelete) actions.push(createDeleteAction(() => onDelete(expense), tCommon('delete')))
          if (actions.length === 0) return null
          return <ActionDropdown actions={actions} />
        },
      },
    ],
    [locale, t, tCommon, getCategoryLabel, getSubcategoryLabel, onEdit, onDelete, canEdit, canDelete]
  )

  return { columns, mobileColumns, getCategoryLabel }
}
