# Memoria del Módulo: Configuración (Settings)

## 📋 Resumen
Centro de control para toda la configuración del sistema, incluyendo ajustes de workspace, clínicas, preferencias de usuario y administración general de la aplicación.

## 🎯 Propósito Principal
Centralizar la gestión de:
- Configuración de workspace y clínicas
- Preferencias de usuario
- Ajustes de sistema
- Gestión de accesos y permisos
- Configuración de integraciones
- Opciones de personalización

## 🏗️ Arquitectura

### Componentes Principales
- **SettingsPage**: Hub principal con navegación
- **SettingsClient**: Cliente con tabs de categorías
- **WorkspaceSettings**: Configuración del workspace
- **ClinicSettings**: Gestión de clínicas
- **UserPreferences**: Preferencias personales
- **SecuritySettings**: Seguridad y privacidad
- **BillingSettings**: Facturación y suscripción

### Estructura de Datos
```typescript
interface WorkspaceSettings {
  id: string
  name: string
  logo_url?: string
  primary_color?: string
  timezone: string
  currency: string
  date_format: string
  language: string
  created_at: string
}

interface ClinicSettings {
  id: string
  workspace_id: string
  name: string
  address: string
  phone: string
  email: string
  tax_id?: string
  license_number?: string
  working_hours: WorkingHours
  specialties: string[]
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: 'es' | 'en'
  notifications: NotificationSettings
  dashboard_layout: DashboardLayout
  default_clinic_id?: string
}

interface SecuritySettings {
  two_factor_enabled: boolean
  session_timeout: number
  password_policy: PasswordPolicy
  data_retention_days: number
}
```

### Hooks Personalizados
- **useSettings**: Gestión centralizada de configuraciones
- **useWorkspaceSettings**: Configuración de workspace
- **useUserPreferences**: Preferencias de usuario

## 🔄 Flujo de Trabajo

### Navegación por Secciones
1. Sidebar con categorías de configuración
2. Cada sección carga su componente específico
3. Cambios se guardan automáticamente o con confirmación
4. Validación en tiempo real

### Jerarquía de Configuración
```
Workspace (nivel más alto)
  └── Clínicas (múltiples por workspace)
      └── Usuarios (acceso a clínicas)
          └── Preferencias (por usuario)
```

### Gestión de Cambios
1. Cambios simples: Auto-guardado con debounce
2. Cambios críticos: Confirmación requerida
3. Cambios de seguridad: Re-autenticación
4. Cambios de plan: Redirect a billing

## 🔗 Relaciones con Otros Módulos

- **Todos los módulos**: Provee configuración base
- **Onboarding**: Define configuración inicial
- **Profile**: Preferencias de usuario
- **Marketing**: Configuración de campañas
- **Dashboard**: Layout personalizable
- **Theme**: Modo claro/oscuro
- **i18n**: Idioma de la aplicación

## 💼 Reglas de Negocio

1. **Workspace único**: Un usuario puede tener un workspace
2. **Múltiples clínicas**: Workspace puede tener varias clínicas
3. **Permisos jerárquicos**: Admin > Manager > User
4. **Configuración heredada**: Clínica hereda de workspace
5. **Preferencias locales**: Se guardan en navegador
6. **Cambios auditados**: Log de modificaciones importantes
7. **Límites por plan**: Según suscripción activa

## 🎨 Patrones de UI/UX

- **Sidebar de navegación**: Categorías a la izquierda
- **Contenido principal**: Área derecha con formularios
- **Tabs para subsecciones**: Organización dentro de categorías
- **Toggle switches**: Para opciones booleanas
- **Auto-save indicator**: Feedback de guardado
- **Breadcrumbs**: Navegación contextual
- **Cards agrupadas**: Opciones relacionadas juntas

## 🔒 Seguridad y Permisos

- **Niveles de acceso**:
  - Owner: Todo
  - Admin: Todo excepto billing
  - Manager: Configuración de clínica
  - User: Solo preferencias propias
- **Configuración sensible**: Requiere contraseña
- **Logs de auditoría**: Cambios registrados
- **Datos encriptados**: Información sensible

## 📊 Métricas y KPIs

- **Configuraciones más cambiadas**: Identificar pain points
- **Tiempo en configuración**: Complejidad del setup
- **Errores de validación**: Campos problemáticos
- **Adopción de features**: Qué se usa/no se usa
- **Preferencias comunes**: Defaults más cambiados

## 🔧 Configuración

### Secciones Disponibles
- **General**: Nombre, logo, información básica
- **Clínicas**: Gestión de múltiples ubicaciones
- **Usuarios**: Invitaciones y permisos
- **Apariencia**: Tema, colores, personalización
- **Notificaciones**: Email, SMS, in-app
- **Seguridad**: 2FA, políticas de contraseña
- **Integraciones**: APIs externas
- **Facturación**: Plan y método de pago
- **Avanzado**: Developer settings, webhooks

## 📝 Notas Técnicas

- **Estado global**: Context API para settings
- **Persistencia dual**: Local + backend
- **Validación en capas**: Cliente y servidor
- **Cache de configuración**: Reduce API calls
- **Lazy loading**: Secciones cargan on-demand
- **Internacionalización**: Todos los labels traducidos

## 🚀 Posibles Mejoras

- **Búsqueda en settings**: Encontrar opciones rápido
- **Presets de configuración**: Templates predefinidos
- **Import/Export**: Backup de configuración
- **Configuración por rol**: Templates por tipo de usuario
- **Modo demo**: Probar cambios sin aplicar
- **Historial de cambios**: Versioning de configuración
- **Configuración remota**: API para automatización
- **Wizard de configuración**: Guía paso a paso

## 📅 Última Actualización
2025-08-25