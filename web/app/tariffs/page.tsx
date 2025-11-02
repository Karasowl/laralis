'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { CrudPageLayout } from '@/components/ui/crud-page-layout'
import { FormModal } from '@/components/ui/form-modal'
import { FormSection, FormGrid, InputField, SelectField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format'
import { Calculator, RefreshCw, Save } from 'lucide-react'
import { useTariffs, TariffRow } from '@/hooks/use-tariffs'
import { useRequirementsGuard } from '@/lib/requirements/useGuard'
import { toast } from 'sonner'
import { Form } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// Schema for bulk operations
const bulkOperationSchema = z.object({
  margin: z.number().min(0).max(100),
  roundTo: z.number().min(1)
})

// Schema for individual tariff edit
const tariffEditSchema = z.object({
  serviceId: z.string(),
  margin: z.number().min(0).max(100)
})

export default function TariffsPage() {
  const t = useTranslations('tariffs')
  const tRoot = useTranslations()
  const { currentClinic } = useCurrentClinic()
  
  // Tariff management hook
  const {
    tariffs,
    loading,
    error,
    updateMargin,
    updateAllMargins,
    updateRounding,
    saveTariffs,
    refreshTariffs
  } = useTariffs({
    clinicId: currentClinic?.id,
    defaultMargin: 30,
    defaultRoundTo: 10
  })

  const { ensureReady } = useRequirementsGuard(() => ({ clinicId: currentClinic?.id as string }))

  // Modal states
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedTariff, setSelectedTariff] = useState<TariffRow | null>(null)
  const [saving, setSaving] = useState(false)

  // Forms
  const bulkForm = useForm({
    resolver: zodResolver(bulkOperationSchema),
    defaultValues: {
      margin: 30,
      roundTo: 10
    }
  })

  const editForm = useForm({
    resolver: zodResolver(tariffEditSchema),
    defaultValues: {
      serviceId: '',
      margin: 30
    }
  })

  // Handlers
  const handleBulkUpdate = (data: z.infer<typeof bulkOperationSchema>) => {
    updateAllMargins(data.margin)
    updateRounding(data.roundTo)
    setBulkModalOpen(false)
    bulkForm.reset()
  }

  const handleIndividualEdit = (data: z.infer<typeof tariffEditSchema>) => {
    updateMargin(data.serviceId, data.margin)
    setEditModalOpen(false)
    editForm.reset()
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveTariffs()
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = async (tariff: TariffRow) => {
    const ready = await ensureReady('create_tariff', { serviceId: tariff.id })
    if (!ready.allowed) {
      toast.info(t('ensure_prereqs') || 'Completa receta y costo/minuto para tarificar')
      return
    }
    setSelectedTariff(tariff)
    editForm.setValue('serviceId', tariff.id)
    editForm.setValue('margin', tariff.margin_pct)
    setEditModalOpen(true)
  }

  // Summary cards data
  const summaryCards = [
    {
      title: t('total_services'),
      value: tariffs.length.toString(),
      description: t('active_services')
    },
    {
      title: t('average_margin'),
      value: tariffs.length > 0 
        ? `${Math.round(tariffs.reduce((acc, t) => acc + t.margin_pct, 0) / tariffs.length)}%`
        : '0%',
      description: t('across_all_services')
    },
    {
      title: t('total_revenue'),
      value: formatCurrency(
        tariffs.reduce((acc, t) => acc + t.rounded_price, 0)
      ),
      description: t('if_all_sold_once')
    }
  ]

  // Table columns
  const columns = [
    {
      key: 'name',
      label: t('service'),
      render: (_value: string, tariff: TariffRow) => (
        <div>
          <div className="font-medium">{tariff.name}</div>
          <div className="text-sm text-muted-foreground">
            {tariff.category}
          </div>
        </div>
      )
    },
    {
      key: 'costs',
      label: t('costs'),
      render: (_value: unknown, tariff: TariffRow) => {
        const totalCost = (tariff.fixed_cost_cents || 0) + (tariff.variable_cost_cents || 0)
        return (
          <div className="text-right">
            <div>{formatCurrency(totalCost)}</div>
            <div className="text-xs text-muted-foreground">
              {t('fixed')}: {formatCurrency(tariff.fixed_cost_cents || 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('variable')}: {formatCurrency(tariff.variable_cost_cents || 0)}
            </div>
          </div>
        )
      }
    },
    {
      key: 'margin',
      label: t('margin'),
      render: (_value: number, tariff: TariffRow) => (
        <div className="text-center">
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
            {tariff.margin_pct}%
          </span>
        </div>
      )
    },
    {
      key: 'price',
      label: t('final_price'),
      render: (_value: number, tariff: TariffRow) => (
        <div className="text-right">
          <div className="font-semibold text-lg">
            {formatCurrency(tariff.rounded_price)}
          </div>
          {tariff.rounded_price !== tariff.final_price && (
            <div className="text-xs text-muted-foreground line-through">
              {formatCurrency(tariff.final_price)}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      label: tRoot('common.actions'),
      render: (_value: unknown, tariff: TariffRow) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openEditModal(tariff)}
        >
          <Calculator className="h-4 w-4 mr-2" />
          {t('adjust')}
        </Button>
      )
    }
  ]

  // Actions for the page
  const actions = (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={() => setBulkModalOpen(true)}
      >
        <Calculator className="h-4 w-4 mr-2" />
        {t('bulk_adjust')}
      </Button>
      <Button
        variant="outline"
        onClick={refreshTariffs}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        {t('refresh')}
      </Button>
      <Button
        onClick={handleSave}
        disabled={saving}
      >
        <Save className="h-4 w-4 mr-2" />
        {saving ? t('saving') : t('save_tariffs')}
      </Button>
    </div>
  )

  return (
    <>
      <CrudPageLayout
        title={t('title')}
        subtitle={t('subtitle')}
        items={tariffs}
        loading={loading}
        columns={columns}
        searchable={true}
        searchPlaceholder={t('search_services')}
        emptyTitle={t('no_services')}
        emptyDescription={t('no_services_description')}
        additionalContent={
          <div className="flex gap-2 mb-6">
            {actions}
          </div>
        }
        summaryCards={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {summaryCards.map((card, index) => (
              <div key={index} className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-medium text-muted-foreground">{card.title}</h3>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </div>
            ))}
          </div>
        }
      />

      {/* Bulk Operations Modal */}
      <FormModal
        open={bulkModalOpen}
        onOpenChange={(open) => { setBulkModalOpen(open); if (!open) bulkForm.reset({ margin: 30, roundTo: 10 }) }}
        title={t('bulk_operations')}
        onSubmit={bulkForm.handleSubmit(handleBulkUpdate)}
        maxWidth="sm"
      >
        <Form {...bulkForm}>
          <FormSection title={t('adjustment_settings')}>
            <FormGrid columns={2}>
              <div>
                <label className="text-sm font-medium mb-2 block">{t('default_margin')}</label>
                <input
                  type="number"
                  {...bulkForm.register('margin', { valueAsNumber: true })}
                  placeholder="30"
                  min={0}
                  max={100}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                {bulkForm.formState.errors.margin?.message && (
                  <p className="text-sm text-red-600 mt-1">{bulkForm.formState.errors.margin?.message}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('round_to')}</label>
                <select
                  {...bulkForm.register('roundTo', {
                    setValueAs: (v) => parseInt(v, 10)
                  })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="1">$1</option>
                  <option value="5">$5</option>
                  <option value="10">$10</option>
                  <option value="50">$50</option>
                  <option value="100">$100</option>
                </select>
                {bulkForm.formState.errors.roundTo?.message && (
                  <p className="text-sm text-red-600 mt-1">{bulkForm.formState.errors.roundTo?.message}</p>
                )}
              </div>
            </FormGrid>
          </FormSection>
        </Form>
      </FormModal>

      {/* Individual Edit Modal */}
      <FormModal
        open={editModalOpen}
        onOpenChange={(open) => { setEditModalOpen(open); if (!open) { editForm.reset({ serviceId: '', margin: 30 }); setSelectedTariff(null) } }}
        title={selectedTariff ? `${t('adjust_tariff')}: ${selectedTariff.name}` : t('adjust_tariff')}
        onSubmit={editForm.handleSubmit(handleIndividualEdit)}
        maxWidth="sm"
      >
        <Form {...editForm}>
          <FormSection>
            <div>
              <label className="text-sm font-medium mb-2 block">{t('margin_percentage')}</label>
              <input
                type="number"
                {...editForm.register('margin', { valueAsNumber: true })}
                placeholder="30"
                min={0}
                max={100}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {editForm.formState.errors.margin?.message && (
                <p className="text-sm text-red-600 mt-1">{editForm.formState.errors.margin?.message}</p>
              )}
            </div>

            {selectedTariff && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>{t('total_cost')}:</span>
                    <span className="font-medium">
                      {formatCurrency(
                        (selectedTariff.fixed_cost_cents || 0) +
                        (selectedTariff.variable_cost_cents || 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('with_margin')} {editForm.watch('margin')}%:</span>
                    <span className="font-medium">
                      {formatCurrency(
                        Math.round(
                          ((selectedTariff.fixed_cost_cents || 0) +
                           (selectedTariff.variable_cost_cents || 0)) *
                          (1 + editForm.watch('margin') / 100)
                        )
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </FormSection>
        </Form>
      </FormModal>
    </>
  )
}
