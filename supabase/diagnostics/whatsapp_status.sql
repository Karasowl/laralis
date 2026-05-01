-- =============================================================================
-- DIAGNÓSTICO: Estado actual de WhatsApp por clínica
-- =============================================================================
-- Cómo usar:
--   1. Abrir Supabase Dashboard → SQL Editor → New query.
--   2. Pegar este archivo completo y ejecutar.
--   3. Copiar la salida (solo el resumen final, sin tokens/secrets) y enviarla.
--
-- Lo que responde:
--   - ¿Cuántas clínicas tienen WhatsApp habilitado?
--   - ¿Qué provider están usando (Twilio / 360dialog)?
--   - ¿Hay tráfico inbound (mensajes recibidos) en los últimos 30 días?
--   - ¿Hay tráfico outbound (notificaciones enviadas) y con qué status?
--   - ¿Hay leads y cuántos están en cada etapa del pipeline?
--   - ¿Hay números mapeados en marketing_campaign_channels?
--
-- IMPORTANTE: este script NO modifica datos. Es 100% read-only.
-- =============================================================================

-- 1. Resumen por clínica del estado de WhatsApp
SELECT
  c.id AS clinic_id,
  c.name AS clinic_name,
  COALESCE((c.notification_settings -> 'whatsapp' ->> 'enabled')::boolean, false) AS whatsapp_enabled,
  COALESCE(c.notification_settings -> 'whatsapp' ->> 'provider', 'unset') AS provider,
  c.notification_settings -> 'whatsapp' ->> 'twilio_phone_number' IS NOT NULL AS has_twilio_phone,
  COALESCE(c.notification_settings -> 'whatsapp' ->> 'default_country_code', 'unset') AS country_code,
  COALESCE((c.notification_settings -> 'whatsapp' ->> 'send_confirmations')::boolean, false) AS send_confirmations,
  COALESCE((c.notification_settings -> 'whatsapp' ->> 'send_reminders')::boolean, false) AS send_reminders
FROM clinics c
ORDER BY c.created_at DESC;

-- 2. Conteo de conversaciones por estado, por clínica (últimos 30 días)
SELECT
  c.name AS clinic_name,
  ic.status,
  COUNT(*) AS conversation_count,
  MIN(ic.created_at) AS oldest,
  MAX(ic.last_message_at) AS most_recent
FROM inbox_conversations ic
JOIN clinics c ON c.id = ic.clinic_id
WHERE ic.created_at >= NOW() - INTERVAL '30 days'
GROUP BY c.name, ic.status
ORDER BY c.name, ic.status;

-- 3. Volumen de mensajes inbound vs outbound por clínica (últimos 30 días)
SELECT
  c.name AS clinic_name,
  im.direction,
  im.role,
  COUNT(*) AS message_count
FROM inbox_messages im
JOIN inbox_conversations ic ON ic.id = im.conversation_id
JOIN clinics c ON c.id = ic.clinic_id
WHERE im.created_at >= NOW() - INTERVAL '30 days'
GROUP BY c.name, im.direction, im.role
ORDER BY c.name, im.direction, im.role;

-- 4. Pipeline de leads por clínica (todos los tiempos)
SELECT
  c.name AS clinic_name,
  l.status AS lead_status,
  COUNT(*) AS lead_count,
  COUNT(*) FILTER (WHERE l.converted_patient_id IS NOT NULL) AS converted_to_patient
FROM leads l
JOIN clinics c ON c.id = l.clinic_id
GROUP BY c.name, l.status
ORDER BY c.name, l.status;

-- 5. Outbound notifications enviadas vía WhatsApp (últimos 30 días) por status
SELECT
  c.name AS clinic_name,
  wn.provider,
  wn.notification_type,
  wn.status,
  COUNT(*) AS notif_count,
  SUM(wn.cost_cents) AS total_cost_cents
FROM whatsapp_notifications wn
JOIN clinics c ON c.id = wn.clinic_id
WHERE wn.created_at >= NOW() - INTERVAL '30 days'
GROUP BY c.name, wn.provider, wn.notification_type, wn.status
ORDER BY c.name, wn.notification_type, wn.status;

-- 6. Números (channel_address) mapeados a campañas
SELECT
  c.name AS clinic_name,
  mc.name AS campaign_name,
  mcc.channel_type,
  mcc.channel_address,
  mcc.provider,
  mcc.is_active,
  mcc.is_primary
FROM marketing_campaign_channels mcc
JOIN clinics c ON c.id = mcc.clinic_id
LEFT JOIN marketing_campaigns mc ON mc.id = mcc.campaign_id
WHERE mcc.channel_type = 'whatsapp'
ORDER BY c.name, mcc.is_primary DESC;

-- 7. Plantillas de WhatsApp activas
SELECT
  c.name AS clinic_name,
  wt.template_type,
  wt.language,
  wt.provider,
  wt.is_active,
  LENGTH(wt.content) AS content_length,
  wt.provider_template_id IS NOT NULL AS has_provider_id
FROM whatsapp_templates wt
JOIN clinics c ON c.id = wt.clinic_id
WHERE wt.is_active = true
ORDER BY c.name, wt.template_type, wt.language;

-- 8. Conversaciones huérfanas (no mapeadas a clínica conocida) — debería ser 0
SELECT COUNT(*) AS orphan_conversations
FROM inbox_conversations ic
LEFT JOIN clinics c ON c.id = ic.clinic_id
WHERE c.id IS NULL;

-- 9. Resumen de cierre: ¿qué tan "vivo" está el módulo de WhatsApp por clínica?
WITH clinic_summary AS (
  SELECT
    c.id,
    c.name,
    COALESCE((c.notification_settings -> 'whatsapp' ->> 'enabled')::boolean, false) AS enabled,
    COALESCE(c.notification_settings -> 'whatsapp' ->> 'provider', 'unset') AS provider,
    (
      SELECT COUNT(*)
      FROM inbox_conversations ic
      WHERE ic.clinic_id = c.id
        AND ic.created_at >= NOW() - INTERVAL '30 days'
    ) AS conversations_30d,
    (
      SELECT COUNT(*)
      FROM whatsapp_notifications wn
      WHERE wn.clinic_id = c.id
        AND wn.created_at >= NOW() - INTERVAL '30 days'
    ) AS notifications_30d,
    (
      SELECT COUNT(*)
      FROM leads l
      WHERE l.clinic_id = c.id
        AND l.created_at >= NOW() - INTERVAL '30 days'
    ) AS leads_30d
  FROM clinics c
)
SELECT
  name AS clinic,
  enabled AS whatsapp_on,
  provider,
  conversations_30d,
  notifications_30d,
  leads_30d,
  CASE
    WHEN NOT enabled THEN 'NOT_CONFIGURED'
    WHEN conversations_30d = 0 AND notifications_30d = 0 THEN 'CONFIGURED_BUT_INACTIVE'
    WHEN notifications_30d > 0 AND conversations_30d = 0 THEN 'OUTBOUND_ONLY'
    WHEN conversations_30d > 0 AND notifications_30d = 0 THEN 'INBOUND_ONLY'
    ELSE 'FULLY_ACTIVE'
  END AS state
FROM clinic_summary
ORDER BY conversations_30d DESC, notifications_30d DESC;
