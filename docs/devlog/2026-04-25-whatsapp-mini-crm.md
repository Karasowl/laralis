# WhatsApp mini-CRM — atribución Click-to-WhatsApp y conversión a paciente

**Fecha**: 2026-04-25
**TASK ids**: TASK-20260425-whatsapp-inbox-nav-link, TASK-20260425-ctwa-attribution, TASK-20260425-lead-treatment-link, TASK-20260425-lead-conversion-action, TASK-20260425-whatsapp-onboarding-doc
**PR**: pendiente

## Contexto

El cliente vino con esta urgencia: "necesito desesperadamente integrar los mensajes en laralis, saber automáticamente en qué estado está cada prospecto, mandar mensajes automáticos, saber si alguno es rescatable y tener conectado con el calendario… si las campañas traen 130 mensajes y no se les sacan al menos 2000 pesos estamos botando dinero".

El negocio es así: campañas Meta Ads "Click-to-WhatsApp" → mensajes a un número de WhatsApp → call center responde manualmente → cita en calendario → tratamiento → ingresos. Hoy todo lo que pasa antes de "tratamiento" vive fuera de Laralis (en la app móvil de WhatsApp Business), por lo que el ROI de las campañas y el rescate de leads dormidos no se pueden medir ni automatizar.

Restricción del cliente: solo rutas oficiales (Cloud API o BSPs autorizados). Nada de instancias web no oficiales que Meta banea.

## Problema

1. La página `/inbox` existía completa (710 líneas, realtime, search, thread, composer, acciones bot/asignar/transferir/cerrar) pero **nunca se linkeó al menú principal**. Un fantasma con código y sin acceso desde la nav.
2. El webhook recibía mensajes inbound pero **no extraía la metadata del ad** que Meta adjunta al primer mensaje (`ReferralCtwaClid`, `ReferralSourceId`, `ReferralSourceUrl`, `ReferralHeadline`, `ReferralBody`, `ReferralMediaType`, `ReferralMediaUrl`). Sin esa metadata es imposible decir "esta conversación vino del ad X".
3. La conversión "lead → paciente" se podía hacer escribiendo SQL pero no había botón en la UI ni endpoint dedicado.
4. No había documentación operativa para que una clínica supiera cómo migrar su número del celular al BSP, qué se pierde, y cómo configurar el webhook.
5. No había script de diagnóstico para saber qué clínicas tenían WhatsApp activo y qué provider usaban.

## Causa raíz

- El módulo Inbox se dejó "off the menu" probablemente para activarlo después de validar permisos. Los permisos `inbox.*` ya estaban sembrados en migration 70/71, así que no había razón para mantenerlo oculto.
- El webhook se construyó cuando el equipo todavía no decidía si usaría la atribución CTWA. Meta envía el `referral` por defecto en su Cloud API, y Twilio lo expone como campos `Referral*` del form-encoded body, pero el handler los ignoraba.
- La conversión lead → patient era un caso de uso "obvio en la cabeza, no escrito en código" — clásico gap entre product intent y producto.

## Qué cambió

### Database (migration 77)

`supabase/migrations/77_lead_attribution_and_treatment_link.sql`:

- 8 columnas nuevas en `leads`: `ctwa_clid`, `ad_id`, `ad_source_type`, `ad_source_url`, `ad_headline`, `ad_body`, `ad_media_type`, `ad_media_url`.
- 2 índices parciales: `idx_leads_ctwa_clid`, `idx_leads_ad_id`.
- Columna nueva `treatments.lead_id` (FK → `leads.id`, `ON DELETE SET NULL`) + índice parcial `idx_treatments_lead`.
- Backfill: enlaza `treatments.lead_id` con el lead correspondiente para tratamientos cuyo paciente está en `leads.converted_patient_id`. Toma el primer treatment por `treatment_date ASC NULLS LAST, created_at ASC`.

### Webhook (`web/app/api/whatsapp/webhook/route.ts`)

- Nueva función `extractCtwaReferralFromTwilio()` que parsea los campos `Referral*` del form body y devuelve un objeto normalizado o `null`.
- En el insert de lead nuevo: si hay referral, se vuelcan los 8 campos.
- En el update de lead existente: regla **first-touch wins** — solo se llenan los campos si el lead **no tenía** `ctwa_clid` previo. Un usuario que vuelve por otro ad no sobrescribe la atribución original.
- En el insert de `inbox_messages`: el referral completo se guarda en `metadata.ctwa_referral` para auditoría, independientemente de si pegó al lead o no.

### Endpoint nuevo: convertir lead → paciente

`web/app/api/inbox/convert/route.ts`:

- `POST /api/inbox/convert` con permisos `inbox.view + patients.create` (vía `withAllPermissions`).
- Body: `conversationId`, `firstName` (req), `lastName`, `email`, `phone`, `notes`.
- Idempotente: si la conversación ya tiene `patient_id` o el lead asociado ya estaba convertido, devuelve el paciente existente con `alreadyLinked: true` en vez de crear duplicado.
- Hereda `campaign_id` y `source_id` del lead al crear el paciente, manteniendo la atribución.
- Marca `lead.status = 'converted'`, set `converted_patient_id` y `converted_at`.
- Vincula `inbox_conversations.patient_id` para que la UI deje de mostrar el botón.

