---
id: ISSUE-010
title: DateFilterBar - Iconos solapados en modo personalizado (mobile)
status: open
priority: P1
area: ui
estimate: XS (15 min)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# DateFilterBar - Iconos solapados en modo personalizado (mobile)

## Problema
Al seleccionar "Personalizado" en el filtro de fechas del Dashboard, los iconos de calendario del browser se solapan con el texto de la fecha en dispositivos móviles.

## Causa Raíz
El `padding-right` del input date es insuficiente para el icono nativo del browser.

**Ubicación**: `web/components/dashboard/DateFilterBar.tsx` líneas 114-119

```typescript
<input
  type="date"
  className="w-full h-9 px-3 rounded-md border ..."
  //              ^^^^ px-3 insuficiente para el icono
```

## Solución

```typescript
<input
  type="date"
  className="w-full h-10 px-3 pr-10 rounded-md border ..."
  //              ^^^^ h-10 para touch target 44px
  //                   ^^^^^ pr-10 para el icono
```

## Acceptance Criteria
- [ ] Fecha visible sin solapamiento con icono
- [ ] Touch target de 44px (h-10)
- [ ] Funciona en iOS Safari y Android Chrome
- [ ] `npm run typecheck` pasa

## Testing
1. Ir a Dashboard en mobile
2. Seleccionar "Personalizado"
3. Verificar que las fechas se leen correctamente
4. Verificar que el icono del calendario no tapa el texto

## Archivos a Modificar
1. `web/components/dashboard/DateFilterBar.tsx`
