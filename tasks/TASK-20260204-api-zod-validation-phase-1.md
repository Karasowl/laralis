---
id: TASK-20260204-api-zod-validation-phase-1
title: Validar payloads API con Zod (fase 1)
status: done
priority: P1
estimate: S
area: data
parent: null
links: []
---

## Descripción

Agregar validación Zod y parsing seguro de JSON en endpoints críticos con `request.json()` sin validación.

## Criterios de Aceptación

- [x] Helper compartido para parseo/validación.
- [x] Endpoints críticos (auth, onboarding, workspaces, clinics, treatments, notifications, reset) con Zod.
- [x] Respuesta 400 consistente en payload inválido.

## Notas Técnicas

- Helper en `web/lib/validation.ts`.
- Mantener compatibilidad con payloads existentes (coerce para números).

## Definición de Terminado

- [x] Endpoints actualizados.
- [x] Tasks y devlog actualizados.
