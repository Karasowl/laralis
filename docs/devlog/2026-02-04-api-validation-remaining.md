# 2026-02-04 - Validacion Zod en endpoints restantes

- **PR**: N/A
- **TASK**: TASK-20260204-api-zod-validation-phase-3-remaining

## Contexto

Aun quedaban endpoints fuera de `api/actions/*` con payloads sin esquema, generando respuestas inconsistentes ante errores de entrada.

## Problema

Algunos endpoints aceptaban JSON sin validacion, lo que podia producir errores 500 o datos incompletos.

## Causa raiz

La validacion Zod se habia aplicado por fases y faltaban rutas auxiliares (AI, export/import, snapshots, notificaciones, etc.).

## Que cambio

Se agrego validacion Zod y parseo seguro en endpoints restantes:

- `web/app/api/ai/chat/history/route.ts`
- `web/app/api/ai/query/route.ts`
- `web/app/api/ai/synthesize/route.ts`
- `web/app/api/categories/[id]/route.ts`
- `web/app/api/cron/recurring-expenses/route.ts`
- `web/app/api/cron/snapshots/route.ts`
- `web/app/api/debug-campaign/route.ts`
- `web/app/api/export/generate/route.ts`
- `web/app/api/export/import/route.ts`
- `web/app/api/export/validate/route.ts`
- `web/app/api/marketing/campaigns/[id]/route.ts`
- `web/app/api/notifications/push/subscribe/route.ts`
- `web/app/api/notifications/push/track-click/route.ts`
- `web/app/api/notifications/push/unsubscribe/route.ts`
- `web/app/api/services/[id]/supplies/[rowId]/route.ts`
- `web/app/api/settings/user/route.ts`
- `web/app/api/snapshots/[snapshotId]/restore/route.ts`
- `web/app/api/snapshots/route.ts`

## Archivos tocados

- `web/app/api/ai/chat/history/route.ts`
- `web/app/api/ai/query/route.ts`
- `web/app/api/ai/synthesize/route.ts`
- `web/app/api/categories/[id]/route.ts`
- `web/app/api/cron/recurring-expenses/route.ts`
- `web/app/api/cron/snapshots/route.ts`
- `web/app/api/debug-campaign/route.ts`
- `web/app/api/export/generate/route.ts`
- `web/app/api/export/import/route.ts`
- `web/app/api/export/validate/route.ts`
- `web/app/api/marketing/campaigns/[id]/route.ts`
- `web/app/api/notifications/push/subscribe/route.ts`
- `web/app/api/notifications/push/track-click/route.ts`
- `web/app/api/notifications/push/unsubscribe/route.ts`
- `web/app/api/services/[id]/supplies/[rowId]/route.ts`
- `web/app/api/settings/user/route.ts`
- `web/app/api/snapshots/[snapshotId]/restore/route.ts`
- `web/app/api/snapshots/route.ts`
- `tasks/TASK-20260204-api-zod-validation-phase-3-remaining.md`
- `tasks/active.md`
- `tasks/backlog.md`
- `tasks/done.md`
- `tasks/week-2026-W06.md`
- `docs/devlog/INDEX.md`

## Antes vs Despues

- **Antes**: payloads sin esquema o validacion manual dispersa.
- **Despues**: validacion Zod consistente con errores 400 y parsing seguro.

## Como probar

1. Enviar payload invalido a `/api/export/generate` y verificar status 400.
2. Enviar payload invalido a `/api/notifications/push/subscribe` y verificar status 400.

## Riesgos y rollback

- **Riesgo**: clientes que enviaban payloads con tipos incorrectos ahora fallan.
- **Rollback**: revertir schemas en rutas afectadas.

## Siguientes pasos

- Revisar otros endpoints con `request.json()` si se desea una fase adicional.

## i18n

- Sin cambios.

## Tests

- No ejecutados.
