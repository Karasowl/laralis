# QA Inventory Report

Generated: 2026-05-03T20:58:02.651Z

Status: fail
Failing checks: 3
Warning checks: 1

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

- status counts: partial=14, planned=25, covered=5
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

Status: fail

declared spec scripts: 14; existing e2e specs: 6; missing declared specs: 8

- missing: test:e2e:multitenancy -> cypress/e2e/multi-tenancy.cy.ts
- missing: test:e2e:auth -> cypress/e2e/01-auth.cy.ts
- missing: test:e2e:patients -> cypress/e2e/02-patients.cy.ts
- missing: test:e2e:supplies -> cypress/e2e/03-supplies.cy.ts
- missing: test:e2e:services -> cypress/e2e/04-services.cy.ts
- missing: test:e2e:treatments -> cypress/e2e/05-treatments.cy.ts
- missing: test:e2e:settings -> cypress/e2e/06-fixed-costs-settings.cy.ts
- missing: test:e2e:marketing -> cypress/e2e/07-marketing.cy.ts
- ok: test:e2e:stage -> cypress/e2e/stage/**/*.cy.ts (6 specs)
- ok: test:e2e:stage:headed -> cypress/e2e/stage/**/*.cy.ts (6 specs)
- ok: test:e2e:stage:business -> cypress/e2e/stage/02-qa-business-oracles.cy.ts
- ok: test:e2e:stage:crud -> cypress/e2e/stage/03-crud-lifecycle.cy.ts
- ok: test:e2e:stage:multiclinic -> cypress/e2e/stage/04-multiclinic-isolation.cy.ts
- ok: test:e2e:stage:permissions -> cypress/e2e/stage/05-permission-boundaries.cy.ts

## i18n parity

Status: fail

en keys: 4814; es effective keys: 4943; missing en: 129; missing es: 0

- missing en: actions.call
- missing en: dashboard.depreciation
- missing en: dashboard.ebitda
- missing en: dashboard.ebitda_description
- missing en: dashboard.expense_breakdown
- missing en: dashboard.fixed_costs
- missing en: dashboard.gross_margin
- missing en: dashboard.gross_profit
- missing en: dashboard.healthy
- missing en: dashboard.net_profit
- missing en: dashboard.operating_margin
- missing en: dashboard.operating_profit
- missing en: dashboard.real_margin
- missing en: dashboard.real_profit
- missing en: dashboard.variable_costs
- missing en: dashboardComponents.marketingROI.help.example
- missing en: dashboardComponents.marketingROI.help.interpretation
- missing en: dashboardComponents.marketingROI.help.tip
- missing en: fixedCosts.breakdownSections.automatic
- missing en: fixedCosts.breakdownSections.manual
- missing en: fixedCosts.summary.includingDepreciation
- missing en: fixedCosts.summary.manualCosts
- missing en: home.metrics.attended
- missing en: home.metrics.attendedPatients
- missing en: services.please_import_supplies
- missing en: settings.notifications.confirmation
- missing en: settings.notifications.confirmationEnabled
- missing en: settings.notifications.confirmationEnabledDescription
- missing en: settings.notifications.emailEnabled
- missing en: settings.notifications.emailEnabledDescription
- missing en: settings.notifications.failed
- missing en: settings.notifications.history
- missing en: settings.notifications.historyDescription
- missing en: settings.notifications.hours
- missing en: settings.notifications.noHistory
- missing en: settings.notifications.pending
- missing en: settings.notifications.reminder
- missing en: settings.notifications.reminderEnabled
- missing en: settings.notifications.reminderEnabledDescription
- missing en: settings.notifications.reminderHoursBefore
- missing en: ...89 more

## UI test hooks

Status: fail

ui files: 435; files with data-testid: 1; data-testid occurrences: 4

- components/layouts/ContextIndicator.tsx

## API permission surface

Status: warn

api routes: 161; permission guard: 100 (withPermission: 29, manual: 71); using supabaseAdmin: 129; admin without permission/cron guard: 26

- app/api/auth/delete-account/route.ts
- app/api/auth/delete-account/send-code/route.ts
- app/api/clinics/discount/route.ts
- app/api/clinics/route.ts
- app/api/clinics/[id]/route.ts
- app/api/export/generate/route.ts
- app/api/export/import/route.ts
- app/api/inbox/convert/route.ts
- app/api/invitations/accept/[token]/route.ts
- app/api/invitations/reject/[token]/route.ts
- app/api/notifications/push/subscribe/route.ts
- app/api/notifications/push/track-click/route.ts
- app/api/notifications/push/unsubscribe/route.ts
- app/api/notifications/send-confirmation/route.ts
- app/api/permissions/check/route.ts
- app/api/permissions/my/route.ts
- app/api/public/availability/route.ts
- app/api/public/book/route.ts
- app/api/public/clinic/[slug]/route.ts
- app/api/settings/notifications/test/route.ts
- app/api/setup/status/route.ts
- app/api/whatsapp/webhook/route.ts
- app/api/workspaces/route.ts
- app/api/workspaces/[id]/clinics/route.ts
- app/api/workspaces/[id]/lifecycle/route.ts
- app/api/workspaces/[id]/route.ts

## Cron guard inventory

Status: pass

cron entries: 5; missing/unguarded: 0

- ok: /api/cron/complete-appointments (1 0 * * *)
- ok: /api/cron/recurring-expenses (5 0 * * *)
- ok: /api/cron/send-reminders (*/15 * * * *)
- ok: /api/cron/snapshots (0 3 * * *)
- ok: /api/cron/cleanup-draft-workspaces (30 3 * * *)
