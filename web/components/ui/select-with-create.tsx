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
import { ResponsiveModal } from '@/components/ui/responsive-modal';
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
}: SelectWithCreateProps) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [formData, setFormData] = React.useState<Record<string, any>>({});

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    
    const searchLower = search.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchLower)
    );
  }, [options, search]);

  const handleCreateClick = React.useCallback(() => {
    // Abre primero el modal de creación y luego cierra el popover.
    // Esto evita que los manejadores de cierre del popover/diálogo padre
    // “consuman” el click antes de que podamos abrir el modal.
    setCreateModalOpen(true);
    setFormData({});
    setSearch('');
    // Cierra el popover con un pequeño retraso para evitar carreras.
    requestAnimationFrame(() => {
      setTimeout(() => {
        setOpen(false);
      }, 100);
    });
    if (process.env.NODE_ENV !== 'production') {
      // Debug visual en desarrollo
      try { console.debug('[SelectWithCreate] New click → open modal'); } catch {}
      try { toast.info(`Opening new ${entityName}…`); } catch {}
    }
  }, []);

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
      
      // Seleccionar automáticamente la nueva opción
      onValueChange(newOption.value);
      setCreateModalOpen(false);
      toast.success(t('common.createSuccess', { entity: entityName }));
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error(t('common.createError', { entity: entityName }));
    } finally {
      setCreating(false);
    }
  };

  const handleFieldChange = (fieldName: string, fieldValue: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: fieldValue }));
  };

  return (
    <>
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between font-normal',
              !value && 'text-muted-foreground',
              className
            )}
            disabled={disabled}
          >
            {selectedOption ? selectedOption.label : placeholder || t('common.select')}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start" onInteractOutside={(e) => e.preventDefault()}>
          <Command>
            <CommandInput 
              placeholder={searchPlaceholder || t('common.search')}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {emptyText || t('common.noResults')}
              </CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={(currentValue) => {
                      onValueChange(currentValue === value ? '' : currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === option.value ? 'opacity-100' : 'opacity-0'
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
                title={createLabel || t('common.createNew', { entity: entityName })}
                onPointerDown={(e) => {
                  // Evita que Radix Dialog/MobileModal interprete como click fuera
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onMouseUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCreateClick();
                }}
                onMouseEnter={() => {
                  if (process.env.NODE_ENV !== 'production') {
                    try { console.debug('[SelectWithCreate] Hover on create-new'); } catch {}
                  }
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
                {createLabel || t('common.createNew', { entity: entityName })}
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Modal de creación (responsive: Drawer en móvil, Dialog en desktop) */}
      <ResponsiveModal
        open={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open);
          if (process.env.NODE_ENV !== 'production') {
            try { console.debug('[SelectWithCreate] createModalOpen =', open); } catch {}
            try { toast.message(`Modal ${open ? 'opened' : 'closed'}`); } catch {}
          }
        }}
        title={createDialogTitle || t('common.createNewTitle', { entity: entityName })}
        description={createDialogDescription || t('common.createNewDescription', { entity: entityName })}
      >
        <form onSubmit={handleCreateSubmit}>
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
                    <option value="">{t('common.select')}</option>
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
          <div className="mt-4 flex justify-end gap-2 sm:mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              disabled={creating}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.create')}
            </Button>
          </div>
        </form>
      </ResponsiveModal>
    </>
  );
}
