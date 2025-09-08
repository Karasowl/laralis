'use client'

import { useState, useEffect } from 'react'
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
import { useServices } from '@/hooks/use-services'
import { serviceSchema, type ServiceFormData } from '@/lib/schemas'
import { Plus } from 'lucide-react'

interface ServiceSupply {
  supply_id: string
  quantity: number
}

export default function ServicesPage() {
  const t = useTranslations('services')
  const tCommon = useTranslations('common')
  const { currentClinic } = useCurrentClinic()
  const {
    services,
    categories,
    supplies,
    loading,
    createService,
    updateService,
    deleteService,
    fetchServiceSupplies,
    createCategory
  } = useServices({ clinicId: currentClinic?.id })

  // Modal states
  const [createOpen, setCreateOpen] = useState(false)
  const [editService, setEditService] = useState<any>(null)
  const [deleteServiceData, setDeleteServiceData] = useState<any>(null)
  const [suppliesModalOpen, setSuppliesModalOpen] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [serviceSupplies, setServiceSupplies] = useState<ServiceSupply[]>([])
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)

  // Form
  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      category: 'otros',
      duration_minutes: 30,
      base_price_cents: 0,
      description: ''
    }
  })

  // Load service supplies when editing
  useEffect(() => {
    if (selectedServiceId) {
      fetchServiceSupplies(selectedServiceId).then(supplies => {
        setServiceSupplies(supplies.map(s => ({
          supply_id: s.supply_id,
          quantity: s.quantity
        })))
      })
    }
  }, [selectedServiceId, fetchServiceSupplies])

  // Submit handlers
  const handleCreate = async (data: ServiceFormData) => {
    const success = await createService({
      ...data,
      supplies: serviceSupplies
    })
    if (success) {
      setCreateOpen(false)
      form.reset()
      setServiceSupplies([])
    }
  }

  const handleEdit = async (data: ServiceFormData) => {
    if (!editService) return
    const success = await updateService(editService.id, {
      ...data,
      supplies: serviceSupplies
    })
    if (success) {
      setEditService(null)
      form.reset()
      setServiceSupplies([])
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
    setServiceSupplies([...serviceSupplies, { supply_id: '', quantity: 1 }])
  }

  const removeSupply = (index: number) => {
    setServiceSupplies(serviceSupplies.filter((_, i) => i !== index))
  }

  const updateSupply = (index: number, field: 'supply_id' | 'quantity', value: any) => {
    const updated = [...serviceSupplies]
    updated[index] = { ...updated[index], [field]: value }
    setServiceSupplies(updated)
  }

  // Calculate variable cost
  const calculateVariableCost = () => {
    return serviceSupplies.reduce((total, ss) => {
      const supply = supplies.find(s => s.id === ss.supply_id)
      if (supply) {
        return total + (supply.cost_per_unit_cents * ss.quantity)
      }
      return total
    }, 0)
  }

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
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('add_service')}
              </Button>
            </div>
          }
        />

        <ServicesTable
          services={services}
          loading={loading}
          onManageSupplies={handleManageSupplies}
          onEdit={handleEditService}
          onDelete={handleDeleteService}
        />

        {/* Create Modal */}
        <FormModal
          open={createOpen}
          onOpenChange={setCreateOpen}
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
            t={t}
          />
        </FormModal>

        {/* Edit Modal */}
        <FormModal
          open={!!editService}
          onOpenChange={(open) => !open && setEditService(null)}
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
            variableCost={calculateVariableCost()}
            t={t}
          />
        </FormModal>

        {/* Category Modal */}
        <CategoryModal
          open={categoryModalOpen}
          onOpenChange={setCategoryModalOpen}
          categories={categories}
          onCreateCategory={createCategory}
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