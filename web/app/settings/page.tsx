import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Building,
  Building2,
  Clock, 
  Calculator, 
  DollarSign,
  Package,
  Wrench,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  Download,
  Upload,
  Megaphone
} from 'lucide-react';
import { DeleteAccountSection } from './SettingsClient';
import { createSupabaseClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';

async function getSettingsData() {
  const supabase = createSupabaseClient();
  
  try {
    // Get time settings
    const { data: timeSettings } = await supabase
      .from('settings_time')
      .select('*')
      .single();

    // Get assets summary
    const { data: assets } = await supabase
      .from('assets')
      .select('investment_cents, years');
    
    const assetsSummary = assets?.length ? {
      total_investment_cents: assets.reduce((sum, a) => sum + (a.investment_cents || 0), 0),
      monthly_depreciation_cents: assets.reduce((sum, a) => {
        const months = (a.years || 5) * 12;
        return sum + Math.round((a.investment_cents || 0) / months);
      }, 0),
      total_assets: assets.length
    } : null;

    // Get fixed costs summary
    const { data: fixedCosts } = await supabase
      .from('fixed_costs')
      .select('amount_cents');
    
    const fixedCostsSummary = fixedCosts?.length ? {
      total_monthly_cents: fixedCosts.reduce((sum, fc) => sum + (fc.amount_cents || 0), 0),
      total_costs: fixedCosts.length
    } : null;

    return { timeSettings, assetsSummary, fixedCostsSummary };
  } catch (error) {
    console.error('Error loading settings data:', error);
    return { timeSettings: null, assetsSummary: null, fixedCostsSummary: null };
  }
}

export default async function SettingsPage() {
  const t = await getTranslations();
  const { timeSettings, assetsSummary, fixedCostsSummary } = await getSettingsData();

  // Cálculos derivados
  const monthlyMinutes = (timeSettings?.work_days || 20) * (timeSettings?.hours_per_day || 8) * 60;
  const effectiveMinutes = Math.round(monthlyMinutes * (timeSettings?.real_pct || 0.85));
  const totalFixedCosts = (fixedCostsSummary?.total_monthly_cents || 0) + (assetsSummary?.monthly_depreciation_cents || 0);
  const fixedPerMinute = effectiveMinutes > 0 ? totalFixedCosts / effectiveMinutes : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />

      {/* Grid de opciones de configuración */}
      <div className="grid gap-6">
        {/* Sección: Organización */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('settings.organization')}</h2>
          <div className="grid gap-3">
            <Link href="/settings/workspaces" className="block" prefetch={true}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Building className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{t('settings.workspaces')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.workspacesDesc')}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/settings/clinics" className="block" prefetch={true}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">{t('settings.clinics')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.clinicsDesc')}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Sección: Configuración del Negocio */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('settings.businessSetup')}</h2>
          <div className="grid gap-3">
            <Link href="/assets" className="block" prefetch={true}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                      <Package className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{t('nav.assets')}</p>
                      <p className="text-sm text-muted-foreground">
                        {assetsSummary ? 
                          `${formatCurrency(assetsSummary.total_investment_cents)} - ${assetsSummary.total_assets} ${t('assets.items')}` :
                          t('settings.assetsDesc')
                        }
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/fixed-costs" className="block" prefetch={true}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium">{t('nav.fixedCosts')}</p>
                      <p className="text-sm text-muted-foreground">
                        {fixedCostsSummary ? 
                          `${formatCurrency(fixedCostsSummary.total_monthly_cents)}/mes - ${fixedCostsSummary.total_costs} ${t('fixedCosts.items')}` :
                          t('settings.fixedCostsDesc')
                        }
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/time" className="block" prefetch={true}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-cyan-50 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-cyan-600" />
                    </div>
                    <div>
                      <p className="font-medium">{t('nav.time')}</p>
                      <p className="text-sm text-muted-foreground">
                        {timeSettings ? 
                          `${timeSettings.work_days} ${t('time.days')}, ${timeSettings.hours_per_day}h/${t('time.day')} - ${formatCurrency(Math.round(fixedPerMinute))}/${t('time.minute')}` :
                          t('settings.timeDesc')
                        }
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/equilibrium" className="block" prefetch={true}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium">{t('nav.equilibrium')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.equilibriumDesc')}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Sección: Costos Variables */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('settings.variableCosts')}</h2>
          <div className="grid gap-3">
            <Link href="/supplies" className="block" prefetch={true}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center">
                      <Package className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium">{t('nav.supplies')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.suppliesDesc')}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/services" className="block" prefetch={true}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-pink-50 flex items-center justify-center">
                      <Wrench className="h-5 w-5 text-pink-600" />
                    </div>
                    <div>
                      <p className="font-medium">{t('nav.services')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.servicesDesc')}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/tariffs" className="block" prefetch={true}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Calculator className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">{t('nav.tariffs')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.tariffsDesc')}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/settings/marketing" className="block" prefetch={true}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-fuchsia-50 flex items-center justify-center">
                      <Megaphone className="h-5 w-5 text-fuchsia-600" />
                    </div>
                    <div>
                      <p className="font-medium">{t('settings.marketing.title')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.marketing.subtitle')}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Sección: Datos y Respaldo */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('settings.dataBackup')}</h2>
          <div className="grid gap-3">
            <Card className="hover:shadow-md transition-shadow cursor-pointer opacity-50">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center">
                    <Download className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-medium">{t('settings.exportData')}</p>
                    <p className="text-sm text-muted-foreground">{t('settings.exportDesc')}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer opacity-50">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center">
                    <Upload className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-medium">{t('settings.importData')}</p>
                    <p className="text-sm text-muted-foreground">{t('settings.importDesc')}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Link href="/settings/reset" className="block" prefetch={true}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                      <RefreshCw className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">{t('settings.resetData')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.resetDesc')}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Sección: Cuenta y Seguridad */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('settings.accountSecurity')}</h2>
          <div className="grid gap-3">
            <DeleteAccountSection />
          </div>
        </div>
      </div>
    </div>
  );
}