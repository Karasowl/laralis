# Dashboard Mega Refactor - Resumen de Análisis

**Fecha**: 2025-12-09
**Task**: TASK-20251209-dashboard-mega-refactor
**Agentes utilizados**: 8

---

## Resumen Ejecutivo

Se analizaron **45+ issues** en el Dashboard y módulos relacionados mediante 8 agentes especializados trabajando en paralelo. Este documento consolida los hallazgos críticos y proporciona un plan de implementación priorizado.

---

## 🔴 PROBLEMAS CRÍTICOS (P0)

### 1. Filtros de Fecha NO Funcionan Correctamente

**Agente**: Flujo de filtros de fecha
**Hallazgo principal**: El `useDateFilter` funciona correctamente, pero NO TODOS los hooks lo consumen.

| Hook | Recibe fechas | Usa fechas | Estado |
|------|--------------|------------|--------|
| `useDashboard` | ✅ | ✅ | OK |
| `useReports` | ✅ | ✅ | OK |
| `useServiceROI` | ✅ | ✅ | OK |
| `useProfitAnalysis` | ✅ | ✅ | OK |
| `usePlannedVsActual` | ✅ | ✅ | OK |
| `useEquilibrium` | ❌ | ❌ | **ROTO** |
| `useCACTrend` | ❌ | ❌ | **ROTO** |
| `useAcquisitionTrends` | ❌ | ❌ | **ROTO** |

**Fix inmediato** (`page.tsx` línea 172):
```typescript
// ANTES
useEquilibrium({ clinicId: currentClinic?.id })

// DESPUÉS
useEquilibrium({
  clinicId: currentClinic?.id,
  startDate: currentRange?.from,
  endDate: currentRange?.to
})
```

**"Pacientes Activos" siempre igual**:
- Causa: `/api/dashboard/patients` línea 36-40 NO filtra por fecha para `total`
- Solo `new` respeta el filtro

---

### 2. CAC Siempre en Cero

**Agente**: Marketing Metrics
**Causa raíz**: Timing issue - `currentClinic?.id` es `undefined` cuando el hook se monta.

**Ubicación**: `use-marketing-metrics.ts` línea 50-66
```typescript
const endpoint = clinicId
  ? `/api/analytics/marketing-metrics?${params.toString()}`
  : null  // ← Si clinicId undefined, no hace fetch
```

**Fix**:
```typescript
const { currentClinic } = useCurrentClinic()
const clinicId = options.clinicId || currentClinic?.id  // Fallback
```

---

### 3. Tooltips de Info No Funcionan

**Agente**: Marketing Metrics
**Causa**: `TooltipProvider` se repite 4 veces dentro del componente.

**Ubicación**: `MarketingMetrics.tsx` líneas 72-140

**Fix**: Mover `TooltipProvider` FUERA, una sola vez:
```typescript
export function MarketingMetrics(...) {
  return (
    <TooltipProvider>  {/* UNA VEZ */}
      <div className="grid ...">
        {/* Cards sin TooltipProvider individual */}
      </div>
    </TooltipProvider>
  )
}
```

---

### 4. Lara Dice "22 días" en vez de "20 días"

**Agente**: Lara AI context
**Causa**: Campo incorrecto en el prompt - usa `work_days_per_month` que NO existe.

**Ubicación**: `ClinicSnapshotService.ts` línea 216
```typescript
// INCORRECTO
${clinic.time_settings?.work_days_per_month || 22} days/month

// CORRECTO
${clinic.time_settings?.work_days || 20} days/month
```

---

## 🟡 PROBLEMAS IMPORTANTES (P1)

### 5. UI/UX Mobile - 8 Issues

**Agente**: UI/UX Designer
**Documento creado**: `docs/design/2025-12-09-dashboard-mobile-redesign.md`

| Problema | Severidad | Tiempo |
|----------|-----------|--------|
| DateFilterBar iconos solapados | Media | 15 min |
| Espacio excesivo header-tarjetas | Media | 10 min |
| Botón "Actualizar" mal posicionado | Baja | 5 min |
| CategoryBreakdown texto superpuesto | Alta | 30 min |
| RecentActivity sin colapsar | Media | 1 hora |
| MetricCards inconsistentes | Media | 1 hora |
| Eliminar botón Actualizar | Baja | 5 min |

---

### 6. Métricas Financieras Sin Explicación

**Agente**: Cálculos financieros
**Hallazgo**: Las fórmulas son **100% correctas**, pero el usuario no las entiende.

**Fórmulas verificadas**:
- Utilidad Bruta = Revenue - Variable Costs ✅
- EBITDA = Operating Profit + Depreciation ✅
- Net Profit = Operating Profit (simplificado) ✅
- ROI = (Profit / Cost) × 100 ✅

**Problema**: ROI de 711% es matemáticamente correcto para servicios con costos bajísimos (ej: consulta diagnóstica con $100 de costo y $4,900 de ganancia).

