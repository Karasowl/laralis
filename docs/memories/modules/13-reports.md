# Memoria del Módulo: Reportes (Reports)

## 📋 Resumen
Centro de análisis y visualización de datos del consultorio, con métricas operativas, financieras y análisis avanzados para toma de decisiones basada en datos.

## 🎯 Propósito Principal
Proporcionar insights accionables sobre:
- Desempeño financiero del consultorio
- Tendencias de pacientes y tratamientos
- Análisis de rentabilidad
- Métricas operativas clave
- Reportes avanzados con IA

## 🏗️ Arquitectura

### Componentes Principales
- **ReportsPage**: Dashboard principal con tabs
- **ReportsAdvanced**: Análisis avanzados con IA
- **MetricCards**: Tarjetas de KPIs principales
- **ActivitySummary**: Resumen de actividad mensual
- **useReports**: Hook con agregación de datos

### Estructura de Datos
```typescript
interface DashboardData {
  // Métricas mensuales
  patientsMonth: number // Nuevos pacientes
  treatmentsMonth: number // Tratamientos realizados
  revenueMonth: number // Ingresos totales (centavos)
  averageMargin: number // Margen promedio %
  
  // Métricas calculadas
  averagePerTreatment: number // Ticket promedio
  completionRate: number // Tasa de completación
  
  // Tendencias (futuro)
  revenueGrowth?: number // % vs mes anterior
  patientRetention?: number // % que regresa
  topServices?: ServiceMetric[] // Servicios populares
}

interface ReportFilters {
  dateRange: { start: Date; end: Date }
  clinicId?: string
  serviceId?: string
  patientId?: string
}
```

### Hooks Personalizados
- **useReports**: Agregación de datos de múltiples módulos

## 🔄 Flujo de Trabajo

### Vista General (Overview)
1. Carga métricas del mes actual
2. Calcula KPIs principales
3. Muestra resumen de actividad
4. Presenta análisis financiero básico

### Análisis Avanzado
1. Filtros personalizables por período
2. Análisis de tendencias temporales
3. Comparativas intermensuales
4. Proyecciones basadas en históricos
5. Recomendaciones con IA

### Agregación de Datos
```typescript
// Fuentes de datos
- Pacientes: Nuevos registros del mes
- Tratamientos: Completados y facturados
- Costos: Fijos y variables
- Insumos: Consumo y rotación
- Marketing: ROI de campañas
```

## 🔗 Relaciones con Otros Módulos

- **Pacientes**: Métricas de captación y retención
- **Tratamientos**: Análisis de producción
- **Servicios**: Popularidad y rentabilidad
- **Costos Fijos**: Estructura de costos
- **Punto de Equilibrio**: Comparación con metas
- **Marketing**: Efectividad de campañas
- **Dashboard**: Provee métricas resumidas

## 💼 Reglas de Negocio

1. **Período por defecto**: Mes actual
2. **Cálculos en tiempo real**: Sin cache para exactitud
3. **Filtros acumulativos**: Se pueden combinar
4. **Privacidad de datos**: Solo clínica actual
5. **Métricas verificadas**: Doble validación de cálculos
6. **Exportación controlada**: Formatos específicos
7. **Histórico limitado**: Últimos 12 meses por defecto

## 🎨 Patrones de UI/UX

- **Tabs para organización**: Overview vs Advanced
- **Cards de métricas**: 4 KPIs principales arriba
- **Iconos con colores**: Identificación visual rápida
- **Grid responsive**: Adapta a diferentes pantallas
- **Loading skeletons**: Estados de carga elegantes
- **Colores semánticos**:
  - Azul: Pacientes
  - Verde: Tratamientos
  - Morado: Finanzas
  - Naranja: Márgenes

## 🔒 Seguridad y Permisos

- **Aislamiento por clínica**: Solo datos propios
- **Sin modificación**: Solo lectura de datos
- **Agregación en backend**: Cálculos seguros
- **Exportación auditada**: Log de descargas

## 📊 Métricas y KPIs

### Métricas Operativas
- **Nuevos pacientes**: Captación mensual
- **Tratamientos completados**: Producción
- **Tasa de completación**: % de tratamientos finalizados
- **Tiempo promedio**: Duración real vs estimada

### Métricas Financieras
- **Ingresos mensuales**: Total facturado
- **Ticket promedio**: Ingreso por tratamiento
- **Margen promedio**: Rentabilidad %
- **Costo por paciente**: CAC calculado

### Métricas de Eficiencia
- **Utilización de tiempo**: % de tiempo productivo
- **Rotación de inventario**: Velocidad de consumo
- **Productividad por día**: Ingresos/día laborable

## 🔧 Configuración

- **Período predeterminado**: Mes actual
- **Formato de moneda**: Locale del usuario
- **Decimales en porcentajes**: 1 decimal
- **Orden de métricas**: Personalizable (futuro)

## 📝 Notas Técnicas

- **Agregación en useReports**: Hook centraliza queries
- **Tabs de Radix UI**: Componente accesible
- **Cálculos memoizados**: Performance optimizada
- **Responsive design**: Grid system de Tailwind
- **Loading states**: Por componente individual
- **Internacionalización**: Todos los textos via next-intl

## 🚀 Posibles Mejoras

- **Gráficos interactivos**: Charts con Recharts
- **Exportación a PDF**: Reportes formateados
- **Comparativas personalizadas**: Períodos variables
- **Benchmarking**: Comparación con industria
- **Alertas automáticas**: KPIs fuera de rango
- **Dashboards personalizados**: Drag & drop de widgets
- **Análisis predictivo**: ML para proyecciones
- **Reportes programados**: Envío por email
- **API de datos**: Integración con BI tools

## 📅 Última Actualización
2025-08-25