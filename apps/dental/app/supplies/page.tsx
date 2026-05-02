'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SimpleCrudPage } from '@/components/ui/crud-page-layout';
import { FormModal } from '@/components/ui/form-modal';
import { InputField, SelectField, FormGrid } from '@/components/ui/form-field';
import { useCrudOperations } from '@/hooks/use-crud-operations';
import { formatCurrency } from '@/lib/money';
import { getSupplyCategoryLabel } from '@/lib/format';
import { Supply, SupplyCategory } from '@/lib/types';
import { zSupplyForm } from '@/lib/zod';
import { Package, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { z } from 'zod';
import { useCategories, CategoryRow } from '@/hooks/use-categories';
import { CategoryModal } from '@/app/services/components/CategoryModal';
import { useWorkspace } from '@/contexts/workspace-context';
import { useRouter } from 'next/navigation';
import { SmartFilters, useSmartFilter, FilterConfig, FilterValues } from '@/components/ui/smart-filters';

type SupplyFormData = z.infer<typeof zSupplyForm>;

export default function SuppliesPage() {
  const t = useTranslations();
  const { workspace } = useWorkspace();
  const router = useRouter();
  const {
    categories: catList,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategories('supplies')
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [filterValues, setFilterValues] = useState<FilterValues>({})
  
  // Use the centralized CRUD hook
  const crud = useCrudOperations<Supply>({
    endpoint: '/api/supplies',
    entityName: t('supplies.entity'),
    includeClinicId: true,
    searchParam: 'search',
  });

  // Form handling
  const {
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<SupplyFormData>({
    resolver: zodResolver(zSupplyForm),
    defaultValues: {
      name: '',
      category: 'insumo',
      presentation: '',
      price_pesos: 0,
      portions: 1,
      stock_quantity: 0,
      min_stock_alert: 10
    },
    mode: 'onBlur', // PERFORMANCE: Validate only on blur
  });

  const supplyInitialValues: SupplyFormData = {
    name: '',
    category: 'insumo',
    presentation: '',
    price_pesos: 0,
    portions: 1,
    stock_quantity: 0,
    min_stock_alert: 10
  }

  // Live preview calculation
  const watchedValues = watch();
  const costPerPortionPreview = watchedValues.price_pesos > 0 && watchedValues.portions > 0
    ? Math.round((watchedValues.price_pesos * 100) / watchedValues.portions)
    : 0;

  // Form submission
  const onSubmit = async (data: SupplyFormData) => {
    const payload = {
      name: data.name,
      category: data.category,
      presentation: data.presentation,
      price_pesos: data.price_pesos,
      portions: data.portions,
      stock_quantity: data.stock_quantity ?? 0,
      min_stock_alert: data.min_stock_alert ?? 10
    };

    const success = crud.editingItem
      ? await crud.handleUpdate(crud.editingItem.id, payload)
      : await crud.handleCreate(payload);

    if (success) {
      crud.closeDialog();
      reset();
      if (!crud.editingItem) {
        try {
          if (typeof window !== 'undefined') {
            window.localStorage?.setItem('setup_supplies_done', 'true');
          }
        } catch {}
        // Redirect back to Setup only if we are in onboarding flow.
        const fromSetup = (typeof window !== 'undefined' && sessionStorage.getItem('return_to_setup') === '1')
        const inOnboarding = (workspace?.onboarding_completed === false) || (workspace?.onboarding_completed === undefined && fromSetup)
        if (inOnboarding) {
          try { if (typeof window !== 'undefined') sessionStorage.removeItem('return_to_setup') } catch {}
          setTimeout(() => router.push('/setup'), 0);
        }
      }
    }
  };

  // Handle edit
  const handleEdit = (supply: Supply) => {
    crud.handleEdit(supply);

    reset({
      name: supply.name,
      category: (supply.category || 'insumo') as SupplyCategory,
      presentation: supply.presentation || '',
      price_pesos: supply.price_cents / 100,
      portions: supply.portions,
      stock_quantity: supply.stock_quantity ?? 0,
      min_stock_alert: supply.min_stock_alert ?? 10
    });
  };

  // Handle dialog open
  const handleOpenDialog = () => {
    reset(supplyInitialValues);
    crud.openDialog();
  };

  // Onboarding autofix: open create dialog if flagged by sessionStorage
  if (typeof window !== 'undefined') {
    try {
      const flag = sessionStorage.getItem('auto_open_supplies_importer')
      if (flag) {
        sessionStorage.removeItem('auto_open_supplies_importer')
        setTimeout(() => { try { handleOpenDialog() } catch {} }, 0)
      }
    } catch {}
  }

  // Table columns with responsive visibility
  // Essential columns (visible on tablet+): Name, Price, Portions, Cost/Portion
  // Optional columns (hidden on tablet, visible on lg+): Category, Presentation
  const columns = [
    {
      key: 'name',
      label: t('supplies.form.name'),
      // Always visible
    },
    {
      key: 'category',
      label: t('supplies.form.category'),
      className: 'hidden lg:table-cell', // Hidden on tablet (md-lg), visible on desktop (lg+)
      render: (_value: unknown, supply: Supply) =>
        getSupplyCategoryLabel(supply.category, t)
    },
    {
      key: 'presentation',
      label: t('supplies.form.presentation'),
      className: 'hidden lg:table-cell', // Hidden on tablet (md-lg), visible on desktop (lg+)
      render: (_value: unknown, supply: Supply) =>
        supply.presentation || '-'
    },
    {
      key: 'price_cents',
      label: t('supplies.pricePerPresentation'),
      render: (_value: unknown, supply: Supply) =>
        formatCurrency(supply.price_cents ?? 0)
    },
    {
      key: 'portions',
      label: t('supplies.form.portions')
    },
    {
      key: 'cost_per_portion_cents',
      label: t('supplies.pricePerPortion'),
      render: (_value: unknown, supply: Supply) =>
        <span className="font-medium text-green-600">
          {formatCurrency(supply.cost_per_portion_cents ?? 0)}
        </span>
    },
    {
      key: 'stock_quantity',
      label: t('supplies.inventory.stock'),
      render: (_value: unknown, supply: Supply) => {
        const stock = supply.stock_quantity ?? 0;
        const minAlert = supply.min_stock_alert ?? 10;
        const isLow = stock > 0 && stock <= minAlert;
        const isOut = stock === 0;

        return (
          <div className="flex items-center gap-2">
            <span className={isOut ? 'text-destructive font-medium' : isLow ? 'text-amber-600 font-medium' : ''}>
              {stock}
            </span>
            {isOut && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {t('supplies.inventory.outOfStock')}
              </Badge>
            )}
            {isLow && !isOut && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {t('supplies.inventory.lowStock')}
              </Badge>
            )}
          </div>
        );
      }
    }
  ];

  // Mobile-optimized columns
  const mobileColumns = [
    {
      key: 'name',
      label: t('supplies.table.supply'),
      render: (_value: unknown, supply: Supply) => (
        <span className="font-medium text-foreground">{supply.name}</span>
      ),
    },
    {
      key: 'price_cents',
      label: t('supplies.table.price'),
      render: (_value: unknown, supply: Supply) => (
        <span className="text-foreground">{formatCurrency(supply.price_cents ?? 0)}</span>
      ),
    },
    {
      key: 'portions',
      label: t('supplies.table.portions'),
      render: (_value: unknown, supply: Supply) => (
        <span className="text-muted-foreground">{supply.portions}</span>
      ),
    },
    {
      key: 'cost_per_portion_cents',
      label: t('supplies.table.costPerPortion'),
      render: (_value: unknown, supply: Supply) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(supply.cost_per_portion_cents ?? 0)}
        </span>
      ),
    },
  ];

  // Category options from categories table (system + custom)
  const categoryOptions = useMemo(() => {
    const categories: CategoryRow[] = catList || []
    return categories
      .map((c) => ({
        value: c.display_name || c.name || '',
        label: c.display_name || c.name || '',
        isSystem: c.is_system || false
      }))
      .filter(option => option.value);
  }, [catList]);

  // Get unique categories from supplies for filter options
  const filterCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(crud.items.map(s => s.category).filter(Boolean)))
    return unique.map(cat => ({
      value: cat,
      label: getSupplyCategoryLabel(cat, t)
    }))
  }, [crud.items, t])

  // Filter configurations
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      key: 'category',
      label: t('filters.category'),
      type: 'multi-select',
      options: filterCategoryOptions
    },
    {
      key: 'price_cents',
      label: t('filters.priceRange'),
      type: 'number-range',
      multiplier: 100 // User inputs pesos, data is in cents
    }
  ], [filterCategoryOptions, t])

  // Apply filters to supplies
  const filteredSupplies = useSmartFilter(crud.items, filterValues, filterConfigs)

  return (
    <>
    <SimpleCrudPage
      title={t('supplies.title')}
      subtitle={t('supplies.subtitle')}
      entityName={t('supplies.entity')}
      data={{
        items: filteredSupplies,
        loading: crud.loading,
        searchTerm: crud.searchTerm,
        onSearchChange: crud.setSearchTerm,
        onAdd: handleOpenDialog,
        onEdit: handleEdit,
        onDelete: crud.handleDeleteClick,
        deleteConfirmOpen: crud.deleteConfirmOpen,
        onDeleteConfirmChange: (open) => { if (!open) crud.closeDialog() },
        deletingItem: crud.deletingItem,
        onDeleteConfirm: crud.handleDeleteConfirm,
      }}
      columns={columns}
      mobileColumns={mobileColumns}
      emptyIcon={<Package className="h-8 w-8" />}
      searchable={true}
      beforeTable={
        <SmartFilters
          filters={filterConfigs}
          values={filterValues}
          onChange={setFilterValues}
        />
      }
    >
      <FormModal
        open={crud.isDialogOpen}
        onOpenChange={() => { crud.closeDialog(); reset(supplyInitialValues); }}
        title={crud.editingItem ? t('supplies.edit') : t('supplies.add')}
        onSubmit={handleSubmit(onSubmit)}
        isSubmitting={crud.isSubmitting}
        cancelLabel={t('supplies.form.cancel')}
        submitLabel={t('supplies.form.save')}
      >
        <div className="space-y-4">
          <InputField
            label={t('supplies.form.name')}
            value={watch('name')}
            onChange={(v) => {
              const value = typeof v === 'string' ? v : (typeof v === 'object' && v !== null && 'target' in v ? (v as React.ChangeEvent<HTMLInputElement>).target.value : '')
              setValue('name', value)
            }}
            error={errors.name?.message}
            required
          />

          <div className="grid gap-2">
            <SelectField
              label={t('supplies.form.category')}
              value={watch('category')}
              onChange={(v) => setValue('category', v as SupplyCategory)}
              options={categoryOptions}
              error={errors.category?.message}
            />
            <button
              type="button"
              className="self-start text-xs text-primary hover:underline"
              onClick={() => setCategoryModalOpen(true)}
            >
              {t('services.manage_categories')}
            </button>
          </div>

          <InputField
            label={t('supplies.form.presentation')}
            value={watch('presentation')}
            onChange={(v) => {
              const value = typeof v === 'string' ? v : (typeof v === 'object' && v !== null && 'target' in v ? (v as React.ChangeEvent<HTMLInputElement>).target.value : '')
              setValue('presentation', value)
            }}
            placeholder={t('supplies.presentationPlaceholder')}
            error={errors.presentation?.message}
          />

          <FormGrid columns={2}>
            <InputField
              label={t('supplies.form.price')}
              type="number"
              value={watch('price_pesos')}
              onChange={(v) => {
                const value = typeof v === 'number' ? v : parseFloat(String(v)) || 0
                setValue('price_pesos', value)
              }}
              placeholder="0.00"
              step="0.01"
              error={errors.price_pesos?.message}
            />

            <InputField
              label={t('supplies.form.portions')}
              type="number"
              value={watch('portions')}
              onChange={(v) => {
                const value = typeof v === 'number' ? v : parseInt(String(v)) || 1
                setValue('portions', value)
              }}
              error={errors.portions?.message}
            />
          </FormGrid>

          {/* Inventory section */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              {t('supplies.inventory.title')}
            </h4>
            <FormGrid columns={2}>
              <InputField
                label={t('supplies.inventory.stockQuantity')}
                type="number"
                value={watch('stock_quantity') ?? 0}
                onChange={(v) => {
                  const value = typeof v === 'number' ? v : parseInt(String(v)) || 0
                  setValue('stock_quantity', value)
                }}
                placeholder="0"
                error={errors.stock_quantity?.message}
              />

              <InputField
                label={t('supplies.inventory.minAlert')}
                type="number"
                value={watch('min_stock_alert') ?? 10}
                onChange={(v) => {
                  const value = typeof v === 'number' ? v : parseInt(String(v)) || 10
                  setValue('min_stock_alert', value)
                }}
                placeholder="10"
                error={errors.min_stock_alert?.message}
              />
            </FormGrid>
          </div>

          {/* Live preview */}
          {costPerPortionPreview > 0 && (
            <div className="p-2.5 sm:p-3 bg-primary/10 dark:bg-primary/20/30 rounded-lg">
              <p className="text-xs sm:text-sm text-primary/95 dark:text-primary/90">
                {t('supplies.pricePerPortion')}: {' '}
                <span className="font-semibold">
                  {formatCurrency(costPerPortionPreview)}
                </span>
              </p>
            </div>
          )}
        </div>
      </FormModal>
    </SimpleCrudPage>

      {/* Category Manager */}
      <CategoryModal
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        categories={catList as CategoryRow[]}
        onCreateCategory={createCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={deleteCategory}
      />
    </>
  );
}
