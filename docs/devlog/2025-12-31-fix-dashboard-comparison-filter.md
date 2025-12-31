# Fix Dashboard Comparison Filter

**Fecha**: 2025-12-31
**Tipo**: Bug Fix P1
**Área**: Dashboard, Filters
**Estado**: ✅ Completado

---

## Contexto

El filtro de "Comparación" (comparison: 'previous' | 'lastYear') existía en la UI del dashboard pero no afectaba los datos mostrados. Los usuarios podían seleccionar "Comparar con período anterior" o "Comparar con mismo período año anterior", pero las métricas no mostraban ninguna diferencia.

### Estado Anterior

- ✅ `useDateFilter` calculaba `previousRange` correctamente (líneas 128-167)
- ❌ `useDashboard` NO recibía ni usaba este valor
- ❌ No había llamadas API para el período anterior
- ❌ No había cálculo de cambios/deltas con período de comparación
- ❌ No había indicadores visuales de cambio en las métricas

---

## Problema

El sistema de comparación estaba incompleto:

1. **Falta de integración**: `useDashboard` no aceptaba parámetros de comparación
2. **No había fetching paralelo**: No se hacían llamadas API para el período anterior
3. **No había lógica de cálculo**: No se calculaban los cambios porcentuales entre períodos
4. **No había UI**: No existían componentes para mostrar los indicadores de cambio

---

## Causa Raíz

El feature de comparación se implementó parcialmente:
- El hook `useDateFilter` se construyó con soporte completo para comparación
- Pero `useDashboard` nunca se actualizó para consumir estos datos
- La UI mostraba los filtros pero no tenía forma de visualizar los resultados

---

## Qué Cambió

### 1. Hook `useDashboard` - Soporte de Comparación

**Archivo**: `web/hooks/use-dashboard.ts`

**Cambios**:
```typescript
// Interface actualizada
interface UseDashboardOptions {
  // ... existing fields
  previousFrom?: string
  previousTo?: string
  comparisonEnabled?: boolean
}

// Nuevo tipo exportado
export interface ComparisonData {
  revenue: { current: number; previous: number; change: number | null; trend: 'up' | 'down' | null }
  expenses: { ... }
  treatments: { ... }
  patients: { ... }
}

// State actualizado
interface DashboardState {
  // ... existing fields
  comparison: ComparisonData | null
}
```

**Lógica implementada**:
- Fetching paralelo de datos del período anterior cuando `comparisonEnabled = true`
- Cálculo automático de cambios porcentuales con redondeo a 1 decimal
- Determinación de tendencia (up/down) basada en el cambio
- Manejo de edge case cuando el período anterior tiene valor 0

### 2. Componente `ComparisonIndicator`

**Archivo**: `web/components/dashboard/ComparisonIndicator.tsx` (NUEVO)

**Propósito**: Mostrar indicadores de cambio visuales y consistentes

**Features**:
- Iconos de tendencia (TrendingUp/TrendingDown)
- Colores semánticos (verde = positivo, rojo = negativo)
- Soporte para `lowerIsBetter` (ej: gastos)
- Etiquetas contextuales ("vs período anterior", "vs año anterior")

### 3. Página Dashboard - Integración

**Archivo**: `web/app/page.tsx`

**Cambios**:
```typescript
// Determinar si comparison está activo
const comparisonEnabled = comparison !== 'none'

// Pasar parámetros a useDashboard
const { comparison: comparisonData, ... } = useDashboard({
  // ... existing params
  previousFrom: previousRange?.from,
  previousTo: previousRange?.to,
  comparisonEnabled
})

// Mostrar indicadores en MetricCards
{comparisonData?.revenue && (
  <ComparisonIndicator
    change={comparisonData.revenue.change}
    trend={comparisonData.revenue.trend}
    comparisonType={comparison === 'last-year' ? 'last-year' : 'previous'}
  />
)}
```

**UI mejorada**:
- Cada MetricCard envuelta en `<div className="space-y-2">`
- ComparisonIndicator renderizado condicionalmente debajo de cada card
- Indicadores solo aparecen cuando comparison !== 'none'

### 4. Fix de Type Safety

**Archivo**: `web/app/page.tsx`

**Problema**: TypeScript error - `'allTime'` no asignable a tipo de `period`

**Solución**:
```typescript
const dashboardPeriod = useMemo((): 'day' | 'week' | 'month' | 'year' | 'custom' => {
  if (filterPeriod === 'today') return 'day'
  if (filterPeriod === 'quarter' || filterPeriod === 'allTime') return 'custom'
  return filterPeriod as 'day' | 'week' | 'month' | 'year' | 'custom'
}, [filterPeriod])
```

