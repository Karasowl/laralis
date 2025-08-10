# Assets module with monthly depreciation integration

## Context
La hoja de referencia calcula un "Fondo de depreciación" mensual que se suma a los costos fijos. Necesitamos representar esto en la app para que el costo fijo por minuto sea correcto.

## Problem
No existía una manera estructurada de registrar equipos/inversiones y derivar su depreciación mensual para incluirla en costos fijos.

## Root cause
Falta la tabla `assets` y endpoints para sumar la depreciación mensual.

## What changed
- Migración `05_assets.sql`: nueva tabla `assets` multi-tenant.
- Tipos y Zod: `Asset`, `zAsset`, `zAssetForm`.
- API:
  - `GET/POST /api/assets`: listar y crear activos.
  - `GET /api/assets/summary`: devuelve `monthly_depreciation_cents` sumado.
- UI `web/app/assets/page.tsx`: CRUD mínimo de alta + tabla simple con depreciación mensual por activo y total.

## Files touched
- `supabase/migrations/05_assets.sql` — esquema de `assets`.
- `web/lib/types.ts` — interfaz `Asset`.
- `web/lib/zod.ts` — zod `zAsset`, `zAssetForm`.
- `web/app/api/assets/route.ts` — API CRUD básico (GET/POST).
- `web/app/api/assets/summary/route.ts` — suma de depreciación mensual.
- `web/app/assets/page.tsx` — UI de activos.

## Before vs After
```sql
-- Antes: sin activos

-- Después: tabla assets y resumen de depreciación mensual
select sum(round(purchase_price_cents / depreciation_months)) from assets where clinic_id = ?;
```

## How to test
1. Ejecutar migraciones en Supabase.
2. Abrir `/assets` y crear un activo: nombre, precio en MXN, meses.
3. Verificar que la tabla muestre la depreciación mensual y el total.
4. Consultar `/api/assets/summary` y confirmar `monthly_depreciation_cents` esperado.

## Risks and rollback
- Riesgo bajo. Nuevo módulo aislado. Revertir migración y borrar archivos si es necesario.

## Follow ups
- Integrar `monthly_depreciation_cents` al cálculo de costo fijo mensual efectivo:
  - En `time` al calcular `monthlyFixedCostsCents`, sumar total de `fixed_costs` + resumen de depreciación.
  - Exponer en UI de `time` el detalle.
- Añadir editar/eliminar en `/assets`.



