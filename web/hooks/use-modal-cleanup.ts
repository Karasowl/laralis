'use client'

import { useEffect, useRef } from 'react'

/**
 * Hook to ensure proper cleanup of modal-related styles on the body
 * Prevents scroll lock issues on mobile devices after modal closes
 */
export function useModalCleanup(isOpen: boolean) {
  const wasOpen = useRef<boolean>(isOpen)

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
      // Do NOT force-remove Radix/react-remove-scroll attributes while a dialog may be open
      document.body.style.webkitOverflowScrolling = 'touch'
    }

    // Run cleanup only on transition: open -> closed
    if (wasOpen.current && !isOpen) {
      requestAnimationFrame(() => {
        setTimeout(cleanupBodyStyles, 200)
      })
    }
    wasOpen.current = isOpen

    // Cleanup on unmount: if modal was open, finish cleanup after animations
    return () => {
      if (!wasOpen.current) return
      setTimeout(cleanupBodyStyles, 200)
    }
  }, [isOpen])
}
