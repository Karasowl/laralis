# Supabase Decommission Plan — "no usar Supabase para nada"

> Goal: remove **all** runtime dependency on Supabase (Auth, Storage, Postgres
> RPCs/triggers/RLS), making Convex the sole backend. Read-parity for API routes
> is already done (96/110 GET migrated, all writes mirror) — that was ~10% of the
> work. This doc covers the remaining 90%, grounded in the actual codebase.
>
> Date: 2026-06-05 · Auth strategy chosen: **Convex Auth** (`@convex-dev/auth`),
> email/password only (no Google/social login).

---

## What still binds the app to Supabase (evidence)

| Subsystem | Where | Why it blocks decommission |
|---|---|---|
| **Auth — login** | `hooks/use-auth.ts:69` (`signInWithPassword`) | Has a Convex path (`loginWithConvexCredentials`) but default is Supabase |
| **Auth — signup + email verify** | `hooks/use-auth.ts:151` (`signUp`, `emailRedirectTo`) | Supabase-only; sends confirmation email |
| **Auth — password reset email** | `hooks/use-auth.ts:245` (`resetPasswordForEmail`) | Supabase sends the email; bridge only stores tokens |
| **Auth — OAuth callback** | `app/auth/callback/route.ts:44` (`exchangeCodeForSession`) | Google login — **being dropped** (user: email/password only) |
| **Auth — admin profile lookups** | `team/clinic-members:215`, `scripts/.../supabase-full-export` | `supabase.auth.admin.getUserById` for email/name/avatar |
| **Auth — re-auth / delete account** | `settings/security/.../:143`, `auth/delete-account:22,32` | `signInWithPassword`, `verifyOtp` |
| **RPC: clinic access** | `lib/auth/verify-clinic-access.ts:25,55`, `lib/clinic.ts:165` (`user_has_clinic_access`) | Authorization on **every** request |
| **RPC: permissions** | `lib/permissions/check.ts:23` (`check_user_permission`) | ✅ already replicated in `convex/authBridge.ts` |
| **RPC: recurring expenses** | `cron/recurring-expenses:34,89` (`process_recurring_expenses`) | Financial pl/pgsql logic; no read to migrate |
| **RPC: booking + clinic resolve** | `public/book/route.ts:367`, `clinics/route.ts:196` | pl/pgsql |
| **RPC: schema discovery** | `lib/snapshots/discovery.ts:95,398,422` (`information_schema`) | Powers export + snapshots |
| **Storage** | `lib/snapshots/{storage,exporter,importer}.ts` | Snapshot files live in Supabase Storage |
| **DB triggers** | `supabase/migrations/*` | `after_clinic_insert` (auto-seed sources/categories), price recalc, etc. |
| **RLS** | Postgres policies | Currently *simulated* server-side via `supabaseAdmin` + explicit `clinic_id` filters |
| **Source of truth** | the mirror | Convex is a 1:1 mirror; writes still hit Supabase (`DATA_WRITE_MODE` default supabase) |

Convex project state today: **schemaless** (no `convex/schema.ts`), only
`authBridge.ts` + `migration.ts` functions; **no** `@convex-dev/auth` installed.

---

## Phase A — Convex Auth (critical path, highest risk)

> Risk: a wrong cutover locks every user out. Everything stays behind
> `AUTH_BACKEND` (default `supabase`) until verified. `getAuthBackend()` already
> supports `supabase | dual | convex` and `lib/supabase/server.ts` already has a
> `createConvexOnlyServerClient` path for `AUTH_BACKEND=convex`.

### A1. Install + scaffold (safe, no production impact)
- `npm i @convex-dev/auth @auth/core` (user approved Convex Auth).
- `convex/schema.ts` → `defineSchema({ ...authTables })`. **Safe on the schemaless
  deployment**: Convex only validates tables *declared* in the schema; the 60
  untyped mirror tables remain allowed and untouched. (Optionally declare the
  bridge tables too; do NOT declare the 60 mirror tables — keep them untyped.)
- `convex/auth.ts` → `convexAuth({ providers: [Password({ verify: ResendOTP, reset: ResendOTPPasswordReset })] })`.
- `convex/ResendOTP.ts` / `ResendOTPPasswordReset.ts` → reuse the existing Resend
  setup (`lib/email/service.ts`) so verification + reset emails send via Resend.
- `convex/http.ts` → `auth.addHttpRoutes(http)`.
- `convex/auth.config.ts` → JWT config.

