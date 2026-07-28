# 2026-06-06 — Convex decommission: Phases B, C, D, E + Phase A scaffold

**TASK ids:** TASK-20260606-convex-decommission-bcde-a
**Commits:** `9210842` (D), `35cca84` (B), `762fc4c` (E), `2fd3b22` (C), `97bf161` (A scaffold), `07aa54c` (verification fixes)

## Contexto

El objetivo de fondo es **dejar de usar Supabase para nada** y que Convex sea el
único backend. La paridad de lectura de las rutas API ya estaba hecha (96/110 GET con
rama Convex, todas las escrituras espejadas). Faltaba el ~90%: portar RPCs, triggers,
storage, schema discovery y Auth. Esta sesión cerró las fases B, C, D, E y dejó la
Fase A (Convex Auth) scaffolded + runbook del operador.

Todo va **flag-gated, default Supabase**: cero impacto en producción hasta que el
operador voltee un flag por dominio.

## Problema

Cada uno de estos subsistemas seguía atado a Postgres:
- **Schema discovery** (`information_schema`) para snapshots/export.
- **RPCs**: `process_recurring_expenses`, `check_booking_slot_availability`.
- **Triggers**: seed de clínica (`after_clinic_insert`), `is_paid` de tratamientos,
  recordatorios programados, recálculo de precios.
- **Storage**: los blobs de snapshots vivían en Supabase Storage (las escrituras ya
  se espejaban; faltaba la **lectura** desde Convex).
- **Auth**: login/signup/reset en Supabase Auth.

## Qué cambió (por fase)

### Fase D — Discovery sin `information_schema`
- `lib/snapshots/static-schema.ts`: lista canónica `STATIC_DISCOVERED_TABLES`
  byte-idéntica al `getKnownDirectTables()` + `KNOWN_INDIRECT_TABLES` legacy (30
  directas con categories/medications como hybrid, 6 indirectas). **No** enumera el
  set completo `MIRRORED_TABLES` (añadiría tablas workspace/global y cambiaría los
  snapshots).
- `discovery.ts`: ramas Convex en `discoverClinicTables()` (reusa el
  `calculateInsertionOrder` puro) y `getTableColumns()` (deriva columnas de una fila
  mirror, quitando los 7 campos de metadata y decodificando nombres).
- `snapshots/discover` route: conteos desde Convex por categoría. Gate:
  `DATA_READ_BACKEND_SNAPSHOTS`.

### Fase B — RPCs portados
- `convex/recurringExpenses.processDue`: réplica exacta de la migración 58. Lógica de
  fechas PG-fiel en `convex/lib/recurringDates.ts` (intervalos mes/año con clamp a fin
  de mes; mensual con `LEAST` anclado a `recurrence_day`) — **13 tests unitarios**.
  El cron solo desvía a Convex cuando `DATA_WRITE_MODE_EXPENSES=convex` (en `dual` el
  mirror ya refresca `expenses`, evitando doble-generación).
- `convex/bookingAvailability.checkSlotAvailable`: réplica de la migración 79 (lee
  `treatments.minutes`, no `duration_minutes`); query **pública** (sin secret, como el
  GRANT a anon). Gate en `public/book`: `DATA_READ_BACKEND_CLINICS`.
- `clinics` route: `userCanSelectClinic` ahora usa `convexUserHasClinicAccess` (paridad
  real con `is_clinic_member`, incl. `allowed_clinics`).

### Fase E — Triggers portados al write-path convex-only
- `lib/convex/clinic-seed.ts`: port de `after_clinic_insert` (7 `patient_sources`,
  3 `custom_categories` condicionales, 10 `whatsapp_templates`), idempotente (dedupe en
  JS), cableado en onboarding + workspaces/[id]/clinics tras `shouldWriteConvexData('clinics')`.
- `lib/calc/treatment-payment.ts` (`deriveTreatmentPaymentState`, trigger 73, **6 tests**)
  + recordatorios (trigger 61) en el write-path convex de tratamientos.
- Recálculo de precios (trigger 68): ya estaba portado; añadido comentario anti-drift.

### Fase C — Lectura Convex de blobs de snapshot
- `convex/migration.getStorageObjectUrl` (read-only, sin secret) +
  `downloadConvexStorageObject` / `getConvexStorageObjectUrl` +
  `storage.download`/`getSignedUrl` Convex-first detrás de `DATA_READ_BACKEND_STORAGE`,
  con fallback a Supabase para blobs pre-mirror. Las escrituras ya se espejaban.

### Fase A — Scaffold de Convex Auth (A1 + seed A4)
- Instalado `@convex-dev/auth@0.0.93` + `@auth/core@0.37.0`.
- `convex/{schema,auth,auth.config,http,ResendOTP,ResendOTPPasswordReset,authMigration}.ts`
  escritos, **inertes (no desplegados)**. `schema.ts` usa `schemaValidation:false` (las
  ~60 tablas mirror nunca se validan/rechazan).
- `authMigration.seedAuthUsersFromMirror` (reset-on-cutover: pre-siembra `users` desde
  `supabase_auth_users` preservando el UUID como `legacyId`; no migra passwords) +
  `currentUserLegacyId` (mapea token-subject → UUID, el join key del que dependen todos
  los permisos/membresías).
