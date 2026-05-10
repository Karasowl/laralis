# QA Inventory Report

Generated: 2026-05-10T18:59:11.160Z

Status: warn
Failing checks: 0
Warning checks: 2

## QA docs

Status: pass

required QA docs: 12; missing: 0

- ok: docs/qa/README.md
- ok: docs/qa/coverage-matrix.md
- ok: docs/qa/coverage-matrix.json
- ok: docs/qa/product-readiness.md
- ok: docs/qa/product-readiness.json
- ok: docs/qa/numeric-oracles.md
- ok: docs/qa/numeric-oracles.json
- ok: docs/qa/dataset.md
- ok: docs/qa/dataset.json
- ok: docs/qa/oracles.md
- ok: docs/qa/oracles.json
- ok: docs/qa/regression-log.md

## QA coverage matrix

Status: pass

capabilities: 94; domains: 33; required missing domains: 0

- status counts: covered=91, partial=1, planned=2
- priority counts: P0=79, P1=15

## Product readiness truth table

Status: warn

areas: 9; implementation: partial=9; coverage: provider-mock=4, provider-contract=2, contract-only=1, real=2; open P0 risks: 7

- open: inbox-whatsapp-actions [P0] implementation=partial, coverage=provider-mock; not proven=1
- open: booking-notifications [P0] implementation=partial, coverage=provider-mock; not proven=3
- open: lara-ai-actions-audio [P0] implementation=partial, coverage=provider-mock; not proven=6
- open: push-notifications [P1] implementation=partial, coverage=provider-contract; not proven=5
- open: whatsapp-inbound-webhook [P0] implementation=partial, coverage=provider-contract; not proven=5
- open: whatsapp-provider-settings [P0] implementation=partial, coverage=provider-mock; not proven=3
- open: visual-regression [P1] implementation=partial, coverage=contract-only; not proven=4
- open: data-portability-exports [P0] implementation=partial, coverage=real; not proven=3
- open: numeric-oracle-spine [P0] implementation=partial, coverage=real; not proven=5

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

## Numeric oracle audit

Status: warn

numeric metric groups: 11; assertions: 57; statuses: covered=10, planned=1; open P0: 1

- open numeric P0: num-011-goal-setting-and-targets [planned] Validar objetivos de dinero, pacientes, tratamientos y marketing cuando el producto tenga flujo estable de metas.

## QA stage seed

Status: pass

seed script: present; assert script: present; env example: present; package scripts: 8/8

- ok: qa:seed:plan
- ok: qa:seed
- ok: qa:seed:reset
- ok: qa:stage:assert
- ok: qa:stage:prepare
- ok: qa:oracles
- ok: qa:numeric
- ok: qa:check

## Cypress spec inventory

Status: pass

declared spec scripts: 52; existing e2e specs: 43; missing declared specs: 0

