'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable, Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/FormField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, getCategoryDisplayName } from '@/lib/format';
import { zFixedCostForm } from '@/lib/zod';
import type { FixedCost, FixedCostCategory } from '@/lib/types';
import { Plus, Receipt, Edit, Trash2, X } from 'lucide-react';
import { pesosToCents } from '@/lib/money';

const categories: { value: FixedCostCategory; key: string }[] = [
  { value: 'rent', key: 'rent' },
  { value: 'salaries', key: 'salaries' },
  { value: 'utilities', key: 'utilities' },
  { value: 'insurance', key: 'insurance' },
  { value: 'equipment', key: 'equipment' },
  { value: 'other', key: 'other' },
];

interface FixedCostFormData {
  category: FixedCostCategory;
  concept: string;
  amount_pesos: number;
}

export default function FixedCostsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [costs, setCosts] = useState<FixedCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FixedCostFormData>({
    resolver: zodResolver(zFixedCostForm),
    defaultValues: {
      category: 'other',
      concept: '',
      amount_pesos: 0,
    },
  });

  useEffect(() => {
    loadCosts();
  }, []);

  const loadCosts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/fixed-costs');
      if (response.ok) {
        const data = await response.json();
        setCosts(data.data || []);
      } else {
        console.error('Failed to load fixed costs');
      }
    } catch (error) {
      console.error('Error loading fixed costs:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (formData: FixedCostFormData) => {
    try {
      const payload = {
        category: formData.category,
        concept: formData.concept,
        amount_cents: pesosToCents(formData.amount_pesos),
      };

      const url = editingId 
        ? `/api/fixed-costs/${editingId}`
        : '/api/fixed-costs';
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await loadCosts();
        resetForm();
        console.log(editingId ? 'Fixed cost updated' : 'Fixed cost created');
      } else {
        const error = await response.json();
        console.error('Error saving fixed cost:', error);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleEdit = (cost: FixedCost) => {
    setEditingId(cost.id || null);
    setValue('category', cost.category as FixedCostCategory);
    setValue('concept', cost.concept);
    setValue('amount_pesos', cost.amount_cents / 100);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('fixedCosts.deleteCost'))) return;

    try {
      const response = await fetch(`/api/fixed-costs/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadCosts();
        console.log('Fixed cost deleted');
      } else {
        console.error('Failed to delete fixed cost');
      }
    } catch (error) {
      console.error('Error deleting fixed cost:', error);
    }
  };

  const resetForm = () => {
    reset();
    setEditingId(null);
    setShowForm(false);
  };

  const columns: Column<FixedCost>[] = [
    {
      key: 'category',
      label: t('fixedCosts.category'),
      render: (value) => getCategoryDisplayName(value, t),
    },
    {
      key: 'concept',
      label: t('fixedCosts.concept'),
    },
    {
      key: 'amount_cents',
      label: t('fixedCosts.amount'),
      render: (value) => formatCurrency(value, locale as 'en' | 'es'),
      className: 'text-right',
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (_, item) => (
        <div className="flex gap-2 justify-end">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleEdit(item)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleDelete(item.id!)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  const totalCosts = costs.reduce((sum, cost) => sum + cost.amount_cents, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('fixedCosts.title')}
        subtitle={t('fixedCosts.subtitle')}
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('fixedCosts.addCost')}
          </Button>
        }
      />

      <div className="grid gap-6">
        {/* Add/Edit Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {editingId ? t('fixedCosts.editCost') : t('fixedCosts.addCost')}
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    label={t('fixedCosts.category')}
                    error={errors.category?.message}
                    required
                  >
                    <Select
                      value={watch('category')}
                      onValueChange={(value) => setValue('category', value as FixedCostCategory)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category.value} value={category.value}>
                            {t(`fixedCosts.categories.${category.key}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField
                    label={t('fixedCosts.concept')}
                    error={errors.concept?.message}
                    required
                  >
                    <Input
                      {...register('concept')}
                      placeholder={t('fixedCosts.placeholders.concept')}
                    />
                  </FormField>

                  <FormField
                    label={t('fixedCosts.amount')}
                    error={errors.amount_pesos?.message}
                    required
                  >
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('amount_pesos', { valueAsNumber: true })}
                      placeholder={t('fixedCosts.placeholders.amount')}
                    />
                  </FormField>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting 
                      ? t('common.loading') 
                      : editingId 
                        ? t('common.save') 
                        : t('common.add')
                    }
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {t('fixedCosts.totalMonthly')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(totalCosts, locale as 'en' | 'es')}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {t('fixedCosts.basedOnCosts', { count: costs.length })}
            </p>
          </CardContent>
        </Card>

        {/* Costs Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('fixedCosts.listTitle')}</CardTitle>
            <CardDescription>
              {t('fixedCosts.listDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center p-8">
                <p className="text-muted-foreground">{t('common.loading')}</p>
              </div>
            ) : costs.length > 0 ? (
              <DataTable
                data={costs}
                columns={columns}
                loading={loading}
              />
            ) : (
              <EmptyState
                icon={<Receipt className="h-8 w-8" />}
                title={t('fixedCosts.emptyTitle')}
                description={t('fixedCosts.emptyDescription')}
                action={
                  <Button onClick={() => setShowForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('fixedCosts.addCost')}
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        {costs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('fixedCosts.categoryBreakdown')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categories.map(category => {
                  const categoryTotal = costs
                    .filter(cost => cost.category === category.value)
                    .reduce((sum, cost) => sum + cost.amount_cents, 0);
                  
                  const percentage = totalCosts > 0 ? (categoryTotal / totalCosts) * 100 : 0;
                  
                  if (categoryTotal === 0) return null;
                  
                  return (
                    <div key={category.value} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: `hsl(${category.value.length * 60}, 60%, 50%)` }}
                        />
                        <span className="font-medium">
                          {t(`fixedCosts.categories.${category.key}`)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency(categoryTotal, locale as 'en' | 'es')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}