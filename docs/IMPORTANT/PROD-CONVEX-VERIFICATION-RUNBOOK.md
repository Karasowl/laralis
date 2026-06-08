# PROD Convex Verification Runbook

**Purpose:** re-run the automated test suite against the **live production deployment** to
prove the app reads and writes from **Convex** (not Supabase) on real production data —
without manual clicking and without touching the real clinic's account.

**Last verified:** 2026-06-08 — read 58/58 (no 5xx), write-lifecycle 9/9, features 4/4. All green.

> Future-you has none of the context below. Read the whole "Coordinates" section before running
> anything — the deployment names, accounts, and the `--cwd` quirk are the things you will not guess.

---

## TL;DR (the 4 commands)

```bash
# (all from the Bash cwd, which is C:\dev\laralis\apps\dental)

# 1. Read the REAL prod backend flags (note --cwd: the .vercel link is at the REPO ROOT)
vercel env pull /tmp/prod.env --environment=production --cwd "C:/dev/laralis" --yes
grep -iE "^DATA_(READ|WRITE)|^AUTH_BACKEND|^NEXT_PUBLIC_CONVEX_URL" /tmp/prod.env
#   expect: DATA_READ_BACKEND=convex  DATA_WRITE_MODE=convex  DATA_WRITE_MODE_STORAGE=convex
#           AUTH_BACKEND=dual         NEXT_PUBLIC_CONVEX_URL=https://superb-grouse-940.convex.cloud

# 2. Give the TEST account a known password (it logs in via prod Supabase, see "Why Supabase login")
SRK=$(awk -F= '/^SUPABASE_SERVICE_ROLE_KEY=/{gsub(/"/,"",$2);print $2}' /tmp/prod.env)
SUPA=$(awk -F= '/^NEXT_PUBLIC_SUPABASE_URL=/{gsub(/"/,"",$2);print $2}' /tmp/prod.env)
curl -s -o /dev/null -w "%{http_code}\n" -X PUT \
  "$SUPA/auth/v1/admin/users/61797a50-d07d-4d21-ac38-8ccb311a5f6b" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
  --data '{"password":"PICK-A-FRESH-PASSWORD"}'        # expect 200

# 3. Run the three smokes against the live site (creds via env, never hardcoded)
export CYPRESS_baseUrl="https://laralis.vercel.app"
export CYPRESS_PROD_EMAIL="adventismael@gmail.com"
export CYPRESS_PROD_PASS="PICK-A-FRESH-PASSWORD"
npx cypress run --spec cypress/e2e/prod-convex-read-smoke.cy.ts --browser electron
npx cypress run --spec cypress/e2e/prod-convex-write-lifecycle.cy.ts --browser electron
npx cypress run --spec cypress/e2e/prod-convex-write-features.cy.ts --browser electron

# 4. Clean up the temp file with secrets
rm -f /tmp/prod.env
```

If all three are green, production is serving and persisting through Convex. Done.

---

## What this proves (and what it does NOT)

| Layer | Covered? | Notes |
|---|---|---|
| **API reads from Convex** | ✅ | 58 GET endpoints on the live deployment, 0×5xx |
| **API writes to Convex** | ✅ | core CRUD + secondary modules create+delete through the Convex-only write path |
| **Real production runtime + data** | ✅ | hits `https://laralis.vercel.app`, real prod Convex `superb-grouse-940` |
| React UI rendering | ❌ | smokes hit `/api/*` directly. The migration changed the data layer, not rendering; the UI is a thin client over these APIs. |
| Convex-auth login | ❌ (by design) | prod login is still **Supabase** (`AUTH_BACKEND=dual`). That is the last remaining Supabase dependency, deferred on purpose. |

**Scope rationale:** the Supabase→Convex migration changed the **data layer** (API route reads/writes).
Verifying the API layer against real prod data is the correct scope. Auth/login was intentionally
left on Supabase and is tracked separately (see `CONVEX-AUTH-CUTOVER-RUNBOOK.md`).

---

## Coordinates (the things you can't guess)

