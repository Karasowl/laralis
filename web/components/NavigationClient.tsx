'use client';

import { useTranslations } from 'next-intl';
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
      <a 
        href="/" 
        className="text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          window.location.href = '/';
        }}
      >
        {t('nav.home')}
      </a>
      
      {/* Operaciones Diarias */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 text-foreground/60 hover:text-foreground transition-colors">
          <Users className="h-4 w-4" />
          {t('nav.operations')}
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{t('nav.dailyOperations')}</DropdownMenuLabel>
          <DropdownMenuItem 
            onClick={() => window.location.href = '/patients'}
            className="cursor-pointer"
          >
            {t('nav.patients')}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => window.location.href = '/treatments'}
            className="cursor-pointer"
          >
            {t('nav.treatments')}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => window.location.href = '/reports'}
            className="cursor-pointer"
          >
            {t('nav.reports')}
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
          <DropdownMenuItem 
            onClick={() => window.location.href = '/assets'}
            className="cursor-pointer"
          >
            {t('nav.assets')}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => window.location.href = '/fixed-costs'}
            className="cursor-pointer"
          >
            {t('nav.fixedCosts')}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => window.location.href = '/time'}
            className="cursor-pointer"
          >
            {t('nav.time')}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => window.location.href = '/equilibrium'}
            className="cursor-pointer"
          >
            {t('nav.equilibrium')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('nav.variableCosts')}</DropdownMenuLabel>
          <DropdownMenuItem 
            onClick={() => window.location.href = '/supplies'}
            className="cursor-pointer"
          >
            {t('nav.supplies')}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => window.location.href = '/services'}
            className="cursor-pointer"
          >
            {t('nav.services')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('nav.pricing')}</DropdownMenuLabel>
          <DropdownMenuItem 
            onClick={() => window.location.href = '/tariffs'}
            className="cursor-pointer"
          >
            {t('nav.tariffs')}
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
          <DropdownMenuItem 
            onClick={() => window.location.href = '/settings/workspaces'}
            className="cursor-pointer"
          >
            {t('nav.workspaces')}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => window.location.href = '/settings/clinics'}
            className="cursor-pointer"
          >
            {t('nav.clinics')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => window.location.href = '/settings/reset'}
            className="cursor-pointer"
          >
            {t('nav.resetData')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}