**Solución**: Agregar tooltips con desglose de cálculo.

---

### 7. Módulo de Gastos - Archivo Monolítico

**Agente**: Módulo de Gastos
**Problema**: `expenses/page.tsx` tiene 1,233 líneas (límite: 400)

**Refactorización propuesta**:
```
app/expenses/
├── page.tsx (150 líneas)
├── components/
│   ├── ExpenseFormModal.tsx (200 líneas)
│   ├── ExpensesFilterBar.tsx (150 líneas) ← Usar SmartFilters
│   ├── ExpensesSummary.tsx (100 líneas)
│   └── ExpenseAlerts.tsx (200 líneas)
```

**Otros issues en Gastos**:
- Filtros obsoletos (no usan SmartFilters)
- Gastos recurrentes sin cron job
- MXN hardcodeado
- Sin vinculación con `fixed_costs`

---

### 8. Meta Mensual No Configurable

**Agente**: Break-Even configurable
**Estado actual**: Solo muestra punto de equilibrio, no meta personalizada.

**Solución propuesta**:
1. Agregar `monthly_goal_cents` a `settings_time`
2. Actualizar `BreakEvenProgress.tsx` con dos marcadores
3. Agregar slider en configuración de tiempo

**Migración SQL**:
```sql
ALTER TABLE settings_time
ADD COLUMN monthly_goal_cents bigint DEFAULT NULL;
```

---

## 🔵 MEJORAS (P2)

### 9. API Sin Cache - Datos Se Recargan

**Agente**: API caching
**Hallazgo**: Existen hooks SWR (`useSwrCrud`, `useSwrApi`) pero **NO SE USAN**.

**Estado actual**:
- `useCrudOperations` → Sin cache, siempre fetch
- `useSwrCrud` → Con cache SWR, **NUNCA usado**

**Fix**: Migrar hooks de dominio de `useCrudOperations` a `useSwrCrud`:
```typescript
// ANTES
const crud = useCrudOperations<Patient>({ endpoint: '/api/patients' })

// DESPUÉS (API compatible)
const crud = useSwrCrud<Patient>({ endpoint: '/api/patients' })
```

---

## Plan de Implementación

### Sprint 1: Quick Wins (2-3 horas)
1. ✅ Pasar fechas a `useEquilibrium` en `page.tsx`
2. ✅ Corregir campo `work_days_per_month` → `work_days` en Lara
3. ✅ Mover `TooltipProvider` fuera en `MarketingMetrics.tsx`
4. ✅ Agregar fallback a `currentClinic` en hooks de marketing
5. ✅ Eliminar botón "Actualizar" del dashboard

### Sprint 2: UI/UX Mobile (3-4 horas)
6. Corregir DateFilterBar iconos
7. Reducir espacio header-tarjetas
8. Colapsar RecentActivity por defecto
9. Arreglar CategoryBreakdown en mobile

### Sprint 3: Features (1-2 días)
10. Meta mensual configurable (migración + UI)
11. Tooltips explicativos en métricas financieras
12. Migrar a `useSwrCrud` para cache

### Sprint 4: Refactoring (2-3 días)
13. Dividir `expenses/page.tsx` en componentes
14. Implementar gastos recurrentes con cron
15. Agregar vinculación expenses ↔ fixed_costs

---

## Archivos Críticos

| Archivo | Problema | Acción |
|---------|----------|--------|
| `web/app/page.tsx` | Hooks sin fechas | Pasar `currentRange` |
| `web/hooks/use-equilibrium.ts` | No recibe fechas | Ya soporta, solo pasar |
| `web/components/dashboard/marketing/MarketingMetrics.tsx` | TooltipProvider múltiple | Refactorizar |
| `web/lib/ai/ClinicSnapshotService.ts` | Campo incorrecto | Cambiar `work_days_per_month` |
| `web/lib/ai/prompts/query-prompt.ts` | Campo incorrecto | Mismo fix |
| `web/app/expenses/page.tsx` | 1,233 líneas | Dividir en componentes |
| `web/components/dashboard/BreakEvenProgress.tsx` | Sin meta configurable | Agregar marcadores |

---

## Dependencias de Migraciones

1. **Meta mensual**: Requiere migración SQL para `monthly_goal_cents`
2. **Gastos recurrentes**: Requiere campos adicionales en `expenses`
3. **Divisa configurable**: Requiere campo en `clinics` o `settings`

---

## Métricas de Éxito

- [ ] Todos los filtros de fecha funcionan en Dashboard
- [ ] CAC muestra valores reales (no cero)
- [ ] Tooltips de info funcionan en mobile y desktop
- [ ] Lara usa días de trabajo correctos
- [ ] Meta mensual configurable independiente de BE
- [ ] Navegación entre módulos sin recargar datos
- [ ] `expenses/page.tsx` < 400 líneas

---

**Última actualización**: 2025-12-09
