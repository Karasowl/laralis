'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/contexts/workspace-context';
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
import { Plus, Edit, Trash2, Search, Package, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown';
import { ConfirmDialog, createDeleteConfirm } from '@/components/ui/ConfirmDialog';

type SupplyFormData = z.infer<typeof zSupplyForm>;

export default function SuppliesPage() {
  const t = useTranslations();
  const { currentClinic } = useWorkspace(); // ✅ Obtener clínica actual
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSupply, setDeletingSupply] = useState<Supply | null>(null);

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
        price_pesos: data.price_pesos, // Enviar como pesos, la API lo convierte
        portions: data.portions
      };

      const url = editingSupply 
        ? `/api/supplies/${editingSupply.id}`
        : '/api/supplies';
      
      const method = editingSupply ? 'PUT' : 'POST';

      console.log('Sending to:', url, 'Method:', method, 'Payload:', payload);
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();
      console.log('Response status:', response.status, 'Data:', responseData);

      if (response.ok) {
        toast.success(editingSupply ? t('supplies.updateSuccess') : t('supplies.createSuccess'));
        await fetchSupplies();
        handleCloseDialog();
      } else {
        console.error('Error saving supply:', responseData);
        toast.error(`${responseData.error || t('supplies.saveError')}: ${responseData.message || ''}`);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(t('supplies.saveError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit supply
  const handleEdit = (supply: Supply) => {
    console.log('Editing supply:', supply);
    setEditingSupply(supply);
    
    // Asegurar que la categoría sea válida
    const validCategory = categories.includes(supply.category as SupplyCategory) 
      ? supply.category as SupplyCategory 
      : 'otros';
    
    reset({
      name: supply.name,
      category: validCategory,
      presentation: supply.presentation || '',
      price_pesos: supply.price_cents / 100,
      portions: supply.portions
    });
    setIsDialogOpen(true);
  };

  // Delete supply
  const handleDeleteClick = (supply: Supply) => {
    setDeletingSupply(supply);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSupply) return;
    
    try {
      const response = await fetch(`/api/supplies/${deletingSupply.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success(t('supplies.deleteSuccess'));
        await fetchSupplies();
      } else {
        const error = await response.json();
        toast.error(error.message || t('supplies.deleteError'));
      }
    } catch (error) {
      console.error('Error deleting supply:', error);
      toast.error(t('supplies.deleteError'));
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingSupply(null);
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
        <ActionDropdown
          actions={[
            createEditAction(() => handleEdit(supply), t('supplies.edit')),
            createDeleteAction(() => handleDeleteClick(supply), t('supplies.delete'))
          ]}
        />
      )
    }
  ];


  return (
    <div className="space-y-6">
      <PageHeader
        title={t('supplies.title')}
        subtitle={t('supplies.subtitle')}
      />


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
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t('supplies.listTitle')}</h3>
          {loading ? (
            <div className="text-center py-8">{t('common.loading')}</div>
          ) : supplies.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8" />}
              title={searchTerm ? t('supplies.noSearchResults') : t('supplies.emptyTitle')}
              description={searchTerm ? t('supplies.tryDifferentSearch') : t('supplies.emptyDescription')}
              action={!searchTerm && (
                <Button onClick={handleOpenDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('supplies.add')}
                </Button>
              )}
            />
          ) : (
            <DataTable
              columns={columns}
              data={supplies}
            />
          )}
        </div>
      </Card>

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
              <Label htmlFor="price">{t('supplies.form.price')}</Label>
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        {...createDeleteConfirm(handleDeleteConfirm, deletingSupply?.name)}
      />
    </div>
  );
}