# Convex Auth Cutover Runbook (Phase A)

> Goal: replace Supabase Auth with **Convex Auth** (`@convex-dev/auth`),
> **email/password only** (no Google/social). Everything stays behind
> `AUTH_BACKEND` / `NEXT_PUBLIC_AUTH_BACKEND` (default `supabase`) until the steps
> below are done and verified. Date scaffolded: 2026-06-06.

## What is already done (committed, inert, build-verified)

The library scaffold + identity bridge + **client/server A3 wiring** are in the repo,
flag-gated (default supabase => byte-identical; `npm run build:dental` passes), **not deployed**:

**A1 scaffold (convex/):**
- `schema.ts` — `defineSchema({ ...authTables }, { schemaValidation: false })`.
- `auth.ts` — `convexAuth({ providers: [Password({ verify: ResendOTP, reset: ResendOTPPasswordReset, profile })] })`.
- `ResendOTP.ts` / `ResendOTPPasswordReset.ts` — 8-digit OTP via Resend (inline Web Crypto, no extra dep).
- `http.ts` — `auth.addHttpRoutes(http)`. `auth.config.ts` — JWT (`domain: CONVEX_SITE_URL`).
- `authMigration.ts` — `seedAuthUsersFromMirror` (A4 seed) + `currentUserLegacyId` (token→UUID via `getAuthUserId`).
- `@convex-dev/auth@0.0.93` + `@auth/core@0.37.0` installed.

**A3 wiring already done (committed):**
- `components/providers/convex-auth-provider.tsx` — `ConvexAuthClientProvider`.
- `app/layout.tsx` — wraps `<html>` with `ConvexAuthNextjsServerProvider` + mounts the
  client provider, ONLY when `getAuthBackend() !== 'supabase'`.
