# Memoria del Módulo: Marketing

## 📋 Resumen
Sistema de gestión de campañas de marketing y análisis de retorno de inversión (ROI), con tracking de fuentes de pacientes y efectividad de estrategias de captación.

## 🎯 Propósito Principal
Optimizar la inversión en marketing mediante:
- Tracking de campañas y su efectividad
- Análisis de ROI por canal
- Gestión de fuentes de captación
- Métricas de conversión
- Atribución de pacientes a campañas

## 🏗️ Arquitectura

### Componentes Principales
- **MarketingPage**: Dashboard de campañas
- **MarketingSettingsClient**: Configuración de marketing
- **CampaignManager**: Gestión de campañas
- **SourceTracking**: Tracking de fuentes
- **ROIAnalytics**: Análisis de retorno
- **useMarketing**: Hook con lógica de marketing

### Estructura de Datos
```typescript
interface Campaign {
  id: string
  clinic_id: string
  name: string
  channel: MarketingChannel
  budget_cents: number
  start_date: string
  end_date?: string
  status: 'active' | 'paused' | 'completed'
  
  // Métricas
  impressions?: number
  clicks?: number
  cost_per_click_cents?: number
  
  // Resultados
  patients_attributed: number
  revenue_attributed_cents: number
  roi_percentage: number
  
  created_at: string
}

type MarketingChannel = 
  | 'google_ads'
  | 'facebook'
  | 'instagram'
  | 'referral'
  | 'organic'
  | 'direct'
  | 'other'

interface PatientSource {
  id: string
  name: string
  channel: MarketingChannel
  is_paid: boolean
  track_roi: boolean
  
  // Métricas agregadas
  total_patients: number
  total_revenue_cents: number
  avg_patient_value_cents: number
}

interface MarketingMetrics {
  total_spend_cents: number
  total_patients: number
  total_revenue_cents: number
  overall_roi: number
  cost_per_acquisition_cents: number
  lifetime_value_cents: number
}
```

### Hooks Personalizados
- **useMarketing**: CRUD de campañas y análisis de métricas

## 🔄 Flujo de Trabajo

### Creación de Campaña
1. Define canal y presupuesto
2. Establece período de duración
3. Configura tracking parameters
4. Sistema genera código de tracking
5. Activa campaña

### Atribución de Pacientes
1. Nuevo paciente registra fuente
2. Si fuente tiene campaña activa, se atribuye
3. Sistema vincula paciente con campaña
4. Tratamientos del paciente suman a revenue
5. ROI se calcula automáticamente

### Cálculo de ROI
```typescript
// Fórmula ROI
ROI = ((Ingresos - Inversión) / Inversión) × 100

// Ejemplo
Inversión: $5,000
Pacientes captados: 10
Ingresos generados: $15,000
ROI = ((15,000 - 5,000) / 5,000) × 100 = 200%

// Cost Per Acquisition
CPA = Inversión / Pacientes
CPA = 5,000 / 10 = $500 por paciente
```

## 🔗 Relaciones con Otros Módulos

- **Pacientes**: Tracking de fuente y campaña
- **Tratamientos**: Cálculo de revenue por paciente
- **Reportes**: Métricas de marketing integradas
- **Dashboard**: KPIs de captación
- **Settings**: Configuración de canales

## 💼 Reglas de Negocio

1. **Atribución única**: Paciente se atribuye a una campaña
2. **Período de atribución**: 30 días desde primer contacto
3. **Revenue lifetime**: Todos los ingresos del paciente
4. **Campañas activas**: Solo una por canal simultáneamente
5. **Presupuesto en centavos**: Consistencia monetaria
6. **ROI mínimo objetivo**: 150% recomendado
7. **Multi-clínica**: Campañas por clínica

## 🎨 Patrones de UI/UX

- **Dashboard de campañas**: Cards con métricas clave
- **Timeline visual**: Campañas en línea temporal
- **Gráficos de ROI**: Visualización de retorno
- **Badges de estado**: Active/Paused/Completed
- **Colores por canal**: Identificación visual
- **Comparador de campañas**: Side-by-side analysis
- **Alertas de performance**: Campañas bajo objetivo

## 🔒 Seguridad y Permisos

- **Acceso por rol**: Marketing manager y superiores
- **Datos agregados**: No info personal de pacientes
- **Auditoría de cambios**: Log de modificaciones
- **Presupuestos aprobados**: Workflow de autorización

## 📊 Métricas y KPIs

### Métricas de Campaña
- **ROI**: Retorno sobre inversión
- **CPA**: Costo por adquisición
- **LTV**: Lifetime value del paciente
- **Conversion Rate**: Leads a pacientes
- **ROAS**: Return on ad spend

### Métricas por Canal
- **Efectividad**: Pacientes por canal
- **Costo promedio**: CPA por canal
- **Velocidad**: Tiempo de conversión
- **Calidad**: LTV por fuente

### Métricas Globales
- **Marketing spend ratio**: % de ingresos en marketing
- **Crecimiento orgánico**: Pacientes sin costo
- **Mix de canales**: Distribución de inversión
- **Tendencia de CAC**: Evolución del costo

## 🔧 Configuración

- **Canales disponibles**: Predefinidos + personalizados
- **Período de atribución**: 30 días configurable
- **ROI objetivo**: 150% por defecto
- **Alertas automáticas**: Bajo performance
- **Frecuencia de reportes**: Semanal/mensual

## 📝 Notas Técnicas

- **Tracking pixels**: Integración con plataformas
- **UTM parameters**: Para tracking preciso
- **API integrations**: Google Ads, Facebook API
- **Cálculos async**: ROI en background
- **Cache de métricas**: Actualización periódica
- **Internacionalización**: Monedas y formatos

## 🚀 Posibles Mejoras

- **Attribution modeling**: Multi-touch attribution
- **Predictive analytics**: Forecast de resultados
- **A/B testing**: Framework de experimentos
- **Marketing automation**: Workflows automatizados
- **Lead scoring**: Calificación de prospectos
- **Competitor analysis**: Benchmark de mercado
- **Cohort analysis**: Análisis por cohortes
- **API webhooks**: Integración con CRMs

## 📅 Última Actualización
2025-08-25