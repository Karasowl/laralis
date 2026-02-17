# AI Handoff - Refactor Laralis (2026-02-05)

## 1) Contexto y objetivo
Este repo está en un refactor incremental para dejar una base mantenible, segura y testeable **sin breaking changes en contratos API**.

Objetivo principal de esta etapa:
- estabilizar y normalizar rutas API por olas (toolkit común),
- consolidar hooks de datos,
- reducir deuda técnica visible (logs, temporales, tipos críticos),
- mantener compatibilidad total de payloads/responses existentes.

## 2) Reglas no negociables
- No cambiar rutas HTTP, métodos ni shape público de respuestas.
- No romper consumidores de hooks/componentes existentes.
- Mantener multi-tenant por `clinic_id/workspace_id`.
- `supabaseAdmin` solo server-side (regla de lint ya agregada).
- Cualquier excepción debe quedar documentada.

## 3) Estado real del worktree
El worktree está **muy sucio** y ya venía así (muchos archivos modificados antes de este handoff).

Puntos clave:
- hay muchísimos cambios previos en `web/app/api/**`.
- hay archivos nuevos sin trackear en `docs/refactor/`, `web/lib/api/`, `web/lib/validation/`, etc.
- no hacer cleanup destructivo global; trabajar por módulos y no revertir cambios ajenos.

## 4) Plan macro acordado (resumen)
1. Baseline + guardrails.
2. Normalización API + seguridad operacional.
3. Consolidación hooks/fetch de dominio.
4. División de archivos grandes.
5. Unificación de validaciones/tipos.
6. Limpieza repo + docs.
7. Cierre con calidad estricta.

## 5) Qué se implementó en esta iteración

### 5.1 Guardrails y baseline
- script de métricas: `web/scripts/refactor-metrics.mjs`
- comando: `npm --prefix web run refactor:metrics`
- artifacts:
  - `docs/refactor/metrics-baseline.md`
  - `docs/refactor/metrics-baseline.json`
- CI mínima: `.github/workflows/web-quality.yml`
- PR template: `.github/pull_request_template.md`

### 5.2 Toolkit API común
Se creó/actualizó `web/lib/api/*`:
- `web/lib/api/types.ts`
- `web/lib/api/request-id.ts`
- `web/lib/api/logger.ts`
- `web/lib/api/response.ts`
- `web/lib/api/validation.ts`
- `web/lib/api/route-handler.ts`
- `web/lib/api/db-policy.ts`
- `web/lib/api/index.ts`

Capacidades:
- `X-Request-Id` en respuesta,
- logger estructurado por request,
- wrapper de contexto y manejo uniforme de errores,
- helpers de lectura/validación.

### 5.3 Módulo `expenses` estabilizado y migrado

#### API migrada al toolkit (con compatibilidad)
- `web/app/api/expenses/route.ts`
- `web/app/api/expenses/[id]/route.ts`
- `web/app/api/expenses/stats/route.ts`
- `web/app/api/expenses/alerts/route.ts`

Cambios concretos:
- parseo robusto de `amount_pesos -> amount_cents` sin romper payloads previos.
- logging con `requestId` (`withRouteContext` + `createRouteLogger`).
- respuestas conservan shape previo (`{ data: ... }`, `{ error: ... }`, etc.).

#### Hook/UI `expenses` compatible con consumidores actuales
- `web/hooks/use-expenses.ts`
- `web/hooks/use-categories.ts`
- `web/components/expenses/CreateExpenseForm.tsx`
- `web/components/expenses/EditExpenseModal.tsx`
- `web/components/expenses/create-expense-dialog.tsx`
- `web/components/expenses/expenses-table.tsx`
- `web/components/expenses/expense-stats.tsx`

`useExpenses` volvió a exponer contrato esperado por UI:
- `error`
- `updateFilters`
- `searchTerm`
- `setSearchTerm`
- `categories`
- opciones `filters` y `limit`

