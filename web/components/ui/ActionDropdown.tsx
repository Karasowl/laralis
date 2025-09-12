'use client'

import { MoreHorizontal, Eye, Edit, Trash2, Copy, Archive, Download } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export interface ActionItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
  separator?: boolean
}

interface ActionDropdownProps {
  actions: ActionItem[]
  align?: 'start' | 'center' | 'end'
  triggerSize?: 'sm' | 'default' | 'lg'
}

export function ActionDropdown({ 
  actions, 
  align = 'end',
  triggerSize = 'sm'
}: ActionDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size={triggerSize}
          className="w-8 h-8 p-0 shrink-0"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {actions.map((action, index) => (
          <div key={index}>
            {action.separator && index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              // Usar onSelect y ejecutar tras cerrar el menú para evitar
              // conflictos de eventos con modales Radix
              onSelect={() => setTimeout(() => action.onClick(), 50)}
              className={action.variant === 'destructive' ? 'text-destructive focus:text-destructive' : ''}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Preset action creators for common operations
export const createViewAction = (onClick: () => void, label = 'Ver detalles'): ActionItem => ({
  label,
  icon: <Eye className="h-4 w-4" />,
  onClick
})

export const createEditAction = (onClick: () => void, label = 'Editar'): ActionItem => ({
  label,
  icon: <Edit className="h-4 w-4" />,
  onClick
})

export const createDeleteAction = (onClick: () => void, label = 'Eliminar'): ActionItem => ({
  label,
  icon: <Trash2 className="h-4 w-4" />,
  onClick,
  variant: 'destructive',
  separator: true
})

export const createDuplicateAction = (onClick: () => void, label = 'Duplicar'): ActionItem => ({
  label,
  icon: <Copy className="h-4 w-4" />,
  onClick
})

export const createArchiveAction = (onClick: () => void, label = 'Archivar'): ActionItem => ({
  label,
  icon: <Archive className="h-4 w-4" />,
  onClick
})

export const createDownloadAction = (onClick: () => void, label = 'Descargar'): ActionItem => ({
  label,
  icon: <Download className="h-4 w-4" />,
  onClick
})
