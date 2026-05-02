/**
 * Entity Selector
 *
 * Shows list of all 18 entities user can create via voice
 */

'use client'

import {
  User,
  Activity,
  Receipt,
  Briefcase,
  Package,
  Wrench,
  Calculator,
  Clock,
  Megaphone,
  Globe,
  FolderOpen,
  Building,
  Building2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

type EntityType =
  | 'patient'
  | 'treatment'
  | 'service'
  | 'supply'
  | 'asset'
  | 'fixedCost'
  | 'expense'
  | 'campaign'
  | 'platform'
  | 'category'
  | 'workspace'
  | 'clinic'
  | 'timeSetting'
  | 'patientSource'

interface EntitySelectorProps {
  onSelect: (entity: EntityType) => void
}

export function EntitySelector({ onSelect }: EntitySelectorProps) {
  const t = useTranslations('aiAssistant')

  const entities = [
    // Priority 1 - Most common
    {
      id: 'patient' as EntityType,
      icon: User,
      available: true,
      category: 'common',
    },
    {
      id: 'treatment' as EntityType,
      icon: Activity,
      available: true,
      category: 'common',
    },
    {
      id: 'expense' as EntityType,
      icon: Receipt,
      available: true,
      category: 'common',
    },
    {
      id: 'service' as EntityType,
      icon: Briefcase,
      available: true,
      category: 'common',
    },
    {
      id: 'supply' as EntityType,
      icon: Package,
      available: true,
      category: 'common',
    },

    // Priority 2 - Operations
    {
      id: 'asset' as EntityType,
      icon: Wrench,
      available: true,
      category: 'operations',
    },
    {
      id: 'fixedCost' as EntityType,
      icon: Calculator,
      available: true,
      category: 'operations',
    },
    {
      id: 'timeSetting' as EntityType,
      icon: Clock,
      available: true,
      category: 'operations',
    },

    // Priority 3 - Marketing & Setup
    {
      id: 'campaign' as EntityType,
      icon: Megaphone,
      available: true,
      category: 'marketing',
    },
    {
      id: 'platform' as EntityType,
      icon: Globe,
      available: true,
      category: 'marketing',
    },
    {
      id: 'patientSource' as EntityType,
      icon: User,
      available: true,
      category: 'marketing',
    },

    // Priority 4 - Configuration
    {
      id: 'category' as EntityType,
      icon: FolderOpen,
      available: true,
      category: 'config',
    },
    {
      id: 'workspace' as EntityType,
      icon: Building2,
      available: true,
      category: 'config',
    },
    {
      id: 'clinic' as EntityType,
      icon: Building,
      available: true,
      category: 'config',
    },
  ]

  const tCategories = useTranslations('aiAssistant.categories')
  const tMessages = useTranslations('aiAssistant.messages')

  const categories = {
    common: tCategories('common'),
    operations: tCategories('operations'),
    marketing: tCategories('marketing'),
    config: tCategories('config'),
  }

  const groupedEntities = Object.entries(categories).map(([key, label]) => ({
    key,
    label,
    entities: entities.filter((e) => e.category === key),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t('entry.selectEntity')}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {tMessages('allEntitiesAvailable')}
        </p>
      </div>

      {groupedEntities.map((group) => (
        <div key={group.key} className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {group.label}
          </h4>
          <div className="grid gap-2">
            {group.entities.map((entity) => (
              <button
                key={entity.id}
                onClick={() => entity.available && onSelect(entity.id)}
                disabled={!entity.available}
                className={`flex items-center gap-4 p-3 rounded-lg border transition-all ${
                  entity.available
                    ? 'hover:border-primary hover:bg-primary/10 dark:hover:bg-primary/20 cursor-pointer hover:scale-[1.02]'
                    : 'opacity-50 cursor-not-allowed bg-muted'
                }`}
              >
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    entity.available
                      ? 'bg-gradient-to-r from-primary to-secondary'
                      : 'bg-muted'
                  }`}
                >
                  <entity.icon className="h-5 w-5 text-white" />
                </div>

                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">{t(`entities.${entity.id}`)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
