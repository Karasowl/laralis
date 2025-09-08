'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from './drawer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './dialog'

interface ResponsiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}

export function ResponsiveModal({
  open,
  onOpenChange,
  children,
  title,
  description,
  className,
  showCloseButton = true,
}: ResponsiveModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn('max-w-2xl', className)}>
          {(title || description) && (
            <DialogHeader>
              {title && <DialogTitle>{title}</DialogTitle>}
              {description ? (
                <DialogDescription>{description}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">Dialog content</DialogDescription>
              )}
            </DialogHeader>
          )}
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn('px-4', className)}>
        {(title || description) && (
          <DrawerHeader className="text-left">
            {title && <DrawerTitle>{title}</DrawerTitle>}
            {description ? (
              <DrawerDescription>{description}</DrawerDescription>
            ) : (
              <DrawerDescription className="sr-only">Dialog content</DrawerDescription>
            )}
          </DrawerHeader>
        )}
        <div className="px-4 pb-safe">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// Mobile-optimized form field components
export function MobileFormField({
  label,
  children,
  error,
  required,
}: {
  label: string
  children: React.ReactNode
  error?: string
  required?: boolean
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}
    </div>
  )
}

// Touch-optimized button group
export function MobileButtonGroup({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn(
      'flex gap-3 pt-6 pb-safe',
      'flex-col sm:flex-row sm:justify-end',
      className
    )}>
      {children}
    </div>
  )
}