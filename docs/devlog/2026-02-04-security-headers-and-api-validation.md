# 2026-02-04 - Security headers + Zod validation (fase 1)

- **PR**: N/A
- **TASKS**:
  - TASK-20260204-security-headers
  - TASK-20260204-api-zod-validation-phase-1

## Contexto

Se priorizo el hardening de seguridad. Faltaban headers clave y varios endpoints aceptaban JSON sin validacion.

## Problema

- Los headers no incluian CSP ni HSTS.
- Algunos endpoints criticos no validaban payloads, exponiendo fallas por inputs invalidos.

## Causa raiz

No habia un helper central de validacion y varios endpoints heredaron parseo directo.

## Que cambio

- Se agrego CSP y HSTS (solo prod) en `next.config.mjs`.
- Se creo `web/lib/validation.ts` con helpers para parsear JSON y validar Zod.
- Se aplico validacion a endpoints criticos (auth, onboarding, workspaces, clinics, treatments, notifications, reset).

## Archivos tocados

- `web/next.config.mjs`
- `web/lib/validation.ts`
- `web/app/api/clinics/route.ts`
- `web/app/api/clinics/[id]/route.ts`
- `web/app/api/workspaces/route.ts`
- `web/app/api/workspaces/[id]/route.ts`
- `web/app/api/workspaces/[id]/clinics/route.ts`
- `web/app/api/notifications/send-confirmation/route.ts`
- `web/app/api/auth/delete-account/send-code/route.ts`
- `web/app/api/auth/delete-account/route.ts`
- `web/app/api/auth/debug-reset/route.ts`
- `web/app/api/auth/google-calendar/complete/route.ts`
- `web/app/api/onboarding/route.ts`
- `web/app/api/reset/route.ts`
- `web/app/api/treatments/[id]/refund/route.ts`
- `web/app/api/treatments/[id]/route.ts`
- `web/app/api/treatments/check-conflicts/route.ts`
- `tasks/*`
- `docs/devlog/INDEX.md`

## Antes vs Despues

- **Antes**: headers sin CSP/HSTS y endpoints con parseo directo de JSON.
- **Despues**: CSP + HSTS en prod y validacion Zod en endpoints criticos con errores 400 consistentes.

## Como probar

1. Verificar headers en respuesta (CSP y HSTS en prod).
2. Enviar payload invalido a `/api/workspaces` y confirmar status 400 con detalles.
3. Enviar payload invalido a `/api/clinics` y confirmar status 400.

## Riesgos y rollback

- **Riesgo**: payloads legacy con tipos no esperados ahora fallan con 400.
- **Rollback**: revertir cambios en `web/lib/validation.ts` y endpoints asociados.

## Siguientes pasos

- Fase 2: cubrir endpoints restantes con validacion Zod.
- Implementar RLS en Supabase.

## i18n

- Sin cambios.

## Tests

- No ejecutados.
