# Tutorial: Configurar SMS (Twilio) y Push Notifications

## Parte 1: Migraciones SQL a Ejecutar

### Migración 1: Push Notifications
**Archivo**: `supabase/migrations/65_push_notifications.sql`

Copia y pega este SQL en el SQL Editor de Supabase:

```sql
-- Migration 65: Web Push Notifications Support
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  expiration_time timestamptz,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  user_agent text,
  device_name varchar(255),
  is_active boolean DEFAULT true,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  notification_type varchar(50) NOT NULL,
  title varchar(255) NOT NULL,
  body text NOT NULL,
  icon_url text,
  action_url text,
  status varchar(20) NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  clicked_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_clinic ON push_subscriptions(clinic_id);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX idx_push_notifications_subscription ON push_notifications(subscription_id);
CREATE INDEX idx_push_notifications_status ON push_notifications(status);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own push subscriptions"
  ON push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own push subscriptions"
  ON push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own push subscriptions"
  ON push_subscriptions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own push subscriptions"
  ON push_subscriptions FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Service role can manage all push subscriptions"
  ON push_subscriptions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users can view notifications for their subscriptions"
  ON push_notifications FOR SELECT USING (
    EXISTS (SELECT 1 FROM push_subscriptions WHERE id = subscription_id AND user_id = auth.uid())
  );
CREATE POLICY "Service role can manage all push notifications"
  ON push_notifications FOR ALL USING (auth.role() = 'service_role');
```

---

### Migración 2: SMS Notifications
**Archivo**: `supabase/migrations/66_sms_notifications.sql`

```sql
-- Migration 66: SMS Notifications Support
CREATE TABLE IF NOT EXISTS sms_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES treatments(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  public_booking_id uuid REFERENCES public_bookings(id) ON DELETE SET NULL,
  notification_type varchar(50) NOT NULL CHECK (notification_type IN (
    'appointment_confirmation', 'appointment_reminder', 'appointment_cancelled',
    'appointment_rescheduled', 'booking_received', 'booking_confirmed', 'custom'
  )),
  recipient_phone varchar(50) NOT NULL,
  recipient_name varchar(255),
  message_content text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'delivered', 'failed', 'undelivered'
  )),
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  provider varchar(50) DEFAULT 'twilio',
  provider_message_id varchar(255),
  cost_cents int DEFAULT 2,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sms_notifications_clinic ON sms_notifications(clinic_id);
CREATE INDEX idx_sms_notifications_treatment ON sms_notifications(treatment_id);
CREATE INDEX idx_sms_notifications_patient ON sms_notifications(patient_id);
CREATE INDEX idx_sms_notifications_status ON sms_notifications(status);
CREATE INDEX idx_sms_notifications_created ON sms_notifications(created_at DESC);

ALTER TABLE sms_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sms notifications for their clinics"
  ON sms_notifications FOR SELECT USING (
    clinic_id IN (SELECT c.id FROM clinics c JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid())
  );
CREATE POLICY "Users can insert sms notifications for their clinics"
  ON sms_notifications FOR INSERT WITH CHECK (
    clinic_id IN (SELECT c.id FROM clinics c JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid())
  );
CREATE POLICY "Users can update sms notifications for their clinics"
  ON sms_notifications FOR UPDATE USING (
    clinic_id IN (SELECT c.id FROM clinics c JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid())
  );
CREATE POLICY "Service role can manage sms notifications"
  ON sms_notifications FOR ALL USING (auth.role() = 'service_role');
```

---

## Parte 2: Configurar Twilio para SMS

### Paso 1: Crear cuenta en Twilio
1. Ve a https://www.twilio.com/try-twilio
2. Regístrate con tu email
3. Verifica tu número de teléfono

### Paso 2: Obtener credenciales
1. Ve al Dashboard de Twilio: https://console.twilio.com/
2. Copia estos valores:
   - **Account SID**: Empieza con `AC...`
   - **Auth Token**: Click en "Show" para verlo

