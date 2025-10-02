"use client";

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard,
  Users,
  ChartBar,
  Package,
  MoreHorizontal,
  Activity,
  Receipt,
  Settings,
  User,
  LogOut,
  Building2,
  Wrench,
  Calculator,
  Briefcase,
  FileText
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface MobileBottomNavProps {
  user?: any;
  workspace?: any;
  onSignOut: () => void;
}

export function MobileBottomNav({ user, workspace, onSignOut }: MobileBottomNavProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();

  // Main bottom nav items (4 + more menu)
  const bottomNavItems: NavItem[] = [
    { label: t('nav.dashboard'), href: '/', icon: LayoutDashboard },
    { label: t('nav.patients'), href: '/patients', icon: Users },
    { label: t('nav.treatments'), href: '/treatments', icon: Activity },
    { label: t('nav.reports'), href: '/reports', icon: ChartBar },
  ];

  // Items in the "More" menu
  const moreMenuItems = {
    operations: [
      { label: t('nav.expenses'), href: '/expenses', icon: Receipt },
      { label: t('nav.equilibrium'), href: '/equilibrium', icon: ChartBar },
    ],
    inventory: [
      { label: t('nav.supplies'), href: '/supplies', icon: Package },
      { label: t('nav.services'), href: '/services', icon: Briefcase },
      { label: t('nav.assets'), href: '/assets', icon: Wrench },
      { label: t('nav.fixedCosts'), href: '/fixed-costs', icon: Calculator },
    ],
    settings: [
      { label: t('nav.settings'), href: '/settings', icon: Settings },
    ]
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href) || false;
  };

  // Check if any item in "More" menu is active
  const isMoreActive = () => {
    const allMoreItems = [
      ...moreMenuItems.operations,
      ...moreMenuItems.inventory,
      ...moreMenuItems.settings
    ];
    return allMoreItems.some(item => isActive(item.href));
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border">
      <div className="grid grid-cols-5 h-16">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 relative transition-all duration-200",
                "hover:bg-accent/50",
                active && "text-primary"
              )}
            >
              {/* Active indicator */}
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-b-full" />
              )}
              
              <Icon className={cn(
                "h-5 w-5 transition-all duration-200",
                active ? "text-primary scale-110" : "text-muted-foreground"
              )} />
              
              <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                active ? "text-primary" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "h-full rounded-none flex flex-col items-center justify-center gap-1 relative",
                "hover:bg-accent/50",
                isMoreActive() && "text-primary"
              )}
            >
              {isMoreActive() && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-b-full" />
              )}
              
              <MoreHorizontal className={cn(
                "h-5 w-5 transition-all duration-200",
                isMoreActive() ? "text-primary scale-110" : "text-muted-foreground"
              )} />
              
              <span className={cn(
                "text-[10px] font-medium",
                isMoreActive() ? "text-primary" : "text-muted-foreground"
              )}>
                {t('common.more')}
              </span>
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent 
            className="w-64 mb-2 mr-2"
            align="end"
            side="top"
          >
            {/* User Profile Section */}
            {user && (
              <>
                <DropdownMenuLabel className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-semibold truncate">
                        {user.user_metadata?.full_name || t('profile.defaultUser')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Finance Section */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                {t('nav.sections.finance')}
              </DropdownMenuLabel>
              {moreMenuItems.operations.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <DropdownMenuItem
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className={cn(
                      "cursor-pointer",
                      active && "bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Inventory Section */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                {t('nav.sections.inventory')}
              </DropdownMenuLabel>
              {moreMenuItems.inventory.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <DropdownMenuItem
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className={cn(
                      "cursor-pointer",
                      active && "bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Settings Section */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                {t('nav.sections.configuration')}
              </DropdownMenuLabel>
              {moreMenuItems.settings.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <DropdownMenuItem
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className={cn(
                      "cursor-pointer",
                      active && "bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                );
              })}
              
              <DropdownMenuItem 
                onClick={() => router.push('/profile')}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                <span>{t('nav.profile')}</span>
              </DropdownMenuItem>
              
              {workspace && (
                <DropdownMenuItem 
                  onClick={() => router.push('/settings/workspaces')}
                  className="cursor-pointer"
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  <span>{t('nav.workspaces')}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Logout */}
            <DropdownMenuItem 
              onClick={onSignOut}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t('auth.signOut')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}