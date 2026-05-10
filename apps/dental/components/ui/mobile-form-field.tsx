'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle, Info, CheckCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'

interface MobileFormFieldProps {
  label: string
  error?: string
  success?: string
  required?: boolean
  helpText?: string
  children: React.ReactNode
  className?: string
  labelClassName?: string
  id?: string
}

export function MobileFormField({
  label,
  error,
  success,
  required,
  helpText,
  children,
  className,
  labelClassName,
  id
}: MobileFormFieldProps) {
  // Generate a unique ID if not provided
  const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`
  
  // Clone the child element and add accessibility props
  const enhancedChild = React.cloneElement(children as React.ReactElement, {
    id: fieldId,
    'aria-describedby': error ? `${fieldId}-error` : helpText ? `${fieldId}-help` : undefined,
    'aria-invalid': !!error,
    'aria-required': required,
    className: cn(
      // Base styles
      'w-full transition-all duration-200',
      
      // Touch-friendly sizing
      'min-h-[48px] px-4 py-3',
      
      // Text sizing to prevent zoom on iOS
      'text-base',
      
      // Border and background
      'rounded-xl border bg-background',
      
      // Focus styles
      'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
      
      // Error state
      error && 'border-destructive focus:ring-destructive',
      
      // Success state
      success && 'border-green-500 focus:ring-green-500',
      
      // Original className from child
      (children as React.ReactElement).props.className
    )
  })
  
  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <Label 
        htmlFor={fieldId}
        className={cn(
          'flex items-center gap-1 text-sm font-medium',
          'cursor-pointer select-none',
          labelClassName
        )}
      >
        {label}
        {required && (
          <span className="text-destructive" aria-label="required">
            *
          </span>
        )}
      </Label>
      
      {/* Input container */}
      <div className="relative">
        {enhancedChild}
        
        {/* Status icon inside input */}
        {(error || success) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {error && <AlertCircle className="h-5 w-5 text-destructive" />}
            {success && <CheckCircle className="h-5 w-5 text-green-500" />}
          </div>
        )}
      </div>
      
      {/* Help text or error message */}
      {error ? (
        <p 
          id={`${fieldId}-error`}
          className="text-sm text-destructive flex items-center gap-1"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      ) : success ? (
        <p className="text-sm text-green-600 flex items-center gap-1">
          <CheckCircle className="h-3 w-3 flex-shrink-0" />
          {success}
        </p>
      ) : helpText ? (
        <p 
          id={`${fieldId}-help`}
          className="text-sm text-muted-foreground flex items-start gap-1"
        >
          <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
          {helpText}
        </p>
      ) : null}
    </div>
  )
}

// Form section component for grouping related fields
interface FormSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function FormSection({
  title,
  description,
  children,
  className
}: FormSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
}

// Responsive form grid for side-by-side fields on larger screens
interface FormGridProps {
  children: React.ReactNode
  cols?: {
    mobile?: number
    tablet?: number
    desktop?: number
  }
  className?: string
}

export function FormGrid({
  children,
  cols = { mobile: 1, tablet: 2, desktop: 2 },
  className
}: FormGridProps) {
  const gridClass = cn(
    'grid gap-4',
    cols.mobile === 1 && 'grid-cols-1',
    cols.mobile === 2 && 'grid-cols-2',
    cols.tablet === 2 && 'sm:grid-cols-2',
    cols.tablet === 3 && 'sm:grid-cols-3',
    cols.desktop === 2 && 'lg:grid-cols-2',
    cols.desktop === 3 && 'lg:grid-cols-3',
    cols.desktop === 4 && 'lg:grid-cols-4',
    className
  )
  
  return <div className={gridClass}>{children}</div>
}

export default {
  MobileFormField,
  FormSection,
  FormGrid
}