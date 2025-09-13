'use client';

import * as React from 'react';
import { Check, ChevronDown, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { FormModal } from '@/components/ui/form-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export interface SelectOption {
  value: string;
  label: string;
  [key: string]: any;
}

interface SelectWithCreateProps {
  options: SelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  
  // Props para creación
  canCreate?: boolean;
  createLabel?: string;
  createDialogTitle?: string;
  createDialogDescription?: string;
  createFields?: CreateField[];
  onCreateSubmit?: (data: any) => Promise<SelectOption>;
  entityName?: string;
  // Optional: use a custom wizard for services
  createMode?: 'default' | 'serviceWizard';
  // Notify parent when an option gets created (both modes)
  onCreatedOption?: (opt: SelectOption) => void;
}

interface CreateField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'email' | 'tel' | 'url' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: SelectOption[];
}

export function SelectWithCreate({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
  disabled = false,
  canCreate = false,
  createLabel,
  createDialogTitle,
  createDialogDescription,
  createFields = [{ name: 'name', label: 'Name', required: true }],
  onCreateSubmit,
  entityName = 'item',
  createMode = 'default',
  onCreatedOption,
}: SelectWithCreateProps) {
  const t = useTranslations();
  const tCommon = useTranslations('common');
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  // Force remount of creation content each time the modal opens
  // This guarantees fresh, empty state for wizards/forms
  const [createModalKey, setCreateModalKey] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const [formData, setFormData] = React.useState<Record<string, any>>({});
  const [localOptions, setLocalOptions] = React.useState<SelectOption[]>([]);
  // Internal mirror to show selection immediately, even if parent updates async
  const [internalValue, setInternalValue] = React.useState<string>(value || '');
  const [internalLabel, setInternalLabel] = React.useState<string>('');
  React.useEffect(() => {
    // Sync down from parent when it changes externally
    setInternalValue(value || '')
  }, [value])
  // Whenever options change, try to resolve the label for the current value
  React.useEffect(() => {
    const id = (internalValue || value || '') as string
    if (!id) { setInternalLabel(''); return }
    const opt = [...localOptions, ...options].find(o => o.value === id)
    if (opt) setInternalLabel(opt.label)
  }, [internalValue, value, options, localOptions])

  // Debug/version marker
  React.useEffect(() => {
    try { console.log('[SelectWithCreate] loaded v3 - canCreate:', canCreate, 'entity:', entityName) } catch {}
  }, [])

  const computedOptions = React.useMemo(() => {
    const map = new Map<string, SelectOption>();
    [...localOptions, ...options].forEach(opt => { if (!map.has(opt.value)) map.set(opt.value, opt) })
    return Array.from(map.values())
  }, [options, localOptions])

  const selectedOption = computedOptions.find((option) => option.value === internalValue) ||
    computedOptions.find((option) => option.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!search) return computedOptions;
    
    const searchLower = search.toLowerCase();
    return computedOptions.filter((option) =>
      option.label.toLowerCase().includes(searchLower)
    );
  }, [computedOptions, search]);

  const handleCreateClick = React.useCallback(() => {
    // Cerrar popover primero para evitar superposición Popover+Dialog
    setOpen(false)
    setFormData({})
    setSearch('')
    // Abrir modal en el siguiente tick para que Radix haga unmount limpio
    setTimeout(() => {
      try { console.log('[SelectWithCreate] opening create modal for', entityName) } catch {}
      setCreateModalOpen(true)
    }, 0)
  }, [])

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!onCreateSubmit) return;

    // Validación básica
    for (const field of createFields) {
      if (field.required && !formData[field.name]) {
        toast.error(t('validation.required', { field: field.label }));
        return;
      }
    }

    setCreating(true);
    
    try {
      const newOption = await onCreateSubmit(formData);
      
      // Persist locally to show immediately
      try {
        setLocalOptions(prev => (prev.some(p => p.value === newOption.value) ? prev : [{ value: newOption.value, label: newOption.label }, ...prev]))
      } catch {}
      // Seleccionar automáticamente la nueva opción
      setInternalValue(newOption.value)
      setInternalLabel(newOption.label)
      onValueChange(newOption.value);
      try { onCreatedOption?.(newOption) } catch {}
      setCreateModalOpen(false);
      toast.success(tCommon('createSuccess', { entity: entityName }));
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error(tCommon('createError', { entity: entityName }));
    } finally {
      setCreating(false);
    }
  };

  const handleFieldChange = (fieldName: string, fieldValue: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: fieldValue }));
  };

  return (
    <>
      {!createModalOpen && (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between font-normal',
              !(internalValue || value) && 'text-muted-foreground',
              className
            )}
            disabled={disabled}
          >
            {internalLabel || (selectedOption ? selectedOption.label : (placeholder || tCommon('select')))}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput 
              placeholder={searchPlaceholder || tCommon('search')}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {emptyText || tCommon('noResults')}
              </CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={(currentValue) => {
                      try {
                        setLocalOptions(prev => (prev.some(p => p.value === option.value) ? prev : [option, ...prev]))
                      } catch {}
                      // Always set selected option by its id to avoid label/value mismatches
                  const nextValue = option.value
                      setInternalValue(nextValue)
                      setInternalLabel(option.label)
                      onValueChange(nextValue)
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        (internalValue || value) === option.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          
          {/* Opción para crear nuevo - Fuera del Command para evitar el cierre automático */
          }
          {canCreate && onCreateSubmit && (
            <div className="border-t p-1">
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary font-medium hover:bg-accent hover:text-primary-foreground active:bg-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer select-none"
                data-cy="select-create-new"
                title={createLabel || tCommon('createNew', { entity: entityName })}
                onPointerDown={(e) => {
                  // Evita que el click cierre el modal padre y abre el diálogo explícitamente
                  e.preventDefault();
                  e.stopPropagation();
                  handleCreateClick();
                }}
                // Use pointer events; avoid touchstart to prevent passive listener warning
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreateClick();
                  }
                }}
              >
                <Plus className="h-4 w-4" />
                {createLabel || tCommon('createNew', { entity: entityName })}
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      )}

      {/* Modal de creación: mismo patrón FormModal/MobileModal que el resto */}
      {createMode === 'serviceWizard' ? (
        <FormModal
          open={createModalOpen}
          onOpenChange={(open) => {
            try { console.log('[SelectWithCreate] create modal onOpenChange:', open) } catch {}
            if (open) setCreateModalKey((k) => k + 1)
            setCreateModalOpen(open)
          }}
          title={createDialogTitle || tCommon('createNewTitle', { entity: entityName })}
          description={createDialogDescription || tCommon('createNewDescription', { entity: entityName })}
          showFooter={false}
          maxWidth="md"
        >
          {(() => {
            // Lazy import to avoid circular deps
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const Mod = require('@/components/services/ServiceQuickWizard')
            const Wizard = Mod.ServiceQuickWizard as any
            return (
              <Wizard
                key={createModalKey}
                onDone={(opt: any) => {
                  try {
                    setLocalOptions(prev => (prev.some(p => p.value === opt.value) ? prev : [{ value: opt.value, label: opt.label }, ...prev]))
                  } catch {}
                  setInternalValue(opt.value)
                  onValueChange(opt.value)
                  try { onCreatedOption?.({ value: opt.value, label: opt.label }) } catch {}
                  setCreateModalOpen(false)
                }}
                onCancel={() => setCreateModalOpen(false)}
              />
            )
          })()}
        </FormModal>
      ) : (
        <FormModal
          open={createModalOpen}
          onOpenChange={(open) => {
            try { console.log('[SelectWithCreate] create modal onOpenChange:', open) } catch {}
            if (open) setCreateModalKey((k) => k + 1)
            setCreateModalOpen(open)
          }}
          title={createDialogTitle || tCommon('createNewTitle', { entity: entityName })}
          description={createDialogDescription || tCommon('createNewDescription', { entity: entityName })}
          onSubmit={handleCreateSubmit}
          cancelLabel={tCommon('cancel')}
          submitLabel={tCommon('create')}
          maxWidth="md"
        >
          <div className="grid gap-4 py-2 sm:py-4">
            {createFields.map((field) => (
              <div key={field.name} className="grid gap-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>

                {field.type === 'textarea' ? (
                  <textarea
                    id={field.name}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder={field.placeholder}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    disabled={creating}
                  />
                ) : field.type === 'select' && field.options ? (
                  <select
                    id={field.name}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    disabled={creating}
                  >
                    <option value="">{tCommon('select')}</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={field.name}
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    disabled={creating}
                  />
                )}
              </div>
            ))}
          </div>
        </FormModal>
      )}
    </>
  );
}
