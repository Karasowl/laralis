'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { formatCurrency, getSupplyCategoryLabel } from '@/lib/format';
import { Supply, ApiResponse, SupplyCategory } from '@/lib/types';
import { zSupplyForm } from '@/lib/zod';
import { Plus, Pencil, Trash2, Search, Package, Loader2 } from 'lucide-react';
import { z } from 'zod';

type SupplyFormData = z.infer<typeof zSupplyForm>;

export default function SuppliesPage() {
  const t = useTranslations();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories: SupplyCategory[] = [
    'insumo', 
    'bioseguridad', 
    'consumibles', 
    'materiales', 
    'medicamentos', 
    'equipos', 
    'otros'
  ];

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

  const watchedValues = watch();
  const costPerPortionPreview = watchedValues.price_pesos > 0 && watchedValues.portions > 0
    ? Math.round((watchedValues.price_pesos * 100) / watchedValues.portions)
    : 0;

  // Fetch supplies
  const fetchSupplies = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchDebounce) params.append('search', searchDebounce);
      
      const response = await fetch(`/api/supplies?${params}`);
      const result: ApiResponse<Supply[]> = await response.json();
      
      if (result.data) {
        setSupplies(result.data);
      }
    } catch (error) {
      console.error('Error fetching supplies:', error);
    } finally {
      setLoading(false);
    }
  }, [searchDebounce]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch on mount and when search changes
  useEffect(() => {
    fetchSupplies();
  }, [fetchSupplies]);

  // Form submission
  const onSubmit = async (data: SupplyFormData) => {
    setIsSubmitting(true);
    
    try {
      const payload = {
        name: data.name,
        category: data.category,
        presentation: data.presentation,
        price_cents: Math.round(data.price_pesos * 100),
        portions: data.portions
      };

      const url = editingSupply 
        ? `/api/supplies/${editingSupply.id}`
        : '/api/supplies';
      
      const method = editingSupply ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchSupplies();
        handleCloseDialog();
        // Aquí podrías agregar un toast de éxito
      } else {
        const error = await response.json();
        console.error('Error saving supply:', error);
        // Aquí podrías agregar un toast de error
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit supply
  const handleEdit = (supply: Supply) => {
    setEditingSupply(supply);
    reset({
      name: supply.name,
      category: supply.category as SupplyCategory,
      presentation: supply.presentation,
      price_pesos: supply.price_cents / 100,
      portions: supply.portions
    });
    setIsDialogOpen(true);
  };

  // Delete supply
  const handleDelete = async (id: string) => {
    if (!confirm(t('supplies.confirmDelete'))) return;
    
    try {
      const response = await fetch(`/api/supplies/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchSupplies();
        // Aquí podrías agregar un toast de éxito
      } else {
        console.error('Error deleting supply');
        // Aquí podrías agregar un toast de error
      }
    } catch (error) {
      console.error('Error deleting supply:', error);
    }
  };

  // Open dialog for new supply
  const handleOpenDialog = () => {
    setEditingSupply(null);
    reset({
      name: '',
      category: 'insumo',
      presentation: '',
      price_pesos: 0,
      portions: 1
    });
    setIsDialogOpen(true);
  };

  // Close dialog
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSupply(null);
    reset();
  };

  // Table columns
  const columns: Column<Supply>[] = [
    { 
      key: 'name', 
      label: t('supplies.form.name') 
    },
    { 
      key: 'category', 
      label: t('supplies.form.category'), 
      render: (_value, supply: Supply) => 
        getSupplyCategoryLabel(supply.category, t)
    },
    { 
      key: 'presentation', 
      label: t('supplies.form.presentation'), 
      render: (_value, supply: Supply) =>
        supply.presentation || '-'
    },
    { 
      key: 'price_cents', 
      label: t('supplies.pricePerPresentation'), 
      render: (_value, supply: Supply) =>
        formatCurrency(supply.price_cents)
    },
    { 
      key: 'portions', 
      label: t('supplies.form.portions') 
    },
    { 
      key: 'cost_per_portion_cents', 
      label: t('supplies.pricePerPortion'), 
      render: (_value, supply: Supply) =>
        <span className="font-medium text-green-600">
          {formatCurrency(supply.cost_per_portion_cents)}
        </span>
    },
    { 
      key: 'actions', 
      label: t('common.actions'), 
      render: (_value, supply: Supply) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEdit(supply)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(supply.id!)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  // Calculate metrics
  const totalSupplies = supplies.length;
  const totalValue = supplies.reduce((sum, s) => sum + s.price_cents, 0);
  const avgPricePerPortion = supplies.length > 0
    ? supplies.reduce((sum, s) => sum + s.cost_per_portion_cents, 0) / supplies.length
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('supplies.title')}
        subtitle={t('supplies.subtitle')}
      />

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('supplies.totalSupplies')}</p>
              <p className="text-2xl font-semibold">{totalSupplies}</p>
            </div>
            <Package className="h-8 w-8 text-gray-400" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('supplies.totalValue')}</p>
              <p className="text-2xl font-semibold">{formatCurrency(totalValue)}</p>
            </div>
            <Package className="h-8 w-8 text-gray-400" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('supplies.avgPricePerPortion')}</p>
              <p className="text-2xl font-semibold">{formatCurrency(avgPricePerPortion)}</p>
            </div>
            <Package className="h-8 w-8 text-gray-400" />
          </div>
        </Card>
      </div>

      {/* Search and Add Button */}
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('supplies.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button onClick={handleOpenDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t('supplies.add')}
        </Button>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="text-center py-8">{t('common.loading')}</div>
      ) : supplies.length === 0 ? (
        <EmptyState
          title={t('supplies.empty')}
          description={t('supplies.emptyDescription')}
        />
      ) : (
        <DataTable
          columns={columns}
          data={supplies}
        />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingSupply ? t('supplies.edit') : t('supplies.add')}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">{t('supplies.form.name')}</Label>
              <Input
                id="name"
                {...register('name')}
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="category">{t('supplies.form.category')}</Label>
              <Select 
                value={watch('category')} 
                onValueChange={(value) => setValue('category', value as SupplyCategory)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {t(`supplies.categories.${cat}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-red-600 mt-1">{errors.category.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="presentation">{t('supplies.form.presentation')}</Label>
              <Input
                id="presentation"
                {...register('presentation')}
                placeholder={t('supplies.presentationPlaceholder')}
                disabled={isSubmitting}
              />
              {errors.presentation && (
                <p className="text-sm text-red-600 mt-1">{errors.presentation.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="price">{t('supplies.form.price')} (MXN)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                {...register('price_pesos', { valueAsNumber: true })}
                placeholder={t('supplies.form.pricePlaceholder')}
                disabled={isSubmitting}
              />
              {errors.price_pesos && (
                <p className="text-sm text-red-600 mt-1">{errors.price_pesos.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="portions">{t('supplies.form.portions')}</Label>
              <Input
                id="portions"
                type="number"
                {...register('portions', { valueAsNumber: true })}
                disabled={isSubmitting}
              />
              {errors.portions && (
                <p className="text-sm text-red-600 mt-1">{errors.portions.message}</p>
              )}
            </div>

            {/* Live preview */}
            {costPerPortionPreview > 0 && (
              <div className="p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-900">
                  {t('supplies.pricePerPortion')}: {' '}
                  <span className="font-semibold">
                    {formatCurrency(costPerPortionPreview)}
                  </span>
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={isSubmitting}
              >
                {t('supplies.form.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  t('supplies.form.save')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}