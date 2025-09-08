# Memoria del Módulo: Punto de Equilibrio (Equilibrium)

## 📋 Resumen
Análisis financiero del punto de equilibrio del consultorio, calculando ingresos mínimos necesarios para cubrir costos fijos y variables, con márgenes de seguridad y proyecciones diarias.

## 🎯 Propósito Principal
Proporcionar visibilidad clara sobre:
- Ingresos mínimos para no tener pérdidas
- Meta diaria de facturación
- Progreso mensual hacia objetivos
- Margen de contribución del negocio
- Análisis de viabilidad financiera

## 🏗️ Arquitectura

### Componentes Principales
- **EquilibriumPage**: Dashboard con métricas y análisis
- **MetricCard**: Tarjetas de indicadores clave
- **Progress**: Barra de progreso mensual
- **SettingsModal**: Configuración de parámetros
- **useEquilibrium**: Hook con cálculos financieros

### Estructura de Datos
```typescript
interface EquilibriumData {
  // Parámetros configurables
  workDays: number // Días laborables al mes
  variableCostPercentage: number // % de costos variables
  safetyMarginPercentage: number // Margen de seguridad (20%)
  
  // Datos del negocio
  fixedCostsCents: number // Total costos fijos mensuales
  currentRevenueCents: number // Ingresos del mes actual
  
  // Cálculos
  breakEvenRevenueCents: number // Punto de equilibrio
  monthlyTargetCents: number // Meta con margen de seguridad
  dailyTargetCents: number // Meta diaria
  contributionMargin: number // Margen de contribución %
  safetyMarginCents: number // Monto del margen
  revenueGapCents: number // Faltante para meta
  daysToBreakEven: number // Días para alcanzar equilibrio
}
```

### Hooks Personalizados
- **useEquilibrium**: Gestión de cálculos y persistencia de configuración

## 🔄 Flujo de Trabajo

### Cálculo del Punto de Equilibrio
```typescript
// Fórmula básica
Punto_Equilibrio = Costos_Fijos / (1 - Costos_Variables%)

// Con margen de seguridad
Meta_Mensual = Punto_Equilibrio × (1 + Margen_Seguridad%)

// Meta diaria
Meta_Diaria = Meta_Mensual / Días_Laborables
```

### Análisis de Progreso
1. Sistema obtiene ingresos actuales del mes
2. Compara con meta mensual
3. Calcula porcentaje de avance
4. Determina brecha si existe
5. Proyecta días necesarios para alcanzar meta

### Configuración de Parámetros
1. Usuario ajusta días laborables (default: 20)
2. Define % de costos variables (default: 35%)
3. Sistema recalcula automáticamente todas las métricas
4. Guarda configuración por clínica

## 🔗 Relaciones con Otros Módulos

- **Costos Fijos**: Obtiene total de costos mensuales
- **Tratamientos**: Suma ingresos actuales
- **Dashboard**: Provee métricas clave
- **Reportes**: Base para análisis financiero
- **Tarifas**: Ayuda a definir precios mínimos

## 💼 Reglas de Negocio

1. **Margen de seguridad fijo**: 20% sobre punto de equilibrio
2. **Costos variables estimados**: Porcentaje sobre ingresos
3. **Días laborables**: Entre 1 y 31 días
4. **Margen de contribución**: 100% - Costos Variables%
5. **Actualización en tiempo real**: Cambios recalculan todo
6. **Multi-clínica**: Cada clínica tiene su configuración
7. **Período mensual**: Todos los cálculos son mensuales

## 🎨 Patrones de UI/UX

- **Grid de métricas**: 4 cards principales arriba
- **Barra de progreso**: Visual del avance mensual
- **Colores semánticos**: 
  - Verde: Meta alcanzada
  - Amarillo: 80-99% de avance
  - Rojo: < 80% de avance
- **Cards de análisis**: Explicación de conceptos
- **Modal de configuración**: Ajustes rápidos
- **Iconos contextuales**: Calculator, Target, TrendingUp

## 🔒 Seguridad y Permisos

- **Aislamiento por clínica**: Datos y configuración separados
- **Validación de rangos**: Porcentajes 0-100, días 1-31
- **Solo lectura de datos**: No modifica otros módulos
- **Configuración persistente**: Guardada en base de datos

## 📊 Métricas y KPIs

- **Punto de equilibrio**: Ingreso mínimo sin pérdidas
- **Meta mensual**: Con margen de seguridad
- **Meta diaria**: Dividida en días laborables
- **Progreso mensual**: % de meta alcanzada
- **Brecha de ingresos**: Faltante para meta
- **Margen de contribución**: Eficiencia operativa
- **Días para equilibrio**: Proyección temporal

## 🔧 Configuración

- **Días laborables**: Ajustable por usuario (default: 20)
- **% Costos variables**: Estimación ajustable (default: 35%)
- **Margen de seguridad**: Fijo en 20%
- **Actualización automática**: Al cambiar parámetros

## 📝 Notas Técnicas

- **Cálculos reactivos**: Todo en el hook useEquilibrium
- **Estado local**: Parámetros en estado del componente
- **Persistencia**: Configuración guardada en backend
- **Refresh manual**: Botón para actualizar datos
- **Loading states**: Skeletons mientras carga
- **Responsive grid**: Adapta a diferentes pantallas

## 🚀 Posibles Mejoras

- **Proyecciones históricas**: Comparar meses anteriores
- **Escenarios múltiples**: What-if analysis
- **Alertas automáticas**: Notificar si bajo del objetivo
- **Gráficos de tendencia**: Visualización temporal
- **Estacionalidad**: Ajustes por temporada
- **Metas personalizadas**: Definir objetivos propios
- **Análisis por servicio**: Qué servicios contribuyen más
- **Exportación de reportes**: PDF con análisis completo

## 📅 Última Actualización
2025-08-25