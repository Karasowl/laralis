# Memoria del Módulo: Dashboard

## 📋 Resumen
Panel de control principal que presenta una vista consolidada del estado del consultorio con métricas clave, tendencias y accesos rápidos a las funciones más utilizadas.

## 🎯 Propósito Principal
Proporcionar visibilidad instantánea sobre:
- Estado financiero actual
- Actividad operativa del día/mes
- Tendencias y comparativas
- Alertas y notificaciones importantes
- Accesos directos a acciones frecuentes

## 🏗️ Arquitectura

### Componentes Principales
- **DashboardPage**: Layout principal del dashboard
- **MetricCards**: Tarjetas de KPIs principales
- **ActivityFeed**: Feed de actividad reciente
- **QuickActions**: Botones de acción rápida
- **TrendCharts**: Gráficos de tendencias
- **UpcomingAppointments**: Próximas citas
- **useDashboard**: Hook con agregación de datos

### Estructura de Datos
```typescript
interface DashboardData {
  // Métricas del día
  todayMetrics: {
    appointments: number
    revenue_cents: number
    new_patients: number
    treatments_completed: number
  }
  
  // Métricas del mes
  monthMetrics: {
    revenue_cents: number
    expenses_cents: number
    profit_cents: number
    patients_total: number
    treatments_total: number
    avg_ticket_cents: number
  }
  
  // Comparativas
  comparisons: {
    revenue_vs_last_month: number // % cambio
    patients_vs_last_month: number
    productivity_index: number // % utilización
  }
  
  // Actividad reciente
  recentActivity: ActivityItem[]
  
  // Próximas citas
  upcomingAppointments: Appointment[]
  
  // Alertas
  alerts: DashboardAlert[]
}

interface ActivityItem {
  id: string
  type: 'patient' | 'treatment' | 'payment' | 'expense'
  description: string
  timestamp: string
  user_name: string
  amount_cents?: number
}

interface DashboardAlert {
  id: string
  severity: 'info' | 'warning' | 'error'
  title: string
  message: string
  action?: {
    label: string
    url: string
  }
}
```

### Hooks Personalizados
- **useDashboard**: Agregación de datos de múltiples fuentes en tiempo real

## 🔄 Flujo de Trabajo

### Carga del Dashboard
1. Fetch paralelo de todas las métricas
2. Agregación y cálculo de comparativas
3. Ordenamiento de actividad reciente
4. Identificación de alertas activas
5. Renderizado progresivo (skeleton → data)

### Actualización en Tiempo Real
1. Polling cada 30 segundos para actividad
2. WebSocket para notificaciones urgentes
3. Refresh manual disponible
4. Cache inteligente de datos estáticos

### Personalización
1. Usuario puede reordenar cards
2. Ocultar/mostrar secciones
3. Elegir período de comparación
4. Configurar alertas relevantes

## 🔗 Relaciones con Otros Módulos

- **Todos los módulos**: Dashboard agrega datos de todos
- **Reportes**: Versión resumida de reportes
- **Pacientes**: Nuevos registros y actividad
- **Tratamientos**: Producción y revenue
- **Gastos**: Control de expenses
- **Punto de Equilibrio**: Progress hacia meta
- **Marketing**: ROI y captación

## 💼 Reglas de Negocio

1. **Datos del día actual**: Hasta el momento
2. **Mes en curso**: Del 1 al día actual
3. **Comparativas**: Mismo período mes anterior
4. **Actividad**: Últimas 20 acciones
5. **Alertas priorizadas**: Por severidad
6. **Acceso completo**: Solo datos de clínica actual
7. **Refresh rate**: 30 segundos mínimo

## 🎨 Patrones de UI/UX

- **Grid responsive**: 
  - Desktop: 4 columnas
  - Tablet: 2 columnas
  - Mobile: 1 columna
- **Skeleton loading**: Durante carga inicial
- **Colores semánticos**:
  - Verde: Positivo/Crecimiento
  - Rojo: Negativo/Decrecimiento
  - Amarillo: Atención/Warning
  - Azul: Información/Neutral
- **Iconos consistentes**: Lucide icons
- **Cards interactivas**: Click para detalle
- **Pull to refresh**: En mobile

## 🔒 Seguridad y Permisos

- **Vista por rol**:
  - Owner/Admin: Todo
  - Manager: Sin datos financieros sensibles
  - User: Métricas operativas básicas
- **Datos agregados**: Sin info personal
- **Cache seguro**: No persiste datos sensibles
- **Timeout de sesión**: Auto-logout

## 📊 Métricas y KPIs

### KPIs Principales (Always visible)
- **Revenue del día**: Ingresos actuales
- **Pacientes nuevos**: Captación
- **Tratamientos completados**: Productividad
- **Margen promedio**: Rentabilidad

### Métricas Secundarias
- **Ocupación**: % de agenda utilizada
- **Ticket promedio**: Valor por tratamiento
- **Conversión**: Consultas a tratamientos
- **Satisfacción**: NPS si disponible

### Tendencias
- **Revenue**: Últimos 7 días
- **Pacientes**: Últimos 30 días
- **Gastos**: Comparativa mensual
- **ROI Marketing**: Si hay campañas

## 🔧 Configuración

- **Período por defecto**: Hoy y mes actual
- **Cards visibles**: Personalizable por usuario
- **Orden de cards**: Drag & drop
- **Tema**: Claro/Oscuro
- **Densidad**: Compact/Comfortable/Spacious
- **Auto-refresh**: On/Off

## 📝 Notas Técnicas

- **Queries paralelas**: Promise.all para performance
- **Memoización agresiva**: useMemo para cálculos
- **Lazy loading**: Chunks por sección
- **Error boundaries**: Por componente
- **Responsive design**: Container queries
- **Internacionalización**: Formatos y textos

## 🚀 Posibles Mejoras

- **Widgets personalizables**: Agregar/quitar widgets
- **Dashboard múltiples**: Por rol o preferencia
- **Exportación**: PDF del dashboard
- **Compartir snapshot**: Link temporal
- **Modo TV**: Para pantalla en recepción
- **Forecasting**: Proyecciones con ML
- **Voz**: Comandos y lectura de métricas
- **Mobile app**: Dashboard nativo

## 📅 Última Actualización
2025-08-25