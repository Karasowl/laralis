# Active Tasks

## En Progreso

- [ ] TASK-20260205-refactor-cleanup-phase-1 - Baseline + guardrails + normalización inicial API
  - **Priority**: P1
  - **Estimate**: M
  - **Status**:
    - ✅ Baseline de métricas (`web/scripts/refactor-metrics.mjs`)
    - ✅ CI mínima y PR template
    - ✅ Toolkit API (`web/lib/api/*`) + adopción inicial en `services`, `patients` y módulo `expenses` (`route`, `[id]`, `stats`, `alerts`)
    - ✅ Estabilización de `useExpenses` para compatibilidad con consumidores actuales
    - ✅ Limpieza de temporales/duplicados críticos
    - ⏳ Pendiente: migración por olas de rutas restantes y división de archivos > 400 líneas

- [x] **TASK-20251209-dashboard-mega-refactor** - Dashboard Mega Refactor (P0 - CRÍTICO) ✅ COMPLETADO
  - **Priority**: P0 - Crítico
  - **Estimate**: XL (1+ semana)
  - **Areas**: ui, data, calc, i18n
  - **Status**: ✅ 23/23 issues resueltos (100%) 🎉
  - **Issues**: Ver `tasks/issues/README.md` para índice completo

  **✅ P0 Completados** (Todos):
    - ISSUE-001: ✅ useEquilibrium ya soporta fechas
    - ISSUE-004: ✅ Pacientes activos ya filtra por fechas
    - ISSUE-005: ✅ CAC=0 es correcto cuando no hay gastos marketing
    - ISSUE-006: ✅ CampaignROI ya espera clinicId
    - ISSUE-008: ✅ Lara usa work_days correctamente

  **✅ P1 Completados** (Todos):
    - ISSUE-002: ✅ useCACTrend ya soporta fechas
    - ISSUE-003: ✅ useAcquisitionTrends ya soporta fechas
    - ISSUE-007: ✅ Tooltips funcionan (TooltipProvider en componentes)
    - ISSUE-010: ✅ DateFilter ya tiene h-10 pr-10 para mobile
    - ISSUE-012: ✅ RecentActivity defaultCollapsed=true
    - ISSUE-013: ✅ CategoryBreakdown arreglado (Legend con truncate)
    - ISSUE-014: ✅ MetricTooltip implementado con traducciones
    - ISSUE-015: ✅ Meta mensual ya implementada en TimeSettingsForm
    - ISSUE-017: ✅ Expenses refactorizado (8 archivos, page=344 líneas)

  **✅ P2 Completados** (7/7):
    - ISSUE-009: ✅ No hay botón Actualizar innecesario
    - ISSUE-011: ✅ Header ya tiene clases responsive
    - ISSUE-016: ✅ Hooks usan useSwrCrud
    - ISSUE-018: ✅ ExpenseSmartFilters implementado
    - ISSUE-019: ✅ Vincular gastos (DB + UI completo)
    - ISSUE-020: ✅ Cron /api/cron/recurring-expenses
    - ISSUE-022: ✅ Usa "mil" en español, "K" en inglés

  **✅ P3 Completados** (2/2):
    - ISSUE-021: ✅ useClinicCurrency + migración (8 monedas)
    - ISSUE-023: ✅ Predicciones con regresión lineal

  **✅ Adopción de useClinicCurrency completada:**
    - MarketingMetrics.tsx, CACTrendChart.tsx, ChannelROIChart.tsx, CategoryBreakdown.tsx

  - Ver: `tasks/TASK-20251209-dashboard-mega-refactor.md`
  - Ver: `docs/design/2025-12-09-dashboard-analysis-summary.md`

- [x] TASK-20251127-google-calendar-integration - Integrar Google Calendar con tratamientos pendientes ✅ COMPLETADO
  - **Priority**: P2
  - **Estimate**: L (3-4 días)
  - **Status**: ✅ Todos los subtasks implementados
  - **Subtasks completados**:
    1. ✅ `treatment_time` en formulario de tratamientos
    2. ✅ Migración SQL `52_create_clinic_google_calendar.sql`, `53_add_google_event_id`
    3. ✅ OAuth2 flow (`/api/auth/google-calendar/*`)
    4. ✅ Sincronización App → Google Calendar (`lib/google-calendar.ts`)
    5. ✅ Vista de calendario (`/treatments/calendar` con Month/Week/Day views)
    6. ✅ Settings page para conectar calendario
  - Ver: `tasks/TASK-20251127-google-calendar-integration.md`

