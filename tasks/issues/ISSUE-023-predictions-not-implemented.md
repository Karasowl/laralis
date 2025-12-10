---
id: ISSUE-023
title: Predicciones de ingreso no implementadas
status: open
priority: P2
area: feature
estimate: M (3 horas)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Predicciones de ingreso no implementadas

## Problema
El dashboard muestra predicciones de ingreso (próximo mes, cierre de año) que muestran el mismo valor o valores sin lógica aparente:
- Próximo mes: $1,470
- Cierre de año: $1,470

El interface `RevenuePrediction` existe pero NUNCA se usa.

## Ubicación

```typescript
// web/lib/types/analytics.ts líneas 125-130
export interface RevenuePrediction {
  nextMonth: number
  nextQuarter: number
  yearEnd: number
  confidence: number  // 0-100%
}
```

Este interface está definido pero NO hay endpoint que lo implemente.

## Solución

### 1. Crear Endpoint de Predicción

```typescript
// web/app/api/analytics/predictions/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // 1. Obtener histórico de últimos 6-12 meses
  const { data: history } = await supabaseAdmin
    .from('treatments')
    .select('price_cents, treatment_date')
    .eq('clinic_id', clinicId)
    .gte('treatment_date', sixMonthsAgo)
    .order('treatment_date', { ascending: true })

  // 2. Calcular tendencia (regresión lineal simple)
  const monthlyTotals = groupByMonth(history)
  const trend = calculateLinearTrend(monthlyTotals)

  // 3. Proyectar
  const nextMonth = projectRevenue(trend, 1)
  const nextQuarter = projectRevenue(trend, 3)
  const yearEnd = projectToYearEnd(trend)

  // 4. Calcular confianza basada en varianza
  const confidence = calculateConfidence(monthlyTotals)

  return NextResponse.json({
    nextMonth,
    nextQuarter,
    yearEnd,
    confidence,
    trend: trend.direction, // 'up' | 'down' | 'stable'
    basis: monthlyTotals.length, // meses de datos usados
  })
}
```

### 2. Implementar Cálculos

```typescript
// lib/calc/predictions.ts

interface MonthlyData {
  month: string // YYYY-MM
  revenue: number
}

/**
 * Regresión lineal simple para predecir tendencia
 */
export function calculateLinearTrend(data: MonthlyData[]) {
  const n = data.length
  if (n < 3) return { slope: 0, intercept: data[n-1]?.revenue || 0 }

  // Least squares regression
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  data.forEach((d, i) => {
    sumX += i
    sumY += d.revenue
    sumXY += i * d.revenue
    sumX2 += i * i
  })

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  return {
    slope,
    intercept,
    direction: slope > 100 ? 'up' : slope < -100 ? 'down' : 'stable'
  }
}

/**
 * Proyectar revenue a X meses en el futuro
 */
export function projectRevenue(
  trend: { slope: number; intercept: number },
  monthsAhead: number,
  currentMonth: number
) {
  return Math.max(0, trend.intercept + trend.slope * (currentMonth + monthsAhead))
}

/**
 * Calcular confianza basada en varianza de datos
 */
export function calculateConfidence(data: MonthlyData[]) {
  if (data.length < 3) return 30 // Baja confianza con pocos datos

  const avg = data.reduce((s, d) => s + d.revenue, 0) / data.length
  const variance = data.reduce((s, d) => s + Math.pow(d.revenue - avg, 2), 0) / data.length
  const cv = Math.sqrt(variance) / avg // Coeficiente de variación

  // Menor variación = mayor confianza
  if (cv < 0.1) return 90
  if (cv < 0.2) return 75
  if (cv < 0.3) return 60
  if (cv < 0.5) return 45
  return 30
}
```

### 3. Hook para Consumir

```typescript
// hooks/use-predictions.ts
export function usePredictions(options) {
  const { clinicId, startDate, endDate } = options

  const { data, loading, error } = useApi(
    clinicId ? `/api/analytics/predictions?clinicId=${clinicId}` : null
  )

  return {
    predictions: data,
    loading,
    error,
  }
}
```

### 4. Mostrar en Dashboard

```typescript
// En page.tsx o componente dedicado
<Card>
  <CardHeader>
    <CardTitle>{t('predictions.title')}</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-3 gap-4">
      <div>
        <span className="text-sm text-muted-foreground">
          {t('predictions.nextMonth')}
        </span>
        <span className="text-2xl font-bold">
          {formatCurrency(predictions.nextMonth)}
        </span>
      </div>
      {/* Similar para quarter y year */}
    </div>

    <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
      <Info className="h-4 w-4" />
      {t('predictions.confidence', { value: predictions.confidence })}
      <span>({t('predictions.basis', { months: predictions.basis })})</span>
    </div>
  </CardContent>
</Card>
```

## Acceptance Criteria
- [ ] Endpoint `/api/analytics/predictions` implementado
- [ ] Cálculos de regresión con tests
- [ ] Hook `usePredictions` creado
- [ ] Dashboard muestra predicciones reales
- [ ] Indicador de confianza visible
- [ ] Tooltip explicando metodología
- [ ] Traducciones EN y ES
- [ ] `npm run typecheck` pasa
- [ ] Tests para `lib/calc/predictions.ts`

## Testing
1. Clínica con 6+ meses de datos → predicción con alta confianza
2. Clínica con 1 mes de datos → predicción con baja confianza
3. Clínica sin datos → mostrar "Datos insuficientes"

## Archivos a Crear
1. `web/app/api/analytics/predictions/route.ts`
2. `web/lib/calc/predictions.ts`
3. `web/lib/calc/__tests__/predictions.test.ts`
4. `web/hooks/use-predictions.ts`

## Archivos a Modificar
1. `web/app/page.tsx` (integrar predicciones)
2. Traducciones
