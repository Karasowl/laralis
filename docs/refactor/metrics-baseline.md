# Refactor Baseline Metrics

Generated at: 2026-02-05T23:43:06.774Z

## Totals

- fetch occurrences: 206
- files with fetch: 78
- any occurrences: 765
- files with any: 163
- api routes: 160
- api routes with console.log: 0
- api routes with validation signals: 95
- api routes without validation signals: 65
- files >= 400 lines: 58

## Top Large Files

- web/lib/export/importer.ts: 1482
- web/lib/ai/ClinicSnapshotService.ts: 1205
- web/lib/export/types.ts: 1125
- web/app/treatments/page.tsx: 1095
- web/lib/ai/service.ts: 950
- web/components/ai-assistant/QueryMode/QueryAssistant.tsx: 883
- web/app/page.tsx: 878
- web/lib/ai/actions/pricing-actions.ts: 835
- web/app/patients/page.tsx: 831
- web/lib/export/exporter.ts: 798
- web/app/services/components/ServicesTable.tsx: 760
- web/app/settings/marketing/MarketingSettingsClient.tsx: 726
- web/app/inbox/InboxClient.tsx: 711
- web/app/settings/security/SecuritySettingsClient.tsx: 673
- web/lib/sms/service.ts: 650
- web/lib/ai/actions/analytics-actions.ts: 650
- web/components/services/ServiceQuickWizard.tsx: 626
- web/lib/ai/prompts/query-prompt.ts: 605
- web/lib/permissions/role-templates.ts: 603
- web/components/ui/smart-filters.tsx: 596

## API Routes Without Validation Signals

- web/app/api/account/delete/route.ts
- web/app/api/actions/history/route.ts
- web/app/api/ai/transcribe/route.ts
- web/app/api/analytics/acquisition-trends/route.ts
- web/app/api/analytics/break-even/route.ts
- web/app/api/analytics/cac-trend/route.ts
- web/app/api/analytics/channel-roi/route.ts
- web/app/api/analytics/compare/route.ts
- web/app/api/analytics/expenses/route.ts
- web/app/api/analytics/inventory/alerts/route.ts
- web/app/api/analytics/marketing-metrics/route.ts
- web/app/api/analytics/patients/stats/route.ts
- web/app/api/analytics/planned-vs-actual/route.ts
- web/app/api/analytics/predictions/route.ts
- web/app/api/analytics/profit-analysis/route.ts
- web/app/api/analytics/refunds/route.ts
- web/app/api/analytics/revenue/route.ts
- web/app/api/analytics/route.ts
- web/app/api/analytics/service-roi/route.ts
- web/app/api/analytics/services/top/route.ts
- web/app/api/analytics/treatments/frequency/route.ts
- web/app/api/assets/summary/route.ts
- web/app/api/auth/force-logout/route.ts
- web/app/api/auth/google-calendar/callback/route.ts
- web/app/api/auth/google-calendar/route.ts
- web/app/api/campaigns/route.ts
- web/app/api/clinic/[clinicId]/export/route.ts
- web/app/api/cron/complete-appointments/route.ts
- web/app/api/cron/send-reminders/route.ts
- web/app/api/dashboard/activities/route.ts
- web/app/api/dashboard/appointments/route.ts
- web/app/api/dashboard/charts/categories/route.ts
- web/app/api/dashboard/charts/revenue/route.ts
- web/app/api/dashboard/charts/services/route.ts
- web/app/api/dashboard/expenses/route.ts
- web/app/api/dashboard/patients/route.ts
- web/app/api/dashboard/revenue/route.ts
- web/app/api/dashboard/supplies/route.ts
- web/app/api/dashboard/treatments/route.ts
- web/app/api/equilibrium/route.ts
- web/app/api/equilibrium/variable-cost/route.ts
- web/app/api/equilibrium/working-days/route.ts
- web/app/api/expenses/alerts/route.ts
- web/app/api/expenses/stats/route.ts
- web/app/api/invitations/[id]/resend/route.ts
- web/app/api/invitations/accept/[token]/route.ts
- web/app/api/invitations/reject/[token]/route.ts
- web/app/api/marketing/campaigns/roi/route.ts
- web/app/api/marketing/platforms/[id]/route.ts
- web/app/api/marketing/roi/route.ts