### UI

- `web/components/NavigationClient.tsx`: añade link `/inbox` (top level + dentro del dropdown de Operaciones), gated por `usePermissions().can('inbox.view')`.
- `web/components/inbox/ConvertLeadDialog.tsx` (nuevo): diálogo con form (firstName, lastName, phone, email, notes), pre-rellena desde el lead, llama al endpoint, muestra toast.
- `web/app/inbox/InboxClient.tsx`: nuevo botón "Convertir a paciente" entre Transferir y Cerrar, solo visible si `selectedConversation.patients?.id` está vacío.

### i18n

Nuevas keys en `messages/{es,en}.json` bajo `inbox.actions.convert` y `inbox.convert.{title, description, firstName, lastName, phone, email, notes, notesPlaceholder, confirm, success, alreadyLinked, errors.generic}`.

### Operativos

- `supabase/diagnostics/whatsapp_status.sql`: 9 queries read-only para ver estado de WhatsApp por clínica (config, conversaciones 30d, mensajes inbound/outbound, pipeline de leads, notifications outbound, números mapeados, plantillas activas, conversaciones huérfanas, summary final con clasificación NOT_CONFIGURED / CONFIGURED_BUT_INACTIVE / OUTBOUND_ONLY / INBOUND_ONLY / FULLY_ACTIVE).
- `docs/whatsapp-onboarding.md`: guía operativa para conectar el número de una clínica al BSP, decisión Twilio vs 360dialog (recomendado para CTWA), proceso paso a paso de migración (incluyendo el paso destructivo de borrar el número de la app móvil), configuración de webhook, activación en Supabase, mapeo a campañas, re-aprobación de plantillas, compliance LFPDPPP, quality rating y diagnóstico operativo.

### Schema docs

- `docs/database/schemas/SCHEMA-v6-2026-04-25.md` creado.
- `docs/database/SCHEMA-CURRENT.md` apunta ahora a v6.
- `docs/database/SCHEMA-CHANGELOG.md` lista v6 como current y v5 como superseded.

### Version bump

- `web/package.json`: `0.5.0` → `0.6.0` (minor: feature visible).
- `web/components/ui/VersionBadge.tsx`: agregado `v0_6_0` al inicio de los arrays.
- `web/messages/version.{es,en}.json`: nueva entrada con secciones `added`, `improved`, `documentation`.

## Archivos tocados

- `supabase/migrations/77_lead_attribution_and_treatment_link.sql` (nuevo)
- `supabase/diagnostics/whatsapp_status.sql` (nuevo)
- `web/app/api/whatsapp/webhook/route.ts` (modificado)
- `web/app/api/inbox/convert/route.ts` (nuevo)
- `web/app/inbox/InboxClient.tsx` (modificado, +botón convertir)
- `web/components/inbox/ConvertLeadDialog.tsx` (nuevo)
- `web/components/NavigationClient.tsx` (modificado, +link Inbox)
- `web/messages/es.json` (nuevas keys `inbox.actions.convert` + `inbox.convert.*`)
- `web/messages/en.json` (idem)
- `web/messages/version.es.json` (entrada v0.6.0)
- `web/messages/version.en.json` (entrada v0.6.0)
- `web/components/ui/VersionBadge.tsx` (registro v0.6.0)
- `web/package.json` (version bump)
- `docs/whatsapp-onboarding.md` (nuevo)
- `docs/database/schemas/SCHEMA-v6-2026-04-25.md` (nuevo)
- `docs/database/SCHEMA-CURRENT.md` (apunta a v6)
- `docs/database/SCHEMA-CHANGELOG.md` (entrada v6)
- `tasks/backlog.md` (nuevas TASK ids)
- `docs/devlog/INDEX.md` (entrada de este devlog)

## Antes vs después

| Aspecto | Antes | Después |
|---|---|---|
| Acceso a Inbox | Página existía, no estaba en menú. URL directa solo. | Link visible para usuarios con permiso `inbox.view`. |
| CTWA metadata | Ignorada en webhook | Capturada en `leads.ctwa_*` (first-touch) + audit en `inbox_messages.metadata` |
| Funnel ad → revenue | Implícito (vía `converted_patient_id`) | Explícito (`treatments.lead_id` directo) |
| Conversión lead → paciente | SQL manual | Botón + dialog + endpoint idempotente |
| Onboarding nueva clínica | Sin guía | `docs/whatsapp-onboarding.md` con pasos verificables |
| Diagnóstico estado actual | Sin script | `supabase/diagnostics/whatsapp_status.sql` lista para correr |

## Cómo probar

### Cómo probar la captura CTWA (requiere ad CTWA real)

