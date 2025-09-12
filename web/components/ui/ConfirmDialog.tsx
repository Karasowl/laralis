'use client'

import { ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, Info, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive' | 'warning'
  icon?: ReactNode
  loading?: boolean
}

const variantConfig = {
  default: {
    icon: <Info className="h-5 w-5 text-blue-500" />,
    buttonClass: '',
    iconBg: 'bg-blue-50',
  },
  destructive: {
    icon: <Trash2 className="h-5 w-5 text-destructive" />,
    buttonClass: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    iconBg: 'bg-destructive/10',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    buttonClass: 'bg-amber-500 text-white hover:bg-amber-600',
    iconBg: 'bg-amber-50',
  },
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'default',
  icon,
  loading = false,
}: ConfirmDialogProps) {
  const config = variantConfig[variant]
  const displayIcon = icon || config.icon

  const handleConfirm = async () => {
    try {
      await onConfirm()
      // Don't close here - let the parent component handle it
      // This prevents double closing which can cause issues on mobile
    } catch (error) {
      console.error('Error in confirm action:', error)
      // Still don't close on error - let parent handle it
    }
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className={cn('rounded-lg p-2', config.iconBg)}>
              {displayIcon}
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-lg">
                {title}
              </AlertDialogTitle>
              {description ? (
                <AlertDialogDescription className="mt-2">
                  {description}
                </AlertDialogDescription>
              ) : (
                // Provide an accessible description even when visually hidden
                <AlertDialogDescription className="sr-only">
                  Dialog confirmation
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel 
            onClick={handleCancel}
            disabled={loading}
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={cn(config.buttonClass)}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Procesando...
              </span>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Preset creators for common use cases
export const createDeleteConfirm = (
  onConfirm: () => void | Promise<void>,
  itemName?: string
): Partial<ConfirmDialogProps> => ({
  title: '¿Eliminar registro?',
  description: itemName 
    ? `Esta acción no se puede deshacer. Se eliminará permanentemente "${itemName}".`
    : 'Esta acción no se puede deshacer. El registro será eliminado permanentemente.',
  confirmText: 'Eliminar',
  cancelText: 'Cancelar',
  variant: 'destructive',
  onConfirm,
})

export const createArchiveConfirm = (
  onConfirm: () => void | Promise<void>,
  itemName?: string
): Partial<ConfirmDialogProps> => ({
  title: '¿Archivar registro?',
  description: itemName 
    ? `"${itemName}" será movido al archivo. Podrás restaurarlo más tarde si lo necesitas.`
    : 'El registro será archivado. Podrás restaurarlo más tarde si lo necesitas.',
  confirmText: 'Archivar',
  cancelText: 'Cancelar',
  variant: 'warning',
  onConfirm,
})

export const createSaveConfirm = (
  onConfirm: () => void | Promise<void>
): Partial<ConfirmDialogProps> => ({
  title: '¿Guardar cambios?',
  description: 'Se guardarán todos los cambios realizados.',
  confirmText: 'Guardar',
  cancelText: 'Cancelar',
  variant: 'default',
  onConfirm,
})
