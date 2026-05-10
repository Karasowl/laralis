'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ReportsRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  return (
    <main className="min-h-screen bg-background" data-testid="reports-redirect">
      <div className="sr-only">Redirecting to dashboard</div>
    </main>
  )
}

