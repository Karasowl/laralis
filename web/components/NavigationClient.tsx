'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Users, Calculator, FileText } from 'lucide-react';

export function NavigationClient() {
  const t = useTranslations();
  const router = useRouter();
  
  return (
    <nav className="hidden md:flex items-center space-x-6 text-sm">
      <Link 
        href="/" 
        className="text-foreground/60 hover:text-foreground transition-colors"
      >
        {t('nav.home')}
      </Link>

      <Link
        href="/expenses"
        className="text-foreground/60 hover:text-foreground transition-colors"
      >
        {t('nav.expenses')}
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
            <Link href="/patients" className="cursor-pointer">
              {t('nav.patients')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/treatments" className="cursor-pointer">
              {t('nav.treatments')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/expenses" className="cursor-pointer">
              {t('nav.expenses')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/reports" className="cursor-pointer">
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
            <Link href="/assets" className="cursor-pointer">
              {t('nav.assets')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/fixed-costs" className="cursor-pointer">
              {t('nav.fixedCosts')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/time" className="cursor-pointer">
              {t('nav.time')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/equilibrium" className="cursor-pointer">
              {t('nav.equilibrium')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('nav.variableCosts')}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/supplies" className="cursor-pointer">
              {t('nav.supplies')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/services" className="cursor-pointer">
              {t('nav.services')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('nav.pricing')}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/tariffs" className="cursor-pointer">
              {t('nav.tariffs')}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
    </nav>
  );
}
