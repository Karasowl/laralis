# Fix Duplicate Routes - 2025-08-09

**TASK**: Resolver conflicto de rutas duplicadas
**PR**: N/A (fix directo)

## Contexto
Next.js usa Route Groups con paréntesis `(setup)` para organización, pero estas no afectan las URLs. Esto causó conflictos con rutas duplicadas para `/supplies` y `/services`.

## Problema
- Existían rutas duplicadas:
  - `app/(setup)/supplies/page.tsx` → `/supplies`
  - `app/supplies/page.tsx` → `/supplies`
  - Lo mismo para `/services`
- Next.js no puede resolver qué componente usar

## Causa raíz
Los Route Groups entre paréntesis son solo para organización del código y no cambian las URLs finales. Ambos archivos resuelven a la misma ruta.

## Qué cambió
1. **Consolidación de rutas**:
   - Mantuve solo `app/supplies/page.tsx` y `app/services/page.tsx`
   - Moví `app/(setup)/time` → `app/time`
   - Moví `app/(setup)/fixed-costs` → `app/fixed-costs`
   - Eliminé el directorio `(setup)` completamente

2. **Actualización de navegación**:
   - Cambié enlaces de `/setup/time` a `/time`
   - Agregué enlace directo a `/fixed-costs`

3. **Agregué funciones legacy para compatibilidad**:
   - `calcularPrecioFinal` en `lib/calc/tarifa.ts`
   - `redondearA` en `lib/money.ts`
   - `calcularCostoVariable` en `lib/calc/variable.ts`

## Archivos tocados
- `app/layout.tsx` - actualizada navegación
- `app/time/page.tsx` - movido de (setup)
- `app/fixed-costs/page.tsx` - movido de (setup)
- `app/services/page.tsx` - corregido llamada a calculateTimeCosts
- `app/api/services/route.ts` - corregido conflicto de nombres de variable
- `lib/calc/tarifa.ts` - agregada función legacy
- `lib/money.ts` - agregada función legacy
- `lib/calc/variable.ts` - agregada función legacy
- Eliminado: `app/(setup)/` y subdirectorios

## Antes vs Después
**Antes**: 
- Rutas duplicadas causaban conflicto
- Estructura con `(setup)` innecesaria

**Después**:
- Una sola ruta por página
- Estructura plana más simple
- TypeScript compila sin errores
- Dev server funciona correctamente

## Cómo probar
```bash
cd web
npx tsc --noEmit  # Sin errores
npm run dev        # Servidor corre en puerto 3001
```
- Navegar a `/time`, `/fixed-costs`, `/supplies`, `/services`
- Verificar que todas las páginas cargan correctamente

## Riesgos y rollback
- Riesgo mínimo, solo reorganización de archivos
- Rollback: restaurar estructura anterior con `(setup)`

## Siguientes pasos
- N/A - Fix completado