![Twilio Dashboard](https://www.twilio.com/docs/static/img/console-dashboard.png)

### Paso 3: Obtener un número de teléfono
1. En el Dashboard, ve a **Phone Numbers** → **Manage** → **Buy a number**
2. Selecciona un número con capacidad SMS (busca el ícono de mensaje)
3. Compra el número (~$1 USD/mes)
4. Copia el número en formato `+1234567890`

### Paso 4: Configurar en Laralis

En tu clínica, actualiza `notification_settings.sms` con este JSON:

```json
{
  "enabled": true,
  "twilio_account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "twilio_auth_token": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "twilio_phone_number": "+1234567890",
  "default_country_code": "52",
  "send_confirmations": true,
  "send_reminders": true,
  "reminder_hours_before": 24
}
```

**Opción A**: Via SQL en Supabase:
```sql
UPDATE clinics
SET notification_settings = jsonb_set(
  COALESCE(notification_settings, '{}'),
  '{sms}',
  '{
    "enabled": true,
    "twilio_account_sid": "TU_ACCOUNT_SID",
    "twilio_auth_token": "TU_AUTH_TOKEN",
    "twilio_phone_number": "+TU_NUMERO",
    "default_country_code": "52",
    "send_confirmations": true,
    "send_reminders": true,
    "reminder_hours_before": 24
  }'
)
WHERE id = 'TU_CLINIC_ID';
```

**Opción B**: Crear UI en Settings (ya hay código base en NotificationsClient.tsx)

### Paso 5: Probar SMS
1. Crea un tratamiento con fecha futura (24 horas)
2. Asegúrate que el paciente tenga teléfono
3. El cron job enviará SMS automáticamente

### Costos de Twilio SMS
- **SMS a México**: ~$0.0075 USD por mensaje
- **SMS a USA**: ~$0.0079 USD por mensaje
- **SMS a España**: ~$0.04 USD por mensaje

---

## Parte 3: Configurar Push Notifications

### Paso 1: Generar VAPID Keys

Ejecuta en terminal:
```bash
cd web
npx web-push generate-vapid-keys
```

Output ejemplo:
```
Public Key: BCf...muy_largo...xyz
Private Key: abc...muy_largo...123
```

### Paso 2: Agregar a .env.local

```env
# Push Notifications
VAPID_PUBLIC_KEY=BCf...muy_largo...xyz
VAPID_PRIVATE_KEY=abc...muy_largo...123
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BCf...muy_largo...xyz
```

### Paso 3: Activar en la App
1. Ve a **Settings** → **Notifications**
2. En la sección "Push Notifications", click **"Activar"**
3. El navegador pedirá permiso
4. Acepta para suscribirte

### Paso 4: Probar Push
Por ahora el sistema guarda suscripciones pero no envía (falta implementar delivery).
Puedes verificar en la tabla `push_subscriptions` que tu suscripción se guardó.

---

## Resumen de Archivos

### Migraciones (ejecutar en Supabase):
- `supabase/migrations/65_push_notifications.sql`
- `supabase/migrations/66_sms_notifications.sql`

### Código SMS:
- `web/lib/sms/service.ts` - Servicio principal
- `web/lib/sms/types.ts` - Tipos TypeScript
- `web/lib/sms/index.ts` - Exports

### Código Push:
- `web/public/sw.js` - Service Worker
- `web/lib/push/service.ts` - Servicio
- `web/hooks/use-push-notifications.ts` - Hook cliente
- `web/app/api/notifications/push/subscribe/route.ts` - API

### Cron Job (ya integrado):
- `web/app/api/cron/send-reminders/route.ts` - Envía SMS + Email

---

## Preguntas Frecuentes

**¿Twilio es gratis?**
No, pero hay trial con $15 USD de crédito. Suficiente para ~2000 SMS a México.

**¿Necesito tarjeta de crédito?**
Para el trial no. Para producción sí.

**¿El SMS funciona sin configurar?**
No. Debes tener cuenta Twilio y configurar las credenciales.

**¿Push funciona sin VAPID keys?**
La UI funciona (guarda suscripciones) pero no puede enviar notificaciones reales.

**¿Puedo usar otro proveedor de SMS?**
El código usa Twilio directamente. Para otro proveedor necesitarías modificar `lib/sms/service.ts`.
