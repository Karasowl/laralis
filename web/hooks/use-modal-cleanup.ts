'use client'

import { useEffect } from 'react'

/**
 * Hook to ensure proper cleanup of modal-related styles on the body
 * Prevents scroll lock issues on mobile devices after modal closes
 */
export function useModalCleanup(isOpen: boolean) {
  useEffect(() => {
    // Cleanup function to remove any stuck styles
    const cleanupBodyStyles = () => {
      if (typeof document === 'undefined') return
      
      // Remove common modal-related styles that might block scroll
      document.body.style.removeProperty('overflow')
      document.body.style.removeProperty('pointer-events')
      document.body.style.removeProperty('position')
      document.body.style.removeProperty('touch-action')
      document.documentElement.style.removeProperty('overflow')
      
      // Remove any Radix UI specific data attributes that might affect scroll
      document.body.removeAttribute('data-scroll-locked')
      document.documentElement.removeAttribute('data-scroll-locked')
      
      // Ensure scroll is re-enabled on iOS
      document.body.style.webkitOverflowScrolling = 'touch'
    }

    // When modal closes, ensure cleanup after a short delay
    if (!isOpen) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        // Additional delay to ensure Radix animations complete
        setTimeout(cleanupBodyStyles, 200)
      })
    }

    // Cleanup on unmount
    return () => {
      if (!isOpen) {
        cleanupBodyStyles()
      }
    }
  }, [isOpen])
  
  // Also cleanup on component unmount regardless of state
  useEffect(() => {
    return () => {
      if (typeof document === 'undefined') return
      
      // Final cleanup on unmount
      setTimeout(() => {
        document.body.style.removeProperty('overflow')
        document.body.style.removeProperty('pointer-events')
        document.documentElement.style.removeProperty('overflow')
      }, 100)
    }
  }, [])
}