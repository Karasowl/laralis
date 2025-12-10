---
id: ISSUE-011
title: Espacio excesivo entre header y tarjetas en mobile
status: open
priority: P2
area: ui
estimate: XS (10 min)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Espacio excesivo entre header y tarjetas en mobile

## Problema
En mobile hay demasiado espacio vertical entre "Dashboard / Panel de control" y las primeras tarjetas de métricas.

## Causa Raíz
- `PageHeader` tiene `pb-8` fijo
- Container tiene `space-y-6`
- Total: ~56px de espacio en mobile

**Ubicación**: `web/app/page.tsx` línea 296

```typescript
<div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
```

Y `PageHeader` (componente) tiene padding fijo.

## Solución
Usar clases responsive:

```typescript
// page.tsx
<div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
//                                              ^^^^^^^^ 16px en mobile, 24px en tablet+
```

Y en `PageHeader` (si tiene padding hardcodeado):
```typescript
// PageHeader.tsx
<header className="pb-4 sm:pb-6 lg:pb-8">
//                ^^^^^^^^^^^^^^^^ Responsive padding
```

## Acceptance Criteria
- [ ] Menos espacio entre header y tarjetas en mobile
- [ ] Spacing normal en tablet/desktop
- [ ] No afecta otros usos de PageHeader
- [ ] `npm run typecheck` pasa

## Testing
1. Abrir Dashboard en mobile (o DevTools responsive)
2. Verificar que el espacio entre header y tarjetas es razonable
3. Verificar que en desktop el espacio es el mismo que antes

## Archivos a Modificar
1. `web/app/page.tsx`
2. `web/components/ui/PageHeader.tsx` (si necesario)
