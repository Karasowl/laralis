'use client'

import { useTranslations } from 'next-intl'
import { FormModal } from '@/components/ui/form-modal'
import { FormSection, FormGrid } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/utils'
import { ExpenseWithRelations } from '@/lib/types/expenses'

interface ExpenseDetailsModalProps {
  expense: ExpenseWithRelations | null
  open: boolean
  onClose: () => void
}

export function ExpenseDetailsModal({ expense, open, onClose }: ExpenseDetailsModalProps) {
  const t = useTranslations('expenses')
  const tFields = useTranslations('fields')
  
  if (!expense) return null

  return (
    <FormModal
      open={open}
      onOpenChange={onClose}
      title={t('expense_details')}
      maxWidth="md"
      showFooter={false}
    >
      <div className="space-y-4">
        <FormSection title={t('basic_information')}>
          <FormGrid columns={2}>
            <div>
              <p className="text-sm text-muted-foreground">{tFields('date')}</p>
              <p className="font-medium">{formatDate(expense.expense_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{tFields('amount')}</p>
              <p className="font-medium text-lg">{formatMoney(expense.amount_cents)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{tFields('category')}</p>
              <Badge variant="outline">{expense.category}</Badge>
            </div>
            {expense.subcategory && (
              <div>
                <p className="text-sm text-muted-foreground">{tFields('subcategory')}</p>
                <p className="font-medium">{expense.subcategory}</p>
              </div>
            )}
          </FormGrid>
        </FormSection>

        {(expense.vendor || expense.invoice_number) && (
          <FormSection title={t('vendor_information')}>
            <FormGrid columns={2}>
              {expense.vendor && (
                <div>
                  <p className="text-sm text-muted-foreground">{tFields('vendor')}</p>
                  <p className="font-medium">{expense.vendor}</p>
                </div>
              )}
              {expense.invoice_number && (
                <div>
                  <p className="text-sm text-muted-foreground">{tFields('invoice_number')}</p>
                  <p className="font-medium">{expense.invoice_number}</p>
                </div>
              )}
            </FormGrid>
          </FormSection>
        )}

        {expense.description && (
          <FormSection title={tFields('description')}>
            <p className="text-sm">{expense.description}</p>
          </FormSection>
        )}

        {expense.asset && (
          <FormSection title={t('related_asset')}>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{expense.asset.name}</p>
              <p className="text-sm text-muted-foreground">
                {t('category')}: {expense.asset.category}
              </p>
            </div>
          </FormSection>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      </div>
    </FormModal>
  )
}
