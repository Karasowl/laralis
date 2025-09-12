'use client'

import { CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface ChecklistItemProps {
  label: string
  completed: boolean
  count?: number | null
}

export function ChecklistItem({ label, completed, count }: ChecklistItemProps) {
  const t = useTranslations('common')
  
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center space-x-3">
        {completed ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
        )}
        <span className={cn(
          "text-sm",
          completed && "text-muted-foreground line-through"
        )}>
          {label}
        </span>
      </div>
      {count !== null && count !== undefined && (
        <span className="text-xs text-muted-foreground">
          ({count} {count === 1 ? t('record') : t('records')})
        </span>
      )}
    </div>
  )
}