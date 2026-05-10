# Laralis Stage Regression Tests

This suite is the first regression net for the dental app on the stage deployment.

## Tools

- Cypress: browser flows and visual debugging.
- Vitest: pure logic, calculations, and API helpers.
- Thunder Client: manual API collections. Authenticated app APIs still rely on Supabase cookies, so Cypress is the reliable automated layer for authenticated API checks.

## Stage Target

- URL: `https://laralis-monorepo-preview.vercel.app`
- Branch: `codex/monorepo-suite`
- App root: `apps/dental`
- Expected active clinic: `PoDent`
- Expected active workspace: `Lara`

## Required Local Environment

Do not commit credentials. Provide them from the shell:

```powershell
$env:CYPRESS_STAGE_TEST_EMAIL = "doctor@example.com"
$env:CYPRESS_STAGE_TEST_PASSWORD = "..."
npm --workspace @laralis/dental run test:e2e:stage
```

For interactive debugging:

```powershell
$env:CYPRESS_STAGE_TEST_EMAIL = "doctor@example.com"
$env:CYPRESS_STAGE_TEST_PASSWORD = "..."
npm --workspace @laralis/dental run test:e2e:stage:open
```

## Current Coverage

- Protected routes redirect to login.
- Existing account registration stays on register and shows a clear existing-account error.
- Doctor login reaches the active clinic, not onboarding/setup.
- Language switching does not expose setup cancellation or onboarding for an active workspace.
- `analyze-patient-retention` keeps the smoke behavior that caught the previous env regression.
- Patients page loads real data, filters, and create-patient source/campaign fields without saving.
- Marketing page loads platforms and campaigns used for attribution.
- Treatments page loads and preserves clinic context when navigating back to patients.

## Guardrails

- These tests are read-only against PoDent.
- Destructive tests must use a separate QA workspace/clinic and a seed/reset script.
- If a manual bug is found, add a Cypress spec before fixing the bug.

