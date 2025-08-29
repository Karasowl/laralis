# Memoria del Módulo: Activos (Assets)

## 📋 Resumen
Gestión de activos fijos del consultorio dental (equipos, mobiliario, instrumental) con cálculo automático de depreciación mensual que se integra a los costos fijos del negocio.

## 🎯 Propósito Principal
Administrar todos los activos de la clínica para:
- Calcular depreciación mensual de equipos
- Integrar depreciación a costos fijos
- Mantener registro de inversiones
- Planificar renovación de equipamiento
- Análisis financiero de activos

## 🏗️ Arquitectura

### Componentes Principales
- **AssetsPage**: Página principal con tabla y métricas
- **CrudPageLayout**: Layout reutilizable con cards de resumen
- **SummaryCards**: Tarjetas con métricas clave de inversión
- **FormModal**: Modal de creación/edición de activos
- **useCrudOperations**: Hook genérico para operaciones CRUD

### Estructura de Datos
```typescript
interface Asset {
  id: string
  clinic_id: string
  name: string // "Sillón dental", "Compresor", etc.
  purchase_price_cents: number // Precio de compra
  depreciation_months: number // Período de depreciación
  purchase_date?: string // Fecha de compra
  
  // Calculados
  monthly_depreciation_cents: number // price / months
  accumulated_depreciation?: number // Meses transcurridos × monthly
  book_value?: number // price - accumulated
  
  created_at: string
  updated_at: string
}
```

### Hooks Personalizados
- **useCrudOperations**: Hook genérico para CRUD con estado y validaciones

## 🔄 Flujo de Trabajo

### Registro de Activo
1. Usuario ingresa nombre del equipo
2. Especifica precio de compra
3. Define período de depreciación (meses)
4. Opcionalmente fecha de compra
5. Sistema calcula depreciación mensual automáticamente
6. Se suma a costos fijos del negocio

### Cálculo de Depreciación
```typescript
// Fórmula lineal
depreciación_mensual = precio_compra / meses_depreciación

// Ejemplo: Sillón dental
precio: $50,000 (5,000,000 centavos)
período: 60 meses (5 años)
depreciación_mensual = 5,000,000 / 60 = 83,333 centavos ($833.33/mes)
```

### Integración con Costos Fijos
1. Total de depreciación mensual de todos los activos
2. Se suma automáticamente a costos fijos
3. Afecta cálculo de costo por minuto
4. Impacta en tarifas de servicios

## 🔗 Relaciones con Otros Módulos

- **Costos Fijos**: Depreciación se suma a costos mensuales
- **Configuración de Tiempo**: Afecta costo por minuto
- **Tarifas**: Influye en cálculo de precios
- **Gastos**: Compra de activos puede registrarse como gasto
- **Reportes**: Análisis de inversión y depreciación
- **Dashboard**: Métricas de inversión total

## 💼 Reglas de Negocio

1. **Depreciación lineal**: Método único de cálculo
2. **Período mínimo**: Al menos 1 mes de depreciación
3. **Precio positivo**: No se permiten valores negativos
4. **Período por defecto**: 36 meses (3 años) sugerido
5. **Sin valor residual**: Deprecia hasta cero
6. **Multi-clínica**: Cada clínica gestiona sus activos
7. **Inmutable para cálculos**: Cambios no afectan históricos

## 🎨 Patrones de UI/UX

- **SummaryCards superiores**: Métricas de inversión siempre visibles
- **Tabla con depreciación**: Muestra cálculo mensual por activo
- **Card explicativa**: Fórmula y ejemplo de cálculo
- **Colores semánticos**: Verde para depreciación, azul para inversión
- **Iconos contextuales**: Package, TrendingDown, Calendar, DollarSign
- **Valores por defecto**: 36 meses prellenado

## 🔒 Seguridad y Permisos

- **Aislamiento por clínica**: RLS garantiza activos por clinic_id
- **Validación con Zod**: Schema para formularios
- **Auditoría**: created_at y updated_at automáticos
- **Protección de datos**: No exposición de datos financieros sensibles

## 📊 Métricas y KPIs

- **Inversión total**: Suma de todos los activos
- **Depreciación mensual total**: Impacto en costos fijos
- **Depreciación anual**: Proyección anual de depreciación
- **Período promedio**: Vida útil promedio de activos
- **Valor en libros**: Valor actual de activos
- **ROI de equipos**: Retorno sobre inversión en equipamiento
- **Activos por vencer**: Próximos a depreciarse completamente

## 🔧 Configuración

- **Período por defecto**: 36 meses configurable
- **Método de depreciación**: Lineal (único disponible)
- **Fecha opcional**: Purchase_date no obligatorio
- **Moneda**: Siempre en centavos internamente

## 📝 Notas Técnicas

- **Cálculo en frontend**: Summary statistics con useMemo
- **Estado del formulario**: React Hook Form con Zod
- **CrudPageLayout**: Componente genérico con slots
- **Formateo de moneda**: formatCurrency helper
- **Sin búsqueda**: Lista completa sin paginación (volumen bajo)
- **Internacionalización**: Todos los textos via next-intl

## 🚀 Posibles Mejoras

- **Depreciación acelerada**: Métodos alternativos de cálculo
- **Valor residual**: Configurar valor final no cero
- **Categorías de activos**: Agrupar por tipo
- **Mantenimientos**: Registro de mantenimientos y reparaciones
- **Seguros**: Tracking de pólizas de seguro
- **Fotos**: Imágenes de los equipos
- **Códigos de activo**: Etiquetado físico con QR
- **Alertas de renovación**: Notificar cuando acerca fin de vida útil
- **Historial de valuación**: Tracking de valor en el tiempo

## 📅 Última Actualización
2025-08-25