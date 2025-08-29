# Memoria del Módulo: Onboarding

## 📋 Resumen
Proceso guiado de configuración inicial que ayuda a nuevos usuarios a establecer su workspace, crear su primera clínica y configurar los parámetros básicos necesarios para comenzar a usar el sistema.

## 🎯 Propósito Principal
Garantizar una experiencia de inicio fluida mediante:
- Configuración paso a paso del workspace
- Creación de la primera clínica
- Establecimiento de parámetros básicos
- Validación de información crítica
- Orientación sobre funcionalidades principales

## 🏗️ Arquitectura

### Componentes Principales
- **OnboardingPage**: Contenedor principal del flujo
- **OnboardingWizard**: Wizard multi-paso
- **WorkspaceStep**: Creación del workspace
- **ClinicStep**: Configuración de clínica
- **BusinessSetupStep**: Parámetros de negocio
- **ReviewStep**: Revisión y confirmación
- **useOnboarding**: Hook con lógica del flujo

### Estructura de Datos
```typescript
interface OnboardingState {
  currentStep: number
  totalSteps: number
  completedSteps: string[]
  
  // Datos recolectados
  workspace: {
    name: string
    industry_type: 'dental' | 'medical'
    country: string
    timezone: string
    currency: string
  }
  
  clinic: {
    name: string
    address: string
    city: string
    phone: string
    email: string
    tax_id?: string
  }
  
  business: {
    work_days: number
    hours_per_day: number
    average_ticket_cents: number
    main_services: string[]
  }
  
  preferences: {
    language: 'es' | 'en'
    theme: 'light' | 'dark'
    tour_completed: boolean
  }
}

interface OnboardingStep {
  id: string
  title: string
  description: string
  required: boolean
  validation: () => boolean
  component: React.Component
}
```

### Hooks Personalizados
- **useOnboarding**: Gestión del estado y navegación del wizard

## 🔄 Flujo de Trabajo

### Proceso de Onboarding
1. **Bienvenida**: Explicación del proceso
2. **Workspace**: Nombre y configuración básica
3. **Clínica**: Datos de la primera ubicación
4. **Negocio**: Parámetros operativos
5. **Revisión**: Confirmación de datos
6. **Finalización**: Creación y redirect

### Validación Progresiva
```typescript
// Por paso
Paso 1: Validar nombre workspace único
Paso 2: Validar email y teléfono
Paso 3: Validar rangos de parámetros
Paso 4: Validación final completa

// Guardado parcial
- Estado se persiste en localStorage
- Permite continuar si se interrumpe
- Limpia al completar exitosamente
```

### Post-Onboarding
1. Marca usuario como onboarded
2. Redirect a dashboard
3. Opcional: Tour guiado
4. Sugerencias de siguientes pasos

## 🔗 Relaciones con Otros Módulos

- **Auth**: Solo usuarios autenticados
- **Workspace**: Crea workspace inicial
- **Clinics**: Crea primera clínica
- **Settings**: Establece configuración base
- **Dashboard**: Destino post-onboarding
- **Time Settings**: Configura parámetros temporales

## 💼 Reglas de Negocio

1. **Obligatorio para nuevos usuarios**: No se puede saltar
2. **Una sola vez**: No se repite el proceso
3. **Workspace único**: Validación de nombre
4. **Datos mínimos requeridos**: No puede avanzar sin completar
5. **Sin retroceso en producción**: Solo avance
6. **Timeout de sesión pausado**: Durante onboarding
7. **Creación atómica**: Todo o nada al final

## 🎨 Patrones de UI/UX

- **Wizard steps**: Indicador de progreso superior
- **Animaciones suaves**: Transiciones entre pasos
- **Formularios simples**: Pocos campos por paso
- **Validación inline**: Feedback inmediato
- **Botones claros**: Atrás/Siguiente prominentes
- **Skip opcional**: Solo para campos no requeridos
- **Ilustraciones**: Una por paso para contexto
- **Mobile-first**: Optimizado para móvil

## 🔒 Seguridad y Permisos

- **Autenticación requerida**: Usuario debe estar logueado
- **Validación server-side**: Doble check de datos
- **Rate limiting**: Previene spam de creación
- **Sanitización**: Inputs limpiados
- **No datos sensibles**: En esta etapa

## 📊 Métricas y KPIs

- **Tasa de completación**: % que termina
- **Tiempo promedio**: Duración del proceso
- **Drop-off points**: Dónde abandonan
- **Errores comunes**: Validaciones fallidas
- **Skip rate**: Campos opcionales saltados
- **Return rate**: Usuarios que vuelven a completar

## 🔧 Configuración

### Parámetros por Defecto
- **Workspace**: 
  - País: Detectado por IP
  - Timezone: Detectado por navegador
  - Moneda: Según país
- **Clínica**:
  - Ciudad: Detectada si permite geolocalización
- **Negocio**:
  - Días: 20
  - Horas: 8
  - % Real: 80

### Personalización
- **Pasos opcionales**: Configurables
- **Campos extra**: Por plan/región
- **Temas**: Branding personalizado

## 📝 Notas Técnicas

- **Estado en Context**: OnboardingProvider
- **Persistencia dual**: localStorage + backend
- **Validación con Zod**: Schemas por paso
- **Componentes lazy**: Carga por demanda
- **Error recovery**: Reintentos automáticos
- **Analytics tracking**: Eventos por paso
- **Internacionalización**: Detecta idioma preferido

## 🚀 Posibles Mejoras

- **Onboarding adaptativo**: Según tipo de usuario
- **Import de datos**: Desde otros sistemas
- **Video tutoriales**: Por paso
- **Asistente AI**: Ayuda contextual
- **Templates**: Configuraciones predefinidas
- **Colaborativo**: Invitar equipo durante setup
- **Progressive disclosure**: Más opciones para avanzados
- **Gamification**: Rewards por completar

## 📅 Última Actualización
2025-08-25