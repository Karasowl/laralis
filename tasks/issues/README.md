# Issues Index - Dashboard Mega-Refactor

Este directorio contiene issues desglosados del task `TASK-20251209-dashboard-mega-refactor`.

## Quick Stats
- **Total Issues**: 23
- **P0 (Críticos)**: 6
- **P1 (Importantes)**: 8
- **P2 (Mejoras)**: 7
- **P3 (Futuro)**: 2

---

## Por Prioridad

### P0 - Críticos (Bloquean uso normal)

| ID | Issue | Estimado | Área |
|----|-------|----------|------|
| [001](ISSUE-001-filters-equilibrium.md) | useEquilibrium no recibe filtros de fecha | XS | data |
| [004](ISSUE-004-patients-total-filter.md) | Pacientes activos no respeta filtro | S | data |
| [005](ISSUE-005-cac-zero.md) | CAC siempre muestra cero | XS | data |
| [006](ISSUE-006-campaign-roi-empty.md) | CampaignROI vacío con campañas | XS | data |
| [008](ISSUE-008-lara-work-days.md) | Lara dice 22 días (campo inexistente) | XS | ai |

### P1 - Importantes (Afectan UX significativamente)

| ID | Issue | Estimado | Área |
|----|-------|----------|------|
| [002](ISSUE-002-filters-cac-trend.md) | useCACTrend no soporta fechas | S | data |
| [003](ISSUE-003-filters-acquisition-trends.md) | useAcquisitionTrends no soporta fechas | S | data |
| [007](ISSUE-007-tooltips-broken.md) | Tooltips de info no funcionan | XS | ui |
| [010](ISSUE-010-mobile-datefilter.md) | DateFilter iconos solapados mobile | XS | ui |
| [012](ISSUE-012-recent-activity-collapse.md) | RecentActivity colapsada por defecto | S | ui |
| [013](ISSUE-013-category-breakdown-mobile.md) | CategoryBreakdown texto superpuesto | S | ui |
| [014](ISSUE-014-metric-tooltips.md) | Tooltips explicativos métricas | M | ui |
| [015](ISSUE-015-monthly-goal-config.md) | Meta mensual configurable | L | feature |
| [017](ISSUE-017-expenses-refactor.md) | Refactorizar expenses (1233 líneas) | L | refactor |

### P2 - Mejoras (Nice to have)

| ID | Issue | Estimado | Área |
|----|-------|----------|------|
| [009](ISSUE-009-remove-refresh-button.md) | Eliminar botón Actualizar | XS | ui |
| [011](ISSUE-011-mobile-header-spacing.md) | Header spacing mobile | XS | ui |
| [016](ISSUE-016-migrate-swr-cache.md) | Migrar a SWR cache | M | infra |
| [018](ISSUE-018-expenses-smart-filters.md) | SmartFilters en gastos | M | ui |
| [019](ISSUE-019-expenses-link-planned.md) | Vincular gastos con planificados | L | feature |
| [020](ISSUE-020-recurring-expenses-cron.md) | Cron gastos recurrentes | M | infra |
| [022](ISSUE-022-k-abbreviation.md) | K en gráficos confunde | XS | ui |

### P3 - Futuro

| ID | Issue | Estimado | Área |
|----|-------|----------|------|
| [021](ISSUE-021-currency-config.md) | Configuración de moneda | L | feature |
| [023](ISSUE-023-predictions-not-implemented.md) | Predicciones de ingreso | M | feature |

---

## Por Área

### Data (Filtros y cálculos)
- ISSUE-001, 002, 003, 004, 005, 006

### UI (Interfaz y UX)
- ISSUE-007, 009, 010, 011, 012, 013, 014, 018, 022

### AI (Lara)
- ISSUE-008

### Feature (Nuevas funcionalidades)
- ISSUE-015, 019, 021, 023

### Infra (Arquitectura)
- ISSUE-016, 020

### Refactor
- ISSUE-017

---

## Sprint Sugerido

### Sprint 1 - Quick Wins (2-3 horas)
```
ISSUE-001 (XS) → ISSUE-005 (XS) → ISSUE-006 (XS) → ISSUE-008 (XS) → ISSUE-007 (XS) → ISSUE-009 (XS)
```

### Sprint 2 - UI/UX Mobile (3-4 horas)
```
ISSUE-010 (XS) → ISSUE-011 (XS) → ISSUE-013 (S) → ISSUE-012 (S)
```

### Sprint 3 - Features Clave (1-2 días)
```
ISSUE-014 (M) → ISSUE-015 (L) → ISSUE-016 (M)
```

### Sprint 4 - Refactoring (2-3 días)
```
ISSUE-017 (L) → ISSUE-018 (M) → ISSUE-019 (L) → ISSUE-020 (M)
```

---

## Leyenda

**Estimados:**
- XS: <30 min
- S: 30 min - 2 horas
- M: 2-4 horas
- L: 4-8 horas

**Áreas:**
- data: Lógica de datos, APIs, filtros
- ui: Componentes visuales, UX
- ai: Asistente Lara
- feature: Nueva funcionalidad
- infra: Arquitectura, cache, cron
- refactor: Reorganización de código

---

Última actualización: 2025-12-09
