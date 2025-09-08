'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { FormModal } from '@/components/ui/form-modal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown'
import { InputField, SelectField, FormGrid, FormSection } from '@/components/ui/form-field'
import { SummaryCards } from '@/components/ui/summary-cards'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { useFixedCosts } from '@/hooks/use-fixed-costs'
import { formatCurrency } from '@/lib/money'
import { getCategoryDisplayName } from '@/lib/format'
import { zFixedCostForm } from '@/lib/zod'
import { FixedCostCategory } from '@/lib/types'
import { Receipt, TrendingUp, Calculator, DollarSign, Plus } from 'lucide-react'
import { z } from 'zod'

type FixedCostFormData = z.infer<typeof zFixedCostForm>

const categories: { value: FixedCostCategory; label: string }[] = [
  { value: 'rent', label: 'fixedCosts.categories.rent' },
  { value: 'utilities', label: 'fixedCosts.categories.utilities' },
  { value: 'salaries', label: 'fixedCosts.categories.salaries' },
  { value: 'insurance', label: 'fixedCosts.categories.insurance' },
  { value: 'maintenance', label: 'fixedCosts.categories.maintenance' },
  { value: 'education', label: 'fixedCosts.categories.education' },
  { value: 'advertising', label: 'fixedCosts.categories.advertising' },
  { value: 'other', label: 'fixedCosts.categories.other' },
]

