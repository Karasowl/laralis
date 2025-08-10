'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NavigationClient } from '@/components/NavigationClient';
import { BusinessSwitcher } from '@/components/BusinessSwitcher';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/contexts/workspace-context';

export default function HeaderChrome() {
  const pathname = usePathname();
  const t = useTranslations();
  const { workspaces } = useWorkspace();

  const isOnboarding = pathname?.startsWith('/onboarding');
  const hasWorkspaces = workspaces && workspaces.length > 0;

  // Minimal header when onboarding o sin workspaces
  if (isOnboarding || !hasWorkspaces) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-7xl flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">D</span>
            </div>
            <span className="font-semibold text-lg">{t('common.appName')}</span>
          </Link>
          <div className="flex items-center gap-3">
            {!isOnboarding && (
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/onboarding">{t('home.getStarted')}</Link>
              </Button>
            )}
            <LanguageSwitcher />
          </div>
        </div>
      </header>
    );
  }

  // Full header cuando sí hay workspaces
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">D</span>
            </div>
            <span className="font-semibold text-lg">{t('common.appName')}</span>
          </Link>
          <NavigationClient />
        </div>
        <div className="flex items-center gap-4">
          <BusinessSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}