### A2. Generate keys + deploy (needs deployment env — **user-involved**)
- `npx @convex-dev/auth` (or manual `npx convex env set`) sets `JWT_PRIVATE_KEY`,
  `JWKS`, `SITE_URL` on the Convex deployment. **These are production auth secrets**
  — generate/set deliberately, not blind. After this, `npx convex dev --once`
  deploys auth functions (inert until the client calls them).

### A3. Next.js wiring (flag-gated)
- `middleware.ts` → `convexAuthNextjsMiddleware` when `AUTH_BACKEND=convex`.
- Root provider → `ConvexAuthNextjsServerProvider`.
- Rewrite `hooks/use-auth.ts` `login/register/reset` to call Convex Auth
  `signIn("password", { ..., flow })` when `AUTH_BACKEND==='convex'`; keep the
  Supabase branch for `supabase`/`dual`.
- Server identity: replace the Supabase-session read in `lib/clinic.ts`
  `resolveClinicContext` with `convexAuthNextjsToken()` / `ctx.auth.getUserIdentity()`
  when on Convex auth. This is the load-bearing change — every authenticated route
  flows through `resolveClinicContext`.

### A4. User-data migration (**decision required**)
Existing users live in Supabase `auth.users` (mirrored to `supabase_auth_users`).
Convex Auth uses its own `users` + `authAccounts`, and hashes passwords with
scrypt — **Supabase's bcrypt hashes cannot be imported**. Options:
- **(Recommended) Reset-on-cutover**: pre-create Convex Auth `users` rows from
  `supabase_auth_users` (preserving the UUID as identity so all `user_id` FKs keep
  working), but require each user to set a new password via the reset flow on first
  Convex-auth login. One-time friction, clean break.
- **Dual grace period**: run `AUTH_BACKEND=dual` — login tries Supabase, and on
  success the existing `bridgeConvexPasswordCredential` captures the password to
  seed Convex Auth. After N weeks, flip to `convex`. Lower friction, longer overlap.

### A5. Verify + cut over
- Test signup, email verify, login, reset, logout, re-auth, delete-account on a
  staging user with `AUTH_BACKEND=convex` **before** flipping production.
- Replace `supabase.auth.admin.getUserById` lookups with the mirrored
  `supabase_auth_users` table (already done in team routes) everywhere.
- Remove `app/auth/callback` (OAuth) — not needed for email/password.

---

## Phase B — Port Postgres functions to Convex

Each `.rpc()` call must become a Convex query/mutation:
- `user_has_clinic_access` → Convex query (reuse the membership logic already in
  `authBridge.userHasPermission`). **High priority** — called every request.
- `is_clinic_member` → Convex query.
- `process_recurring_expenses` → Convex mutation (port the pl/pgsql: find due
  recurring templates, insert expense rows, advance next-due). Needs the function
  body from `supabase/migrations/*` + tests (financial correctness).
- booking RPC (`public/book`) + `clinics/route.ts:196` RPC → Convex.
- `check_user_permission` / `get_user_permissions` → ✅ already in `authBridge.ts`.

## Phase C — Storage → Convex storage
- The mirror already has `uploadConvexStorageObject` / `recordStorageObject` +
  a `storage_objects` table. Rewrite `lib/snapshots/{storage,exporter,importer}.ts`
  to read/write Convex storage; migrate existing snapshot blobs.

## Phase D — Schema discovery without `information_schema`
- Rewrite `lib/snapshots/discovery.ts` to enumerate a **static/Convex** table list
  (the `MIRRORED_TABLES` set in `lib/convex/supabase-runtime-mirror.ts` is the
  canonical list) instead of querying the Postgres catalog. Unblocks export +
  `snapshots/discover` + `clinic/[id]/export`.

## Phase E — Triggers → Convex logic
- Port DB triggers to Convex mutations / onWrite logic: `after_clinic_insert`
  (seed `patient_sources` + `custom_categories`), price-recalc, lead/treatment
  backfill, etc. Inventory them from `supabase/migrations/*`.

## Phase F — Write cutover + decommission
1. Per domain, once read parity is verified (`convex-compare` clean): flip
   `DATA_WRITE_MODE_<DOMAIN>=convex` (convex-only writes).
2. Flip cron read domains together with their write domains (avoid stale processing).
3. When all domains are convex-only and Phases A–E are done: stop the mirror,
   remove `supabaseAdmin` / `lib/supabase/*`, delete the Supabase project.
4. Keep a final Supabase export/snapshot as cold backup before deleting.

