import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Calculator, Settings, Users, FileText, TrendingUp, Clock } from 'lucide-react';

export default function HomePage() {
  const t = useTranslations();

  const quickLinks = [
    {
      title: t('nav.time'),
      description: t('home.setupDescription'),
      href: '/setup/time',
      icon: Clock,
      color: 'bg-blue-500',
    },
    {
      title: t('nav.fixedCosts'),
      description: 'Configure your monthly fixed expenses',
      href: '/setup/fixed-costs',
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

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('home.title')}
        subtitle={t('home.subtitle')}
        actions={
          <Button asChild>
            <Link href="/setup/time">
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
                    Abrir
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
                <p className="text-sm text-muted-foreground">Configuración</p>
                <p className="text-2xl font-bold">Inicial</p>
              </div>
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estado Base de Datos</p>
                <p className="text-2xl font-bold">Lista</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Motor de Cálculo</p>
                <p className="text-2xl font-bold text-green-600">Activo</p>
              </div>
              <Calculator className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}