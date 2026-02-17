---
id: TASK-20260204-security-headers
title: Agregar headers de seguridad en Next.js
status: done
priority: P1
estimate: XS
area: infra
parent: null
links: []
---

## Descripción

Agregar headers de seguridad en `next.config.mjs`, incluyendo CSP y HSTS (solo prod).

## Criterios de Aceptación

- [x] `Content-Security-Policy` definido y aplicado.
- [x] `Strict-Transport-Security` activo solo en producción.
- [x] Headers existentes preservados.

## Notas Técnicas

- CSP permisivo para evitar romper integraciones (connect/img/frame https).
- HSTS solo en prod para no afectar dev local.

## Definición de Terminado

- [x] Config actualizado.
- [x] Tasks y devlog actualizados.
