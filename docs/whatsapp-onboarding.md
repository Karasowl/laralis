# Onboarding de WhatsApp Business para clínicas Laralis

Esta guía operativa explica **cómo conectar el número de WhatsApp de una clínica** al sistema Laralis para que los mensajes de Click-to-WhatsApp ads (Meta Ads) y de pacientes orgánicos lleguen automáticamente a la Bandeja de Entrada (Inbox) y al pipeline de leads.

> **Antes de empezar**: ejecuta el script de diagnóstico [supabase/diagnostics/whatsapp_status.sql](../supabase/diagnostics/whatsapp_status.sql) en el SQL Editor de Supabase para confirmar el estado actual de cada clínica. Manda el resumen final de la salida si vas a pedir soporte.

---

## TL;DR — los 3 caminos posibles

| Estado actual del número | Acción recomendada |
|---|---|
| Está en la app móvil de WhatsApp Business (celular) | **Migración Fase 0.5** → conectar a 360dialog (recomendado para CTWA) o Twilio |
| Está conectado a Twilio sin atribución de ads | Verificar campos `Referral*` en webhook 2026; si Twilio no expone `ctwa_clid`, migrar a 360dialog |
| Está conectado a 360dialog | Solo activar `notification_settings.whatsapp` en Supabase y configurar webhook |

**No se puede**: tener el mismo número simultáneamente en la app móvil y en una API (Cloud API o BSP). Es exclusión mutua. Cuando un número se da de alta en API, deja de funcionar la app móvil para ese número.

---

## Decisión de provider

Laralis ya soporta dos providers oficiales con abstracción intercambiable (config en `clinics.notification_settings.whatsapp.provider`):

### 360dialog (recomendado para clínicas con Meta Ads)

- **Pros**: passthrough cercano a Cloud API, expone el objeto `referral` completo (incluyendo `ctwa_clid`, `source_id`, `source_url`, `headline`, `body`). Es el provider óptimo para atribuir cada mensaje al ad específico que lo generó.
- **Contras**: no incluye inbox web propio (Laralis ya tiene su propio Inbox, así que esto no importa).
- **Costo aproximado** (México, ~130 conversaciones/mes): markup bajo de 360dialog + costo de Meta. La mayoría de mensajes son "Service" (respuestas dentro de la ventana de 24 horas) que **son gratis desde noviembre 2024**. Estimación: **5–25 USD/mes** dependiendo de cuántas plantillas de Marketing/Utility se envíen.

### Twilio (recomendado para clínicas que solo quieren recordatorios sin atribución por ad)

- **Pros**: SDK más maduro, docs muy claras, ya está integrado en Laralis.
- **Contras**: históricamente no exponía el `ctwa_clid` en su webhook estándar — solo `ReferralSourceType`, `ReferralSourceId`, `ReferralBody`, `ReferralHeadline`. Antes de elegir Twilio para una clínica con Meta Ads activos, **verificar en https://www.twilio.com/docs/whatsapp si en 2026 ya añadieron el campo `ReferralCtwaClid`**.
- **Costo**: markup Twilio + ~1 USD/mes por número + costo de Meta.

### Cloud API directo (NO recomendado todavía)

Laralis aún no implementa Embedded Signup ni manejo de tokens directos con Meta. Hasta que Laralis tenga 100+ clínicas activas con WhatsApp, los BSPs ofrecen mejor ergonomía operativa.

---

## Flujo de migración (clínica que hoy usa la app móvil)

> Tiempo total: 1–2 horas si todo sale bien. Asumir 1 día completo si hay que verificar dominio o cuentas de Meta Business.

### Paso 1. Pre-requisitos en Meta

