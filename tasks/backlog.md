# Backlog

## P0 - MVP Vendible (Bloquea lanzamiento)

### Nuevas tareas (Análisis competitivo 2025-12-07)
- [x] ~~TASK-20251207-public-booking~~ - Autoagendamiento público (link sin login) ✅ Implementado 2025-12-12
- [x] ~~TASK-20251207-email-notifications~~ - Notificaciones email automáticas (confirmación + recordatorio) ✅ Implementado 2025-12-12

## Seguridad

- [x] ~~TASK-20260204-block-service-role-client~~ - Bloquear supabaseAdmin en cliente ✅ Implementado 2026-02-04
- [x] ~~TASK-20260204-security-headers~~ - Agregar headers de seguridad en Next.js ✅ Implementado 2026-02-04
- [x] ~~TASK-20260204-api-zod-validation-phase-1~~ - Validar payloads API con Zod (fase 1) ✅ Implementado 2026-02-04
- [x] ~~TASK-20260204-api-zod-validation-phase-2-actions~~ - Validar endpoints actions con Zod ✅ Implementado 2026-02-04
- [x] ~~TASK-20260204-api-zod-validation-phase-3-remaining~~ - Validar endpoints restantes con Zod ✅ Implementado 2026-02-04
- [x] ~~TASK-20260204-api-zod-validation-phase-4-additional~~ - Validar endpoints adicionales con Zod ✅ Implementado 2026-02-04

## P1 - Plan Profesional

### Nuevas tareas (Análisis competitivo 2025-12-07)
- [x] ~~TASK-20251207-whatsapp-notifications~~ - Notificaciones WhatsApp (Twilio/360dialog) ✅ Implementado 2025-12-12
- [x] ~~TASK-20251207-prescriptions~~ - Módulo de recetas médicas con vademécum ✅ Implementado 2025-12-12
- [x] ~~TASK-20251207-pdf-quotes~~ - Presupuestos PDF personalizados ✅ Implementado 2025-12-12

## P2 - Plan Clínica

### Nuevas tareas (Análisis competitivo 2025-12-07)
- [ ] TASK-20251207-odontogram - Odontograma interactivo (SVG)
- [ ] TASK-20251207-periodontogram - Periodontograma con mediciones
- [ ] TASK-20251207-cash-register - Control de cajas por usuario
- [ ] TASK-20251207-doctor-settlements - Liquidación de comisiones a doctores

## WhatsApp Mini-CRM (2026-04-25)

### Implementadas hoy (Fase 1 + Fase 2.1)
- [x] ~~TASK-20260425-whatsapp-inbox-nav-link~~ - Linkear página /inbox al menú principal ✅ Implementado 2026-04-25
- [x] ~~TASK-20260425-ctwa-attribution~~ - Captura de metadata Click-to-WhatsApp en webhook (first-touch wins) ✅ Implementado 2026-04-25
- [x] ~~TASK-20260425-lead-treatment-link~~ - FK lead_id en treatments + backfill ✅ Implementado 2026-04-25
- [x] ~~TASK-20260425-lead-conversion-action~~ - Botón y endpoint Convertir lead a paciente ✅ Implementado 2026-04-25
- [x] ~~TASK-20260425-whatsapp-onboarding-doc~~ - Documentación operativa de migración del número ✅ Implementado 2026-04-25

### Pendientes (Fase 2.2 + 3 + 4)
- [ ] TASK-20260425-whatsapp-status-diagnosis - Correr supabase/diagnostics/whatsapp_status.sql en cada workspace y reportar el estado actual de cada clínica (Fase 0 operativa)
- [ ] TASK-20260425-leads-pipeline-ui - Vista kanban /leads con drag-and-drop entre estados (new/contacted/qualified/converted/lost), filtros por campaña y rango de fechas
- [ ] TASK-20260425-lead-automations - Cron de rescate (24h, 48h, 7d sin respuesta) con plantillas pre-aprobadas y opt-out por palabra clave
- [ ] TASK-20260425-google-calendar-bidirectional - Webhook receiver de Google Calendar (push notifications + watch channel renewal cada 7 días)
- [ ] TASK-20260425-marketing-attribution-dashboard - Dashboard /marketing con desglose CTWA → revenue (gasto en ads / lead / paciente / treatment.price_cents)
- [ ] TASK-20260425-whatsapp-cloudapi-referral - Cuando una clínica use 360dialog raw passthrough, parsear `entry[0].changes[0].value.messages[0].referral` además de los campos `Referral*` de Twilio

## Caída de producción por Supabase muerto (2026-07-31)

Ver `docs/devlog/2026-07-31-fix-middleware-timeout-dead-supabase.md`.

- [ ] TASK-20260731-dual-login-order - En modo `dual` el login intenta Supabase primero y solo cae al bridge de Convex cuando falla, arrastrando el retraso del intento fallido. Invertir el orden es un cambio de comportamiento de autenticación y necesita decisión explícita.
- [ ] TASK-20260731-supabase-dependency-sweep - Registro, recuperación de contraseña, borrado de cuenta y export/import siguen apoyados en Supabase y hoy están rotos. Se solapa con TASK-20260728-supabase-raw-clients.