### 5.4 Limpieza/estándares
- `console.log` en rutas API: 0 (verificado con `rg`).
- borrado de duplicados y temporales ya iniciado (varios archivos `tmp*`, `*.backup`, `*.deprecated`).
- docs/tareas actualizadas:
  - `docs/devlog/2026-02-05-refactor-phase1-baseline.md`
  - `docs/devlog/INDEX.md`
  - `tasks/active.md`
  - `web/REFACTORING-GUIDE.md`
  - `web/ARCHITECTURE.md`

## 6) Verificación ejecutada

### 6.1 Checks de módulo tocado
Pasaron sobre archivos de `expenses`:
- ESLint focalizado en:
  - `web/app/api/expenses/*.ts`
  - `web/app/api/expenses/[id]/route.ts`
  - `web/hooks/use-expenses.ts`
  - `web/components/expenses/*.tsx`
  - `web/hooks/use-categories.ts`
- Typecheck filtrado por patrones de `expenses` sin errores reportados.

### 6.2 Estado global (aún rojo, deuda preexistente)
- `npm --prefix web run lint` falla por cientos de issues en módulos fuera de `expenses`.
- `npm --prefix web run typecheck` falla por múltiples bloques legacy (API varias, UI, hooks, libs).
- `npm --prefix web run test:unit`:
  - 10 files OK
  - 1 file FAIL: `web/lib/calc/dates.test.ts` (5 tests fallando, preexistente).

## 7) Métricas baseline actual (última corrida)
Archivo fuente: `docs/refactor/metrics-baseline.md`

- fetch occurrences: 206
- files with fetch: 78
- any occurrences: 765
- files with any: 163
- api routes: 160
- api routes with console.log: 0
- api routes with validation signals: 95
- api routes without validation signals: 65
- files >= 400 lines: 58

## 8) Próxima cola recomendada (para otra IA)
Ejecutar en este orden, por PRs pequeños:

1. Ola A API (prioridad máxima)
- migrar `fixed-costs`:
  - `web/app/api/fixed-costs/route.ts`
  - `web/app/api/fixed-costs/[id]/route.ts`
- migrar `supplies`:
  - `web/app/api/supplies/route.ts`
  - `web/app/api/supplies/[id]/route.ts`
- migrar `services/[id]` y `services/[id]/supplies*`.

2. Reparar bloque TS de parseo `unknown` en rutas legacy
- patrón: `const body = await req.json()` tipado como `unknown`.
- aplicar helpers de validación (`readJson`/`readJsonBody` + zod parse).

3. Consolidar hook API interface
- hay hooks esperando `refetch`/`fetchData` en `useApi`.
- decidir:
  - o agregar alias compatibles en `useApi`,
  - o migrar consumidores a `get/execute`.
- priorizar: `use-campaigns`, `use-clinic-members`, `use-custom-roles`, `use-invitations`, `use-permissions`, `use-service-roi`, etc.

4. Corregir tests `dates`
- revisar `web/lib/calc/dates.ts` vs `web/lib/calc/dates.test.ts` (días laborales).
- objetivo: recuperar verde en `test:unit` sin cambiar lógica de negocio inadvertidamente.

## 9) Comandos útiles para retomar
```bash
# instalar deps
npm --prefix web ci

# baseline
npm --prefix web run refactor:metrics

# lint global (hoy falla por deuda histórica)
npm --prefix web run lint

# typecheck global (hoy falla por deuda histórica)
npm --prefix web run typecheck

# tests unitarios actuales
npm --prefix web run test:unit

# buscar logs en API
rg -n "console\\.log\\(" web/app/api --glob "**/route.ts"

# revisar rutas sin validación (desde baseline)
cat docs/refactor/metrics-baseline.md
```

## 10) Riesgos y notas de continuidad
- No asumir que el estado de `git status` representa solo esta iteración.
- Evitar refactors masivos de golpe; seguir por dominio/ruta.
- Mantener invariantes de compatibilidad de API y hooks.
- Validar siempre por módulo tocado antes de intentar verde global.

---

Si la siguiente IA necesita arrancar rápido:
1. tomar `fixed-costs` y dejarlo migrado + lint local verde,
2. luego `supplies`,
3. luego cerrar el bloque de `useApi` compatibility (`refetch/fetchData`),
4. recién después empujar a reducción de deuda global.
