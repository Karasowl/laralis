'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, XCircle, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { evaluateRequirements } from '@/lib/requirements'
import { useRouter } from 'next/navigation'

type RequirementId = 'depreciation' | 'fixed_costs' | 'cost_per_min' | 'supplies' | 'service_recipe' | 'tariffs'

interface ChecklistItem {
  id: RequirementId
  label: string
  href?: string
}

interface ChecklistStepProps {
  items: ChecklistItem[]
}

export function ChecklistStep({ items }: ChecklistStepProps) {
  const t = useTranslations('onboarding')
  const router = useRouter()
  const [status, setStatus] = useState<Record<RequirementId, boolean>>({
    depreciation: false,
    fixed_costs: false,
    cost_per_min: false,
    supplies: false,
    service_recipe: false,
    tariffs: false
  })
  const [checking, setChecking] = useState(false)

  const getClinicId = () => {
    try {
      if (typeof document !== 'undefined') {
        const m = document.cookie.match(/(?:^|; )clinicId=([^;]+)/)
        if (m) return decodeURIComponent(m[1])
      }
    } catch {}
    try {
      if (typeof window !== 'undefined') {
        const v = window.localStorage?.getItem('selectedClinicId')
        if (v) return v
      }
    } catch {}
    return undefined as any
  }

  const check = async () => {
    setChecking(true)
    try {
      const reqs = items.map(i => i.id) as RequirementId[]
      const res = await evaluateRequirements({ clinicId: getClinicId() as any }, reqs as any)
      const missing = new Set(res.missing || [])
      const map: any = {}
      for (const i of reqs) map[i] = !missing.has(i)
      setStatus((prev) => ({ ...prev, ...map }))
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { check() }, [])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('monthly_progress', 'Progreso')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it) => {
            const ok = status[it.id]
            return (
              <div key={it.id} className="flex items-center justify-between border rounded-md p-3">
                <div className="flex items-center gap-2">
                  {ok ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-amber-600" />
                  )}
                  <span className="text-sm">{it.label}</span>
                </div>
                {it.href && !ok && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(it.href!)}
                  >
                    {t('open', 'Abrir')}
                  </Button>
                )}
              </div>
            )
          })}
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={check} disabled={checking}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {checking ? t('checking', 'Verificando...') : t('refresh', 'Verificar de nuevo')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