export default function FixedCostsPage() {
  const t = useTranslations()
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const { currentClinic } = useCurrentClinic()
  const {
    fixedCosts,
    loading,
    summary,
    createFixedCost,
    updateFixedCost,
    deleteFixedCost
  } = useFixedCosts({ clinicId: currentClinic?.id })

  // Modal states
  const [createOpen, setCreateOpen] = useState(false)
  const [editCost, setEditCost] = useState<any>(null)
  const [deleteCost, setDeleteCost] = useState<any>(null)

  // Form
  const fixedCostInitialValues: FixedCostFormData = {
    category: 'other',
    concept: '',
    amount_pesos: 0,
  }

  const form = useForm<FixedCostFormData>({
    resolver: zodResolver(zFixedCostForm),
    defaultValues: fixedCostInitialValues,
  })

  // Submit handlers
  const handleCreate = async (data: FixedCostFormData) => {
    const success = await createFixedCost({
      category: data.category,
      concept: data.concept,
      amount_cents: data.amount_pesos * 100
    })
    if (success) {
      setCreateOpen(false)
      form.reset()
    }
  }

  const handleEdit = async (data: FixedCostFormData) => {
    if (!editCost) return
    const success = await updateFixedCost(editCost.id, {
      category: data.category,
      concept: data.concept,
      amount_cents: data.amount_pesos * 100
    })
    if (success) {
      setEditCost(null)
      form.reset()
    }
  }

  const handleDelete = async () => {
    if (!deleteCost) return
    const success = await deleteFixedCost(deleteCost.id)
    if (success) {
      setDeleteCost(null)
    }
  }

  // Table columns
  const columns = [
    {
      key: 'category',
      label: t('fixedCosts.category'),
      render: (cost: any) => (
        <Badge variant="outline">
          {getCategoryDisplayName(cost.category, t)}
        </Badge>
      )
    },
    {
      key: 'concept',
      label: t('fixedCosts.concept'),
      render: (cost: any) => (
        <div className="font-medium">{cost.concept}</div>
      )
    },
    {
      key: 'amount',
      label: t('fixedCosts.amount'),
      render: (cost: any) => (
        <div className="text-right font-semibold">
          {formatCurrency(cost.amount_cents)}
        </div>
      )
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (cost: any) => (
        <ActionDropdown
          actions={[
            createEditAction(() => {
              form.reset({
                category: cost.category as FixedCostCategory,
                concept: cost.concept,
                amount_pesos: cost.amount_cents / 100,
              })
              setEditCost(cost)
            }, tCommon('edit')),
            createDeleteAction(() => setDeleteCost(cost), tCommon('delete'))
          ]}
        />
      )
    }
  ]

  // Category breakdown
  const getCategoryBreakdown = () => {
    const breakdown = categories.map(category => {
      const categoryTotal = fixedCosts
        .filter(cost => cost.category === category.value)
        .reduce((sum, cost) => sum + cost.amount_cents, 0)
      
      const percentage = summary.totalCosts > 0 ? (categoryTotal / summary.totalCosts) * 100 : 0
      
      return {
        category: category.value,
        label: t(category.label),
        total: categoryTotal,
        percentage
      }
    }).filter(item => item.total > 0)

    // Add depreciation
    if (summary.monthlyDepreciation > 0) {
      breakdown.push({
        category: 'depreciation',
        label: t('fixedCosts.categories.depreciation'),
        total: summary.monthlyDepreciation,
        percentage: (summary.monthlyDepreciation / summary.totalCosts) * 100
      })
    }

    return breakdown
  }

  const categoryColors: Record<string, string> = {
    rent: 'bg-green-500',
    salaries: 'bg-purple-500',
    utilities: 'bg-yellow-500',
    insurance: 'bg-red-500',
    maintenance: 'bg-orange-500',
    education: 'bg-indigo-500',
    advertising: 'bg-pink-500',
    other: 'bg-gray-500',
    depreciation: 'bg-blue-500'
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <PageHeader
          title={t('fixedCosts.title')}
          subtitle={t('fixedCosts.subtitle')}
          actions={
            <Button onClick={() => { form.reset(fixedCostInitialValues); setCreateOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              {t('fixedCosts.addCost')}
            </Button>
          }
        />

        <SummaryCards
          cards={[
            {
              label: t('fixedCosts.summary.totalMonthly'),
              value: formatCurrency(summary.totalCosts),
              subtitle: t('fixedCosts.summary.breakdown'),
              icon: Receipt,
              color: 'primary'
            },
            {
              label: t('fixedCosts.summary.local'),
              value: formatCurrency(summary.totalManualCosts),
              subtitle: `${summary.manualCount} ${t('fixedCosts.summary.concepts')}`,
              icon: DollarSign,
              color: 'success'
            },
            {
              label: t('fixedCosts.summary.depreciation'),
              value: formatCurrency(summary.monthlyDepreciation),
              subtitle: t('fixedCosts.summary.autoAddedNote'),
              icon: TrendingUp,
              color: 'info'
            },
          ]}
          columns={3}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DataTable
              columns={columns}
              mobileColumns={[columns[1], columns[3]]}
              data={fixedCosts}
              loading={loading}
              emptyState={{
                icon: Calculator,
                title: t('fixedCosts.noFixedCosts'),
                description: t('fixedCosts.noFixedCostsDescription')
              }}
            />
          </div>

          <div>
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">{t('fixedCosts.categoryBreakdown')}</h3>
                <div className="space-y-4">
                  {getCategoryBreakdown().map(item => (
                    <div key={item.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full ${categoryColors[item.category]}`} />
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        <span className="text-sm font-semibold">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${categoryColors[item.category]}`}
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        {item.percentage.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Create Modal */}
        <FormModal
          open={createOpen}
          onOpenChange={(open) => { setCreateOpen(open); if (!open) form.reset(fixedCostInitialValues) }}
          title={t('fixedCosts.create')}
          onSubmit={form.handleSubmit(handleCreate)}
        >
          <FixedCostForm form={form} categories={categories} t={t} />
        </FormModal>

        {/* Edit Modal */}
        <FormModal
          open={!!editCost}
          onOpenChange={(open) => !open && setEditCost(null)}
          title={t('fixedCosts.edit')}
          onSubmit={form.handleSubmit(handleEdit)}
        >
          <FixedCostForm form={form} categories={categories} t={t} />
        </FormModal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deleteCost}
          onOpenChange={(open) => !open && setDeleteCost(null)}
          title={t('fixedCosts.delete')}
          description={t('fixedCosts.deleteConfirm', {
            concept: deleteCost?.concept || ''
          })}
          onConfirm={handleDelete}
          variant="destructive"
        />
      </div>
    </AppLayout>
  )
}

// Fixed Cost Form Component
function FixedCostForm({ form, categories, t }: any) {
  return (
    <FormSection>
      <FormGrid columns={1}>
        <SelectField
          label={t('fixedCosts.category')}
          value={form.watch('category')}
          onChange={(value) => form.setValue('category', value)}
          options={categories.map((cat: any) => ({
            value: cat.value,
            label: t(cat.label)
          }))}
          error={form.formState.errors.category?.message}
          required
        />
        
        <InputField
          label={t('fixedCosts.concept')}
          value={form.watch('concept')}
          onChange={(value) => form.setValue('concept', value)}
          placeholder={t('fixedCosts.conceptPlaceholder')}
          error={form.formState.errors.concept?.message}
          required
        />
        
        <InputField
          type="number"
          step="0.01"
          label={t('fixedCosts.amount')}
          value={form.watch('amount_pesos')}
          onChange={(value) => form.setValue('amount_pesos', parseFloat(value as string) || 0)}
          placeholder="0.00"
          error={form.formState.errors.amount_pesos?.message}
          required
        />
      </FormGrid>
    </FormSection>
  )
}
