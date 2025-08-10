'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/format';
import type { Asset, ApiResponse } from '@/lib/types';
import { zAssetForm } from '@/lib/zod';
import { z } from 'zod';

type AssetFormData = z.infer<typeof zAssetForm>;

export default function AssetsPage() {
  const t = useTranslations();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      const res = await fetch('/api/assets');
      const result: ApiResponse<Asset[]> = await res.json();
      if (result.data) setAssets(result.data);
    } catch (e) {
      console.error('Error fetching assets', e);
    } finally {
      setLoading(false);
    }
  };

  const open = () => setIsDialogOpen(true);
  const close = () => setIsDialogOpen(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const parsed = zAssetForm.safeParse(form);
      if (!parsed.success) {
        alert(parsed.error.errors.map(er => er.message).join(', '));
        return;
      }
      const payload = {
        name: form.name,
        purchase_price_pesos: form.purchase_price_pesos,
        depreciation_months: form.depreciation_months,
        purchase_date: form.purchase_date || undefined,
      };
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Save error', data);
        alert(`Error: ${data.error || 'Failed to save'}`);
        return;
      }
      setForm({ name: '', purchase_price_pesos: 0, depreciation_months: 36, purchase_date: '' });
      close();
      fetchAssets();
    } catch (e) {
      console.error('Error saving asset', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const monthlyDepreciation = useMemo(() => {
    return assets.reduce((sum, a) => {
      if (!a.depreciation_months || a.depreciation_months <= 0) return sum;
      return sum + Math.round(a.purchase_price_cents / a.depreciation_months);
    }, 0);
  }, [assets]);

  const columns: Column<Asset>[] = [
    { key: 'name', label: t('assets.table.name') },
    { key: 'purchase_price_cents', label: t('assets.table.purchasePrice'), render: (_v, row) => formatCurrency(row.purchase_price_cents) },
    { key: 'depreciation_months', label: t('assets.table.months') },
    { key: 'monthly_dep', label: t('assets.table.monthlyDep'), render: (_v, row) => formatCurrency(Math.round(row.purchase_price_cents / row.depreciation_months)) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('assets.pageTitle')} subtitle={t('assets.pageSubtitle')} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-600">{t('assets.monthlyDepreciationTotal')}</p>
          <p className="text-2xl font-semibold">{formatCurrency(monthlyDepreciation)}</p>
        </Card>
      </div>

      <div className="flex justify-between">
        <div />
        <Button onClick={open}>{t('assets.addAssetButton')}</Button>
      </div>

      <DataTable columns={columns} data={assets} />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('assets.addAssetDialogTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>{t('assets.formNameLabel')}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{t('assets.formPriceLabel')}</Label>
              <Input type="number" step="0.01" value={form.purchase_price_pesos}
                     onChange={(e) => setForm({ ...form, purchase_price_pesos: parseFloat(e.target.value) || 0 })} />
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
              <Button type="submit" disabled={isSubmitting}>{t('assets.formSaveButton')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}





