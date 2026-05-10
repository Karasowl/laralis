'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/badge'
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SmartFilters, useSmartFilter, FilterConfig, FilterValues } from '@/components/ui/smart-filters'
import { formatCurrency } from '@/lib/money'
import { Briefcase, Package, Clock, Info, Percent, Tag, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ServicesTableProps {
  services: any[]
  loading: boolean
  categories?: Array<{ id?: string; code?: string; name?: string; display_name?: string }>
  fixedCostPerMinuteCents?: number
  onManageSupplies: (service: any) => void
  onEdit: (service: any) => void
  onDelete: (service: any) => void
  onApplyDiscount: (service: any) => void
}

// Helper to get category label
function getCategoryLabel(
  service: any,
  categoryLookup: Map<string, string>,
  fallback: string
): string {
  const raw = service?.category
  const mapped = raw ? categoryLookup.get(raw) : undefined
  if (mapped) return mapped
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const looksLikeId = /^[0-9a-f-]{10,}$/.test(raw)
    if (!looksLikeId) return raw
  }
  return fallback
}

// Helper to calculate margin status
function getMarginStatus(costBase: number, finalPrice: number) {
  const profit = finalPrice - costBase
  const realMarginPct = costBase > 0 ? ((profit / costBase) * 100) : 0
  const hasLoss = realMarginPct < 0
  const hasLowMargin = realMarginPct >= 0 && realMarginPct < 10
  return { profit, realMarginPct, hasLoss, hasLowMargin }
}