- ok: test:e2e:multitenancy -> cypress/e2e/stage/04-multiclinic-isolation.cy.ts
- ok: test:e2e:auth -> cypress/e2e/stage/00-auth-and-shell.cy.ts
- ok: test:e2e:patients -> cypress/e2e/stage/01-readonly-dental-flow.cy.ts
- ok: test:e2e:supplies -> cypress/e2e/stage/03-crud-lifecycle.cy.ts
- ok: test:e2e:services -> cypress/e2e/stage/03-crud-lifecycle.cy.ts
- ok: test:e2e:treatments -> cypress/e2e/stage/03-crud-lifecycle.cy.ts
- ok: test:e2e:settings -> cypress/e2e/stage/05-permission-boundaries.cy.ts
- ok: test:e2e:marketing -> cypress/e2e/stage/02-qa-business-oracles.cy.ts
- ok: test:e2e:stage -> cypress/e2e/stage/**/*.cy.{js,ts} (43 specs)
- ok: test:e2e:stage:headed -> cypress/e2e/stage/**/*.cy.{js,ts} (43 specs)
- ok: test:e2e:stage:core-navigation -> cypress/e2e/stage/29-core-navigation-smoke.cy.ts
- ok: test:e2e:stage:business -> cypress/e2e/stage/02-qa-business-oracles.cy.ts
- ok: test:e2e:stage:crud -> cypress/e2e/stage/03-crud-lifecycle.cy.ts
- ok: test:e2e:stage:multiclinic -> cypress/e2e/stage/04-multiclinic-isolation.cy.ts
- ok: test:e2e:stage:permissions -> cypress/e2e/stage/05-permission-boundaries.cy.ts
- ok: test:e2e:stage:booking -> cypress/e2e/stage/06-public-booking-notifications.cy.ts
- ok: test:e2e:stage:onboarding -> cypress/e2e/stage/07-onboarding-setup-lifecycle.cy.ts
- ok: test:e2e:stage:team -> cypress/e2e/stage/08-team-admin-invitation.cy.ts
- ok: test:e2e:stage:patient-history -> cypress/e2e/stage/09-patient-treatment-history.cy.ts
- ok: test:e2e:stage:fixed-costs -> cypress/e2e/stage/10-fixed-costs-cost-per-minute.cy.ts
- ok: test:e2e:stage:assets -> cypress/e2e/stage/11-assets-depreciation.cy.ts
- ok: test:e2e:stage:time -> cypress/e2e/stage/12-time-settings-simulations.cy.ts
- ok: test:e2e:stage:expenses -> cypress/e2e/stage/13-expenses-budget-links.cy.ts
- ok: test:e2e:stage:date-filters -> cypress/e2e/stage/14-date-filters-coherence.cy.ts
- ok: test:e2e:stage:visual-responsive -> cypress/e2e/stage/15-visual-responsive-coverage.cy.ts
- ok: test:e2e:stage:full-lifecycle -> cypress/e2e/stage/16-full-lifecycle-user.cy.ts
- ok: test:e2e:stage:crons -> cypress/e2e/stage/17-cron-jobs.cy.ts
- ok: test:e2e:stage:lara -> cypress/e2e/stage/18-lara-ai-actions.cy.ts
- ok: test:e2e:stage:lara-history -> cypress/e2e/stage/41-lara-session-history.cy.ts
- ok: test:e2e:stage:lara-entry -> cypress/e2e/stage/42-lara-entry-mode.cy.ts
- ok: test:e2e:stage:reports -> cypress/e2e/stage/19-reports-dashboard-oracles.cy.ts
- ok: test:e2e:stage:roles -> cypress/e2e/stage/20-role-matrix-and-clinic-access.cy.ts
- ok: test:e2e:stage:lara-isolation -> cypress/e2e/stage/21-lara-dashboard-multiclinic-isolation.cy.ts
- ok: test:e2e:stage:navigation -> cypress/e2e/stage/22-navigation-session-regression.cy.ts
- ok: test:e2e:stage:chart-tooltips -> cypress/e2e/stage/23-chart-tooltips-dark-mode.cy.js
- ok: test:e2e:stage:visual-regression -> cypress/e2e/stage/24-visual-regression-baselines.cy.js
- ok: test:e2e:stage:account-deletion -> cypress/e2e/stage/25-account-deletion-self-service.cy.ts
- ok: test:e2e:stage:dashboard-appointments -> cypress/e2e/stage/26-dashboard-appointments-real-data.cy.ts
- ok: test:e2e:stage:booking-requests -> cypress/e2e/stage/27-booking-request-admin-actions.cy.ts
- ok: test:e2e:stage:appointment-conflicts -> cypress/e2e/stage/28-appointment-conflict-enforcement.cy.ts
- ok: test:e2e:stage:treatment-payments -> cypress/e2e/stage/30-treatment-status-payment-lifecycle.cy.ts
- ok: test:e2e:stage:i18n -> cypress/e2e/stage/31-i18n-layout-language-switch.cy.ts
- ok: test:e2e:stage:data-safety -> cypress/e2e/stage/32-data-portability-security-snapshots.cy.ts
- ok: test:e2e:stage:exports -> cypress/e2e/stage/32-data-portability-security-snapshots.cy.ts
- ok: test:e2e:stage:prescriptions -> cypress/e2e/stage/33-prescriptions-medications-pdf.cy.ts
- ok: test:e2e:stage:inbox -> cypress/e2e/stage/34-inbox-whatsapp-lifecycle.cy.ts
- ok: test:e2e:stage:whatsapp-webhook -> cypress/e2e/stage/35-whatsapp-webhook-inbound.cy.ts
- ok: test:e2e:stage:schema -> cypress/e2e/stage/36-stage-schema-contracts.cy.ts
- ok: test:e2e:stage:push -> cypress/e2e/stage/37-push-notifications.cy.ts
- ok: test:e2e:stage:whatsapp-settings -> cypress/e2e/stage/38-whatsapp-settings-provider.cy.ts
- ok: test:e2e:stage:delivery-webhooks -> cypress/e2e/stage/39-notification-delivery-webhooks.cy.ts
- ok: test:e2e:stage:notification-retries -> cypress/e2e/stage/40-notification-retry-queue.cy.ts