### Vercel
- Project: **`laralis`** under org **`avanxia-labs`**.
- The `.vercel` link lives at the **repo root** `C:\dev\laralis\.vercel`, NOT in `apps/dental`.
  The Bash tool's cwd is `apps/dental`, so **every `vercel` command needs `--cwd "C:/dev/laralis"`**
  or it errors `not_linked`.
- Canonical prod domain: **`https://laralis.vercel.app`** (alias of the latest production deploy;
  confirm with `vercel inspect <deploy-url> --cwd C:/dev/laralis | grep Aliases`).
- **Sensitive env vars pull back blank.** Vars added as "sensitive" (e.g. `CONVEX_AUTH_BRIDGE_SECRET`)
  show empty in `vercel env pull`. `DATA_*`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_*` come back
  with real values. If you need a sensitive value, read it from its source of truth (Convex env for
  Convex secrets — see below), not the Vercel pull.

### Convex
- **Prod deployment: `superb-grouse-940`** → `https://superb-grouse-940.convex.cloud`.
- Dev deployment: `quaint-blackbird-737` (this is what `.env.local` / `npm run dev:dental` use).
- `npx convex ... --prod` targets prod; without `--prod` it hits dev. Examples:
  - `npx convex env get CONVEX_AUTH_BRIDGE_SECRET --prod`
  - `npx convex data <table> --prod --limit 50`
  - `npx convex run <fn> '<json-args>' --prod`
- Prod Convex has **only** `CONVEX_AUTH_BRIDGE_SECRET` set — it is missing the Convex-Auth JWT keys
  (`JWT_PRIVATE_KEY`/`JWKS`). So **convex-auth login does NOT work on prod** (correct: prod login is
  Supabase). Do not provision those keys just to test — that is the separate auth cutover.

### Accounts (in prod Convex `supabase_auth_users` mirror + prod Supabase `julrghzzqdgdwqaongct`)
- **TEST account — use this:** `adventismael@gmail.com` ("Isma Prueba")
  - auth UUID / `legacyId`: `61797a50-d07d-4d21-ac38-8ccb311a5f6b`
  - clinic `4d65a236-a192-4c8e-b4d7-a76549e9a18e`, workspace `2dce302d-6dfb-4a25-ab79-bdbb0e3710a9`
- **🚫 NEVER TOUCH:** `conladoctoralara@gmail.com` ("Lisandra Lara") — the **real doctora's** account
  (clinic `8e540d51-57b2-4e16-88c5-be613979e533`). Do not reset its password, do not link auth, do
  not write to its clinic.
- `vk@yopmail.com` — a throwaway account; ignore.

### Supabase (important gotcha)
- **Prod Supabase project: `julrghzzqdgdwqaongct`** (`NEXT_PUBLIC_SUPABASE_URL` in prod env).
- `apps/dental/cypress.env.json` points at a **different/old** project `ojlfihowjakbgobbrwjz` with user
  `ismaelguimarais@gmail.com`. **That user does NOT exist in prod.** Do not try to log into prod with it.
- Prod login is still Supabase, so to log the test account into the live site you set its prod-Supabase
  password via the admin API (step 2 above). The service-role key comes from the prod Vercel env pull
  (`SUPABASE_SERVICE_ROLE_KEY`, ~219 chars, non-sensitive so it pulls fine).

---

## Why the login is still Supabase (don't "fix" this)

`getAuthBackend()` checks `=== 'convex'`. Prod is `AUTH_BACKEND=dual`, so the login path is Supabase.
This is deliberate — auth is the **last** Supabase dependency and its cutover is a separate, deferred
step. The data layer (`DATA_READ_BACKEND` / `DATA_WRITE_MODE`) is already `convex`, which is what this
runbook verifies. Once `createClient()` is in convex mode its `.from()/.rpc()` THROW, so a write that
returns 2xx in `DATA_WRITE_MODE=convex` could only have gone through the Convex-only path — that's why
a green write smoke is proof the writes hit Convex, not Supabase.

---

## The smoke specs (committed, env-parameterized, no secrets)

