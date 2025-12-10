---
id: ISSUE-022
title: "K" en gráficos confunde (10K parece 1 millón)
status: open
priority: P2
area: ui
estimate: XS (30 min)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# "K" en gráficos confunde (10K parece 1 millón)

## Problema
En los gráficos del dashboard, los valores grandes se abrevian con "K" (miles). Pero en español/México, "K" no es común y puede confundirse:
- 10K → ¿10 mil o 10 millones?
- El usuario esperaría ver "10 mil" o "$10,000"

## Ubicación
Probablemente en configuración de Recharts:
- `web/components/dashboard/charts/*.tsx`
- O en utils de formateo compartidos

## Solución

### Opción A: Mostrar valores completos (Recomendado para México)

```typescript
// Usar formatCurrency sin abreviación
tickFormatter={(value) => formatCurrency(value * 100)}
// Resultado: $10,000
```

### Opción B: Abreviación localizada

```typescript
function formatCompact(cents: number, locale: string) {
  const value = cents / 100

  if (locale.startsWith('es')) {
    // Español: usar "mil" y "M" (millón)
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)} mil`
    }
    return `$${value.toFixed(0)}`
  }

  // Inglés: usar K y M
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`
  }
  return `$${value.toFixed(0)}`
}
```

### Opción C: Tooltip con valor completo

Mantener abreviación en eje pero mostrar valor completo en tooltip:
```typescript
<Tooltip
  formatter={(value) => formatCurrency(value * 100)}
/>
```

## Acceptance Criteria
- [ ] Valores en gráficos son claramente entendibles
- [ ] Usuarios mexicanos no confunden K con millones
- [ ] Tooltips muestran valor exacto
- [ ] Consistente en todos los gráficos
- [ ] `npm run typecheck` pasa

## Testing
1. Ver gráfico con valores > $10,000
2. Verificar que la abreviación es clara
3. Hover sobre barra → tooltip muestra valor exacto

## Archivos a Modificar
1. Buscar archivos con `tickFormatter` o formateo de ejes
2. `web/lib/money.ts` (agregar `formatCompact`)