---

## Archivos Tocados

### Nuevos
1. `web/components/dashboard/ComparisonIndicator.tsx` - Componente de indicadores

### Modificados
1. `web/hooks/use-dashboard.ts` - Lógica de comparación
2. `web/app/page.tsx` - Integración UI

### Traducciones
- ✅ Ya existían: `vs_previous_period`, `vs_previous_year` en `es.json` y `en.json`

---

## Antes vs Después

### Antes
```
┌─────────────────────────────────────┐
│ Filtro: Comparar con período anterior │  ← Visible pero no funcional
└─────────────────────────────────────┘

┌───────────────────┐
│ Ingresos          │
│ $25,000          │
│ ↑ 15%            │  ← Comparaba con datos antiguos (metrics.revenue.previous)
└───────────────────┘
```

### Después
```
┌─────────────────────────────────────┐
│ Filtro: Comparar con período anterior │  ← Funcional
└─────────────────────────────────────┘

┌───────────────────┐
│ Ingresos          │
│ $25,000          │
│ ↑ 15%            │  ← Usa datos base
├───────────────────┤
│ ↗ +8.3%          │  ← NUEVO: Indicador de comparación con período anterior
│ vs período anterior│
└───────────────────┘
```

---

## Cómo Probar

### Test 1: Comparación con Período Anterior
1. Ir a Dashboard
2. Seleccionar filtro "Mes actual"
3. Activar "Comparar con período anterior"
4. **Verificar**:
   - Indicadores de cambio aparecen debajo de cada métrica
   - Etiqueta dice "vs período anterior"
   - Porcentaje refleja cambio real (ej: +15.2%)
   - Tendencia correcta (↗ para aumento, ↘ para disminución)

### Test 2: Comparación con Año Anterior
1. Seleccionar "Mes actual"
2. Activar "Comparar con mismo período año anterior"
3. **Verificar**:
   - Etiqueta dice "vs año anterior"
   - Porcentaje compara con mismo mes del año pasado

### Test 3: Sin Comparación
1. Seleccionar "Sin comparar"
2. **Verificar**:
   - NO aparecen indicadores de comparación
   - Solo métricas base visibles

### Test 4: Colores Semánticos
1. Activar comparación
2. Buscar métrica con aumento (ej: Ingresos +15%)
3. **Verificar**: Color verde, icono ↗
4. Buscar métrica con disminución (ej: Gastos -10%)
5. **Verificar**: Color verde (lowerIsBetter), icono ↘

### Test 5: Edge Cases
1. Seleccionar período donde mes anterior no tiene datos
2. **Verificar**: Indicador muestra +100% o no se muestra
3. Seleccionar año anterior sin datos
4. **Verificar**: Manejo correcto de período vacío

---

## Riesgos y Rollback

### Riesgos Identificados
1. **Performance**: Se duplican las llamadas API cuando comparison está activo
   - **Mitigación**: Fetching paralelo, solo cuando `comparisonEnabled = true`

2. **Datos incorrectos**: Si el cálculo de `previousRange` está mal
   - **Mitigación**: `useDateFilter` ya probado extensivamente

3. **UI cluttered**: Demasiados indicadores pueden abrumar
   - **Mitigación**: Diseño limpio, solo cuando activo

### Plan de Rollback
```bash
# Revertir cambios
git revert <commit-hash>

# O manual:
# 1. Eliminar ComparisonIndicator.tsx
# 2. Remover parámetros de comparación en useDashboard
# 3. Restaurar MetricCards a versión sin wrappers
```

---

## Siguientes Pasos

### Mejoras Futuras (P2)
- [ ] Mostrar comparación en gráficos (línea de período anterior)
- [ ] Exportar comparaciones en reportes PDF
- [ ] Agregar comparación a otras pestañas (Profitability, Advanced)
- [ ] Tooltip con valores absolutos (actual vs anterior)

### Bugs Conocidos
- Ninguno identificado

### Monitoreo
- Verificar performance de endpoints de dashboard con comparison activo
- Revisar logs de errores en próximos 7 días

---

## Referencias

- Issue original: Dashboard comparison filter not working
- Relacionado: `useDateFilter` implementation (ya existente)
- Documentación: `docs/CODING-STANDARDS.md` - Componentización

---

**Última actualización**: 2025-12-31
**Autor**: Claude Code (Frontend Developer Agent)
