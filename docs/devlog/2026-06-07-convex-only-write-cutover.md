# 2026-06-07 — Convex-only WRITE cutover (core + settings/features + onboarding/team/invitations)

**TASK ids:** TASK-20260607-convex-write-lifecycle-core, TASK-20260607-convex-write-secondary-onboarding-team
**Commits:** `d9e057e` (reads + core/settings writes), `8da3e4e` (onboarding/team/invitations), `dfeee13` (workspace parity fixes)

## Contexto

Con las **lecturas** convex-only ya verdes (58 GET, 0 5xx — ver
`2026-06-07-convex-only-api-smoke-fixes.md`), esta fase ataca las **escrituras**: que
POST/PUT/PATCH/DELETE funcionen convex-only para que la app sea plenamente usable sobre
Convex.

## Hallazgo de arquitectura (clave)

El **runtime mirror NO salva las escrituras**. `createMirroredSupabaseClient` espeja a
Convex en el `.then()` **después** de que la escritura a Supabase resuelve — en modo
convex-only Supabase es inalcanzable, así que la escritura Supabase falla PRIMERO y el
espejo nunca corre. La única vía convex-only es la rama explícita
`if (shouldUseConvexOnlyWritePath(domain)) { ...upsert/patch/deleteConvexDocumentByLegacyId... }`
ANTES de cualquier `supabaseAdmin`. (Igual que la rama de lectura, pero para escritura.)

## Qué cambió

### Core CRUD (10 entidades) — ya tenían ruta, validadas end-to-end
Auditoría (10 agentes): `brokenWritePaths: []`. `convex-write-lifecycle.cy.ts` ejecuta
crear→borrar convex-only **9/9**: patients, services, treatments (FK real patient+service),
expenses, fixed_costs, supplies, assets, categories crean y borran; patient_sources crea
(POST-only); settings_time verificado estáticamente (su upsert mutaría la config real del
clinic). Payloads corregidos en el camino: treatments exige `minutes>0`; expenses exige un
`category_id` real.

### Secundarias (26 rutas) — rama convex-only añadida
Auditoría: **42/44 rutas secundarias rompían** convex-only. Portadas en dos oleadas (ultracode):
- **Settings/features (12)**: clinics/[id], clinics/discount, settings/booking|notifications|
  preferences, marketing/campaigns(+[id]), marketing/platforms(+[id]), prescriptions(+[id]),
  medications. `convex-write-features.cy.ts` ejecuta **4/4** (marketing/platforms, medications,
  marketing/campaigns con FK platform, prescriptions con FK patient).
- **Onboarding/team/invitations (14, multi-tabla)**: onboarding, workspaces (POST/PUT/DELETE),
  workspaces/[id]/clinics, workspaces/[id]/lifecycle, team/clinic-members(+[id]),
  team/workspace-members(+[id]), team/custom-roles/[id], invitations (POST/DELETE),
  invitations/[id]/resend, invitations/accept/[token], invitations/reject/[token]. Replican
  TODAS las escrituras Supabase (workspace+clinic+membresías, `seedClinicDefaultsInConvex`
  para after_clinic_insert, cascadas de borrado), con encoding de los JSONB de permisos.

## Verificación adversarial

5 agentes refutando paridad de las 14 rutas pesadas: **22/24 hallazgos PASS**. 2 bugs reales
corregidos (`dfeee13`):
1. `createWorkspaceInConvex` no seteaba las columnas con DEFAULT de Postgres
   (`is_active`/`created_at`/`updated_at` del workspace, `created_at` del clinic) que Convex no
   rellena — `created_at` gobierna el orden en `readWorkspacesByIds`.
2. `workspaces/[id]` DELETE: su cascada Convex no borraba `marketing_campaign_status_history`
   (hija de `marketing_campaigns` por `campaign_id`, no por `clinic_id`) → filas huérfanas.
   Portado el bloque que ya tenía la ruta `lifecycle`.
Falsos positivos descartados: los "missing fields" de workspace_members en workspaces POST (el
verificador comparó contra el insert rico de onboarding; el path Supabase de workspaces POST es
lean — la paridad es correcta).

## Incidente operativo (importante)

A mitad de sesión, **algo corrió `git reset --hard HEAD` ~5 veces** sobre `C:\dev\laralis`
(visible en `git reflog`), borrando temporalmente cambios no commiteados (los untracked
sobreviven). Cesó al **matar el dev server** (era el dev server o un watcher atado a él, o una
automatización paralela del usuario). Mitigación: **commitear con frecuencia** — un commit
sobrevive a "reset to HEAD". Lección operativa: en este checkout, commitear cada oleada antes de
arrancar el dev server.

## Archivos tocados (resumen)

26 rutas `app/api/**/route.ts` (settings/features + onboarding/team/invitations) +
`lib/convex/server.ts` (helper `userHasActiveWorkspaceMembershipFromConvex`) +
`lib/whatsapp/service.ts` (getWhatsAppConfig convex) + `app/api/dashboard/supplies` +
specs `cypress/e2e/convex-write-{lifecycle,features}.cy.ts`. Todo flag-gated, default supabase.

