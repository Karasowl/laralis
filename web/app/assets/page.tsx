'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/contexts/workspace-context';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown';
import { ConfirmDialog, createDeleteConfirm } from '@/components/ui/ConfirmDialog';
import { formatCurrency } from '@/lib/format';
import type { Asset, ApiResponse } from '@/lib/types';
import { zAssetForm } from '@/lib/zod';
import { z } from 'zod';
import { Package } from 'lucide-react';
import { toast } from 'sonner';

type AssetFormData = z.infer<typeof zAssetForm>;

export default function AssetsPage() {
  const t = useTranslations();
  const { currentClinic } = useWorkspace(); // ✅ Obtener clínica actual
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetFormData>({
    name: '',
    purchase_price_pesos: 0,
    depreciation_months: 36,
    purchase_date: ''
  });

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const res = await fetch(`/api/assets?clinicId=${currentClinic.id}`);
      const result: ApiResponse<Asset[]> = await res.json();
      if (result.data) setAssets(result.data);
    } catch (e) {
      console.error('Error fetching assets', e);
    } finally {
      setLoading(false);
    }
  };

  const open = () => {
    setEditingAsset(null);
    setForm({
      name: '',
      purchase_price_pesos: 0,
      depreciation_months: 36,
      purchase_date: ''
    });
    setIsDialogOpen(true);
  };
  
  const close = () => {
    setIsDialogOpen(false);
    setEditingAsset(null);
    setForm({
      name: '',
      purchase_price_pesos: 0,
      depreciation_months: 36,
      purchase_date: ''
    });
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setForm({
      name: asset.name,
      purchase_price_pesos: asset.purchase_price_cents / 100,
      depreciation_months: asset.depreciation_months,
      purchase_date: asset.purchase_date || ''
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (asset: Asset) => {
    setDeletingAsset(asset);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAsset) return;
    
    try {
      const res = await fetch(`/api/assets/${deletingAsset.id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t('assets.deleteError'));
        return;
      }
      
      toast.success(t('assets.deleteSuccess'));
      fetchAssets();
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error(t('assets.deleteError'));
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingAsset(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const parsed = zAssetForm.safeParse(form);
      if (!parsed.success) {
        toast.error(parsed.error.errors.map(er => er.message).join(', '));
        setIsSubmitting(false);
        return;
      }
      const payload = {
        name: form.name,
        purchase_price_pesos: form.purchase_price_pesos,
        depreciation_months: form.depreciation_months,
        purchase_date: form.purchase_date || undefined,
      };
      
      const url = editingAsset ? `/api/assets/${editingAsset.id}` : '/api/assets';
      const method = editingAsset ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Save error', data);
        toast.error(data.error || t('assets.saveError'));
        return;
      }
      
      toast.success(editingAsset ? t('assets.updateSuccess') : t('assets.createSuccess'));
      close();
      fetchAssets();
    } catch (e) {
      console.error('Error saving asset', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const summary = useMemo(() => {
    const totalInvestmentCents = assets.reduce((sum, a) => sum + a.purchase_price_cents, 0);
    const monthlyDepreciationCents = assets.reduce((sum, a) => {
      if (!a.depreciation_months || a.depreciation_months <= 0) return sum;
      return sum + Math.round(a.purchase_price_cents / a.depreciation_months);
    }, 0);
    
    const totalMonths = assets.length > 0 
      ? Math.round(assets.reduce((sum, a) => sum + (a.depreciation_months || 0), 0) / assets.length)
      : 0;
    const totalYears = Math.round(totalMonths / 12 * 10) / 10;
    
    return {
      totalInvestmentCents,
      monthlyDepreciationCents,
      totalMonths,
      totalYears,
      assetCount: assets.length
    };
  }, [assets]);

  const columns: Column<Asset>[] = [
    { key: 'name', label: t('assets.table.name') },
    { key: 'purchase_price_cents', label: t('assets.table.purchasePrice'), render: (_v, row) => formatCurrency(row.purchase_price_cents) },
    { key: 'depreciation_months', label: t('assets.table.months') },
    { key: 'monthly_dep', label: t('assets.table.monthlyDep'), render: (_v, row) => formatCurrency(Math.round(row.purchase_price_cents / row.depreciation_months)) },
    {
      key: 'actions',
      label: t('assets.table.actions'),
      render: (_v, row) => (
        <ActionDropdown
          actions={[
            createEditAction(() => handleEdit(row), t('assets.edit')),
            createDeleteAction(() => handleDeleteClick(row), t('assets.delete'))
          ]}
        />
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('assets.pageTitle')} subtitle={t('assets.pageSubtitle')} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-600">{t('businessSetup.assets.totalInvestment')}</p>
          <p className="text-2xl font-semibold">{formatCurrency(summary.totalInvestmentCents)}</p>
          <p className="text-xs text-gray-500">{summary.assetCount} {t('businessSetup.assets.assets')}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">{t('businessSetup.assets.depreciationPeriod')}</p>
          <p className="text-2xl font-semibold">{summary.totalYears} {t('businessSetup.assets.years')}</p>
          <p className="text-xs text-gray-500">{summary.totalMonths} {t('businessSetup.assets.months')}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">{t('assets.monthlyDepreciationTotal')}</p>
          <p className="text-2xl font-semibold text-primary">{formatCurrency(summary.monthlyDepreciationCents)}</p>
          <p className="text-xs text-gray-500">{t('businessSetup.assets.perMonth')}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">{t('businessSetup.assets.yearlyDepreciation')}</p>
          <p className="text-2xl font-semibold">{formatCurrency(summary.monthlyDepreciationCents * 12)}</p>
          <p className="text-xs text-gray-500">{t('businessSetup.assets.perYear')}</p>
        </Card>
      </div>

      <div className="flex justify-between">
        <div />
        <Button onClick={open}>{t('assets.addAssetButton')}</Button>
      </div>

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t('businessSetup.assets.detailBreakdown')}</h3>
          {assets.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8" />}
              title={t('assets.emptyTitle')}
              description={t('assets.emptyDescription')}
              action={
                <Button onClick={open}>
                  {t('assets.addAssetButton')}
                </Button>
              }
            />
          ) : (
            <DataTable columns={columns} data={assets} />
          )}
        </div>
      </Card>
      
      {assets.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t('businessSetup.assets.depreciationExplanation')}</h3>
          <div className="bg-blue-50 p-4 rounded-lg space-y-2">
            <p className="text-sm text-blue-800">
              <strong>{t('businessSetup.assets.formula')}:</strong> {t('businessSetup.assets.formulaExplanation')}
            </p>
            <p className="text-xs text-blue-600">
              {t('businessSetup.assets.exampleCalculation')} {formatCurrency(100000)} ÷ 36 {t('businessSetup.assets.months')} = {formatCurrency(Math.round(100000 / 36))}/{t('businessSetup.assets.month')}
            </p>
          </div>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAsset ? t('assets.editAssetDialogTitle') : t('assets.addAssetDialogTitle')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>{t('assets.formNameLabel')}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{t('assets.formPriceLabel')}</Label>
              <Input type="number" step="0.01" value={form.purchase_price_pesos} placeholder="0.00"
                     onChange={(e) => setForm({ ...form, purchase_price_pesos: parseFloat(e.target.value) || 0 })} />
              <p className="text-xs text-gray-500 mt-1">{t('businessSetup.assets.priceHelp')}</p>
            </div>
            <div>
              <Label>{t('assets.formMonthsLabel')}</Label>
              <Input type="number" value={form.depreciation_months}
                     onChange={(e) => setForm({ ...form, depreciation_months: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <Label>{t('assets.formPurchaseDateLabel')}</Label>
              <Input type="date" value={form.purchase_date}
                     onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>{t('assets.formCancelButton')}</Button>
              <Button type="submit" disabled={isSubmitting}>
                {editingAsset ? t('assets.formUpdateButton') : t('assets.formSaveButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        {...createDeleteConfirm(handleDeleteConfirm, deletingAsset?.name)}
      />
    </div>
  );
}





