---
id: ISSUE-007
title: Tooltips de info no funcionan en MarketingMetrics
status: open
priority: P1
area: ui
estimate: XS (15 min)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Tooltips de info no funcionan en MarketingMetrics

## Problema
Los iconos de información (i) al lado de CAC, LTV, Ratio y Tasa de Conversión no muestran tooltip al hacer hover/click. En mobile no responden al toque.

## Causa Raíz
`TooltipProvider` se repite 4 veces DENTRO del componente, una por cada tarjeta.

**Ubicación**: `web/components/dashboard/marketing/MarketingMetrics.tsx` líneas 72-140

```typescript
{/* CAC Card */}
<Card>
  <TooltipProvider>  {/* Provider 1 */}
    <Tooltip>...</Tooltip>
  </TooltipProvider>
</Card>

{/* LTV Card */}
<Card>
  <TooltipProvider>  {/* Provider 2 - PROBLEMA */}
    <Tooltip>...</Tooltip>
  </TooltipProvider>
</Card>

// ... se repite 4 veces
```

**Problemas**:
- Ineficiencia (4 providers)
- Posibles conflictos de contexto Radix UI
- Provider no envuelve correctamente el árbol

## Solución
Mover `TooltipProvider` FUERA, una sola vez:

```typescript
export function MarketingMetrics({ cac, ltv, conversionRate, loading }) {
  return (
    <TooltipProvider>  {/* UNA VEZ aquí */}
      <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4">
        {/* CAC Card */}
        <Card>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('cac_tooltip')}</p>
            </TooltipContent>
          </Tooltip>
        </Card>

        {/* LTV Card - SIN TooltipProvider */}
        <Card>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('ltv_tooltip')}</p>
            </TooltipContent>
          </Tooltip>
        </Card>

        {/* ... resto igual, sin TooltipProvider individual */}
      </div>
    </TooltipProvider>
  )
}
```

## Acceptance Criteria
- [ ] Tooltips funcionan en desktop (hover)
- [ ] Tooltips funcionan en mobile (tap)
- [ ] Solo hay UN TooltipProvider en el componente
- [ ] Contenido de tooltips se muestra correctamente
- [ ] `npm run typecheck` pasa

## Testing
1. Ir a Dashboard → tab Marketing
2. Hover sobre icono (i) de CAC → debe mostrar tooltip
3. En mobile: tap sobre icono → debe mostrar tooltip
4. Verificar que el texto del tooltip es correcto

## Archivos a Modificar
1. `web/components/dashboard/marketing/MarketingMetrics.tsx`