- `hooks/use-auth.ts` — **login + logout** convex branches via `useAuthActions()`
  (constant-gated on `NEXT_PUBLIC_AUTH_BACKEND` so it's never called in supabase mode).
- `lib/convex/server.ts` `getConvexAuthUserLegacyId()` — reads the Convex Auth token,
  maps token-subject → Supabase UUID via `authMigration:currentUserLegacyId`
  (`makeFunctionReference`, so it typechecks before the operator deploys).
- `lib/clinic.ts` `resolveClinicContext` + `lib/supabase/server.ts`
  `createConvexOnlyServerClient` — server identity resolved from the token (UUID),
  feeding the existing `resolveConvexClinicContext`. Both behind `getAuthBackend()==='convex'`.

**Still to apply (operator — needs live testing; see A3-remaining below):** the
**middleware + config.matcher** integration (changes shared routing), and the
**register / reset / email-verify OTP** flows + the verify-email/reset-password page
UI + i18n. These need the running app + keys (A2) to verify, so they are NOT yet wired.

The **hand-rolled** Convex login that predates this (`/api/auth/convex-login`, HMAC
cookie, scrypt creds) still works as the `AUTH_BACKEND=convex` path **today** and is the
fallback in `use-auth.ts` when the @convex-dev/auth provider is not mounted.

## What YOU do (needs deployment env + live login testing)

### A2 — Generate JWT keys + set Convex env vars (NEVER in .env.local)

From `apps/dental`:

```bash
npx @convex-dev/auth          # generates JWT_PRIVATE_KEY + JWKS, sets SITE_URL on the deployment
# or manually:
npx convex env set JWT_PRIVATE_KEY "<pkcs8 private key>"
npx convex env set JWKS '<jwks json>'
npx convex env set SITE_URL http://localhost:3000          # prod: your app URL
npx convex env set AUTH_RESEND_KEY <resend api key>        # ResendOTP runs INSIDE Convex
npx convex env set AUTH_EMAIL "Laralis <noreply@laralis.com>"
```

`AUTH_RESEND_KEY` is a **Convex** env var (the OTP provider runs in the deployment),
separate from the Next.js `RESEND_API_KEY` used for appointment emails.

### Deploy the scaffold

```bash
cd apps/dental && npx convex dev --once --typecheck disable
```

This pushes `schema.ts` + `auth.ts` + `http.ts` + `authMigration.ts` and regenerates
`convex/_generated/api.*` (adds `api.auth.*`, `api.authMigration.*`).

> **VERIFY THE SCHEMA PUSH IS SAFE FIRST.** The deployment holds ~60 untyped mirror
> tables. `schema.ts` uses `{ schemaValidation: false }` so the push only ADDS the
> auth tables/indexes and never validates/rejects the mirror tables. Confirm the push
> reports no validation errors against existing data before continuing. (If Convex
> ever rejects undeclared tables on your version, keep `schemaValidation: false`.)

### A4 — Decide password migration, then seed identities

Decision (recommended: **reset-on-cutover**):

- **Reset-on-cutover**: pre-seed Convex Auth `users` from the `supabase_auth_users`
  mirror (preserving the UUID as `legacyId`), and every user sets a new password via
  the reset flow on first Convex login. Passwords are NOT migrated (scrypt formats
  differ). One-time friction, clean break.
- **Dual grace period**: run `AUTH_BACKEND=dual` so the existing
  `bridgeConvexPasswordCredential` keeps capturing passwords; flip to `convex` after N weeks.

Run the seed (idempotent, secret-gated):

```bash
# from apps/dental, with CONVEX_AUTH_BRIDGE_SECRET available:
npx convex run authMigration:seedAuthUsersFromMirror '{"secret":"<CONVEX_AUTH_BRIDGE_SECRET>"}'
# -> { created, skipped, total }
```

### A3 — DONE (committed) vs remaining

**Set BOTH** `AUTH_BACKEND` and `NEXT_PUBLIC_AUTH_BACKEND` to `convex` — the server
reader (`getAuthBackend()`) and the client reader (`NEXT_PUBLIC_AUTH_BACKEND`) must agree.

**DONE (committed, build-verified):** client provider, layout provider mount,
`use-auth.ts` **login + logout** via `useAuthActions()` (constant-gated, with the hook
guard already applied), `getConvexAuthUserLegacyId()`, and the server identity in
`resolveClinicContext` + `createConvexOnlyServerClient`. Nothing to do for these.

**REMAINING (apply, then test under A5):**

**R1. `apps/dental/middleware.ts` + `config.matcher`** — delegate to
`convexAuthNextjsMiddleware` when convex. NOTE: this also requires extending
`config.matcher` to include `/api/auth` so the auth proxy route is handled (the current
matcher EXCLUDES `/api`). That matcher change affects shared routing, so test it.
Verified API shape:

```ts
import { convexAuthNextjsMiddleware, nextjsMiddlewareRedirect } from '@convex-dev/auth/nextjs/server'
import { getAuthBackend } from './lib/auth/convex-session'

// rename the current `export async function middleware(request)` body to:
async function supabaseMiddleware(request: NextRequest) { /* existing body, unchanged */ }

const PUBLIC_PATHS = ['/auth/login','/auth/register','/auth/forgot-password','/auth/reset-password','/auth/convex-reset-password','/auth/callback','/auth/logout','/auth/verify-email','/terms','/privacy','/book']

const convexMiddleware = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/_next') || pathname.includes('.')) return
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const authed = await convexAuth.isAuthenticated()
  if (!authed && !isPublic && !pathname.startsWith('/api')) {
    return nextjsMiddlewareRedirect(request, '/auth/login')
  }
  // workspace-destination redirects deferred to the page layer in convex mode.
})

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  return getAuthBackend() === 'convex' ? convexMiddleware(request, event) : supabaseMiddleware(request)
}
// add the auth API route so the proxy is reachable (keep the existing negative-lookahead entry):
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] }
```

The default `apiRoute` is `/api/auth`; there is no top-level `/api/auth/route.ts` so it
does not collide with a literal route. If the proxy hijacks `/api/auth/*` utility routes
(delete-account, me, ...) in convex mode, set a custom `apiRoute` on BOTH
`ConvexAuthNextjsServerProvider apiRoute="/api/convex-auth"` and
`convexAuthNextjsMiddleware(handler, { apiRoute: '/api/convex-auth' })`.

**R2. `apps/dental/hooks/use-auth.ts` register + reset (OTP)** — login/logout are done;
add the OTP flows (the `convexAuthActions` const already exists in the hook):

```ts
// register (convex branch): await convexAuthActions.signIn('password', { email, password, name: fullName, flow: 'signUp' })
//   -> Password.verify=ResendOTP sends an email code -> router.push(`/auth/verify-email?email=...`)
// verify-email step:        await convexAuthActions.signIn('password', { email, code, flow: 'email-verification' })
// resetPassword (convex):   await convexAuthActions.signIn('password', { email, flow: 'reset' }) -> route to reset page
// reset confirm step:       await convexAuthActions.signIn('password', { email, code, newPassword, flow: 'reset-verification' })
```

**R3. `verify-email` + `reset-password` pages** — add an OTP code-input step (convex mode)
calling the `email-verification` / `reset-verification` flows above. ALL new strings via
next-intl in BOTH `messages/en.json` and `messages/es.json` (ZERO hardcoded text).

### A5 — Test (preview/local only, never prod, never .env.local)

Set `AUTH_BACKEND=convex` + `NEXT_PUBLIC_AUTH_BACKEND=convex`, run `npx convex dev` +
`npm run dev:dental`, and verify:

- [ ] sign-up → OTP email arrives (Resend) → verify → lands authenticated
- [ ] sign-in with the reset password
- [ ] reset password via OTP
- [ ] logout
- [ ] `resolveClinicContext` returns the correct clinic (identity resolved by UUID,
      so memberships/permissions match) — the #1 correctness risk
- [ ] Cypress `00-auth-and-shell` parameterized for the convex backend

### Flag flip order (production)

1. Deploy scaffold + set Convex env (A2). 2. Seed identities (A4). 3. Apply A3 wiring +
verify on preview (A5). 4. Flip `AUTH_BACKEND` + `NEXT_PUBLIC_AUTH_BACKEND` to `convex`.
5. Remove the OAuth callback (`app/auth/callback`) once no Supabase email links remain.

## Top correctness risks (do not skip)

- **UUID join trap (#1):** the whole app keys identity off the Supabase UUID. Convex
  Auth mints its own `users._id`. The `legacyId` on each users doc (seeded by
  `seedAuthUsersFromMirror`) + `currentUserLegacyId` translation is load-bearing — get
  it wrong and every user sees zero clinics.
- **Password hashes are NOT portable** (scrypt formats differ) → reset-on-cutover.
- **Two flag readers must agree** — set BOTH `AUTH_BACKEND` and `NEXT_PUBLIC_AUTH_BACKEND`.
- **Convex env vs Next env** — `AUTH_RESEND_KEY`/`JWT_PRIVATE_KEY`/`JWKS`/`SITE_URL` are
  Convex-side (`npx convex env set`), never `.env.local`.
