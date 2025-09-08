'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { CrudPageLayout } from '@/components/ui/crud-page-layout'
import { FormModal } from '@/components/ui/form-modal'
import { FormGrid, FormSection, InputField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { Archive, Trash2, RotateCcw, Megaphone } from 'lucide-react'
import { useCrudOperations } from '@/hooks/use-crud-operations'
import { useWorkspace } from '@/contexts/workspace-context'
import { formatMoney } from '@/lib/money'
import { Form } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// Schemas
const platformSchema = z.object({
  display_name: z.string().min(1, 'Name is required'),
  clinic_id: z.string()
})

const campaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  platform_id: z.string(),
  budget_cents: z.number().min(0).optional(),
  is_active: z.boolean().default(true)
})

type Platform = z.infer<typeof platformSchema> & { id: string }
type Campaign = z.infer<typeof campaignSchema> & { 
  id: string
  platform?: Platform
  archived_at?: string | null
}

export default function MarketingSettingsClient() {
  const t = useTranslations()
  const { currentClinic } = useWorkspace()
  
  // Platform CRUD
  const platforms = useCrudOperations<Platform>({
    endpoint: '/api/marketing/platforms',
    queryParams: currentClinic?.id ? `clinicId=${currentClinic.id}` : '',
    entityName: 'platform',
    autoLoad: true
  })

  // Campaign CRUD
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('')
  const campaigns = useCrudOperations<Campaign>({
    endpoint: '/api/marketing/campaigns',
    queryParams: selectedPlatformId ? `platformId=${selectedPlatformId}&includeArchived=true` : '',
    entityName: 'campaign',
    autoLoad: false
  })

  // Load campaigns when platform changes
  useEffect(() => {
    if (selectedPlatformId) {
      campaigns.fetchItems()
    }
  }, [selectedPlatformId])

  // Forms
  const [platformModalOpen, setPlatformModalOpen] = useState(false)
  const [campaignModalOpen, setCampaignModalOpen] = useState(false)
  
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
      platform_id: '',
      budget_cents: 0,
      is_active: true
    }
  })

  // Reset campaign form when selected platform changes
  useEffect(() => {
    campaignForm.setValue('platform_id', selectedPlatformId)
  }, [selectedPlatformId, campaignForm])

  // Platform handlers
  const handleCreatePlatform = async (data: z.infer<typeof platformSchema>) => {
    if (!currentClinic?.id) {
      return
    }

    const result = await platforms.handleCreate({
      ...data,
      clinic_id: currentClinic.id
    })

    if (result.success) {
      setPlatformModalOpen(false)
      platformForm.reset()
    }
  }

  // Campaign handlers
  const handleCreateCampaign = async (data: z.infer<typeof campaignSchema>) => {
    const result = await campaigns.handleCreate({
      ...data,
      platform_id: selectedPlatformId
    })

    if (result.success) {
      setCampaignModalOpen(false)
      campaignForm.reset()
    }
  }

  const handleArchiveCampaign = async (campaign: Campaign) => {
    const isArchived = !!campaign.archived_at
    const endpoint = `/api/marketing/campaigns/${campaign.id}/${isArchived ? 'unarchive' : 'archive'}`
    
    const res = await fetch(endpoint, { method: 'PATCH' })
    if (res.ok) {
      campaigns.fetchItems()
    }
  }

  // Platform columns
  const platformColumns = [
    {
      key: 'name',
      label: t('settings.marketing.platformName'),
      render: (platform: Platform) => {
        if (!platform) return null
        return <div className="font-medium">{(platform as any).display_name || (platform as any).name}</div>
      }
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (platform: Platform) => {
        if (!platform) return null
        return (
          <div className="flex gap-2">
            <Button
              variant={selectedPlatformId === platform.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPlatformId(platform.id)}
            >
              {t('settings.marketing.viewCampaigns')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => platforms.handleDelete(platform.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      }
    }
  ]

  // Campaign columns
  const campaignColumns = [
    {
      key: 'name',
      label: t('settings.marketing.campaignName'),
      render: (campaign: Campaign) => (
        <div className="flex items-center gap-2">
          <span className={campaign.archived_at ? 'line-through opacity-50' : ''}>
            {campaign.name}
          </span>
          {campaign.archived_at && (
            <span className="text-xs text-muted-foreground">
              ({t('settings.marketing.archived')})
            </span>
          )}
        </div>
      )
    },
    {
      key: 'budget',
      label: t('settings.marketing.budget'),
      render: (campaign: Campaign) => 
        campaign.budget_cents ? formatMoney(campaign.budget_cents) : '-'
    },
    {
      key: 'status',
      label: t('settings.marketing.status'),
      render: (campaign: Campaign) => (
        <span className={`px-2 py-1 rounded text-xs ${
          campaign.archived_at ? 'bg-gray-100 text-gray-600' :
          campaign.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {campaign.archived_at ? t('settings.marketing.archived') : 
           campaign.is_active ? t('settings.marketing.active') : t('settings.marketing.inactive')}
        </span>
      )
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (campaign: Campaign) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleArchiveCampaign(campaign)}
            title={campaign.archived_at ? t('settings.marketing.restore') : t('settings.marketing.archive')}
          >
            {campaign.archived_at ? 
              <RotateCcw className="h-4 w-4" /> : 
              <Archive className="h-4 w-4" />
            }
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => campaigns.handleDelete(campaign.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ]

  const selectedPlatform = platforms.items.find(p => p.id === selectedPlatformId)

  return (
    <div className="space-y-6">
      {/* Platforms Section */}
      <CrudPageLayout
        title={t('settings.marketing.platforms')}
        subtitle={t('settings.marketing.platformsSubtitle')}
        items={platforms.items}
        loading={platforms.loading}
        columns={platformColumns}
        onAdd={() => setPlatformModalOpen(true)}
        searchPlaceholder={t('settings.marketing.searchPlatforms')}
        addButtonLabel={t('settings.marketing.addPlatform')}
        emptyIcon={<Megaphone className="h-8 w-8" />}
        emptyTitle={t('settings.marketing.noPlatforms')}
        emptyDescription={t('settings.marketing.noPlatformsDescription')}
      />

      {/* Campaigns Section */}
      {selectedPlatformId && selectedPlatform && (
        <CrudPageLayout
          title={t('settings.marketing.campaigns')}
          subtitle={`${t('settings.marketing.campaignsFor')} ${selectedPlatform.name}`}
          items={campaigns.items}
          loading={campaigns.loading}
          columns={campaignColumns}
          onAdd={() => setCampaignModalOpen(true)}
          searchPlaceholder={t('settings.marketing.searchCampaigns')}
          addButtonLabel={t('settings.marketing.addCampaign')}
          emptyIcon={<Megaphone className="h-8 w-8" />}
          emptyTitle={t('settings.marketing.noCampaigns')}
          emptyDescription={t('settings.marketing.noCampaignsDescription')}
        />
      )}

      {/* Platform Modal */}
      <FormModal
        open={platformModalOpen}
        onOpenChange={setPlatformModalOpen}
        title={t('settings.marketing.addPlatform')}
        onSubmit={platformForm.handleSubmit(handleCreatePlatform)}
        isSubmitting={platforms.isSubmitting}
        maxWidth="sm"
      >
        <Form {...platformForm}>
          <FormSection>
            <InputField
              label={t('settings.marketing.platformName')}
              value={platformForm.watch('display_name')}
              onChange={(value) => platformForm.setValue('display_name', value as string)}
              placeholder={t('settings.marketing.platformNamePlaceholder')}
              error={(platformForm.formState.errors as any).display_name?.message}
              required
            />
          </FormSection>
        </Form>
      </FormModal>

      {/* Campaign Modal */}
      <FormModal
        open={campaignModalOpen}
        onOpenChange={setCampaignModalOpen}
        title={t('settings.marketing.addCampaign')}
        onSubmit={campaignForm.handleSubmit(handleCreateCampaign)}
        isSubmitting={campaigns.isSubmitting}
        maxWidth="md"
      >
        <Form {...campaignForm}>
          <FormSection>
            <FormGrid columns={2}>
              <InputField
                label={t('settings.marketing.campaignName')}
                value={campaignForm.watch('name')}
                onChange={(value) => campaignForm.setValue('name', value as string)}
                placeholder={t('settings.marketing.campaignNamePlaceholder')}
                error={campaignForm.formState.errors.name?.message}
                required
              />
              
              <InputField
                type="number"
                label={t('settings.marketing.budget')}
                value={campaignForm.watch('budget_cents') ? 
                  (campaignForm.watch('budget_cents')! / 100).toFixed(2) : ''}
                onChange={(value) => 
                  campaignForm.setValue('budget_cents', parseFloat(value as string) * 100)}
                placeholder="0.00"
                error={campaignForm.formState.errors.budget_cents?.message}
              />
            </FormGrid>
          </FormSection>
        </Form>
      </FormModal>
    </div>
  )
}
