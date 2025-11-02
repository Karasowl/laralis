'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/badge'
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatCurrency } from '@/lib/money'
import { Briefcase, Package, Clock, Info } from 'lucide-react'

interface ServicesTableProps {
  services: any[]
  loading: boolean
  categories?: Array<{ id?: string; code?: string; name?: string; display_name?: string }>
  fixedCostPerMinuteCents?: number
  onManageSupplies: (service: any) => void
  onEdit: (service: any) => void
  onDelete: (service: any) => void
}

export function ServicesTable({
  services,
  loading,
  categories = [],
  fixedCostPerMinuteCents = 0,
  onManageSupplies,
  onEdit,
  onDelete
}: ServicesTableProps) {
  const t = useTranslations('services')
  const tRoot = useTranslations()
  const tFields = useTranslations('fields')

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

  const columns = [
    {
      key: 'name',
      label: tFields('name'),
      render: (_value: any, service: any) => (
        <div>
          <div className="font-medium">{service.name}</div>
          {service.description && (
            <div className="text-sm text-muted-foreground">{service.description}</div>
          )}
        </div>
      )
    },
    {
      key: 'category',
      label: tFields('category'),
      render: (_value: any, service: any) => (
        <Badge variant="outline">
          {(() => {
            const raw = service?.category
            const mapped = raw ? categoryLookup.get(raw) : undefined
            if (mapped) return mapped
            if (typeof raw === 'string' && raw.trim().length > 0) {
              const looksLikeId = /^[0-9a-f-]{10,}$/.test(raw)
              if (!looksLikeId) return raw
            }
            return t('no_category')
          })()}
        </Badge>
      )
    },
    {
      key: 'duration',
      label: tFields('duration'),
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
      key: 'cost',
      label: t('base_cost'),
      render: (_value: any, service: any) => {
        // Use the calculated costs from backend
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
            <PopoverContent className="w-80" side="left" align="start">
              <div className="space-y-3 text-sm">
                <div className="font-semibold border-b pb-2 text-base">
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
                      <div>{minutes} {tRoot('common.minutes')} × {formatCurrency(fixedCostPerMinuteCents)}/min</div>
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
      key: 'sale_price',
      label: t('price_with_margin'),
      render: (_value: any, service: any) => {
        const costBase = service?.total_cost_cents || 0;
        const marginPct = service?.margin_pct || 30;
        const salePrice = service?.price_cents || 0;  // Use saved price (already has margin)
        const profit = salePrice - costBase;

        return (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-right font-bold flex items-center justify-end gap-1.5 cursor-pointer text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                {formatCurrency(salePrice)}
                <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80" side="left" align="start">
              <div className="space-y-3 text-sm">
                <div className="font-semibold border-b pb-2 text-base">
                  {t('profit_breakdown')}
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground font-medium">{t('base_cost')}:</span>
                    <span className="font-semibold">{formatCurrency(costBase)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground font-medium">{t('margin_label')}:</span>
                    <span className="font-semibold">{marginPct}%</span>
                  </div>
                  <div className="flex justify-between gap-4 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded">
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{t('profit_label')}:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(profit)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between gap-4">
                    <span className="font-bold text-base">{t('price_with_margin')}:</span>
                    <span className="font-bold text-base">{formatCurrency(salePrice)}</span>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )
      }
    },
    {
      key: 'actions',
      label: tRoot('common.actions'),
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
              createEditAction(() => service && onEdit(service), tRoot('common.edit')),
              createDeleteAction(() => service && onDelete(service), tRoot('common.delete'))
            ]}
          />
        )
      }
    }
  ]

  return (
    <DataTable
      columns={columns}
      mobileColumns={[columns[0], columns[1], columns[2], columns[3], columns[4], columns[5]]}
      data={services || []}
      loading={loading}
      searchPlaceholder={t('search_services')}
      emptyState={{
        icon: Briefcase,
        title: t('no_services'),
        description: t('no_services_description')
      }}
    />
  )
}
