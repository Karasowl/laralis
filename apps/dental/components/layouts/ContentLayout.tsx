'use client'

import { ReactNode } from 'react'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface ContentLayoutProps {
  children: ReactNode
}

export function ContentLayout({ children }: ContentLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
      {/* Animated mesh gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900" />

        {/* Animated gradient mesh */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="grid-content"
              width="60"
              height="60"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 60 0 L 0 0 0 60"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-gray-200 dark:text-gray-800"
              />
            </pattern>

            <linearGradient id="grad1-content" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2">
                <animate attributeName="stop-color" values="#06b6d4;#0ea5e9;#3b82f6;#06b6d4" dur="8s" repeatCount="indefinite" />
              </stop>
              <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.1">
                <animate attributeName="stop-color" values="#0ea5e9;#3b82f6;#06b6d4;#0ea5e9" dur="8s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2">
                <animate attributeName="stop-color" values="#3b82f6;#06b6d4;#0ea5e9;#3b82f6" dur="8s" repeatCount="indefinite" />
              </stop>
            </linearGradient>

            <linearGradient id="grad2-content" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.2">
                <animate attributeName="stop-color" values="#14b8a6;#10b981;#06b6d4;#14b8a6" dur="10s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.1">
                <animate attributeName="stop-color" values="#10b981;#06b6d4;#14b8a6;#10b981" dur="10s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
          </defs>

          {/* Grid pattern */}
          <rect width="100%" height="100%" fill="url(#grid-content)" />

          {/* Animated blobs */}
          <circle r="400" cx="20%" cy="30%" fill="url(#grad1-content)">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 100,50; 0,100; -100,50; 0,0"
              dur="20s"
              repeatCount="indefinite"
            />
          </circle>

          <circle r="350" cx="80%" cy="70%" fill="url(#grad2-content)">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; -100,50; 0,100; 100,50; 0,0"
              dur="25s"
              repeatCount="indefinite"
            />
          </circle>

          <ellipse rx="400" ry="200" cx="50%" cy="50%" fill="url(#grad1-content)" opacity="0.1">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 50 50"
              to="360 50 50"
              dur="30s"
              repeatCount="indefinite"
            />
          </ellipse>
        </svg>

        {/* Noise texture overlay for depth */}
        <div
          className="absolute inset-0 opacity-[0.015] mix-blend-multiply dark:mix-blend-screen"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Main content - wider for content pages */}
      <div className="relative z-10 min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          {children}
        </div>
      </div>

      {/* Theme and language controls - fixed top right */}
      <div className="fixed top-4 right-4 z-20">
        <div className="flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-full px-3 py-1.5 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
          <LanguageSwitcher compact />
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          <ThemeToggle />
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 pb-6">
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            © {new Date().getFullYear()} Laralis. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
