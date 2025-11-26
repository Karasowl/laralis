'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'
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
import { CategorySelect } from '@/components/ui/category-select'
import { SummaryCards } from '@/components/ui/summary-cards'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { useWorkspace } from '@/contexts/workspace-context'
import { useFixedCosts } from '@/hooks/use-fixed-costs'
import type { FixedCost } from '@/hooks/use-fixed-costs'
import { formatCurrency } from '@/lib/money'
import { getCategoryDisplayName } from '@/lib/format'
import { zFixedCostForm } from '@/lib/zod'
import { FixedCostCategory, FixedCostFrequency } from '@/lib/types'
import { Receipt, TrendingUp, Calculator, DollarSign, Plus } from 'lucide-react'
import { z } from 'zod'
import { toast } from 'sonner'

type FixedCostFormData = z.infer<typeof zFixedCostForm>

// Categories now come from database (system + custom)
// Legacy hardcoded array removed - use CategorySelect instead

const frequencyOptions: { value: FixedCostFrequency; label: string; descriptionKey: string }[] = [
  { value: 'monthly', label: 'fixedCosts.frequency.monthly', descriptionKey: 'fixedCosts.frequency.monthlyHint' },
  { value: 'weekly', label: 'fixedCosts.frequency.weekly', descriptionKey: 'fixedCosts.frequency.weeklyHint' },
  { value: 'biweekly', label: 'fixedCosts.frequency.biweekly', descriptionKey: 'fixedCosts.frequency.biweeklyHint' },
  { value: 'quarterly', label: 'fixedCosts.frequency.quarterly', descriptionKey: 'fixedCosts.frequency.quarterlyHint' },
  { value: 'yearly', label: 'fixedCosts.frequency.yearly', descriptionKey: 'fixedCosts.frequency.yearlyHint' },
]

const frequencyFactor: Record<FixedCostFrequency, number> = {
  monthly: 1,
  weekly: 52 / 12,
  biweekly: 26 / 12,
  quarterly: 1 / 3,
  yearly: 1 / 12
}

const toMonthlyCents = (amountCents: number, frequency: FixedCostFrequency) =>
  Math.max(0, Math.round(amountCents * frequencyFactor[frequency]))

