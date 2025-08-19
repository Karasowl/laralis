'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/contexts/workspace-context';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar, 
  Activity,
  FileText,
  Package,
  Clock,
  Brain,
  BarChart3
} from 'lucide-react';
import { formatCurrency } from '@/lib/money';
import { ReportsAdvanced } from './ReportsAdvanced';

interface DashboardData {
  patientsMonth: number;
  treatmentsMonth: number;
  revenueMonth: number;
  averageMargin: number;
  topServices: Array<{ name: string; count: number; revenue: number }>;
  monthlyTrend: Array<{ month: string; revenue: number; treatments: number }>;
}

export default function ReportsPage() {
  const t = useTranslations();
  const { currentClinic } = useWorkspace(); // ✅ Obtener clínica actual
  const [data, setData] = useState<DashboardData>({
    patientsMonth: 0,
    treatmentsMonth: 0,
    revenueMonth: 0,
    averageMargin: 0,
    topServices: [],
    monthlyTrend: []
  });
  const [loading, setLoading] = useState(true);

  // ✅ Recargar cuando cambie la clínica
  useEffect(() => {
    if (currentClinic?.id) {
      loadDashboardData();
    }
  }, [currentClinic?.id]);

  const loadDashboardData = async () => {
    try {
      // Cargar datos de tratamientos
      const treatmentsRes = await fetch('/api/treatments');
      if (treatmentsRes.ok) {
        const treatments = await treatmentsRes.json();
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        // Filtrar tratamientos del mes actual
        const monthTreatments = (treatments.data || []).filter((t: any) => {
          const date = new Date(t.treatment_date);
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        // Calcular ingresos del mes
        const revenueMonth = monthTreatments.reduce((sum: number, t: any) => 
          sum + (t.price_cents || 0), 0);

        // Calcular margen promedio
        const margins = monthTreatments.map((t: any) => t.margin_pct || 0);
        const averageMargin = margins.length > 0 
          ? margins.reduce((a: number, b: number) => a + b, 0) / margins.length
          : 0;

        setData(prev => ({
          ...prev,
          treatmentsMonth: monthTreatments.length,
          revenueMonth,
          averageMargin: Math.round(averageMargin)
        }));
      }

      // Cargar datos de pacientes
      const patientsRes = await fetch('/api/patients');
      if (patientsRes.ok) {
        const patients = await patientsRes.json();
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        // Filtrar pacientes del mes actual
        const monthPatients = (patients.data || []).filter((p: any) => {
          const date = new Date(p.created_at);
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        setData(prev => ({
          ...prev,
          patientsMonth: monthPatients.length
        }));
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const metricCards = [
    {
      title: 'Pacientes Este Mes',
      value: data.patientsMonth,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      format: 'number'
    },
    {
      title: 'Tratamientos Este Mes',
      value: data.treatmentsMonth,
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      format: 'number'
    },
    {
      title: 'Ingresos del Mes',
      value: data.revenueMonth,
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      format: 'currency'
    },
    {
      title: 'Margen Promedio',
      value: data.averageMargin,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      format: 'percentage'
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes y Análisis"
        subtitle="Análisis completo del rendimiento de tu clínica con predicciones inteligentes"
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Resumen General
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Análisis Avanzado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Métricas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{metric.title}</p>
                    <p className="text-2xl font-bold mt-2">
                      {metric.format === 'currency' 
                        ? formatCurrency(metric.value)
                        : metric.format === 'percentage'
                        ? `${metric.value}%`
                        : metric.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                    <Icon className={`h-6 w-6 ${metric.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumen de actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resumen del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm text-muted-foreground">Pacientes nuevos</span>
                <span className="font-medium">{data.patientsMonth}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm text-muted-foreground">Tratamientos realizados</span>
                <span className="font-medium">{data.treatmentsMonth}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Promedio por tratamiento</span>
                <span className="font-medium">
                  {data.treatmentsMonth > 0 
                    ? formatCurrency(data.revenueMonth / data.treatmentsMonth)
                    : formatCurrency(0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Análisis Financiero
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm text-muted-foreground">Ingresos totales del mes</span>
                <span className="font-medium">{formatCurrency(data.revenueMonth)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm text-muted-foreground">Margen promedio</span>
                <span className="font-medium">{data.averageMargin}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pacientes atendidos</span>
                <span className="font-medium">{data.patientsMonth}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </TabsContent>

      <TabsContent value="advanced">
        <ReportsAdvanced />
      </TabsContent>
      </Tabs>
    </div>
  );
}