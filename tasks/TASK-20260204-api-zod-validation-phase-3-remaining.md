---
id: TASK-20260204-api-zod-validation-phase-3-remaining
title: Validar endpoints restantes con Zod
status: done
priority: P1
estimate: M
area: data
parent: TASK-20260204-api-zod-validation-phase-1
links: []
---

## Descripción

Aplicar validacion Zod en los endpoints restantes fuera de `api/actions/*` para asegurar payloads consistentes y respuestas 400 uniformes.

## Criterios de Aceptación

- [x] Endpoints restantes con schema Zod y parseo seguro.
- [x] Respuestas 400 consistentes ante payload invalido.
- [x] Sin cambios en logica de negocio.

## Notas Técnicas

- Reusa `web/lib/validation.ts`.
- En endpoints con body opcional se permite JSON vacio.

## Definición de Terminado

- [x] Endpoints actualizados.
- [x] Tasks y devlog actualizados.
