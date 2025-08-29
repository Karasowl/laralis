'use client'

import { useTranslations } from 'next-intl'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/badge'
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown'
import { formatCurrency } from '@/lib/money'
import { Briefcase, Package, Clock } from 'lucide-react'

interface ServicesTableProps {
  services: any[]
  loading: boolean
  onManageSupplies: (service: any) => void
  onEdit: (service: any) => void
  onDelete: (service: any) => void
}

export function ServicesTable({ 
  services, 
  loading, 
  onManageSupplies, 
  onEdit, 
  onDelete 
}: ServicesTableProps) {
  const t = useTranslations('services')
  const tCommon = useTranslations('common')

  const columns = [
    {
      key: 'name',
      label: t('fields.name'),
      render: (service: any) => (
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
      label: t('fields.category'),
      render: (service: any) => (
        <Badge variant="outline">{service.category || t('no_category')}</Badge>
      )
    },
    {
      key: 'duration',
      label: t('fields.duration'),
      render: (service: any) => {
        const minutes = service?.est_minutes || service?.duration_minutes || 0;
        return (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{minutes} {tCommon('minutes')}</span>
          </div>
        )
      }
    },
    {
      key: 'price',
      label: t('fields.price'),
      render: (service: any) => {
        const price = service?.base_price_cents || service?.price_cents || 0;
        return (
          <div className="text-right font-semibold">
            {formatCurrency(price)}
          </div>
        )
      }
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (service: any) => {
        if (!service) return null;
        
        return (
          <ActionDropdown
            actions={[
              {
                label: t('manage_supplies'),
                icon: <Package className="h-4 w-4" />,
                onClick: () => service && onManageSupplies(service)
              },
              createEditAction(() => service && onEdit(service)),
              createDeleteAction(() => service && onDelete(service))
            ]}
          />
        )
      }
    }
  ]

  return (
    <DataTable
      columns={columns}
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