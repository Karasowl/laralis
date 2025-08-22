'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { DataTable } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown'
import { ConfirmDialog, createDeleteConfirm } from '@/components/ui/ConfirmDialog'
import { Search, Receipt, Loader2, Eye } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { 
  type ExpenseWithRelations, 
  type ExpenseFilters,
  EXPENSE_CATEGORIES 
} from '@/lib/types/expenses'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { toast } from 'sonner'

interface ExpensesTableProps {
  limit?: number
}

export default function ExpensesTable({ limit }: ExpensesTableProps) {
  const t = useTranslations('expenses')
  const { currentClinic } = useCurrentClinic()
  const searchParams = useSearchParams()
  
  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ExpenseFilters>({
    category: searchParams.get('category') || undefined,
    vendor: searchParams.get('vendor') || undefined,
    start_date: searchParams.get('start_date') || undefined,
    end_date: searchParams.get('end_date') || undefined
  })
  const [searchTerm, setSearchTerm] = useState('')
  
  // Edit Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseWithRelations | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Delete Confirmation State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingExpense, setDeletingExpense] = useState<ExpenseWithRelations | null>(null)
  
  // View Dialog State
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [viewingExpense, setViewingExpense] = useState<ExpenseWithRelations | null>(null)

  // Form state for editing
  const [editForm, setEditForm] = useState({
    expense_date: '',
    category: '',
    subcategory: '',
    description: '',
    vendor: '',
    amount_cents: 0,
    notes: ''
  })

  const fetchExpenses = async () => {
    if (!currentClinic?.id) return

    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        clinic_id: currentClinic.id
      })

      // Add filters to params
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString())
      })

      if (limit) {
        params.append('limit', limit.toString())
      }

      const response = await fetch(`/api/expenses?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch expenses')
      }

      setExpenses(data.data)
    } catch (error) {
      console.error('Error fetching expenses:', error)
      toast.error(t('fetch_error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [currentClinic?.id, filters])

  const handleView = (expense: ExpenseWithRelations) => {
    setViewingExpense(expense)
    setIsViewDialogOpen(true)
  }

  const handleEdit = (expense: ExpenseWithRelations) => {
    setEditingExpense(expense)
    setEditForm({
      expense_date: expense.expense_date,
      category: expense.category,
      subcategory: expense.subcategory || '',
      description: expense.description || '',
      vendor: expense.vendor || '',
      amount_cents: expense.amount_cents,
      notes: expense.notes || ''
    })
    setIsEditDialogOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingExpense) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update expense')
      }

      toast.success(t('update_success'))
      setIsEditDialogOpen(false)
      setEditingExpense(null)
      fetchExpenses()
    } catch (error) {
      console.error('Error updating expense:', error)
      toast.error(t('update_error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = (expense: ExpenseWithRelations) => {
    setDeletingExpense(expense)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingExpense) return

    try {
      const response = await fetch(`/api/expenses/${deletingExpense.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete expense')
      }

      toast.success(t('delete_success'))
      fetchExpenses()
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error(t('delete_error'))
    } finally {
      setDeleteConfirmOpen(false)
      setDeletingExpense(null)
    }
  }

  const filteredExpenses = expenses.filter(expense => {
    if (!searchTerm) return true
    
    const searchLower = searchTerm.toLowerCase()
    return (
      expense.description?.toLowerCase().includes(searchLower) ||
      expense.vendor?.toLowerCase().includes(searchLower) ||
      expense.category.toLowerCase().includes(searchLower) ||
      expense.subcategory?.toLowerCase().includes(searchLower)
    )
  })

  const columns = [
    {
      key: 'expense_date',
      header: t('fields.date'),
      render: (expense: ExpenseWithRelations) => formatDate(expense.expense_date)
    },
    {
      key: 'category',
      header: t('fields.category'),
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
      header: t('fields.description'),
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
      key: 'amount',
      header: t('fields.amount'),
      render: (expense: ExpenseWithRelations) => (
        <div className="text-right font-mono">
          {formatMoney(expense.amount_cents)}
        </div>
      )
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (expense: ExpenseWithRelations) => (
        <ActionDropdown
          actions={[
            {
              label: t('actions.view'),
              icon: <Eye className="h-4 w-4" />,
              onClick: () => handleView(expense)
            },
            createEditAction(() => handleEdit(expense), t('actions.edit')),
            createDeleteAction(() => handleDeleteClick(expense), t('actions.delete'))
          ]}
        />
      )
    }
  ]

  return (
    <>
      <Card className="p-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select
            value={filters.category || 'all'}
            onValueChange={(value) => setFilters({ ...filters, category: value === 'all' ? undefined : value })}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('filter_by_category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_categories')}</SelectItem>
              {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                <SelectItem key={key} value={label}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            placeholder={t('start_date')}
            value={filters.start_date || ''}
            onChange={(e) => setFilters({ ...filters, start_date: e.target.value || undefined })}
            className="w-40"
          />

          <Input
            type="date"
            placeholder={t('end_date')}
            value={filters.end_date || ''}
            onChange={(e) => setFilters({ ...filters, end_date: e.target.value || undefined })}
            className="w-40"
          />
        </div>

        {/* Table */}
        {filteredExpenses.length === 0 && !loading ? (
          <EmptyState
            icon={<Receipt className="h-8 w-8" />}
            title={searchTerm ? t('no_search_results') : t('no_expenses')}
            description={searchTerm ? t('try_different_search') : t('no_expenses_description')}
          />
        ) : (
          <DataTable
            data={filteredExpenses}
            columns={columns}
            loading={loading}
            emptyMessage={t('no_expenses')}
          />
        )}
        
        {limit && filteredExpenses.length >= limit && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm">
              {t('view_all')}
            </Button>
          </div>
        )}
      </Card>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('view_expense')}</DialogTitle>
          </DialogHeader>
          {viewingExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('fields.date')}</p>
                  <p className="text-sm">{formatDate(viewingExpense.expense_date)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('fields.amount')}</p>
                  <p className="text-lg font-semibold">{formatMoney(viewingExpense.amount_cents)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('fields.category')}</p>
                  <p className="text-sm">{viewingExpense.category}</p>
                  {viewingExpense.subcategory && (
                    <p className="text-xs text-muted-foreground">{viewingExpense.subcategory}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('fields.vendor')}</p>
                  <p className="text-sm">{viewingExpense.vendor || '-'}</p>
                </div>
              </div>
              {viewingExpense.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('fields.description')}</p>
                  <p className="text-sm">{viewingExpense.description}</p>
                </div>
              )}
              {viewingExpense.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('fields.notes')}</p>
                  <p className="text-sm">{viewingExpense.notes}</p>
                </div>
              )}
              {(viewingExpense.supply || viewingExpense.asset) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('fields.integration')}</p>
                  <div className="flex gap-2 mt-1">
                    {viewingExpense.supply && (
                      <Badge variant="outline">{t('supply')}: {viewingExpense.supply.name}</Badge>
                    )}
                    {viewingExpense.asset && (
                      <Badge variant="outline">{t('asset')}: {viewingExpense.asset.name}</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('edit_expense')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="expense_date">{t('fields.date')}</Label>
                <Input
                  id="expense_date"
                  type="date"
                  value={editForm.expense_date}
                  onChange={(e) => setEditForm({ ...editForm, expense_date: e.target.value })}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div>
                <Label htmlFor="amount">{t('fields.amount')}</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={editForm.amount_cents / 100}
                  onChange={(e) => setEditForm({ ...editForm, amount_cents: Math.round(parseFloat(e.target.value) * 100) })}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">{t('fields.category')}</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(value) => setEditForm({ ...editForm, category: value })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                      <SelectItem key={key} value={label}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="subcategory">{t('fields.subcategory')}</Label>
                <Input
                  id="subcategory"
                  value={editForm.subcategory}
                  onChange={(e) => setEditForm({ ...editForm, subcategory: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="vendor">{t('fields.vendor')}</Label>
              <Input
                id="vendor"
                value={editForm.vendor}
                onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <Label htmlFor="description">{t('fields.description')}</Label>
              <Input
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <Label htmlFor="notes">{t('fields.notes')}</Label>
              <Input
                id="notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSubmitting}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  t('save')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        {...createDeleteConfirm(
          handleDeleteConfirm, 
          deletingExpense?.description || t('this_expense')
        )}
      />
    </>
  )
}