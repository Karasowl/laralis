"use client";
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Calculator, Settings, Users, FileText, TrendingUp, Clock, Building2, Building } from 'lucide-react';
import { useWorkspace } from '@/contexts/workspace-context';

export default function HomePage() {
  const t = useTranslations();
  const router = useRouter();
  const { workspace, currentClinic, workspaces, clinics, loading: contextLoading } = useWorkspace();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Si no hay workspaces "completados" o ninguno en absoluto, redirigir a onboarding
    if (
      !contextLoading &&
      !redirecting &&
      (workspaces.length === 0 || workspaces.every((w: any) => !w.onboarding_completed))
    ) {
      setRedirecting(true);
      router.push('/onboarding');
    }
  }, [contextLoading, workspaces, router, redirecting]);

  const quickLinks = [
    {
      title: t('nav.time'),
      description: t('home.setupDescription'),
      href: '/time',
      icon: Clock,
      color: 'bg-blue-500',
    },
    {
      title: t('nav.fixedCosts'),
      description: t('home.setupDescription'),
      href: '/fixed-costs',
      icon: Settings,
      color: 'bg-green-500',
    },
    {
      title: t('nav.patients'),
      description: t('home.patientsDescription'),
      href: '/patients',
      icon: Users,
      color: 'bg-purple-500',
    },
    {
      title: t('nav.treatments'),
      description: t('home.treatmentsDescription'),
      href: '/treatments',
      icon: Calculator,
      color: 'bg-orange-500',
    },
    {
      title: t('nav.reports'),
      description: t('home.reportsDescription'),
      href: '/reports',
      icon: TrendingUp,
      color: 'bg-indigo-500',
    },
  ];

  if (contextLoading || redirecting) {
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
        title={t('home.title')}
        subtitle={t('home.subtitle')}
        actions={
          <Button asChild>
            <Link href="/onboarding">
              {t('home.getStarted')}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Card key={link.href} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${link.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{link.title}</CardTitle>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="mb-4 leading-relaxed">
                  {link.description}
                </CardDescription>
                <Button variant="outline" asChild>
                  <Link href={link.href}>
                    {t('home.openAction')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('home.workspaceActive')}</p>
                <p className="text-lg font-bold truncate">
                  {workspace ? workspace.name : t('home.noWorkspace')}
                </p>
                {workspace && (
                  <Link href="/settings/workspaces" className="text-xs text-blue-600 hover:underline">
                    {t('common.switchClinic')}
                  </Link>
                )}
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('home.clinicActive')}</p>
                <p className="text-lg font-bold truncate">
                  {currentClinic ? currentClinic.name : t('home.noClinic')}
                </p>
                {currentClinic && (
                  <Link href="/settings/clinics" className="text-xs text-blue-600 hover:underline">
                    {t('common.switchClinic')}
                  </Link>
                )}
              </div>
              <Building className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('home.calculationEngine')}</p>
                <p className="text-2xl font-bold text-green-600">{t('home.calculationActive')}</p>
              </div>
              <Calculator className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}