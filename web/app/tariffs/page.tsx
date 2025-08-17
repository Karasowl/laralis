'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/contexts/workspace-context';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import { ServiceWithCost, ApiResponse } from '@/lib/types';
import { calcularPrecioFinal } from '@/lib/calc/tarifa';
import { redondearA } from '@/lib/money';
import { Calculator, RefreshCw } from 'lucide-react';

interface TariffRow extends ServiceWithCost {
  margin_pct: number;
  final_price: number;
  rounded_price: number;
}

export default function TariffsPage() {
  const t = useTranslations();
  const { currentClinic } = useWorkspace(); // ✅ Obtener clínica actual
  const [services, setServices] = useState<ServiceWithCost[]>([]);
  const [tariffs, setTariffs] = useState<TariffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultMargin, setDefaultMargin] = useState(30);
  const [roundTo, setRoundTo] = useState(10);

  useEffect(() => {
    fetchServicesWithCosts();
  }, []);

  const fetchServicesWithCosts = async () => {
    try {
      // First get all services (API can return array or { data: [...] })
      const servicesResponse = await fetch(`/api/services?clinicId=${currentClinic.id}`);
      const raw = await servicesResponse.json();
      const servicesArray: ServiceWithCost[] = Array.isArray(raw) ? raw : (raw.data || []);

      if (!servicesArray || servicesArray.length === 0) {
        setServices([]);
        setTariffs([]);
        return;
      }

      // Fetch cost for each service in parallel
      const servicesWithCosts: ServiceWithCost[] = await Promise.all(
        servicesArray.map(async (service) => {
          try {
            const costResponse = await fetch(`/api/services/${service.id}/cost`);
            const costResult = await costResponse.json();
            return costResult?.data ?? service;
          } catch (error) {
            console.error(`Error fetching cost for service ${service.id}:`, error);
            return service;
          }
        })
      );

      setServices(servicesWithCosts);

      // Initialize tariffs with default margin
      const initialTariffs = servicesWithCosts.map(service => {
        const totalCost = (service.fixed_cost_cents || 0) + (service.variable_cost_cents || 0);
        const finalPrice = calcularPrecioFinal(totalCost, defaultMargin);
        const roundedPrice = redondearA(finalPrice, roundTo * 100);

        return {
          ...service,
          margin_pct: defaultMargin,
          final_price: finalPrice,
          rounded_price: roundedPrice
        };
      });

      setTariffs(initialTariffs);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarginChange = (serviceId: string, margin: number) => {
    setTariffs(prevTariffs => 
      prevTariffs.map(tariff => {
        if (tariff.id === serviceId) {
          const totalCost = (tariff.fixed_cost_cents || 0) + (tariff.variable_cost_cents || 0);
          const finalPrice = calcularPrecioFinal(totalCost, margin);
          const roundedPrice = redondearA(finalPrice, roundTo * 100);
          
          return {
            ...tariff,
            margin_pct: margin,
            final_price: finalPrice,
            rounded_price: roundedPrice
          };
        }
        return tariff;
      })
    );
  };

  const handleApplyDefaultMargin = () => {
    setTariffs(prevTariffs =>
      prevTariffs.map(tariff => {
        const totalCost = (tariff.fixed_cost_cents || 0) + (tariff.variable_cost_cents || 0);
        const finalPrice = calcularPrecioFinal(totalCost, defaultMargin);
        const roundedPrice = redondearA(finalPrice, roundTo * 100);
        
        return {
          ...tariff,
          margin_pct: defaultMargin,
          final_price: finalPrice,
          rounded_price: roundedPrice
        };
      })
    );
  };

  const handleRoundingChange = (newRoundTo: number) => {
    setRoundTo(newRoundTo);
    
    setTariffs(prevTariffs =>
      prevTariffs.map(tariff => ({
        ...tariff,
        rounded_price: redondearA(tariff.final_price, newRoundTo * 100)
      }))
    );
  };

  const columns = [
    { key: 'name', label: t('tariffs.service') },
    { key: 'est_minutes', label: t('tariffs.duration'), render: (_value: any, row: TariffRow) =>
      `${row.est_minutes} min`
    },
    { key: 'fixed_cost_cents', label: t('tariffs.fixedCost'), render: (_value: any, row: TariffRow) =>
      formatCurrency((row.fixed_cost_cents || 0))
    },
    { key: 'variable_cost_cents', label: t('tariffs.variableCost'), render: (_value: any, row: TariffRow) =>
      formatCurrency((row.variable_cost_cents || 0))
    },
    { key: 'total_cost', label: t('tariffs.totalCost'), render: (_value: any, row: TariffRow) => {
      const total = ((row.fixed_cost_cents || 0) + (row.variable_cost_cents || 0));
      return formatCurrency(total);
    }},
    { key: 'margin_pct', label: t('tariffs.margin'), render: (_value: any, row: TariffRow) => (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min="0"
          max="100"
          value={row.margin_pct}
          onChange={(e) => handleMarginChange(row.id!, parseInt(e.target.value) || 0)}
          className="w-16 h-8 text-sm"
        />
        <span className="text-sm">%</span>
      </div>
    )},
    { key: 'final_price', label: t('tariffs.finalPrice'), render: (_value: any, row: TariffRow) =>
      formatCurrency(row.final_price)
    },
    { key: 'rounded_price', label: t('tariffs.roundedPrice'), render: (_value: any, row: TariffRow) =>
      <span className="font-semibold text-green-600">
        {formatCurrency(row.rounded_price)}
      </span>
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('tariffs.title')}
        subtitle={t('tariffs.subtitle')}
      />

      {/* Controls */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="defaultMargin">{t('tariffs.defaultMargin')}</Label>
            <div className="flex gap-2">
              <Input
                id="defaultMargin"
                type="number"
                min="0"
                max="100"
                value={defaultMargin}
                onChange={(e) => setDefaultMargin(parseInt(e.target.value) || 0)}
                className="flex-1"
              />
              <Button onClick={handleApplyDefaultMargin} size="sm">
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('tariffs.apply')}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="roundTo">{t('tariffs.roundTo')}</Label>
            <Select
              value={roundTo.toString()}
              onValueChange={(value) => handleRoundingChange(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{formatCurrency(1)}</SelectItem>
                <SelectItem value="5">{formatCurrency(5)}</SelectItem>
                <SelectItem value="10">{formatCurrency(10)}</SelectItem>
                <SelectItem value="50">{formatCurrency(50)}</SelectItem>
                <SelectItem value="100">{formatCurrency(100)}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={() => window.print()} variant="outline">
              {t('common.export')}
            </Button>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <p>{t('tariffs.instructions')}</p>
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="text-center py-8">{t('common.loading')}</div>
      ) : tariffs.length === 0 ? (
        <EmptyState
          title={t('tariffs.empty')}
          description={t('tariffs.emptyDescription')}
        />
      ) : (
        <div className="overflow-x-auto">
          <DataTable
            columns={columns}
            data={tariffs}
          />
        </div>
      )}

      {/* Summary */}
      {tariffs.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">{t('tariffs.summary')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-700">{t('tariffs.totalServices')}:</span>
              <span className="ml-2 font-medium">{tariffs.length}</span>
            </div>
            <div>
              <span className="text-blue-700">{t('tariffs.averageMargin')}:</span>
              <span className="ml-2 font-medium">
                {(tariffs.reduce((sum, t) => sum + t.margin_pct, 0) / tariffs.length).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-blue-700">{t('tariffs.minPrice')}:</span>
              <span className="ml-2 font-medium">
                {formatCurrency(Math.min(...tariffs.map(t => t.rounded_price)))}
              </span>
            </div>
            <div>
              <span className="text-blue-700">{t('tariffs.maxPrice')}:</span>
              <span className="ml-2 font-medium">
                {formatCurrency(Math.max(...tariffs.map(t => t.rounded_price)))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}