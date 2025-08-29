'use client'

import { useState } from 'react'
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
import { useTreatments } from '@/hooks/use-treatments'
import { formatCurrency } from '@/lib/money'
import { formatDate } from '@/lib/format'
import { Calendar, User, DollarSign, FileText, Activity, Clock, Plus } from 'lucide-react'

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
  const { currentClinic } = useCurrentClinic()
  const {
    treatments,
    patients,
    services,
    loading,
    summary,
    createTreatment,
    updateTreatment,
    deleteTreatment
  } = useTreatments({ clinicId: currentClinic?.id })

  // Modal states
  const [createOpen, setCreateOpen] = useState(false)
  const [editTreatment, setEditTreatment] = useState<any>(null)
  const [deleteTreatmentData, setDeleteTreatmentData] = useState<any>(null)

  // Form
  const form = useForm<TreatmentFormData>({
    resolver: zodResolver(treatmentFormSchema),
    defaultValues: {
      patient_id: '',
      service_id: '',
      treatment_date: new Date().toISOString().split('T')[0],
      minutes: 30,
      margin_pct: 60,
      status: 'pending',
      notes: '',
    },
  })

  // Submit handlers
  const handleCreate = async (data: TreatmentFormData) => {
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
    form.setValue('service_id', serviceId)
    const service = services.find(s => s.id === serviceId)
    if (service && service.est_minutes) {
      form.setValue('minutes', service.est_minutes)
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
      render: (treatment: any) => {
        const patient = patients.find(p => p.id === treatment.patient_id)
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
      render: (treatment: any) => {
        const service = services.find(s => s.id === treatment.service_id)
        return service?.name || t('common.notAvailable')
      }
    },
    {
      key: 'duration',
      label: t('treatments.fields.duration'),
      render: (treatment: any) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {treatment.minutes} {t('common.minutes')}
        </div>
      )
    },
    {
      key: 'price',
      label: t('treatments.fields.price'),
      render: (treatment: any) => (
        <div className="text-right font-semibold">
          {formatCurrency(treatment.price_cents)}
        </div>
      )
    },
    {
      key: 'status',
      label: t('treatments.fields.status'),
      render: (treatment: any) => {
        const statusColors: Record<string, string> = {
          pending: 'warning',
          completed: 'success',
          cancelled: 'destructive'
        }
        return (
          <Badge variant={statusColors[treatment.status] as any}>
            {t(`treatments.status.${treatment.status}`)}
          </Badge>
        )
      }
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (treatment: any) => (
        <ActionDropdown
          actions={[
            createEditAction(() => {
              form.reset({
                patient_id: treatment.patient_id,
                service_id: treatment.service_id,
                treatment_date: treatment.treatment_date,
                minutes: treatment.minutes,
                margin_pct: treatment.margin_pct,
                status: treatment.status,
                notes: treatment.notes || '',
              })
              setEditTreatment(treatment)
            }),
            createDeleteAction(() => setDeleteTreatmentData(treatment))
          ]}
        />
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

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <PageHeader
          title={t('treatments.title')}
          subtitle={t('treatments.subtitle')}
          actions={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('treatments.addTreatment')}
            </Button>
          }
        />

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
          onOpenChange={setCreateOpen}
          title={t('treatments.newTreatment')}
          onSubmit={form.handleSubmit(handleCreate)}
          maxWidth="2xl"
        >
          <TreatmentForm 
            form={form} 
            patients={patientOptions}
            services={serviceOptions}
            statusOptions={statusFormOptions}
            onServiceChange={handleServiceChange}
            t={t}
          />
        </FormModal>

        {/* Edit Modal */}
        <FormModal
          open={!!editTreatment}
          onOpenChange={(open) => !open && setEditTreatment(null)}
          title={t('treatments.editTreatment')}
          onSubmit={form.handleSubmit(handleEdit)}
          maxWidth="2xl"
        >
          <TreatmentForm 
            form={form} 
            patients={patientOptions}
            services={serviceOptions}
            statusOptions={statusFormOptions}
            onServiceChange={handleServiceChange}
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