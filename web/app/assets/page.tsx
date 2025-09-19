'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CrudPageLayout } from '@/components/ui/crud-page-layout';
import { FormModal } from '@/components/ui/form-modal';
import { InputField, FormGrid } from '@/components/ui/form-field';
import { SummaryCards } from '@/components/ui/summary-cards';
import { Card } from '@/components/ui/card';
import { useCrudOperations } from '@/hooks/use-crud-operations';
import { formatCurrency } from '@/lib/money';
import { Asset } from '@/lib/types';
import { zAssetForm } from '@/lib/zod';
import { Package, TrendingDown, Calendar, DollarSign } from 'lucide-react';
import { z } from 'zod';

type AssetFormData = z.infer<typeof zAssetForm>;

export default function AssetsPage() {
  const t = useTranslations();
  
  // CRUD operations
  const crud = useCrudOperations<Asset & { id: string }>({
    endpoint: '/api/assets',
    entityName: t('assets.entity'),
    includeClinicId: true,
  });

  // Form handling
  const {
    setValue,
    watch,
    reset,
    handleSubmit,
    formState: { errors }
  } = useForm<AssetFormData>({
    resolver: zodResolver(zAssetForm),
    defaultValues: {
      name: '',
      purchase_price_pesos: 0,
      depreciation_months: 36,
      purchase_date: ''
    }
  });

  const assetInitialValues: AssetFormData = {
    name: '',
    purchase_price_pesos: 0,
    depreciation_months: 36,
    purchase_date: ''
  }

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalInvestmentCents = crud.items.reduce((sum, a) => sum + a.purchase_price_cents, 0);
    const monthlyDepreciationCents = crud.items.reduce((sum, a) => {
      if (!a.depreciation_months || a.depreciation_months <= 0) return sum;
      return sum + Math.round(a.purchase_price_cents / a.depreciation_months);
    }, 0);
    
    const totalMonths = crud.items.length > 0 
      ? Math.round(crud.items.reduce((sum, a) => sum + (a.depreciation_months || 0), 0) / crud.items.length)
      : 0;
    const totalYears = Math.round(totalMonths / 12 * 10) / 10;
    
    return {
      totalInvestmentCents,
      monthlyDepreciationCents,
      totalMonths,
      totalYears,
      assetCount: crud.items.length
    };
  }, [crud.items]);

  // Form submission
  const onSubmit = async (data: AssetFormData) => {
    const payload = {
      name: data.name,
      purchase_price_pesos: data.purchase_price_pesos,
      depreciation_months: data.depreciation_months,
      purchase_date: data.purchase_date || undefined,
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
  const handleEdit = (asset: Asset & { id: string }) => {
    crud.handleEdit(asset);
    reset({
      name: asset.name,
      purchase_price_pesos: asset.purchase_price_cents / 100,
      depreciation_months: asset.depreciation_months,
      purchase_date: asset.purchase_date || ''
    });
  };

  // Handle dialog open
  const handleOpenDialog = () => {
    reset(assetInitialValues);
    crud.openDialog();
  };

  // Table columns
  const columns = [
    { 
      key: 'name', 
      label: t('assets.table.name') 
    },
    { 
      key: 'purchase_price_cents', 
      label: t('assets.table.purchasePrice'), 
      render: (_v: any, row: Asset) => formatCurrency(row.purchase_price_cents) 
    },
    { 
      key: 'depreciation_months', 
      label: t('assets.table.months') 
    },
    { 
      key: 'monthly_dep', 
      label: t('assets.table.monthlyDep'), 
      render: (_v: any, row: Asset) => 
        formatCurrency(Math.round(row.purchase_price_cents / row.depreciation_months)) 
    }
  ];

  // Summary cards
  const summaryCards = (
    <SummaryCards
      cards={[
        {
          label: t('businessSetup.assets.totalInvestment'),
          value: formatCurrency(summary.totalInvestmentCents),
          subtitle: `${summary.assetCount} ${t('businessSetup.assets.assets')}`,
          icon: DollarSign,
          color: 'primary'
        },
        {
          label: t('businessSetup.assets.depreciationPeriod'),
          value: `${summary.totalYears} ${t('businessSetup.assets.years')}`,
          subtitle: `${summary.totalMonths} ${t('businessSetup.assets.months')}`,
          icon: Calendar,
          color: 'info'
        },
        {
          label: t('assets.monthlyDepreciationTotal'),
          value: formatCurrency(summary.monthlyDepreciationCents),
          subtitle: t('businessSetup.assets.perMonth'),
          icon: TrendingDown,
          color: 'success'
        },
        {
          label: t('businessSetup.assets.yearlyDepreciation'),
          value: formatCurrency(summary.monthlyDepreciationCents * 12),
          subtitle: t('businessSetup.assets.perYear'),
          icon: TrendingDown,
          color: 'warning'
        }
      ]}
      columns={4}
    />
  );

  // Additional content - depreciation explanation
  const additionalContent = crud.items.length > 0 && (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">{t('businessSetup.assets.depreciationExplanation')}</h3>
      <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg space-y-2">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>{t('businessSetup.assets.formula')}:</strong> {t('businessSetup.assets.formulaExplanation')}
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400">
          {t('businessSetup.assets.exampleCalculation')} {formatCurrency(100000)} ÷ 36 {t('businessSetup.assets.months')} = {formatCurrency(Math.round(100000 / 36))}/{t('businessSetup.assets.month')}
        </p>
      </div>
    </Card>
  );

  return (
    <>
      <CrudPageLayout
        title={t('assets.pageTitle')}
        subtitle={t('assets.pageSubtitle')}
        items={crud.items}
        loading={crud.loading}
        columns={columns}
        onAdd={handleOpenDialog}
        onEdit={handleEdit}
        onDelete={crud.handleDeleteClick}
        addButtonLabel={t('assets.addAssetButton')}
        emptyIcon={<Package className="h-8 w-8" />}
        emptyTitle={t('assets.emptyTitle')}
        emptyDescription={t('assets.emptyDescription')}
        deleteConfirmOpen={crud.deleteConfirmOpen}
        onDeleteConfirmChange={(open) => { if (!open) crud.closeDialog() }}
        deletingItem={crud.deletingItem}
        onDeleteConfirm={crud.handleDeleteConfirm}
        summaryCards={summaryCards}
        additionalContent={additionalContent}
      >
        <FormModal
          open={crud.isDialogOpen}
          onOpenChange={() => { crud.closeDialog(); reset(assetInitialValues); }}
          title={crud.editingItem ? t('assets.editAssetDialogTitle') : t('assets.addAssetDialogTitle')}
          onSubmit={handleSubmit(onSubmit)}
          isSubmitting={crud.isSubmitting}
          cancelLabel={t('assets.formCancelButton')}
          submitLabel={crud.editingItem ? t('assets.formUpdateButton') : t('assets.formSaveButton')}
          maxWidth="md"
        >
          <div className="space-y-4">
            <InputField
              label={t('assets.formNameLabel')}
              value={watch('name')}
              onChange={(v) => setValue('name', v as string)}
              error={errors.name?.message}
              required
            />
            
            <FormGrid columns={2}>
              <InputField
                label={t('assets.formPriceLabel')}
                type="number"
                value={watch('purchase_price_pesos')}
                onChange={(v) => setValue('purchase_price_pesos', v as number)}
                placeholder={t('validation.placeholders.amount')}
                step="0.01"
                error={errors.purchase_price_pesos?.message}
                helperText={t('businessSetup.assets.priceHelp')}
                required
              />
              
              <InputField
                label={t('assets.formMonthsLabel')}
                type="number"
                value={watch('depreciation_months')}
                onChange={(v) => setValue('depreciation_months', v as number)}
                error={errors.depreciation_months?.message}
                required
              />
            </FormGrid>
            
            <InputField
              label={t('assets.formPurchaseDateLabel')}
              type="date"
              value={watch('purchase_date') ?? ''}
              onChange={(v) => setValue('purchase_date', v as string)}
              error={errors.purchase_date?.message}
            />
          </div>
        </FormModal>
      </CrudPageLayout>
    </>
  );
}
