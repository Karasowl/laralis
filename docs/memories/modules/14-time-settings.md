# Memoria del Módulo: Configuración de Tiempo (Time Settings)

## 📋 Resumen
Configuración de parámetros temporales del consultorio que determinan la disponibilidad real de trabajo y son base fundamental para el cálculo del costo por minuto operativo.

## 🎯 Propósito Principal
Establecer con precisión:
- Días laborables mensuales
- Horas de trabajo diarias
- Porcentaje de tiempo productivo real
- Cálculo automático del costo por minuto
- Base para tarifas y precios de servicios

## 🏗️ Arquitectura

### Componentes Principales
- **TimePage**: Página de configuración con preview en vivo
- **TimeForm**: Formulario con sliders interactivos
- **CostCalculation**: Visualización del cálculo de costo/minuto
- **useTimeSettings**: Hook con lógica de cálculo y persistencia

### Estructura de Datos
```typescript
interface SettingsTime {
  id: string
  clinic_id: string
  work_days: number // Días laborables al mes (1-31)
  hours_per_day: number // Horas diarias (1-24)
  real_pct: number // % tiempo productivo real (50-100)
  
  // Calculados
  total_minutes: number // work_days × hours_per_day × 60
  real_minutes: number // total_minutes × (real_pct/100)
  fixed_per_minute_cents: number // costos_fijos / real_minutes
  
  updated_at: string
}

interface TimeCalculations {
  totalHoursMonth: number
  totalMinutesMonth: number
  realMinutesMonth: number
  fixedCostPerMinute: number
  hourlyRate: number
}
```

### Hooks Personalizados
- **useTimeSettings**: Gestión de configuración y cálculos derivados

## 🔄 Flujo de Trabajo

### Configuración Inicial
1. Usuario define días laborables (ej: 20 días)
2. Establece horas diarias (ej: 8 horas)
3. Ajusta % tiempo productivo (ej: 80%)
4. Sistema calcula minutos reales disponibles
5. Obtiene costos fijos totales
6. Calcula costo por minuto automáticamente

### Cálculo del Costo por Minuto
```typescript
// Fórmula completa
minutos_totales = días × horas × 60
minutos_reales = minutos_totales × (porcentaje_real / 100)
costo_por_minuto = costos_fijos_totales / minutos_reales

// Ejemplo
20 días × 8 horas × 60 = 9,600 minutos
9,600 × 0.80 = 7,680 minutos reales
$30,000 / 7,680 = $3.91 por minuto
```

### Impacto en el Sistema
1. Cambio en configuración recalcula costo/minuto
2. Afecta todos los servicios futuros
3. Tratamientos existentes mantienen snapshot
4. Tarifas se actualizan automáticamente

## 🔗 Relaciones con Otros Módulos

- **Costos Fijos**: Obtiene total para dividir entre minutos
- **Servicios**: Usa costo/minuto para calcular costo fijo
- **Tratamientos**: Incluye en snapshot al crear
- **Tarifas**: Base para cálculo de precios
- **Punto de Equilibrio**: Define capacidad productiva
- **Dashboard**: Muestra eficiencia de tiempo

## 💼 Reglas de Negocio

1. **Tiempo real vs teórico**: Siempre menor al 100%
2. **Rango de días**: 1-31 días máximo
3. **Rango de horas**: 1-24 horas máximo
4. **Porcentaje real**: 50-100% (nunca menos de 50%)
5. **Actualización inmediata**: Sin delay en cálculos
6. **Un registro por clínica**: Se actualiza, no se crea nuevo
7. **Valores por defecto**: 20 días, 8 horas, 80% real

## 🎨 Patrones de UI/UX

- **Sliders interactivos**: Ajuste visual de valores
- **Preview en vivo**: Cálculos actualizados al mover
- **Cards explicativas**: Fórmulas y ejemplos
- **Colores de feedback**: Verde para valores óptimos
- **Tooltips informativos**: Explicación de cada campo
- **Iconos contextuales**: Clock, Calendar, Calculator

## 🔒 Seguridad y Permisos

- **Configuración por clínica**: Aislamiento total
- **Validación de rangos**: Previene valores imposibles
- **Auditoría de cambios**: updated_at tracking
- **Sin eliminación**: Solo actualización

## 📊 Métricas y KPIs

- **Minutos disponibles**: Capacidad total mensual
- **Minutos reales**: Capacidad productiva real
- **Costo por minuto**: Métrica fundamental
- **Costo por hora**: Para comparación
- **Eficiencia teórica**: % de tiempo productivo
- **Capacidad utilizada**: Minutos vendidos vs disponibles

## 🔧 Configuración

- **Valores por defecto recomendados**:
  - Días: 20 (lunes a viernes, 4 semanas)
  - Horas: 8 (jornada estándar)
  - Real: 80% (considera tiempos muertos)
- **Rangos permitidos**:
  - Días: 1-31
  - Horas: 1-24
  - Real: 50-100%

## 📝 Notas Técnicas

- **Cálculo reactivo**: Cambios disparan recálculo inmediato
- **Sliders de Radix UI**: Componentes accesibles
- **Validación con Zod**: Schema para rangos
- **Estado único**: Un solo registro por clínica
- **Preview memoizado**: useMemo para performance
- **Internacionalización**: Textos y formatos via next-intl

## 🚀 Posibles Mejoras

- **Horarios por día**: Configuración día por día
- **Calendario de excepciones**: Días festivos, vacaciones
- **Turnos múltiples**: Mañana/tarde con diferentes costos
- **Estacionalidad**: Ajustes por temporada
- **Histórico de cambios**: Log de modificaciones
- **Simulador de escenarios**: What-if analysis
- **Integración con agenda**: Cálculo basado en citas reales
- **Reportes de utilización**: Análisis de tiempo usado

## 📅 Última Actualización
2025-08-25