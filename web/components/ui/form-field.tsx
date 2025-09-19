'use client';

import * as React from 'react';
import { useState, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BaseFieldProps {
  id?: string;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
}

interface InputFieldProps extends BaseFieldProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'time' | 'datetime-local';
  placeholder?: string;
  value: string | number;
  onChange: (value: string | number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  inputRef?: React.Ref<HTMLInputElement>;
}

export function InputField({
  id,
  label,
  error,
  helperText,
  required,
  disabled,
  className,
  containerClassName,
  type = 'text',
  placeholder,
  value,
  onChange,
  min,
  max,
  step,
  inputRef,
}: InputFieldProps) {
  const fieldId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const [showPassword, setShowPassword] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  // Determinar el tipo real del input basado en si es password y si se debe mostrar
  const inputType = type === 'password' ? (showPassword ? 'text' : 'password') : type;
  
  const displayValue = ((): string | number => {
    if (type === 'number') {
      if (value === '' as any) return ''
      // Preserve 0 explicitly; otherwise allow empty string while typing
      if (typeof value === 'number') return Number.isFinite(value) ? value : ''
      return value ?? ''
    }
    return value ?? ''
  })()

  const handleRef = React.useCallback((node: HTMLInputElement | null) => {
    if (type === 'date' && dateInputRef) {
      try { (dateInputRef as React.MutableRefObject<HTMLInputElement | null>).current = node } catch {}
    }
    if (!inputRef) return
    if (typeof inputRef === 'function') {
      inputRef(node)
    } else {
      try { (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node } catch {}
    }
  }, [inputRef, type])

  return (
    <div className={cn('space-y-1', containerClassName)}>
      {label && (
        <Label htmlFor={fieldId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <Input
          ref={handleRef}
          id={fieldId}
          type={inputType}
          value={displayValue}
          onChange={(e) => {
            if (type === 'number') {
              const raw = e.target.value
              // Allow clearing the field without forcing 0
              if (raw === '') { onChange(''); return }
              const n = Number(raw)
              if (!Number.isNaN(n)) onChange(n)
              return
            }
            onChange(e.target.value)
          }}
          onFocus={(e) => {
            // Facilita reemplazar el 0 inicial: selecciona todo al enfocar
            try { (e.target as HTMLInputElement).select() } catch {}
          }}
          placeholder={type === 'date' ? undefined : placeholder}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          className={cn(
            'mt-1 h-12 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400 transition-all',
            type === 'password' && 'pr-12',
            type === 'date' && 'cursor-pointer',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
        />
        {/* For date inputs, rely on the native calendar indicator only (no extra icon) */}
        {type === 'password' && value && String(value).length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-1 h-10 px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-gray-500" />
            ) : (
              <Eye className="h-4 w-4 text-gray-500" />
            )}
            <span className="sr-only">
              {showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            </span>
          </Button>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helperText}</p>
      )}
    </div>
  );
}

interface TextareaFieldProps extends BaseFieldProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

export function TextareaField({
  id,
  label,
  error,
  helperText,
  required,
  disabled,
  className,
  containerClassName,
  placeholder,
  value,
  onChange,
  rows = 3,
}: TextareaFieldProps) {
  const fieldId = id || label?.toLowerCase().replace(/\s+/g, '-');
  
  return (
    <div className={cn('space-y-1', containerClassName)}>
      {label && (
        <Label htmlFor={fieldId} className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Textarea
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={cn(
          'mt-1',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}
      />
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helperText}</p>
      )}
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends BaseFieldProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}

export function SelectField({
  id,
  label,
  error,
  helperText,
  required,
  disabled,
  className,
  containerClassName,
  placeholder,
  value,
  onChange,
  options,
}: SelectFieldProps) {
  const fieldId = id || label?.toLowerCase().replace(/\s+/g, '-');
  
  return (
    <div className={cn('space-y-1', containerClassName)}>
      {label && (
        <Label htmlFor={fieldId} className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={fieldId}
          className={cn(
            'mt-1 w-full',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              {placeholder || 'No options available'}
            </div>
          ) : (
            options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helperText}</p>
      )}
    </div>
  );
}

// Grid wrapper for responsive form layouts
interface FormGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function FormGrid({ children, columns = 2, className }: FormGridProps) {
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[columns];

  return (
    <div className={cn(`grid ${gridClass} gap-4`, className)}>
      {children}
    </div>
  );
}

// Section wrapper for form organization
interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div className="pb-2 border-b">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
