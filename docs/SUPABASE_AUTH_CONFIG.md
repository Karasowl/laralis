# Configuración de Autenticación en Supabase

## Problema Actual
Los enlaces de recuperación de contraseña están marcándose como expirados inmediatamente.

## Solución - Configuración en el Dashboard de Supabase

### 1. Ve a tu proyecto en Supabase
- URL: https://supabase.com/dashboard/project/ojlfihowjakbgobbrwjz

### 2. Authentication → URL Configuration

#### Site URL
```
http://localhost:3000
```

#### Redirect URLs (IMPORTANTE - Agrega TODAS estas)
```
http://localhost:3000/**
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
```

### 3. Authentication → Email Templates

#### Reset Password Template
Ve a "Reset Password" y asegúrate de que el template tenga este formato:

```html
<h2>Reset Password</h2>

<p>Follow this link to reset the password for your user:</p>
<p><a href="{{ .SiteURL }}/auth/callback?code={{ .Token }}&type=recovery">Reset Password</a></p>
```

**IMPORTANTE**: El enlace debe ir a `/auth/callback` NO directamente a `/auth/reset-password`

### 4. Authentication → Settings

#### Token Lifetimes
- **Password Recovery Token Expiry**: 3600 (1 hora) o más

### 5. Email Settings (opcional pero recomendado)

Si los emails no llegan o tardan mucho:

1. Ve a Settings → Email
2. Considera usar un servicio SMTP personalizado como:
   - SendGrid
   - Mailgun
   - Amazon SES

## Flujo Correcto

1. Usuario solicita reset en `/auth/forgot-password`
2. Recibe email con enlace a `/auth/callback?code=XXX&type=recovery`
3. `/auth/callback` intercambia el código por sesión
4. Redirige a `/auth/reset-password?recovery=true`
5. Usuario cambia contraseña
6. Sistema redirige según estado (onboarding o dashboard)

## Testing Local

Para probar localmente sin esperar emails:

1. Ve a Supabase Dashboard → Authentication → Users
2. Encuentra tu usuario
3. Click en los 3 puntos → "Send password recovery"
4. El email llegará con el enlace correcto

## Verificación

Después de hacer estos cambios:

1. Solicita un nuevo enlace de recuperación
2. El enlace en el email debe verse así:
   ```
   http://localhost:3000/auth/callback?code=XXXXX&type=recovery
   ```
3. Al hacer clic, deberías poder cambiar tu contraseña sin errores

## Notas Importantes

- Los códigos de recuperación son de UN SOLO USO
- Si haces clic dos veces en el mismo enlace, fallará
- Si el enlace tiene más de 1 hora, expirará
- Asegúrate de que el Site URL coincida exactamente con tu URL local