# Phase F — Write cutover + Supabase decommission (runbook)

> The final, **irreversible** phase: flip production writes to Convex-only per domain,
> then remove Supabase entirely. Do this gradually, per domain, with verification at
> each step. Date prepared: 2026-06-07.

## Readiness (verified 2026-06-07)

- ✅ **Dual-write coverage complete.** `node scripts/migration/audit-dual-write-coverage.mjs`
  → `highRisk: 0, manualReview: 0` over 449 files (101 with Supabase writes). Every write
  goes through a mirrored client, so flipping to convex-only loses no writes.
- ✅ **Convex mirror populated.** `npx convex run migration:tableCounts '{}'` → 35 tables,
  ~2,488 rows on the dev deployment (treatments 430, patients 246, expenses 122, services
  27, clinics 4, role_permissions 463, ...). Dual-write has been syncing.
- ✅ **Phases A–E done + tested.** Convex Auth cutover wired + 7/7 browser E2E pass
  (`cypress/e2e/convex-auth-smoke.cy.ts`, incl. a real login). RPCs/triggers/storage/discovery ported.
- ⏳ **Read parity per domain** — verify in the deployed env (below) before flipping writes.

## Flags recap (`lib/data-backend.ts`, default supabase)

- `DATA_READ_BACKEND[_<DOMAIN>]=convex` — reads from Convex.
- `DATA_WRITE_MODE[_<DOMAIN>]`: `supabase` (default) | `dual` (Supabase + mirror) | `convex` (Convex only).
- Domains with a convex-only write path today: assets, categories, expenses, fixed_costs,
  patient_sources, patients, services, settings_time, supplies, treatments. (Domain key =
  uppercased table, e.g. `DATA_WRITE_MODE_PATIENTS`.)

## Step 0 — Cold backup (do FIRST, before any write flip)

```bash
node apps/dental/scripts/migration/supabase-full-export.mjs   # full Supabase dump -> tmp/
```
Keep this export until well after decommission. It is the only rollback for data.

## Step 1 — Per-domain read parity (deployed env where BOTH backends are configured)

For each domain, confirm Convex == Supabase before trusting Convex:
```
GET /api/migration/convex-compare            # diff row counts + content per table
GET /api/migration/convex-health             # mirror health
```
Or run `DATA_BACKEND=dual_read` + `DATA_COMPARE_CONVEX=1` in production for a window and
watch the compare logs. A domain is parity-clean when convex-compare reports it identical.

## Step 2 — Flip reads, then writes, per domain (one at a time)

Order by blast radius (low first): settings_time → assets → fixed_costs → supplies →
categories/patient_sources → services → expenses → patients → treatments.

For each domain `D`:
1. `DATA_READ_BACKEND_<D>=convex` — serve reads from Convex. Watch the app + convex-compare.
2. After a clean observation window: `DATA_WRITE_MODE_<D>=convex` — writes go Convex-only.
3. Flip the domain's **cron** read/write together (recurring-expenses, send-reminders, etc.)
   so background jobs don't process stale Supabase rows.
4. Verify: create/edit a record in `D`, confirm it appears in Convex and the UI.

Local validation of a convex-only write (no Supabase needed locally — that's the point):
set `DATA_WRITE_MODE_<D>=convex` + `DATA_READ_BACKEND=convex` in `.env.local`, log in
(`cypress/e2e/convex-auth-smoke.cy.ts` shows the pattern), create a record, confirm via
`npx convex run migration:tableCounts '{}'` that the table count grew.

## Step 3 — Auth cutover (if not already flipped)

`AUTH_BACKEND=convex` + `NEXT_PUBLIC_AUTH_BACKEND=convex` (set BOTH). Apply the remaining
auth items in `CONVEX-AUTH-CUTOVER-RUNBOOK.md` (the middleware/OTP/use-auth are already
wired; A2 keys are already set on the dev deployment — repeat for prod with prod SITE_URL).
Run `authMigration:seedAuthUsersFromMirror` once so existing users keep their UUID; they
reset passwords on first login. Remove `convex/testHelpers.ts` (test-only) before prod.

## Step 4 — Storage blobs

Before `DATA_READ_BACKEND_STORAGE=convex`: import pre-mirror blobs:
```bash
node apps/dental/scripts/migration/import-convex-storage.mjs --buckets clinic-snapshots
```

## Step 5 — Decommission (after ALL domains are convex-only and verified)

1. Set `CONVEX_RUNTIME_MIRROR_ENABLED=0` (stop mirroring; Convex is now source of truth).
2. Remove Supabase from the code:
   - delete `lib/supabaseAdmin.ts`, `lib/supabase/*`, `lib/convex/supabase-runtime-mirror.ts`;
   - drop `@supabase/supabase-js` + `@supabase/ssr` from package.json;
   - the per-route Convex branches become the only path — remove the dead Supabase branches.
   - Re-run `audit-dual-write-coverage.mjs` to confirm no Supabase writes remain.
3. Remove the Supabase env vars from Vercel.
4. **Only after a verified cold backup + a soak period:** delete the Supabase project.

## Rollback (per step, before deletion)

- Read flip bad → set `DATA_READ_BACKEND_<D>=supabase`.
- Write flip bad → set `DATA_WRITE_MODE_<D>=dual` (re-enables Supabase + mirror); the rows
  written Convex-only during the bad window must be back-filled to Supabase from Convex.
- Auth flip bad → `AUTH_BACKEND=supabase`.
- Everything reverts by flag until Step 5.2 (code removal) / the Supabase project deletion,
  which are the true points of no return — gate those behind a long soak.

## What needs YOUR hands (cannot be safely automated)

- The cold backup, the production read/write flag flips + monitoring, the storage import,
  and the final Supabase project deletion. These are deliberate, monitored, irreversible
  production operations.
