'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResetOptionProps {
  id: string
  label: string
  description: string
  dangerous?: boolean
  selected: boolean
  disabled?: boolean
  status?: 'pending' | 'success' | 'error'
  onToggle: () => void
}

export function ResetOption({
  id,
  label,
  description,
  dangerous,
  selected,
  disabled,
  status,
  onToggle
}: ResetOptionProps) {
  return (
    <div
      className={cn(
        "flex items-start space-x-3 p-4 rounded-lg border transition-colors",
        dangerous ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-border",
        selected && "bg-accent"
      )}
    >
      <Checkbox
        id={id}
        checked={selected}
        onCheckedChange={onToggle}
        disabled={disabled}
      />
      <div className="flex-1 space-y-1">
        <label
          htmlFor={id}
          className={cn(
            "text-sm font-medium cursor-pointer",
            dangerous && "text-red-600 dark:text-red-400"
          )}
        >
          {label}
        </label>
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {status && (
        <div className="flex items-center">
          {status === 'pending' && (
            <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
          )}
          {status === 'success' && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          {status === 'error' && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </div>
      )}
    </div>
  )
}