# Memoria del Módulo: Costos Fijos (Fixed Costs)

## 📋 Resumen
Gestión de gastos recurrentes mensuales del consultorio que no varían con la producción. Incluye integración automática con depreciación de activos para calcular el costo total operativo mensual.

## 🎯 Propósito Principal
Registrar y categorizar todos los costos fijos mensuales para:
- Calcular costo por minuto de operación
- Base para cálculo de tarifas y precios
- Análisis de estructura de costos
- Proyección de punto de equilibrio
- Control presupuestario mensual

## 🏗️ Arquitectura

### Componentes Principales
- **FixedCostsPage**: Página principal con tabla y breakdown por categoría
- **FixedCostForm**: Formulario de creación/edición
- **SummaryCards**: Tarjetas con totales y depreciación
- **CategoryBreakdown**: Visualización gráfica de distribución
- **useFixedCosts**: Hook con lógica de negocio y cálculos

### Estructura de Datos
```typescript
interface FixedCost {
  id: string
  clinic_id: string
  category: FixedCostCategory
  concept: string // Descripción del gasto
  amount_cents: number // Monto mensual
  created_at: string
}

type FixedCostCategory = 
  | 'rent'        // Renta del local
  | 'utilities'   // Luz, agua, gas, internet
  | 'salaries'    // Sueldos y prestaciones
  | 'insurance'   // Seguros
  | 'maintenance' // Mantenimiento preventivo
  | 'education'   // Capacitación continua
  | 'advertising' // Publicidad fija
  | 'other'       // Otros gastos

// Calculado dinámicamente
interface FixedCostsSummary {
  totalManualCosts: number // Suma de costos ingresados
  monthlyDepreciation: number // Desde módulo de activos
  totalCosts: number // Manual + depreciación
  manualCount: number // Cantidad de conceptos
  costPerMinute: number // Total / minutos laborables
}
```

### Hooks Personalizados
- **useFixedCosts**: CRUD con cálculo de totales y integración con depreciación

## 🔄 Flujo de Trabajo

### Registro de Costo Fijo
1. Usuario selecciona categoría del gasto
2. Describe el concepto (ej: "Renta local principal")
3. Ingresa monto mensual
4. Sistema guarda y recalcula totales
5. Actualiza automáticamente costo por minuto

### Integración con Depreciación
1. Sistema consulta total de depreciación de activos
2. Suma automáticamente a costos fijos totales
3. No se puede editar (calculado automáticamente)
4. Se muestra separado en resumen

### Visualización por Categoría
1. Breakdown visual con barras de progreso
2. Porcentaje de cada categoría sobre el total
3. Colores consistentes por categoría
4. Incluye depreciación como categoría especial

## 🔗 Relaciones con Otros Módulos

- **Activos**: Depreciación se suma automáticamente
- **Configuración de Tiempo**: Define minutos laborables para costo/minuto
- **Tarifas**: Usa costo fijo por minuto para pricing
- **Tratamientos**: Costo fijo forma parte del snapshot
- **Punto de Equilibrio**: Base para análisis de break-even
- **Reportes**: Análisis de estructura de costos
- **Dashboard**: Métricas de eficiencia operativa

## 💼 Reglas de Negocio

1. **Montos mensuales**: Todos los costos se expresan por mes
2. **Depreciación automática**: No editable, viene de activos
3. **Categorización obligatoria**: Todo costo debe tener categoría
4. **Sin duplicados**: Validar conceptos únicos por categoría
5. **Multi-clínica**: Cada clínica gestiona sus costos
6. **Actualización inmediata**: Cambios afectan costo/minuto al instante
7. **Histórico preservado**: Tratamientos mantienen snapshot del momento

## 🎨 Patrones de UI/UX

- **Layout 2/3 + 1/3**: Tabla principal y breakdown lateral
- **Colores por categoría**: Identificación visual consistente
- **Barras de progreso**: Visualización de porcentajes
- **Cards de resumen**: Totales destacados arriba
- **Badge de categoría**: En tabla para identificación rápida
- **Nota de depreciación**: Indica que es auto-calculada

## 🔒 Seguridad y Permisos

- **Aislamiento por clínica**: RLS garantiza costos por clinic_id
- **Validación de montos**: Solo valores positivos
- **Auditoría**: Tracking con created_at
- **Protección de fórmulas**: Cálculos en backend

## 📊 Métricas y KPIs

- **Costo total mensual**: Manual + depreciación
- **Costo por minuto**: Base para todos los cálculos
- **Distribución por categoría**: Qué consume más recursos
- **Tendencia mensual**: Evolución de costos en el tiempo
- **Eficiencia operativa**: Costos vs ingresos
- **Categoría dominante**: Mayor porcentaje del total
- **Variación intermensual**: Cambios mes a mes

## 🔧 Configuración

- **Categorías predefinidas**: No editables por usuario
- **Moneda**: Siempre en centavos internamente
- **Período**: Mensual (no configurable)
- **Integración automática**: Depreciación sin intervención

## 📝 Notas Técnicas

- **Cálculo de totales**: useMemo para performance
- **Breakdown dinámico**: Filtrado y agrupación en frontend
- **Colores hardcodeados**: Map de categoría a color Tailwind
- **Grid responsive**: 2 columnas en desktop, 1 en móvil
- **FormSection wrapper**: Estructura consistente de formularios
- **Internacionalización**: Categorías y textos via next-intl

## 🚀 Posibles Mejoras

- **Costos variables**: Diferenciar fijos de semi-variables
- **Proyecciones**: Estimar costos futuros
- **Alertas de variación**: Notificar cambios significativos
- **Comparación histórica**: Gráficos de evolución
- **Presupuesto**: Definir límites por categoría
- **Estacionalidad**: Ajustes por temporada
- **Múltiples períodos**: Costos trimestrales o anuales
- **Importación masiva**: Carga desde Excel/CSV

## 📅 Última Actualización
2025-08-25