# Memoria del Módulo: Tarifas (Tariffs)

## 📋 Resumen
Sistema de gestión de versiones de tarifas que calcula precios de servicios basándose en costos fijos, variables y márgenes de ganancia, manteniendo histórico de cambios.

## 🎯 Propósito Principal
Administrar la estrategia de precios mediante:
- Cálculo automático basado en costos reales
- Versionado de cambios en tarifas
- Aplicación de márgenes de ganancia
- Histórico de evolución de precios
- Comparación entre versiones

## 🏗️ Arquitectura

### Componentes Principales
- **TariffsPage**: Lista de versiones y gestión
- **TariffBuilder**: Constructor de nueva versión
- **TariffComparison**: Comparador de versiones
- **ServicePricing**: Cálculo de precio por servicio
- **useTariffs**: Hook con lógica de versionado

### Estructura de Datos
```typescript
interface Tariff {
  id: string
  clinic_id: string
  version: number // Incremental
  name: string // "Tarifa 2025 Q1"
  description?: string
  is_active: boolean // Solo una activa
  
  // Parámetros de cálculo
  base_margin_pct: number // Margen por defecto
  fixed_per_minute_cents: number // Snapshot del momento
  
  // Servicios con precios
  services: TariffService[]
  
  created_at: string
  activated_at?: string
}

interface TariffService {
  tariff_id: string
  service_id: string
  
  // Snapshot de costos
  fixed_cost_cents: number
  variable_cost_cents: number
  total_cost_cents: number
  
  // Pricing
  margin_pct: number // Puede diferir del base
  final_price_cents: number
  
  // Metadata
  custom_price: boolean // Si fue ajustado manualmente
}
```

### Hooks Personalizados
- **useTariffs**: CRUD de versiones con activación y comparación

## 🔄 Flujo de Trabajo

### Creación de Nueva Tarifa
1. Sistema copia tarifa activa como base
2. Recalcula costos con valores actuales
3. Usuario ajusta márgenes globales o por servicio
4. Preview muestra impacto en precios
5. Guarda como nueva versión (no activa)
6. Opción de activar inmediatamente

### Cálculo de Precios
```typescript
// Por servicio
costo_fijo = minutos_servicio × costo_por_minuto_actual
costo_variable = suma_insumos_servicio
costo_total = costo_fijo + costo_variable
precio_final = costo_total × (1 + margen/100)

// Ejemplo
Limpieza dental: 30 min
Costo fijo: 30 × $4 = $120
Costo variable: $35 (insumos)
Costo total: $155
Margen: 60%
Precio final: $155 × 1.6 = $248
```

### Activación de Tarifa
1. Desactiva tarifa anterior
2. Activa nueva versión
3. Nuevos tratamientos usan precios actualizados
4. Históricos mantienen precio original

## 🔗 Relaciones con Otros Módulos

- **Servicios**: Define base de servicios a tarifar
- **Configuración de Tiempo**: Provee costo por minuto
- **Insumos**: Define costos variables
- **Tratamientos**: Usa tarifa activa para pricing
- **Reportes**: Análisis de evolución de precios
- **Dashboard**: Muestra versión activa

## 💼 Reglas de Negocio

1. **Una tarifa activa**: Solo una versión activa por vez
2. **Versionado incremental**: Números consecutivos
3. **Snapshot inmutable**: Costos se fijan al crear
4. **Margen mínimo**: No puede ser negativo
5. **Precios redondeados**: A entero más cercano
6. **Histórico preservado**: Versiones anteriores consultables
7. **Activación manual**: No automática

## 🎨 Patrones de UI/UX

- **Lista de versiones**: Timeline con versión activa destacada
- **Badge de estado**: Active/Inactive visual
- **Comparador lado a lado**: Diff entre versiones
- **Preview de cambios**: Antes/después de precios
- **Ajuste por categoría**: Márgenes grupales
- **Iconos de tendencia**: Arrows para cambios

## 🔒 Seguridad y Permisos

- **Por clínica**: Tarifas aisladas
- **Sin eliminación**: Solo desactivación
- **Auditoría completa**: Quién activó y cuándo
- **Validación de márgenes**: Rangos permitidos

## 📊 Métricas y KPIs

- **Evolución de precios**: Tendencia histórica
- **Margen promedio**: Por versión de tarifa
- **Servicios más ajustados**: Cambios frecuentes
- **Impacto en ingresos**: Proyección de cambios
- **Competitividad**: Comparación con mercado
- **Elasticidad**: Respuesta a cambios de precio

## 🔧 Configuración

- **Margen por defecto**: 60% configurable
- **Redondeo**: A peso completo
- **Versiones visibles**: Últimas 10
- **Comparación**: Máximo 3 versiones

## 📝 Notas Técnicas

- **Cálculo en creación**: Snapshot al momento
- **Transacción atómica**: Activación/desactivación
- **Comparador con diff**: Resalta cambios
- **Cache de tarifa activa**: Para performance
- **Bulk update**: Todos los servicios a la vez
- **Internacionalización**: Formatos y textos

## 🚀 Posibles Mejoras

- **Tarifas por segmento**: Diferentes precios por tipo de paciente
- **Descuentos programados**: Por volumen o lealtad
- **Simulador de impacto**: Proyección de ingresos
- **Importación de competencia**: Benchmark de precios
- **Aprobación workflow**: Proceso de autorización
- **Vigencia temporal**: Fechas de inicio/fin
- **Tarifas promocionales**: Temporales con condiciones
- **API de consulta**: Para sistemas externos

## 📅 Última Actualización
2025-08-25