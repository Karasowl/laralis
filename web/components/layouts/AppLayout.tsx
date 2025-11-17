'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/contexts/workspace-context'
import { useTheme } from '@/components/providers/theme-provider'
import { Sidebar } from './Sidebar'
import { MobileHeader } from './MobileHeader'
import { UserMenu } from './UserMenu'
import { getNavigationSections } from './NavigationConfig'
import { Button } from '@/components/ui/button'
import { ContextIndicator } from './ContextIndicator'
import { Sun, Moon, Activity } from 'lucide-react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { OnboardingListeners } from '@/components/onboarding/OnboardingListeners'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const t = useT()
  const tProfile = useTranslations('profile')
  const pathname = usePathname()
  const router = useRouter()
  const { workspace, currentClinic, user, signOut } = useWorkspace()
  const onboardingCompleted = Boolean(workspace?.onboarding_completed)
  const { theme, setTheme } = useTheme()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Wait for client-side mount
  useEffect(() => {
    setMounted(true)
    // Load saved sidebar state
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') {
      setSidebarCollapsed(true)
    }
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname])

  const handleCollapse = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    localStorage.setItem('sidebar-collapsed', String(newState))
  }

  const handleSignOut = async () => {
    await signOut()
  }

  // Get navigation sections with translations
  const navigationSections = getNavigationSections(t, { onboardingCompleted })

  // Map user data for UserMenu component
  const userData = user ? {
    name: user.user_metadata?.full_name ||
          `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() ||
          tProfile('defaultUser'),
    email: user.email || '',
    avatar: user.user_metadata?.avatar_url
  } : undefined

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Mobile Header */}
      <MobileHeader
        isOpen={mobileSidebarOpen}
        onToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        logo={
          <Link
            href={onboardingCompleted ? '/' : '/setup'}
            className="flex items-center gap-3 no-underline"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-violet-500 flex items-center justify-center shadow-lg">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base text-foreground">Laralis</h1>
              <div className="mt-0.5">
                <ContextIndicator className="truncate max-w-[180px]" interactive={false} />
              </div>
            </div>
          </Link>
        }
      />

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex fixed left-0 top-0 h-full bg-card/50 backdrop-blur-xl border-r border-border shadow-xl transition-all duration-300 z-30",
        sidebarCollapsed ? "w-20" : "w-64"
      )}>
        <Sidebar
          sections={navigationSections}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleCollapse}
          className="w-full"
        />
      </aside>

      {/* Mobile Sidebar */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-40 transform transition-transform duration-300",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="w-64 h-full bg-card border-r flex flex-col">
          <div className="flex-1 overflow-hidden">
            <Sidebar
              sections={navigationSections}
              isCollapsed={false}
              onToggleCollapse={() => setMobileSidebarOpen(false)}
              className="h-full"
            />
          </div>
          
        </div>
      </div>

      {/* Main Content Area */}
      <div className={cn(
        "transition-all duration-300",
        "pt-16 lg:pt-0",
        sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      )}>
        {/* Desktop Header Bar */}
        <header className="hidden lg:flex h-16 bg-card/50 backdrop-blur-xl border-b items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <ContextIndicator />
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={t('toggle_theme')}
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            <LanguageSwitcher />
            
            <UserMenu user={userData} />
          </div>
        </header>

      {/* Page Content */}
      <main className="min-h-[calc(100vh-4rem)] overflow-x-hidden">
        {children}
      </main>
    </div>

      {/* Global onboarding listeners to react to autofix events */}
      <OnboardingListeners />
    </div>
  )
}
