'use client'

import TawkMessengerReact from '@tawk.to/tawk-messenger-react'

/**
 * Tawk.to Chat Widget
 *
 * To configure:
 * 1. Create account at https://tawk.to
 * 2. Get your Property ID and Widget ID from Dashboard > Settings > Chat Widget
 * 3. Add to .env.local:
 *    NEXT_PUBLIC_TAWK_PROPERTY_ID=your_property_id
 *    NEXT_PUBLIC_TAWK_WIDGET_ID=your_widget_id
 */
export function TawkChat() {
  const propertyId = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID
  const widgetId = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID

  // Don't render if not configured
  if (!propertyId || !widgetId) {
    return null
  }

  return (
    <TawkMessengerReact
      propertyId={propertyId}
      widgetId={widgetId}
    />
  )
}