| Spec | Asserts |
|---|---|
| `cypress/e2e/prod-convex-read-smoke.cy.ts` | logs in, GETs 58 authenticated endpoints, **0 return ≥500**; dumps statuses to `tmp/prod-convex-read-smoke.json` |
| `cypress/e2e/prod-convex-write-lifecycle.cy.ts` | create+delete (footprint zero) for fixed_costs, supplies, assets, categories, services, patients, expenses, patient_sources, and the full treatment recipe chain |
| `cypress/e2e/prod-convex-write-features.cy.ts` | create+delete for marketing/platforms, medications, marketing/campaigns, prescriptions |

They read creds from `Cypress.env('PROD_EMAIL')` / `Cypress.env('PROD_PASS')`, fed by the
`CYPRESS_PROD_EMAIL` / `CYPRESS_PROD_PASS` env vars. `baseUrl` comes from `CYPRESS_baseUrl`
(or `CYPRESS_BASE_URL`); default is `http://localhost:3000` (see `cypress.config.ts`).

### Known NON-failures (expected, not bugs)
- **7 endpoints return `400`** in the read smoke (`actions/history`, `analytics/compare`,
  `analytics/inventory/alerts`, `analytics/patients/stats`, `analytics/services/top`,
  `analytics/treatments/frequency`, `public/availability`). They require query params (date ranges,
  etc.) and the smoke hits them bare. `400` = input validation ran = the route works. The smoke only
  fails on `≥500`.
- **Treatments needs a service WITH a recipe** or the create returns `412 precondition_failed`
  ("Service has no recipe"). The write spec builds the full chain (supply → service → recipe line via
  `POST /api/services/{id}/supplies` → patient → treatment) so it passes on an empty clinic.
- `cy.session` login is occasionally flaky on the first try; re-run the spec.

---

## Flag reference (`apps/dental/lib/data-backend.ts`)

- `getDataReadBackend(domain)` → reads `DATA_READ_BACKEND_<DOMAIN>` then `DATA_READ_BACKEND`
  (`supabase`|`convex`). `shouldReturnConvexData()` = it's `convex`.
- `getDataWriteMode(domain)` → reads `DATA_WRITE_MODE_<DOMAIN>` then `DATA_WRITE_MODE`
  (`supabase`|`convex`|`dual`). `shouldUseConvexOnlyWritePath()` = it's `convex`;
  `shouldWriteConvexData()` = `convex` or `dual`.
- Per-domain overrides win over the blanket var, e.g. `DATA_WRITE_MODE_STORAGE=convex`.
- An empty-string value falls through to the default (`supabase`).

To flip a flag in prod (only if you know why):
`vercel env rm <NAME> production --cwd C:/dev/laralis --yes` then
`echo "convex" | vercel env add <NAME> production --no-sensitive --cwd C:/dev/laralis`
(use `--no-sensitive` or the value pulls back blank and you'll chase a ghost). Redeploy for it to
take effect: `vercel --prod --yes --cwd C:/dev/laralis`.

---

## Footprint / cleanup

- The write smokes delete everything they create. Two POST-only entities have no delete endpoint and
  leave one `E2E-…` row each in the test clinic per run: **medications** and **patient_sources**.
  Harmless (test clinic), prune manually in Convex if they pile up.
- 2026-06-08 setup that persists in prod Convex (idempotent, inert for the live Supabase-auth site):
  3 rows seeded into Convex `users` from the mirror (no passwords) + a password authAccount for the
  test account. These only matter once auth cuts over to Convex; safe to leave.
- Always `rm -f /tmp/prod.env` — it contains the service-role key.
- Never commit secrets. The test-account password is set ad-hoc each run and lives only in your shell.

---

## Related
- `docs/IMPORTANT/PHASE-F-WRITE-CUTOVER-RUNBOOK.md` — the write cutover itself.
- `docs/IMPORTANT/CONVEX-AUTH-CUTOVER-RUNBOOK.md` — the deferred auth cutover (the last Supabase dep).
- `docs/devlog/2026-06-08-prod-convex-live-verification.md` — the narrative of the first run.