---

## Suggested order (by unblock value × risk)
1. **B: `user_has_clinic_access` + `is_clinic_member`** — low risk, unblocks
   authorization independence (prereq for auth cutover). Do first.
2. **D: schema discovery static list** — low risk, unblocks export/snapshots fully.
3. **A: Convex Auth** — staged (A1 scaffold → A2 keys → A3 wiring → A4 migrate →
   A5 verify). Highest risk; needs hands-on login testing + the A4 decision.
4. **C: storage**, **E: triggers** — medium.
5. **F: write cutover + decommission** — last, per-domain, after each phase verified.

## What needs YOUR hands (cannot be safely automated headlessly)
- **A2**: generating/setting the Convex Auth JWT keys on the deployment.
- **A4**: choosing reset-on-cutover vs. dual grace period for user passwords.
- **A5 / F**: testing login flows and flipping production flags.
- Final Supabase project deletion (after a cold backup).

---

## PROGRESS — 2026-06-06 (Phases B, C, D, E done; A scaffolded)

All work flag-gated, default Supabase, zero production impact until flipped.
Typecheck stayed at the 189-error pre-existing baseline (zero new errors) and
new pure logic is unit-tested (19 tests green).

- **Phase D — DONE.** `lib/snapshots/static-schema.ts` enumerates the canonical
  clinic table list (byte-identical to the legacy `getKnownDirectTables()` +
  `KNOWN_INDIRECT_TABLES`); `discovery.ts` + `snapshots/discover` read it +
  Convex counts behind `DATA_READ_BACKEND_SNAPSHOTS`. No more `information_schema`
  for snapshot discovery. (`clinic/[id]/export` uses WorkspaceExporter, not
  discovery — still a Supabase-export edge; revisit if native Convex export is built.)
- **Phase B — DONE.** `convex/recurringExpenses.processDue` (PG-faithful date math
  in `convex/lib/recurringDates.ts`, unit-tested) + `convex/bookingAvailability.checkSlotAvailable`
  (migration-79 parity). `user_has_clinic_access`/`is_clinic_member` were already
  ported; `clinics` route now uses `convexUserHasClinicAccess` for true parity.
  Remaining RPC-on-Supabase: `process_recurring_expenses` only runs when
  `DATA_WRITE_MODE_EXPENSES=convex` (else the mirror handles it).
- **Phase E — DONE.** `lib/convex/clinic-seed.ts` ports `after_clinic_insert`
  (7 patient_sources, conditional 3 custom_categories, 10 whatsapp_templates),
  wired into onboarding + workspaces/[id]/clinics behind `shouldWriteConvexData('clinics')`.
  `deriveTreatmentPaymentState` (trigger 73) + reminder scheduling (trigger 61) in
  the convex treatment write path. Services price-recalc (trigger 68) already
  ported; comment added to prevent drift. updated_at stampers are mirror-handled.
- **Phase C — DONE.** Convex READ path for snapshot blobs
  (`migration.getStorageObjectUrl` + `downloadConvexStorageObject`/`getConvexStorageObjectUrl`
  + `storage.download`/`getSignedUrl` Convex-first behind `DATA_READ_BACKEND_STORAGE`,
  falling back to Supabase for pre-mirror blobs). Writes already mirrored.
  Pre-mirror blobs need `scripts/migration/import-convex-storage.mjs` before flipping.
- **Phase A — SCAFFOLDED (A1 + A4 seed).** `@convex-dev/auth` + `@auth/core`
  installed; `convex/{schema,auth,auth.config,http,ResendOTP,ResendOTPPasswordReset,authMigration}.ts`
  written (inert, NOT deployed). `schema.ts` uses `schemaValidation:false` (the 60
  mirror tables are never validated). The cutover (A2 keys, A3 client/server wiring,
  A5 testing, deploy) is the **operator runbook**:
  `docs/IMPORTANT/CONVEX-AUTH-CUTOVER-RUNBOOK.md`.

### Still on Supabase after this session
- Auth at runtime (Convex Auth scaffolded but not cut over — operator-gated).
- `process_recurring_expenses` / booking RPC fire on Supabase unless the per-domain
  write/read flag is `convex`.
- Pre-mirror storage blobs until the import script runs.
- `clinic/[id]/export` + `snapshots/discover` export edge (information_schema export path).
- **Phase F** (per-domain `DATA_WRITE_MODE=convex` flips + mirror decommission +
  Supabase deletion) — operator, last, after per-domain parity is verified.
