'use client'

import { useEffect } from 'react'
import { cleanSupabaseCookies } from '@/lib/supabase/clean-cookies'

/**
 * PERFORMANCE: Component that cleans malformed Supabase cookies only
 * Browser extension cleanup is handled by BrowserExtensionsCleanup component
 * This helps prevent authentication issues
 */
export function CookieCleanup() {
  useEffect(() => {
    // Clean cookies on mount
    cleanSupabaseCookies()

    // PERFORMANCE: Only clean on visibility change (when returning to the app)
    // No need for periodic cleanup - cookies don't change that often
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        cleanSupabaseCookies()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, []) // Empty deps - only run once on mount

  return null
}