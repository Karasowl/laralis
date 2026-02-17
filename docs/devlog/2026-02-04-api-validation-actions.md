# 2026-02-04 - Validacion Zod en API actions

- **PR**: N/A
- **TASK**: TASK-20260204-api-zod-validation-phase-2-actions

## Contexto

Los endpoints `api/actions/*` aceptaban JSON sin esquema, generando errores inconsistentes ante payloads invalidos.

## Problema

La falta de validacion permitia datos incompletos o con tipos incorrectos, lo que podia romper acciones o generar respuestas 500.

## Causa raiz

No se habia aplicado el helper de validacion Zod en el bloque de actions.

## Que cambio

Se agregaron schemas Zod y parseo seguro en:

- `update-time-settings`
- `update-service-price`
- `adjust-service-margin`
- `compare-periods`
- `create-expense`
- `simulate-price-change`
- `bulk-update-prices`
- `forecast-revenue`
- `identify-underperforming-services`
- `analyze-patient-retention`
- `optimize-inventory`

## Archivos tocados

- `web/app/api/actions/adjust-service-margin/route.ts`
- `web/app/api/actions/analyze-patient-retention/route.ts`
- `web/app/api/actions/bulk-update-prices/route.ts`
- `web/app/api/actions/compare-periods/route.ts`
- `web/app/api/actions/create-expense/route.ts`
- `web/app/api/actions/forecast-revenue/route.ts`
- `web/app/api/actions/identify-underperforming-services/route.ts`
- `web/app/api/actions/optimize-inventory/route.ts`
- `web/app/api/actions/simulate-price-change/route.ts`
- `web/app/api/actions/update-service-price/route.ts`
- `web/app/api/actions/update-time-settings/route.ts`
- `tasks/*`
- `docs/devlog/INDEX.md`

## Antes vs Despues

- **Antes**: JSON sin validar, errores manuales y heterogeneos.
- **Despues**: validacion Zod consistente con respuestas 400.

## Como probar

1. Enviar payload invalido a `/api/actions/update-service-price` y confirmar status 400.
2. Enviar payload invalido a `/api/actions/compare-periods` y confirmar status 400.

## Riesgos y rollback

- **Riesgo**: payloads con tipos inesperados ahora fallan.
- **Rollback**: revertir schemas en los endpoints.

## Siguientes pasos

- Fase 3: cubrir endpoints restantes fuera de `api/actions/*`.

## i18n

- Sin cambios.

## Tests

- No ejecutados.
