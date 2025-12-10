---
id: ISSUE-005
title: CAC siempre muestra cero
status: open
priority: P0
area: data
estimate: XS (15 min)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# CAC siempre muestra cero

## Problema
El costo de adquisición de clientes (CAC) en el dashboard de Marketing siempre muestra $0, aunque hay gastos registrados con categoría Marketing.

## Causa Raíz
Timing issue: `currentClinic?.id` es `undefined` cuando el hook se monta por primera vez.

**Ubicación**: `web/hooks/use-marketing-metrics.ts` líneas 50-66

```typescript
export function useMarketingMetrics(options) {
  const { clinicId, period = 30, startDate, endDate } = options

  const endpoint = clinicId
    ? `/api/analytics/marketing-metrics?${params.toString()}`
    : null  // ← Si clinicId undefined, endpoint = null, no fetch
```

**Resultado**:
- `endpoint` = `null`
- `useApi` no hace fetch
- CAC = 0 (valor por defecto)

## Solución
Agregar fallback a `useCurrentClinic()`:

```typescript
export function useMarketingMetrics(options) {
  const { currentClinic } = useCurrentClinic()  // ← AGREGAR
  const clinicId = options.clinicId || currentClinic?.id  // ← FALLBACK

  const endpoint = clinicId
    ? `/api/analytics/marketing-metrics?${params.toString()}`
    : null
```

## Acceptance Criteria
- [ ] CAC muestra valor real cuando hay gastos de marketing
- [ ] LTV se calcula correctamente
- [ ] Tasa de conversión refleja datos reales
- [ ] No hay errores en consola
- [ ] `npm run typecheck` pasa

## Testing
1. Crear gasto con categoría "Marketing"
2. Ir a Dashboard → tab Marketing
3. Verificar que CAC > 0
4. Verificar que LTV y otros metrics funcionan

## Archivos a Modificar
1. `web/hooks/use-marketing-metrics.ts`

## Nota
El mismo patrón aplica a otros hooks de marketing:
- `use-campaign-roi.ts` (ISSUE-006)
- `use-channel-roi.ts` (verificar si tiene el mismo problema)
