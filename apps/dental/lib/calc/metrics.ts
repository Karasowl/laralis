import { formatDateToISO, parseLocalDate } from '@/lib/date-utils'

export type PercentageComparison = {
  change: number | null
  trend: 'up' | 'down' | 'flat' | null
}

export function calculatePercentageChange(
  current: number,
  previous: number,
  precision = 1
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return current === 0 ? 0 : null

  const factor = 10 ** precision
  return Math.round((((current - previous) / Math.abs(previous)) * 100) * factor) / factor
}

export function compareValues(
  current: number,
  previous: number,
  precision = 1
): PercentageComparison {
  const change = calculatePercentageChange(current, previous, precision)
  if (change === null) return { change: null, trend: null }
  if (change === 0) return { change, trend: 'flat' }
  return { change, trend: change > 0 ? 'up' : 'down' }
}

export function calculateWeightedRoi(
  rows: Array<{ revenueCents: number; costCents: number }>
): number | null {
  const totals = rows.reduce(
    (result, row) => ({
      revenueCents: result.revenueCents + Math.max(0, row.revenueCents || 0),
      costCents: result.costCents + Math.max(0, row.costCents || 0),
    }),
    { revenueCents: 0, costCents: 0 }
  )

  if (totals.costCents === 0) return null
  return Math.round((((totals.revenueCents - totals.costCents) / totals.costCents) * 100) * 100) / 100
}

export function getPreviousPeriodRange(
  fromIso: string,
  toIso: string
): { from: string; to: string } {
  const from = parseLocalDate(fromIso)
  const to = parseLocalDate(toIso)
  const isFullCalendarMonth = from.getDate() === 1
    && to.getFullYear() === from.getFullYear()
    && to.getMonth() === from.getMonth()
    && to.getDate() === new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate()

  if (isFullCalendarMonth) {
    return {
      from: formatDateToISO(new Date(from.getFullYear(), from.getMonth() - 1, 1)),
      to: formatDateToISO(new Date(from.getFullYear(), from.getMonth(), 0)),
    }
  }

  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  const previousTo = new Date(from)
  previousTo.setDate(previousTo.getDate() - 1)
  const previousFrom = new Date(previousTo)
  previousFrom.setDate(previousFrom.getDate() - Math.max(1, days) + 1)
  return {
    from: formatDateToISO(previousFrom),
    to: formatDateToISO(previousTo),
  }
}

export function prorateMonthlyAmountForRange(
  monthlyCents: number,
  fromIso: string,
  toIso: string
): number {
  if (monthlyCents <= 0) return 0
  const start = parseLocalDate(fromIso)
  const end = parseLocalDate(toIso)
  if (end < start) return 0

  let total = 0
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cursor <= end) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const overlapStart = start > monthStart ? start : monthStart
    const overlapEnd = end < monthEnd ? end : monthEnd
    if (overlapStart <= overlapEnd) {
      const coveredDays = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86_400_000) + 1
      total += monthlyCents * (coveredDays / monthEnd.getDate())
    }
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return Math.round(total)
}

export interface RevenueTreatment {
  status?: string | null
  price_cents?: number | null
  amount_paid_cents?: number | null
  is_paid?: boolean | null
}

export function completedBilledRevenueCents(treatment: RevenueTreatment): number {
  if (treatment.status !== 'completed') return 0
  return Math.max(0, Number(treatment.price_cents) || 0)
}

export function collectedRevenueCents(treatment: RevenueTreatment): number {
  const billed = completedBilledRevenueCents(treatment)
  if (billed === 0) return 0
  const explicitlyPaid = Math.max(0, Number(treatment.amount_paid_cents) || 0)
  if (explicitlyPaid > 0) return Math.min(explicitlyPaid, billed)
  return treatment.is_paid ? billed : 0
}

export function normalizeCostCategory(value: string | null | undefined): string {
  const original = String(value || '').trim()
  const normalized = original
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const mappings: Array<[RegExp, string]> = [
    [/salari|sueldo|nomina|personal|honorario/, 'Nómina'],
    [/renta|alquiler|arrendamiento/, 'Renta'],
    [/marketing|publicidad|anuncio|promocion/, 'Marketing'],
    [/agua|electric|\bluz\b|internet|telefono|servicio publico/, 'Servicios'],
    [/mantenimiento|reparacion/, 'Mantenimiento'],
    [/aseo|limpieza/, 'Limpieza'],
    [/insumo|material|laboratorio|proveedor/, 'Insumos'],
    [/seguro/, 'Seguros'],
    [/software|suscripcion/, 'Software'],
  ]

  return mappings.find(([pattern]) => pattern.test(normalized))?.[1] || original || 'Sin categoría'
}
