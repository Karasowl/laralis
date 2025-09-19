'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { FormModal } from '@/components/ui/form-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown'
import { SummaryCards } from '@/components/ui/summary-cards'
import { TreatmentForm } from './components/TreatmentForm'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { useRequirementsGuard } from '@/lib/requirements/useGuard'
import { toast } from 'sonner'
import { useTreatments } from '@/hooks/use-treatments'
import { formatCurrency } from '@/lib/money'
import { formatDate } from '@/lib/format'
import { Calendar, User, DollarSign, FileText, Activity, Clock, Plus } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// Treatment form schema
const treatmentFormSchema = z.object({
  patient_id: z.string().min(1),
  service_id: z.string().min(1),
  treatment_date: z.string().min(1),
  minutes: z.number().min(1),
  margin_pct: z.number().min(0).max(100),
  status: z.enum(['pending', 'completed', 'cancelled']),
  notes: z.string().optional(),
})

type TreatmentFormData = z.infer<typeof treatmentFormSchema>

const statusOptions = [
  { value: 'pending', label: 'treatments.status.pending' },
  { value: 'completed', label: 'treatments.status.completed' },
  { value: 'cancelled', label: 'treatments.status.cancelled' },
]

export default function TreatmentsPage() {
  const t = useTranslations()
  const tCommon = useTranslations('common')
  const { currentClinic } = useCurrentClinic()
  const searchParams = useSearchParams()
  const patientFilter = searchParams?.get('patient_id') || searchParams?.get('patient') || ''
  const {
    treatments,
    patients,
    services,
    loading,
    isSubmitting,
    summary,
    createTreatment,
    updateTreatment,
    deleteTreatment,
    loadRelatedData
  } = useTreatments({ clinicId: currentClinic?.id, patientId: patientFilter || undefined })

  // Keep a ref of services to use immediately after refresh
  const servicesRef = useRef(services as any[])
  useEffect(() => { servicesRef.current = services as any[] }, [services])

  const filteredPatient = (patients || []).find(p => p.id === patientFilter)
  const filteredCount = (treatments || []).length

  // Modal states
  const [createOpen, setCreateOpen] = useState(false)
  const [editTreatment, setEditTreatment] = useState<any>(null)
  const [deleteTreatmentData, setDeleteTreatmentData] = useState<any>(null)

  // Form
  const treatmentInitialValues: TreatmentFormData = {
    patient_id: '',
    service_id: '',
    treatment_date: new Date().toISOString().split('T')[0],
    minutes: 30,
    margin_pct: 60,
    status: 'pending',
    notes: '',
  }

  const form = useForm<TreatmentFormData>({
    resolver: zodResolver(treatmentFormSchema),
    defaultValues: treatmentInitialValues,
  })

  // Guard: ensure financial prerequisites before creating treatment
  const { ensureReady } = useRequirementsGuard(() => ({
    clinicId: currentClinic?.id as string
  }))
  const [missingReqs, setMissingReqs] = useState<string[]>([])

  // Submit handlers
  const handleCreate = async (data: TreatmentFormData) => {
    // Just-in-time guard: check tariffs and prerequisites for the selected service
    const ready = await ensureReady('create_treatment', { serviceId: data.service_id })
    if (!ready.allowed) {
      toast.warning(t('onboarding.justInTime.title'))
      setMissingReqs(ready.missing as any)
      return
    }
    setMissingReqs([])
    const success = await createTreatment(data)
    if (success) {
      setCreateOpen(false)
      form.reset()
    }
  }

  const handleEdit = async (data: TreatmentFormData) => {
    if (!editTreatment) return
    const success = await updateTreatment(editTreatment.id, data, editTreatment)
    if (success) {
      setEditTreatment(null)
      form.reset()
    }
  }

  const handleDelete = async () => {
    if (!deleteTreatmentData) return
    const success = await deleteTreatment(deleteTreatmentData.id)
    if (success) {
      setDeleteTreatmentData(null)
    }
  }

  // Handle service change to update estimated minutes
  const handleServiceChange = (serviceId: string) => {
    form.setValue('service_id', serviceId, { shouldDirty: true, shouldTouch: true, shouldValidate: true })
    const service = services.find(s => s.id === serviceId)
    if (service && service.est_minutes) {
      form.setValue('minutes', service.est_minutes, { shouldDirty: true })
    }
  }

  // When a new service is created from the wizard, refresh lists and set defaults
  const handleServiceCreated = async (opt: { value: string; label: string }) => {
    try {
      await loadRelatedData()
    } catch {}
    // Select the new service and set minutes if available
    form.setValue('service_id', opt.value)
    const svcList = (servicesRef as any).current || services
    const svc = svcList.find((s: any) => s.id === opt.value)
    if (svc?.est_minutes) {
      form.setValue('minutes', svc.est_minutes)
    }
  }

  // Table columns
  const columns = [
    {
      key: 'treatment_date',
      label: t('treatments.fields.date'),
      render: (treatment: any) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {formatDate(treatment.treatment_date)}
        </div>
      )
    },
    {
      key: 'patient',
      label: t('treatments.fields.patient'),
      render: (_value: any, treatment: any) => {
        const patient = patients.find(p => p.id === treatment?.patient_id)
        return (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            {patient ? `${patient.first_name} ${patient.last_name}` : t('common.notAvailable')}
          </div>
        )
      }
    },
    {
      key: 'service',
      label: t('treatments.fields.service'),
      render: (_value: any, treatment: any) => {
        const service = services.find(s => s.id === treatment?.service_id)
        return service?.name || t('common.notAvailable')
      }
    },
    {
      key: 'minutes',
      label: t('treatments.fields.duration'),
      render: (value: any) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {value ?? 0} {t('common.minutes')}
        </div>
      )
    },
    {
      key: 'price',
      label: t('treatments.fields.price'),
      render: (_value: any, treatment: any) => (
        <div className="text-right font-semibold">
          {formatCurrency(treatment?.price_cents || 0)}
        </div>
      )
    },
    {
      key: 'status',
      label: t('treatments.fields.status'),
      render: (_value: any, treatment: any) => (
        <InlineStatusMenu
          value={treatment?.status || 'pending'}
          onChange={async (next) => {
            await updateTreatment(treatment.id, { status: next }, treatment)
          }}
          t={t}
        />
      )
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (_value: any, treatment: any) => (
        <div className="md:flex md:justify-end">
          <ActionDropdown
            actions={[
            createEditAction(() => {
              form.reset({
                patient_id: treatment?.patient_id || '',
                service_id: treatment?.service_id || '',
                treatment_date: treatment?.treatment_date || new Date().toISOString().split('T')[0],
                minutes: treatment?.minutes ?? 30,
                margin_pct: treatment?.margin_pct ?? 60,
                status: treatment?.status || 'pending',
                notes: treatment?.notes || '',
              })
              setEditTreatment(treatment)
            }, tCommon('edit')),
            createDeleteAction(() => setDeleteTreatmentData(treatment), tCommon('delete'))
          ]}
          />
        </div>
      )
    }
  ]

  // Form options
  const patientOptions = patients.map(patient => ({
    value: patient.id,
    label: `${patient.first_name} ${patient.last_name}`
  }))

  const serviceOptions = services.map(service => ({
    value: service.id,
    label: service.name
  }))

  const statusFormOptions = statusOptions.map(status => ({
    value: status.value,
    label: t(status.label)
  }))

  // Handlers para crear paciente y servicio rápido
  const handleCreatePatient = async (data: any) => {
    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          clinic_id: currentClinic?.id
        })
      })
      
      if (!response.ok) throw new Error('Failed to create patient')
      
      const payload = await response.json()
      const newPatient = payload?.data || payload
      
      // Refrescar la lista de pacientes
      await loadRelatedData()
      
      return { 
        value: newPatient.id, 
        label: `${newPatient.first_name} ${newPatient.last_name}` 
      }
    } catch (error) {
      console.error('Error creating patient:', error)
      throw error
    }
  }

  const handleCreateService = async (data: any) => {
    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data?.name,
          est_minutes: Number(data?.duration_minutes || data?.est_minutes || 0),
          description: data?.description || undefined,
          category: data?.category || undefined,
          clinic_id: currentClinic?.id
        })
      })
      
      if (!response.ok) throw new Error('Failed to create service')
      
      const payload = await response.json()
      const newService = payload?.data || payload
      
      // Refrescar la lista de servicios
      await loadRelatedData()
      
      return { 
        value: newService.id, 
        label: newService.name 
      }
    } catch (error) {
      console.error('Error creating service:', error)
      throw error
    }
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6">
        <PageHeader
          title={t('treatments.title')}
          subtitle={t('treatments.subtitle')}
          actions={
            <Button 
              onClick={() => { form.reset({ ...treatmentInitialValues, patient_id: patientFilter || '' }); setCreateOpen(true) }}
              className="whitespace-nowrap"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('treatments.addTreatment')}</span>
              <span className="sm:hidden">{t('common.add')}</span>
            </Button>
          }
        />

        {filteredPatient && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg bg-muted/40">
            <div className="text-sm">
              <span className="block sm:inline">{t('treatments.showingTreatmentsFor')}</span>
              <span className="font-semibold"> {filteredPatient.first_name} {filteredPatient.last_name}</span>
              <span className="text-muted-foreground"> — {filteredCount}</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={() => window.location.assign(`/patients?view_id=${filteredPatient.id}`)}
                className="flex-1 sm:flex-none text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">{t('treatments.viewPatient')}</span>
                <span className="sm:hidden">{t('patients.patient')}</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.assign('/treatments')}
                className="flex-1 sm:flex-none text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">{t('treatments.removeFilter')}</span>
                <span className="sm:hidden">{t('common.remove')}</span>
              </Button>
            </div>
          </div>
        )}

        <SummaryCards
          cards={[
            {
              label: t('treatments.summary.totalRevenue'),
              value: formatCurrency(summary.totalRevenue),
              subtitle: t('treatments.summary.allTreatments'),
              icon: DollarSign,
              color: 'primary'
            },
            {
              label: t('treatments.summary.totalTreatments'),
              value: summary.totalTreatments.toString(),
              subtitle: t('treatments.summary.registered'),
              icon: FileText,
              color: 'success'
            },
            {
              label: t('treatments.summary.completionRate'),
              value: `${summary.completionRate.toFixed(1)}%`,
              subtitle: `${summary.completedTreatments}/${summary.totalTreatments}`,
              icon: Activity,
              color: 'info'
            },
            {
              label: t('treatments.summary.averagePrice'),
              value: formatCurrency(summary.averagePrice),
              subtitle: t('treatments.summary.perTreatment'),
              icon: DollarSign,
              color: 'warning'
            },
          ]}
          columns={4}
        />

        <DataTable
          columns={columns}
          mobileColumns={[columns[0], columns[1], columns[5], columns[6]]}
          data={treatments}
          loading={loading}
          searchPlaceholder={t('treatments.searchPlaceholder')}
          emptyState={{
            icon: FileText,
            title: t('treatments.emptyTitle'),
            description: t('treatments.emptyDescription')
          }}
        />

        {/* Create Modal */}
        <FormModal
          open={createOpen}
          onOpenChange={(open) => { setCreateOpen(open); if (!open) form.reset(treatmentInitialValues) }}
          title={t('treatments.newTreatment')}
          onSubmit={form.handleSubmit(handleCreate)}
          isSubmitting={isSubmitting}
          maxWidth="2xl"
          modal={false}
        >
          {missingReqs.length > 0 && (
            <div className="mb-4 p-3 border rounded-md bg-amber-50 text-sm">
              <div className="font-medium mb-1">{t('onboarding.justInTime.title')}</div>
              <div className="mb-2">{t('onboarding.justInTime.missing')} {missingReqs.join(', ')}</div>
              <div className="flex flex-wrap gap-2">
                <a href="/time" className="underline text-blue-600">{t('time.title')}</a>
                <a href="/fixed-costs" className="underline text-blue-600">{t('fixedCosts.title')}</a>
                <a href="/services" className="underline text-blue-600">{t('services.title')}</a>
              </div>
            </div>
          )}
          <TreatmentForm 
            form={form} 
            patients={patientOptions}
            services={serviceOptions}
            statusOptions={statusFormOptions}
            onServiceChange={handleServiceChange}
            onCreatePatient={handleCreatePatient}
            onCreateService={handleCreateService}
            onServiceCreated={handleServiceCreated}
            t={t}
          />
        </FormModal>

        {/* Edit Modal */}
        <FormModal
          open={!!editTreatment}
          onOpenChange={(open) => !open && setEditTreatment(null)}
          title={t('treatments.editTreatment')}
          onSubmit={form.handleSubmit(handleEdit)}
          isSubmitting={isSubmitting}
          maxWidth="2xl"
          modal={false}
        >
          <TreatmentForm 
            form={form} 
            patients={patientOptions}
            services={serviceOptions}
            statusOptions={statusFormOptions}
            onServiceChange={handleServiceChange}
            onCreatePatient={handleCreatePatient}
            onCreateService={handleCreateService}
            onServiceCreated={handleServiceCreated}
            t={t}
          />
        </FormModal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deleteTreatmentData}
          onOpenChange={(open) => !open && setDeleteTreatmentData(null)}
          title={t('treatments.deleteTreatment')}
          description={t('treatments.deleteTreatmentConfirm')}
          onConfirm={handleDelete}
          variant="destructive"
        />
      </div>
    </AppLayout>
  )
}

function InlineStatusMenu({ value, onChange, t }: { value: 'pending' | 'completed' | 'cancelled'; onChange: (v: 'pending' | 'completed' | 'cancelled') => void | Promise<void>; t: any }) {
  const statusColors: Record<string, any> = {
    pending: 'warning',
    completed: 'success',
    cancelled: 'destructive'
  }
  const items: Array<{ v: 'pending' | 'completed' | 'cancelled' }> = [
    { v: 'pending' },
    { v: 'completed' },
    { v: 'cancelled' }
  ]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center">
          <Badge variant={statusColors[value] as any} className="cursor-pointer">
            {t(`treatments.status.${value}`)}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map(it => (
          <DropdownMenuItem key={it.v} onSelect={() => onChange(it.v)}>
            {t(`treatments.status.${it.v}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
