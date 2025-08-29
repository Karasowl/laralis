"use client";

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft,
  ChevronRight,
  Home,
  Users,
  FileText,
  Package,
  ShoppingCart,
  Settings,
  TrendingUp,
  DollarSign,
  Wrench,
  Receipt,
  Calculator,
  LogOut,
  Menu,
  X,
  Activity,
  ChartBar,
  Briefcase,
  Building
} from 'lucide-react';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { workspace, currentClinic } = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarItems: SidebarItem[] = [
    { label: t('nav.dashboard'), href: '/', icon: Home },
    { label: t('nav.patients'), href: '/patients', icon: Users },
    { label: t('nav.treatments'), href: '/treatments', icon: FileText },
    { label: t('nav.supplies'), href: '/supplies', icon: Package },
    { label: t('nav.services'), href: '/services', icon: ShoppingCart },
    { label: t('nav.expenses'), href: '/expenses', icon: Receipt },
    { label: t('nav.fixedCosts'), href: '/fixed-costs', icon: DollarSign },
    { label: t('nav.assets'), href: '/assets', icon: Wrench },
    { label: t('nav.tariffs'), href: '/tariffs', icon: Calculator },
    { label: t('nav.reports'), href: '/reports', icon: TrendingUp },
    { label: t('nav.equilibrium'), href: '/equilibrium', icon: ChartBar },
  ];

  const bottomItems: SidebarItem[] = [
    { label: t('nav.settings'), href: '/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="bg-white dark:bg-gray-800 shadow-lg"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full bg-white dark:bg-gray-800 shadow-xl transition-all duration-300 z-40",
        sidebarOpen ? "w-64" : "w-20",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo and Clinic Info */}
          <div className="p-6 border-b dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className={cn(
                "flex items-center gap-3 transition-opacity",
                !sidebarOpen && "lg:opacity-0"
              )}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-white" />
                </div>
                <div className="overflow-hidden">
                  <h1 className="font-bold text-lg truncate">Laralis</h1>
                  {currentClinic && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {currentClinic.name}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Desktop Collapse Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden lg:flex"
              >
                {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                    "hover:bg-gray-100 dark:hover:bg-gray-700",
                    active && "bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-600 dark:text-blue-400",
                    !active && "text-gray-600 dark:text-gray-300",
                    !sidebarOpen && "lg:justify-center"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5 flex-shrink-0",
                    active && "text-blue-600 dark:text-blue-400"
                  )} />
                  {(sidebarOpen || !sidebarOpen) && (
                    <span className={cn(
                      "font-medium transition-opacity",
                      !sidebarOpen && "lg:hidden"
                    )}>
                      {item.label}
                    </span>
                  )}
                  {item.badge && sidebarOpen && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom Section */}
          <div className="p-4 border-t dark:border-gray-700 space-y-1">
            {bottomItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                    "hover:bg-gray-100 dark:hover:bg-gray-700",
                    active && "bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-600 dark:text-blue-400",
                    !active && "text-gray-600 dark:text-gray-300",
                    !sidebarOpen && "lg:justify-center"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {(sidebarOpen || !sidebarOpen) && (
                    <span className={cn(
                      "font-medium transition-opacity",
                      !sidebarOpen && "lg:hidden"
                    )}>
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Logout Button */}
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 px-3 py-2.5 text-red-600 dark:text-red-400",
                "hover:bg-red-50 dark:hover:bg-red-900/20",
                !sidebarOpen && "lg:justify-center"
              )}
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {(sidebarOpen || !sidebarOpen) && (
                <span className={cn(
                  "font-medium transition-opacity",
                  !sidebarOpen && "lg:hidden"
                )}>
                  {t('nav.logout')}
                </span>
              )}
            </Button>
          </div>

          {/* User Info */}
          {workspace && sidebarOpen && (
            <div className="p-4 border-t dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-green-500 to-emerald-600 flex items-center justify-center">
                  <Building className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{workspace.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('nav.workspace')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarOpen ? "lg:ml-64" : "lg:ml-20"
      )}>
        <main className="p-4 lg:p-8 max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}