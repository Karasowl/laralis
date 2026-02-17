---
id: TASK-20260204-api-zod-validation-phase-2-actions
title: Validar endpoints actions con Zod
status: done
priority: P1
estimate: S
area: data
parent: TASK-20260204-api-zod-validation-phase-1
links: []
---

## Descripción

Aplicar validacion Zod en los endpoints de `api/actions/*` que recibian JSON sin esquema.

## Criterios de Aceptación

- [x] Acciones principales validan payload con Zod.
- [x] Respuesta 400 consistente ante payload invalido.
- [x] Sin cambios en logica de negocio.

## Notas Técnicas

- Reusa `web/lib/validation.ts`.
- Se usan `z.coerce.number()` para compatibilidad con strings.

## Definición de Terminado

- [x] Endpoints actions actualizados.
- [x] Tasks y devlog actualizados.
