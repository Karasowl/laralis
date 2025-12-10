---
id: ISSUE-001
title: useEquilibrium no recibe filtros de fecha
status: open
priority: P0
area: data
estimate: XS (15 min)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# useEquilibrium no recibe filtros de fecha

## Problema
El hook `useEquilibrium` soporta parámetros de fecha pero NO se le pasan desde `page.tsx`. El resultado es que el Break-Even Progress siempre calcula contra el mes actual, ignorando el filtro de fechas del dashboard.

## Ubicación
- **Archivo**: `web/app/page.tsx`
- **Línea**: 172

## Código Actual
```typescript
const { data: equilibriumData, loading: equilibriumLoading } = useEquilibrium({
  clinicId: currentClinic?.id
  // ❌ NO RECIBE startDate/endDate
})
```

## Código Correcto
```typescript
const { data: equilibriumData, loading: equilibriumLoading } = useEquilibrium({
  clinicId: currentClinic?.id,
  startDate: currentRange?.from,    // ✅ AGREGAR
  endDate: currentRange?.to         // ✅ AGREGAR
})
```

## Verificación
El hook ya soporta estos parámetros (ver `use-equilibrium.ts` líneas 40-49):
```typescript
interface UseEquilibriumOptions {
  clinicId?: string
  startDate?: string    // ← Ya existe
  endDate?: string      // ← Ya existe
}
```

## Acceptance Criteria
- [ ] `useEquilibrium` recibe `startDate` y `endDate` desde `currentRange`
- [ ] Break-Even Progress cambia cuando se cambia el filtro de fecha
- [ ] No hay errores en consola
- [ ] `npm run typecheck` pasa

## Testing
1. Ir a Dashboard
2. Seleccionar "Esta semana"
3. Verificar que Break-Even muestra datos de esta semana
4. Seleccionar "Este mes"
5. Verificar que Break-Even muestra datos del mes

## Dependencias
Ninguna - es un cambio aislado de una línea.
