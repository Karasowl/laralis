'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useWorkspace } from '@/contexts/workspace-context'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function ContextIndicator({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations('navigation')
  const { workspace, currentClinic } = useWorkspace()
  const [fallback, setFallback] = useState<{ ws?: string; clinic?: string }>({})

  useEffect(() => {
    if (workspace?.name && currentClinic?.name) return
    try {
      const ws = localStorage.getItem('selectedWorkspaceName') || undefined
      const clinic = localStorage.getItem('selectedClinicName') || undefined
      setFallback({ ws, clinic })
    } catch {}
  }, [workspace?.name, currentClinic?.name])

  useEffect(() => {
    try {
      if (workspace?.name) {
        localStorage.setItem('selectedWorkspaceName', workspace.name)
      }
      if (currentClinic?.name) {
        localStorage.setItem('selectedClinicName', currentClinic.name)
      }
    } catch {}
  }, [workspace?.name, currentClinic?.name])

  const wsName = workspace?.name || fallback.ws || '-'
  const clinicName = currentClinic?.name || fallback.clinic || '-'
  const workspaceHref = '/settings/workspaces#workspaces-section'
  const clinicHref = '/settings/workspaces#clinics-section'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Link href={workspaceHref} className="no-underline">
        <span
          data-testid="current-workspace-name"
          data-cy="current-workspace"
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
            'bg-muted/60 text-foreground/80 hover:bg-muted',
          )}
          title={t('workspaces')}
        >
          {wsName}
        </span>
      </Link>
      <Link href={clinicHref} className="no-underline">
        <span
          data-testid="current-clinic-name"
          data-cy="current-clinic"
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
            'bg-muted/60 text-foreground/80 hover:bg-muted',
          )}
          title={t('clinics')}
        >
          {clinicName}
        </span>
      </Link>
    </div>
  )
}
