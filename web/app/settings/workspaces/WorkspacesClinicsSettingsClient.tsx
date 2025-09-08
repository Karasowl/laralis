'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/DataTable'
import { FormModal } from '@/components/ui/form-modal'
import { FormGrid, InputField, SelectField } from '@/components/ui/form-field'
import { ActionDropdown, ActionItem } from '@/components/ui/ActionDropdown'
import { Building2, Building, Plus, Edit, Trash2, ArrowLeft } from 'lucide-react'
import { useCrudOperations } from '@/hooks/use-crud-operations'
import { toast } from 'sonner'

type Workspace = {
  id: string
  name: string
  slug: string
  description?: string
  onboarding_completed: boolean
  created_at: string
}

type Clinic = {
  id: string
  workspace_id: string
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
  is_active: boolean
  created_at?: string
}

export default function WorkspacesClinicsSettingsClient() {
  const t = useTranslations()

  // Left list: workspaces (reuse generic CRUD hook for listing only)
  const workspacesCrud = useCrudOperations<Workspace>({
    endpoint: '/api/workspaces',
    entityName: t('settings.workspaces.entity', 'Workspace'),
    includeClinicId: false,
    searchParam: 'search',
    staticParams: { list: 'true' },
  })

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')

  useEffect(() => {
    workspacesCrud.fetchItems()
  }, [])

  // Right list: clinics for selected workspace
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [clinicsLoading, setClinicsLoading] = useState(false)
  const [clinicCounts, setClinicCounts] = useState<Record<string, number>>({})

  const fetchClinics = async (workspaceId: string) => {
    if (!workspaceId) {
      setClinics([])
      return
    }
    try {
      setClinicsLoading(true)
      const res = await fetch(`/api/workspaces/${workspaceId}/clinics`)
      if (!res.ok) throw new Error('Failed to fetch clinics')
      const result = await res.json()
      const data = result.data || result || []
      setClinics(data)
    } catch (err) {
      console.error('[fetchClinics] error:', err)
      setClinics([])
    } finally {
      setClinicsLoading(false)
    }
  }

  useEffect(() => {
    fetchClinics(selectedWorkspaceId)
  }, [selectedWorkspaceId])

  // Load clinic counts for each workspace
  useEffect(() => {
    const loadCounts = async () => {
      const list = workspacesCrud.items || []
      if (list.length === 0) { setClinicCounts({}); return }
      try {
        const pairs = await Promise.all(list.map(async (ws: Workspace) => {
          try {
            const res = await fetch(`/api/workspaces/${ws.id}/clinics`)
            const result = await res.json().catch(() => [])
            const data = result?.data ?? result ?? []
            return [ws.id, Array.isArray(data) ? data.length : 0] as const
          } catch {
            return [ws.id, 0] as const
          }
        }))
        const map: Record<string, number> = {}
        for (const [id, n] of pairs) map[id] = n
        setClinicCounts(map)
      } catch {
        setClinicCounts({})
      }
    }
    loadCounts()
  }, [workspacesCrud.items])

  // Create/edit clinic modal
  const [clinicModalOpen, setClinicModalOpen] = useState(false)
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null)
  const [clinicForm, setClinicForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
  })
  const [savingClinic, setSavingClinic] = useState(false)

  const openCreateClinic = () => {
    setEditingClinic(null)
    setClinicForm({ name: '', address: '', phone: '', email: '' })
    setClinicModalOpen(true)
  }

  const openEditClinic = (clinic: Clinic) => {
    setEditingClinic(clinic)
    setClinicForm({
      name: clinic.name || '',
      address: clinic.address || '',
      phone: clinic.phone || '',
      email: clinic.email || '',
    })
    setClinicModalOpen(true)
  }

  const saveClinic = async () => {
    if (!selectedWorkspaceId) return
    setSavingClinic(true)
    try {
      if (!clinicForm.name || clinicForm.name.trim().length === 0) {
        throw new Error(t('settings.clinics.nameRequired', 'El nombre de la clínica es requerido'))
      }
      if (editingClinic) {
        const res = await fetch(`/api/clinics/${editingClinic.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...clinicForm }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.message || err.error || 'Failed to update clinic')
        }
        toast.success(t('common.updateSuccess', { entity: t('settings.clinics.entity') }))
      } else {
        const res = await fetch(`/api/workspaces/${selectedWorkspaceId}/clinics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...clinicForm }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.message || err.error || 'Failed to create clinic')
        }
        toast.success(t('common.createSuccess', { entity: t('settings.clinics.entity') }))
      }
      setClinicModalOpen(false)
      setEditingClinic(null)
      await fetchClinics(selectedWorkspaceId)
    } catch (e: any) {
      toast.error(e?.message || t('common.error'))
    } finally {
      setSavingClinic(false)
    }
  }

  const deleteClinic = async (clinic: Clinic) => {
    if (!window.confirm(t('settings.clinics.deleteConfirm'))) return
    try {
      const res = await fetch(`/api/clinics/${clinic.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || err.error || 'Failed to delete clinic')
      }
      toast.success(t('common.deleteSuccess', { entity: t('settings.clinics.entity') }))
      await fetchClinics(selectedWorkspaceId)
    } catch (e: any) {
      toast.error(e?.message || t('common.error'))
    }
  }

  const selectClinicAsCurrent = async (clinic: Clinic) => {
    try {
      const res = await fetch('/api/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId: clinic.id }),
      })
      if (!res.ok) throw new Error('Failed to set clinic')
      toast.success(t('settings.clinics.selectedAsCurrent', 'Clínica seleccionada'))
    } catch (e: any) {
      toast.error(e?.message || t('common.error'))
    }
  }

  const workspaceList = useMemo(() => workspacesCrud.items || [], [workspacesCrud.items])
  const selectedWorkspace = useMemo(
    () => workspaceList.find(w => w.id === selectedWorkspaceId) || null,
    [workspaceList, selectedWorkspaceId]
  )

  // Workspace create/edit modal
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
  const [workspaceForm, setWorkspaceForm] = useState({
    name: '',
    slug: '',
    description: ''
  })
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [wsErrors, setWsErrors] = useState<{ name?: string; slug?: string }>({})
  const [slugTouched, setSlugTouched] = useState(false)

  const slugify = (v: string) => v
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  const validateWorkspace = () => {
    const errs: { name?: string; slug?: string } = {}
    if (!workspaceForm.name || workspaceForm.name.trim().length === 0) {
      errs.name = t('settings.workspaces.nameRequired', 'El nombre es requerido')
    }
    const s = (workspaceForm.slug || '').trim()
    if (!s || !/^[a-z0-9-]{3,}$/.test(s)) {
      errs.slug = t('settings.workspaces.slugInvalid', 'Usa minúsculas, números y guiones. Mín 3 caracteres')
    }
    setWsErrors(errs)
    return Object.keys(errs).length === 0
  }

  const openCreateWorkspace = () => {
    setEditingWorkspace(null)
    setWorkspaceForm({ name: '', slug: '', description: '' })
    setWorkspaceModalOpen(true)
    setWsErrors({})
    setSlugTouched(false)
  }

  const openEditWorkspace = (ws: Workspace) => {
    setEditingWorkspace(ws)
    setWorkspaceForm({
      name: ws.name || '',
      slug: ws.slug || '',
      description: ws.description || ''
    })
    setWorkspaceModalOpen(true)
    setWsErrors({})
    setSlugTouched(true)
  }

  const saveWorkspace = async () => {
    setSavingWorkspace(true)
    try {
      if (!slugTouched && (!workspaceForm.slug || workspaceForm.slug.trim().length === 0)) {
        setWorkspaceForm(prev => ({ ...prev, slug: slugify(prev.name) }))
      }
      if (!validateWorkspace()) {
        toast.error(t('settings.workspaces.validationError', 'Corrige los errores del formulario'))
        return
      }
      if (editingWorkspace) {
        const res = await fetch(`/api/workspaces/${editingWorkspace.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...workspaceForm })
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.message || err.error || 'Failed to update workspace')
        }
        toast.success(t('common.updateSuccess', { entity: t('settings.workspaces.entity', 'Espacio de Trabajo') }))
      } else {
        const res = await fetch('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...workspaceForm })
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.message || err.error || 'Failed to create workspace')
        }
        toast.success(t('common.createSuccess', { entity: t('settings.workspaces.entity', 'Espacio de Trabajo') }))
      }
      await workspacesCrud.fetchItems()
      setWorkspaceModalOpen(false)
      setEditingWorkspace(null)
    } catch (e: any) {
      toast.error(e?.message || t('common.error'))
    } finally {
      setSavingWorkspace(false)
    }
  }

  const deleteWorkspace = async (ws: Workspace) => {
    if (!window.confirm(t('settings.workspaces.deleteConfirm', '¿Estás seguro de que quieres eliminar este espacio de trabajo?'))) return
    const success = await workspacesCrud.handleDelete(ws.id)
    if (success && selectedWorkspaceId === ws.id) {
      setSelectedWorkspaceId('')
      setClinics([])
    }
  }

  // Columns for clinics table
  const clinicColumns = [
    { key: 'name', label: t('settings.clinics.name') },
    { key: 'address', label: t('settings.clinics.address'), render: (_: any, c: Clinic) => c.address || '-' },
    { key: 'phone', label: t('settings.clinics.phone'), render: (_: any, c: Clinic) => c.phone || '-' },
    { key: 'email', label: t('settings.clinics.email'), render: (_: any, c: Clinic) => c.email || '-' },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (_: any, c: Clinic) => {
        const actions: ActionItem[] = [
          {
            label: t('common.edit'),
            icon: <Edit className="h-4 w-4" />,
            onClick: () => openEditClinic(c),
          },
          {
            label: t('settings.clinics.useAsCurrent', 'Usar como actual'),
            onClick: () => selectClinicAsCurrent(c),
          },
          {
            label: t('common.delete'),
            icon: <Trash2 className="h-4 w-4" />,
            destructive: true,
            onClick: () => deleteClinic(c),
          },
        ]
        return <ActionDropdown actions={actions} />
      }
    },
  ]

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Workspaces list */}
      <Card className="p-6 lg:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t('settings.workspaces.title')}</h2>
          </div>
          <Button size="sm" onClick={openCreateWorkspace}>
            <Plus className="h-4 w-4 mr-1" /> {t('common.add')}
          </Button>
        </div>

        {workspacesCrud.loading ? (
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded" />
          </div>
        ) : workspaceList.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title={t('settings.workspaces.emptyTitle', 'Sin espacios de trabajo')}
            description={t('settings.workspaces.emptyDesc', 'Crea tu primer espacio de trabajo')}
            action={<Button size="sm" onClick={workspacesCrud.openDialog}>{t('settings.workspaces.create', 'Crear Espacio de Trabajo')}</Button>}
          />
        ) : (
          <div className="divide-y border rounded">
            {workspaceList.map((ws) => (
              <div
                key={ws.id}
                className={`w-full p-3 hover:bg-muted/50 transition flex items-center justify-between cursor-pointer ${selectedWorkspaceId === ws.id ? 'bg-muted/70' : ''}`}
                onClick={() => setSelectedWorkspaceId(ws.id)}
              >
                <div>
                  <div className="font-medium">{ws.name}</div>
                  <div className="text-xs text-muted-foreground">{ws.slug}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {(clinicCounts[ws.id] ?? 0)} {t('settings.clinics.title').toLowerCase()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedWorkspaceId === ws.id && (
                    <span className="text-xs text-primary">{t('common.selected')}</span>
                  )}
                  <div onClick={(e) => e.stopPropagation()}>
                    <ActionDropdown
                      actions={[
                        { label: t('common.edit'), icon: <Edit className="h-4 w-4" />, onClick: () => openEditWorkspace(ws) },
                        { label: t('common.delete'), icon: <Trash2 className="h-4 w-4" />, variant: 'destructive', separator: true, onClick: () => deleteWorkspace(ws) }
                      ]}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Right: Clinics for selected workspace */}
      <div className="lg:col-span-2 space-y-6">
        {!selectedWorkspace ? (
          <Card className="p-12">
            <EmptyState
              icon={<Building className="h-10 w-10" />}
              title={t('settings.clinics.selectWorkspaceTitle', 'Selecciona un espacio de trabajo')}
              description={t('settings.clinics.selectWorkspaceDesc', 'Elige un espacio de trabajo para ver y gestionar sus clínicas')}
            />
          </Card>
        ) : (
          <>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button className="lg:hidden" onClick={() => setSelectedWorkspaceId('')}>
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-lg font-semibold">
                    {t('settings.clinics.title')} · <span className="text-muted-foreground">{selectedWorkspace?.name}</span>
                  </h2>
                </div>
                <Button size="sm" onClick={openCreateClinic}>
                  <Plus className="h-4 w-4 mr-1" /> {t('settings.clinics.create')}
                </Button>
              </div>

              {clinicsLoading ? (
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded" />
                </div>
              ) : clinics.length === 0 ? (
                <EmptyState
                  icon={<Building className="h-8 w-8" />}
                  title={t('settings.clinics.emptyTitle', 'Sin clínicas')}
                  description={t('settings.clinics.emptyDesc', 'Crea tu primera clínica en este espacio de trabajo')}
                  action={<Button size="sm" onClick={openCreateClinic}>{t('settings.clinics.create', 'Crear Clínica')}</Button>}
                />
              ) : (
                <DataTable
                  data={clinics}
                  columns={clinicColumns}
                  mobileColumns={[clinicColumns[0], clinicColumns[4]]}
                />
              )}
            </Card>

            {/* Create/Edit clinic modal */}
            <FormModal
              open={clinicModalOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setClinicModalOpen(false)
                  setEditingClinic(null)
                }
              }}
              title={editingClinic ? t('settings.clinics.edit') : t('settings.clinics.create')}
              onSubmit={(e) => { e.preventDefault(); saveClinic() }}
              isSubmitting={savingClinic}
              cancelLabel={t('common.cancel')}
              submitLabel={editingClinic ? t('common.update') : t('common.create')}
            >
              <div className="space-y-4">
                <FormGrid columns={1}>
                  <InputField
                    label={t('settings.clinics.name')}
                    value={clinicForm.name}
                    onChange={(v) => setClinicForm(prev => ({ ...prev, name: String(v) }))}
                    required
                  />
                  <InputField
                    label={t('settings.clinics.address')}
                    value={clinicForm.address}
                    onChange={(v) => setClinicForm(prev => ({ ...prev, address: String(v) }))}
                  />
                  <FormGrid columns={2}>
                    <InputField
                      label={t('settings.clinics.phone')}
                      value={clinicForm.phone}
                      onChange={(v) => setClinicForm(prev => ({ ...prev, phone: String(v) }))}
                    />
                    <InputField
                      label={t('settings.clinics.email')}
                      value={clinicForm.email}
                      type="email"
                      onChange={(v) => setClinicForm(prev => ({ ...prev, email: String(v) }))}
                    />
                  </FormGrid>
                  <SelectField
                    label={t('settings.clinics.workspace')}
                    value={selectedWorkspaceId}
                    onChange={() => {}}
                    options={workspaceList.map(w => ({ value: w.id, label: w.name }))}
                    disabled
                  />
                </FormGrid>
              </div>
            </FormModal>
          </>
        )}
      </div>
    </div>
      {/* Create/Edit workspace modal */}
      <FormModal
        open={workspaceModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setWorkspaceModalOpen(false)
            setEditingWorkspace(null)
          }
        }}
        title={editingWorkspace ? t('settings.workspaces.edit') : t('settings.workspaces.create')}
        onSubmit={(e) => { e.preventDefault(); saveWorkspace() }}
        isSubmitting={savingWorkspace}
        cancelLabel={t('common.cancel')}
        submitLabel={editingWorkspace ? t('common.update') : t('common.create')}
      >
        <div className="space-y-4">
          <FormGrid columns={1}>
            <InputField
              label={t('settings.workspaces.name')}
              value={workspaceForm.name}
              onChange={(v) => setWorkspaceForm(prev => ({ ...prev, name: String(v) }))}
              required
              error={wsErrors.name}
            />
            <InputField
              label={t('settings.workspaces.slug')}
              value={workspaceForm.slug}
              onChange={(v) => { setSlugTouched(true); setWorkspaceForm(prev => ({ ...prev, slug: String(v) })) }}
              helperText={t('settings.workspaces.slugHelp', 'Ej.: grupo-dental-garcia')}
              error={wsErrors.slug}
            />
            <InputField
              label={t('settings.workspaces.description')}
              value={workspaceForm.description}
              onChange={(v) => setWorkspaceForm(prev => ({ ...prev, description: String(v) }))}
            />
          </FormGrid>
        </div>
      </FormModal>
    </>
  )
}
