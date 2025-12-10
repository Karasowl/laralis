'use client'

import { useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useApi } from '@/hooks/use-api'
import { useCategories } from '@/hooks/use-categories'
import { useCampaigns } from '@/hooks/use-campaigns'
import { useFixedCosts } from '@/hooks/use-fixed-costs'
import { type ExpenseFormData, type RecurrenceInterval, EXPENSE_CATEGORIES, type ExpenseWithRelations } from '@/lib/types/expenses'
import { getLocalDateISO } from '@/lib/utils'

interface Option {
  value: string
  label: string
}

export function getDefaultFormValues(): ExpenseFormData {
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
    is_variable: false,
    expense_category: 'other',
    campaign_id: undefined,
    quantity: undefined,
    related_supply_id: undefined,
    create_asset: false,
    asset_name: '',
    asset_useful_life_years: undefined,
    category_id: undefined,
    recurrence_interval: undefined,
    recurrence_day: undefined,
    related_fixed_cost_id: undefined,
  }
}

export function mapExpenseToFormValues(expense?: ExpenseWithRelations | null): ExpenseFormData {
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
    is_variable: Boolean(expense.is_variable),
    expense_category: expense.expense_category || '',
    campaign_id: expense.campaign_id || undefined,
    quantity: expense.quantity ?? undefined,
    related_supply_id: expense.related_supply_id || undefined,
    create_asset: false,
    asset_name: '',
    asset_useful_life_years: undefined,
    category_id: expense.category_id || undefined,
    recurrence_interval: expense.recurrence_interval as RecurrenceInterval | undefined,
    recurrence_day: expense.recurrence_day ?? undefined,
    related_fixed_cost_id: expense.related_fixed_cost_id || undefined,
  }
}

interface UseExpenseOptionsProps {
  clinicId: string | null | undefined
}

export function useExpenseOptions({ clinicId }: UseExpenseOptionsProps) {
  const t = useTranslations('expenses')

  const { categories: expenseCategories } = useCategories('expenses')
  const { campaigns } = useCampaigns({ activeOnly: true })
  const { fixedCosts } = useFixedCosts({ clinicId: clinicId || undefined })

  const suppliesEndpoint = clinicId ? `/api/supplies?clinicId=${clinicId}&limit=200` : null
  const suppliesApi = useApi<{ data: Array<{ id: string; name: string; category?: string }> }>(
    suppliesEndpoint,
    { autoFetch: Boolean(clinicId) }
  )

  // Calculate parent categories (for dropdowns)
  const parentCategories = useMemo(
    () => (expenseCategories || []).filter((c: Record<string, unknown>) => !c.parent_id),
    [expenseCategories]
  )

  // Category options for filters and forms
  const categoryOptions: Option[] = useMemo(() => {
    const base: Option[] = [{ value: 'all', label: t('filters.categoryAll') }]
    const entries = parentCategories.map((c: Record<string, unknown>) => ({
      value: (c.display_name as string) || (c.name as string),
      label: (c.display_name as string) || (c.name as string),
    }))
    return [...base, ...entries]
  }, [parentCategories, t])

  // Subcategory options for filters (all subcategories)
  const subcategoryOptions: Option[] = useMemo(() => {
    const base: Option[] = [{ value: 'all', label: t('filters.subcategoryAll') }]
    const subcats = (expenseCategories || []).filter((c: Record<string, unknown>) => c.parent_id)
    const entries = subcats.map((c: Record<string, unknown>) => ({
      value: (c.display_name as string) || (c.name as string),
      label: (c.display_name as string) || (c.name as string),
    }))
    return [...base, ...entries]
  }, [expenseCategories, t])

  // Dynamic subcategory options based on selected category in forms
  const getSubcategoriesForCategory = useCallback(
    (categoryName: string): Option[] => {
      if (!categoryName) return []
      const selectedParent = parentCategories.find(
        (c: Record<string, unknown>) =>
          (c.display_name as string) === categoryName || (c.name as string) === categoryName
      )
      if (!selectedParent) return []
      const subcats = (expenseCategories || []).filter(
        (c: Record<string, unknown>) => c.parent_id === selectedParent.id
      )
      return subcats.map((c: Record<string, unknown>) => ({
        value: (c.display_name as string) || (c.name as string),
        label: (c.display_name as string) || (c.name as string),
      }))
    },
    [parentCategories, expenseCategories]
  )

  const supplyOptions: Option[] = useMemo(() => {
    const data = suppliesApi.data?.data || []
    return [
      { value: 'none', label: t('form.fields.relatedSupplyNone') },
      ...data.map((item) => ({ value: item.id, label: item.name })),
    ]
  }, [suppliesApi.data, t])

  const campaignOptions: Option[] = useMemo(() => {
    return [
      { value: 'none', label: t('form.fields.noCampaign') },
      ...campaigns.map((campaign) => ({
        value: campaign.id,
        label: campaign.platform?.display_name
          ? `${campaign.name} (${campaign.platform.display_name})`
          : campaign.name,
      })),
    ]
  }, [campaigns, t])

  // Fixed cost options for budget linking
  const fixedCostOptions: Option[] = useMemo(() => {
    return [
      { value: 'none', label: t('form.fields.relatedFixedCostNone') },
      ...(fixedCosts || []).map((cost) => ({
        value: cost.id,
        label: `${cost.concept} (${cost.category})`,
      })),
    ]
  }, [fixedCosts, t])

  return {
    categoryOptions,
    subcategoryOptions,
    getSubcategoriesForCategory,
    supplyOptions,
    campaignOptions,
    fixedCostOptions,
  }
}
