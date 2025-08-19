'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NavigationClient } from '@/components/NavigationClient';
import { BusinessSwitcher } from '@/components/BusinessSwitcher';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/contexts/workspace-context';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Settings } from 'lucide-react';

export default function HeaderChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const { user, workspaces, signOut } = useWorkspace();
  const tAuth = useTranslations('auth');

  const handleSignOut = async () => {
    await signOut();
  };

  const isOnboarding = pathname?.startsWith('/onboarding');
  const hasWorkspaces = workspaces && workspaces.length > 0;

  // Minimal header when onboarding o sin workspaces
  if (isOnboarding || !hasWorkspaces) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-7xl flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6">
          <Link 
            href="/" 
            className="flex items-center space-x-2"
          >
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs sm:text-sm">D</span>
            </div>
            <span className="font-semibold text-base sm:text-lg hidden sm:block">{t('common.appName')}</span>
            <span className="font-semibold text-base sm:hidden">Dental</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {!isOnboarding && !user && (
              <Button asChild className="hidden sm:inline-flex text-sm">
                <Link href="/onboarding">{t('home.getStarted')}</Link>
              </Button>
            )}
            <ThemeToggle />
            <LanguageSwitcher />
            
            {/* User Menu - SIEMPRE mostrar si hay usuario */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full touch-target">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-3 w-3 sm:h-4 sm:w-4 text-primary-foreground" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium text-sm">
                        {user.user_metadata?.full_name || 
                         `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 
                         'Usuario'}
                      </p>
                      <p className="w-[200px] truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{tAuth('logout.button') || 'Cerrar Sesión'}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>
    );
  }

  // Full header cuando sí hay workspaces
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link 
            href="/" 
            className="flex items-center space-x-2"
          >
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs sm:text-sm">D</span>
            </div>
            <span className="font-semibold text-base sm:text-lg hidden sm:block">{t('common.appName')}</span>
            <span className="font-semibold text-base sm:hidden">Dental</span>
          </Link>
          <NavigationClient />
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <BusinessSwitcher />
          <ThemeToggle />
          <LanguageSwitcher />
          
          {/* User Menu */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full touch-target">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="h-3 w-3 sm:h-4 sm:w-4 text-primary-foreground" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium text-sm">
                      {user.user_metadata?.full_name || 
                       `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 
                       'Usuario'}
                    </p>
                    <p className="w-[200px] truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => router.push('/profile')}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Mi Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{tAuth('logout.button')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}


