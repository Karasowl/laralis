# 2026-02-04 - Validacion Zod adicional en endpoints

- **PR**: N/A
- **TASK**: TASK-20260204-api-zod-validation-phase-4-additional

## Contexto

Quedaban endpoints con `request.json()` directo fuera de la fase 3, algunos con validaciones Zod parciales o solo validaciones manuales.

## Problema

Un JSON invalido podia disparar errores 500 o respuestas inconsistentes, especialmente en endpoints con parseo manual.

## Causa raiz

La validacion se hizo por fases y faltaban rutas de modulos auxiliares (inbox, team, marketing, settings, etc.).

## Que cambio

Se agrego parseo seguro con `readJson` y se mantuvieron las validaciones Zod existentes:

- `web/app/api/ai/chat/route.ts`
- `web/app/api/ai/feedback/route.ts`
- `web/app/api/ai/sessions/route.ts`
- `web/app/api/ai/sessions/[id]/route.ts`
- `web/app/api/ai/sessions/[id]/messages/route.ts`
- `web/app/api/assets/route.ts`
- `web/app/api/assets/[id]/route.ts`
- `web/app/api/categories/route.ts`
- `web/app/api/clinics/discount/route.ts`
- `web/app/api/expenses/route.ts`
- `web/app/api/expenses/[id]/route.ts`
- `web/app/api/fixed-costs/route.ts`
- `web/app/api/fixed-costs/[id]/route.ts`
- `web/app/api/inbox/assign/route.ts`
- `web/app/api/inbox/close/route.ts`
- `web/app/api/inbox/mark-read/route.ts`
- `web/app/api/inbox/reply/route.ts`
- `web/app/api/inbox/toggle-bot/route.ts`
- `web/app/api/inbox/transfer/route.ts`
- `web/app/api/invitations/route.ts`
- `web/app/api/marketing/campaigns/route.ts`
- `web/app/api/marketing/platforms/route.ts`
- `web/app/api/medications/route.ts`
- `web/app/api/patient-sources/route.ts`
- `web/app/api/patients/route.ts`
- `web/app/api/patients/[id]/route.ts`
- `web/app/api/prescriptions/route.ts`
- `web/app/api/prescriptions/[id]/route.ts`
- `web/app/api/public/book/route.ts`
- `web/app/api/services/route.ts`
- `web/app/api/services/[id]/route.ts`
- `web/app/api/services/[id]/supplies/route.ts`
- `web/app/api/settings/booking/route.ts`
- `web/app/api/settings/notifications/route.ts`
- `web/app/api/settings/preferences/route.ts`
- `web/app/api/settings/security/mfa/confirm/route.ts`
- `web/app/api/settings/security/mfa/recovery/route.ts`
- `web/app/api/settings/time/route.ts`
- `web/app/api/supplies/route.ts`
- `web/app/api/supplies/[id]/route.ts`
- `web/app/api/tariffs/route.ts`
- `web/app/api/team/clinic-members/route.ts`
- `web/app/api/team/clinic-members/[id]/route.ts`
- `web/app/api/team/custom-roles/route.ts`
- `web/app/api/team/custom-roles/[id]/route.ts`
- `web/app/api/team/workspace-members/route.ts`
- `web/app/api/team/workspace-members/[id]/route.ts`
- `web/app/api/treatments/route.ts`
- `web/app/api/treatments/[id]/payment/route.ts`
- `web/app/api/treatments/route-secure.example.ts`
- `tasks/TASK-20260204-api-zod-validation-phase-4-additional.md`
- `tasks/active.md`
- `tasks/backlog.md`
- `tasks/done.md`
- `tasks/week-2026-W06.md`
- `docs/devlog/INDEX.md`

## Antes vs Despues

- **Antes**: parseo directo con `request.json()` y respuestas heterogeneas ante JSON invalido.
- **Despues**: parseo seguro con `readJson` y validaciones Zod reutilizadas.

## Como probar

1. Enviar JSON invalido a `/api/team/workspace-members` y confirmar status 400.
2. Enviar payload invalido a `/api/marketing/platforms` y confirmar status 400.

## Riesgos y rollback

- **Riesgo**: clientes con JSON malformado ahora reciben 400 explicito.
- **Rollback**: revertir los cambios en los endpoints listados.

## Siguientes pasos

- Revisar si quedan endpoints fuera de `web/app/api` que requieran parseo seguro.

## i18n

- Sin cambios.

## Tests

- No ejecutados.
