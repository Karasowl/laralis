'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { FormModal } from '@/components/ui/form-modal'
import { FormGrid, FormSection, InputField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { Archive, Trash2, RotateCcw, Megaphone, Plus, ChevronRight, Edit, ArrowLeft } from 'lucide-react'
import { ActionDropdown, ActionItem } from '@/components/ui/ActionDropdown'
import { useCrudOperations } from '@/hooks/use-crud-operations'
import { useWorkspace } from '@/contexts/workspace-context'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { formatCurrency } from '@/lib/money'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { SmartFilters, FilterConfig, FilterValues } from '@/components/ui/smart-filters'

// Schemas - validation messages will be handled by form field components
const platformSchema = z.object({
  display_name: z.string().min(1),
  clinic_id: z.string()
})

const campaignSchema = z.object({
  name: z.string().min(1),
  platform_id: z.string()
})

type Platform = z.infer<typeof platformSchema> & { 
  id: string
  campaigns_count?: number
  is_system?: boolean
}
type Campaign = z.infer<typeof campaignSchema> & { 
  id: string
  platform?: Platform
  archived_at?: string | null
  patients_count?: number
}

export default function MarketingSettingsClient() {
  const t = useTranslations()
  const { currentClinic } = useWorkspace()
  const { currentClinic: fallbackClinic } = useCurrentClinic()
  
  // Platform CRUD
  const platforms = useCrudOperations<Platform>({
    endpoint: '/api/marketing/platforms',
    entityName: t('settings.marketing.platform'),
    includeClinicId: true
  })
  
  // Load platforms on mount
  useEffect(() => {
    platforms.fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // fetchItems is stable from useCrudOperations

  // Campaign CRUD - Using custom implementation for campaigns
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('')
  const [campaignsData, setCampaignsData] = useState<Campaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)

  // Smart Filters state
  const [filterValues, setFilterValues] = useState<FilterValues>({})
  
  // Fetch campaigns for selected platform
  const fetchCampaigns = useCallback(async () => {
    if (!selectedPlatformId) {
      setCampaignsData([])
      return
    }
    
    try {
      setCampaignsLoading(true)
      const response = await fetch(
        `/api/marketing/campaigns?platformId=${selectedPlatformId}&includeArchived=true`
      )
      if (response.ok) {
        const result = await response.json()
        const data = result.data || result || []
        setCampaignsData(data)
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      setCampaignsData([])
    } finally {
      setCampaignsLoading(false)
    }
  }, [selectedPlatformId])
  
  // Load campaigns when platform changes
  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])
  
  // Campaign delete handler
  const handleDeleteCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/marketing/campaigns/${campaignId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchCampaigns() // Refresh campaigns
        toast.success(t('common.deleteSuccess', { entity: t('settings.marketing.campaign') }))
        return true
      } else {
        const error = await response.json()
        // Show specific error message based on error code or message
        const errorMessage = error.error || error.message || ''
        if (errorMessage.toLowerCase().includes('patient')) {
          toast.error(t('settings.marketing.cannotDeleteCampaignWithPatients'))
        } else {
          toast.error(t('common.deleteError', { entity: t('settings.marketing.campaign') }))
        }
        console.error('Failed to delete campaign:', error)
        return false
      }
    } catch (error) {
      console.error('Error deleting campaign:', error)
      toast.error(t('common.deleteError', { entity: t('settings.marketing.campaign') }))
      return false
    }
  }
  
  // Campaign create handler
  const handleCreateCampaign = async (data: any) => {
    try {
      const response = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, platform_id: selectedPlatformId })
      })
      
      if (response.ok) {
        await fetchCampaigns()
        toast.success(t('common.createSuccess', { entity: t('settings.marketing.campaign') }))
        return true
      }
      toast.error(t('common.createError', { entity: t('settings.marketing.campaign') }))
      return false
    } catch (error) {
      console.error('Error creating campaign:', error)
      toast.error(t('common.createError', { entity: t('settings.marketing.campaign') }))
      return false
    }
  }
  
  // Campaign update handler
  const handleUpdateCampaign = async (campaignId: string, data: any) => {
    try {
      const response = await fetch(`/api/marketing/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (response.ok) {
        await fetchCampaigns()
        toast.success(t('common.updateSuccess', { entity: t('settings.marketing.campaign') }))
        return true
      }
      toast.error(t('common.updateError', { entity: t('settings.marketing.campaign') }))
      return false
    } catch (error) {
      console.error('Error updating campaign:', error)
      toast.error(t('common.updateError', { entity: t('settings.marketing.campaign') }))
      return false
    }
  }

  // Forms
  const [platformModalOpen, setPlatformModalOpen] = useState(false)
  const [campaignModalOpen, setCampaignModalOpen] = useState(false)
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [campaignSubmitting, setCampaignSubmitting] = useState(false)
  
  const platformForm = useForm<z.infer<typeof platformSchema>>({
    resolver: zodResolver(platformSchema),
    defaultValues: {
      display_name: '',
      clinic_id: currentClinic?.id || ''
    }
  })

  const campaignForm = useForm<z.infer<typeof campaignSchema>>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '',
      platform_id: ''
    }
  })

  // Note: Removed automatic form update to prevent infinite loops
  // The platform_id is set when opening the modal instead

  // Platform handlers
  const handleOpenPlatformModal = (platform?: Platform) => {
    if (platform) {
      setEditingPlatform(platform)
      platformForm.setValue('display_name', platform.display_name)
    } else {
      setEditingPlatform(null)
      platformForm.reset()
    }
    setPlatformModalOpen(true)
  }

  const handleSavePlatform = async (data: z.infer<typeof platformSchema>) => {
    // No hacemos early-return si no hay clínica; el backend resolverá clinic_id
    // usando cookie o primera clínica disponible.
    const payload = currentClinic?.id || fallbackClinic?.id
      ? { ...data, clinic_id: (currentClinic?.id || fallbackClinic?.id)! }
      : { display_name: data.display_name }

    const success = editingPlatform
      ? await platforms.handleUpdate(editingPlatform.id, payload)
      : await platforms.handleCreate(payload)

    if (success) {
      setPlatformModalOpen(false)
      platformForm.reset()
      setEditingPlatform(null)
    }
  }

  const handleDeletePlatform = async (platformId: string) => {
    const success = await platforms.handleDelete(platformId)
    if (success && selectedPlatformId === platformId) {
      setSelectedPlatformId('')
      setCampaignsData([])
    }
  }

  // Campaign handlers
  const handleOpenCampaignModal = (campaign?: Campaign) => {
    if (campaign) {
      setEditingCampaign(campaign)
      campaignForm.reset({
        name: campaign.name,
        platform_id: campaign.platform_id || campaign.platform?.id || ''
      })
    } else {
      setEditingCampaign(null)
      campaignForm.reset({
        name: '',
        platform_id: selectedPlatformId
      })
    }
    setCampaignModalOpen(true)
  }

  const handleSaveCampaign = async (data: z.infer<typeof campaignSchema>) => {
    setCampaignSubmitting(true)
    try {
      const success = editingCampaign
        ? await handleUpdateCampaign(editingCampaign.id, data)
        : await handleCreateCampaign(data)

      if (success) {
        setCampaignModalOpen(false)
        campaignForm.reset()
        setEditingCampaign(null)
      }
    } finally {
      setCampaignSubmitting(false)
    }
  }

  const handleArchiveCampaign = async (campaign: Campaign) => {
    const isArchived = !!campaign.archived_at
    
    try {
      // Hacer la petición al backend
      const endpoint = `/api/marketing/campaigns/${campaign.id}`
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          archived_at: isArchived ? null : new Date().toISOString()
        })
      })
      
      if (res.ok) {
        // Recargar las campañas
        await fetchCampaigns()
        toast.success(
          isArchived 
            ? t('settings.marketing.campaignRestored') 
            : t('settings.marketing.campaignArchived')
        )
      } else {
        console.error('Error archiving campaign:', await res.text())
        toast.error(
          isArchived 
            ? t('settings.marketing.restoreError')
            : t('settings.marketing.archiveError')
        )
      }
    } catch (error) {
      console.error('Error archiving campaign:', error)
      toast.error(
        isArchived 
          ? t('settings.marketing.restoreError')
          : t('settings.marketing.archiveError')
      )
    }
  }

  // Get active campaigns count for statistics
  const activeCampaigns = campaignsData.filter(c => !c.archived_at)
  const selectedPlatform = platforms.items.find(p => p.id === selectedPlatformId)

  // SmartFilters configuration for campaigns
  const campaignFilterConfigs: FilterConfig[] = useMemo(() => [
    {
      key: 'status',
      label: t('settings.marketing.filters.status'),
      type: 'multi-select',
      options: [
        { value: 'active', label: t('settings.marketing.active') },
        { value: 'inactive', label: t('settings.marketing.inactive') },
        { value: 'archived', label: t('settings.marketing.archived') },
      ]
    },
    {
      key: 'start_date',
      label: t('settings.marketing.filters.dateRange'),
      type: 'date-range'
    },
    {
      key: 'patients_count',
      label: t('settings.marketing.filters.patientsRange'),
      type: 'number-range'
    }
  ], [t])

  // Filter campaigns using custom logic (since status is derived from is_active/is_archived)
  const filteredCampaigns = useMemo(() => {
    if (!campaignsData || campaignsData.length === 0) return []

    return campaignsData.filter(campaign => {
      // Status filter (multi-select)
      const statusFilter = filterValues.status
      if (statusFilter && Array.isArray(statusFilter) && statusFilter.length > 0) {
        let campaignStatus: string
        if (campaign.archived_at || (campaign as any).is_archived) {
          campaignStatus = 'archived'
        } else if ((campaign as any).is_active !== false) {
          campaignStatus = 'active'
        } else {
          campaignStatus = 'inactive'
        }
        if (!statusFilter.includes(campaignStatus)) return false
      }

      // Date range filter (start_date)
      const dateFilter = filterValues.start_date
      if (dateFilter && (dateFilter.from || dateFilter.to)) {
        const campaignDate = (campaign as any).start_date
        if (!campaignDate) return false
        const date = new Date(campaignDate)
        if (dateFilter.from && date < new Date(dateFilter.from)) return false
        if (dateFilter.to) {
          const toDate = new Date(dateFilter.to)
          toDate.setHours(23, 59, 59, 999)
          if (date > toDate) return false
        }
      }

      // Patients count filter (number-range)
      const patientsFilter = filterValues.patients_count
      if (patientsFilter && (patientsFilter.from || patientsFilter.to)) {
        const count = campaign.patients_count || 0
        if (patientsFilter.from && count < Number(patientsFilter.from)) return false
        if (patientsFilter.to && count > Number(patientsFilter.to)) return false
      }

      return true
    })
  }, [campaignsData, filterValues])

  // Campaign columns
  const campaignColumns = [
    {
      key: 'name',
      label: t('settings.marketing.campaignName'),
      sortable: true,
      render: (_value: any, campaign: Campaign) => (
        <div className="flex items-center gap-2">
          <span className={campaign.archived_at ? 'text-muted-foreground line-through' : 'font-medium'}>
            {campaign.name}
          </span>
          {campaign.archived_at && (
            <Badge variant="outline" className="text-xs">
              {t('settings.marketing.archived')}
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'patients',
      label: t('settings.marketing.patients'),
      sortable: true,
      render: (_value: any, campaign: Campaign) => (
        <div className="font-medium">
          {campaign.patients_count || 0}
        </div>
      )
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_value: any, campaign: Campaign) => {
        const actions: ActionItem[] = []
        
        // Edit action (only for non-archived campaigns)
        if (!campaign.archived_at) {
          actions.push({
            label: t('common.edit'),
            icon: <Edit className="h-4 w-4" />,
            onClick: () => handleOpenCampaignModal(campaign)
          })
        }
        
        // Archive/Restore action
        actions.push({
          label: campaign.archived_at ? t('settings.marketing.restore') : t('settings.marketing.archive'),
          icon: campaign.archived_at ? 
            <RotateCcw className="h-4 w-4" /> : 
            <Archive className="h-4 w-4" />,
          onClick: () => handleArchiveCampaign(campaign)
        })
        
        // Delete action
        actions.push({
          label: t('common.delete'),
          icon: <Trash2 className="h-4 w-4" />,
          onClick: () => handleDeleteCampaign(campaign.id),
          variant: 'destructive',
          separator: true
        })
        
        return (
          <div className="md:flex md:justify-end">
            <ActionDropdown actions={actions} />
          </div>
        )
      }
    }
  ]

  // Mobile: Show campaigns view, Desktop: Show split view
  const showCampaignsView = selectedPlatformId !== ''

  return (
    <div className="space-y-4">
      {/* Mobile Navigation for campaigns view */}
      {showCampaignsView && (
        <div className="lg:hidden">
          <Button
            variant="ghost"
            onClick={() => setSelectedPlatformId('')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Button>
        </div>
      )}

      {/* Main Content */}
      <div className={cn(
        "grid gap-6",
        "grid-cols-1",
        "lg:grid-cols-3"
      )}>
        {/* Platforms Section - Hidden on mobile when campaign selected */}
        <div className={cn(
          "lg:col-span-1",
          showCampaignsView && "hidden lg:block"
        )}>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">{t('settings.marketing.platforms')}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('settings.marketing.platformsSubtitle')}
                </p>
              </div>
              <Button
                size="icon"
                onClick={() => handleOpenPlatformModal()}
                title={t('settings.marketing.addPlatform')}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {platforms.loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : platforms.items.length === 0 ? (
              <EmptyState
                icon={<Megaphone className="h-8 w-8" />}
                title={t('settings.marketing.noPlatforms')}
                description={t('settings.marketing.noPlatformsDescription')}
              />
            ) : (
              <div className="space-y-2">
                {platforms.items.map((platform) => (
                  <div
                    key={platform.id}
                    className={cn(
                      "p-4 rounded-lg cursor-pointer transition-all",
                      "border hover:shadow-sm",
                      selectedPlatformId === platform.id
                        ? "bg-primary/5 border-primary/20 shadow-sm"
                        : "hover:bg-muted/50 border-border"
                    )}
                    onClick={() => setSelectedPlatformId(platform.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Megaphone className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{platform.display_name}</p>
                          {platform.campaigns_count !== undefined && (
                            <p className="text-xs text-muted-foreground">
                              {platform.campaigns_count} {t('settings.marketing.campaigns').toLowerCase()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {/* Quick select chevron */}
                        <ChevronRight className={cn(
                          "h-4 w-4 transition-transform",
                          "text-muted-foreground",
                          selectedPlatformId === platform.id && "text-primary"
                        )} />
                        {/* Actions menu */}
                        <ActionDropdown 
                          actions={[
                            {
                              label: t('common.edit'),
                              icon: <Edit className="h-4 w-4" />,
                              onClick: () => handleOpenPlatformModal(platform)
                            },
                            {
                              label: t('common.delete'),
                              icon: <Trash2 className="h-4 w-4" />,
                              onClick: () => handleDeletePlatform(platform.id),
                              variant: 'destructive',
                              separator: true
                            }
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Campaigns Section - Full width on mobile when selected */}
        <div className={cn(
          "lg:col-span-2",
          !showCampaignsView && "hidden lg:block"
        )}>
          {!selectedPlatformId && !showCampaignsView ? (
            <Card className="p-12">
              <EmptyState
                icon={<Megaphone className="h-12 w-12" />}
                title={t('settings.marketing.selectPlatform')}
                description={t('settings.marketing.selectPlatformDescription')}
              />
            </Card>
          ) : selectedPlatform && (
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-semibold">
                    {t('settings.marketing.campaigns')}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedPlatform?.display_name} • {activeCampaigns.length} {t('settings.marketing.activeCampaigns')}
                  </p>
                </div>
                <Button onClick={() => handleOpenCampaignModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t('settings.marketing.addCampaign')}</span>
                  <span className="sm:hidden">{t('settings.marketing.campaign')}</span>
                </Button>
              </div>

              {campaignsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : campaignsData.length === 0 ? (
                <EmptyState
                  icon={<Megaphone className="h-8 w-8" />}
                  title={t('settings.marketing.noCampaigns')}
                  description={t('settings.marketing.noCampaignsDescription')}
                />
              ) : (
                <div className="space-y-4">
                  <SmartFilters
                    filters={campaignFilterConfigs}
                    values={filterValues}
                    onChange={setFilterValues}
                  />
                  <DataTable
                    columns={campaignColumns}
                    mobileColumns={[campaignColumns[0], campaignColumns[2]]} // Name and Actions
                    data={filteredCampaigns}
                    searchKey="name"
                    searchPlaceholder={t('settings.marketing.searchCampaigns')}
                    showCount={true}
                    countLabel={t('settings.marketing.campaigns').toLowerCase()}
                  />
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Platform Modal */}
      <FormModal
        open={platformModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPlatformModalOpen(false)
            setEditingPlatform(null)
            platformForm.reset()
          } else {
            setPlatformModalOpen(true)
          }
        }}
        title={editingPlatform ? t('settings.marketing.editPlatform') : t('settings.marketing.addPlatform')}
        onSubmit={platformForm.handleSubmit(handleSavePlatform)}
        isSubmitting={platforms.isSubmitting}
        maxWidth="sm"
      >
        <FormSection>
          <InputField
            label={t('settings.marketing.platformName')}
            value={platformForm.watch('display_name')}
            onChange={(value) => {
              const val = typeof value === 'string' ? value : value?.target?.value || ''
              platformForm.setValue('display_name', val)
            }}
            placeholder={t('settings.marketing.platformNamePlaceholder')}
            error={platformForm.formState.errors.display_name?.message ||
                   (platformForm.formState.isSubmitted && !platformForm.watch('display_name') ? t('validation.required') : undefined)}
            required
          />
        </FormSection>
      </FormModal>

      {/* Campaign Modal */}
      <FormModal
        open={campaignModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCampaignModalOpen(false)
            setEditingCampaign(null)
            campaignForm.reset()
          } else {
            setCampaignModalOpen(true)
          }
        }}
        title={editingCampaign ? t('settings.marketing.editCampaign') : t('settings.marketing.addCampaign')}
        onSubmit={campaignForm.handleSubmit(handleSaveCampaign)}
        isSubmitting={campaignSubmitting}
        maxWidth="md"
      >
        <FormSection>
          <InputField
            label={t('settings.marketing.campaignName')}
            value={campaignForm.watch('name')}
            onChange={(value) => {
              const val = typeof value === 'string' ? value : value?.target?.value || ''
              campaignForm.setValue('name', val)
            }}
            placeholder={t('settings.marketing.campaignNamePlaceholder')}
            error={campaignForm.formState.errors.name?.message ||
                   (campaignForm.formState.isSubmitted && !campaignForm.watch('name') ? t('validation.required') : undefined)}
            required
          />
          {/* Hidden field for platform_id - usando setValue para asegurar el valor */}
          <input
            type="hidden"
            value={campaignForm.watch('platform_id') || ''}
            {...campaignForm.register('platform_id')}
          />
        </FormSection>
      </FormModal>
    </div>
  )
}