1. La clínica debe tener una **Meta Business Manager** account verificada (https://business.facebook.com).
2. El número de WhatsApp debe estar registrado en esa cuenta como WhatsApp Business Account (WABA).
3. Tener acceso a un correo del dominio del negocio (no Gmail personal) para verificación.
4. Tener listo un nombre comercial y categoría (clínica → Healthcare → Dental).

### Paso 2. Borrar el número de la app móvil

> ⚠️ **Paso destructivo**. Avisar al call center con anticipación. Una vez borrado, no se puede volver atrás sin re-aprobar el número.

1. Abrir la app de WhatsApp Business en el celular del dueño.
2. Ajustes → Cuenta → Borrar mi cuenta.
3. Confirmar borrado del número.
4. El historial de chats locales se queda en el celular pero el número queda libre para registrarse en API.

### Paso 3. Onboarding en el BSP

#### Opción A: 360dialog

1. Crear cuenta en https://hub.360dialog.com.
2. Completar Embedded Signup (~30 min) — pedirá:
   - Acceso a Meta Business Manager.
   - Verificar el número con código SMS o llamada.
   - Aprobación del display name (puede tardar 1–24h).
3. Generar API key en el dashboard de 360dialog.
4. Anotar:
   - API key (se guarda en Supabase, ver paso 5).
   - Phone number ID.

#### Opción B: Twilio

1. Crear o usar cuenta existente en https://console.twilio.com.
2. Console → Messaging → Senders → WhatsApp Senders → Register a WhatsApp Sender.
3. Seguir el flujo de WhatsApp Business Profile + Display Name approval.
4. Anotar:
   - Account SID, Auth Token (se usan como variables de entorno globales en Vercel).
   - Phone number en formato `whatsapp:+5215555555555`.

### Paso 4. Configurar webhook

Tanto Twilio como 360dialog necesitan apuntar a Laralis para recibir mensajes inbound.

URL del webhook de Laralis:
```
https://<dominio-laralis>/api/whatsapp/webhook?clinicId=<UUID-de-la-clínica>
```

- **Twilio**: en el Sender Profile → Webhook URL when a message comes in: pegar la URL anterior. HTTP method: POST.
- **360dialog**: en el dashboard de 360dialog → Webhooks → Set webhook URL: misma URL.

> El parámetro `?clinicId=` es opcional pero acelera la resolución. Si se omite, Laralis intenta resolver la clínica buscando el número destino en `marketing_campaign_channels.channel_address`.

### Paso 5. Activar la clínica en Supabase

Conectarse al SQL Editor y ejecutar:

```sql
-- Reemplazar <CLINIC-UUID>, <PROVIDER>, y datos por los reales
UPDATE clinics
SET notification_settings = jsonb_set(
  COALESCE(notification_settings, '{}'::jsonb),
  '{whatsapp}',
  jsonb_build_object(
    'enabled', true,
    'provider', '360dialog',  -- o 'twilio'
    'default_country_code', '52',
    'send_confirmations', true,
    'send_reminders', true,
    'reminder_hours_before', 24,
    -- Solo si es 360dialog:
    'd360_api_key', '<TU-API-KEY-360DIALOG>',
    'd360_phone_number', '+5215555555555'
    -- Si es Twilio, los credentials globales viven en variables de entorno (TWILIO_*)
  )
)
WHERE id = '<CLINIC-UUID>';
```

### Paso 6. Mapear el número del ad a la campaña

Si la clínica tiene un ad CTWA específico apuntando a este número:

```sql
INSERT INTO marketing_campaign_channels (
  clinic_id,
  campaign_id,
  channel_type,
  channel_address,
  provider,
  is_active,
  is_primary
) VALUES (
  '<CLINIC-UUID>',
  '<CAMPAIGN-UUID>',
  'whatsapp',
  'whatsapp:+5215555555555',
  '360dialog',
  true,
  true
);
```

### Paso 7. Re-aprobar plantillas

Las plantillas no se migran entre providers. En el dashboard del BSP, crear las siguientes:

- `appointment_confirmation` (Utility) — confirmación al agendar.
- `appointment_reminder` (Utility) — recordatorio 24h antes.
- `booking_received` (Utility) — confirmación de booking público.
- `follow_up_24h` (Utility) — rescate de leads sin respuesta (Fase 3).
- `last_chance` (Marketing) — última oportunidad para leads dormidos.

Tiempo de aprobación de Meta: minutos a 48 horas.

### Paso 8. Test end-to-end

1. Desde otro celular, enviar un WhatsApp al número conectado.
2. Verificar en Laralis → Bandeja de entrada que aparece la conversación con badge "Nuevo".
3. Verificar que Lara contesta automáticamente (si AI está configurado).
4. Tomar control de la conversación desde el botón "Tomar control".
5. Responder un mensaje desde el composer.
6. Verificar en el celular receptor que llegó la respuesta.

---

## Compliance — opt-in y privacidad

WhatsApp **no es HIPAA-compliant** y Meta lo dice explícitamente. En México no aplica HIPAA, pero sí la **Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)**.

### Reglas para clínicas dentales en MX

1. **Opt-in explícito**: el paciente debe consentir recibir comunicaciones por WhatsApp. Esto se cubre con el checkbox de consentimiento en el booking público de Laralis (`booking_received` solo se envía si el paciente lo aceptó).
2. **No PHI sensible en mensajes**: evitar diagnósticos detallados, radiografías, recetas con dosis. Usar lenguaje funcional ("Tu cita es mañana a las 10:00").
3. **Categorías sensibles**: ortodoncia, blanqueamiento y "estética dental" caen en gris para Meta. Si una plantilla se rechaza, ajustar copy a lenguaje neutro.
4. **Opt-out**: respetar palabras clave como "STOP" / "BAJA". El sistema debe marcar esos leads como `lost` y no enviar más automations. (Pendiente: implementar en Fase 3.)

---

## Quality rating y throughput

Cada número tiene rating de calidad **Green / Yellow / Red** basado en bloqueos y reportes de spam. Reglas para mantener verde:

- No mandar mensajes proactivos a contactos que no han iniciado conversación (sin opt-in válido).
- No mandar el mismo mensaje a >100 destinatarios sin segmentación.
- Si baja a yellow, frenar campañas Marketing por 48–72h y mandar solo Utility/Service.
- Si baja a red, parar todo envío proactivo durante una semana.

Throughput inicial: 250 conversaciones de marketing iniciadas/día (Tier 1k). Para 130 conv/mes esto sobra.

---

## Diagnóstico operativo

Si algo falla, en orden de probabilidad:

| Síntoma | Causa probable | Cómo verificar |
|---|---|---|
| Mensajes inbound no aparecen en Laralis | Webhook URL mal configurada o firma HMAC inválida | Vercel → Functions → Logs filtrando por `/api/whatsapp/webhook`. Si hay 403, hay mismatch de auth token. |
| Lara no responde | AI no configurado en `.env.local` | Revisar `KIMI_API_KEY` o `OPENAI_API_KEY`. |
| Notificaciones outbound fallan | Plantilla no aprobada o ventana 24h cerrada | Tabla `whatsapp_notifications` columna `error_message`. |
| Número rechazado por Meta | Display name no aprobado o categoría incorrecta | Dashboard del BSP. |
| Quality rating cayendo | Spam reports o ratio de bloqueos alto | Dashboard del BSP → Quality Rating. |

---

## Referencias externas

- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
- 360dialog docs: https://docs.360dialog.com
- Twilio WhatsApp docs: https://www.twilio.com/docs/whatsapp
- Meta Business Manager: https://business.facebook.com
- Política de WhatsApp Commerce: https://www.whatsapp.com/legal/commerce-policy

---

**Última actualización**: 2026-04-25
**Responsable**: el agente que implementó el módulo Inbox (ver devlog `2026-04-25-whatsapp-mini-crm.md`).
