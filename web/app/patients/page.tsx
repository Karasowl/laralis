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
import { SmartFilters, useSmartFilter, FilterConfig, FilterValues } from '@/components/ui/smart-filters'
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

// Helper function to calculate age from birth date
const calculateAge = (birthDate: string | null | undefined): number | null => {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// Helper function to check if age falls within a range
const isAgeInRange = (age: number | null, range: string): boolean => {
  if (age === null) return false
  switch (range) {
    case '0-17': return age >= 0 && age <= 17
    case '18-30': return age >= 18 && age <= 30
    case '31-45': return age >= 31 && age <= 45
    case '46-60': return age >= 46 && age <= 60
    case '61+': return age >= 61
    default: return true
  }
}

export default function PatientsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('patients')
  const tFields = useTranslations('fields')
  const tCommon = useTranslations('common')
  const tg = useTranslations()
  const tEntities = useTranslations('entities')
  const tFilters = useTranslations('filters')
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

  // Filter state
  const [filterValues, setFilterValues] = useState<FilterValues>({
    source_id: [],
    gender: '',
    age_range: '',
    first_visit_date: { from: '', to: '' }
  })

  // Filter configurations
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      key: 'source_id',
      label: tFields('source'),
      type: 'multi-select',
      options: patientSources.map((s: any) => ({ value: s.id, label: s.name }))
    },
    {
      key: 'gender',
      label: tFilters('sex'),
      type: 'select',
      options: [
        { value: 'male', label: t('gender.male') },
        { value: 'female', label: t('gender.female') },
        { value: 'other', label: t('gender.other') }
      ]
    },
    {
      key: 'age_range',
      label: tFilters('ageRange'),
      type: 'select',
      options: [
        { value: '0-17', label: tFilters('ageRanges.minors') },
        { value: '18-30', label: tFilters('ageRanges.young') },
        { value: '31-45', label: tFilters('ageRanges.adults') },
        { value: '46-60', label: tFilters('ageRanges.mature') },
        { value: '61+', label: tFilters('ageRanges.seniors') }
      ]
    },
    {
      key: 'first_visit_date',
      label: tFields('first_visit'),
      type: 'date-range'
    }
  ], [tFields, tFilters, t, patientSources])

  // Apply standard filters to patients (excludes age_range which needs custom logic)
  const standardFilterConfigs = useMemo(() =>
    filterConfigs.filter(c => c.key !== 'age_range'),
    [filterConfigs]
  )
  const standardFiltered = useSmartFilter(patients || [], filterValues, standardFilterConfigs)

  // Apply age range filter (custom logic since age is calculated, not a direct field)
  const filteredPatients = useMemo(() => {
    const ageRange = filterValues.age_range
    if (!ageRange) return standardFiltered

    return standardFiltered.filter((patient: Patient) => {
      const age = calculateAge(patient.birth_date)
      // Patients without birth_date should NOT appear when age filter is active
      return isAgeInRange(age, ageRange)
    })
  }, [standardFiltered, filterValues.age_range])

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
      className: 'min-w-[140px]',
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        return (
          <div>
            <div className="font-medium text-sm lg:text-base whitespace-nowrap">
              {patient.first_name} {patient.last_name}
            </div>
            {patient.email && (
              <div className="text-xs lg:text-sm text-muted-foreground hidden xl:block truncate max-w-[200px]">{patient.email}</div>
            )}
          </div>
        )
      }
    },
    {
      key: '_contact_info', // Use underscore prefix for custom columns
      label: tFields('contact'),
      className: 'min-w-[100px]',
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        return (
          <div className="space-y-1">
            {patient.phone && (
              <div className="flex items-center gap-1 lg:gap-2 text-xs lg:text-sm">
                <span className="inline-flex items-center gap-0.5 lg:gap-1">
                  <a
                    href={getTelHref(patient.phone)}
                    className="inline-flex items-center justify-center h-7 w-7 lg:h-8 lg:w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    aria-label={tg('actions.call')}
                  >
                    <Phone className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                  </a>
                  <a
                    href={getWhatsAppHref(
                      patient.phone,
                      `Hola ${`${patient.first_name || ''} ${patient.last_name || ''}`.trim()}${currentClinic?.name ? `, te escribe ${currentClinic.name}.` : ''}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-7 w-7 lg:h-8 lg:w-8 rounded-md text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
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
      // Hide on tablet to give more space to essential columns
      className: 'text-center hidden lg:table-cell',
      render: (_value: any, patient: Patient) => {
        const stats = statsByPatient.get(patient.id)
        const count = stats?.treatments ?? 0
        return (
          <div className="text-xs lg:text-sm font-medium whitespace-nowrap">
            <span>{count}</span>
          </div>
        )
      }
    },
    {
      key: '_spent_total',
      label: t('activity.spent'),
      className: 'text-right whitespace-nowrap min-w-[80px]',
      render: (_value: any, patient: Patient) => {
        const stats = statsByPatient.get(patient.id)
        const amount = formatCurrency(stats?.spent_cents ?? 0)
        return (
          <div className="text-xs lg:text-sm text-foreground/90 text-right whitespace-nowrap">
            <span>{amount}</span>
          </div>
        )
      }
    },
    {
      key: '_dates_info', // Use underscore prefix for custom columns
      label: tFields('dates'),
      // Only show on xl screens to save space on tablet
      className: 'hidden xl:table-cell min-w-[140px]',
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        return (
          <div className="space-y-1 text-xs lg:text-sm">
            {patient.first_visit_date && (
              <div className="whitespace-nowrap">
                <span className="text-muted-foreground">{tFields('first_visit')}:</span>{' '}
                {formatDate(patient.first_visit_date)}
              </div>
            )}
            {patient.birth_date && (
              <div className="text-muted-foreground whitespace-nowrap">
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
      className: 'hidden lg:table-cell min-w-[100px]',
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;

        // Campaña publicitaria -> nombre de la campaña
        if (patient.campaign_id && patient.campaign?.name) {
          return <Badge variant="outline" className="text-xs whitespace-nowrap">{patient.campaign.name}</Badge>
        }

        // Referencia -> nombre de quien refirio
        if (patient.referred_by_patient_id && patient.referred_by) {
          const name = `${patient.referred_by.first_name} ${patient.referred_by.last_name}`
          return <Badge variant="outline" className="text-xs whitespace-nowrap">{name}</Badge>
        }

        // Redes organico -> nombre de la plataforma
        if (patient.platform_id && patient.platform) {
          return <Badge variant="outline" className="text-xs whitespace-nowrap">{patient.platform.display_name || patient.platform.name}</Badge>
        }

        // Directo (default)
        return <Badge variant="outline" className="text-xs whitespace-nowrap">{t('acquisition.direct')}</Badge>
      }
    },
    {
      // Use the standard "actions" key so CrudPageLayout doesn't auto-add a duplicate
      key: 'actions',
      label: tCommon('actions'),
      sortable: false,
      // Keep the column compact and right-aligned on larger screens
      className: 'text-right w-[60px] min-w-[60px]',
      render: (_value: any, patient: Patient) => {
        if (!patient) return null;
        return (
          <div className="flex justify-end">
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
        items: filteredPatients || [],
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
      beforeTable={
        <SmartFilters
          filters={filterConfigs}
          values={filterValues}
          onChange={setFilterValues}
          className="mb-4"
        />
      }
      mobileColumns={[
        {
          key: '_mobile_patient_name',
          label: tFields('name'),
          render: (_: any, patient: Patient) => (
            <div className="font-semibold text-foreground">
              {patient.first_name} {patient.last_name}
            </div>
          )
        },
        {
          key: '_mobile_phone',
          label: tFields('phone'),
          render: (_: any, patient: Patient) => {
            if (!patient.phone) return <span className="text-muted-foreground text-sm">{tCommon('noPhone')}</span>
            return (
              <div className="flex items-center justify-end gap-1">
                <span className="text-sm mr-2">{patient.phone}</span>
                <a
                  href={getTelHref(patient.phone)}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  aria-label={tg('actions.call')}
                  onClick={(e) => e.stopPropagation()}
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
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                  aria-label="WhatsApp"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              </div>
            )
          }
        },
        {
          key: '_mobile_source',
          label: tFields('source'),
          render: (_: any, patient: Patient) => {
            // Campana publicitaria
            if (patient.campaign_id && patient.campaign?.name) {
              return <Badge variant="outline" className="text-xs">{patient.campaign.name}</Badge>
            }
            // Referencia
            if (patient.referred_by_patient_id && patient.referred_by) {
              const name = `${patient.referred_by.first_name} ${patient.referred_by.last_name}`
              return <Badge variant="outline" className="text-xs">{name}</Badge>
            }
            // Redes organico
            if (patient.platform_id && patient.platform) {
              return <Badge variant="outline" className="text-xs">{patient.platform.display_name || patient.platform.name}</Badge>
            }
            // Directo
            return <Badge variant="outline" className="text-xs">{t('acquisition.direct')}</Badge>
          }
        },
        {
          key: '_mobile_activity',
          label: t('fields.activity'),
          render: (_: any, patient: Patient) => {
            const stats = statsByPatient.get(patient.id)
            const count = stats?.treatments ?? 0
            const amount = formatCurrency(stats?.spent_cents ?? 0)
            return (
              <div className="flex items-center justify-end gap-3 text-sm">
                <span className="text-muted-foreground">
                  {count} {t('activity.treatments')}
                </span>
                <span className="font-medium text-foreground">{amount}</span>
              </div>
            )
          }
        },
        {
          key: 'actions',
          label: tCommon('actions'),
          sortable: false,
          render: (_: any, patient: Patient) => {
            if (!patient) return null
            return (
              <ActionDropdown
                actions={[
                  {
                    label: tg('actions.view'),
                    icon: <Eye className="h-4 w-4" />,
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
                    setTimeout(() => setEditPatient(patient), 0)
                  }, tCommon('edit')),
                  createDeleteAction(() => setDeletePatientData(patient), tCommon('delete'))
                ]}
              />
            )
          }
        }
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