## Cómo probar

`.env.local`: `AUTH_BACKEND=convex`, `NEXT_PUBLIC_AUTH_BACKEND=convex`,
`DATA_READ_BACKEND=convex`, `DATA_WRITE_MODE=convex` (deployment `quaint-blackbird-737`).
`npm run dev:dental`; luego:
- `npx cypress run --spec cypress/e2e/convex-write-lifecycle.cy.ts --config baseUrl=http://localhost:<port>` → 9/9
- `npx cypress run --spec cypress/e2e/convex-write-features.cy.ts --config baseUrl=http://localhost:<port>` → 4/4
(El primer login tras arrancar el server a veces es flaky con cy.session — re-correr.)

## Riesgos y rollback

Todo flag-gated, default Supabase: en producción (con llaves Supabase) nada cambia; las ramas
Convex solo se activan con `DATA_WRITE_MODE=convex`. Rollback: quitar la flag.

## Wave 3 — escrituras restantes (COMPLETADO 2026-06-07)

Portadas las 15 rutas que faltaban + 3 módulos compartidos. Verificación adversarial (5
agentes): **15/17 PASS**; los 2 "high" (restore + importer) son falsos positivos (el agente
afirmó que `discoverClinicTables()` golpea Supabase, pero tiene rama estática Convex — refutado
porque el snapshot CREATE smoke pasó usando esa misma discovery).
- `bookings/[id]` PATCH (confirm/reject: patient+treatment+booking), `public/book` POST
  (booking + notificaciones), los 5 `actions/*` (create-expense, update/bulk/adjust de precios,
  update-time-settings — bypass de `aiService.execute` que escribía vía supabaseAdmin), los 5
  `ai/*` (sesiones/mensajes/feedback/historial de chat).
- **Snapshots end-to-end**: porté `ClinicSnapshotExporter` (lee todas las tablas de Convex,
  strip+decode JSONB), `ClinicSnapshotImporter` (restore multi-tabla clinic-scoped, NUNCA el
  `replaceTableSnapshot` global → multi-tenant-safe), y `SnapshotStorageService.upload`/
  `updateManifestIndex` (sube el blob a Convex storage vía mirror). `snapshots` POST + DELETE +
  restore ahora corren convex-only. **`convex-write-snapshots.cy.ts` 1/1** (create→delete, el
  export real lee ~30 tablas de Convex, sube blob, escribe row, borra row+blob).

Commits wave 3: `dcd558d`, `5a7a3d7`, `96c3f69`, `f022418`.

## Wave 4 — cobertura TOTAL (externos/infra + módulos compartidos)

Barrido sistemático de `lib/` + `app/api`: porté **todo** el código restante que toca datos.
- **Rutas** (9 fixed + 2 already_safe): push (subscribe/track-click/unsubscribe), notifications/
  send-confirmation, whatsapp/webhook, settings/user, cron/snapshots, tariffs, clinics; reads de
  análisis IA (compare-periods); clinics + cron/recurring-expenses ya safe.
- **Módulos compartidos** (`ClinicSnapshotService` 13 loaders → Lara query mode; `lib/ai/actions/
  {analytics,operational,pricing}` 16 acciones; `lib/export/{exporter,importer}` 69 métodos;
  `with-permission` middleware 31 rutas — gap real: gateaba solo en AUTH_BACKEND; `auth-user-profiles`
  → mirror `supabase_auth_users`; `ai/service` logAction; `calendar/server-conflicts`; `push`/`sms`
  services; `workspace-lifecycle`). `ai/query/functions`, `calc/patient-acquisition`, `clinic-tables`
  confirmados no-alcanzables en modo convex (solo path Supabase).
- **Barrido final: 0 gaps.** typecheck 193 (baseline). Regresión: read 58/58, write-lifecycle 9/9, verde.

Commits wave 4: `6deee9b`, `40a436a`, `60d4f4e`, `fb569f0`.

## Estado final del CÓDIGO: completo

**TODO el código que toca datos (rutas + módulos compartidos) es convex-only-capable**, flag-gated,
default Supabase. Lo único que queda en Supabase son integraciones genuinamente externas que NO son
la capa de datos: webhooks (ingesta de eventos externos), Google Calendar OAuth, MFA (auth factors),
`account-delete` (auth-admin), `reset` (dev), `settings/notifications/test*` (envío de prueba),
`migration/convex-*` (la herramienta de migración misma). Email (Resend) entra aquí.

## Lo único que falta NO es código — es operación (Fase F, tus manos)

Backup en frío → flips de flags por dominio en PROD con monitoreo → import de blobs de storage →
`CONVEX_RUNTIME_MIRROR_ENABLED=0` → borrar código Supabase + deps → borrar el proyecto Supabase
(tras soak). Ver `docs/IMPORTANT/PHASE-F-WRITE-CUTOVER-RUNBOOK.md`. Reversible por flag hasta el
borrado final. Supabase intacto.
