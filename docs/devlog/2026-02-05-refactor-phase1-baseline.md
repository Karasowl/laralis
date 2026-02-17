# 2026-02-05 - Refactor Cleanup Phase 1 (Baseline + Guardrails)

## Objetivo
Iniciar refactor incremental sin romper contratos API, priorizando estabilidad y seguridad operativa.

## Implementado

1. Guardrails de repositorio
- Script de métricas: `web/scripts/refactor-metrics.mjs`
- Script npm: `npm --prefix web run refactor:metrics`
- CI mínima: `.github/workflows/web-quality.yml`
- PR checklist: `.github/pull_request_template.md`

2. Toolkit API común
- `web/lib/api/types.ts`
- `web/lib/api/request-id.ts`
- `web/lib/api/logger.ts`
- `web/lib/api/response.ts`
- `web/lib/api/validation.ts`
- `web/lib/api/route-handler.ts`
- `web/lib/api/db-policy.ts`

3. Adopción inicial en rutas críticas
- `web/app/api/services/route.ts`
- `web/app/api/patients/route.ts`
- `web/app/api/expenses/route.ts`
- `web/app/api/expenses/[id]/route.ts`
- `web/app/api/expenses/stats/route.ts`
- `web/app/api/expenses/alerts/route.ts`

4. Estabilización del módulo de gastos (compatibilidad)
- `useExpenses` recuperó contrato legado consumido por UI:
  - `error`, `updateFilters`, `searchTerm`, `setSearchTerm`, `categories`
  - soporte de `filters` y `limit` en opciones de hook
- Migración parcial de `fetch` directo en UI/hook hacia `useApi` en componentes priorizados.
- Limpieza de tipos en componentes de gastos:
  - `CreateExpenseForm.tsx`
  - `EditExpenseModal.tsx`
  - `expenses-table.tsx`
  - `create-expense-dialog.tsx`
  - `expense-stats.tsx`

5. Verificación técnica ejecutada
- `eslint` pasa en los archivos tocados del módulo `expenses`.
- `typecheck` sin errores para patrones `app/api/expenses/**`, `components/expenses/**`, `hooks/use-expenses.ts`.
- `test:unit` mantiene 5 fallas preexistentes en `lib/calc/dates.test.ts` (sin relación con este cambio).
- Baseline regenerado en `docs/refactor/metrics-baseline.{md,json}`:
  - `fetch` occurrences: 206
  - `api routes with console.log`: 0
  - `api routes with validation signals`: 95
6. Consolidación inicial de validaciones
- `web/lib/validation/index.ts`
- `web/lib/validation/schemas/domain/index.ts`
- `web/lib/validation/schemas/api/index.ts`
- `web/lib/validation/schemas/index.ts`

7. Limpieza de código y artefactos
- Eliminado `console.log` en `web/app/api/**`
- Eliminados duplicados sin uso:
  - `web/components/providers/ThemeProvider.tsx`
  - `web/components/ui/FormField.tsx`
  - `web/hooks/use-swr-api.ts`
- Eliminados archivos temporales/backups/deprecated de repo

8. Reglas de calidad
- ESLint: bloqueo de import de `@/lib/supabaseAdmin` en capas cliente/dominio (`web/.eslintrc.json`)
- `.gitignore` reforzado para temporales (`tmp*`, `_tmp*`, `*.backup`, `*.deprecated`)

## Notas de compatibilidad
- No se cambiaron rutas ni métodos HTTP.
- No se alteró shape público de respuestas en rutas migradas.
- Se añadió `x-request-id` como metadata no rompiente.

## Pendientes inmediatos
- Migrar por olas el resto de rutas API al toolkit.
- Reducir `fetch` directo restante en hooks/componentes de dominio.
- Dividir archivos críticos > 400 líneas en módulos.
