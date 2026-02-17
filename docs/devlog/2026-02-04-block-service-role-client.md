# 2026-02-04 - Bloquear supabaseAdmin en cliente

- **PR**: N/A
- **TASK**: TASK-20260204-block-service-role-client

## Contexto

Durante la limpieza de claves expuestas, la auditoria de seguridad marco que `supabaseAdmin` podria terminar usandose en el cliente si se importa por error.

## Problema

El guard anterior solo lanzaba error cuando existia `SUPABASE_SERVICE_ROLE_KEY` en el browser. En bundles cliente, esa variable no existe, por lo que el guard no se activaba.

## Causa raiz

El chequeo condicionaba la proteccion a la presencia de la key, en lugar de bloquear el uso en navegador sin importar la configuracion.

## Que cambio

Se agrego un guard estricto que falla siempre que `supabaseAdmin` se evalua en un entorno con `window` (browser).

## Archivos tocados

- `web/lib/supabaseAdmin.ts`
- `tasks/active.md`
- `tasks/backlog.md`
- `tasks/done.md`
- `tasks/TASK-20260204-block-service-role-client.md`
- `tasks/week-2026-W06.md`
- `docs/devlog/INDEX.md`
- `docs/devlog/2026-02-04-block-service-role-client.md`

## Antes vs Despues

- **Antes**: `supabaseAdmin` podia inicializarse en browser si faltaba la service role key.
- **Despues**: cualquier import/ejecucion en browser lanza error inmediato.

## Como probar

1. (Manual) Intentar importar `supabaseAdmin` desde un Client Component y verificar que lanza error en consola.
2. (Server) Verificar que rutas API que usan `supabaseAdmin` siguen funcionando.

## Riesgos y rollback

- **Riesgo**: Si algun componente cliente importaba `supabaseAdmin`, ahora fallara en runtime.
- **Rollback**: Revertir el cambio en `web/lib/supabaseAdmin.ts`.

## Siguientes pasos

- Revisar e implementar RLS en Supabase (TASK por crear/ejecutar).

## i18n

- Sin cambios.

## Tests

- No ejecutados.
