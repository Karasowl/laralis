# Configuración de Emails para Códigos de Verificación

## Estado Actual

En desarrollo, los códigos de verificación se muestran en:
1. La consola del servidor
2. La respuesta JSON (solo en desarrollo)

## Opciones para Producción

### Opción 1: Configurar SMTP en Supabase (Recomendado)

1. Ve a tu dashboard de Supabase
2. Settings → Auth → SMTP Settings
3. Click "Enable Custom SMTP"
4. Configura con uno de estos servicios:

#### Gmail (Gratis, límite 500 emails/día)
```
Host: smtp.gmail.com
Port: 587
Username: tu-email@gmail.com
Password: contraseña de aplicación (no tu contraseña normal)
```

#### SendGrid (Gratis hasta 100 emails/día)
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: tu-api-key-de-sendgrid
```

### Opción 2: Supabase Edge Function

1. Instala Supabase CLI
2. Crea una función edge:

```bash
supabase functions new send-verification-email
```

3. En `supabase/functions/send-verification-email/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { email, code } = await req.json()
  
  // Aquí puedes usar cualquier servicio de email
  // Por ejemplo, la API de SendGrid, Mailgun, etc.
  
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

4. Despliega la función:
```bash
supabase functions deploy send-verification-email
```

5. Actualiza el código en `send-code/route.ts` para llamar a tu Edge Function.

### Opción 3: Webhook a tu propio servidor

Si tienes tu propio servidor de emails, puedes:

1. Crear un endpoint en tu servidor
2. Hacer una llamada desde el API route de Next.js
3. Tu servidor envía el email

## Plantilla de Email Sugerida

```html
Asunto: Código de verificación - Eliminar cuenta

Hola,

Tu código de verificación es: [CÓDIGO]

Este código expira en 10 minutos.

Si no solicitaste eliminar tu cuenta, ignora este mensaje.

ADVERTENCIA: Eliminar tu cuenta es permanente e irreversible.

Saludos,
El equipo de Laralis
```

## Notas Importantes

- Supabase tiene plantillas predefinidas (Signup, Login, Reset Password) pero NO para acciones personalizadas
- El servicio built-in de Supabase tiene límites estrictos (no para producción)
- Para producción SIEMPRE configura SMTP personalizado o Edge Functions