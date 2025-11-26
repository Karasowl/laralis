'use client' 

import { useState, useEffect, useMemo } from 'react' 
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
// import { useModalCleanup } from '@/hooks/use-modal-cleanup'
import { SimpleCrudPage } from '@/components/ui/crud-page-layout'
import { FormModal } from '@/components/ui/form-modal'
// import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown'
import { PatientFormUnified } from './components/PatientFormUnified'
import { PatientDetails } from './components/PatientDetails'
import { useWorkspace } from '@/contexts/workspace-context'
import { usePatients } from '@/hooks/use-patients' 
import { useTreatments } from '@/hooks/use-treatments'
import { formatDate, formatCurrency } from '@/lib/format' 
import { getLocalDateISO } from '@/lib/utils' 
import { zPatientForm, ZPatientForm } from '@/lib/zod'
import { Patient } from '@/lib/types'
import { Users, Phone, Mail, Calendar, MapPin, Plus, User, Eye, MessageCircle, FileText } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PatientsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('patients')
  const tFields = useTranslations('fields')
  const tCommon = useTranslations('common')
  const tg = useTranslations()
  const tEntities = useTranslations('entities')
  const todayIso = getLocalDateISO()
  const { currentClinic } = useWorkspace()
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

  // Load treatments to compute per-patient stats (visits, treatments, spent)
  const { treatments = [], loading: treatmentsLoading } = useTreatments({ clinicId: currentClinic?.id }) as any

  const statsByPatient = useMemo(() => {
    const visitsMap = new Map<string, Set<string>>()
    const out = new Map<string, { visits: number; treatments: number; spent_cents: number }>()
    ;(treatments || []).forEach((t: any) => {
      if (!t || t.status === 'cancelled') return
      const pid = t.patient_id
      if (!pid) return
      let entry = out.get(pid)
      if (!entry) { entry = { visits: 0, treatments: 0, spent_cents: 0 }; out.set(pid, entry) }
      entry.treatments += 1
      if (t.status === 'completed') entry.spent_cents += t.price_cents || 0
      const day = (t.treatment_date || '').slice(0, 10)
      if (day) {
        let set = visitsMap.get(pid)
        if (!set) { set = new Set<string>(); visitsMap.set(pid, set) }
        set.add(day)
      }
    })
    visitsMap.forEach((set, pid) => {
      const entry = out.get(pid) || { visits: 0, treatments: 0, spent_cents: 0 }
      entry.visits = set.size
      out.set(pid, entry)
    })
    return out
  }, [treatments])

  // Helper function to get patient initials
  const getInitials = (firstName: string | null | undefined, lastName: string | null | undefined) => {
    const firstInitial = firstName && firstName.length > 0 ? firstName.charAt(0) : ''
    const lastInitial = lastName && lastName.length > 0 ? lastName.charAt(0) : ''
    return firstInitial + lastInitial
  }

  // Phone helpers for tel: and WhatsApp links
  const getTelHref = (phone: string) => {
    if (!phone) return '#'
    const cleaned = String(phone).trim().replace(/[^\d+]/g, '')
    const href = cleaned.startsWith('+') ? cleaned : `+${cleaned}`
    return `tel:${href}`
  }

  const getWhatsAppHref = (phone: string, message?: string) => {
    if (!phone) return '#'
    const digits = String(phone).replace(/\D/g, '')
    const text = message ? `?text=${encodeURIComponent(message)}` : ''
    return `https://wa.me/${digits}${text}`
  }

  // Modal states
  const [createOpen, setCreateOpen] = useState(false)
  const [editPatient, setEditPatient] = useState<Patient | null>(null)
  const [viewPatient, setViewPatient] = useState<Patient | null>(null)
  const [deletePatientData, setDeletePatientData] = useState<Patient | null>(null)
  
  // Modal cleanup disabled to avoid interference with Radix scroll-lock

  // Form
  const initialValues: ZPatientForm = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: todayIso,
    first_visit_date: todayIso,
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
    defaultValues: initialValues,
    mode: 'onBlur', // PERFORMANCE: Validate only on blur
  })

  // Load related data (sources, campaigns, platforms) on mount/clinic change
  useEffect(() => {
    console.log('useEffect triggered. Clinic:', currentClinic)
    if (currentClinic?.id) {
      console.log('Loading related data for clinic:', currentClinic.id)
      loadRelatedData().then(() => {
        console.log('loadRelatedData completed')
      }).catch(err => {
        console.error('Error loading related data:', err)
      })
    } else {
      console.log('No clinic ID, skipping loadRelatedData')
    }
  }, [currentClinic?.id, loadRelatedData])

  // Ensure lists are fresh when opening the create modal
  useEffect(() => {
    if (createOpen) {
      loadRelatedData().catch(() => {})
    }
  }, [createOpen, loadRelatedData])

  // Open "view" modal when navigated with ?view_id=...
  useEffect(() => {
    const id = searchParams?.get('view_id')
    if (!id || !patients || patients.length === 0) return
    const p = patients.find((x: any) => x.id === id)
    if (p) setViewPatient(p)
  }, [searchParams, patients])
  
  // Debug disabled

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
          <div>
            <div className="font-medium">
              {patient.first_name} {patient.last_name}
            </div>
            {patient.email && (
              <div className="text-sm text-muted-foreground hidden lg:block">{patient.email}</div>
            )}
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
                <span className="inline-flex items-center gap-1">
                  <a
                    href={getTelHref(patient.phone)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    aria-label={tg('actions.call')}
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                  <a
                    href={getWhatsAppHref(
                      patient.phone,
                      `Hola ${`${patient.first_name || ''} ${patient.last_name || ''}`.trim()}${currentClinic?.name ? `, te escribe ${currentClinic.name}.` : ''}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                </span>
              </div>
            )}
          </div>
        )
      }
    },
    {
      key: '_treatments_total',
      label: tg('treatments.title'),
      className: 'text-center',
      render: (_value: any, patient: Patient) => {
        const stats = statsByPatient.get(patient.id)
        const count = stats?.treatments ?? 0
        return (
          <div className="text-sm font-medium">
            <span className="md:hidden text-muted-foreground mr-1">{t('activity.treatments')}:</span>
            <span>{count}</span>
          </div>
        )
      }
    },
    {
      key: '_spent_total',
      label: t('activity.spent'),
      className: 'text-right whitespace-nowrap',
      render: (_value: any, patient: Patient) => {
        const stats = statsByPatient.get(patient.id)
        const amount = formatCurrency(stats?.spent_cents ?? 0)
        return (
          <div className="text-sm text-foreground/90 text-right">
            <span className="md:hidden text-muted-foreground mr-1">{t('activity.spent')}:</span>
            <span>{amount}</span>
          </div>
        )
      }
    },
    {
      key: '_dates_info', // Use underscore prefix for custom columns
      label: tFields('dates'),
      className: 'hidden xl:table-cell',
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
      // Hide on tablet (md) to avoid horizontal scroll; show from lg and up
      className: 'hidden lg:table-cell',
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        if (patient.source) {
          return <Badge variant="outline">{patient.source.name}</Badge>
        }
        return null
      }
    },
    {
      // Use the standard "actions" key so CrudPageLayout doesn't auto-add a duplicate
      key: 'actions',
      label: tCommon('actions'),
      // Keep the column compact and right-aligned on larger screens
      className: 'text-right',
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        return (
          <div className="md:flex md:justify-end">
            <ActionDropdown
              actions={[
                {
                  label: tg('actions.view'),
                  icon: <Eye className="h-4 w-4" />,
                  // Open after the dropdown closes to avoid Radix outside-click race
                  onClick: () => setTimeout(() => setViewPatient(patient), 0),
                },
                {
                  label: t('treatment_history'),
                  icon: <FileText className="h-4 w-4" />,
                  onClick: () => setTimeout(() => router.push(`/treatments?patient_id=${patient.id}`), 0),
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
                  // Delay opening to avoid immediate close when triggered from DropdownMenu
                  setTimeout(() => setEditPatient(patient), 0)
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
  const openCreate = () => {
    if (!currentClinic?.id) {
      // Si no hay clínica, ir a la configuración para crear una
      try { window.location.assign('/settings/workspaces') } catch {}
      return
    }
    form.reset(initialValues); setCreateOpen(true)
  }
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
      mobileColumns={[
        columns[0],
        columns[1],
        {
          key: '_mobile_summary',
          label: '',
          render: (_: any, patient: Patient) => {
            const stats = statsByPatient.get(patient.id)
            const count = stats?.treatments ?? 0
            const amount = formatCurrency(stats?.spent_cents ?? 0)
            return (
              <div className="text-sm text-muted-foreground">
                <span className="mr-1">{t('activity.treatments')}:</span>
                <span className="text-foreground font-medium mr-2">{count}</span>
                <span className="text-muted-foreground">•</span>
                <span className="ml-2 text-foreground/90">{amount}</span>
              </div>
            )
          }
        },
        columns[columns.length - 1]
      ]}
      emptyIcon={<Users className="h-8 w-8" />}
      searchable={true}
    >
      {/* Create Modal (Responsive) */}
      <FormModal
        open={createOpen}
        onOpenChange={(open) => {
          if (open !== createOpen) setCreateOpen(open)
          if (!open) form.reset(initialValues)
        }}
        modal={true}
        title={t('create_patient')}
        description={t('formDescription')}
        onSubmit={form.handleSubmit(handleCreate)}
        cancelLabel={tCommon('cancel')}
        submitLabel={tCommon('save')}
        maxWidth="2xl"
      >
        <PatientFormUnified
          form={form}
          campaigns={campaigns}
          platforms={platforms}
          patients={patients}
          patientSources={patientSources}
          t={t}
          onCreateCampaign={handleCreateCampaign}
        />
      </FormModal>

      {/* Edit Modal */}
      <FormModal
        open={!!editPatient}
        onOpenChange={(open) => { if (!open) setEditPatient(null) }}
        modal={true}
        title={t('edit_patient')}
        onSubmit={form.handleSubmit(handleEdit)}
        maxWidth="2xl"
      >
        <PatientFormUnified
          form={form}
          campaigns={campaigns}
          platforms={platforms}
          patients={patients}
          patientSources={patientSources}
          t={t}
          onCreateCampaign={handleCreateCampaign}
        />
      </FormModal>

      {/* View Modal */}
      <FormModal
        open={!!viewPatient}
        onOpenChange={(open) => { if (!open) setViewPatient(null) }}
        modal={true}
        title={t('patient_details')}
        showFooter={false}
        maxWidth="lg"
      >
        {viewPatient && (
          <PatientDetails
            patient={viewPatient}
            t={tg}
            stats={{
              treatments: statsByPatient.get(viewPatient.id)?.treatments ?? 0,
              spent_cents: statsByPatient.get(viewPatient.id)?.spent_cents ?? 0,
              visits: statsByPatient.get(viewPatient.id)?.visits ?? 0,
            }}
          />
        )}
      </FormModal>
    </SimpleCrudPage>
  )
}
