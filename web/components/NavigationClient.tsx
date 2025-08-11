'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Settings, Users, Calculator, FileText } from 'lucide-react';

export function NavigationClient() {
  const t = useTranslations();
  
  return (
    <nav className="hidden md:flex items-center space-x-6 text-sm">
      <Link href="/" className="text-foreground/60 hover:text-foreground transition-colors">
        {t('nav.home')}
      </Link>
      
      {/* Operaciones Diarias */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 text-foreground/60 hover:text-foreground transition-colors">
          <Users className="h-4 w-4" />
          {t('nav.operations')}
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{t('nav.dailyOperations')}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/patients">
              {t('nav.patients')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/treatments">
              {t('nav.treatments')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/reports">
              {t('nav.reports')}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Configuración del Negocio */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 text-foreground/60 hover:text-foreground transition-colors">
          <Calculator className="h-4 w-4" />
          {t('nav.businessSetup')}
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{t('nav.initialConfig')}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/assets">
              {t('nav.assets')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/fixed-costs">
              {t('nav.fixedCosts')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/time">
              {t('nav.time')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/equilibrium">
              {t('nav.equilibrium')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('nav.variableCosts')}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/supplies">
              {t('nav.supplies')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/services">
              {t('nav.services')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('nav.pricing')}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/tariffs">
              {t('nav.tariffs')}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Configuración */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 text-foreground/60 hover:text-foreground transition-colors">
          <Settings className="h-4 w-4" />
          {t('nav.settings')}
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href="/settings/workspaces">
              {t('nav.workspaces')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/clinics">
              {t('nav.clinics')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings/reset">
              {t('nav.resetData')}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}