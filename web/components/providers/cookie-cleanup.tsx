'use client'

import { useEffect } from 'react'
import { cleanSupabaseCookies } from '@/lib/supabase/clean-cookies'

/**
 * Component that cleans malformed Supabase cookies and browser extension attributes
 * This helps prevent authentication issues and hydration warnings
 */
export function CookieCleanup() {
  useEffect(() => {
    // Clean cookies on mount
    cleanSupabaseCookies()
    
    // Clean up browser extension attributes
    const cleanupExtensionAttrs = () => {
      const body = document.body
      const html = document.documentElement
      
      // Remove Grammarly and other extension attributes
      const extensionAttrs = [
        'data-new-gr-c-s-check-loaded',
        'data-gr-ext-installed',
        'data-gr-ext-disabled',
        'data-gr-ext-css-loaded'
      ]
      
      extensionAttrs.forEach(attr => {
        body.removeAttribute(attr)
        html.removeAttribute(attr)
      })
    }
    
    // Clean extension attributes on mount
    cleanupExtensionAttrs()
    
    // Also clean on visibility change (when returning to the app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        cleanSupabaseCookies()
        cleanupExtensionAttrs()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Clean extension attributes periodically
    const interval = setInterval(cleanupExtensionAttrs, 5000)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
  }, [])
  
  return null
}