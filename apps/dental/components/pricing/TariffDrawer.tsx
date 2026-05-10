'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { roundToStepCents, formatCurrency } from '@/lib/money'
import { NumericInput } from '@/components/ui/numeric-input'
import { track } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type RoundingMode = 'nearest' | 'up' | 'down'

export function TariffDrawer() {
  const t = useTranslations('onboarding.tariffDrawer')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState<number | ''>(60)
  const [costPerMinuteCents, setCPM] = useState<number | ''>(0)
  const [variableCostCents, setVar] = useState<number | ''>(0)
  const [marginPct, setMargin] = useState<number | ''>(40)
  const [multipleCents, setMultipleCents] = useState<number | ''>(5000) // $50
  const [mode, setMode] = useState<RoundingMode>(() => {
    try {
      const v = localStorage.getItem('tariff_round_mode') as RoundingMode | null
      return v || 'nearest'
    } catch { return 'nearest' }
  })

  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true)
      // Optionally receive defaults from event detail
      try {
        const detail = (e as CustomEvent).detail || {}
        if (typeof detail.minutes === 'number') setMinutes(detail.minutes)
        if (typeof detail.costPerMinuteCents === 'number') setCPM(detail.costPerMinuteCents)
        if (typeof detail.variableCostCents === 'number') setVar(detail.variableCostCents)
        if (typeof detail.marginPct === 'number') setMargin(detail.marginPct)
        if (typeof detail.multipleCents === 'number') setMultipleCents(detail.multipleCents)
        track({
          event: 'drawer.open',
          serviceId: detail?.serviceId,
          minutes: typeof detail?.minutes === 'number' ? detail.minutes : undefined,
          costPerMinuteCents: typeof detail?.costPerMinuteCents === 'number' ? detail.costPerMinuteCents : undefined,
          variableCostCents: typeof detail?.variableCostCents === 'number' ? detail.variableCostCents : undefined,
          marginPct: typeof detail?.marginPct === 'number' ? detail.marginPct : undefined,
          stepCents: typeof detail?.multipleCents === 'number' ? detail.multipleCents : multipleCents,
          roundMode: mode
        })
      } catch {}
    }
    window.addEventListener('onboarding:open-tariff-drawer', onOpen as any)
    // Back-compat for older event name during rollout
    window.addEventListener('open-tariff-drawer', onOpen as any)
    return () => {
      window.removeEventListener('onboarding:open-tariff-drawer', onOpen as any)
      window.removeEventListener('open-tariff-drawer', onOpen as any)
    }
  }, [])

  const fixed = useMemo(() => (Number(minutes || 0)) * (Number(costPerMinuteCents || 0)), [minutes, costPerMinuteCents])
  const base = useMemo(() => fixed + Number(variableCostCents || 0), [fixed, variableCostCents])
  const marginAmount = useMemo(() => Math.round(base * (Number(marginPct || 0) / 100)), [base, marginPct])
  const price = useMemo(() => base + marginAmount, [base, marginAmount])
  const rounded = useMemo(() => roundToStepCents(price, Number(multipleCents || 0) || 1, mode), [price, multipleCents, mode])

  // Accessibility helpers
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      {/* Panel */}
      <div role="dialog" aria-modal="true" aria-labelledby="tariffDrawerTitle" className="absolute right-0 top-0 h-full w-[420px] bg-card border-l shadow-xl p-4 space-y-4 overflow-y-auto outline-none">
        <div className="flex items-center justify-between">
          <h3 id="tariffDrawerTitle" className="text-lg font-semibold">{t('title')}</h3>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t('ctas.cancel')}</Button>
        </div>

        {/* Time */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('sections.time')}</label>
          <NumericInput min={1} value={minutes} onChange={setMinutes} />
        </div>

        {/* Recipe variable (read-only editable via wizard elsewhere) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('sections.recipe')}</label>
          <NumericInput min={0} value={variableCostCents} onChange={setVar} />
        </div>

        {/* Margin & rounding */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('sections.marginRounding')}</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <NumericInput min={0} max={100} value={marginPct} onChange={setMargin} />
            </div>
            <div>
              <NumericInput min={1} step={100} value={multipleCents} onChange={setMultipleCents} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Button variant={mode === 'nearest' ? 'default' : 'outline'} size="sm" onClick={() => { setMode('nearest'); try { localStorage.setItem('tariff_round_mode','nearest') } catch {} }}>nearest</Button>
            <Button variant={mode === 'up' ? 'default' : 'outline'} size="sm" onClick={() => { setMode('up'); try { localStorage.setItem('tariff_round_mode','up') } catch {} }}>up</Button>
            <Button variant={mode === 'down' ? 'default' : 'outline'} size="sm" onClick={() => { setMode('down'); try { localStorage.setItem('tariff_round_mode','down') } catch {} }}>down</Button>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-md bg-muted p-3 space-y-1 text-sm" aria-live="polite">
          <div className="flex justify-between"><span>Fijo</span><span>{formatCurrency(fixed, locale as any)}</span></div>
          <div className="flex justify-between"><span>Variable</span><span>{formatCurrency(variableCostCents || 0, locale as any)}</span></div>
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(base, locale as any)}</span></div>
          <div className="flex justify-between"><span>{t('summary.priceRaw')}</span><span>{formatCurrency(price, locale as any)}</span></div>
          <div className="flex justify-between font-semibold"><span>{t('summary.priceRounded')}</span><span>{formatCurrency(rounded, locale as any)}</span></div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>{t('ctas.cancel')}</Button>
          <Button onClick={() => {
            try {
              track({
                event: 'drawer.apply',
                minutes: minutes || 0,
                costPerMinuteCents: costPerMinuteCents || 0,
                variableCostCents: variableCostCents || 0,
                marginPct: marginPct || 0,
                stepCents: multipleCents || 0,
                roundMode: mode,
                priceCents: price,
                roundedCents: rounded
              })
            } catch {}
            setOpen(false)
          }}>{t('ctas.apply')}</Button>
        </div>
      </div>
    </div>
  )
}
