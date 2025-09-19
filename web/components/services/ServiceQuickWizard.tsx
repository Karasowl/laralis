'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { NumericInput } from '@/components/ui/numeric-input'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSetupStatus } from '@/hooks/use-setup-status'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/money'
import { redondearA } from '@/lib/money'
import { Trash2 } from 'lucide-react'

interface WizardProps {
  onDone: (opt: { value: string; label: string }) => void
  onCancel: () => void
}

type SupplyRow = {
  id: string
  name: string
  cost_per_portion_cents: number
}

export function ServiceQuickWizard({ onDone, onCancel }: WizardProps) {
  const router = useRouter()
  const t = useTranslations('services')
  const tCommon = useTranslations('common')

  const { status, loading: setupLoading, refetch } = useSetupStatus()

  const [step, setStep] = React.useState<0 | 1 | 2 | 3 | 4 | 5>(1)
  const [timeJustSaved, setTimeJustSaved] = React.useState(false)
  const [name, setName] = React.useState('')
  const [minutes, setMinutes] = React.useState<number>(30)
  const [margin, setMargin] = React.useState<number>(60)
  const [roundTo, setRoundTo] = React.useState<number>(50)

  const [supplies, setSupplies] = React.useState<SupplyRow[]>([])
  const [search, setSearch] = React.useState('')
  const [selected, setSelected] = React.useState<Record<string, number>>({}) // supplyId -> qty
  const [extraVariablePesos, setExtraVariablePesos] = React.useState<number>(0)
  const createdInSession = React.useRef<Set<string>>(new Set())

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fixedPerMinute = React.useRef<number>(0)
  const [needsFixed, setNeedsFixed] = React.useState<boolean>(false)
  const [needsTimeHard, setNeedsTimeHard] = React.useState<boolean>(false)
  const [cpMeta, setCpMeta] = React.useState<{ monthly: number; effective: number } | null>(null)
  const [fixedJustSaved, setFixedJustSaved] = React.useState<boolean>(false)

  // Load time settings for fixed/minute and initial supplies
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        // cost-per-minute derived endpoint
        const timeRes = await fetch('/api/time/cost-per-minute', { credentials: 'include' })
        if (timeRes.ok) {
          const js = await timeRes.json()
          const fixed = Number(js?.data?.per_minute_cents || 0)
          fixedPerMinute.current = isNaN(fixed) ? 0 : fixed
          const monthlyFixed = Number(js?.data?.monthly_fixed_cents || 0)
          const effective = Number(js?.data?.effective_minutes_per_month || 0)
          setNeedsFixed(monthlyFixed <= 0)
          setNeedsTimeHard(effective <= 0)
          setCpMeta({ monthly: monthlyFixed, effective })
          try { console.log('[ServiceQuickWizard] cost-per-minute loaded; fpm:', fixedPerMinute.current, 'monthlyFixed:', monthlyFixed, 'effective:', effective) } catch {}
        }
      } catch {}
      try {
        const url = '/api/supplies?limit=200'
        const res = await fetch(url, { credentials: 'include' })
        const js = await res.json()
        if (!cancelled) {
          const list = (js?.data || []) as any[]
          // De-dup by case-insensitive name, keep the first
          const seen = new Set<string>()
          const deduped: SupplyRow[] = []
          for (const s of list) {
            const key = String(s.name || '').trim().toLowerCase()
            if (key && !seen.has(key)) {
              seen.add(key)
              deduped.push({ id: s.id, name: s.name, cost_per_portion_cents: Math.round(s.cost_per_portion_cents || (s.price_cents / Math.max(1, s.portions))) })
            }
          }
          setSupplies(deduped)
        }
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filteredSupplies = React.useMemo(() => {
    const q = search.toLowerCase()
    return supplies.filter(s => !q || s.name.toLowerCase().includes(q))
  }, [supplies, search])

  const variableCostCents = React.useMemo(() => {
    const fromRecipe = Object.entries(selected).reduce((acc, [id, qty]) => {
      const row = supplies.find(s => s.id === id)
      if (!row || !qty) return acc
      return acc + row.cost_per_portion_cents * qty
    }, 0)
    const extraCents = Math.round((extraVariablePesos || 0) * 100)
    return fromRecipe + extraCents
  }, [selected, supplies, extraVariablePesos])

  const fixedCostCents = React.useMemo(() => minutes * (fixedPerMinute.current || 0), [minutes])
  const priceCents = React.useMemo(() => {
    const base = fixedCostCents + variableCostCents
    const withMargin = Math.round(base * (1 + (margin || 0) / 100))
    return redondearA(withMargin, roundTo * 100)
  }, [fixedCostCents, variableCostCents, margin, roundTo])

  const canContinueStep1 = name.trim().length > 1 && minutes > 0
  // Show time setup step if setup.status says there's no time record
  const needsTime = !setupLoading && status && status.hasTime === false && !timeJustSaved
  React.useEffect(() => {
    if (needsTime || needsTimeHard) setStep(0)
    else if (!setupLoading) {
      const hasFixed = !!status?.hasFixedCosts || !!status?.hasAssets || fixedJustSaved
      if (!hasFixed || needsFixed) setStep(4)
    }
  }, [needsTime, needsTimeHard, needsFixed, setupLoading, status?.hasFixedCosts, status?.hasAssets, fixedJustSaved])

  // Time setup step state
  const [workDays, setWorkDays] = React.useState<number | ''>('')
  const [hoursPerDay, setHoursPerDay] = React.useState<number | ''>('')
  const [realPct, setRealPct] = React.useState<number | ''>('')

  // Client-side validation for time step
  const wdValid = workDays !== '' && workDays >= 1 && workDays <= 31
  const hpdValid = hoursPerDay !== '' && hoursPerDay >= 1 && hoursPerDay <= 16
  const pctValid = realPct !== '' && realPct >= 0 && realPct <= 100
  const timeFormValid = wdValid && hpdValid && pctValid

  async function saveTimeSettings() {
    setLoading(true)
    setError(null)
    try {
      if (!workDays || !hoursPerDay || !realPct) {
        setError('Completa días, horas por día y % productividad')
        setLoading(false)
        return
      }
      const res = await fetch('/api/settings/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ work_days: Number(workDays), hours_per_day: Number(hoursPerDay), real_pct: Number(realPct) / 100 })
      })
      if (!res.ok) {
        const txt = await res.text()
        // Try to parse JSON response and map to friendly ES message
        try {
          const js = JSON.parse(txt)
          const msg = String(js?.message || js?.error || txt)
            .replace(/Cannot exceed 31 days/gi, 'Días al mes: no puede superar 31')
            .replace(/Cannot exceed 16 hours/gi, 'Horas por día: no puede superar 16')
            .replace(/Must be at least 1 day/gi, 'Días al mes: mínimo 1')
            .replace(/Must be at least 1 hour/gi, 'Horas por día: mínimo 1')
          throw new Error(msg)
        } catch {
          throw new Error(txt || 'No se pudo guardar Configuración de Tiempo')
        }
      }
      // Recalcular costo/minuto
      try {
        const cp = await fetch('/api/time/cost-per-minute', { credentials: 'include' })
        const js = await cp.json()
        const fixed = Number(js?.data?.per_minute_cents || 0)
        fixedPerMinute.current = isNaN(fixed) ? 0 : fixed
        const monthlyFixed = Number(js?.data?.monthly_fixed_cents || 0)
        const effective = Number(js?.data?.effective_minutes_per_month || 0)
        const nf = monthlyFixed <= 0
        const nt = effective <= 0
        setNeedsFixed(nf)
        setNeedsTimeHard(nt)
        setCpMeta({ monthly: monthlyFixed, effective })
        setStep(nt ? 0 : (nf ? 4 : 1))
      } catch {}
      setTimeJustSaved(true)
      try { await refetch() } catch {}
    } catch (e: any) {
      setError(e?.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  // En vez de capturar un estimado, redirigimos al módulo de Costos Fijos
  function goToFixedCosts() {
    router.push('/fixed-costs')
  }

  // Quick assets capture (optional)
  type QuickAsset = { name: string; price: number; months: number }
  const [assetsInput, setAssetsInput] = React.useState<QuickAsset[]>([
    { name: '', price: 0, months: 36 },
    { name: '', price: 0, months: 24 },
  ])

  function updateAssetAt(i: number, patch: Partial<QuickAsset>) {
    setAssetsInput(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a))
  }

  function addAssetRow() {
    setAssetsInput(prev => prev.length >= 3 ? prev : [...prev, { name: '', price: 0, months: 36 }])
  }

  function removeAssetRow(i: number) {
    setAssetsInput(prev => prev.filter((_, idx) => idx !== i))
  }

  async function saveQuickAssets() {
    setLoading(true)
    setError(null)
    try {
      const rows = assetsInput.filter(a => a.name.trim() && a.price > 0 && a.months > 0).slice(0, 3)
      for (const a of rows) {
        try {
          const res = await fetch('/api/assets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: a.name, purchase_price_pesos: a.price, depreciation_months: a.months })
          })
          if (!res.ok) {
            // Fallback: si no se puede crear activo, registrar depreciación mensual como costo fijo
            const monthlyCents = Math.round((a.price * 100) / Math.max(1, a.months))
            await fetch('/api/fixed-costs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ category: 'assets', concept: `Depreciación: ${a.name}`, amount_cents: monthlyCents })
            })
          }
        } catch {
          const monthlyCents = Math.round((a.price * 100) / Math.max(1, a.months))
          await fetch('/api/fixed-costs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ category: 'assets', concept: `Depreciación: ${a.name}`, amount_cents: monthlyCents })
          })
        }
      }

      // Recalcular costo/minuto
      try {
        const cp = await fetch('/api/time/cost-per-minute', { credentials: 'include' })
        const js = await cp.json()
        const fixed = Number(js?.data?.per_minute_cents || 0)
        fixedPerMinute.current = isNaN(fixed) ? 0 : fixed
        const monthlyFixed = Number(js?.data?.monthly_fixed_cents || 0)
        const effective = Number(js?.data?.effective_minutes_per_month || 0)
        setNeedsFixed(monthlyFixed <= 0)
        setNeedsTimeHard(effective <= 0)
        setCpMeta({ monthly: monthlyFixed, effective })
      } catch {}

      setStep(1)
    } catch (e: any) {
      setError(e?.message || 'Error al guardar activos')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateService() {
    setLoading(true)
    setError(null)
    try {
      const suppliesPayload = Object.entries(selected)
        .filter(([, qty]) => (qty || 0) > 0)
        .map(([supply_id, qty]) => ({ supply_id, qty }))

      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, est_minutes: minutes, supplies: suppliesPayload })
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || 'Failed to create service')
      }
      const js = await res.json()
      const data = js?.data || js
      onDone({ value: data.id, label: data.name })
    } catch (e: any) {
      setError(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSupplyInline(form: { name: string; presentation: string; price: number; portions: number }) {
    setLoading(true)
    setError(null)
    try {
      // If a supply with same (case-insensitive) name already exists, avoid duplicate creation
      const existing = supplies.find(s => s.name.trim().toLowerCase() === form.name.trim().toLowerCase())
      if (existing) {
        setSelected(prev => ({ ...prev, [existing.id]: (prev[existing.id] || 0) + 1 }))
        setLoading(false)
        return
      }
      const res = await fetch('/api/supplies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: form.name, category: 'insumo', presentation: form.presentation, price_pesos: form.price, portions: form.portions })
      })
      if (!res.ok) throw new Error('No se pudo crear el insumo')
      const js = await res.json()
      const s = js?.data
      const row: SupplyRow = { id: s.id, name: s.name, cost_per_portion_cents: Math.round(s.cost_per_portion_cents) }
      setSupplies(prev => [row, ...prev])
      setSelected(prev => ({ ...prev, [row.id]: 1 }))
      createdInSession.current.add(row.id)
    } catch (e: any) {
      setError(e?.message || 'Error al crear insumo')
    } finally {
      setLoading(false)
    }
  }

  async function deleteSupplyFromCatalog(id: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/supplies/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error('No se pudo eliminar el insumo')
      setSupplies(prev => prev.filter(s => s.id !== id))
      setSelected(prev => { const c = { ...prev }; delete c[id]; return c })
      createdInSession.current.delete(id)
    } catch (e: any) {
      setError(e?.message || 'Error al eliminar insumo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="text-sm text-destructive">{String(error)}</div>}

      {step === 0 && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">Antes de crear tu primer servicio, indica tu horario base:</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1">
              <Label>Días al mes</Label>
              <Input type="number" min={1} max={31} placeholder="22" value={workDays} onChange={e => {
                const v = e.target.value
                setWorkDays(v === '' ? '' : Math.min(31, Math.max(1, Number(v))))
              }} />
              {!wdValid && workDays !== '' && (
                <div className="text-xs text-destructive">Debe ser entre 1 y 31</div>
              )}
            </div>
            <div className="grid gap-1">
              <Label>Horas por día</Label>
              <Input type="number" min={1} max={16} placeholder="7" value={hoursPerDay} onChange={e => {
                const v = e.target.value
                setHoursPerDay(v === '' ? '' : Math.min(16, Math.max(1, Number(v))))
              }} />
              {!hpdValid && hoursPerDay !== '' && (
                <div className="text-xs text-destructive">Debe ser entre 1 y 16</div>
              )}
            </div>
            <div className="grid gap-1">
              <Label>% Productividad</Label>
              <Input type="number" min={0} max={100} placeholder="70" value={realPct} onChange={e => {
                const v = e.target.value
                setRealPct(v === '' ? '' : Math.min(100, Math.max(0, Number(v))))
              }} />
              {!pctValid && realPct !== '' && (
                <div className="text-xs text-destructive">Debe ser entre 0 y 100</div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>{tCommon('cancel')}</Button>
            <Button onClick={saveTimeSettings} disabled={loading || !timeFormValid}>{loading ? tCommon('saving') : tCommon('save')}</Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Nombre del servicio</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('servicePlaceholder')} />
            </div>
            <div className="grid gap-2">
              <Label>Duración (min)</Label>
              <Input type="number" value={minutes} onChange={e => setMinutes(Math.max(1, Number(e.target.value || 0)))} />
            </div>
            <div className="grid gap-2">
              <Label>Margen %</Label>
              <Input type="number" value={margin} onChange={e => setMargin(Math.max(0, Number(e.target.value || 0)))} />
            </div>
          </div>
          {(status && status.hasTime === false && !timeJustSaved) && (
            <div className="p-3 rounded-md border text-sm bg-amber-50">
              Falta configurar el costo por minuto. Abre Configuración → Tiempo y completa los campos. Sin eso no se pueden calcular precios.
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>{tCommon('cancel')}</Button>
            <Button disabled={!canContinueStep1} onClick={() => setStep(needsTimeHard ? 0 : (needsFixed ? 4 : 2))}>{tCommon('next')}</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Insumos (receta clínica)</Label>
            <Input placeholder={t('searchSupplyPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
            {filteredSupplies.length > 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/40 flex justify-between">
                <span>Insumo / Costo por porción</span>
                <span>Cant.</span>
              </div>
            )}
            {filteredSupplies.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">Sin insumos. Crea uno abajo.</div>
            )}
            {filteredSupplies.map((s) => {
              const qty = selected[s.id] || 0
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">Costo por porción: {formatCurrency(s.cost_per_portion_cents)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input aria-label="Cantidad" placeholder={t('quantityPlaceholder')} type="number" className="w-24 sm:w-28" value={qty} onChange={e => setSelected(prev => ({ ...prev, [s.id]: Math.max(0, Number(e.target.value || 0)) }))} />
                    {qty > 0 && (
                      <Button type="button" variant="ghost" size="icon" title="Quitar de la receta" onClick={() => setSelected(prev => ({ ...prev, [s.id]: 0 }))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('¿Eliminar este insumo del catálogo? Esta acción no se puede deshacer.')) {
                          deleteSupplyFromCatalog(s.id)
                        }
                      }}
                      title="Eliminar del catálogo"
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Inline supply creation */}
          <div className="pt-2 border-t">
            <div className="text-sm font-medium mb-2">Crear insumo rápido</div>
            <InlineSupplyCreate onCreate={handleCreateSupplyInline} loading={loading} />
          </div>

          {/* Extra variable cost capture (e.g., otros gastos por caso) */}
          <div className="grid sm:grid-cols-2 gap-3 items-end">
            <div className="grid gap-1">
              <Label>Otros costos variables (MXN) — opcional</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={extraVariablePesos}
                onFocus={e => e.currentTarget.select()}
                onChange={e => setExtraVariablePesos(Number(e.target.value || 0))}
              />
            </div>
            <div className="flex justify-between text-sm sm:self-center border rounded-md px-3 py-2">
              <div className="text-muted-foreground">Costo variable</div>
              <div className="font-medium">{formatCurrency(variableCostCents)}</div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>{tCommon('back')}</Button>
            <Button onClick={() => setStep(3)}>{tCommon('next')}</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {(fixedCostCents === 0) && (
            <div className="p-3 rounded-md border text-sm bg-amber-50 space-y-2">
              {cpMeta?.monthly && cpMeta.monthly > 0 ? (
                <>
                  <div>No se pudo calcular el costo fijo por minuto porque tu horario/productividad está incompleto. Configúralo para obtener precios precisos.</div>
                  <div className="text-right"><Button size="sm" variant="outline" onClick={() => setStep(0)}>Configurar horario</Button></div>
                </>
              ) : (
                <>
                  <div>No se pudo calcular costo fijo por minuto: faltan costos fijos. Agrega un estimado para continuar.</div>
                  <div className="text-right"><Button size="sm" variant="outline" onClick={() => setStep(4)}>Agregar costo fijo</Button></div>
                </>
              )}
            </div>
          )}
          <div className="rounded-md border p-3 space-y-2 text-sm">
            <div className="flex justify-between"><span>Minutos</span><span className="font-medium">{minutes}</span></div>
            <div className="flex justify-between"><span>Costo fijo</span><span className="font-medium">{formatCurrency(fixedCostCents)}</span></div>
            <div className="flex justify-between"><span>Costo variable</span><span className="font-medium">{formatCurrency(variableCostCents)}</span></div>
            <div className="flex justify-between"><span>Margen</span><span className="font-medium">{margin}%</span></div>
            <div className="flex justify-between"><span>Redondeo</span><span className="font-medium">{roundTo}</span></div>
            <div className="flex justify-between text-base"><span>Precio</span><span className="font-semibold">{formatCurrency(priceCents)}</span></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>{tCommon('back')}</Button>
            <Button disabled={loading || !name} onClick={handleCreateService}>{loading ? tCommon('saving') : tCommon('create')}</Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">Faltan costos fijos. Configúralos como en el módulo de “Costos fijos” para un cálculo preciso. Los tratamientos ya registrados no se recalculan: cada tratamiento guarda un snapshot financiero.</div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>{tCommon('back')}</Button>
            <Button onClick={goToFixedCosts}>Abrir Costos fijos</Button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">Opcional: agrega 1–3 activos principales para capturar su depreciación mensual automáticamente.</div>
          <div className="space-y-3">
            {assetsInput.map((a, i) => {
              const monthly = a.price > 0 && a.months > 0 ? Math.round((a.price * 100) / a.months) : 0
              return (
                <div key={i} className="grid gap-2 sm:grid-cols-12 items-end">
                  <div className="sm:col-span-5">
                    <Label>Activo</Label>
                    <Input placeholder={t('assetPlaceholder')} value={a.name} onChange={e => updateAssetAt(i, { name: e.target.value })} />
                  </div>
                  <div className="sm:col-span-3">
                    <Label>Precio (MXN)</Label>
                    <Input type="number" inputMode="decimal" placeholder="0" value={a.price} onChange={e => updateAssetAt(i, { price: Number(e.target.value || 0) })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Meses</Label>
                    <Input type="number" placeholder="36" value={a.months} onChange={e => updateAssetAt(i, { months: Math.max(1, Number(e.target.value || 0)) })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Dep. mensual</Label>
                    <div className="h-10 flex items-center px-3 rounded-md border text-sm">{formatCurrency(monthly)}</div>
                  </div>
                  {assetsInput.length > 1 && (
                    <div className="sm:col-span-12 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeAssetRow(i)}>Quitar</Button>
                    </div>
                  )}
                </div>
              )
            })}
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={addAssetRow} disabled={assetsInput.length >= 3}>Agregar otro</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Omitir</Button>
                <Button onClick={saveQuickAssets} disabled={loading}>Guardar y continuar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InlineSupplyCreate({ onCreate, loading }: { onCreate: (f: { name: string; presentation: string; price: number; portions: number }) => void | Promise<void>; loading?: boolean }) {
  const [name, setName] = React.useState('')
  const [presentation, setPresentation] = React.useState('Paquete 100u')
  const [price, setPrice] = React.useState<number | ''>('' as any)
  const [portions, setPortions] = React.useState<number | ''>('' as any)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="grid gap-1">
        <Label>Nombre</Label>
        <Input placeholder="Ej: Guantes de látex" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label>Presentación</Label>
        <Input placeholder="Ej: Caja de 100" value={presentation} onChange={e => setPresentation(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label>Precio total (MXN)</Label>
        <NumericInput placeholder="0" inputMode="decimal" min={0} value={price} onChange={setPrice} />
      </div>
      <div className="grid gap-1">
        <Label>Porciones por presentación</Label>
        <div className="flex gap-2 flex-col sm:flex-row">
          <NumericInput className="flex-1" placeholder="1" min={1} value={portions} onChange={setPortions} />
          <Button className="whitespace-nowrap" disabled={loading || !name || price === '' || portions === '' || Number(portions) < 1}
            onClick={() => onCreate({ name, presentation, price: Number(price || 0), portions: Number(portions || 0) })}>Agregar</Button>
        </div>
      </div>
    </div>
  )
}