## i18n parity

Status: pass

en keys: 4970; es effective keys: 4970; missing en: 0; missing es: 0

## UI test hooks

Status: pass

ui files: 442; files with data-testid: 29; data-testid occurrences: 120; required hooks: 16; missing required hooks: 0

- has hooks: app/auth/login/page.tsx
- has hooks: app/book/[slug]/confirmation/page.tsx
- has hooks: app/book/[slug]/page.tsx
- has hooks: app/inbox/InboxClient.tsx
- has hooks: app/marketing/page.tsx
- has hooks: app/onboarding/page.tsx
- has hooks: app/patients/[id]/page.tsx
- has hooks: app/reports/page.tsx
- has hooks: app/services/page.tsx
- has hooks: app/settings/notifications/NotificationsClient.tsx
- has hooks: app/settings/notifications/page.tsx
- has hooks: app/setup/page.tsx
- has hooks: app/setup/resume/page.tsx
- has hooks: app/treatments/page.tsx
- has hooks: components/ai-assistant/AudioPlayer.tsx
- has hooks: components/ai-assistant/EntryMode/EntitySelector.tsx
- has hooks: components/ai-assistant/EntryMode/EntryAssistant.tsx
- has hooks: components/ai-assistant/EntryMode/GenericEntryFlow.tsx
- has hooks: components/ai-assistant/FloatingAssistant.tsx
- has hooks: components/ai-assistant/QueryMode/QueryAssistant.tsx
- has hooks: components/dashboard/marketing/CACTrendChart.tsx
- has hooks: components/dashboard/marketing/ChannelROIChart.tsx
- has hooks: components/dashboard/RevenueChart.tsx
- has hooks: components/inbox/ConvertLeadDialog.tsx
- has hooks: components/layouts/AppLayout.tsx
- has hooks: components/layouts/ContextIndicator.tsx
- has hooks: components/onboarding/OnboardingModal.tsx
- has hooks: components/ui/action-confirm-card.tsx
- has hooks: components/ui/crud-page-layout.tsx

## API permission surface

Status: pass

api routes: 168; permission guard: 118 (withPermission: 30, manual: 88); qa classified: 16; using supabaseAdmin: 136; admin without permission/cron guard/classification: 0

## Cron guard inventory

Status: pass

cron entries: 6; missing/unguarded: 0

- ok: /api/cron/complete-appointments (1 0 * * *)
- ok: /api/cron/recurring-expenses (5 0 * * *)
- ok: /api/cron/send-reminders (*/15 * * * *)
- ok: /api/cron/retry-notifications (*/10 * * * *)
- ok: /api/cron/snapshots (0 3 * * *)
- ok: /api/cron/cleanup-draft-workspaces (30 3 * * *)
