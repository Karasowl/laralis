# Issues Index - Dashboard Mega-Refactor

Este directorio contiene issues desglosados del task `TASK-20251209-dashboard-mega-refactor`.

## Quick Stats
- **Total Issues**: 23
- **Resueltos**: 23 ✅ (100%) 🎉
- **P0 (Críticos)**: 5/5 resueltos ✅
- **P1 (Importantes)**: 9/9 resueltos ✅
- **P2 (Mejoras)**: 7/7 resueltos ✅
- **P3 (Futuro)**: 2/2 resueltos ✅

---

## Por Prioridad

### P0 - Críticos (Bloquean uso normal) - ✅ TODOS RESUELTOS

| ID | Issue | Estado | Notas |
|----|-------|--------|-------|
| [001](ISSUE-001-filters-equilibrium.md) | useEquilibrium no recibe filtros de fecha | ✅ RESUELTO | Ya soporta startDate/endDate |
| [004](ISSUE-004-patients-total-filter.md) | Pacientes activos no respeta filtro | ✅ RESUELTO | API ya filtra por fechas |
| [005](ISSUE-005-cac-zero.md) | CAC siempre muestra cero | ✅ CORRECTO | CAC=0 cuando no hay gastos marketing |
| [006](ISSUE-006-campaign-roi-empty.md) | CampaignROI vacío con campañas | ✅ RESUELTO | Hook ya espera clinicId |
| [008](ISSUE-008-lara-work-days.md) | Lara dice 22 días (campo inexistente) | ✅ RESUELTO | Usa work_days correctamente |

### P1 - Importantes (Afectan UX significativamente)

| ID | Issue | Estado | Notas |
|----|-------|--------|-------|
| [002](ISSUE-002-filters-cac-trend.md) | useCACTrend no soporta fechas | ✅ RESUELTO | Ya soporta startDate/endDate |
| [003](ISSUE-003-filters-acquisition-trends.md) | useAcquisitionTrends no soporta fechas | ✅ RESUELTO | Ya soporta startDate/endDate |
| [007](ISSUE-007-tooltips-broken.md) | Tooltips de info no funcionan | ✅ RESUELTO | Cada componente tiene TooltipProvider |
| [010](ISSUE-010-mobile-datefilter.md) | DateFilter iconos solapados mobile | ✅ RESUELTO | Ya tiene h-10 y pr-10 |
| [012](ISSUE-012-recent-activity-collapse.md) | RecentActivity colapsada por defecto | ✅ RESUELTO | defaultCollapsed=true |
| [013](ISSUE-013-category-breakdown-mobile.md) | CategoryBreakdown texto superpuesto | ✅ ARREGLADO | Legend con truncate y mejor layout |
| [014](ISSUE-014-metric-tooltips.md) | Tooltips explicativos métricas | ✅ IMPLEMENTADO | MetricTooltip + traducciones |
| [015](ISSUE-015-monthly-goal-config.md) | Meta mensual configurable | ✅ IMPLEMENTADO | En TimeSettingsForm |
| [017](ISSUE-017-expenses-refactor.md) | Refactorizar expenses (1233 líneas) | ✅ REFACTORIZADO | 8 archivos, page.tsx=344 líneas |

### P2 - Mejoras (Nice to have)

| ID | Issue | Estado | Notas |
|----|-------|--------|-------|
| [009](ISSUE-009-remove-refresh-button.md) | Eliminar botón Actualizar | ✅ RESUELTO | No existe botón innecesario |
| [011](ISSUE-011-mobile-header-spacing.md) | Header spacing mobile | ✅ RESUELTO | Ya tiene clases responsive |
| [016](ISSUE-016-migrate-swr-cache.md) | Migrar a SWR cache | ✅ IMPLEMENTADO | Hooks usan useSwrCrud |
| [018](ISSUE-018-expenses-smart-filters.md) | SmartFilters en gastos | ✅ IMPLEMENTADO | ExpenseSmartFilters.tsx |
| [019](ISSUE-019-expenses-link-planned.md) | Vincular gastos con planificados | ✅ IMPLEMENTADO | DB + UI + traducciones |
| [020](ISSUE-020-recurring-expenses-cron.md) | Cron gastos recurrentes | ✅ IMPLEMENTADO | /api/cron/recurring-expenses |
| [022](ISSUE-022-k-abbreviation.md) | K en gráficos confunde | ✅ RESUELTO | Usa "mil" en español, "K" en inglés |

### P3 - Futuro

| ID | Issue | Estado | Notas |
|----|-------|--------|-------|
| [021](ISSUE-021-currency-config.md) | Configuración de moneda | ✅ IMPLEMENTADO | Hook useClinicCurrency + 8 monedas |
| [023](ISSUE-023-predictions-not-implemented.md) | Predicciones de ingreso | ✅ IMPLEMENTADO | API + lib/calc/predictions.ts |

---

## Resumen de Issues Pendientes (0 restantes)

✅ **TODAS LAS ISSUES COMPLETADAS**

### Última sesión (2025-12-11):
- **ISSUE-021** (uso de hook) - Migración completada en componentes de dashboard:
  - `MarketingMetrics.tsx` → `useClinicCurrency`
  - `CACTrendChart.tsx` → `useClinicCurrency`
  - `ChannelROIChart.tsx` → `useClinicCurrency`
  - `CategoryBreakdown.tsx` → `useClinicCurrency`

### ✅ Completados en esta sesión:
- ISSUE-016: SWR cache implementado
- ISSUE-018: SmartFilters implementado
- ISSUE-019: Vincular gastos completo (DB + UI)
- ISSUE-020: Cron recurrentes implementado
- ISSUE-021: Hook de moneda + migración
- ISSUE-023: Predicciones con regresión lineal

---

## Leyenda

**Estados:**
- ✅ RESUELTO - Issue verificado como funcionando correctamente
- ✅ ARREGLADO - Issue que requirió cambios de código
- ✅ CORRECTO - Comportamiento es el esperado (no era bug)
- 🔲 PENDIENTE - Aún por implementar

**Estimados:**
- XS: <30 min
- S: 30 min - 2 horas
- M: 2-4 horas
- L: 4-8 horas

---

Última actualización: 2025-12-11 (23/23 completados) 🎉
