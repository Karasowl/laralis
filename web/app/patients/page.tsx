'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useModalCleanup } from '@/hooks/use-modal-cleanup'
import { SimpleCrudPage } from '@/components/ui/crud-page-layout'
import { FormModal } from '@/components/ui/form-modal'
import { Badge } from '@/components/ui/badge'
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown'
import { PatientFormUnified } from './components/PatientFormUnified'
import { PatientDetails } from './components/PatientDetails'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { usePatients } from '@/hooks/use-patients'
import { formatDate } from '@/lib/format'
import { zPatientForm, ZPatientForm } from '@/lib/zod'
import { Patient } from '@/lib/types'
import { Users, Phone, Mail, Calendar, MapPin, Plus, User, Eye } from 'lucide-react'

export default function PatientsPage() {
  const t = useTranslations('patients')
  const tFields = useTranslations('fields')
  const tCommon = useTranslations('common')
  const tg = useTranslations()
  const tEntities = useTranslations('entities')
  const { currentClinic } = useCurrentClinic()
  const {
    patients,
    patientSources,
    campaigns,
    platforms,
    loading,
    searchTerm,
    createPatient,
    updatePatient,
    deletePatient,
    searchPatients,
    loadRelatedData
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
  const initialValues: ZPatientForm = {
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
    referred_by_patient_id: '',
    campaign_id: '',
    platform_id: ''
  }

  const form = useForm<ZPatientForm>({
    resolver: zodResolver(zPatientForm),
    defaultValues: initialValues
  })

  // Load related data (sources, campaigns, platforms) on mount
  useEffect(() => {
    console.log('useEffect triggered. Clinic:', currentClinic)
    if (currentClinic?.id) {
      console.log('Loading related data for clinic:', currentClinic.id)
      
      // Test direct API call
      fetch('/api/marketing/platforms', {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => {
          console.log('Direct API call result:', data)
        })
        .catch(err => {
          console.error('Direct API call error:', err)
        })
      
      loadRelatedData().then(() => {
        console.log('loadRelatedData completed')
      }).catch(err => {
        console.error('Error loading related data:', err)
      })
    } else {
      console.log('No clinic ID, skipping loadRelatedData')
    }
  }, [currentClinic?.id])
  
  // Debug platforms
  useEffect(() => {
    console.log('=== PLATFORMS DEBUG ===')
    console.log('Current platforms:', platforms)
    console.log('Platforms length:', platforms?.length)
    console.log('======================')
  }, [platforms])

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
      
      // Refrescar la lista de fuentes
      await loadRelatedData()
      
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
        credentials: 'include',
        body: JSON.stringify({
          name: data.name,
          platform_id: data.platform_id,
          code: data.code || null
        })
      })
      
      if (!response.ok) throw new Error('Failed to create campaign')
      
      const { data: newCampaign } = await response.json()
      
      // Refrescar la lista de campañas
      await loadRelatedData()
      
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
      label: tFields('name'),
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
      label: tFields('contact'),
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
      label: tFields('dates'),
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        return (
          <div className="space-y-1 text-sm">
            {patient.first_visit_date && (
              <div>
                <span className="text-muted-foreground">{tFields('first_visit')}:</span>{' '}
                {formatDate(patient.first_visit_date)}
              </div>
            )}
            {patient.birth_date && (
              <div className="text-muted-foreground">
                {tFields('birth_date')}: {formatDate(patient.birth_date)}
              </div>
            )}
          </div>
        )
      }
    },
    {
      key: '_source_info', // Use underscore prefix for custom columns
      label: tFields('source'),
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
      label: tCommon('actions'),
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        return (
          <div className="md:flex md:justify-end">
            <ActionDropdown
              actions={[
              {
                label: tg('actions.view'),
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
                  referred_by_patient_id: patient.referred_by_patient_id || '',
                  campaign_id: patient.campaign_id || '',
                  platform_id: patient.platform_id || ''
                })
                setEditPatient(patient)
              }, tCommon('edit')),
              createDeleteAction(() => setDeletePatientData(patient), tCommon('delete'))
            ]}
            />
          </div>
        )
      }
    }
  ]

  // Handlers for SimpleCrudPage
  const openCreate = () => { form.reset(initialValues); setCreateOpen(true) }
  const openEdit = (patient: Patient) => {
    form.reset({
      first_name: patient.first_name || '',
      last_name: patient.last_name || '',
      email: patient.email || '',
      phone: patient.phone || '',
      birth_date: patient.birth_date || '',
      first_visit_date: patient.first_visit_date || '',
      gender: patient.gender || '',
      address: patient.address || '',
      city: patient.city || '',
      postal_code: patient.postal_code || '',
      notes: patient.notes || '',
      referred_by_patient_id: patient.referred_by_patient_id || '',
      campaign_id: patient.campaign_id || '',
      platform_id: patient.platform_id || ''
    })
    setEditPatient(patient)
  }

  return (
    <SimpleCrudPage
      title={t('title')}
      subtitle={t('subtitle')}
      entityName={tEntities('patient')}
      data={{
        items: patients || [],
        loading,
        searchTerm,
        onSearchChange: searchPatients,
        onAdd: openCreate,
        onEdit: openEdit,
        onDelete: (item) => setDeletePatientData(item as Patient),
        deleteConfirmOpen: !!deletePatientData,
        onDeleteConfirmChange: (open) => { if (!open) setDeletePatientData(null) },
        deletingItem: deletePatientData ? ({ ...deletePatientData, name: `${deletePatientData.first_name} ${deletePatientData.last_name}` } as any) : null,
        onDeleteConfirm: handleDelete,
      }}
      columns={columns}
      mobileColumns={[columns[0], columns[1], columns[4]]}
      emptyIcon={<Users className="h-8 w-8" />}
      searchable={true}
    >
      {/* Create Modal */}
      <FormModal
        open={createOpen}
        onOpenChange={(open) => { 
          setCreateOpen(open); 
          if (!open) form.reset(initialValues);
        }}
        title={t('create_patient')}
        onSubmit={form.handleSubmit(handleCreate)}
        maxWidth="2xl"
      >
        <PatientFormUnified
          form={form}
          campaigns={campaigns}
          platforms={platforms}
          patients={patients}
          t={t}
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
        <PatientFormUnified
          form={form}
          campaigns={campaigns}
          platforms={platforms}
          patients={patients}
          t={t}
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
    </SimpleCrudPage>
  )
}
