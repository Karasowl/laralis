'use client';

import { useState } from 'react';
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
import { Package } from 'lucide-react';
import { z } from 'zod';
import { useCategories } from '@/hooks/use-categories';
import { CategoryModal } from '@/app/services/components/CategoryModal';

type SupplyFormData = z.infer<typeof zSupplyForm>;

// Legacy fallback kept for label mapping; options now come from categories API
const legacyCategories: SupplyCategory[] = [
  'insumo', 'bioseguridad', 'consumibles', 'materiales', 
  'medicamentos', 'equipos', 'otros'
];

export default function SuppliesPage() {
  const t = useTranslations();
  const {
    categories: catList,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategories('supplies')
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  
  // Use the centralized CRUD hook
  const crud = useCrudOperations<Supply>({
    endpoint: '/api/supplies',
    entityName: t('supplies.entity'),
    includeClinicId: true,
    searchParam: 'search',
  });

  // Form handling
  const {
    register,
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
      portions: 1
    }
  });

  const supplyInitialValues: SupplyFormData = {
    name: '',
    category: 'insumo',
    presentation: '',
    price_pesos: 0,
    portions: 1
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
      portions: data.portions
    };

    const success = crud.editingItem
      ? await crud.handleUpdate(crud.editingItem.id, payload)
      : await crud.handleCreate(payload);

    if (success) {
      crud.closeDialog();
      reset();
    }
  };

  // Handle edit
  const handleEdit = (supply: Supply) => {
    crud.handleEdit(supply);
    const validCategory = legacyCategories.includes(supply.category as SupplyCategory) 
      ? supply.category as SupplyCategory 
      : 'otros';
    
    reset({
      name: supply.name,
      category: validCategory,
      presentation: supply.presentation || '',
      price_pesos: supply.price_cents / 100,
      portions: supply.portions
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

  // Table columns
  const columns = [
    { 
      key: 'name', 
      label: t('supplies.form.name') 
    },
    { 
      key: 'category', 
      label: t('supplies.form.category'), 
      render: (_value: any, supply: Supply) => 
        getSupplyCategoryLabel(supply.category, t)
    },
    { 
      key: 'presentation', 
      label: t('supplies.form.presentation'), 
      render: (_value: any, supply: Supply) =>
        supply.presentation || '-'
    },
    { 
      key: 'price_cents', 
      label: t('supplies.pricePerPresentation'), 
      render: (_value: any, supply: Supply) =>
        formatCurrency(supply.price_cents)
    },
    { 
      key: 'portions', 
      label: t('supplies.form.portions') 
    },
    { 
      key: 'cost_per_portion_cents', 
      label: t('supplies.pricePerPortion'), 
      render: (_value: any, supply: Supply) =>
        <span className="font-medium text-green-600">
          {formatCurrency(supply.cost_per_portion_cents)}
        </span>
    }
  ];

  // Category options for select
  const categoryOptions = (catList && catList.length > 0
    ? catList.map((c: any) => ({ value: c.display_name || c.name || c.code, label: c.display_name || c.name || c.code }))
    : legacyCategories.map(cat => ({ value: cat, label: t(`supplies.categories.${cat}`) }))
  );

  return (
    <>
    <SimpleCrudPage
      title={t('supplies.title')}
      subtitle={t('supplies.subtitle')}
      entityName={t('supplies.entity')}
      data={{
        items: crud.items,
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
      emptyIcon={<Package className="h-8 w-8" />}
      searchable={true}
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
            onChange={(v) => setValue('name', v as string)}
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
            onChange={(v) => setValue('presentation', v as string)}
            placeholder={t('supplies.presentationPlaceholder')}
            error={errors.presentation?.message}
          />

          <FormGrid columns={2}>
            <InputField
              label={t('supplies.form.price')}
              type="number"
              value={watch('price_pesos')}
              onChange={(v) => setValue('price_pesos', v as number)}
              placeholder="0.00"
              step="0.01"
              error={errors.price_pesos?.message}
            />

            <InputField
              label={t('supplies.form.portions')}
              type="number"
              value={watch('portions')}
              onChange={(v) => setValue('portions', v as number)}
              error={errors.portions?.message}
            />
          </FormGrid>

          {/* Live preview */}
          {costPerPortionPreview > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-200">
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
        categories={catList as any[]}
        onCreateCategory={createCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={deleteCategory}
      />
    </>
  );
}
