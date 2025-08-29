# Memoria del Módulo: Pacientes (Patients)

## 📋 Resumen
Gestión integral de la base de datos de pacientes del consultorio dental, incluyendo información personal, historial de visitas, fuentes de captación y seguimiento de campañas de marketing.

## 🎯 Propósito Principal
Centralizar toda la información de los pacientes para facilitar su atención médica, seguimiento de tratamientos y análisis de fuentes de captación. Este módulo es fundamental para entender el origen de los pacientes y la efectividad de las estrategias de marketing.

## 🏗️ Arquitectura

### Componentes Principales
- **PatientsPage**: Página principal con tabla de pacientes y gestión CRUD
- **PatientForm**: Formulario completo para crear/editar pacientes
- **PatientDetails**: Vista detallada de información del paciente
- **usePatients**: Hook personalizado para toda la lógica de negocio

### Estructura de Datos
```typescript
interface Patient {
  id: string
  clinic_id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  birth_date?: string
  first_visit_date?: string
  gender?: 'male' | 'female' | 'other'
  address?: string
  city?: string
  postal_code?: string
  notes?: string
  source_id?: string // Fuente de captación
  referred_by_patient_id?: string // Referido por otro paciente
  campaign_id?: string // Campaña de marketing
  created_at: string
  updated_at?: string
}

interface PatientSource {
  id: string
  name: string // "Recomendación", "Google", "Facebook", etc.
  description?: string
  color?: string
  icon?: string
  is_active: boolean
  is_system: boolean // Fuentes predefinidas del sistema
}

interface Campaign {
  id: string
  name: string
  source_id: string
  description?: string
  start_date?: string
  end_date?: string
}
```

### Hooks Personalizados
- **usePatients**: Gestión completa de pacientes con operaciones CRUD, búsqueda y manejo de fuentes/campañas

## 🔄 Flujo de Trabajo

### Registro de Nuevo Paciente
1. Usuario abre modal de creación desde botón "Agregar Paciente"
2. Completa información básica (nombre, contacto)
3. Selecciona fuente de captación (cómo conoció la clínica)
4. Opcionalmente indica si fue referido por otro paciente
5. Si aplica, asocia con campaña de marketing activa
6. Sistema guarda con clinic_id automático

### Gestión de Fuentes de Captación
1. Sistema incluye fuentes predefinidas (Recomendación, Google, Facebook, etc.)
2. Usuario puede agregar fuentes personalizadas
3. Cada paciente se asocia a una fuente
4. Permite análisis de efectividad de canales de marketing

### Búsqueda y Filtrado
1. Búsqueda en tiempo real por nombre, email o teléfono
2. Filtros por fuente de captación
3. Filtros por fecha de primera visita
4. Ordenamiento por diferentes criterios

## 🔗 Relaciones con Otros Módulos

- **Tratamientos**: Cada tratamiento se asocia a un paciente específico
- **Marketing**: Tracking de campañas y ROI basado en pacientes captados
- **Reportes**: Análisis de captación y retención de pacientes
- **Dashboard**: Métricas de nuevos pacientes y tendencias

## 💼 Reglas de Negocio

1. **Información mínima requerida**: Nombre y apellido son obligatorios
2. **Unicidad flexible**: Email y teléfono no son únicos (familia puede compartir)
3. **Primera visita**: Se registra automáticamente al crear primer tratamiento
4. **Privacidad**: Información sensible en campo de notas encriptado
5. **Multi-clínica**: Pacientes aislados por clinic_id
6. **Referidos**: Un paciente puede referir a múltiples nuevos pacientes

## 🎨 Patrones de UI/UX

- **Avatar con iniciales**: Generación automática con gradiente de colores
- **Vista en tabla**: Información condensada con acciones rápidas
- **Modal de detalles**: Vista completa con historial y estadísticas
- **Formulario en pasos**: Información básica → Contacto → Marketing
- **Búsqueda instantánea**: Filtrado en tiempo real sin recargar página
- **Badges de estado**: Visual para fuente de captación

## 🔒 Seguridad y Permisos

- **Aislamiento por clínica**: RLS garantiza que solo se vean pacientes de la clínica actual
- **Datos sensibles**: Encriptación de notas médicas
- **Auditoría**: Registro de created_at y updated_at automático
- **Soft delete**: Opción de archivar en lugar de eliminar permanentemente
- **GDPR compliance**: Exportación y eliminación de datos personales

## 📊 Métricas y KPIs

- **Nuevos pacientes por mes**: Tendencia de crecimiento
- **Tasa de retención**: Pacientes que regresan
- **Valor de vida del cliente (LTV)**: Ingresos totales por paciente
- **Costo de adquisición (CAC)**: Inversión en marketing / nuevos pacientes
- **Net Promoter Score (NPS)**: Pacientes que refieren a otros
- **Efectividad de fuentes**: Qué canales traen más pacientes

## 🔧 Configuración

- **Fuentes predefinidas**: Configurables a nivel de workspace
- **Campos personalizados**: Extensible con campos adicionales
- **Validaciones**: Formatos de teléfono y email por región
- **Notificaciones**: Alertas de cumpleaños o citas pendientes

## 📝 Notas Técnicas

- **Optimización de búsqueda**: Índices en first_name, last_name, email, phone
- **Carga lazy**: Paginación de resultados para grandes volúmenes
- **Cache de fuentes**: PatientSources se cachean al ser poco cambiantes
- **Formulario reactivo**: React Hook Form con validación Zod
- **Internacionalización**: Todos los textos via next-intl

## 🚀 Posibles Mejoras

- **Historial médico**: Integración con expediente clínico completo
- **Portal del paciente**: App móvil para que pacientes vean su información
- **Recordatorios automáticos**: WhatsApp/SMS para citas
- **Integración con CRM**: Sincronización con herramientas de marketing
- **Análisis predictivo**: IA para predecir pacientes en riesgo de abandono
- **Programa de lealtad**: Puntos y recompensas por referidos

## 📅 Última Actualización
2025-08-25