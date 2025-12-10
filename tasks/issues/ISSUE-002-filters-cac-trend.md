---
id: ISSUE-002
title: useCACTrend no soporta filtros de fecha
status: open
priority: P1
area: data
estimate: S (30 min)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# useCACTrend no soporta filtros de fecha

## Problema
El hook `useCACTrend` solo acepta `months` como parámetro. No tiene soporte para `startDate`/`endDate`, lo que significa que siempre muestra los últimos 12 meses independientemente del filtro de dashboard.

## Ubicación
- **Hook**: `web/hooks/use-cac-trend.ts`
- **Uso**: `web/app/page.tsx` línea 196

## Código Actual
```typescript
// page.tsx
const { data: cacTrendData, ... } = useCACTrend({
  clinicId: currentClinic?.id,
  months: 12   // ← Solo acepta months
})

// use-cac-trend.ts
interface UseCACTrendOptions {
  clinicId?: string
  months?: number  // ← NO hay startDate/endDate
}
```

## Solución Propuesta

### 1. Actualizar interfaz del hook
```typescript
interface UseCACTrendOptions {
  clinicId?: string
  months?: number
  startDate?: string    // NUEVO
  endDate?: string      // NUEVO
}
```

### 2. Actualizar lógica del hook
```typescript
const params = new URLSearchParams()
if (clinicId) params.set('clinicId', clinicId)

if (startDate && endDate) {
  params.set('startDate', startDate)
  params.set('endDate', endDate)
} else {
  params.set('months', months.toString())
}
```

### 3. Actualizar endpoint API
`/api/analytics/cac-trend` debe procesar `startDate`/`endDate`

### 4. Actualizar uso en page.tsx
```typescript
const { data: cacTrendData } = useCACTrend({
  clinicId: currentClinic?.id,
  startDate: currentRange?.from,
  endDate: currentRange?.to
})
```

## Acceptance Criteria
- [ ] Hook acepta `startDate`/`endDate`
- [ ] API procesa parámetros de fecha
- [ ] Gráfico de CAC Trend respeta filtro de fecha
- [ ] Fallback a `months` si no hay fechas
- [ ] `npm run typecheck` pasa

## Archivos a Modificar
1. `web/hooks/use-cac-trend.ts`
2. `web/app/api/analytics/cac-trend/route.ts`
3. `web/app/page.tsx`

## Dependencias
- ISSUE-001 (patrón similar)
