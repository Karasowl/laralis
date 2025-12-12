'use client';

import React, { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CrudPageLayout } from '@/components/ui/crud-page-layout';
import { FormModal } from '@/components/ui/form-modal';
import { InputField, FormGrid } from '@/components/ui/form-field';
import { CategorySelect } from '@/components/ui/category-select';
import { SummaryCards } from '@/components/ui/summary-cards';
import { Card } from '@/components/ui/card';
import { useCrudOperations } from '@/hooks/use-crud-operations';
import { formatCurrency } from '@/lib/money';
import { Asset } from '@/lib/types';
import { zAssetForm } from '@/lib/zod';
import { Package, TrendingDown, Calendar, DollarSign } from 'lucide-react';
import { z } from 'zod';
import { getLocalDateISO } from '@/lib/utils';
import { useWorkspace } from '@/contexts/workspace-context';
import { evaluateRequirements } from '@/lib/requirements';
import { toast } from 'sonner';

type AssetFormData = z.infer<typeof zAssetForm>;

export default function AssetsPage() {
  const t = useTranslations();
  const setupT = useTranslations('setupWizard');
  const todayIso = getLocalDateISO();
  const router = useRouter();
  const { currentClinic, workspace } = useWorkspace();
  
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
      category: '',
      purchase_price_pesos: 0,
      depreciation_months: 36,
      purchase_date: todayIso
    },
    mode: 'onBlur', // PERFORMANCE: Validate only on blur
  });

  const assetInitialValues: AssetFormData = {
    name: '',
    category: '',
    purchase_price_pesos: 0,
    depreciation_months: 36,
    purchase_date: todayIso
  }

  // Calculate summary statistics
  const summary = useMemo(() => {
    try { console.log('[assets] items.length', crud.items.length) } catch {}
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
      category: data.category || undefined,
      purchase_price_pesos: data.purchase_price_pesos,
      depreciation_months: data.depreciation_months,
      purchase_date: data.purchase_date || undefined,
    };
    
    const success = crud.editingItem
      ? await crud.handleUpdate(crud.editingItem.id, payload)
      : await crud.handleCreate(payload);
    
    if (success) {
      const wasCreating = !crud.editingItem;
      crud.closeDialog();
      reset();
      if (wasCreating && !workspace?.onboarding_completed) {
        toast.success(setupT('toasts.finishSuccess'));
        router.push('/setup');
      }
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
      render: (_value: unknown, row: Asset) => formatCurrency(row.purchase_price_cents)
    },
    {
      key: 'depreciation_months',
      label: t('assets.table.months')
    },
    {
      key: 'monthly_dep',
      label: t('assets.table.monthlyDep'),
      sortable: false,
      render: (_value: unknown, row: Asset) =>
        formatCurrency(Math.round(row.purchase_price_cents / row.depreciation_months))
    }
  ];

  // Mobile-optimized columns
  const mobileColumns = [
    {
      key: 'name',
      label: t('assets.table.asset'),
      render: (_value: unknown, row: Asset) => (
        <span className="font-medium text-foreground">{row.name}</span>
      ),
    },
    {
      key: 'purchase_price_cents',
      label: t('assets.table.value'),
      render: (_value: unknown, row: Asset) => (
        <span className="font-semibold text-foreground">{formatCurrency(row.purchase_price_cents)}</span>
      ),
    },
    {
      key: 'monthly_dep',
      label: t('assets.table.depreciation'),
      sortable: false,
      render: (_value: unknown, row: Asset) => (
        <span className="text-muted-foreground">
          {formatCurrency(Math.round(row.purchase_price_cents / row.depreciation_months))}/{t('businessSetup.assets.month')}
        </span>
      ),
    },
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
      <div className="bg-primary/10 dark:bg-primary/20/30 p-4 rounded-lg space-y-2">
        <p className="text-sm text-primary dark:text-primary/90">
          <strong>{t('businessSetup.assets.formula')}:</strong> {t('businessSetup.assets.formulaExplanation')}
        </p>
        <p className="text-xs text-primary dark:text-primary/80">
          {t('businessSetup.assets.exampleCalculation')} {formatCurrency(100000)} ÷ 36 {t('businessSetup.assets.months')} = {formatCurrency(Math.round(100000 / 36))}/{t('businessSetup.assets.month')}
        </p>
      </div>
    </Card>
  );

  useEffect(() => {
    if (workspace?.onboarding_completed) return;
    const clinicId = currentClinic?.id;
    if (!clinicId || crud.loading) return;
    if (!crud.items || crud.items.length === 0) return;

    // 🔥 ONLY auto-redirect if user explicitly came from setup wizard
    let shouldAutoRedirect = false;
    try {
      if (typeof sessionStorage !== 'undefined') {
        shouldAutoRedirect = sessionStorage.getItem('return_to_setup') === '1';
      }
    } catch {}

    if (!shouldAutoRedirect) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await evaluateRequirements({ clinicId, cacheKeySuffix: Date.now().toString() }, ['depreciation']);
        if (!cancelled && !(res.missing || []).includes('depreciation')) {
          // Clear the flag so we don't redirect again
          try {
            sessionStorage.removeItem('return_to_setup');
          } catch {}

          toast.success(setupT('toasts.finishSuccess'));
          router.push('/setup');
        }
      } catch (error) {
        console.error('Failed to evaluate depreciation requirement', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [crud.loading, crud.items, currentClinic?.id, workspace?.onboarding_completed, router, setupT]);

  return (
    <>
      <CrudPageLayout
        title={t('assets.pageTitle')}
        subtitle={t('assets.pageSubtitle')}
        items={crud.items}
        loading={crud.loading}
        columns={columns}
        mobileColumns={mobileColumns}
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
              onChange={(v: string | number | React.ChangeEvent<HTMLInputElement>) => {
                const value = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : (typeof v === 'object' && v !== null && 'target' in v ? (v as React.ChangeEvent<HTMLInputElement>).target.value : '')
                setValue('name', value)
              }}
              error={errors.name?.message}
              required
            />

            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('assets.formCategoryLabel')}
              </label>
              <CategorySelect
                type="assets"
                value={watch('category')}
                onValueChange={(v) => setValue('category', v)}
                placeholder={t('categories.selectCategory')}
              />
            </div>

            <FormGrid columns={2}>
              <InputField
                label={t('assets.formPriceLabel')}
                type="number"
                value={watch('purchase_price_pesos')}
                onChange={(v: string | number | React.ChangeEvent<HTMLInputElement>) => {
                  const value = typeof v === 'number' ? v : parseFloat(String(v)) || 0
                  setValue('purchase_price_pesos', value)
                }}
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
                onChange={(v: string | number | React.ChangeEvent<HTMLInputElement>) => {
                  const value = typeof v === 'number' ? v : parseInt(String(v)) || 1
                  setValue('depreciation_months', value)
                }}
                error={errors.depreciation_months?.message}
                required
              />
            </FormGrid>
            
            <InputField
              label={t('assets.formPurchaseDateLabel')}
              type="date"
              value={watch('purchase_date') ?? ''}
              onChange={(v: string | number | React.ChangeEvent<HTMLInputElement>) => {
                const value = typeof v === 'string' ? v : (typeof v === 'object' && v !== null && 'target' in v ? (v as React.ChangeEvent<HTMLInputElement>).target.value : '')
                setValue('purchase_date', value)
              }}
              error={errors.purchase_date?.message}
            />
          </div>
        </FormModal>
      </CrudPageLayout>
    </>
  );
}
