# Memoria del Módulo: Insumos (Supplies)

## 📋 Resumen
Gestión del inventario de materiales dentales, con control de presentaciones, porciones y cálculo automático de costo por unidad de uso. Base fundamental para el cálculo de costos variables en servicios.

## 🎯 Propósito Principal
Administrar todos los insumos dentales del consultorio, estableciendo:
- Control de inventario y stock
- Cálculo preciso de costo por porción
- Categorización para organización
- Base para costos variables de servicios
- Tracking de compras y consumo

## 🏗️ Arquitectura

### Componentes Principales
- **SuppliesPage**: Página principal con CRUD simplificado
- **SimpleCrudPage**: Layout reutilizable para operaciones CRUD
- **FormModal**: Modal de creación/edición con preview en vivo
- **useCrudOperations**: Hook genérico para operaciones CRUD

### Estructura de Datos
```typescript
interface Supply {
  id: string
  clinic_id: string
  name: string
  category: SupplyCategory
  presentation: string // "Caja 50 unidades", "Frasco 100ml"
  price_cents: number // Precio de la presentación completa
  portions: number // Porciones por presentación
  cost_per_portion_cents: number // Calculado: price_cents / portions
  
  // Control de inventario (campos futuros)
  stock_quantity?: number
  min_stock_alert?: number
  last_purchase_price_cents?: number
  last_purchase_date?: string
  
  created_at: string
  updated_at: string
}

type SupplyCategory = 
  | 'insumo'        // Material dental directo
  | 'bioseguridad'  // Guantes, cubrebocas, etc.
  | 'consumibles'   // Gasas, algodón, etc.
  | 'materiales'    // Resinas, amalgamas, etc.
  | 'medicamentos'  // Anestésicos, antibióticos
  | 'equipos'       // Pequeño instrumental
  | 'otros'         // Otros materiales
```

### Hooks Personalizados
- **useCrudOperations**: Hook genérico reutilizable para CRUD con búsqueda y paginación

## 🔄 Flujo de Trabajo

### Registro de Insumo
1. Usuario especifica nombre y categoría
2. Define presentación (ej: "Caja 50 guantes")
3. Ingresa precio de la presentación completa
4. Especifica número de porciones útiles
5. Sistema calcula automáticamente costo por porción
6. Preview en vivo muestra el costo unitario

### Cálculo de Costo por Porción
```typescript
// Ejemplo: Caja de guantes
presentación: "Caja 50 pares"
precio: $150.00 (15000 centavos)
porciones: 50
costo_por_porción = 15000 / 50 = 300 centavos ($3.00 por par)

// Ejemplo: Anestesia
presentación: "Cartucho 1.8ml"
precio: $25.00 (2500 centavos)
porciones: 1
costo_por_porción = 2500 / 1 = 2500 centavos ($25.00 por uso)
```

### Búsqueda y Filtrado
1. Búsqueda en tiempo real por nombre
2. Filtrado implícito por categoría en la tabla
3. Ordenamiento por cualquier columna

## 🔗 Relaciones con Otros Módulos

- **Servicios**: Los servicios definen qué insumos necesitan
- **Tratamientos**: Descuentan insumos del inventario al completarse
- **Gastos**: Compras de insumos actualizan stock y precios
- **Reportes**: Análisis de consumo y costos de materiales
- **Dashboard**: Alertas de stock bajo

## 💼 Reglas de Negocio

1. **Porciones mínimas**: Al menos 1 porción por presentación
2. **Precio positivo**: No se permiten precios negativos o cero
3. **Cálculo automático**: cost_per_portion_cents se calcula, no se ingresa
4. **Categorización obligatoria**: Todo insumo debe tener categoría
5. **Presentación descriptiva**: Debe indicar cantidad/volumen
6. **Multi-clínica**: Cada clínica maneja su propio inventario
7. **Inmutabilidad en servicios**: Cambios de precio no afectan tratamientos pasados

## 🎨 Patrones de UI/UX

- **Preview en vivo**: Muestra costo por porción mientras se edita
- **Tabla con costo destacado**: Costo por porción en verde
- **Iconografía consistente**: Package para insumos
- **Modal con FormGrid**: Layout de 2 columnas para precio/porciones
- **Categorías traducidas**: Labels i18n para cada categoría
- **SimpleCrudPage**: Layout estandarizado para CRUD

## 🔒 Seguridad y Permisos

- **Aislamiento por clínica**: RLS garantiza insumos por clinic_id
- **Validación con Zod**: Schema estricto para formularios
- **Auditoría automática**: created_at y updated_at
- **Protección de integridad**: No eliminar si está en uso por servicios

## 📊 Métricas y KPIs

- **Insumos más utilizados**: Frecuencia en servicios
- **Costo promedio por categoría**: Tendencias de precios
- **Rotación de inventario**: Velocidad de consumo
- **Alertas de stock**: Insumos por debajo del mínimo
- **Variación de precios**: Cambios históricos en costos
- **Eficiencia de compra**: Comparación de precios entre proveedores

## 🔧 Configuración

- **Categorías del sistema**: Predefinidas, no editables por usuario
- **Unidades de medida**: Implícitas en presentación
- **Decimales en precios**: 2 decimales para pesos
- **Stock mínimo por defecto**: 10 unidades (configurable futuro)

## 📝 Notas Técnicas

- **Cálculo en backend**: cost_per_portion_cents calculado en API
- **Búsqueda optimizada**: Índice en campo name
- **Estado del formulario**: React Hook Form con validación Zod
- **Preview reactivo**: watch() para cálculo en tiempo real
- **SimpleCrudPage**: Componente genérico reutilizable
- **Internacionalización**: Categorías y textos via next-intl

## 🚀 Posibles Mejoras

- **Control de inventario completo**: Stock actual, entradas, salidas
- **Códigos de barras**: Escaneo para búsqueda rápida
- **Proveedores**: Asociar insumos con proveedores
- **Historial de precios**: Tracking de cambios de precio
- **Lotes y caducidad**: Control de lotes y fechas de vencimiento
- **Compras automáticas**: Órdenes cuando stock < mínimo
- **Equivalencias**: Insumos alternativos/genéricos
- **Imágenes**: Fotos de referencia del producto

## 📅 Última Actualización
2025-08-25