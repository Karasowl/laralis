# Memoria del Módulo: Servicios (Services)

## 📋 Resumen
Catálogo de servicios dentales ofrecidos por la clínica, con definición de duración estimada, precio base y receta de insumos necesarios. Base para el cálculo de costos variables en tratamientos.

## 🎯 Propósito Principal
Definir y gestionar todos los servicios dentales disponibles, estableciendo:
- Tiempo estimado de ejecución para planificación
- Receta de insumos (materiales necesarios)
- Precio base sugerido
- Categorización para organización y reportes

## 🏗️ Arquitectura

### Componentes Principales
- **ServicesPage**: Página principal con tabla de servicios
- **ServiceForm**: Formulario para crear/editar servicios
- **SuppliesManager**: Gestión de insumos asociados al servicio
- **ServicesTable**: Tabla con costos calculados en tiempo real
- **CategoryModal**: Gestión de categorías personalizadas
- **useServices**: Hook con lógica de negocio y relaciones

### Estructura de Datos
```typescript
interface Service {
  id: string
  clinic_id: string
  name: string
  description?: string
  category?: string // 'preventivo', 'restaurativo', 'endodoncia', etc.
  duration_minutes: number // Tiempo estimado
  base_price_cents: number // Precio base sugerido
  created_at: string
  updated_at: string
}

interface ServiceSupply {
  service_id: string
  supply_id: string
  quantity: number // Cantidad de porciones del insumo
}

// Calculado en runtime
interface ServiceWithCost extends Service {
  variable_cost_cents: number // Suma de costos de insumos
  fixed_cost_cents: number // duration_minutes × fixed_per_minute
  total_cost_cents: number // fixed + variable
}
```

### Hooks Personalizados
- **useServices**: CRUD de servicios con gestión de recetas e integración con insumos

## 🔄 Flujo de Trabajo

### Creación de Servicio
1. Usuario define información básica (nombre, categoría, duración)
2. Añade insumos necesarios con cantidades específicas
3. Sistema calcula automáticamente costo variable (suma de insumos)
4. Opcionalmente establece precio base sugerido
5. Guarda servicio con receta asociada

### Gestión de Receta de Insumos
1. Cada servicio tiene lista de insumos necesarios
2. Se especifica cantidad de porciones por insumo
3. Sistema calcula costo variable total:
   ```
   costo_variable = Σ(insumo.costo_por_porcion × cantidad)
   ```
4. Actualización automática si cambia precio de insumos

### Categorización
1. Categorías predefinidas del sistema
2. Usuario puede crear categorías personalizadas
3. Facilita filtrado y análisis por tipo de servicio

## 🔗 Relaciones con Otros Módulos

- **Insumos**: Define materiales necesarios y costos variables
- **Tratamientos**: Usa servicios como base, puede ajustar duración real
- **Tarifas**: Calcula precios finales basados en costos del servicio
- **Configuración de Tiempo**: Provee costo fijo por minuto
- **Reportes**: Análisis de rentabilidad por servicio
- **Dashboard**: Métricas de servicios más solicitados

## 💼 Reglas de Negocio

1. **Duración mínima**: Al menos 1 minuto
2. **Receta opcional**: Servicio puede no tener insumos (consultas)
3. **Costo variable dinámico**: Se recalcula si cambian precios de insumos
4. **Precio base orientativo**: No obligatorio, sirve como referencia
5. **Categorías flexibles**: Personalizable por clínica
6. **Multi-clínica**: Cada clínica define sus propios servicios
7. **Inmutabilidad en tratamientos**: Cambios no afectan tratamientos pasados

## 🎨 Patrones de UI/UX

- **Tabla con costos en vivo**: Muestra costos calculados en tiempo real
- **Modal de insumos**: Gestión visual de receta con totales
- **Badges de categoría**: Identificación visual por tipo
- **Iconos de duración**: Clock para tiempo estimado
- **Preview de costos**: Visualización inmediata al editar receta
- **Gestión de categorías**: Modal separado para administración

## 🔒 Seguridad y Permisos

- **Aislamiento por clínica**: RLS garantiza servicios por clinic_id
- **Validación de referencias**: Insumos deben existir en la clínica
- **Auditoría de cambios**: Tracking con created_at y updated_at
- **Protección de integridad**: No eliminar si hay tratamientos asociados

## 📊 Métricas y KPIs

- **Servicios más populares**: Frecuencia de uso en tratamientos
- **Rentabilidad por servicio**: Margen promedio aplicado
- **Eficiencia temporal**: Tiempo real vs estimado
- **Costo variable promedio**: Tendencia de costos de insumos
- **Utilización de insumos**: Qué materiales se usan más
- **Servicios sin uso**: Identificar servicios obsoletos

## 🔧 Configuración

- **Categorías predefinidas**: 
  - Preventivo (limpiezas, fluorización)
  - Restaurativo (resinas, amalgamas)
  - Endodoncia (tratamientos de conducto)
  - Cirugía (extracciones)
  - Ortodoncia (brackets, ajustes)
  - Estética (blanqueamiento)
  - Otros
- **Duración por defecto**: 30 minutos configurable
- **Unidades de medida**: Minutos para tiempo
- **Actualización de costos**: Automática al cambiar insumos

## 📝 Notas Técnicas

- **Cálculo lazy**: Costos se calculan al consultar, no se almacenan
- **Cache de categorías**: Se actualizan poco frecuentemente
- **Gestión de estado**: ServiceSupplies en estado local durante edición
- **Validación**: Zod schema para formularios
- **Componentes modulares**: Separación de tabla, form y supplies manager
- **Internacionalización**: Todos los textos via next-intl

## 🚀 Posibles Mejoras

- **Protocolos clínicos**: Adjuntar documentos de procedimiento
- **Servicios compuestos**: Paquetes de múltiples servicios
- **Precios por seguro**: Diferentes tarifas según aseguradora
- **Historial de precios**: Tracking de evolución de costos
- **Imágenes de referencia**: Fotos del servicio/resultado
- **Requisitos previos**: Servicios que requieren otros primero
- **Contradicciones**: Servicios incompatibles entre sí
- **Plantillas de servicios**: Importar catálogo estándar

## 📅 Última Actualización
2025-08-25