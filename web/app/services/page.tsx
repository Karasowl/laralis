'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { FormModal } from '@/components/ui/form-modal'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ServiceForm } from './components/ServiceForm'
import { SuppliesManager } from './components/SuppliesManager'
import { ServicesTable } from './components/ServicesTable'
import { CategoryModal } from './components/CategoryModal'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { useWorkspace } from '@/contexts/workspace-context'
import { useRouter } from 'next/navigation'
import { useServices } from '@/hooks/use-services'
import { useTimeSettings } from '@/hooks/use-time-settings'
import { useRequirementsGuard } from '@/lib/requirements/useGuard'
import { toast } from 'sonner'
import { serviceSchema, type ServiceFormData } from '@/lib/schemas'
import { Plus } from 'lucide-react'

interface ServiceSupply {
  supply_id: string
  quantity: number
}

const resolveSupplyCost = (supply: any): number => {
  if (typeof supply?.cost_per_portion_cents === 'number') return supply.cost_per_portion_cents
  if (typeof supply?.cost_per_unit_cents === 'number') return supply.cost_per_unit_cents
  if (typeof supply?.price_cents === 'number') return supply.price_cents
  if (typeof supply?.cost_per_unit === 'number') return supply.cost_per_unit
  return 0
}

const DEFAULT_SERVICE_FORM_VALUES: ServiceFormData = {
  name: '',
  category: 'otros',
  duration_minutes: 30,
  base_price_cents: 0,
  description: ''
};

