'use client';

import { useState, useEffect } from 'react';
import { SelectWithCreate, SelectOption } from './select-with-create';
import { useTranslations } from 'next-intl';
import { useCurrentClinic } from '@/hooks/use-current-clinic';

type CategoryType = 'services' | 'supplies' | 'expenses' | 'assets' | 'fixed_costs';

interface CategorySelectProps {
  /**
   * Tipo de categoría: 'services', 'supplies', 'expenses', 'assets', 'fixed_costs'
   */
  type: CategoryType;

  /**
   * Valor actual seleccionado (display_name de la categoría)
   */
  value?: string;

  /**
   * Callback cuando cambia la selección
   */
  onValueChange: (value: string) => void;

  /**
   * Placeholder del select
   */
  placeholder?: string;

  /**
   * Deshabilitar el componente
   */
  disabled?: boolean;

  /**
   * Clase CSS adicional
   */
  className?: string;
}

export function CategorySelect({
  type,
  value,
  onValueChange,
  placeholder,
  disabled = false,
  className,
}: CategorySelectProps) {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const { currentClinic } = useCurrentClinic();
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar categorías
  useEffect(() => {
    if (!currentClinic?.id) return;

    const loadCategories = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/categories?type=${type}&active=true&clinicId=${currentClinic.id}`
        );

        if (!response.ok) {
          throw new Error('Failed to load categories');
        }

        const { data } = await response.json();

        // Convertir a SelectOption usando display_name
        // Ordenar: categorías del sistema primero, luego custom
        const sorted = (data || []).sort((a: any, b: any) => {
          if (a.is_system && !b.is_system) return -1;
          if (!a.is_system && b.is_system) return 1;
          return (a.display_order || 999) - (b.display_order || 999);
        });

        const categoryOptions: SelectOption[] = sorted.map((cat: any) => ({
          value: cat.display_name || cat.name,
          label: cat.display_name || cat.name,
          id: cat.id,
          isSystem: cat.is_system || false,
          // Agregar metadata para renderizado
          metadata: {
            isSystem: cat.is_system || false,
          }
        }));

        setOptions(categoryOptions);
      } catch (error) {
        console.error('Error loading categories:', error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [currentClinic?.id, type]);

  // Función para crear nueva categoría
  const handleCreateCategory = async (formData: any): Promise<SelectOption> => {
    if (!currentClinic?.id) {
      throw new Error('No clinic context');
    }

    const response = await fetch(
      `/api/categories?type=${type}&clinicId=${currentClinic.id}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create category');
    }

    const { data } = await response.json();

    // Retornar como SelectOption
    const newOption: SelectOption = {
      value: data.display_name || data.name,
      label: data.display_name || data.name,
      id: data.id,
    };

    // Agregar a la lista local
    setOptions((prev) => [newOption, ...prev]);

    return newOption;
  };

  if (loading) {
    return (
      <div className="h-10 w-full rounded-md border border-input bg-muted animate-pulse" />
    );
  }

  return (
    <SelectWithCreate
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder || t('selectCategory')}
      searchPlaceholder={t('searchCategory')}
      emptyText={t('noCategories')}
      className={className}
      disabled={disabled}
      canCreate={true}
      createLabel={t('createNew')}
      createDialogTitle={t('createTitle')}
      createDialogDescription={t('createDescription')}
      createFields={[
        {
          name: 'name',
          label: t('categoryName'),
          type: 'text',
          placeholder: t('categoryPlaceholder'),
          required: true,
        },
      ]}
      onCreateSubmit={handleCreateCategory}
      entityName={t('category')}
    />
  );
}
