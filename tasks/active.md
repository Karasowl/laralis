# Active Tasks

## En Progreso

- [ ] **TASK-20251209-dashboard-mega-refactor** - Dashboard Mega Refactor (P0 - CRÍTICO)
  - **Priority**: P0 - Crítico
  - **Estimate**: XL (1+ semana)
  - **Areas**: ui, data, calc, i18n
  - **Status**: ✅ ANÁLISIS COMPLETO - 23 issues desglosados
  - **Issues**: Ver `tasks/issues/README.md` para índice completo
  - **P0 Quick Wins** (2-3h):
    - ISSUE-001: useEquilibrium sin filtros fecha (XS)
    - ISSUE-005: CAC siempre cero (XS)
    - ISSUE-006: CampaignROI vacío (XS)
    - ISSUE-008: Lara usa campo inexistente work_days_per_month (XS)
    - ISSUE-007: Tooltips rotos - TooltipProvider 4x (XS)
  - **P1 UI/UX** (3-4h):
    - ISSUE-010: DateFilter iconos solapados mobile
    - ISSUE-012: RecentActivity colapsar por defecto
    - ISSUE-013: CategoryBreakdown texto superpuesto
    - ISSUE-014: Tooltips explicativos métricas
  - **P1 Features** (1-2d):
    - ISSUE-015: Meta mensual configurable
    - ISSUE-017: Refactorizar expenses (1233→<400 líneas)
  - Ver: `tasks/TASK-20251209-dashboard-mega-refactor.md`
  - Ver: `docs/design/2025-12-09-dashboard-analysis-summary.md`

- [ ] TASK-20251127-google-calendar-integration - Integrar Google Calendar con tratamientos pendientes
  - **Priority**: P2
  - **Estimate**: L (3-4 días)
  - **Subtasks**:
    1. Agregar campo `treatment_time` al formulario de tratamientos
    2. Migración SQL para tokens de Google Calendar
    3. OAuth2 flow con Google
    4. Sincronización App → Google Calendar
    5. Vista de calendario con FullCalendar
    6. Ordenamiento por fecha/hora en tabla
  - Ver: `tasks/TASK-20251127-google-calendar-integration.md`

- [ ] TASK-20251021-marketing-categories - Implementar sistema de categorías de marketing para CAC
  - **Priority**: P1 - Crítico
  - **Estimate**: L (2-3 días)
  - **Subtasks**:
    1. Migración SQL con trigger de auto-creación de categorías
    2. Motor de cálculos `lib/calc/marketing.ts` con tests
    3. Endpoints `/api/analytics/marketing-metrics`, `cac-trend`, `channel-roi`
    4. Actualizar dashboard para usar datos reales
    5. Formulario de gastos con categorías
    6. Seeds de datos de prueba
  - Ver: `tasks/TASK-20251021-marketing-categories.md`
  - Ver: `docs/design/marketing-categories-implementation.md`

- [ ] TASK-20250817-pr-template-upgrade - Alinear `docs/memories/PR.md` con memorias y reglas
  - Incorporar cadena de dependencias (Depreciación → Fijos → Tiempo → Equilibrio → Insumos → Servicios → Tarifas → Tratamientos)
  - Contexto multi-tenant (Workspaces/Clinics) y snapshots en tratamientos
  - Criterios de aceptación reforzados (i18n EN/ES, AA, Zod, dinero en centavos)
  - Gobernanza: sección Tasks/Devlog y i18n keys para navegación

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