- [x] TASK-20251021-marketing-categories - Implementar sistema de categorías de marketing para CAC ✅ COMPLETADO
  - **Priority**: P1 - Crítico
  - **Estimate**: L (2-3 días)
  - **Status**: ✅ Todos los subtasks implementados
  - **Subtasks completados**:
    1. ✅ Migración SQL `41_auto_create_clinic_categories.sql` con trigger
    2. ✅ Motor de cálculos `lib/calc/marketing.ts` con tests (100% coverage)
    3. ✅ Endpoints `/api/analytics/marketing-metrics`, `cac-trend`, `channel-roi`
    4. ✅ Dashboard usa datos reales con `useMarketingMetrics`
    5. ✅ `ExpenseForm.tsx` con categorías dinámicas
    6. ✅ Hooks `use-marketing-metrics.ts`, `use-marketing-roi.ts`
  - Ver: `tasks/TASK-20251021-marketing-categories.md`

- [ ] TASK-20250817-pr-template-upgrade - Alinear `docs/memories/PR.md` con memorias y reglas
  - Incorporar cadena de dependencias (Depreciación → Fijos → Tiempo → Equilibrio → Insumos → Servicios → Tarifas → Tratamientos)
  - Contexto multi-tenant (Workspaces/Clinics) y snapshots en tratamientos
  - Criterios de aceptación reforzados (i18n EN/ES, AA, Zod, dinero en centavos)
  - Gobernanza: sección Tasks/Devlog y i18n keys para navegación

## Completado Hoy - 2026-02-04

- [x] TASK-20260204-block-service-role-client - Bloquear supabaseAdmin en cliente ✅ COMPLETADO
  - **Priority**: P1
  - **Estimate**: XS
  - **Status**: Guard server-only aplicado en `supabaseAdmin`
  - Ver: `tasks/TASK-20260204-block-service-role-client.md`

- [x] TASK-20260204-security-headers - Agregar headers de seguridad en Next.js ✅ COMPLETADO
  - **Priority**: P1
  - **Estimate**: XS
  - **Status**: CSP + HSTS (prod) configurados en `next.config.mjs`
  - Ver: `tasks/TASK-20260204-security-headers.md`

- [x] TASK-20260204-api-zod-validation-phase-1 - Validar payloads API con Zod (fase 1) ✅ COMPLETADO
  - **Priority**: P1
  - **Estimate**: S
  - **Status**: Helper + endpoints críticos con validación
  - Ver: `tasks/TASK-20260204-api-zod-validation-phase-1.md`

- [x] TASK-20260204-api-zod-validation-phase-2-actions - Validar endpoints actions con Zod ✅ COMPLETADO
  - **Priority**: P1
  - **Estimate**: S
  - **Status**: Endpoints `api/actions/*` con validación
  - Ver: `tasks/TASK-20260204-api-zod-validation-phase-2-actions.md`

- [x] TASK-20260204-api-zod-validation-phase-3-remaining - Validar endpoints restantes con Zod ✅ COMPLETADO
  - **Priority**: P1
  - **Estimate**: M
  - **Status**: Endpoints restantes con validación
  - Ver: `tasks/TASK-20260204-api-zod-validation-phase-3-remaining.md`

- [x] TASK-20260204-api-zod-validation-phase-4-additional - Validar endpoints adicionales con Zod ✅ COMPLETADO
  - **Priority**: P1
  - **Estimate**: M
  - **Status**: Endpoints adicionales con parseo seguro
  - Ver: `tasks/TASK-20260204-api-zod-validation-phase-4-additional.md`

## Completado Hoy - 2025-08-09

- [x] TASK-20250809-fix-duplicate-routes - Resolver conflicto de rutas duplicadas
  - Movidas páginas de (setup) al directorio principal
  - Actualizada navegación en layout.tsx
  - Agregadas funciones legacy para compatibilidad
  - TypeScript y dev server funcionando correctamente

- [x] TASK-20250809-fix-supplies-types - Arreglar error de TypeScript en supplies
  - Agregado campo cost_per_portion_cents a Supply interface
  - Actualizada API route para calcular el campo
  - Corregidos tipos de columnas y formateo de moneda
  - TypeScript compila sin errores

- [x] TASK-20250809-supplies-crud - CRUD completo de insumos
  - Implementado crear, editar y eliminar con validación
  - Formulario con react-hook-form y zod
  - Categorías traducidas con i18n
  - Búsqueda con debounce de 300ms
  - Multi-tenant verificado
  - UI mejorada con Dialog y preview en vivo

## Próximo

Ver backlog.md para próximas tareas prioritarias.

## Nueva tarea

- [x] TASK-20250809-fix-cents-formatting - Alinear formateo de moneda en centavos
  - Corregido formateo en `web/app/services/page.tsx`
  - Corregido formateo en `web/app/tariffs/page.tsx`
  - Agregado devlog con contexto y pruebas manuales