1. Ejecutar migración 77 en Supabase:
   ```sql
   -- En Supabase SQL Editor, copiar todo
   -- supabase/migrations/77_lead_attribution_and_treatment_link.sql
   ```
2. Crear ad CTWA de prueba en Meta Ads Manager (presupuesto mínimo).
3. Click el ad desde un celular distinto al del owner → enviar mensaje.
4. Verificar en Supabase:
   ```sql
   SELECT id, full_name, phone, status, ctwa_clid, ad_id, ad_headline
   FROM leads
   WHERE clinic_id = '<UUID>'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Debe traer `ctwa_clid` y `ad_id` poblados.
5. Verificar que `inbox_messages.metadata->>'ctwa_referral'` tiene el JSON completo.

### Cómo probar la conversión a paciente

1. Login en Laralis con un usuario con permisos `inbox.view + patients.create`.
2. Ir a Inbox (debe aparecer en el nav).
3. Seleccionar una conversación.
4. Click en "Convertir a paciente".
5. Llenar firstName (mínimo) → "Crear paciente".
6. Verificar:
   - Toast de éxito.
   - `patients` tiene la nueva fila con `clinic_id`, `campaign_id` y `source_id` heredados del lead.
   - `leads.status = 'converted'`, `converted_patient_id` poblado.
   - `inbox_conversations.patient_id` poblado.
   - El botón "Convertir" desaparece de la UI.
7. Repetir el click una segunda vez (idempotencia): debe retornar `alreadyLinked: true` y no duplicar paciente.

### Diagnóstico de clínicas

```sql
-- Pegar el contenido de:
-- supabase/diagnostics/whatsapp_status.sql
```

### Tests automatizados

- `npm run lint`
- `npm run typecheck` (si existe el script, si no, `npx tsc --noEmit`)
- `npm test` para vitest

## Riesgos y rollback

### Riesgos

1. **Twilio podría no enviar `ReferralCtwaClid`**: si las plantillas Twilio no incluyen el campo, los leads se crean sin atribución pero sin error. La función `extractCtwaReferralFromTwilio()` retorna `null` y el insert procede normal.
2. **Backfill de `treatments.lead_id`** podría tardar en clínicas con muchos tratamientos. Es UPDATE con subquery — se evalúa por fila. Aceptable hasta ~50k tratamientos por clínica. Si tarda demasiado, dividir por `clinic_id`.
3. **Permisos `inbox.view`**: si una clínica creó usuarios antes de migration 74, podrían no tener el permiso. Verificar con `SELECT * FROM check_user_permission(auth.uid(), <clinic>, 'inbox', 'view')`.

### Rollback

Si algo falla en producción:

1. **Botón Inbox visible donde no debería**: editar `web/components/NavigationClient.tsx` para forzar `showInbox = false` y desplegar hotfix.
2. **CTWA captura genera errores**: el try/catch del webhook ya envuelve todo el handler. Como peor caso, el usuario sigue creando leads sin metadata. Si necesitas matar la captura, comentar la asignación de `ctwaReferral` en el webhook.
3. **Endpoint convert da problemas**: pinear el feature flag desactivando el botón en `InboxClient.tsx` (`{false && (...)}`). El endpoint en sí es idempotente — corregir y redeploy.
4. **Migration 77 a deshacer**:
   ```sql
   ALTER TABLE treatments DROP COLUMN IF EXISTS lead_id;
   ALTER TABLE leads
     DROP COLUMN IF EXISTS ctwa_clid,
     DROP COLUMN IF EXISTS ad_id,
     DROP COLUMN IF EXISTS ad_source_type,
     DROP COLUMN IF EXISTS ad_source_url,
     DROP COLUMN IF EXISTS ad_headline,
     DROP COLUMN IF EXISTS ad_body,
     DROP COLUMN IF EXISTS ad_media_type,
     DROP COLUMN IF EXISTS ad_media_url;
   ```

## Siguientes pasos

Las fases 2-4 del plan original siguen pendientes:

- **TASK-20260425-leads-pipeline-ui** — Kanban visual de leads (`/leads` page), filtros por campaña/estado, métricas en header.
- **TASK-20260425-lead-automations** — Cron de rescate de leads (24h, 48h, 7d sin respuesta) con plantillas pre-aprobadas.
- **TASK-20260425-google-calendar-bidirectional** — Webhook receiver de Google Calendar (push notifications + watch channels).
- **TASK-20260425-marketing-attribution-dashboard** — Dashboard `/marketing` con desglose CTWA → revenue (gasto en ads / lead / paciente / tratamiento.price_cents).
- **Cloud API support** — actualmente solo el lado Twilio del webhook parsea referral. Cuando se conecte una clínica a 360dialog directo (que pasa el JSON de Cloud API), agregar branch para `entry[0].changes[0].value.messages[0].referral`.
- **i18n smoke test** — verificar que ningún useTranslations() rompe en producción al introducir las nuevas keys.

Versión bumpeada: 0.5.0 → 0.6.0.