- El cutover (A2 llaves JWT, A3 wiring client/server, A5 testing en vivo, deploy) es el
  **runbook del operador**: `docs/IMPORTANT/CONVEX-AUTH-CUTOVER-RUNBOOK.md`.

## Verificación adversarial (ultracode)

2 workflows multi-agente: 7 lectores de comprensión (extrajeron los cuerpos SQL
verbatim) y 6 verificadores adversariales de paridad. Resultados: recurring-expenses,
booking-availability y la auditoría de flag-gating salieron **CLEAN**. Se corrigieron
2 bugs reales:
1. `reminder_hours_before` con `|| 24` convertía un 0 explícito en 24 (≠ `COALESCE`).
2. `clinic-seed` buscaba el `category_type` por `'service_category'`/`code` (condición
   obsoleta del trigger 41 que siembra cero en Supabase); ahora usa el nombre real
   `'service'` para que las 3 categorías sí se siembren en modo convex-only.

## Archivos tocados

Nuevos: `convex/{recurringExpenses,bookingAvailability,schema,auth,auth.config,http,ResendOTP,ResendOTPPasswordReset,authMigration}.ts`,
`convex/lib/recurringDates.ts`, `lib/snapshots/static-schema.ts`, `lib/convex/clinic-seed.ts`,
`lib/calc/{treatment-payment,recurringDates,treatment-payment}.test.ts`,
`docs/IMPORTANT/CONVEX-AUTH-CUTOVER-RUNBOOK.md`.
Modificados: `lib/snapshots/{discovery,storage}.ts`, `lib/convex/{server,supabase-runtime-mirror}.ts`,
`convex/migration.ts`, `app/api/{snapshots/discover,cron/recurring-expenses,public/book,clinics,treatments,onboarding,workspaces/[id]/clinics,services}/route.ts`,
`.env.example`, `package.json`.

## Antes vs Después

- **Antes:** discovery vía `information_schema`; 2 RPCs Postgres sin equivalente;
  triggers de seed/is_paid/recordatorios sin reproducir en convex-only; blobs solo
  legibles desde Supabase; Auth 100% Supabase.
- **Después:** discovery estática; RPCs portados con tests; triggers reproducidos en el
  write-path convex; lectura de blobs Convex-first; Convex Auth listo para cutover.
  Typecheck en el baseline preexistente (189), **cero errores nuevos**; 19 tests
  unitarios nuevos verdes.

## Cómo probar

- `npm run typecheck:dental` → mismo conteo baseline (189), sin errores en archivos tocados.
- `npx vitest run lib/calc/recurringDates.test.ts lib/calc/treatment-payment.test.ts` → 19 verdes.
- Por dominio (en preview, nunca `.env.local`): `DATA_READ_BACKEND_SNAPSHOTS=convex`,
  `DATA_WRITE_MODE_EXPENSES=convex`, `DATA_READ_BACKEND_STORAGE=convex`,
  `DATA_READ_BACKEND_CLINICS=convex` y comparar contra el path Supabase.

## Riesgos y rollback

- Todo default Supabase: rollback = no voltear el flag (o volverlo a `supabase`).
- El deploy del schema de Convex Auth (con `schemaValidation:false`) es el paso más
  delicado y queda en manos del operador junto con las llaves A2.

## Update (más tarde 2026-06-06) — Phase A3 client+server wiring (commit `44ca216`)

Se cableó el grueso del cutover de Convex Auth, flag-gated y **build-verified**
(`npm run build:dental` exit 0, sin errores de import; verificación adversarial 3/3 clean):
- `ConvexAuthClientProvider` + montaje en `layout.tsx` (solo cuando `getAuthBackend()!=='supabase'`).
- `use-auth.ts`: login + logout vía `useAuthActions()` (gateado por la constante
  `NEXT_PUBLIC_AUTH_BACKEND`, el ternario nunca invoca el hook en modo Supabase).
- Identidad server-side: `getConvexAuthUserLegacyId()` (token → UUID vía
  `authMigration:currentUserLegacyId` con `makeFunctionReference`) cableado en
  `resolveClinicContext` + `createConvexOnlyServerClient`.
- Gap convex-only cerrado: `treatments/[id]` PUT re-deriva `is_paid` (trigger 73) y
  cancela recordatorios al pasar a estado terminal (trigger 61).

**Sigue siendo del operador** (requiere llaves + app corriendo): el middleware +
`config.matcher` (cambia routing compartido) y los flujos OTP de register/reset/verify
+ páginas. Snippets verificados en el runbook.

## Follow-ups (TASK ids)

- TASK-20260606-convex-auth-cutover — A2 (llaves) + middleware/matcher + OTP register/reset/verify + A5 testing (operador, runbook).
- TASK-20260606-phase-F-write-cutover — flips `DATA_WRITE_MODE=convex` por dominio +
  decomisión del mirror + borrado de Supabase (último, tras paridad verificada).
- TASK-20260606-storage-blob-import — correr `import-convex-storage.mjs` antes de
  voltear `DATA_READ_BACKEND_STORAGE=convex`.
- Nota: el `reminder_2h` muerto en el path **Supabase** de `[id]/route.ts:230` es
  pre-existente (no se tocó); el path convex-only ya cancela correctamente.
