# Laralis Suite Monorepo

## Purpose

This branch converts the existing Laralis repository into a monorepo so multiple Laralis products can share infrastructure without breaking the current dental app.

## Current Apps

- `apps/dental`: the existing Laralis dental product, moved from `web/`.

## Planned Apps

- `apps/home`: personal/family finance, budget, debts, receivables, savings, investments, and net worth.
- `apps/business`: general business operations outside the dental vertical.
- `apps/hub`: account-level shell for selecting and integrating Laralis products.

## Migration Rules

- Keep `apps/dental` behaviorally unchanged until it builds and runs from its new path.
- Prefer mechanical moves first, feature work later.
- Do not extract shared packages prematurely.
- Add shared packages only when at least two apps have a concrete need for the same code.

## Initial Commands

From the repository root:

```bash
npm run dev:dental
npm run build:dental
npm run typecheck:dental
npm run i18n:check:dental
```

## Vercel Preview

Use a separate preview project or branch configuration with `apps/dental` as the Vercel root directory. Keep the existing production Laralis project pointing at `web` until this branch is merged, otherwise the current production deploy can break before the monorepo migration lands on `main`.

### Production Preview Project

As of 2026-05-02, the monorepo branch has a separate Vercel project for previewing the dental app without touching the production Laralis project:

- URL: `https://laralis-monorepo-preview.vercel.app`
- Vercel project: `laralis-monorepo-preview`
- Vercel project id: `prj_MbpPaJmbxyymHLXLGjVNkJIailta`
- Scope: `avanxia-labs`
- Git branch: `codex/monorepo-suite`
- Root directory: `apps/dental`
- Framework: Next.js
- Build command: `npm run build`
- Install command: `npm install`
- Node runtime: `24.x`

The original production project must stay on `main` until the monorepo branch is intentionally merged.

### Supabase Staging

As of 2026-05-02, the preview project is wired to a separate Supabase staging project instead of the production database:

- Supabase project: `laralis-stage`
- Project ref: `kafbqdliromcveojtdar`
- Region: AWS `us-west-2`
- Project URL: `https://kafbqdliromcveojtdar.supabase.co`
- Vercel project using it: `laralis-monorepo-preview`

The preview Vercel project must use the staging values for:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not point `laralis-monorepo-preview` back to the production Supabase project unless the branch is being intentionally validated against production data.

### Staging Data Snapshot

The staging project was populated from the production Supabase Postgres database with native `pg_dump` and `psql`, without writing to production.

Verification after restore:

- Public app tables match exactly: `2126` rows in production and `2126` rows in staging.
- `auth.users` matches: `3` rows in both projects.
- `auth.identities` matches: `0` rows in both projects.
- `storage.buckets` matches: `1` row in both projects.
- `storage.objects` matches: `248` rows in both projects.
- Overall comparison: `75` of `76` checked tables matched.

The only mismatch was `storage.migrations`, with `61` rows in production and `59` rows in staging. That is Supabase internal Storage migration metadata for the different project versions, not Laralis business data.

The Supabase Storage object files were also copied after the Postgres restore:

- Bucket copied: `clinic-snapshots`
- Objects copied: `248`
- Copy failures: `0`
- Bytes copied: `7990604`
- Staging download smoke check: one restored object downloaded successfully with `71971` bytes.

### Vercel Environment Copy Caveat

When copying environment variables between Vercel projects, do not rely on the bulk endpoint with `decrypt=true`:

```text
GET /api/v10/projects/{projectId}/env?decrypt=true
```

In practice, that endpoint can still return encrypted blobs in the bulk list. If those values are copied into a new project, the Next.js build can fail while collecting page data with errors such as:

```text
Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL
```

Use the per-environment-variable endpoint instead:

```text
GET /api/v1/projects/{projectId}/env/{envId}?decrypt=true
```

Copy each decrypted value individually, then redeploy. Do not write secret values into docs, chat, screenshots, build logs, or repo files.

### Preview Smoke Checks

For the current preview deployment, the homepage returned HTTP `200` and served the login screen. The retention endpoint also loaded correctly:

- `GET /api/actions/analyze-patient-retention` returns HTTP `405`, because the route only implements `POST`.
- Unauthenticated `POST /api/actions/analyze-patient-retention` with a valid-shaped JSON body returns HTTP `401 {"error":"Unauthorized"}`.

That `401` is the expected unauthenticated response and confirms the deployed route no longer fails at Supabase client initialization with an invalid URL. A full success-path test still requires an authenticated Supabase session and a clinic id the logged-in user can access.
