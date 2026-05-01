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

Última actualización: 2026-04-25
