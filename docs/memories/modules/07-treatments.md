# Memoria del Módulo: Tratamientos (Treatments)

## 📋 Resumen
Sistema de registro y gestión de tratamientos dentales realizados a pacientes, con cálculo automático de precios basado en costos fijos, variables y márgenes de ganancia. Incluye snapshots inmutables para preservar históricos.

## 🎯 Propósito Principal
Documentar todos los tratamientos realizados con información completa de costos y precios en el momento de su ejecución. Este módulo es crítico para:
- Calcular ingresos reales del consultorio
- Mantener historial médico de pacientes
- Analizar rentabilidad por servicio
- Preservar información histórica de precios y costos

## 🏗️ Arquitectura

### Componentes Principales
- **TreatmentsPage**: Página principal con tabla de tratamientos y estadísticas
- **TreatmentForm**: Formulario para crear/editar tratamientos
- **SummaryCards**: Tarjetas con métricas clave (ingresos, tasa completados, etc.)
- **useTreatments**: Hook con lógica de negocio y cálculos de precios

### Estructura de Datos
```typescript
interface Treatment {
  id: string
  clinic_id: string
  patient_id: string
  service_id: string
  treatment_date: string
  minutes: number // Duración real del tratamiento
  
  // Snapshot de costos (inmutable)
  fixed_per_minute_cents: number // Costo fijo por minuto al momento
  variable_cost_cents: number // Costo variable del servicio
  margin_pct: number // Margen de ganancia aplicado
  price_cents: number // Precio final cobrado
  tariff_version?: number // Versión de tarifa aplicada
  
  status: 'pending' | 'completed' | 'cancelled'
  notes?: string
  
  // Snapshot completo para auditoría
  snapshot_costs?: {
    fixed_cost_cents: number
    variable_cost_cents: number
    total_cost_cents: number
    margin_pct: number
    price_cents: number
    tariff_version: number
  }
  
  created_at: string
  updated_at: string
}
```

### Hooks Personalizados
- **useTreatments**: Gestión completa con cálculo automático de precios y preservación de snapshots

## 🔄 Flujo de Trabajo

### Registro de Tratamiento
1. Usuario selecciona paciente y servicio
2. Sistema sugiere duración basada en servicio (est_minutes)
3. Usuario puede ajustar minutos reales utilizados
4. Sistema calcula automáticamente:
   - Costo fijo = fixed_per_minute_cents × minutes
   - Costo variable = del servicio seleccionado
   - Costo total = fijo + variable
   - Precio = costo_total × (1 + margin_pct/100)
5. Guarda snapshot inmutable de todos los valores

### Cálculo de Precios
```typescript
// Fórmula de precio
const fixedCost = fixedPerMinuteCents * minutes
const totalCost = fixedCost + variableCost
const price = Math.round(totalCost * (1 + marginPct / 100))
```

### Estados del Tratamiento
- **Pending**: Programado pero no realizado
- **Completed**: Tratamiento completado
- **Cancelled**: Cancelado (no afecta reportes de ingresos)

## 🔗 Relaciones con Otros Módulos

- **Pacientes**: Cada tratamiento vinculado a un paciente específico
- **Servicios**: Define el servicio base y costo variable
- **Configuración de Tiempo**: Provee el costo fijo por minuto
- **Tarifas**: Define versiones de precios y márgenes
- **Reportes**: Datos para análisis financiero y P&L
- **Dashboard**: Métricas de ingresos y productividad
- **Gastos**: Los tratamientos descuentan insumos del inventario

## 💼 Reglas de Negocio

1. **Snapshot inmutable**: Una vez creado, los costos históricos nunca se recalculan
2. **Versionado de tarifas**: Cambios en costos generan nueva versión de tarifa
3. **Precio mínimo**: No puede ser menor al costo total (margen >= 0)
4. **Duración mínima**: Al menos 1 minuto
5. **Estado final**: Tratamientos completados no pueden editarse (solo notas)
6. **Descuento de inventario**: Al completar, descuenta insumos automáticamente
7. **Multi-clínica**: Aislamiento por clinic_id

## 🎨 Patrones de UI/UX

- **SummaryCards superiores**: Métricas clave siempre visibles
- **Tabla con badges de estado**: Visual para pending/completed/cancelled
- **Iconos contextuales**: Calendar, User, Clock, DollarSign
- **Formulario reactivo**: Actualización automática de minutos al cambiar servicio
- **Confirmación de eliminación**: Previene borrado accidental
- **Vista de precio destacada**: Monto en negrita y alineado a derecha

## 🔒 Seguridad y Permisos

- **RLS por clínica**: Solo tratamientos de la clínica actual
- **Auditoría completa**: Snapshot preserva estado exacto al momento
- **Validación de referencias**: Paciente y servicio deben existir
- **Protección de históricos**: Tratamientos completados son read-only
- **Logs de cambios**: created_at y updated_at automáticos

## 📊 Métricas y KPIs

- **Ingresos totales**: Suma de price_cents de tratamientos completados
- **Tasa de completación**: % de tratamientos completados vs totales
- **Precio promedio**: Ingreso total / cantidad tratamientos
- **Productividad por día**: Ingresos agrupados por fecha
- **Servicios más rentables**: Análisis de margen por tipo de servicio
- **Tiempo real vs estimado**: Comparación minutes vs est_minutes
- **Tendencia de precios**: Evolución histórica por versión de tarifa

## 🔧 Configuración

- **Margen por defecto**: 60% configurable
- **Duración estimada**: Por servicio, actualizable
- **Costo fijo por minuto**: Desde configuración de tiempo
- **Versiones de tarifa**: Tracking automático de cambios

## 📝 Notas Técnicas

- **Cálculos en el hook**: Toda la lógica de precios en useTreatments
- **Datos paralelos**: Carga simultánea de patients, services, time settings
- **Memoización**: Summary statistics con useMemo para performance
- **Preservación en updates**: Mantiene snapshot_costs originales
- **Formulario controlado**: React Hook Form con Zod validation
- **Internacionalización**: Todos los textos via next-intl

## 🚀 Posibles Mejoras

- **Tratamientos múltiples**: Registrar varios servicios en una sesión
- **Plantillas de tratamiento**: Planes de tratamiento predefinidos
- **Descuentos y promociones**: Sistema de descuentos por volumen o campaña
- **Agenda integrada**: Calendario con citas y tratamientos programados
- **Fotos del tratamiento**: Adjuntar imágenes antes/después
- **Firma digital**: Consentimiento del paciente en tablet
- **Facturación automática**: Generar factura al completar
- **Seguimiento post-tratamiento**: Recordatorios de revisión

## 📅 Última Actualización
2025-08-25