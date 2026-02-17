---
id: TASK-20260204-api-zod-validation-phase-4-additional
title: Validar endpoints adicionales con Zod (fase 4)
status: done
priority: P1
estimate: M
area: data
parent: TASK-20260204-api-zod-validation-phase-1
links: []
---

## Descripción

Aplicar parseo seguro y validacion Zod en endpoints adicionales que aun usaban `request.json()` directamente.

## Criterios de Aceptación

- [x] Endpoints adicionales usan parseo seguro (readJson).
- [x] Validacion Zod existente reutilizada donde aplica.
- [x] Respuestas 400 consistentes ante JSON invalido.

## Notas Técnicas

- Reusa `web/lib/validation.ts`.
- Se mantiene la logica de negocio original.

## Definición de Terminado

- [x] Endpoints actualizados.
- [x] Tasks y devlog actualizados.