export default function FixedCostsPage() {
  const t = useTranslations()
  const tCommon = useTranslations('common')
  const tSetup = useTranslations('setupWizard')
  const { currentClinic } = useCurrentClinic()
  const { workspace } = useWorkspace()
  const router = useRouter()
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
  const [editCost, setEditCost] = useState<FixedCost | null>(null)
  const [deleteCost, setDeleteCost] = useState<FixedCost | null>(null)

  // Form
  const fixedCostInitialValues: FixedCostFormData = {
    category: '',
    concept: '',
    amount_pesos: 0,
    frequency: 'monthly',
  }

  const form = useForm<FixedCostFormData>({
    resolver: zodResolver(zFixedCostForm),
    defaultValues: fixedCostInitialValues,
    mode: 'onBlur', // PERFORMANCE: Validate only on blur
  })

  // Submit handlers
  const handleCreate = async (data: FixedCostFormData) => {
    const success = await createFixedCost({
      category: data.category,
      concept: data.concept,
      // data.amount_pesos is already transformed to cents by zodResolver
      amount_cents: toMonthlyCents(data.amount_pesos as number, data.frequency)
    })
    if (success) {
      setCreateOpen(false)
      form.reset(fixedCostInitialValues)
      const fromSetup = (typeof window !== 'undefined' && sessionStorage.getItem('return_to_setup') === '1')
      const inOnboarding = (workspace?.onboarding_completed === false) || (workspace?.onboarding_completed === undefined && fromSetup)
      if (inOnboarding) {
        try {
          if (typeof window !== 'undefined') {
            window.localStorage?.setItem('setup_fixed_costs_done', 'true')
          }
        } catch {}
        toast.success(tSetup('toasts.finishSuccess'))
        try { if (typeof window !== 'undefined') sessionStorage.removeItem('return_to_setup') } catch {}
        router.push('/setup')
      }
    }
  }

  const handleEdit = async (data: FixedCostFormData) => {
    if (!editCost) return
    const success = await updateFixedCost(editCost.id, {
      category: data.category,
      concept: data.concept,
      // data.amount_pesos is already transformed to cents by zodResolver
      amount_cents: toMonthlyCents(data.amount_pesos as number, data.frequency)
    })
    if (success) {
      setEditCost(null)
      form.reset(fixedCostInitialValues)
      const fromSetup = (typeof window !== 'undefined' && sessionStorage.getItem('return_to_setup') === '1')
      const inOnboarding = (workspace?.onboarding_completed === false) || (workspace?.onboarding_completed === undefined && fromSetup)
      if (inOnboarding) {
        try {
          if (typeof window !== 'undefined') {
            window.localStorage?.setItem('setup_fixed_costs_done', 'true')
          }
        } catch {}
        try { if (typeof window !== 'undefined') sessionStorage.removeItem('return_to_setup') } catch {}
      }
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
      render: (_value: unknown, cost: FixedCost) => (
        <Badge variant="outline">
          {getCategoryDisplayName(cost.category, t)}
        </Badge>
      )
    },
    {
      key: 'concept',
      label: t('fixedCosts.concept'),
      render: (_value: unknown, cost: FixedCost) => (
        <div className="font-medium">{cost.concept}</div>
      )
    },
    {
      key: 'amount_cents',
      label: t('fixedCosts.amount'),
      render: (_value: unknown, cost: FixedCost) => (
        <div className="text-right font-semibold">
          {formatCurrency(cost?.amount_cents || 0)}
        </div>
      )
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (_value: unknown, cost: FixedCost) => (
        <ActionDropdown
          actions={[
            createEditAction(() => {
              form.reset({
                category: cost.category as FixedCostCategory,
                concept: cost.concept,
                amount_pesos: cost.amount_cents / 100,
                frequency: 'monthly'
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
    // Get unique categories from actual fixed costs (manual only)
    const uniqueCategories = Array.from(new Set(fixedCosts.map(cost => cost.category)))

    const breakdown: Array<{
      category: string
      label: string
      total: number
      percentage: number
      type: 'manual' | 'depreciation'
    }> = uniqueCategories.map((categoryValue) => {
      const categoryTotal = fixedCosts
        .filter(cost => cost.category === categoryValue)
        .reduce((sum, cost) => sum + cost.amount_cents, 0)

      const percentage = summary.totalCosts > 0 ? (categoryTotal / summary.totalCosts) * 100 : 0

      return {
        category: categoryValue,
        label: getCategoryDisplayName(categoryValue, t),
        total: categoryTotal,
        percentage,
        type: 'manual'
      }
    }).filter(item => item.total > 0)

    // Add depreciation as separate entry
    if (summary.monthlyDepreciation > 0) {
      breakdown.push({
        category: 'depreciation',
        label: t('fixedCosts.categories.depreciation'),
        total: summary.monthlyDepreciation,
        percentage: (summary.monthlyDepreciation / summary.totalCosts) * 100,
        type: 'depreciation'
      })
    }

    // Sort: manual categories first (alphabetically), then depreciation
    return breakdown.sort((a, b) => {
      if (a.type === b.type) {
        return a.label.localeCompare(b.label)
      }
      return a.type === 'manual' ? -1 : 1
    })
  }

  const categoryColors: Record<string, string> = {
    rent: 'bg-green-500',
    salaries: 'bg-purple-500',
    utilities: 'bg-yellow-500',
    insurance: 'bg-destructive/100',
    maintenance: 'bg-orange-500',
    education: 'bg-indigo-500',
    advertising: 'bg-pink-500',
    other: 'bg-gray-500',
    depreciation: 'bg-primary/100'
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
              subtitle: t('fixedCosts.summary.includingDepreciation'),
              icon: Receipt,
              color: 'primary'
            },
            {
              label: t('fixedCosts.summary.manualCosts'),
              value: formatCurrency(summary.totalManualCosts),
              subtitle: `${summary.manualCount} ${t('fixedCosts.summary.concepts')}`,
              icon: Calculator,
              color: 'success'
            },
            {
              label: t('fixedCosts.summary.depreciation'),
              value: formatCurrency(summary.monthlyDepreciation),
              subtitle: `${summary.assetsCount} ${summary.assetsCount === 1 ? t('assets.entity') : t('assets.entity')}`,
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
              // Mobile: concept, amount and actions
              mobileColumns={[columns[1], columns[2], columns[3]]}
              data={fixedCosts}
              loading={loading}
              showCount={true}
              countLabel={t('fixedCosts.title').toLowerCase()}
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

                {/* Manual Fixed Costs Section */}
                {(() => {
                  const manualBreakdown = getCategoryBreakdown().filter(item => item.type === 'manual')
                  return manualBreakdown.length > 0 && (
                    <>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                        {t('fixedCosts.breakdownSections.manual')}
                      </h4>
                      <div className="space-y-4">
                        {manualBreakdown.map(item => (
                          <div key={item.category} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full ${categoryColors[item.category] || 'bg-gray-500'}`} />
                                <span className="text-sm font-medium">{item.label}</span>
                              </div>
                              <span className="text-sm font-semibold">
                                {formatCurrency(item.total)}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${categoryColors[item.category] || 'bg-gray-500'}`}
                                style={{ width: `${Math.min(item.percentage, 100)}%` }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground text-right">
                              {item.percentage.toFixed(1)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}

                {/* Separator */}
                {summary.monthlyDepreciation > 0 && fixedCosts.length > 0 && (
                  <div className="my-6 border-t border-border" />
                )}

                {/* Depreciation Section */}
                {(() => {
                  const depreciationBreakdown = getCategoryBreakdown().filter(item => item.type === 'depreciation')
                  return depreciationBreakdown.length > 0 && (
                    <>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                        {t('fixedCosts.breakdownSections.automatic')}
                      </h4>
                      <div className="space-y-4">
                        {depreciationBreakdown.map(item => (
                          <div key={item.category} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-primary/100" />
                                <span className="text-sm font-medium">{item.label}</span>
                              </div>
                              <span className="text-sm font-semibold">
                                {formatCurrency(item.total)}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-primary/100"
                                style={{ width: `${Math.min(item.percentage, 100)}%` }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground text-right">
                              {item.percentage.toFixed(1)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}
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
            <FixedCostForm form={form} frequencyOptions={frequencyOptions} t={t} />
        </FormModal>

        {/* Edit Modal */}
        <FormModal
          open={!!editCost}
          onOpenChange={(open) => !open && setEditCost(null)}
          title={t('fixedCosts.edit')}
          onSubmit={form.handleSubmit(handleEdit)}
        >
          <FixedCostForm form={form} frequencyOptions={frequencyOptions} t={t} />
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
interface FixedCostFormProps {
  form: UseFormReturn<FixedCostFormData>
  frequencyOptions: { value: FixedCostFrequency; label: string; descriptionKey: string }[]
  t: (key: string) => string
}

function FixedCostForm({ form, frequencyOptions, t }: FixedCostFormProps) {
  const amountValue = form.watch('amount_pesos') ?? 0
  const frequencyValue = form.watch('frequency') ?? 'monthly'

  const handleAmountChange = (raw: string | number) => {
    if (raw === '') {
      form.setValue('amount_pesos', 0, { shouldDirty: true, shouldValidate: true })
      return
    }
    const n = typeof raw === 'number' ? raw : Number(raw)
    form.setValue('amount_pesos', Number.isFinite(n) ? n : 0, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <FormSection>
      <FormGrid columns={1}>
        <div>
          <label className="text-sm font-medium mb-2 block">
            {t('fixedCosts.category')} <span className="text-destructive">*</span>
          </label>
          <CategorySelect
            type="fixed_costs"
            value={form.watch('category')}
            onValueChange={(value) => form.setValue('category', value)}
            placeholder={t('categories.selectCategory')}
          />
          {form.formState.errors.category?.message && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.category.message}</p>
          )}
        </div>

        <InputField
          label={t('fixedCosts.concept')}
          value={form.watch('concept')}
          onChange={(e) => {
            const val = typeof e === 'object' && 'target' in e ? e.target.value : e
            form.setValue('concept', val)
          }}
          placeholder={t('fixedCosts.conceptPlaceholder')}
          error={form.formState.errors.concept?.message}
          required
        />

        <SelectField
          label={t('fixedCosts.frequency.label')}
          value={frequencyValue}
          onChange={(value) => form.setValue('frequency', value as FixedCostFrequency, { shouldDirty: true })}
          options={frequencyOptions.map((freq) => ({
            value: freq.value,
            label: t(freq.label)
          }))}
          helperText={t('fixedCosts.frequency.helper')}
          error={form.formState.errors.frequency?.message}
          required
        />

        <InputField
          type="number"
          step="0.01"
          label={t('fixedCosts.amount')}
          value={amountValue}
          onChange={handleAmountChange}
          placeholder="0.00"
          error={form.formState.errors.amount_pesos?.message}
          required
        />
      </FormGrid>
    </FormSection>
  )
}

