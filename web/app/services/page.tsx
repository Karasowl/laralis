'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import { Service, Supply, ServiceSupply, ApiResponse, ServiceWithCost, SettingsTime, FixedCost } from '@/lib/types';
import { costPerPortion, variableCostForService, calculateTreatmentCost } from '@/lib/calc/variable';
import { calcularPrecioFinal } from '@/lib/calc/tarifa';
import { redondearA } from '@/lib/money';
import { calculateTimeCosts } from '@/lib/calc/tiempo';
import { Plus, Pencil, Trash2, Search, Calculator, X, ChevronRight } from 'lucide-react';

interface RecipeLine extends ServiceSupply {
  supply?: Supply;
}

export default function ServicesPage() {
  const t = useTranslations();
  const [services, setServices] = useState<Service[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showRecipePanel, setShowRecipePanel] = useState(false);
  const [recipe, setRecipe] = useState<RecipeLine[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    est_minutes: 30
  });
  const [newRecipeLine, setNewRecipeLine] = useState({
    supply_id: '',
    qty: 1
  });
  const [costSummary, setCostSummary] = useState({
    variableCost: 0,
    fixedPerMinute: 0,
    fixedCostTreatment: 0,
    baseCost: 0,
    marginPct: 40,
    suggestedPrice: 0
  });
  const [timeSettings, setTimeSettings] = useState<SettingsTime | null>(null);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);

  useEffect(() => {
    fetchServices();
    fetchSupplies();
    fetchTimeSettings();
    fetchFixedCosts();
  }, []);

  useEffect(() => {
    if (selectedService && recipe.length > 0) {
      calculateCosts();
    }
  }, [recipe, selectedService, costSummary.marginPct, timeSettings, fixedCosts]);

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services');
      const result: ApiResponse<Service[]> = await response.json();
      
      if (result.data) {
        setServices(result.data);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplies = async () => {
    try {
      const response = await fetch('/api/supplies');
      const result: ApiResponse<Supply[]> = await response.json();
      
      if (result.data) {
        setSupplies(result.data);
      }
    } catch (error) {
      console.error('Error fetching supplies:', error);
    }
  };

  const fetchTimeSettings = async () => {
    try {
      const response = await fetch('/api/settings/time');
      const result: ApiResponse<SettingsTime> = await response.json();
      if (result.data) {
        setTimeSettings(result.data);
      }
    } catch (error) {
      console.error('Error fetching time settings:', error);
    }
  };

  const fetchFixedCosts = async () => {
    try {
      const response = await fetch('/api/fixed-costs');
      const result: ApiResponse<FixedCost[]> = await response.json();
      if (result.data) {
        setFixedCosts(result.data);
      }
    } catch (error) {
      console.error('Error fetching fixed costs:', error);
    }
  };

  const fetchServiceRecipe = async (serviceId: string) => {
    try {
      const response = await fetch(`/api/services/${serviceId}/supplies`);
      const result: ApiResponse<RecipeLine[]> = await response.json();
      
      if (result.data) {
        setRecipe(result.data);
      }
    } catch (error) {
      console.error('Error fetching service recipe:', error);
    }
  };

  const calculateCosts = () => {
    if (!selectedService) return;

    // Calculate variable cost
    const recipeWithSupplies = recipe.filter(r => r.supply).map(r => ({
      qty: r.qty,
      supply: r.supply!
    }));
    const variableCostCents = variableCostForService(recipeWithSupplies);

    // Calculate fixed cost per minute
    let fixedPerMinuteCents = 0;
    if (timeSettings && fixedCosts.length > 0) {
      const totalFixedCents = fixedCosts.reduce((sum, fc) => sum + fc.amount_cents, 0);
      const timeCosts = calculateTimeCosts(
        {
          workDaysPerMonth: timeSettings.work_days,
          hoursPerDay: timeSettings.hours_per_day,
          effectiveWorkPercentage: timeSettings.real_pct
        },
        totalFixedCents
      );
      fixedPerMinuteCents = timeCosts.fixedPerMinuteCents;
    }

    // Calculate treatment costs
    const treatmentCosts = calculateTreatmentCost(
      selectedService.est_minutes,
      fixedPerMinuteCents,
      variableCostCents
    );

    // Calculate suggested price with margin
    const suggestedPriceCents = calcularPrecioFinal(
      treatmentCosts.baseCostCents,
      costSummary.marginPct
    );

    // Round to nearest 10 pesos
    const roundedPriceCents = redondearA(suggestedPriceCents, 1000);

    setCostSummary({
      variableCost: variableCostCents / 100,
      fixedPerMinute: fixedPerMinuteCents / 100,
      fixedCostTreatment: treatmentCosts.fixedCostCents / 100,
      baseCost: treatmentCosts.baseCostCents / 100,
      marginPct: costSummary.marginPct,
      suggestedPrice: roundedPriceCents / 100
    });
  };

  const handleSubmitService = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingService 
        ? `/api/services/${editingService.id}`
        : '/api/services';
      
      const response = await fetch(url, {
        method: editingService ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        fetchServices();
        resetForm();
        
        // If creating new service, open recipe panel
        if (!editingService && result.data) {
          const newService = result.data;
          setSelectedService(newService);
          setShowRecipePanel(true);
        }
      }
    } catch (error) {
      console.error('Error saving service:', error);
    }
  };

  const handleAddRecipeLine = async () => {
    if (!selectedService || !newRecipeLine.supply_id) return;

    try {
      const response = await fetch(`/api/services/${selectedService.id}/supplies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecipeLine)
      });

      if (response.ok) {
        fetchServiceRecipe(selectedService.id!);
        setNewRecipeLine({ supply_id: '', qty: 1 });
      }
    } catch (error) {
      console.error('Error adding recipe line:', error);
    }
  };

  const handleUpdateQty = async (lineId: string, qty: number) => {
    if (!selectedService) return;

    try {
      const response = await fetch(`/api/services/${selectedService.id}/supplies/${lineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty })
      });

      if (response.ok) {
        setRecipe(prev => prev.map(r => 
          r.id === lineId ? { ...r, qty } : r
        ));
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const handleDeleteRecipeLine = async (lineId: string) => {
    if (!selectedService) return;

    try {
      const response = await fetch(`/api/services/${selectedService.id}/supplies/${lineId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setRecipe(prev => prev.filter(r => r.id !== lineId));
      }
    } catch (error) {
      console.error('Error deleting recipe line:', error);
    }
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      est_minutes: service.est_minutes
    });
    setIsFormOpen(true);
  };

  const handleEditRecipe = async (service: Service) => {
    setSelectedService(service);
    setShowRecipePanel(true);
    await fetchServiceRecipe(service.id!);
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm(t('common.confirmDelete'))) return;
    
    try {
      const response = await fetch(`/api/services/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchServices();
      }
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', est_minutes: 30 });
    setEditingService(null);
    setIsFormOpen(false);
  };

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: 'name', label: t('services.name') },
    { key: 'est_minutes', label: t('services.estMinutes'), render: (service: Service) =>
      `${service.est_minutes} ${t('common.minutes')}`
    },
    { key: 'actions', label: t('common.actions'), render: (service: Service) => (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleEditRecipe(service)}
          title={t('services.recipe')}
        >
          <Calculator className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleEditService(service)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleDeleteService(service.id!)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    )}
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('services.title')}
        subtitle={t('services.subtitle')}
      />

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 space-y-6">
          {/* Search and Add */}
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('common.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('services.add')}
            </Button>
          </div>

          {/* Add/Edit Form */}
          {isFormOpen && (
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4">
                {editingService ? t('services.edit') : t('services.add')}
              </h3>
              
              <form onSubmit={handleSubmitService} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">{t('services.name')}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="duration">{t('services.estMinutes')}</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={formData.est_minutes}
                    onChange={(e) => setFormData({...formData, est_minutes: parseInt(e.target.value) || 1})}
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit">
                    {editingService ? t('common.save') : t('common.add')}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Services Table */}
          {loading ? (
            <div className="text-center py-8">{t('common.loading')}</div>
          ) : filteredServices.length === 0 ? (
            <EmptyState
              title={t('services.empty')}
              description={t('services.emptyDescription')}
            />
          ) : (
            <DataTable
              columns={columns}
              data={filteredServices}
            />
          )}
        </div>

        {/* Recipe Panel */}
        {showRecipePanel && selectedService && (
          <div className="w-96 border-l pl-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">{t('services.recipe')}</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowRecipePanel(false);
                  setSelectedService(null);
                  setRecipe([]);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Card className="p-4">
              <h4 className="font-medium mb-2">{selectedService.name}</h4>
              <p className="text-sm text-gray-600">
                {selectedService.est_minutes} {t('common.minutes')}
              </p>
            </Card>

            {/* Add Recipe Line */}
            <Card className="p-4 space-y-3">
              <Label>{t('services.addLine')}</Label>
              <div className="flex gap-2">
                <Select
                  value={newRecipeLine.supply_id}
                  onValueChange={(value) => setNewRecipeLine({...newRecipeLine, supply_id: value})}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t('services.selectSupply')} />
                  </SelectTrigger>
                  <SelectContent>
                    {supplies.map(supply => (
                      <SelectItem key={supply.id} value={supply.id!}>
                        {supply.name} {supply.presentation && `(${supply.presentation})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newRecipeLine.qty}
                  onChange={(e) => setNewRecipeLine({...newRecipeLine, qty: parseFloat(e.target.value) || 0})}
                  className="w-20"
                  placeholder={t('services.qty')}
                />
                <Button onClick={handleAddRecipeLine} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </Card>

            {/* Recipe Lines */}
            {recipe.length > 0 && (
              <Card className="p-4 space-y-2">
                <Label>{t('services.recipeLines')}</Label>
                {recipe.map((line) => (
                  <div key={line.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">
                      {line.supply?.name} {line.supply?.presentation && `(${line.supply.presentation})`}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.qty}
                      onChange={(e) => handleUpdateQty(line.id!, parseFloat(e.target.value) || 0)}
                      className="w-16 h-8"
                    />
                    <span className="w-20 text-right">
                      {line.supply && formatCurrency(
                        line.qty * costPerPortion(line.supply) / 100
                      )}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteRecipeLine(line.id!)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </Card>
            )}

            {/* Cost Summary */}
            {recipe.length > 0 && (
              <Card className="p-4 space-y-3 bg-blue-50">
                <h4 className="font-semibold text-blue-900">{t('services.costSummary')}</h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>{t('services.variableCost')}:</span>
                    <span className="font-medium">{formatCurrency(costSummary.variableCost)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>{t('services.fixedPerMinute')}:</span>
                    <span>{formatCurrency(costSummary.fixedPerMinute)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>{t('services.fixedCostTreatment')}:</span>
                    <span>{formatCurrency(costSummary.fixedCostTreatment)}</span>
                  </div>
                  
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">{t('services.baseCost')}:</span>
                    <span className="font-medium">{formatCurrency(costSummary.baseCost)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('services.marginPct')} (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={costSummary.marginPct}
                    onChange={(e) => setCostSummary({...costSummary, marginPct: parseInt(e.target.value) || 0})}
                  />
                </div>

                <div className="flex justify-between text-lg font-semibold text-green-700 border-t pt-2">
                  <span>{t('services.suggestedPrice')}:</span>
                  <span>{formatCurrency(costSummary.suggestedPrice)}</span>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}