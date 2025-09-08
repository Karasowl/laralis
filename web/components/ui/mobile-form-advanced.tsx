'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'

// Floating label variant for a more modern look
interface FloatingLabelFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  error?: string
  required?: boolean
  className?: string
}

export function FloatingLabelField({
  label,
  value,
  onChange,
  type = 'text',
  error,
  required,
  className
}: FloatingLabelFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const hasValue = value && value.length > 0
  const shouldFloat = isFocused || hasValue
  
  return (
    <div className={cn('relative', className)}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          'peer w-full min-h-[56px] px-4 pt-6 pb-2',
          'text-base bg-background',
          'border rounded-xl',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          error && 'border-destructive focus:ring-destructive'
        )}
        placeholder=" "
        aria-label={label}
        aria-invalid={!!error}
        aria-required={required}
      />
      <label
        className={cn(
          'absolute left-4 text-muted-foreground',
          'transition-all duration-200 pointer-events-none',
          'peer-placeholder-shown:text-base peer-placeholder-shown:top-4',
          'peer-focus:text-xs peer-focus:top-2 peer-focus:text-primary',
          shouldFloat && 'text-xs top-2',
          !shouldFloat && 'text-base top-4'
        )}
      >
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {error && (
        <p className="mt-1 text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}

// Touch-friendly radio group
interface RadioOption {
  value: string
  label: string
  description?: string
}

interface TouchRadioGroupProps {
  options: RadioOption[]
  value: string
  onChange: (value: string) => void
  label?: string
  error?: string
  className?: string
}

export function TouchRadioGroup({
  options,
  value,
  onChange,
  label,
  error,
  className
}: TouchRadioGroupProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label className="text-sm font-medium">{label}</Label>
      )}
      <div className="space-y-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'w-full min-h-[56px] px-4 py-3',
              'flex items-center justify-between',
              'border rounded-xl',
              'transition-all duration-200',
              'hover:bg-muted/50',
              value === option.value && 'border-primary bg-primary/5',
              error && 'border-destructive'
            )}
          >
            <div className="flex items-start text-left">
              <div
                className={cn(
                  'mt-0.5 mr-3 h-5 w-5 rounded-full border-2',
                  'transition-all duration-200',
                  value === option.value
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground'
                )}
              >
                {value === option.value && (
                  <div className="h-full w-full rounded-full bg-background scale-50" />
                )}
              </div>
              <div>
                <p className="font-medium">{option.label}</p>
                {option.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}

// Touch-friendly checkbox
interface TouchCheckboxProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  error?: string
  className?: string
}

export function TouchCheckbox({
  label,
  description,
  checked,
  onChange,
  error,
  className
}: TouchCheckboxProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'w-full min-h-[56px] px-4 py-3',
        'flex items-center justify-between',
        'border rounded-xl',
        'transition-all duration-200',
        'hover:bg-muted/50',
        checked && 'border-primary bg-primary/5',
        error && 'border-destructive',
        className
      )}
    >
      <div className="flex items-start text-left">
        <div
          className={cn(
            'mt-0.5 mr-3 h-5 w-5 rounded',
            'border-2 transition-all duration-200',
            'flex items-center justify-center',
            checked
              ? 'border-primary bg-primary'
              : 'border-muted-foreground'
          )}
        >
          {checked && (
            <svg
              className="h-3 w-3 text-background"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium">{label}</p>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

export default {
  FloatingLabelField,
  TouchRadioGroup,
  TouchCheckbox
}