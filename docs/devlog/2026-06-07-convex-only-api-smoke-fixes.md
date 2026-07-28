# 2026-06-07 — Convex-only API smoke: fix every GET that still hit Supabase

**TASK ids:** TASK-20260607-convex-only-api-smoke-fixes
**Branch:** fix/dashboard-patients-seen-vs-new (on 438e3dd)

## Contexto

El objetivo de fondo sigue siendo **dejar de usar Supabase para nada** (Convex como único
backend). La paridad de lectura ya estaba "casi" — pero el smoke comprensivo de los 58
endpoints GET (`cypress/e2e/convex-all-apis-smoke.cy.ts`) nunca había podido correr a
completitud (inestabilidad previa de OneDrive). El usuario pidió, con ultracode, encontrar
y arreglar **todo el código que todavía apunta a Supabase** y que rompe el modo convex-only,
trabajando en `C:\dev\laralis` (disco C, fuera de OneDrive).

## Problema

En modo convex-only (`AUTH_BACKEND=convex`, `DATA_READ_BACKEND=convex` blanket, Supabase
inalcanzable), cualquier `supabaseAdmin.from()/.rpc()` o cliente Supabase real lanza → 500.
Una ruta GET sobrevive solo si retorna por su rama `shouldReturnConvexData(...)` **antes** de
tocar Supabase. La pregunta era: ¿cuáles de los 58 GET no lo hacen?

## Método (ultracode)

1. **Auditoría multi-agente** (8 lotes paralelos) de los 58 endpoints. El proceso se
   interrumpió (Warp se cerró), pero el **journal** preservó las 8 tandas de hallazgos
   completas + dejó 3 ediciones parciales (una rota: `ai/chat/history` referenciaba un helper
   nunca definido).
2. **Resolución de una contradicción clave**: los agentes marcaron ~10 rutas como
   `auth_not_convex_aware` por usar `createClient() + supabase.auth.getUser()`. Pero
   `createClient()` de `@/lib/supabase/server` **ya devuelve un shim convex-aware** en modo
   convex (resuelve identidad vía la sesión Convex / token `@convex-dev/auth`); su `from()`/
   `rpc()` lanzan, pero su `auth.getUser()`/`getSession()` funcionan. → **esas 10 eran falsos
   positivos** (los agentes no trazaron el shim). Igual `workspaces` (su `lib/workspace-access.ts`
   ya es convex-aware), `auth/me` y `snapshots/discover` (rama estática primero).
3. **Bugs reales (3)** confirmados leyendo el código: access-check con `supabaseAdmin` inline
   **antes** de la rama Convex en `team/clinic-members`, `team/workspace-members`, `invitations`.
4. **Corrección + verificación adversarial** (4 agentes) de las 3 rutas + helper.
5. **Smoke real** contra un dev server convex-only en `C:\dev\laralis` → cazó **2 falsos
   negativos** que la auditoría estática había dado por seguros.

## Qué cambió

- **`lib/convex/server.ts`**: nuevo `userHasActiveWorkspaceMembershipFromConvex(workspaceId,
  userId)` — paridad exacta del gate Supabase `.eq('is_active', true)` (estricto `=== true`,
  para no conceder acceso que Supabase denegaría; corregido tras verificación adversarial).
- **`team/clinic-members`**: rama Convex de autorización (parity `is_clinic_member` vía
  `convexUserHasClinicAccess` OR membresía activa de workspace) + `getClinicMembersFromConvex`,
  movida **antes** de las 3 llamadas `supabaseAdmin` del access-check.
- **`team/workspace-members`**: completado el edit parcial (imports faltantes
  `getConvexDocumentByLegacyId` + el helper) — su rama Convex ya replicaba resolución de
  workspace + membership + lista de miembros con perfiles auth del mirror.
- **`invitations`**: resolución de workspace + membership vía Convex, gateada en el **mismo**
  `shouldReturnConvexData('invitations')` que su rama de datos (sin mismatch auth/datos).
- **`dashboard/supplies`** (falso negativo del smoke): `createRouteHandlerClient` de
  `@supabase/auth-helpers-nextjs` se instanciaba en la línea 14 **antes** de la rama Convex y
  lanzaba al faltar las llaves Supabase → 500. Movida su creación dentro de la rama Supabase.
- **`lib/whatsapp/service.ts` → `getWhatsAppConfig`** (falso negativo del smoke, usado por
  `settings/notifications/whatsapp-readiness`): leía `supabaseAdmin.from('clinics')`. Añadida
  rama Convex (`getConvexDocumentByLegacyId('clinics')`, lee `notification_settings.whatsapp`).

## Resultado

- **Smoke convex-only: 58/58 GET sin 5xx** (51× 200, 7× 400). Los 7 × 400 son endpoints que
  exigen query params (rangos de fecha; `clinicId` para `public/availability`) — validación
  correcta, y confirma que el auth convex pasó (llegaron a validar, no a 401/500).
- **Typecheck:dental en baseline (197), cero errores nuevos.**
- Verificación adversarial: `workspace-members` PASS; parity `is_active` corregida; el
  hallazgo "high" de `clinic-members` (RPC `is_clinic_member` sin `p_user_id`) era **falso
  positivo** — la función usa `auth.uid()` internamente, no toma `p_user_id`.

## Lección

La auditoría **estática** produjo ~10 falsos positivos (no trazó el shim de `createClient`) y
2 falsos negativos (`getWhatsAppConfig` y `createRouteHandlerClient` que parecían "pure
compute"/"auth-only"). **Solo el smoke ejecutado de verdad** dio la verdad de cada endpoint.
Para paridad convex-only, ejecutar > analizar.

## Archivos tocados

`apps/dental/app/api/{dashboard/supplies,invitations,team/clinic-members,team/workspace-members}/route.ts`,
`apps/dental/lib/convex/server.ts`, `apps/dental/lib/whatsapp/service.ts`.
(`apps/dental/.env.local` — gitignored — añadidas flags `AUTH_BACKEND=convex`,
`NEXT_PUBLIC_AUTH_BACKEND=convex`, `DATA_READ_BACKEND=convex` para el smoke; este checkout no
tiene llaves Supabase, así que es su modo de operación natural.)

## Cómo probar

1. `apps/dental/.env.local` con las 3 flags convex + el deployment `quaint-blackbird-737`.
2. `npm run dev:dental` (este checkout corre convex-only).
3. `cd apps/dental && npx cypress run --spec cypress/e2e/convex-all-apis-smoke.cy.ts --config baseUrl=http://localhost:<port>`
4. Esperado: 1 passing, `tmp/convex-api-smoke.json` con 0 valores ≥ 500.

## Riesgos y rollback

- Todo flag-gated, default Supabase: en producción (con llaves Supabase) el comportamiento no
  cambia; las ramas Convex solo se activan con los flags.
- Rollback: revertir los 6 archivos; quitar las flags de `.env.local`.

## Follow-ups

- Las **escrituras** convex-only (POST/PUT) son Fase F (este smoke es de lectura). Varias
  rutas (p.ej. `workspaces` POST, `invitations` POST, `ai/chat/history` writes) siguen
  asumiendo Supabase en su write-path — pendiente al voltear `DATA_WRITE_MODE_*=convex`.
- TASK-20260606-phase-F-write-cutover sigue abierta.
