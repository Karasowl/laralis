'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/badge'
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
      key: 'price',
      label: tFields('price'),
      render: (_value: any, service: any) => {
        const price = service?.base_price_cents || service?.price_cents || 0;
        const minutes = service?.est_minutes || service?.duration_minutes || 0;
        const fixedCost = Math.round(minutes * fixedCostPerMinuteCents);
        const variableCost = price - fixedCost;

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-right font-semibold flex items-center justify-end gap-1.5 cursor-help">
                  {formatCurrency(price)}
                  <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs" side="left">
                <div className="space-y-2 text-xs">
                  <div className="font-semibold border-b pb-1.5 mb-2">
                    {t('price_breakdown')}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start gap-4">
                      <span className="text-muted-foreground">{t('fixed_cost_label')}:</span>
                      <span className="font-medium text-right">
                        {formatCurrency(fixedCost)}
                        <div className="text-[10px] text-muted-foreground font-normal">
                          {minutes} {tRoot('common.minutes')} × {formatCurrency(fixedCostPerMinuteCents)}/min
                        </div>
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{t('variable_cost_label')}:</span>
                      <span className="font-medium">{formatCurrency(Math.max(0, variableCost))}</span>
                    </div>
                    <div className="border-t pt-1.5 mt-2 flex justify-between gap-4">
                      <span className="font-semibold">{tRoot('common.total')}:</span>
                      <span className="font-semibold">{formatCurrency(price)}</span>
                    </div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
      mobileColumns={[columns[0], columns[1], columns[2], columns[3], columns[4]]}
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
