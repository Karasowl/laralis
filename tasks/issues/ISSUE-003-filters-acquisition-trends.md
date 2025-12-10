---
id: ISSUE-003
title: useAcquisitionTrends no soporta filtros de fecha
status: open
priority: P1
area: data
estimate: S (30 min)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# useAcquisitionTrends no soporta filtros de fecha

## Problema
Idéntico a ISSUE-002. El hook solo acepta `months` y `projectionMonths`, ignorando el filtro de fechas del dashboard.

## Ubicación
- **Hook**: `web/hooks/use-acquisition-trends.ts`
- **Uso**: `web/app/page.tsx` línea 210

## Código Actual
```typescript
const { data: acquisitionTrendsData } = useAcquisitionTrends({
  clinicId: currentClinic?.id,
  months: 12,
  projectionMonths: 3
})
```

## Solución
Mismo patrón que ISSUE-002:
1. Agregar `startDate`/`endDate` a interfaz
2. Actualizar hook para usar fechas
3. Actualizar API endpoint
4. Pasar `currentRange` desde page.tsx

## Acceptance Criteria
- [ ] Hook acepta `startDate`/`endDate`
- [ ] Gráfico de Acquisition Trends respeta filtro
- [ ] `npm run typecheck` pasa

## Archivos a Modificar
1. `web/hooks/use-acquisition-trends.ts`
2. `web/app/api/analytics/acquisition-trends/route.ts`
3. `web/app/page.tsx`

## Dependencias
- ISSUE-002 (implementar primero como referencia)
