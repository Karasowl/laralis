'use client'

import Link from 'next/link'
import { useWorkspace } from '@/contexts/workspace-context'
import { cn } from '@/lib/utils'

export function ContextIndicator({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { workspace, currentClinic } = useWorkspace()

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Link href="/settings/workspaces" className="no-underline">
        <span
          data-testid="current-workspace-name"
          data-cy="current-workspace"
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
            'bg-muted/60 text-foreground/80 hover:bg-muted',
          )}
          title="Workspace"
        >
          {workspace?.name || '—'}
        </span>
      </Link>
      <Link href="/settings/workspaces" className="no-underline">
        <span
          data-testid="current-clinic-name"
          data-cy="current-clinic"
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
            'bg-muted/60 text-foreground/80 hover:bg-muted',
          )}
          title="Clinic"
        >
          {currentClinic?.name || '—'}
        </span>
      </Link>
    </div>
  )
}
