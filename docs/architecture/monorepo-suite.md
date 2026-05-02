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
