'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/data-table';
import { formatCurrency } from '@/lib/money';
import { Plus, Edit, Trash2, Search, Package } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
  const [services, setServices] = useState<Service[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSuppliesOpen, setIsSuppliesOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceSupplies, setServiceSupplies] = useState<ServiceSupply[]>([]);
  const [formSupplies, setFormSupplies] = useState<ServiceSupply[]>([]);

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
      const res = await fetch('/api/services');
      if (res.ok) {
        const data = await res.json();
        console.log('Services response:', data); // Debug
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
      const res = await fetch('/api/supplies');
      if (res.ok) {
        const data = await res.json();
        console.log('Supplies loaded:', data); // Debug
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
      } else {
        const error = await res.json();
        alert(error.error || 'Error al crear categoría');
      }
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchSupplies();
    fetchCategories();
  }, []);

  // Crear o actualizar servicio
  const onSubmit = async (data: ServiceForm) => {
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
      
      console.log('Enviando servicio con insumos:', serviceData); // Debug
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData)
      });

      const result = await res.json();
      
      if (res.ok) {
        console.log('Service saved successfully:', result);
        await fetchServices(); // Esperar a que se recarguen los servicios
        setIsOpen(false);
        reset();
        setEditingService(null);
        setFormSupplies([]); // Limpiar insumos del formulario
      } else {
        console.error('Error del servidor:', result);
        alert(t('common.error') + ': ' + (result.message || result.error));
      }
    } catch (error) {
      console.error('Error saving service:', error);
    }
  };

  // Eliminar servicio
  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirmDelete'))) return;
    
    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchServices();
      }
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  // Abrir modal de edición
  const handleEdit = async (service: Service) => {
    setEditingService(service);
    setValue('name', service.name);
    setValue('category', service.category as any);
    setValue('est_minutes', service.est_minutes);
    setValue('description', service.description || '');
    
    // Cargar insumos del servicio existente
    try {
      const res = await fetch(`/api/services/${service.id}/supplies`);
      if (res.ok) {
        const data = await res.json();
        setFormSupplies(data || []);
      }
    } catch (error) {
      console.error('Error fetching service supplies for edit:', error);
      setFormSupplies([]);
    }
    
    setIsOpen(true);
  };

  // Abrir modal de insumos
  const handleManageSupplies = async (service: Service) => {
    setSelectedService(service);
    setServiceSupplies([]); // Inicializar como array vacío
    
    // Cargar insumos del servicio
    try {
      const res = await fetch(`/api/services/${service.id}/supplies`);
      if (res.ok) {
        const data = await res.json();
        setServiceSupplies(data || []);
      }
    } catch (error) {
      console.error('Error fetching service supplies:', error);
      setServiceSupplies([]);
    }
    
    setIsSuppliesOpen(true);
  };

  // Agregar insumo al servicio
  const handleAddSupply = async (supplyId: string, qty: number) => {
    if (!selectedService) return;
    
    try {
      const res = await fetch(`/api/services/${selectedService.id}/supplies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supply_id: supplyId, qty })
      });

      if (res.ok) {
        // Recargar insumos del servicio
        const suppliesRes = await fetch(`/api/services/${selectedService.id}/supplies`);
        if (suppliesRes.ok) {
          const data = await suppliesRes.json();
          setServiceSupplies(data);
        }
        fetchServices(); // Actualizar costo variable
      }
    } catch (error) {
      console.error('Error adding supply:', error);
    }
  };

  // Eliminar insumo del servicio
  const handleRemoveSupply = async (supplyId: string) => {
    if (!selectedService) return;
    
    try {
      // Primero necesitamos encontrar el ID del registro service_supplies
      const serviceSupply = serviceSupplies?.find(ss => ss.supply_id === supplyId);
      if (!serviceSupply || !serviceSupply.id) {
        // Si no hay ID, intentamos eliminar por supply_id directamente
        // mediante un DELETE especial en la API
        const res = await fetch(`/api/services/${selectedService.id}/supplies`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supply_id: supplyId })
        });
        
        if (res.ok) {
          setServiceSupplies(prev => prev.filter(ss => ss.supply_id !== supplyId));
          fetchServices();
        }
        return;
      }
      
      // Si tenemos el ID, usamos la ruta existente
      const res = await fetch(`/api/services/${selectedService.id}/supplies/${serviceSupply.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setServiceSupplies(prev => prev.filter(ss => ss.supply_id !== supplyId));
        fetchServices(); // Actualizar costo variable
      }
    } catch (error) {
      console.error('Error removing supply:', error);
    }
  };

  // Filtrar servicios
  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(search.toLowerCase()) ||
    service.category.toLowerCase().includes(search.toLowerCase())
  );

  // Columnas de la tabla
  const columns = [
    { key: 'name', label: t('services.name') },
    { key: 'category', label: t('services.category'), render: (service: Service) => {
      const category = categories.find(c => c.name === service.category);
      return category?.display_name || service.category;
    }},
    { key: 'est_minutes', label: t('services.duration'), render: (service: Service) => `${service.est_minutes} ${t('common.minutes')}` },
    { key: 'variable_cost_cents', label: t('services.variableCost') + ' (' + t('common.optional') + ')', render: (service: Service) => formatCurrency(service.variable_cost_cents || 0) },
    { 
      key: 'actions', 
      label: t('common.actions'),
      render: (service: Service) => (
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => handleManageSupplies(service)}
            title={t('services.manageSuppliesHint')}
          >
            <Package className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleEdit(service)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleDelete(service.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
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
                              console.log('Rendering supplies dropdown, supplies:', supplies);
                              const availableSupplies = supplies?.filter(s => !formSupplies.some(fs => fs.supply_id === s.id));
                              console.log('Available supplies after filter:', availableSupplies);
                              
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
                    }}>
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit">
                      {t('common.save')}
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
            <div className="text-center py-8 text-muted-foreground">
              {t('services.noServices')}
            </div>
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

      {/* Modal de gestión de insumos */}
      <Dialog open={isSuppliesOpen} onOpenChange={setIsSuppliesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t('services.manageSupplies')} - {selectedService?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">{t('services.addSupply')}</h4>
              <div className="flex gap-2">
                <Select onValueChange={(supplyId) => {
                  const input = document.getElementById('quantity') as HTMLInputElement;
                  const qty = parseFloat(input?.value || '1');
                  if (supplyId && qty > 0) {
                    handleAddSupply(supplyId, qty);
                    input.value = '1';
                  }
                }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t('services.selectSupply')} />
                  </SelectTrigger>
                  <SelectContent>
                    {supplies && supplies.length > 0 ? (
                      supplies
                        .filter(s => !serviceSupplies?.some(ss => ss.supply_id === s.id))
                        .map(supply => (
                          <SelectItem key={supply.id} value={supply.id}>
                            {supply.name} - {supply.presentation}
                          </SelectItem>
                        ))
                    ) : (
                      <SelectItem value="_placeholder" disabled>
                        {t('services.noSuppliesAvailable')}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Input 
                  id="quantity"
                  type="number" 
                  placeholder={t('services.quantity')}
                  className="w-24"
                  defaultValue="1"
                  step="0.1"
                  min="0.1"
                />
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">{t('services.currentSupplies')}</h4>
              {!serviceSupplies || serviceSupplies.length === 0 ? (
                <p className="text-muted-foreground">{t('services.noSupplies')}</p>
              ) : (
                <div className="space-y-2">
                  {serviceSupplies?.map(ss => {
                    const supply = supplies?.find(s => s.id === ss.supply_id);
                    if (!supply) return null;
                    const cost = (supply.cost_per_portion_cents * ss.qty) / 100;
                    
                    return (
                      <div key={ss.supply_id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <span className="font-medium">{supply.name}</span>
                          <span className="text-muted-foreground ml-2">({supply.presentation})</span>
                          <span className="ml-4">x {ss.qty}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(cost * 100)}</span>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleRemoveSupply(ss.supply_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t">
                    <div className="flex justify-between font-medium">
                      <span>{t('services.totalVariableCost')}</span>
                      <span>
                        {formatCurrency(
                          serviceSupplies?.reduce((total, ss) => {
                            const supply = supplies?.find(s => s.id === ss.supply_id);
                            return total + (supply ? supply.cost_per_portion_cents * ss.qty : 0);
                          }, 0) || 0
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}