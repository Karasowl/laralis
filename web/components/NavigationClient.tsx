'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

export function NavigationClient() {
  const t = useTranslations();
  
  return (
    <nav className="hidden md:flex items-center space-x-6 text-sm">
      <Link href="/" className="text-foreground/60 hover:text-foreground transition-colors">
        {t('nav.home')}
      </Link>
      <Link href="/time" className="text-foreground/60 hover:text-foreground transition-colors">
        {t('nav.time')}
      </Link>
      <Link href="/fixed-costs" className="text-foreground/60 hover:text-foreground transition-colors">
        {t('nav.fixedCosts')}
      </Link>
      <Link href="/supplies" className="text-foreground/60 hover:text-foreground transition-colors">
        {t('nav.supplies')}
      </Link>
      <Link href="/services" className="text-foreground/60 hover:text-foreground transition-colors">
        {t('nav.services')}
      </Link>
      <Link href="/tariffs" className="text-foreground/60 hover:text-foreground transition-colors">
        {t('nav.tariffs')}
      </Link>
      <Link href="/assets" className="text-foreground/60 hover:text-foreground transition-colors">
        {t('nav.assets')}
      </Link>
      
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 text-foreground/60 hover:text-foreground transition-colors">
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
              {t('nav.settings')}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}