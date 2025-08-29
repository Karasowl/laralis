# Memoria del Módulo: Perfil (Profile)

## 📋 Resumen
Gestión de la información personal del usuario, preferencias de cuenta, configuración de seguridad y opciones de personalización de la experiencia en la aplicación.

## 🎯 Propósito Principal
Permitir al usuario gestionar:
- Información personal y profesional
- Credenciales de acceso
- Preferencias de interfaz
- Configuración de notificaciones
- Seguridad de la cuenta
- Gestión de sesiones

## 🏗️ Arquitectura

### Componentes Principales
- **ProfilePage**: Página principal del perfil
- **ProfileClient**: Cliente con tabs de secciones
- **PersonalInfoTab**: Información personal
- **SecurityTab**: Seguridad y contraseña
- **PreferencesTab**: Preferencias de UI
- **NotificationsTab**: Configuración de alertas
- **SessionsTab**: Dispositivos activos
- **DangerZone**: Acciones críticas (eliminar cuenta)

### Estructura de Datos
```typescript
interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  avatar_url?: string
  role: 'owner' | 'admin' | 'manager' | 'user'
  
  // Información profesional
  professional_id?: string
  specialty?: string
  bio?: string
  
  // Metadata
  created_at: string
  last_login: string
  email_verified: boolean
  phone_verified: boolean
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: 'es' | 'en'
  date_format: string
  time_format: '12h' | '24h'
  currency_display: 'symbol' | 'code'
  
  // UI preferences
  compact_mode: boolean
  animations_enabled: boolean
  sidebar_collapsed: boolean
  
  // Accessibility
  high_contrast: boolean
  font_size: 'small' | 'medium' | 'large'
}

interface SecuritySettings {
  two_factor_enabled: boolean
  two_factor_method?: 'sms' | 'app'
  
  password_updated_at: string
  require_password_change: boolean
  
  login_notifications: boolean
  suspicious_activity_alerts: boolean
}

interface NotificationSettings {
  email: {
    daily_summary: boolean
    weekly_report: boolean
    payment_received: boolean
    appointment_reminder: boolean
    low_stock_alert: boolean
  }
  
  push: {
    enabled: boolean
    sound: boolean
    vibration: boolean
  }
  
  sms: {
    enabled: boolean
    critical_only: boolean
  }
}
```

### Hooks Personalizados
- **useProfile**: Gestión del perfil y preferencias
- **useAuth**: Operaciones de autenticación
- **useNotifications**: Configuración de notificaciones

## 🔄 Flujo de Trabajo

### Actualización de Información
1. Usuario modifica campos en formulario
2. Validación en tiempo real
3. Auto-guardado con debounce (2s)
4. Confirmación visual de guardado
5. Sincronización con otros dispositivos

### Cambio de Contraseña
1. Solicita contraseña actual
2. Nueva contraseña con confirmación
3. Validación de fortaleza
4. Cierre de otras sesiones (opcional)
5. Email de confirmación

### Gestión de Sesiones
1. Lista dispositivos/navegadores activos
2. Información de IP y ubicación
3. Última actividad
4. Opción de cerrar sesión remota
5. Alertas de nuevo dispositivo

## 🔗 Relaciones con Otros Módulos

- **Auth**: Gestión de credenciales
- **Settings**: Preferencias generales
- **Dashboard**: Aplicación de preferencias
- **Notifications**: Sistema de alertas
- **Theme**: Modo claro/oscuro
- **i18n**: Idioma de interfaz

## 💼 Reglas de Negocio

1. **Email único**: No puede duplicarse
2. **Cambio de email**: Requiere verificación
3. **Contraseña fuerte**: Mínimo 8 caracteres
4. **2FA opcional**: Recomendado para admins
5. **Foto de perfil**: Máximo 5MB
6. **Sesiones activas**: Máximo 5 dispositivos
7. **Datos mínimos**: Nombre y email requeridos

## 🎨 Patrones de UI/UX

- **Tabs horizontales**: Organización de secciones
- **Avatar upload**: Drag & drop o click
- **Toggle switches**: Preferencias booleanas
- **Password strength**: Indicador visual
- **Save indicator**: Auto-save feedback
- **Danger zone**: Separado y con warnings
- **Responsive forms**: Stack en mobile
- **Immediate feedback**: Cambios aplicados al instante

## 🔒 Seguridad y Permisos

### Niveles de Acceso
- **Propio perfil**: Edición completa
- **Otros perfiles**: Solo lectura (admin)
- **Información sensible**: Re-autenticación

### Medidas de Seguridad
- **Contraseña hasheada**: Bcrypt
- **2FA**: TOTP o SMS
- **Session tokens**: JWT con refresh
- **Rate limiting**: Cambios de contraseña
- **Audit log**: Cambios importantes
- **Encriptación**: Datos sensibles

## 📊 Métricas y KPIs

- **Completitud del perfil**: % campos llenos
- **Adopción de 2FA**: % usuarios con 2FA
- **Frecuencia de actualización**: Cambios/mes
- **Preferencias más cambiadas**: Top settings
- **Dispositivos por usuario**: Promedio
- **Tiempo en perfil**: Duración de visita

## 🔧 Configuración

### Secciones Disponibles
- **Información Personal**: Datos básicos
- **Profesional**: Credenciales y especialidad
- **Seguridad**: Contraseña y 2FA
- **Preferencias**: UI y experiencia
- **Notificaciones**: Canales y frecuencia
- **Sesiones**: Dispositivos activos
- **Privacidad**: Control de datos
- **Zona Peligrosa**: Eliminar cuenta

### Valores por Defecto
- **Tema**: Sistema
- **Idioma**: Detectado del navegador
- **Notificaciones**: Todas activadas
- **2FA**: Desactivado
- **Animaciones**: Activadas

## 📝 Notas Técnicas

- **Optimistic UI**: Cambios inmediatos
- **Debounced saves**: Reduce API calls
- **Image optimization**: Resize en cliente
- **Form validation**: Zod schemas
- **State management**: Context + hooks
- **Cache strategy**: SWR para datos
- **Internacionalización**: Todos los textos

## 🚀 Posibles Mejoras

- **Social login**: Google, Facebook
- **Profile completeness**: Gamification
- **Public profile**: Página pública opcional
- **API tokens**: Para integraciones
- **Backup codes**: Para 2FA recovery
- **Activity timeline**: Historial detallado
- **Privacy center**: GDPR compliance
- **Profile export**: Descarga de datos
- **Delegated access**: Permisos temporales

## 📅 Última Actualización
2025-08-25