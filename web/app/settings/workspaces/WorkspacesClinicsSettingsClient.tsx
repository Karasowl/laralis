'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, Pencil, Plus, Trash } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FormModal } from '@/components/ui/form-modal'
import { FormGrid, InputField } from '@/components/ui/form-field'
import { toast } from 'sonner'
import { useWorkspace } from '@/contexts/workspace-context'

type Workspace = {
  id: string
  name: string
  slug: string
  onboarding_completed?: boolean
}

export type Clinic = {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
}

type ClinicFormState = {
  name: string
  address: string
  phone: string
  email: string
}

const emptyClinicForm: ClinicFormState = {
  name: '',
  address: '',
  phone: '',
  email: ''
}

export default function WorkspacesClinicsSettingsClient() {
  const t = useTranslations()
  const tCommon = useTranslations('common')
  const tSettings = useTranslations('settings')
  const { setWorkspace: setGlobalWorkspace, setCurrentClinic } = useWorkspace()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState<boolean>(true)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')

  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loadingClinics, setLoadingClinics] = useState<boolean>(false)

  const [clinicModalOpen, setClinicModalOpen] = useState<boolean>(false)
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null)
  const [clinicForm, setClinicForm] = useState<ClinicFormState>(emptyClinicForm)
  const [savingClinic, setSavingClinic] = useState<boolean>(false)

  const selectedWorkspace = useMemo(() =>
    workspaces.find(ws => ws.id === selectedWorkspaceId) || null,
    [workspaces, selectedWorkspaceId]
  )

  useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        setLoadingWorkspaces(true)
        const res = await fetch('/api/workspaces?list=true')
        const payload = await res.json().catch(() => []) as any
        const list: Workspace[] = Array.isArray(payload) ? payload : payload?.data || []
        setWorkspaces(list)
        if (list.length > 0) {
          setSelectedWorkspaceId(list[0].id)
        } else {
          setSelectedWorkspaceId('')
        }
      } catch (error) {
        console.error('[Workspaces] load error', error)
        toast.error(tCommon('loadError', { entity: tSettings('workspaces.entity', { defaultValue: 'Workspace' }) }))
      } finally {
        setLoadingWorkspaces(false)
      }
    }

    loadWorkspaces()
  }, [tCommon, tSettings])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.replace('#', '')
    if (!hash) return
    const el = document.getElementById(hash)
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
    }
  }, [])

  useEffect(() => {
    const loadClinics = async () => {
      if (!selectedWorkspaceId) {
        setClinics([])
        return
      }
      try {
        setLoadingClinics(true)
        const res = await fetch(`/api/workspaces/${selectedWorkspaceId}/clinics`)
        const payload = await res.json().catch(() => ({} as any))
        const list: Clinic[] = Array.isArray(payload) ? payload : payload?.data || []
        setClinics(list)
      } catch (error) {
        console.error('[Clinics] load error', error)
        toast.error(tCommon('loadError', { entity: tSettings('clinics.entity', { defaultValue: 'Clinic' }) }))
      } finally {
        setLoadingClinics(false)
      }
    }

    loadClinics()
  }, [selectedWorkspaceId, tCommon, tSettings])

  const handleClinicFieldChange = (field: keyof ClinicFormState, value: string) => {
    setClinicForm(prev => ({ ...prev, [field]: value }))
  }

  const openCreateClinic = () => {
    setEditingClinic(null)
    setClinicForm(emptyClinicForm)
    setClinicModalOpen(true)
  }

  const openEditClinic = (clinic: Clinic) => {
    setEditingClinic(clinic)
    setClinicForm({
      name: clinic.name || '',
      address: clinic.address || '',
      phone: clinic.phone || '',
      email: clinic.email || ''
    })
    setClinicModalOpen(true)
  }

  const fetchClinics = async (workspaceId: string) => {
    try {
      setLoadingClinics(true)
      const res = await fetch(`/api/workspaces/${workspaceId}/clinics`)
      const payload = await res.json().catch(() => ({} as any))
      const list: Clinic[] = Array.isArray(payload) ? payload : payload?.data || []
      setClinics(list)
    } catch (error) {
      console.error('[Clinics] refresh error', error)
      toast.error(tCommon('loadError', { entity: tSettings('clinics.entity', { defaultValue: 'Clinic' }) }))
    } finally {
      setLoadingClinics(false)
    }
  }

  const handleClinicSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedWorkspaceId) {
      toast.error(t('settings.workspaces.selectWorkspaceFirst', { defaultValue: 'Select a workspace first.' }))
      return
    }
    if (!clinicForm.name.trim()) {
      toast.error(t('settings.clinics.validation.nameRequired', { defaultValue: 'Clinic name is required' }))
      return
    }

    try {
      setSavingClinic(true)
      if (editingClinic) {
        const res = await fetch(`/api/clinics/${editingClinic.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clinicForm)
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({} as any))
          throw new Error(err?.message || err?.error || 'Failed to update clinic')
        }
        toast.success(tCommon('updateSuccess', { entity: tSettings('clinics.entity', { defaultValue: 'Clinic' }) }))
      } else {
        const res = await fetch(`/api/workspaces/${selectedWorkspaceId}/clinics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clinicForm)
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({} as any))
          throw new Error(err?.message || err?.error || 'Failed to create clinic')
        }
        toast.success(tCommon('createSuccess', { entity: tSettings('clinics.entity', { defaultValue: 'Clinic' }) }))
      }

      setClinicModalOpen(false)
      setEditingClinic(null)
      setClinicForm(emptyClinicForm)
      await fetchClinics(selectedWorkspaceId)
    } catch (error: any) {
      console.error('[Clinics] save error', error)
      toast.error(error?.message || tCommon('error'))
    } finally {
      setSavingClinic(false)
    }
  }

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    const confirmed = window.confirm(tSettings('workspaces.deleteConfirm', { defaultValue: 'Are you sure you want to delete this workspace?' }))
    if (!confirmed) return
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any))
        throw new Error(err?.message || err?.error || 'Failed to delete workspace')
      }
      toast.success(tCommon('deleteSuccess', { entity: tSettings('workspaces.entity', { defaultValue: 'Workspace' }) }))

      // Reload workspaces
      const loadWorkspaces = async () => {
        try {
          setLoadingWorkspaces(true)
          const res = await fetch('/api/workspaces?list=true')
          const payload = await res.json().catch(() => []) as any
          const list: Workspace[] = Array.isArray(payload) ? payload : payload?.data || []
          setWorkspaces(list)

          // If deleted workspace was selected, select first remaining workspace
          if (selectedWorkspaceId === workspace.id) {
            if (list.length > 0) {
              setSelectedWorkspaceId(list[0].id)
              setGlobalWorkspace(list[0] as any)
              setCurrentClinic(null)
            } else {
              setSelectedWorkspaceId('')
            }
          }
        } catch (error) {
          console.error('[Workspaces] load error', error)
          toast.error(tCommon('loadError', { entity: tSettings('workspaces.entity', { defaultValue: 'Workspace' }) }))
        } finally {
          setLoadingWorkspaces(false)
        }
      }

      await loadWorkspaces()
    } catch (error: any) {
      console.error('[Workspaces] delete error', error)
      toast.error(error?.message || tCommon('error'))
    }
  }

  const handleDeleteClinic = async (clinic: Clinic) => {
    const confirmed = window.confirm(t('settings.clinics.deleteConfirm', { defaultValue: 'Delete clinic?' }))
    if (!confirmed) return
    try {
      const res = await fetch(`/api/clinics/${clinic.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any))
        throw new Error(err?.message || err?.error || 'Failed to delete clinic')
      }
      toast.success(tCommon('deleteSuccess', { entity: tSettings('clinics.entity', { defaultValue: 'Clinic' }) }))
      await fetchClinics(selectedWorkspaceId)
    } catch (error: any) {
      console.error('[Clinics] delete error', error)
      toast.error(error?.message || tCommon('error'))
    }
  }

  const workspaceSummary = useMemo(() => {
    if (!selectedWorkspace) return null
    return t('settings.workspaces.summary', {
      name: selectedWorkspace.name,
      clinicCount: clinics.length
    })
  }, [selectedWorkspace, clinics.length, t])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card id="workspaces-section" className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{t('settings.workspaces.title')}</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('settings.workspaces.subtitle')}
            </p>
          </div>
        </div>

        {loadingWorkspaces ? (
          <div className="space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <div className="space-y-2">
            {workspaces.map(ws => (
              <div
                key={ws.id}
                className={`w-full rounded border p-3 transition ${selectedWorkspaceId === ws.id ? 'bg-muted' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedWorkspaceId(ws.id)
                      setGlobalWorkspace(ws as any) // Change active workspace globally
                      setCurrentClinic(null) // Reset clinic so context auto-selects first clinic of new workspace
                      toast.success(tSettings('workspaces.switched', {
                        name: ws.name
                      }))
                    }}
                    className="flex-1 text-left"
                  >
                    <div className="font-medium">{ws.name}</div>
                    <div className="text-xs text-muted-foreground">{ws.slug}</div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteWorkspace(ws)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {workspaces.length === 0 && (
              <div className="text-sm text-muted-foreground">
                {t('settings.workspaces.empty', { defaultValue: 'No workspaces available.' })}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card id="clinics-section" className="p-6 lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">
              {t('settings.clinics.title')}
            </h3>
            {workspaceSummary && (
              <p className="text-xs text-muted-foreground">{workspaceSummary}</p>
            )}
          </div>
          <Button size="sm" onClick={openCreateClinic} disabled={!selectedWorkspaceId}>
            <Plus className="mr-2 h-4 w-4" />
            {t('settings.clinics.create')}
          </Button>
        </div>

        {loadingClinics ? (
          <div className="space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : clinics.length > 0 ? (
          <div className="divide-y rounded border">
            {clinics.map(clinic => (
              <div key={clinic.id} className="flex items-start justify-between gap-4 p-4">
                <div>
                  <div className="font-medium">{clinic.name}</div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div>{clinic.address || '—'}</div>
                    <div>{clinic.phone || '—'}</div>
                    <div>{clinic.email || '—'}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => openEditClinic(clinic)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteClinic(clinic)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded border p-6 text-center text-sm text-muted-foreground">
            {t('settings.clinics.empty', { defaultValue: 'No clinics registered for this workspace.' })}
          </div>
        )}
      </Card>

      <FormModal
        open={clinicModalOpen}
        onOpenChange={(open) => {
          setClinicModalOpen(open)
          if (!open) {
            setEditingClinic(null)
            setClinicForm(emptyClinicForm)
          }
        }}
        title={editingClinic
          ? t('settings.clinics.editTitle', { defaultValue: 'Edit clinic' })
          : t('settings.clinics.createTitle', { defaultValue: 'Create clinic' })}
        submitLabel={editingClinic
          ? tCommon('save', { defaultValue: 'Save' })
          : tCommon('create', { defaultValue: 'Create' })}
        cancelLabel={tCommon('cancel')}
        isSubmitting={savingClinic}
        onSubmit={handleClinicSubmit}
        maxWidth="md"
      >
        <div className="space-y-4">
          <FormGrid columns={1}>
            <InputField
              label={t('settings.clinics.fields.name', { defaultValue: 'Name' })}
              value={clinicForm.name}
              onChange={(value) => handleClinicFieldChange('name', String(value))}
              required
            />
            <InputField
              label={t('settings.clinics.fields.address', { defaultValue: 'Address' })}
              value={clinicForm.address}
              onChange={(value) => handleClinicFieldChange('address', String(value))}
            />
            <InputField
              label={t('settings.clinics.fields.phone', { defaultValue: 'Phone' })}
              value={clinicForm.phone}
              onChange={(value) => handleClinicFieldChange('phone', String(value))}
            />
            <InputField
              label={t('settings.clinics.fields.email', { defaultValue: 'Email' })}
              value={clinicForm.email}
              onChange={(value) => handleClinicFieldChange('email', String(value))}
            />
          </FormGrid>
        </div>
      </FormModal>
    </div>
  )
}
