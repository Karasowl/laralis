'use client'

import { ConvexReactClient } from 'convex/react'
import { ConvexAuthNextjsProvider } from '@convex-dev/auth/nextjs'
import { ReactNode, useMemo } from 'react'

/**
 * Client provider for Convex Auth (@convex-dev/auth). Only mounted when
 * AUTH_BACKEND is 'convex'/'dual' (gated in the root layout), so in Supabase mode
 * no ConvexReactClient / WS connection is constructed.
 */
export function ConvexAuthClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(
    () => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!),
    []
  )
  return <ConvexAuthNextjsProvider client={client}>{children}</ConvexAuthNextjsProvider>
}
