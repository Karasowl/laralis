'use client'

import { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface AuthLayoutProps {
  children: ReactNode
  showLogo?: boolean
}

export function AuthLayout({ children, showLogo = true }: AuthLayoutProps) {
  const t = useTranslations('auth.layout')

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated mesh gradient background - Stripe style but medical colors */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />

        {/* Animated gradient mesh */}
        {/* CSS-based Animated Background - Optimized for performance */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
          {/* Animated Blobs */}
          <div
            className="absolute top-0 -left-4 w-96 h-96 bg-primary/40 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob dark:mix-blend-screen dark:opacity-20"
          />
          <div
            className="absolute top-0 -right-4 w-96 h-96 bg-primary/50 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob-bounce dark:mix-blend-screen dark:opacity-20"
            style={{ animationDelay: '2s' }}
          />
          <div
            className="absolute -bottom-32 left-20 w-96 h-96 bg-secondary/40 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob dark:mix-blend-screen dark:opacity-20"
            style={{ animationDelay: '4s' }}
          />
          <div
            className="absolute bottom-1/4 right-10 w-64 h-64 bg-accent/40 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 animate-blob-bounce dark:mix-blend-screen dark:opacity-20"
            style={{ animationDelay: '1s' }}
          />

          {/* Static Grid Pattern - Overlaying the blobs */}
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/40" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Noise texture overlay for depth */}
        <div
          className="absolute inset-0 opacity-[0.015] mix-blend-multiply dark:mix-blend-screen"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Main content - centered and clean */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo and branding - refined */}
          {showLogo && (
            <div className="text-center mb-10">
              {/* Refined logo with subtle animation */}
              <div className="inline-flex items-center justify-center mb-6">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                  <div className="relative bg-gradient-to-r from-primary to-secondary text-white rounded-2xl p-3.5 shadow-xl transform transition-transform group-hover:scale-105">
                    <svg
                      className="w-8 h-8"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2C10.9 2 10 2.9 10 4C10 5.11 10.9 6 12 6C13.11 6 14 5.11 14 4C14 2.9 13.11 2 12 2M12 7C9.24 7 7 9.24 7 12C7 14.05 7.77 15.92 9 17.3V20C9 21.11 9.9 22 11 22H13C14.11 22 15 21.11 15 20V17.3C16.23 15.92 17 14.05 17 12C17 9.24 14.76 7 12 7M11 14V18H10V19H14V18H13V14C13.55 14 14 13.55 14 13C14 12.45 13.55 12 13 12H11C10.45 12 10 12.45 10 13C10 13.55 10.45 14 11 14Z" />
                    </svg>
                  </div>
                </div>
              </div>

              <h1 className="text-4xl font-semibold text-foreground mb-2">
                Laralis
              </h1>

              <p className="text-muted-foreground text-sm font-medium">
                {t('mobileTagline')}
              </p>
            </div>
          )}

          {/* Form card - elevated with glassmorphism */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-3xl blur-xl" />
            <div className="relative bg-background/95 backdrop-blur-xl rounded-3xl shadow-xl border border-border/50 p-8">
              {children}
            </div>
          </div>

          {/* Theme and language controls - below form */}
          <div className="mt-6 flex justify-center">
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-xl rounded-full px-3 py-1.5 border border-border/50 shadow-lg">
              <LanguageSwitcher compact />
              <div className="w-px h-6 bg-border" />
              <ThemeToggle />
            </div>
          </div>

          {/* Footer - refined */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground font-medium">
              © {new Date().getFullYear()} Laralis. {t('allRightsReserved')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

