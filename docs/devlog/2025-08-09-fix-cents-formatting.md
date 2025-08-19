# Fix currency formatting to use cents consistently

## Context
Queríamos alinear la UI con la regla de negocio: todo el dinero se maneja en centavos enteros. Algunas vistas dividían entre 100 antes de formatear, mostrando montos 100x menores.

## Problem
`services/page.tsx` y `tariffs/page.tsx` estaban pasando valores en pesos a `formatCurrency`, que espera centavos. Esto generaba inconsistencias visuales y potencial confusión de usuarios.

## Root cause
Conversión doble: los cálculos ya producen centavos, pero la UI dividía entre 100 antes de llamar a `formatCurrency`.

## What changed
- `web/app/services/page.tsx`: 
  - `costSummary` ahora guarda centavos, no pesos.
  - En líneas de receta, el subtotal por insumo usa centavos con `Math.round(qty * costPerPortion(...))`.
- `web/app/tariffs/page.tsx`: 
  - Columnas de costos y precios pasan centavos directamente a `formatCurrency`.
  - Resumen min/max usa centavos directamente.

## Files touched
- `web/app/services/page.tsx`: corregir formateo de montos y estado en centavos.
- `web/app/tariffs/page.tsx`: corregir formateo de montos.

## Before vs After
```tsx
// Antes
formatCurrency(totalCents / 100)

// Después
formatCurrency(totalCents)
```

```tsx
// Antes
setCostSummary({ baseCost: baseCostCents / 100, ... })

// Después
setCostSummary({ baseCost: baseCostCents, ... })
```

## How to test
- Cargar `/services` y agregar receta con cantidades decimales; verificar que los subtotales de línea y el resumen coinciden con los centavos esperados.
- Cargar `/tariffs` y verificar que costos fijos/variables/total y precios no se ven 100x más bajos.

## Risks and rollback
- Riesgo bajo: solo cambia display y estado local en páginas. Si algo falla, revertir los dos archivos modificados.

## Follow ups
- Auditar otras páginas para asegurar que no dividan por 100 antes de formatear.