## Auditoría de seguridad y arquitectura (2026-07-28)

Hallazgos que NO entraron en el cierre P0 del 2026-07-28. Ver
`docs/devlog/2026-07-28-close-unauthenticated-access.md`.

### P0 pendientes
- [ ] TASK-20260728-convex-identity-validation - Validar identidad de usuario dentro de las funciones de Convex y filtrar por clínica ahí, recuperando la segunda capa que daba RLS. Bloqueado por el cutover de auth (prod sigue con login Supabase, `AUTH_BACKEND=dual`). Hacerlo antes de vender a la segunda clínica.
- [ ] TASK-20260728-dependency-cves - `npm audit`: 1 crítica (`@auth/core`, dependencia directa de `@convex-dev/auth`) y 4 altas (`next`, `ws`, `postcss`). Activar Dependabot.

### P1
- [ ] TASK-20260728-convex-pagination - 92 lecturas usan `listConvexTable` con escaneo completo y techo de 10.000 filas: por encima truncan datos en silencio y por encima de ~16k Convex lanza excepción. Los índices `by_clinic`/`by_workspace` ya existen en el esquema, falta usarlos con cursor.
- [ ] TASK-20260728-auth-context-scans - `contextForUser` hace 7 escaneos completos por petición y `userHasPermission` otros 5. Sin caché. Es el mismo techo que lo anterior aplicado a la autenticación.
- [ ] TASK-20260728-supabase-raw-clients - 10 rutas siguen creando un cliente Supabase crudo sin rama Convex y se romperán al apagar Supabase, incluidas borrado de cuenta y export/import (derechos del usuario).
- [ ] TASK-20260728-permissions-tests - El motor de permisos se reescribió de SQL a JS (11 pasos de precedencia) sin un solo test que compare la réplica con el original.
- [ ] TASK-20260728-i18n-missing-keys - 137 claves usadas en código y ausentes de `en.json` y `es.json`. Afecta pantallas enteras: `billing.*`, `settings.reset.*`, `common.errors.*`.
- [ ] TASK-20260728-data-backend-fail-fast - `DEFAULT_BACKEND='supabase'` sin validación de arranque: si falta una variable en prod, la app sirve datos de un Supabase congelado sin ningún error.

### P2
- [ ] TASK-20260728-restore-ci-gates - `next.config.mjs` tiene `ignoreBuildErrors` e `ignoreDuringBuilds`, y la CI no corre typecheck, lint ni `npm audit`. Por eso hay 194 errores de tipo acumulados.
- [ ] TASK-20260728-csp-hardening - La CSP incluye `script-src 'unsafe-inline'`, lo que anula su protección contra XSS. Migrar a nonces.
- [ ] TASK-20260728-file-size-rule - 90 archivos superan las 400 líneas que fija `docs/CODING-STANDARDS.md` (hasta 1.686).
- [ ] TASK-20260728-repo-hygiene - 146 MB de volcados de grep versionados en la raíz, dos lockfiles con versiones divergentes de Next, 18 SQL sueltos en `apps/dental` y 14 en la raíz.
- [ ] TASK-20260728-qa-bypass-flag - Los bypass de QA en webhooks y rutas de IA dependen de un substring de `NEXT_PUBLIC_SUPABASE_URL`. Cambiar a un flag explícito de servidor.
- [ ] TASK-20260728-whisperall-build-cost - Fuera de Laralis pero puede tumbarlo: `whisperall-web` consumió 189 horas de CPU de build en un ciclo (39,22 USD de 40,33 del equipo), lo que pausó los 24 proyectos por Spend Management.

## P3 - Futuro

### Mejoras a Lara
- [ ] TASK-20251207-lara-predictive - Análisis predictivo de ingresos
- [ ] TASK-20251207-lara-weekly-summary - Resumen semanal por voz

### Portal del paciente
- [ ] TASK-20251207-patient-portal - Portal web para pacientes (historial, citas)
- [ ] TASK-20251207-online-payments - Pagos online (Stripe)

---

## Tareas Completadas (migradas de backlog anterior)

Las siguientes tareas del backlog original ya fueron implementadas:

- [x] ~~TASK-20250810-auth-rls~~ - Auth y RLS implementados
- [x] ~~TASK-20250810-user-clinic-membership~~ - Multi-tenant funcionando
- [x] ~~TASK-20250809-patient-management~~ - Módulo de pacientes completo
- [x] ~~TASK-20250810-supplies-module~~ - Insumos con porciones implementado
- [x] ~~TASK-20250809-reports-dashboard~~ - 40+ páginas de reportes
- [x] ~~TASK-20250809-data-export~~ - Export/Import con validación
- [x] ~~TASK-20250810-service-recipes~~ - service_supplies funcionando

---

## Referencias

- [Roadmap Competitivo](../docs/competencia/ROADMAP-COMPETITIVO.md)
- [Pricing Strategy](../docs/competencia/PRICING-STRATEGY.md)
- [Análisis Dentalink](../docs/competencia/dentalink/ANALISIS.md)

Última actualización: 2026-07-28
