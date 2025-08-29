'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AppLayout } from '@/components/layouts/AppLayout'
import { useModalCleanup } from '@/hooks/use-modal-cleanup'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { FormModal } from '@/components/ui/form-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown'
import { PatientForm } from './components/PatientForm'
import { PatientDetails } from './components/PatientDetails'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { usePatients } from '@/hooks/use-patients'
import { formatDate } from '@/lib/format'
import { zPatientForm, ZPatientForm } from '@/lib/zod'
import { Patient } from '@/lib/types'
import { Users, Phone, Mail, Calendar, MapPin, Plus, User, Eye } from 'lucide-react'

export default function PatientsPage() {
  const t = useTranslations('patients')
  const { currentClinic } = useCurrentClinic()
  const {
    patients,
    patientSources,
    campaigns,
    loading,
    searchTerm,
    createPatient,
    updatePatient,
    deletePatient,
    searchPatients
  } = usePatients({ clinicId: currentClinic?.id })

  // Helper function to get patient initials
  const getInitials = (firstName: string | null | undefined, lastName: string | null | undefined) => {
    const firstInitial = firstName && firstName.length > 0 ? firstName.charAt(0) : ''
    const lastInitial = lastName && lastName.length > 0 ? lastName.charAt(0) : ''
    return firstInitial + lastInitial
  }

  // Modal states
  const [createOpen, setCreateOpen] = useState(false)
  const [editPatient, setEditPatient] = useState<Patient | null>(null)
  const [viewPatient, setViewPatient] = useState<Patient | null>(null)
  const [deletePatientData, setDeletePatientData] = useState<Patient | null>(null)
  
  // Use modal cleanup hook for all modals to prevent scroll lock on mobile
  useModalCleanup(createOpen)
  useModalCleanup(!!editPatient)
  useModalCleanup(!!viewPatient)
  useModalCleanup(!!deletePatientData)

  // Form
  const form = useForm<ZPatientForm>({
    resolver: zodResolver(zPatientForm),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      birth_date: '',
      first_visit_date: '',
      gender: '',
      address: '',
      city: '',
      postal_code: '',
      notes: '',
      source_id: '',
      referred_by_patient_id: '',
      campaign_id: ''
    }
  })

  // Submit handlers
  const handleCreate = async (data: ZPatientForm) => {
    const success = await createPatient(data)
    if (success) {
      setCreateOpen(false)
      form.reset()
    }
  }

  const handleEdit = async (data: ZPatientForm) => {
    if (!editPatient) return
    const success = await updatePatient(editPatient.id, data)
    if (success) {
      setEditPatient(null)
      form.reset()
    }
  }

  const handleDelete = async () => {
    if (!deletePatientData) return
    const success = await deletePatient(deletePatientData.id)
    if (success) {
      // Use setTimeout to ensure modal cleanup completes before resetting state
      setTimeout(() => {
        setDeletePatientData(null)
        // Force cleanup of any stuck body styles on mobile
        if (typeof document !== 'undefined') {
          document.body.style.removeProperty('overflow')
          document.body.style.removeProperty('pointer-events')
          document.documentElement.style.removeProperty('overflow')
        }
      }, 100)
    }
  }

  // Handler para crear nueva fuente de paciente
  const handleCreatePatientSource = async (data: any) => {
    try {
      const response = await fetch('/api/patient-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          clinic_id: currentClinic?.id
        })
      })
      
      if (!response.ok) throw new Error('Failed to create patient source')
      
      const newSource = await response.json()
      
      // Actualizar la lista de fuentes
      setPatientSources([...patientSources, newSource])
      
      return {
        value: newSource.id,
        label: newSource.name
      }
    } catch (error) {
      console.error('Error creating patient source:', error)
      throw error
    }
  }

  // Handler para crear nueva campaña
  const handleCreateCampaign = async (data: any) => {
    try {
      const response = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          clinic_id: currentClinic?.id,
          budget_cents: Math.round((parseFloat(data.budget_cents) || 0) * 100)
        })
      })
      
      if (!response.ok) throw new Error('Failed to create campaign')
      
      const newCampaign = await response.json()
      
      // Actualizar la lista de campañas
      setCampaigns([...campaigns, newCampaign])
      
      return {
        value: newCampaign.id,
        label: newCampaign.name
      }
    } catch (error) {
      console.error('Error creating campaign:', error)
      throw error
    }
  }

  // Table columns
  const columns = [
    {
      key: '_patient_info', // Use underscore prefix for custom columns
      label: t('fields.name'),
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        return (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-medium">
              {getInitials(patient.first_name, patient.last_name)}
            </div>
            <div>
              <div className="font-medium">
                {patient.first_name} {patient.last_name}
              </div>
              {patient.email && (
                <div className="text-sm text-muted-foreground">{patient.email}</div>
              )}
            </div>
          </div>
        )
      }
    },
    {
      key: '_contact_info', // Use underscore prefix for custom columns
      label: t('fields.contact'),
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        return (
          <div className="space-y-1">
            {patient.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3 w-3 text-muted-foreground" />
                {patient.phone}
              </div>
            )}
            {patient.city && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {patient.city}
              </div>
            )}
          </div>
        )
      }
    },
    {
      key: '_dates_info', // Use underscore prefix for custom columns
      label: t('fields.dates'),
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        return (
          <div className="space-y-1 text-sm">
            {patient.first_visit_date && (
              <div>
                <span className="text-muted-foreground">{t('fields.first_visit')}:</span>{' '}
                {formatDate(patient.first_visit_date)}
              </div>
            )}
            {patient.birth_date && (
              <div className="text-muted-foreground">
                {t('fields.birth_date')}: {formatDate(patient.birth_date)}
              </div>
            )}
          </div>
        )
      }
    },
    {
      key: '_source_info', // Use underscore prefix for custom columns
      label: t('fields.source'),
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        if (patient.source) {
          return <Badge variant="outline">{patient.source.name}</Badge>
        }
        return null
      }
    },
    {
      key: '_actions', // Use underscore prefix for custom columns
      label: t('actions'),
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        return (
          <ActionDropdown
            actions={[
              {
                label: t('view'),
                icon: <Eye className="h-4 w-4" />,
                onClick: () => setViewPatient(patient)
              },
              createEditAction(() => {
                form.reset({
                  first_name: patient.first_name,
                  last_name: patient.last_name,
                  email: patient.email || '',
                  phone: patient.phone || '',
                  birth_date: patient.birth_date || '',
                  first_visit_date: patient.first_visit_date || '',
                  gender: patient.gender || '',
                  address: patient.address || '',
                  city: patient.city || '',
                  postal_code: patient.postal_code || '',
                  notes: patient.notes || '',
                  source_id: patient.source_id || '',
                  referred_by_patient_id: patient.referred_by_patient_id || '',
                  campaign_id: patient.campaign_id || ''
                })
                setEditPatient(patient)
              }),
              createDeleteAction(() => setDeletePatientData(patient))
            ]}
          />
        )
      }
    }
  ]

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          actions={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('add_patient')}
            </Button>
          }
        />

        <DataTable
          columns={columns}
          data={patients || []}
          loading={loading}
          searchPlaceholder={t('search_patients')}
          onSearch={searchPatients}
          emptyState={{
            icon: Users,
            title: t('no_patients'),
            description: t('no_patients_description')
          }}
        />

        {/* Create Modal */}
        <FormModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          title={t('create_patient')}
          onSubmit={form.handleSubmit(handleCreate)}
          maxWidth="2xl"
        >
          <PatientForm
            form={form}
            patientSources={patientSources}
            campaigns={campaigns}
            patients={patients}
            t={t}
            onCreatePatientSource={handleCreatePatientSource}
            onCreateCampaign={handleCreateCampaign}
          />
        </FormModal>

        {/* Edit Modal */}
        <FormModal
          open={!!editPatient}
          onOpenChange={(open) => !open && setEditPatient(null)}
          title={t('edit_patient')}
          onSubmit={form.handleSubmit(handleEdit)}
          maxWidth="2xl"
        >
          <PatientForm
            form={form}
            patientSources={patientSources}
            campaigns={campaigns}
            patients={patients}
            t={t}
            onCreatePatientSource={handleCreatePatientSource}
            onCreateCampaign={handleCreateCampaign}
          />
        </FormModal>

        {/* View Modal */}
        <FormModal
          open={!!viewPatient}
          onOpenChange={(open) => !open && setViewPatient(null)}
          title={t('patient_details')}
          showFooter={false}
          maxWidth="lg"
        >
          {viewPatient && <PatientDetails patient={viewPatient} t={t} />}
        </FormModal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deletePatientData}
          onOpenChange={(open) => !open && setDeletePatientData(null)}
          title={t('delete_patient')}
          description={deletePatientData ? t('delete_patient_confirm', {
            name: `${deletePatientData.first_name} ${deletePatientData.last_name}`
          }) : ''}
          onConfirm={handleDelete}
          variant="destructive"
        />
      </div>
    </AppLayout>
  )
}