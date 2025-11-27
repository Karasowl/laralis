'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown'
import { Eye, Receipt } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { useExpenses } from '@/hooks/use-expenses'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { ExpenseWithRelations } from '@/lib/types/expenses'
import { ExpenseDetailsModal } from './ExpenseDetailsModal'
import { EditExpenseModal } from './EditExpenseModal'

interface ExpensesTableProps {
  limit?: number
  filters?: any
  onFiltersChange?: (filters: any) => void
}

export default function ExpensesTable({ 
  limit, 
  filters: externalFilters,
  onFiltersChange 
}: ExpensesTableProps) {
  const t = useTranslations('expenses')
  const tCommon = useTranslations('common')
  const tFields = useTranslations('fields')
  const { currentClinic } = useCurrentClinic()
  
  // State management
  const [viewingExpense, setViewingExpense] = useState<ExpenseWithRelations | null>(null)
  const [editingExpense, setEditingExpense] = useState<ExpenseWithRelations | null>(null)
  const [deletingExpense, setDeletingExpense] = useState<ExpenseWithRelations | null>(null)
  
  // Use expenses hook
  const {
    expenses,
    loading,
    error,
    filters,
    updateFilters,
    updateExpense,
    deleteExpense,
    searchTerm,
    setSearchTerm,
    categories
  } = useExpenses({
    clinicId: currentClinic?.id,
    filters: externalFilters,
    limit,
    autoLoad: true
  })

  // Handle actions
  const handleDelete = async () => {
    if (!deletingExpense) return
    const success = await deleteExpense(deletingExpense.id)
    if (success) {
      setDeletingExpense(null)
    }
  }

  const handleEdit = async (id: string, data: any) => {
    const success = await updateExpense(id, data)
    return success
  }

  // Table columns configuration
  const columns = [
    {
      key: 'expense_date',
      label: tFields('date'),
      render: (expense: ExpenseWithRelations) => (
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          {formatDate(expense.expense_date)}
        </div>
      )
    },
    {
      key: 'category',
      label: tFields('category'),
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
      label: tFields('description'),
      render: (expense: ExpenseWithRelations) => (
        <div className="max-w-xs">
          <p className="font-medium truncate">{expense.description || '-'}</p>
          {expense.vendor && (
            <p className="text-xs text-muted-foreground">{expense.vendor}</p>
          )}
        </div>
      )
    },
    {
      key: 'amount',
      label: tFields('amount'),
      render: (expense: ExpenseWithRelations) => (
        <div className="text-right font-mono">
          {formatMoney(expense.amount_cents)}
        </div>
      ),
      className: 'text-right'
    },
    {
      key: 'status',
      label: tFields('status'),
      render: (expense: ExpenseWithRelations) => {
        // Por ahora todos los gastos se consideran pagados
        const isPaid = true
        return (
          <Badge variant={isPaid ? 'success' : 'warning'}>
            {t(isPaid ? 'status.paid' : 'status.pending')}
          </Badge>
        )
      }
    },
    {
      key: 'actions',
      label: tCommon('actions'),
      sortable: false,
      render: (expense: ExpenseWithRelations) => (
        <ActionDropdown
          actions={[
            {
              label: t('view_details'),
              icon: <Eye className="h-4 w-4" />,
              onClick: () => setViewingExpense(expense)
            },
            createEditAction(() => setEditingExpense(expense), tCommon('edit')),
            createDeleteAction(() => setDeletingExpense(expense), tCommon('delete'))
          ]}
        />
      )
    }
  ]

  return (
    <>
      <DataTable
        columns={columns}
        mobileColumns={[columns[2], columns[5]]}
        data={expenses}
        loading={loading}
        searchPlaceholder={t('search_expenses')}
        onSearch={setSearchTerm}
        showCount={true}
        countLabel={t('title').toLowerCase()}
        emptyState={{
          icon: Receipt,
          title: t('no_expenses'),
          description: t('no_expenses_description')
        }}
      />

      {/* View Details Modal */}
      <ExpenseDetailsModal
        expense={viewingExpense}
        open={!!viewingExpense}
        onClose={() => setViewingExpense(null)}
      />

      {/* Edit Modal */}
      <EditExpenseModal
        expense={editingExpense}
        open={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        onSave={handleEdit}
        categories={categories}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingExpense}
        onOpenChange={(open) => !open && setDeletingExpense(null)}
        title={t('delete_expense')}
        description={t('delete_expense_confirm', {
          description: deletingExpense?.description || t('this_expense')
        })}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  )
}
