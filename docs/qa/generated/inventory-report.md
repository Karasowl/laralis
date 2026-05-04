# QA Inventory Report

Generated: 2026-05-04T00:31:41.032Z

Status: pass
Failing checks: 0
Warning checks: 0

## QA docs

Status: pass

required QA docs: 8; missing: 0

- ok: docs/qa/README.md
- ok: docs/qa/coverage-matrix.md
- ok: docs/qa/coverage-matrix.json
- ok: docs/qa/dataset.md
- ok: docs/qa/dataset.json
- ok: docs/qa/oracles.md
- ok: docs/qa/oracles.json
- ok: docs/qa/regression-log.md

## QA coverage matrix

Status: pass

capabilities: 44; domains: 22; required missing domains: 0

- status counts: partial=14, planned=23, covered=7
- priority counts: P0=38, P1=6

## QA dataset

Status: pass

clinics: 2; users: 6; patients: 30; treatments: 32; services: 3; supplies: 5

- Meta Mayo patients: 22
- Referidos patients: 7
- fixed costs cents: 4680000

## QA oracles

Status: pass

completed revenue cents: 7650000; variable cost cents: 331000; allocated fixed cents: 900000; average contribution cents: 252379

- oracle gross profit cents: 7319000
- oracle operating profit cents: 1979000

## QA stage seed

Status: pass

seed script: present; assert script: present; env example: present; package scripts: 6/6

- ok: qa:seed:plan
- ok: qa:seed
- ok: qa:seed:reset
- ok: qa:stage:assert
- ok: qa:oracles
- ok: qa:check

## Cypress spec inventory

Status: pass

declared spec scripts: 15; existing e2e specs: 7; missing declared specs: 0

- ok: test:e2e:multitenancy -> cypress/e2e/stage/04-multiclinic-isolation.cy.ts
- ok: test:e2e:auth -> cypress/e2e/stage/00-auth-and-shell.cy.ts
- ok: test:e2e:patients -> cypress/e2e/stage/01-readonly-dental-flow.cy.ts
- ok: test:e2e:supplies -> cypress/e2e/stage/03-crud-lifecycle.cy.ts
- ok: test:e2e:services -> cypress/e2e/stage/03-crud-lifecycle.cy.ts
- ok: test:e2e:treatments -> cypress/e2e/stage/03-crud-lifecycle.cy.ts
- ok: test:e2e:settings -> cypress/e2e/stage/05-permission-boundaries.cy.ts
- ok: test:e2e:marketing -> cypress/e2e/stage/02-qa-business-oracles.cy.ts
- ok: test:e2e:stage -> cypress/e2e/stage/**/*.cy.ts (7 specs)
- ok: test:e2e:stage:headed -> cypress/e2e/stage/**/*.cy.ts (7 specs)
- ok: test:e2e:stage:business -> cypress/e2e/stage/02-qa-business-oracles.cy.ts
- ok: test:e2e:stage:crud -> cypress/e2e/stage/03-crud-lifecycle.cy.ts
- ok: test:e2e:stage:multiclinic -> cypress/e2e/stage/04-multiclinic-isolation.cy.ts
- ok: test:e2e:stage:permissions -> cypress/e2e/stage/05-permission-boundaries.cy.ts
- ok: test:e2e:stage:booking -> cypress/e2e/stage/06-public-booking-notifications.cy.ts

## i18n parity

Status: pass

en keys: 4943; es effective keys: 4943; missing en: 0; missing es: 0

## UI test hooks

Status: pass

ui files: 435; files with data-testid: 11; data-testid occurrences: 30; required hooks: 13; missing required hooks: 0

- has hooks: app/auth/login/page.tsx
- has hooks: app/book/[slug]/confirmation/page.tsx
- has hooks: app/book/[slug]/page.tsx
- has hooks: app/marketing/page.tsx
- has hooks: app/services/page.tsx
- has hooks: app/settings/notifications/NotificationsClient.tsx
- has hooks: app/settings/notifications/page.tsx
- has hooks: app/treatments/page.tsx
- has hooks: components/layouts/AppLayout.tsx
- has hooks: components/layouts/ContextIndicator.tsx
- has hooks: components/ui/crud-page-layout.tsx

## API permission surface

Status: pass

api routes: 161; permission guard: 111 (withPermission: 30, manual: 81); qa classified: 15; using supabaseAdmin: 129; admin without permission/cron guard/classification: 0

## Cron guard inventory

Status: pass

cron entries: 5; missing/unguarded: 0

- ok: /api/cron/complete-appointments (1 0 * * *)
- ok: /api/cron/recurring-expenses (5 0 * * *)
- ok: /api/cron/send-reminders (*/15 * * * *)
- ok: /api/cron/snapshots (0 3 * * *)
- ok: /api/cron/cleanup-draft-workspaces (30 3 * * *)
