'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/contexts/workspace-context';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/DataTable';
import { formatCurrency } from '@/lib/money';
import { Plus, Edit, Trash2, Search, Package, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown';
import { ConfirmDialog, createDeleteConfirm } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';

// Schema de validación
const serviceSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  category: z.string().default('otros').optional(), // Ahora acepta cualquier string
  est_minutes: z.number().min(5, 'La duración mínima es 5 minutos').max(480, 'La duración máxima es 8 horas'),
  description: z.string().optional()
});

type ServiceForm = z.infer<typeof serviceSchema>;

interface Supply {
  id: string;
  name: string;
  presentation: string;
  cost_per_portion_cents: number;
}

interface ServiceSupply {
  id?: string; // ID del registro en service_supplies
  supply_id: string;
  supply?: Supply;
  qty: number; // Database uses 'qty' not 'quantity'
}

interface Category {
  id: string;
  name: string;
  display_name: string;
  is_system: boolean;
  display_order: number;
}

interface Service {
  id: string;
  name: string;
  category: string;
  est_minutes: number;
  description?: string;
  active: boolean;
  service_supplies?: ServiceSupply[];
  variable_cost_cents?: number;
}

export default function ServicesPage() {
  const t = useTranslations();
  const { currentClinic } = useWorkspace(); // ✅ Obtener clínica actual
  const [services, setServices] = useState<Service[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formSupplies, setFormSupplies] = useState<ServiceSupply[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingService, setDeletingService] = useState<Service | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      category: 'otros',
      est_minutes: 30
    }
  });

  // Cargar servicios
  const fetchServices = async () => {
    try {
      const res = await fetch(`/api/services?clinicId=${currentClinic.id}`);
      if (res.ok) {
        const data = await res.json();
        // El API puede devolver directamente el array o {data: [...]}
        const servicesArray = Array.isArray(data) ? data : (data.data || []);
        setServices(servicesArray);
      } else {
        const error = await res.json();
        console.error('Error response from services API:', error);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar insumos disponibles
  const fetchSupplies = async () => {
    try {
      const res = await fetch(`/api/supplies?clinicId=${currentClinic.id}`);
      if (res.ok) {
        const data = await res.json();
        // El API devuelve {data: [...]} o directamente el array
        const suppliesArray = data.data || data;
        setSupplies(suppliesArray);
      }
    } catch (error) {
      console.error('Error fetching supplies:', error);
    }
  };

  // Cargar categorías
  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories?entity_type=service');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Crear categoría personalizada
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'service',
          name: newCategoryName.toLowerCase().replace(/\s+/g, '_'),
          display_name: newCategoryName
        })
      });

      if (res.ok) {
        fetchCategories();
        setNewCategoryName('');
        setIsCategoryOpen(false);
        toast.success(t('services.categoryCreated'));
      } else {
        const error = await res.json();
        toast.error(error.error || t('services.categoryError'));
      }
    } catch (error) {
      toast.error(t('services.categoryError'));
    }
  };

  useEffect(() => {
    fetchServices();
    fetchSupplies();
    fetchCategories();
  }, []);

  // Crear o actualizar servicio
  const onSubmit = async (data: ServiceForm) => {
    setIsSubmitting(true);
    try {
      // Asegurar que category tenga un valor por defecto
      const serviceData = {
        ...data,
        category: data.category || 'otros',
        supplies: formSupplies // Incluir insumos en el formulario
      };
      
      const url = editingService 
        ? `/api/services/${editingService.id}`
        : '/api/services';
      
      const method = editingService ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData)
      });

      const result = await res.json();
      
      if (res.ok) {
        toast.success(editingService ? t('services.updateSuccess') : t('services.createSuccess'));
        await fetchServices(); // Esperar a que se recarguen los servicios
        setIsOpen(false);
        reset();
        setEditingService(null);
        setFormSupplies([]); // Limpiar insumos del formulario
      } else {
        console.error('Error del servidor:', result);
        toast.error(result.message || result.error || t('services.saveError'));
      }
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error(t('services.saveError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar servicio
  const handleDeleteClick = (service: Service) => {
    setDeletingService(service);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingService) return;
    
    try {
      const res = await fetch(`/api/services/${deletingService.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('services.deleteSuccess'));
        fetchServices();
      } else {
        const error = await res.json();
        toast.error(error.message || t('services.deleteError'));
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error(t('services.deleteError'));
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingService(null);
    }
  };

  // Abrir modal de edición
  const handleEdit = async (service: Service) => {
    setEditingService(service);
    setValue('name', service.name);
    setValue('category', service.category as any);
    setValue('est_minutes', service.est_minutes);
    setValue('description', service.description || '');
    
    // Cargar insumos del servicio existente directamente al abrir editar
    try {
      const res = await fetch(`/api/services/${service.id}/supplies`);
      if (res.ok) {
        const payload = await res.json();
        const arr = Array.isArray(payload) ? payload : (payload.data || []);
        setFormSupplies(arr);
      }
    } catch (error) {
      console.error('Error fetching service supplies for edit:', error);
      setFormSupplies([]);
    }
    
    setIsOpen(true);
  };

  // Eliminado: gestión separada de insumos; ahora sólo desde el modal de editar

  // Agregar insumo al servicio
  const handleAddSupply = async (_supplyId: string, _qty: number) => {};

  // Eliminar insumo del servicio
  const handleRemoveSupply = async (_supplyId: string) => {};

  // Filtrar servicios
  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(search.toLowerCase()) ||
    service.category.toLowerCase().includes(search.toLowerCase())
  );

  // Columnas de la tabla
  const columns = [
    { key: 'name', label: t('services.name') },
    { key: 'category', label: t('services.category'), render: (_value: any, service: Service) => {
      const category = categories.find(c => c.name === service.category);
      return category?.display_name || service.category;
    }},
    { key: 'est_minutes', label: t('services.duration'), render: (_value: any, service: Service) => `${service.est_minutes} ${t('common.minutes')}` },
    { key: 'variable_cost_cents', label: t('services.variableCost') + ' (' + t('common.optional') + ')', render: (_value: any, service: Service) => formatCurrency(service.variable_cost_cents || 0) },
    { 
      key: 'actions', 
      label: t('common.actions'),
      render: (_value: any, service: Service) => (
        <ActionDropdown
          actions={[
            createEditAction(() => handleEdit(service), t('services.edit')),
            createDeleteAction(() => handleDeleteClick(service), t('services.delete'))
          ]}
        />
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title={t('services.title')} 
        subtitle={t('services.subtitle')} 
      />

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{t('services.listTitle')}</CardTitle>
              <CardDescription>{t('services.listDescription')}</CardDescription>
            </div>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { reset(); setEditingService(null); setFormSupplies([]); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('services.addService')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingService ? t('services.editService') : t('services.addService')}
                    </DialogTitle>
                    <DialogDescription>
                      {editingService ? t('services.editServiceDesc') : t('services.addServiceDesc')}
                    </DialogDescription>
                  </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">{t('services.name')}</Label>
                    <Input 
                      id="name"
                      {...register('name')}
                      placeholder={t('services.namePlaceholder')}
                    />
                    {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label htmlFor="category">{t('services.category')} ({t('common.optional')})</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsCategoryOpen(true)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {t('services.addCategory')}
                      </Button>
                    </div>
                    <Select 
                      onValueChange={(value) => setValue('category', value as any)}
                      defaultValue={editingService?.category || 'otros'}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('services.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Categorías del sistema */}
                        {categories.filter(c => c.is_system).length > 0 && (
                          <>
                            <SelectItem value="_placeholder" disabled>
                              <strong>{t('services.systemCategories')}</strong>
                            </SelectItem>
                            {categories
                              .filter(c => c.is_system)
                              .map(cat => (
                                <SelectItem key={cat.id} value={cat.name}>
                                  {cat.display_name}
                                </SelectItem>
                              ))}
                          </>
                        )}
                        
                        {/* Categorías personalizadas */}
                        {categories.filter(c => !c.is_system).length > 0 && (
                          <>
                            <SelectItem value="_placeholder" disabled>
                              <strong>{t('services.customCategories')}</strong>
                            </SelectItem>
                            {categories
                              .filter(c => !c.is_system)
                              .map(cat => (
                                <SelectItem key={cat.id} value={cat.name}>
                                  {cat.display_name} •
                                </SelectItem>
                              ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.category && <p className="text-sm text-red-500">{errors.category.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="duration">{t('services.duration')} ({t('common.minutes')})</Label>
                    <Input 
                      id="duration"
                      type="number"
                      {...register('est_minutes', { valueAsNumber: true })}
                      placeholder="60"
                    />
                    {errors.est_minutes && <p className="text-sm text-red-500">{errors.est_minutes.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="description">{t('services.description')}</Label>
                    <Input 
                      id="description"
                      {...register('description')}
                      placeholder={t('services.descriptionPlaceholder')}
                    />
                  </div>

                  {/* Sección de insumos dentro del formulario */}
                  <div className="border-t pt-4">
                    <Label>{t('services.recipe')} ({t('common.optional')})</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      {t('services.manageSuppliesHint')}
                    </p>
                    
                    <div className="space-y-3">
                      {/* Agregar nuevo insumo */}
                      <div className="flex gap-2">
                        <Select onValueChange={(supplyId) => {
                          const qtyInput = document.getElementById('form-supply-qty') as HTMLInputElement;
                          const qty = parseFloat(qtyInput?.value || '1');
                          if (supplyId && qty > 0) {
                            const supply = supplies.find(s => s.id === supplyId);
                            if (supply && !formSupplies.some(fs => fs.supply_id === supplyId)) {
                              setFormSupplies([...formSupplies, { 
                                supply_id: supplyId, 
                                supply, 
                                qty 
                              }]);
                              qtyInput.value = '1';
                            }
                          }
                        }}>
                           <SelectTrigger className="flex-1">
                            <SelectValue placeholder={t('services.selectSupply')} />
                          </SelectTrigger>
                          <SelectContent>
                             {(() => {
                               const availableSupplies = supplies?.filter(s => !formSupplies.some(fs => fs.supply_id === s.id));
                               if (!availableSupplies || availableSupplies.length === 0) {
                                 return (
                                   <SelectItem value="_placeholder" disabled>
                                     {t('services.noSuppliesAvailable')}
                                   </SelectItem>
                                 );
                               }
                               return availableSupplies.map(supply => (
                                 <SelectItem key={supply.id} value={supply.id}>
                                   {supply.name} - {supply.presentation}
                                 </SelectItem>
                               ));
                             })()}
                          </SelectContent>
                        </Select>
                        <Input 
                          id="form-supply-qty"
                          type="number" 
                          placeholder={t('services.quantity')}
                          className="w-24"
                          defaultValue="1"
                          step="0.1"
                          min="0.1"
                        />
                      </div>

                      {/* Lista de insumos agregados */}
                      {formSupplies.length > 0 && (
                        <div className="border rounded-lg p-3 space-y-2">
                          <p className="text-sm font-medium">{t('services.currentSupplies')}:</p>
                          {formSupplies.map(fs => {
                            const supply = supplies.find(s => s.id === fs.supply_id) || fs.supply;
                            if (!supply) return null;
                            const cost = (supply.cost_per_portion_cents * fs.qty) / 100;
                            
                            return (
                              <div key={fs.supply_id} className="flex justify-between items-center text-sm">
                                <div>
                                  <span>{supply.name}</span>
                                  <span className="text-muted-foreground ml-2">x {fs.qty}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span>{formatCurrency(cost * 100)}</span>
                                  <Button 
                                    type="button"
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => setFormSupplies(formSupplies.filter(s => s.supply_id !== fs.supply_id))}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                          <div className="pt-2 border-t">
                            <div className="flex justify-between text-sm font-medium">
                              <span>{t('services.totalVariableCost')}</span>
                              <span>
                                {formatCurrency(
                                  formSupplies.reduce((total, fs) => {
                                    const supply = supplies.find(s => s.id === fs.supply_id) || fs.supply;
                                    return total + (supply ? supply.cost_per_portion_cents * fs.qty : 0);
                                  }, 0)
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => {
                      setIsOpen(false);
                      setFormSupplies([]);
                    }} disabled={isSubmitting}>
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t('common.loading')}
                        </>
                      ) : (
                        t('common.save')
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">{t('common.loading')}</div>
          ) : filteredServices.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8" />}
              title={search ? t('services.noSearchResults') : t('services.emptyTitle')}
              description={search ? t('services.tryDifferentSearch') : t('services.emptyDescription')}
              action={!search && (
                <Button onClick={() => { reset(); setEditingService(null); setFormSupplies([]); setIsOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('services.addService')}
                </Button>
              )}
            />
          ) : (
            <DataTable columns={columns} data={filteredServices} />
          )}
        </CardContent>
      </Card>

      {/* Modal para crear nueva categoría */}
      <Dialog open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('services.createCategory')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newCategory">{t('services.categoryName')}</Label>
              <Input
                id="newCategory"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t('services.categoryNamePlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateCategory();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCategoryOpen(false);
                  setNewCategoryName('');
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
              >
                {t('common.create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        {...createDeleteConfirm(handleDeleteConfirm, deletingService?.name)}
      />
    </div>
  );
}