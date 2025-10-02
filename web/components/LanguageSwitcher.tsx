'use client';

import { useLocale } from 'next-intl';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const locales = [
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'es', name: 'Español', short: 'ES' },
];

interface LanguageSwitcherProps {
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const locale = useLocale();

  const handleLocaleChange = async (newLocale: string) => {
    if (newLocale === locale) return

    try {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('preferred-locale', newLocale)
        } catch {}
        document.cookie = `locale=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`
      }

      const supabase = createClient()
      await supabase.auth.updateUser({ data: { preferred_language: newLocale } })
    } catch (error) {
      console.error('[LanguageSwitcher] Failed to persist preferred language', error)
    } finally {
      window.location.reload()
    }
  };

  const currentLocale = locales.find(l => l.code === locale) || locales[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost"
          size={compact ? "sm" : "default"}
          className="gap-2"
          title={currentLocale.name}
          aria-label={`Language: ${currentLocale.name}`}
        >
          <Globe className="h-4 w-4" />
          <span className="font-medium">{currentLocale.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[150px]">
        {locales.map((loc) => (
          <DropdownMenuItem 
            key={loc.code} 
            onClick={() => handleLocaleChange(loc.code)}
            className={locale === loc.code ? 'bg-accent' : ''}
          >
            <span className="font-medium">{loc.short}</span>
            <span className="ml-2 text-muted-foreground">{loc.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}