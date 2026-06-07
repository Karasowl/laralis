# Active Tasks

## En Progreso

- [x] TASK-20260607-convex-only-api-smoke-fixes - Smoke convex-only de los 58 GET: arreglar todo lo que aún apuntaba a Supabase ✅ COMPLETADO 2026-06-07
  - **Priority**: P1 | **Estimate**: M | **Area**: infra/data
  - **Status**: ✅ Smoke `convex-all-apis-smoke.cy.ts` pasa: 58/58 sin 5xx (51× 200, 7× 400 por params requeridos)
    - ✅ Auditoría multi-agente (ultracode) de los 58 GET; resuelta la contradicción del shim `createClient` → 10 hallazgos "auth_not_convex_aware" eran **falsos positivos**
    - ✅ 3 bugs reales (access-check `supabaseAdmin` inline antes de la rama Convex): `team/clinic-members`, `team/workspace-members`, `invitations` + helper compartido `userHasActiveWorkspaceMembershipFromConvex`
    - ✅ 2 falsos negativos cazados por el smoke real: `dashboard/supplies` (`createRouteHandlerClient` lanzaba) y `whatsapp-readiness` (`getWhatsAppConfig` leía `clinics`)
    - ✅ Verificación adversarial (4 agentes): parity `is_active === true` corregida; typecheck baseline (197), cero nuevos
  - Ver: `docs/devlog/2026-06-07-convex-only-api-smoke-fixes.md`

- [x] TASK-20260607-convex-write-lifecycle-core - Validar escrituras convex-only de las 10 entidades CRUD core ✅ COMPLETADO 2026-06-07
  - **Priority**: P1 | **Estimate**: M | **Area**: infra/data
  - **Status**: ✅ `convex-write-lifecycle.cy.ts` pasa 9/9 (crear→borrar end-to-end, footprint cero)
    - ✅ Auditoría (ultracode, 10 agentes): `brokenWritePaths: []` — las 10 entidades (patients, services, treatments, expenses, fixed_costs, supplies, assets, categories, patient_sources, settings_time) ya tienen ruta de escritura convex-only correcta (POST/PUT/DELETE escriben directo a Convex, sin Supabase)
    - ✅ Lifecycle ejecutado convex-only: fixed_costs/supplies/assets/categories/services/patients/expenses/treatments (FK real patient+service) crean y borran; patient_sources crea (POST-only); settings_time verificado estáticamente (su upsert mutaría config real)
    - ✅ El mirror NO salva escrituras (mirror post-write tras un write Supabase que falla primero) — solo la rama `shouldUseConvexOnlyWritePath` funciona convex-only
  - Ver: `docs/devlog/2026-06-07-convex-only-write-cutover.md`

- [x] TASK-20260607-convex-write-secondary-onboarding-team - Escrituras convex-only del cluster secundario (settings/features + onboarding/team/invitations) ✅ COMPLETADO 2026-06-07
  - **Priority**: P1 | **Estimate**: L | **Area**: infra/data
  - **Status**: ✅ 26 rutas de escritura con rama convex-only añadida; verificadas (smoke vivo + adversarial)
    - ✅ Auditoría (ultracode): 42/44 rutas secundarias rompían convex-only (el mirror no salva escrituras; falta rama `shouldUseConvexOnlyWritePath`)
    - ✅ Settings/features (12 rutas): clinics/[id], clinics/discount, settings/booking|notifications|preferences, marketing campaigns+platforms, prescriptions, medications → **feature smoke 4/4** (marketing/platforms, medications, campaigns, prescriptions crean+borran convex-only)
    - ✅ Onboarding/team/invitations (14 rutas): onboarding, workspaces (POST/PUT/DELETE + cascada), workspaces/[id]/clinics, workspaces/[id]/lifecycle, team/clinic-members(+[id]), team/workspace-members(+[id]), team/custom-roles/[id], invitations (POST/DELETE + resend/accept/reject) → multi-tabla replicado a Convex (workspace+clinic+membresías, seedClinicDefaultsInConvex, encoding de permission-maps)
    - ✅ **Verificación adversarial (5 agentes): 22/24 hallazgos PASS**; 2 bugs reales corregidos: workspace-create columnas default de Postgres (created_at/is_active), workspaces/[id] DELETE cascada de `marketing_campaign_status_history`
  - **Follow-up (siguiente fase)**: escrituras aún sin portar — `public/book`, `bookings/[id]`, `snapshots`(POST/DELETE/restore), `actions/*` (mutaciones IA), `ai/*` (persistencia de chat). Externos fuera de alcance: webhooks, google-calendar, export/import, MFA, push, account-delete.
  - Ver: `docs/devlog/2026-06-07-convex-only-write-cutover.md`

- [~] TASK-20260606-convex-decommission-bcde-a - Decomisión Supabase→Convex (Fases B/C/D/E + scaffold A)
  - **Priority**: P1
  - **Estimate**: XL
  - **Area**: infra/data
  - **Status**: ✅ B/C/D/E implementadas y verificadas (adversarial multi-agente); A scaffolded
    - ✅ D: discovery estática sin `information_schema`
    - ✅ B: `process_recurring_expenses` + `check_booking_slot_availability` portados (13 tests)
    - ✅ E: seed de clínica + `is_paid` (trigger 73) + recordatorios (trigger 61) en write-path convex (6 tests)
    - ✅ C: lectura Convex de blobs de snapshot (Convex-first + fallback Supabase)
    - ✅ A1: scaffold `@convex-dev/auth` (inerte, no desplegado) + seed reset-on-cutover
    - ✅ A3 wiring client/server: provider + layout + use-auth (login/logout) + identidad server (build-verified, 3/3 adversarial clean)
    - ✅ Gap convex-only cerrado: `treatments/[id]` PUT re-deriva is_paid + cancela recordatorios
    - ✅ Verificación adversarial (ultracode): 2 bugs de paridad corregidos (B/C/D/E) + A3 clean
  - **Todo flag-gated, default Supabase. Typecheck baseline (189, cero nuevos). `build:dental` exit 0.**
  - **Follow-ups (operador / Fase F)**:
    - [ ] TASK-20260606-convex-auth-cutover - A2 llaves JWT + middleware/matcher + OTP register/reset/verify + páginas + A5 testing (ver `docs/IMPORTANT/CONVEX-AUTH-CUTOVER-RUNBOOK.md`)
    - [ ] TASK-20260606-storage-blob-import - correr `import-convex-storage.mjs` antes de `DATA_READ_BACKEND_STORAGE=convex`
    - [ ] TASK-20260606-phase-F-write-cutover - flips `DATA_WRITE_MODE=convex` por dominio + decomisión del mirror + borrado de Supabase

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
