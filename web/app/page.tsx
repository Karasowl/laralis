"use client";
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Users, FileText, TrendingUp, DollarSign, Activity, Calendar } from 'lucide-react';
import { useWorkspace } from '@/contexts/workspace-context';
import { formatCurrency } from '@/lib/format';

export default function HomePage() {
  const t = useTranslations();
  const router = useRouter();
  const { workspace, currentClinic, workspaces, clinics, loading: contextLoading } = useWorkspace();
  const [initialized, setInitialized] = useState(false);
  const [metrics, setMetrics] = useState({
    patientsThisMonth: 0,
    treatmentsThisMonth: 0,
    revenueThisMonth: 0,
    pendingPayments: 0,
    averageTicket: 0,
    occupancyRate: 0
  });

  useEffect(() => {
    // Solo ejecutar una vez cuando el contexto termine de cargar
    if (!contextLoading && !initialized) {
      setInitialized(true);
      
      // Si no hay workspaces, redirigir a onboarding
      if (!workspace || workspaces.length === 0) {
        router.push('/onboarding');
        return;
      }
      
      // Si hay workspaces pero ninguno completado
      if (workspaces.every((w: any) => !w.onboarding_completed)) {
        router.push('/onboarding');
        return;
      }
    }
  }, [contextLoading, workspace, workspaces, router, initialized]);

  // Enlaces de operaciones diarias
  const quickActions = [
    {
      title: t('nav.patients'),
      description: t('home.patientsDescription'),
      href: '/patients',
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: t('nav.treatments'),
      description: t('home.treatmentsDescription'),
      href: '/treatments',
      icon: FileText,
      color: 'bg-green-500',
    },
    {
      title: t('nav.reports'),
      description: t('home.reportsDescription'),
      href: '/reports',
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
  ];

  if (contextLoading || !initialized) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('home.dashboard')}
        subtitle={workspace ? `${workspace.name} - ${currentClinic?.name || t('home.noClinic')}` : t('home.welcome')}
      />

      {/* Métricas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('home.metrics.patientsMonth')}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.patientsThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              {t('home.metrics.newPatients')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('home.metrics.treatmentsMonth')}
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.treatmentsThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              {t('home.metrics.completed')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('home.metrics.revenue')}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.revenueThisMonth * 100)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('home.metrics.thisMonth')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('home.metrics.occupancy')}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.occupancyRate}%</div>
            <p className="text-xs text-muted-foreground">
              {t('home.metrics.utilizationRate')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Acciones rápidas */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t('home.quickActions')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.href} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${action.color}`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{action.title}</CardTitle>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="mb-3 text-sm leading-relaxed">
                    {action.description}
                  </CardDescription>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={action.href}>
                      {t('home.openAction')}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Panel de actividad reciente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('home.recentActivity')}
          </CardTitle>
          <CardDescription>
            {t('home.lastTreatments')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {t('home.noRecentActivity')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}