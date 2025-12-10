---
id: ISSUE-006
title: CampaignROI muestra "Crea tu primera campaña" con campañas existentes
status: open
priority: P0
area: data
estimate: XS (15 min)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# CampaignROI muestra "Crea tu primera campaña" con campañas existentes

## Problema
El componente `CampaignROISection` muestra "Crea tu primera campaña" aunque existen campañas con pacientes asignados en la base de datos.

## Causa Raíz
Mismo problema que ISSUE-005: timing issue con `clinicId`.

**Ubicación**: `web/components/dashboard/CampaignROISection.tsx` líneas 23-27

```typescript
const { campaigns, summary, loading, error } = useCampaignROI({
  clinicId: currentClinic?.id,  // ← Potencialmente undefined
  includeArchived,
  platformId,
})
```

El hook intenta usar fallback pero hay race condition:
```typescript
// use-campaign-roi.ts
const { currentClinic } = useCurrentClinic()
const clinicId = options.clinicId || currentClinic?.id  // ← Ambos undefined
```

## Solución
Asegurar que el hook espere hasta tener `clinicId`:

```typescript
// use-campaign-roi.ts
export function useCampaignROI(options) {
  const { currentClinic } = useCurrentClinic()
  const clinicId = options.clinicId || currentClinic?.id

  // NO hacer fetch hasta tener clinicId
  const endpoint = clinicId
    ? `/api/marketing/campaigns/roi?${params.toString()}`
    : null

  const { data, loading, error, execute } = useApi(endpoint, {
    autoFetch: Boolean(clinicId)  // ← Solo fetch cuando hay clinicId
  })
```

## Acceptance Criteria
- [ ] CampaignROI muestra campañas existentes
- [ ] ROI se calcula correctamente por campaña
- [ ] No muestra "Crea tu primera campaña" si hay campañas
- [ ] `npm run typecheck` pasa

## Testing
1. Verificar que existen campañas en Mercadotecnia
2. Ir a Dashboard → tab Marketing
3. Verificar que aparecen las campañas con ROI

## Archivos a Modificar
1. `web/hooks/use-campaign-roi.ts`
2. `web/components/dashboard/CampaignROISection.tsx` (si necesario)

## Dependencias
- ISSUE-005 (mismo patrón de fix)
