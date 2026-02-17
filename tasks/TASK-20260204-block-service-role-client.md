---
id: TASK-20260204-block-service-role-client
title: Bloquear supabaseAdmin en cliente
status: done
priority: P1
estimate: XS
area: infra
parent: null
links: []
---

## Descripción

Asegurar que `supabaseAdmin` sea estrictamente server-only y falle si se intenta importar o ejecutar en navegador.

## Criterios de Aceptación

- [x] `web/lib/supabaseAdmin.ts` lanza error si se evalúa en entorno navegador.
- [x] La inicialización server-side se mantiene sin cambios funcionales.
- [x] Devlog documenta el cambio y cómo validarlo.

## Notas Técnicas

- Aplicar guard con `typeof window !== 'undefined'`.
- No modificar `.env.local`.

## Definición de Terminado

- [x] Guard server-only aplicado en `supabaseAdmin`.
- [x] `tasks/` actualizado (active/backlog/done + weekly rollup).
- [x] Devlog creado.