export function ServicesTable({
  services,
  loading,
  categories = [],
  fixedCostPerMinuteCents = 0,
  onManageSupplies,
  onEdit,
  onDelete,
  onApplyDiscount
}: ServicesTableProps) {
  const t = useTranslations('services')
  const tRoot = useTranslations()
  const tCommon = useTranslations('common')
  const tFields = useTranslations('fields')
  const [searchValue, setSearchValue] = useState('')
  const [filterValues, setFilterValues] = useState<FilterValues>({})

  const categoryLookup = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach(cat => {
      const key = (cat.id || cat.code || cat.name || '').trim()
      if (!key) return
      const label = cat.display_name || cat.name || cat.code || key
      map.set(key, label)
    })
    return map
  }, [categories])

  // Get unique categories for filter options
  const categoryOptions = useMemo(() => {
    const categorySet = new Set<string>()
    ;(services || []).forEach((s: any) => {
      if (s.category) categorySet.add(s.category)
    })
    return Array.from(categorySet).map(cat => {
      const label = categoryLookup.get(cat) || cat
      return { value: cat, label }
    })
  }, [services, categoryLookup])

  // Filter configuration
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      key: 'category',
      label: t('filters.category'),
      type: 'multi-select',
      options: categoryOptions
    },
    {
      key: 'price_cents',
      label: t('filters.priceRange'),
      type: 'number-range',
      multiplier: 100 // User inputs pesos, data is in cents
    },
    {
      key: 'est_minutes',
      label: t('filters.durationRange'),
      type: 'number-range'
    },
    {
      key: 'has_discount',
      label: t('filters.hasDiscount'),
      type: 'select',
      options: [
        { value: 'yes', label: tCommon('yes') },
        { value: 'no', label: tCommon('no') }
      ]
    }
  ], [categoryOptions, t, tCommon])

  // Standard filters (category, price, duration)
  const standardFilterConfigs = useMemo(() =>
    filterConfigs.filter(f => f.key !== 'has_discount'),
    [filterConfigs]
  )

  // Apply standard filters using useSmartFilter
  const standardFiltered = useSmartFilter(services || [], filterValues, standardFilterConfigs)

  // Apply custom has_discount filter
  const smartFiltered = useMemo(() => {
    const discountFilter = filterValues.has_discount
    if (!discountFilter || discountFilter === '') return standardFiltered

    return standardFiltered.filter((service: any) => {
      const hasDiscount = service.discount_type && service.discount_type !== 'none'
      return discountFilter === 'yes' ? hasDiscount : !hasDiscount
    })
  }, [standardFiltered, filterValues.has_discount])

  // Filter services for mobile search (combines smart filters + search)
  const filteredServices = useMemo(() => {
    if (!searchValue) return smartFiltered
    const query = searchValue.toLowerCase()
    return smartFiltered.filter((service: any) =>
      service.name?.toLowerCase().includes(query) ||
      getCategoryLabel(service, categoryLookup, '').toLowerCase().includes(query)
    )
  }, [smartFiltered, searchValue, categoryLookup])

  // Desktop columns definition
  // Responsive strategy for tablet (md: 768-1024px):
  // - Essential columns (always visible): Name, Duration, Price, Actions
  // - Hidden on tablet (lg:table-cell): Category, Base Cost, Discount
  const columns = [
    {
      key: 'name',
      label: tFields('name'),
      className: 'min-w-[180px]',
      render: (_value: any, service: any) => (
        <div>
          <div className="font-medium">{service.name}</div>
          {service.description && (
            <div className="text-sm text-muted-foreground line-clamp-1">{service.description}</div>
          )}
        </div>
      )
    },
    {
      key: 'category',
      label: tFields('category'),
      className: 'hidden lg:table-cell',
      render: (_value: any, service: any) => (
        <Badge variant="outline">
          {getCategoryLabel(service, categoryLookup, t('no_category'))}
        </Badge>
      )
    },
    {
      key: 'est_minutes',
      label: tFields('duration'),
      className: 'w-[100px]',
      render: (_value: any, service: any) => {
        const minutes = service?.est_minutes || service?.duration_minutes || 0;
        return (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{minutes} {tRoot('common.minutes')}</span>
          </div>
        )
      }
    },
    {
      key: 'total_cost_cents',
      label: t('base_cost'),
      className: 'hidden lg:table-cell',
      render: (_value: any, service: any) => {
        const costBase = service?.total_cost_cents || 0;
        const fixedCost = service?.fixed_cost_cents || 0;
        const variableCost = service?.variable_cost_cents || 0;
        const minutes = service?.est_minutes || service?.duration_minutes || 0;

        return (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-right font-medium flex items-center justify-end gap-1.5 cursor-pointer text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors">
                {formatCurrency(costBase)}
                <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm p-3 sm:p-4" side="bottom" align="end" sideOffset={4} collisionPadding={16}>
              <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                <div className="font-semibold border-b pb-2 text-sm sm:text-base">
                  {t('cost_breakdown')}
                </div>
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between items-start gap-4 mb-1">
                      <span className="text-muted-foreground font-medium">{t('fixed_cost_label')}:</span>
                      <span className="font-semibold text-right">
                        {formatCurrency(fixedCost)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground pl-0 space-y-0.5">
                      <div>{minutes} {tRoot('common.minutes')} x {formatCurrency(fixedCostPerMinuteCents)}/min</div>
                      <div className="italic">{t('fixed_cost_includes')}</div>
                    </div>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground font-medium">{t('variable_cost_label')}:</span>
                    <span className="font-semibold">{formatCurrency(variableCost)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between gap-4">
                    <span className="font-bold text-base">{t('total_cost')}:</span>
                    <span className="font-bold text-base">{formatCurrency(costBase)}</span>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )
      }
    },
    {
      key: 'price_cents',
      label: t('price_with_margin'),
      className: 'min-w-[120px]',
      render: (_value: any, service: any) => {
        const costBase = service?.total_cost_cents || 0;
        const configuredMarginPct = service?.margin_pct || 30;
        const originalPrice = Math.round(costBase * (1 + configuredMarginPct / 100));
        const finalPrice = service?.price_cents || 0;
        const hasDiscount = service?.discount_type && service.discount_type !== 'none';
        const { profit, realMarginPct, hasLoss, hasLowMargin } = getMarginStatus(costBase, finalPrice);
        const suggestedPrice = Math.round(costBase * (1 + configuredMarginPct / 100));

        return (
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn(
                "text-right font-bold flex flex-col items-end gap-0.5 cursor-pointer transition-colors",
                hasLoss && "text-destructive dark:text-destructive/80 hover:text-destructive/90",
                hasLowMargin && !hasLoss && "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300",
                !hasLoss && !hasLowMargin && "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
              )}>
                {hasDiscount ? (
                  <>
                    <span className="text-xs line-through text-muted-foreground font-normal">
                      {formatCurrency(originalPrice)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-bold">{formatCurrency(finalPrice)}</span>
                      <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {formatCurrency(finalPrice)}
                    <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
                  </div>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm p-3 sm:p-4" side="bottom" align="end" sideOffset={4} collisionPadding={16}>
              <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                <div className="font-semibold border-b pb-2 text-sm sm:text-base">
                  {t('profit_breakdown')}
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground font-medium">{t('base_cost')}:</span>
                    <span className="font-semibold">{formatCurrency(costBase)}</span>
                  </div>
                  {hasDiscount && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground font-medium">{t('price_before_discount')}:</span>
                      <span className="font-semibold line-through">{formatCurrency(originalPrice)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground font-medium">{hasDiscount ? t('final_price_with_discount') : t('price_with_margin')}:</span>
                    <span className="font-semibold">{formatCurrency(finalPrice)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2"></div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground font-medium">{t('real_margin')}:</span>
                    <span className={cn(
                      "font-bold",
                      hasLoss && "text-destructive dark:text-destructive/80",
                      hasLowMargin && !hasLoss && "text-amber-600 dark:text-amber-400",
                      !hasLoss && !hasLowMargin && "text-emerald-600 dark:text-emerald-400"
                    )}>
                      {realMarginPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-muted-foreground">{t('configured_margin')}:</span>
                    <span className="text-muted-foreground">{configuredMarginPct}%</span>
                  </div>
                  <div className={cn(
                    "flex justify-between gap-4 p-2 rounded",
                    hasLoss && "bg-destructive/10 dark:bg-destructive/20",
                    hasLowMargin && !hasLoss && "bg-amber-50 dark:bg-amber-950/30",
                    !hasLoss && !hasLowMargin && "bg-emerald-50 dark:bg-emerald-950/30"
                  )}>
                    <span className={cn(
                      "font-semibold",
                      hasLoss && "text-destructive dark:text-destructive/90",
                      hasLowMargin && !hasLoss && "text-amber-700 dark:text-amber-300",
                      !hasLoss && !hasLowMargin && "text-emerald-700 dark:text-emerald-300"
                    )}>{t('profit_label')}:</span>
                    <span className={cn(
                      "font-bold",
                      hasLoss && "text-destructive dark:text-destructive/90",
                      hasLowMargin && !hasLoss && "text-amber-700 dark:text-amber-300",
                      !hasLoss && !hasLowMargin && "text-emerald-700 dark:text-emerald-300"
                    )}>{formatCurrency(profit)}</span>
                  </div>

                  {hasLoss && (
                    <div className="bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 dark:border-destructive/40 p-3 rounded-md space-y-2">
                      <p className="text-xs font-semibold text-destructive dark:text-destructive/90">
                        {t('margin_warning')}
                      </p>
                      <p className="text-xs text-destructive dark:text-destructive/80">
                        {t('suggested_price_for_margin', { margin: configuredMarginPct })}: <span className="font-bold">{formatCurrency(suggestedPrice)}</span>
                      </p>
                    </div>
                  )}

                  {hasLowMargin && !hasLoss && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2 rounded-md">
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {t('low_margin_warning')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )
      }
    },
    {
      key: 'discount_value',
      label: t('discount'),
      className: 'hidden lg:table-cell',
      render: (_value: any, service: any) => {
        const hasDiscount = service?.discount_type && service.discount_type !== 'none';

        if (!hasDiscount) {
          return (
            <span className="text-xs text-muted-foreground">
              {t('discount_types.none')}
            </span>
          );
        }

        const discountType = service.discount_type;
        const discountValue = service.discount_value || 0;

        return (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 w-fit">
            {discountType === 'percentage'
              ? `${discountValue}%`
              : formatCurrency(discountValue * 100)}
          </Badge>
        );
      }
    },
    {
      key: 'actions',
      label: tRoot('common.actions'),
      sortable: false,
      className: 'w-[60px]',
      render: (_value: any, service: any) => {
        if (!service) return null;

        return (
          <ActionDropdown
            actions={[
              {
                label: t('manage_supplies'),
                icon: <Package className="h-4 w-4" />,
                onClick: () => service && onManageSupplies(service)
              },
              {
                label: t('apply_discount'),
                icon: <Percent className="h-4 w-4" />,
                onClick: () => service && onApplyDiscount(service)
              },
              createEditAction(() => service && onEdit(service), tRoot('common.edit')),
              createDeleteAction(() => service && onDelete(service), tRoot('common.delete'))
            ]}
          />
        )
      }
    }
  ]

  // Mobile card component
  const ServiceMobileCard = ({ service }: { service: any }) => {
    const costBase = service?.total_cost_cents || 0
    const configuredMarginPct = service?.margin_pct || 30
    const originalPrice = Math.round(costBase * (1 + configuredMarginPct / 100))
    const finalPrice = service?.price_cents || 0
    const hasDiscount = service?.discount_type && service.discount_type !== 'none'
    const discountValue = service?.discount_value || 0
    const discountType = service?.discount_type
    const minutes = service?.est_minutes || service?.duration_minutes || 0
    const fixedCost = service?.fixed_cost_cents || 0
    const variableCost = service?.variable_cost_cents || 0
    const { profit, realMarginPct, hasLoss, hasLowMargin } = getMarginStatus(costBase, finalPrice)
    const suggestedPrice = Math.round(costBase * (1 + configuredMarginPct / 100))

    return (
      <div className="p-4 space-y-3 bg-card border-b border-border last:border-b-0">
        {/* Header: Service name and category */}
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base text-foreground truncate">
                {service.name}
              </h3>
              {service.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                  {service.description}
                </p>
              )}
            </div>
            <ActionDropdown
              actions={[
                {
                  label: t('manage_supplies'),
                  icon: <Package className="h-4 w-4" />,
                  onClick: () => onManageSupplies(service)
                },
                {
                  label: t('apply_discount'),
                  icon: <Percent className="h-4 w-4" />,
                  onClick: () => onApplyDiscount(service)
                },
                createEditAction(() => onEdit(service), tRoot('common.edit')),
                createDeleteAction(() => onDelete(service), tRoot('common.delete'))
              ]}
            />
          </div>

          {/* Category and duration badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              <Tag className="h-3 w-3 mr-1" />
              {getCategoryLabel(service, categoryLookup, t('no_category'))}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {minutes} {tRoot('common.minutes')}
            </Badge>
            {hasDiscount && (
              <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                <Percent className="h-3 w-3 mr-1" />
                {discountType === 'percentage' ? `${discountValue}%` : formatCurrency(discountValue * 100)}
              </Badge>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/50" />

        {/* Financial info grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Price column */}
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              {t('price_label')}
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(
                  "flex items-center gap-1 font-bold text-lg transition-colors",
                  hasLoss && "text-destructive",
                  hasLowMargin && !hasLoss && "text-amber-600 dark:text-amber-400",
                  !hasLoss && !hasLowMargin && "text-emerald-600 dark:text-emerald-400"
                )}>
                  {hasDiscount ? (
                    <div className="flex flex-col items-start">
                      <span className="text-xs line-through text-muted-foreground font-normal">
                        {formatCurrency(originalPrice)}
                      </span>
                      <span>{formatCurrency(finalPrice)}</span>
                    </div>
                  ) : (
                    <span>{formatCurrency(finalPrice)}</span>
                  )}
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] max-w-sm p-3" side="bottom" align="start" sideOffset={4} collisionPadding={16}>
                <div className="space-y-2 text-sm">
                  <div className="font-semibold border-b pb-2">{t('profit_breakdown')}</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('base_cost')}:</span>
                      <span className="font-medium">{formatCurrency(costBase)}</span>
                    </div>
                    {hasDiscount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('price_before_discount')}:</span>
                        <span className="font-medium line-through">{formatCurrency(originalPrice)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{hasDiscount ? t('final_price_with_discount') : t('price_with_margin')}:</span>
                      <span className="font-medium">{formatCurrency(finalPrice)}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('real_margin')}:</span>
                        <span className={cn(
                          "font-bold",
                          hasLoss && "text-destructive",
                          hasLowMargin && !hasLoss && "text-amber-600 dark:text-amber-400",
                          !hasLoss && !hasLowMargin && "text-emerald-600 dark:text-emerald-400"
                        )}>{realMarginPct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className={cn(
                      "flex justify-between p-2 rounded",
                      hasLoss && "bg-destructive/10",
                      hasLowMargin && !hasLoss && "bg-amber-50 dark:bg-amber-950/30",
                      !hasLoss && !hasLowMargin && "bg-emerald-50 dark:bg-emerald-950/30"
                    )}>
                      <span className="font-semibold">{t('profit_label')}:</span>
                      <span className="font-bold">{formatCurrency(profit)}</span>
                    </div>
                    {hasLoss && (
                      <div className="bg-destructive/10 border border-destructive/30 p-2 rounded text-xs">
                        <p className="font-semibold text-destructive">{t('margin_warning')}</p>
                        <p className="text-destructive/80 mt-1">
                          {t('suggested_price_for_margin', { margin: configuredMarginPct })}: <span className="font-bold">{formatCurrency(suggestedPrice)}</span>
                        </p>
                      </div>
                    )}
                    {hasLowMargin && !hasLoss && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2 rounded text-xs">
                        <p className="text-amber-700 dark:text-amber-300">{t('low_margin_warning')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Cost column */}
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              {t('base_cost')}
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 font-semibold text-lg text-orange-600 dark:text-orange-400 transition-colors">
                  {formatCurrency(costBase)}
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] max-w-sm p-3" side="bottom" align="end" sideOffset={4} collisionPadding={16}>
                <div className="space-y-2 text-sm">
                  <div className="font-semibold border-b pb-2">{t('cost_breakdown')}</div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">{t('fixed_cost_label')}:</span>
                        <span className="font-medium">{formatCurrency(fixedCost)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {minutes} {tRoot('common.minutes')} x {formatCurrency(fixedCostPerMinuteCents)}/min
                      </p>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('variable_cost_label')}:</span>
                      <span className="font-medium">{formatCurrency(variableCost)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-bold">{t('total_cost')}:</span>
                      <span className="font-bold">{formatCurrency(costBase)}</span>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Profit row */}
        <div className={cn(
          "flex items-center justify-between p-2.5 rounded-lg",
          hasLoss && "bg-destructive/10 dark:bg-destructive/20",
          hasLowMargin && !hasLoss && "bg-amber-50 dark:bg-amber-950/30",
          !hasLoss && !hasLowMargin && "bg-emerald-50 dark:bg-emerald-950/30"
        )}>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-medium",
              hasLoss && "text-destructive",
              hasLowMargin && !hasLoss && "text-amber-700 dark:text-amber-300",
              !hasLoss && !hasLowMargin && "text-emerald-700 dark:text-emerald-300"
            )}>
              {t('profit_label')}:
            </span>
            <span className={cn(
              "font-bold text-base",
              hasLoss && "text-destructive",
              hasLowMargin && !hasLoss && "text-amber-700 dark:text-amber-300",
              !hasLoss && !hasLowMargin && "text-emerald-700 dark:text-emerald-300"
            )}>
              {formatCurrency(profit)}
            </span>
          </div>
          <Badge variant="outline" className={cn(
            "text-xs",
            hasLoss && "border-destructive/50 text-destructive",
            hasLowMargin && !hasLoss && "border-amber-500/50 text-amber-700 dark:text-amber-300",
            !hasLoss && !hasLowMargin && "border-emerald-500/50 text-emerald-700 dark:text-emerald-300"
          )}>
            {realMarginPct.toFixed(0)}% {t('margin_label_short')}
          </Badge>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="rounded-xl border bg-card shadow-sm p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded-md w-32 mx-auto"></div>
          <div className="h-3 bg-muted rounded-md w-24 mx-auto"></div>
        </div>
      </div>
    )
  }

  // Empty state
  if (!services || services.length === 0) {
    return (
      <div className="rounded-xl border bg-card shadow-sm p-12 text-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-2">
            <Briefcase className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">{t('no_services')}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {t('no_services_description')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Smart Filters */}
      <SmartFilters
        filters={filterConfigs}
        values={filterValues}
        onChange={setFilterValues}
      />

      {/* Mobile view with custom cards */}
      <div className="md:hidden space-y-4">
        {/* Mobile search bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('search_services')}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-10 py-2.5 text-sm shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="shrink-0 text-sm text-muted-foreground">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
              {filteredServices.length}
            </span>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {filteredServices.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">{t('no_results')}</p>
            </div>
          ) : (
            filteredServices.map((service: any) => (
              <ServiceMobileCard key={service.id} service={service} />
            ))
          )}
        </div>
      </div>

      {/* Desktop view with DataTable */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={filteredServices}
          loading={loading}
          searchPlaceholder={t('search_services')}
          searchKey="name"
          showCount={true}
          countLabel={t('title').toLowerCase()}
          emptyState={{
            icon: Briefcase,
            title: t('no_services'),
            description: t('no_services_description')
          }}
        />
      </div>
    </div>
  )
}