export default function ServicesPage() {
  const t = useTranslations('services')
  const tCommon = useTranslations('common')
  const { currentClinic } = useCurrentClinic()
  const { workspace } = useWorkspace()
  const router = useRouter()
  useEffect(() => {
    try { console.log('[ServicesPage] currentClinic', currentClinic?.id) } catch {}
  }, [currentClinic?.id])
  const { calculations } = useTimeSettings({ clinicId: currentClinic?.id })
  const fixedCostPerMinuteCents = calculations.fixedCostPerMinuteCents || 0

  const {
    services,
    categories,
    supplies,
    loading,

    createService,
    updateService,
    deleteService,
    fetchServiceSupplies,
    createCategory,
    updateCategory,
    deleteCategory,
    fetchServices
  } = useServices({ clinicId: currentClinic?.id })

  // Modal states
  const [createOpen, setCreateOpen] = useState(false)
  const [editService, setEditService] = useState<any>(null)
  const [deleteServiceData, setDeleteServiceData] = useState<any>(null)
  const [suppliesModalOpen, setSuppliesModalOpen] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [serviceSupplies, setServiceSupplies] = useState<ServiceSupply[]>([])
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)

  useEffect(() => {
    if (currentClinic?.id) {
      fetchServices()
    }
  }, [currentClinic?.id, fetchServices])

  // Form
  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: DEFAULT_SERVICE_FORM_VALUES
  })

  // Guard for create_service (ensures supplies exist or opens importer)
  const { ensureReady } = useRequirementsGuard(() => ({ clinicId: currentClinic?.id as string }))

  // Load service supplies when editing
  useEffect(() => {
    if (selectedServiceId) {
      fetchServiceSupplies(selectedServiceId).then((supplies) => {
        const mapped = supplies.map((s) => ({
          supply_id: s.supply_id,
          quantity: s.quantity
        }))
        setServiceSupplies(mapped.length > 0 ? mapped : [{ supply_id: '', quantity: 0 }])
      })
    }
  }, [selectedServiceId, fetchServiceSupplies])

  // Submit handlers
  const handleCreate = async (data: ServiceFormData) => {
    const ready = await ensureReady('create_service')
    if (!ready.allowed) {
      toast.info(t('please_import_supplies'))
      return
    }
    const sanitizedSupplies = serviceSupplies.filter((ss) => ss.supply_id && (ss.quantity ?? 0) > 0)
    const success = await createService({
      ...data,
      supplies: sanitizedSupplies
    })
    if (success) {
      await fetchServices()
      setCreateOpen(false)
      form.reset()
      setServiceSupplies([])
      // Tras crear, vuelve al Setup solo si seguimos en onboarding
      try { if (typeof window !== 'undefined') localStorage.setItem('setup_service_recipe_done', 'true') } catch {}
      const fromSetup = (typeof window !== 'undefined' && sessionStorage.getItem('return_to_setup') === '1')
      const inOnboarding = (workspace?.onboarding_completed === false) || (workspace?.onboarding_completed === undefined && fromSetup)
      if (inOnboarding) {
        try { if (typeof window !== 'undefined') sessionStorage.removeItem('return_to_setup') } catch {}
        setTimeout(() => router.push('/setup'), 0)
      }
    }
  }

  const handleEdit = async (data: ServiceFormData) => {
    if (!editService) return
    const sanitizedSupplies = serviceSupplies.filter((ss) => ss.supply_id && (ss.quantity ?? 0) > 0)
    const success = await updateService(editService.id, {
      ...data,
      supplies: sanitizedSupplies
    })
    if (success) {
      await fetchServices()
      setEditService(null)
      form.reset()
      setServiceSupplies([])
      // En onboarding, marcar y volver a Setup tras editar receta
      try { if (typeof window !== 'undefined') localStorage.setItem('setup_service_recipe_done', 'true') } catch {}
      const fromSetup = (typeof window !== 'undefined' && sessionStorage.getItem('return_to_setup') === '1')
      const inOnboarding = (workspace?.onboarding_completed === false) || (workspace?.onboarding_completed === undefined && fromSetup)
      if (inOnboarding) {
        try { if (typeof window !== 'undefined') sessionStorage.removeItem('return_to_setup') } catch {}
        setTimeout(() => router.push('/setup'), 0)
      }
    }
  }

  const handleDelete = async () => {
    if (!deleteServiceData) return
    const success = await deleteService(deleteServiceData.id)
    if (success) {
      setDeleteServiceData(null)
    }
  }


  // Add/remove supplies helpers
  const addSupply = () => {
    setServiceSupplies([...serviceSupplies, { supply_id: '', quantity: 0 }])
  }

  const removeSupply = (index: number) => {
    setServiceSupplies(serviceSupplies.filter((_, i) => i !== index))
  }

  const updateSupply = (index: number, field: 'supply_id' | 'quantity', value: any) => {
    const updated = [...serviceSupplies]
    updated[index] = { ...updated[index], [field]: value }
    setServiceSupplies(updated)
  }

  const variableCostCents = useMemo(() => {
    return serviceSupplies.reduce((total, ss) => {
      const supply = supplies.find((s) => s.id === ss.supply_id)
      if (!supply) return total
      const qty = Number.isFinite(ss.quantity) ? ss.quantity : 0
      const costCents = resolveSupplyCost(supply)
      return total + costCents * Math.max(qty, 0)
    }, 0)
  }, [serviceSupplies, supplies])

  const durationMinutes = form.watch('duration_minutes') || 0
  const totalFixedCostCents = Math.max(0, Math.round(durationMinutes * fixedCostPerMinuteCents))
  const totalServiceCostCents = totalFixedCostCents + variableCostCents

  useEffect(() => {
    const current = form.getValues('base_price_cents') ?? 0
    if (current !== totalServiceCostCents) {
      form.setValue('base_price_cents', totalServiceCostCents, { shouldDirty: current !== totalServiceCostCents })
    }
  }, [totalServiceCostCents, form])

  // Handlers for table actions
  const handleManageSupplies = (service: any) => {
    if (!service?.id) {
      console.error('Service id is undefined:', service)
      return
    }
    setSelectedServiceId(service.id)
    setSuppliesModalOpen(true)
  }

  const handleEditService = (service: any) => {
    if (!service?.id) {
      console.error('Service is invalid:', service)
      return
    }
    form.reset({
      name: service.name,
      category: service.category || 'otros',
      duration_minutes: service.est_minutes || service.duration_minutes || 30,
      base_price_cents: service.base_price_cents || service.price_cents || 0,
      description: service.description || ''
    })
    setSelectedServiceId(service.id)
    setEditService(service)
  }

  const handleDeleteService = (service: any) => {
    if (!service?.id) {
      console.error('Service is invalid:', service)
      return
    }
    setDeleteServiceData(service)
  }

  // Onboarding autofix: open recipe wizard (use edit + supplies modal) when flagged
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const svcId = sessionStorage.getItem('auto_open_recipe_wizard_serviceId')
      if (!svcId) return
      sessionStorage.removeItem('auto_open_recipe_wizard_serviceId')
      // Wait one tick for data
      setTimeout(() => {
        const svc = services.find((s: any) => s.id === svcId)
        if (svc) {
          handleEditService(svc)
          setSuppliesModalOpen(true)
        }
      }, 0)
    } catch {}
  }, [services])

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCategoryModalOpen(true)}>
                {t('manage_categories')}
              </Button>
              <Button onClick={async () => { const { allowed } = await ensureReady('create_service'); if (allowed) setCreateOpen(true) }}>
                <Plus className="h-4 w-4 mr-2" />
                {t('add_service')}
              </Button>
            </div>
          }
        />

        <ServicesTable
          services={services}
          loading={loading}
          categories={categories}
          onManageSupplies={handleManageSupplies}
          onEdit={handleEditService}
          onDelete={handleDeleteService}
        />

        {/* Create Modal */}
        <FormModal
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (open) {
              form.reset(DEFAULT_SERVICE_FORM_VALUES)
              setServiceSupplies([{ supply_id: '', quantity: 0 }])
            } else {
              setServiceSupplies([])
              form.reset(DEFAULT_SERVICE_FORM_VALUES)
            }
          }}
          title={t('create_service')}
          onSubmit={form.handleSubmit(handleCreate)}
          maxWidth="2xl"
          cancelLabel={tCommon('cancel')}
          submitLabel={tCommon('save')}
        >
          <ServiceForm 
            form={form} 
            categories={categories}
            supplies={supplies}
            serviceSupplies={serviceSupplies}
            onSuppliesChange={setServiceSupplies}
            fixedCostPerMinuteCents={fixedCostPerMinuteCents}
            totalFixedCostCents={totalFixedCostCents}
            variableCostCents={variableCostCents}
            totalServiceCostCents={totalServiceCostCents}
            t={t}
          />
        </FormModal>

        {/* Edit Modal */}
        <FormModal
          open={!!editService}
          onOpenChange={(open) => {
            if (!open) {
              setEditService(null)
              setSelectedServiceId(null)
              setServiceSupplies([])
              form.reset(DEFAULT_SERVICE_FORM_VALUES)
            }
          }}
          title={t('edit_service')}
          onSubmit={form.handleSubmit(handleEdit)}
          maxWidth="2xl"
          cancelLabel={tCommon('cancel')}
          submitLabel={tCommon('save')}
        >
          <ServiceForm 
            form={form} 
            categories={categories}
            supplies={supplies}
            serviceSupplies={serviceSupplies}
            onSuppliesChange={setServiceSupplies}
            fixedCostPerMinuteCents={fixedCostPerMinuteCents}
            totalFixedCostCents={totalFixedCostCents}
            variableCostCents={variableCostCents}
            totalServiceCostCents={totalServiceCostCents}
            t={t}
          />
        </FormModal>

        {/* Supplies Modal */}
        <FormModal
          open={suppliesModalOpen}
          onOpenChange={setSuppliesModalOpen}
          title={t('manage_supplies')}
          cancelLabel={tCommon('close')}
          submitLabel={tCommon('save')}
          onSubmit={() => setSuppliesModalOpen(false)}
          maxWidth="lg"
        >
          <SuppliesManager
            supplies={supplies}
            serviceSupplies={serviceSupplies}
            onAdd={addSupply}
            onRemove={removeSupply}
            onUpdate={updateSupply}
            variableCost={variableCostCents}
            t={t}
          />
        </FormModal>

        {/* Category Modal */}
        <CategoryModal
          open={categoryModalOpen}
          onOpenChange={setCategoryModalOpen}
          categories={categories}
          onCreateCategory={createCategory}
          onUpdateCategory={updateCategory}
          onDeleteCategory={deleteCategory}
        />

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deleteServiceData}
          onOpenChange={(open) => !open && setDeleteServiceData(null)}
          title={t('delete_service')}
          description={t('delete_service_confirm', {
            name: deleteServiceData?.name || ''
          })}
          onConfirm={handleDelete}
          variant="destructive"
        />
      </div>
    </AppLayout>
  )
}
