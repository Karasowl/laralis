'use client'

import React from 'react'
import { cn } from '@/lib/utils'

type LoadingProps = {
  className?: string
  fullscreen?: boolean
  message?: string
  subtitle?: string
  compact?: boolean
}

// Unified loading component for the whole app
// - fullscreen: covers viewport with branded gradient
// - compact: smaller footprint (e.g., inside cards/sections)
export function Loading({ className, fullscreen, message, subtitle, compact }: LoadingProps) {
  const Container = ({ children }: { children: React.ReactNode }) => (
    <div
      className={cn(
        'w-full',
        fullscreen
          ? 'min-h-screen flex items-center justify-center relative overflow-hidden'
          : compact
          ? 'py-6'
          : 'py-16',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {children}
    </div>
  )

  return (
    <Container>
      {fullscreen && (
        <div className="absolute inset-0 -z-10">
          {/* Subtle brand gradient and blobs */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 dark:from-background dark:via-primary/10 dark:to-accent/10" />
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/30 dark:bg-primary/40 rounded-full mix-blend-multiply filter blur-2xl animate-blob" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/20 dark:bg-primary/30 rounded-full mix-blend-multiply filter blur-2xl animate-blob animation-delay-2000" />
          <div className="absolute top-40 left-40 w-80 h-80 bg-accent/30 dark:bg-accent/40 rounded-full mix-blend-multiply filter blur-2xl animate-blob animation-delay-4000" />
        </div>
      )}

      <div className="flex flex-col items-center gap-5">
        {/* Fancy spinner */}
        <div className={cn('relative', compact ? 'h-10 w-10' : 'h-14 w-14')}>
          {/* outer gradient ring */}
          <div
            className={cn(
              'absolute inset-0 rounded-full',
              'bg-gradient-to-tr from-primary via-primary/80 to-accent',
              'opacity-80 animate-spin [animation-duration:1.2s]'
            )}
            style={{ mask: 'radial-gradient(farthest-side,transparent calc(100% - 6px),#000 0)' }}
          />
          {/* inner dot */}
          <div className="absolute inset-[18%] rounded-full bg-background/80 dark:bg-black/50 backdrop-blur-sm" />
        </div>

        {/* Texts */}
        <div className="text-center">
          <div className="text-sm font-medium text-foreground/80">
            {message || 'Cargando...'}
          </div>
          {subtitle && (
            <div className="mt-1 text-xs text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>

        {/* Subtle skeleton shimmer (only when not compact) */}
        {!compact && (
          <div className="mt-2 w-72 max-w-[80vw] space-y-2">
            <div className="h-2 rounded bg-muted/60 overflow-hidden">
              <div className="h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-muted to-transparent" />
            </div>
            <div className="h-2 w-2/3 rounded bg-muted/60 overflow-hidden">
              <div className="h-full w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-muted to-transparent" />
            </div>
          </div>
        )}
      </div>
    </Container>
  )}

export default Loading

