# Devlog: Módulo de Insumos y Servicios con Recetas

**PR**: #pending
**Task**: TASK-20250809-supplies-services
**Fecha**: 2025-08-09

## Contexto

La aplicación ya contaba con multi-tenant, costos fijos y cálculo de costo fijo por minuto. Faltaba modelar insumos dentales, construir servicios como recetas (combinaciones de insumos), calcular costos variables y generar un tarifario con márgenes de utilidad.

## Problema

No existía forma de:
1. Registrar insumos con sus costos y porciones
2. Crear servicios como recetas de múltiples insumos
3. Calcular el costo variable de un servicio
4. Generar tarifarios con precios finales incluyendo márgenes

## Causa raíz

El sistema solo manejaba costos fijos. No había modelo para costos variables ni para la construcción de servicios basados en insumos consumibles.

## Qué cambió

### 1. Esquema de Base de Datos
- Nueva tabla `supplies`: insumos con precio y porciones
- Nueva tabla `services`: servicios con duración estimada
- Nueva tabla `service_supplies`: relación M:N con cantidades (receta)
- Todas las tablas incluyen `clinic_id` para multi-tenant

### 2. Modelo de Cálculo
- Costo por porción = price_cents / portions
- Costo variable = Σ(qty * costo_por_porcion)
- Costo total = costo_fijo_por_minuto * est_minutes + costo_variable
- Precio final con margen usando `lib/calc/tarifa.ts`

### 3. APIs REST
- CRUD completo para supplies con filtros por categoría
- CRUD completo para services con gestión de recetas
- GET /api/services/[id]/cost calcula costos en tiempo real

### 4. Interfaces de Usuario
- **Página de Insumos**: CRUD con cálculo de costo por porción visible
- **Página de Servicios**: Constructor de recetas drag-and-drop style
- **Página de Tarifario**: Simulador de precios con márgenes ajustables

### 5. Datos de Ejemplo
- 8 insumos típicos (resinas, anestésicos, desechables)
- 5 servicios comunes (limpieza, resinas, extracción, endodoncia)
- Receta ejemplo: Resina Simple con 6 insumos

## Archivos tocados

```
CREATED (15 archivos):
- supabase/migrations/03_supplies_services.sql
- web/app/api/supplies/route.ts
- web/app/api/supplies/[id]/route.ts
- web/app/api/services/route.ts
- web/app/api/services/[id]/route.ts
- web/app/api/services/[id]/cost/route.ts
- web/app/(setup)/supplies/page.tsx
- web/app/(setup)/services/page.tsx
- web/app/tariffs/page.tsx

MODIFIED (5 archivos):
- web/lib/types.ts (Supply, Service, ServiceSupply, ServiceWithCost)
- web/lib/zod.ts (zSupply, zService, zServiceSupply)
- web/messages/en.json (supplies, services, tariffs keys)
- web/messages/es.json (supplies, services, tariffs keys)
- supabase/seed.sql (datos de ejemplo)
```

## Antes vs Después

### Antes
- Solo costos fijos globales
- Sin detalle de materiales consumidos
- Precios manuales sin base de cálculo

### Después
- Registro detallado de insumos con porciones
- Servicios construidos como recetas reproducibles
- Cálculo automático: costo fijo + variable + margen
- Tarifario dinámico con redondeo configurable

## Cómo probar

1. **Ejecutar migraciones en Supabase**:
   ```sql
   -- Ejecutar contenido de supabase/migrations/03_supplies_services.sql
   -- Ejecutar contenido actualizado de supabase/seed.sql
   ```

2. **Probar CRUD de Insumos**:
   - Navegar a Configuración > Insumos
   - Crear un insumo con precio $450 y 20 porciones
   - Verificar que muestra costo por porción: $22.50

3. **Probar Constructor de Servicios**:
   - Navegar a Configuración > Servicios
   - Crear servicio "Limpieza" de 30 minutos
   - Agregar 2 guantes ($0.30) y 1 eyector ($0.05)
   - Ver costo variable calculado: $0.35

4. **Probar Tarifario**:
   - Navegar a Tarifario
   - Ver servicios con costos fijo, variable y total
   - Ajustar margen a 40% en un servicio
   - Cambiar redondeo a $50 y ver actualización

5. **Verificar Multi-tenant**:
   - Cambiar de clínica con BusinessSwitcher
   - Confirmar que insumos y servicios son diferentes

## Riesgos y rollback

### Riesgos
- Las recetas con muchos insumos pueden ser lentas
- El cálculo de costos depende de tener settings_time configurado

### Rollback
Si necesitas revertir:
```sql
DROP TABLE IF EXISTS service_supplies CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS supplies CASCADE;
```

## Siguientes pasos

- **TASK-20250810-treatment-tracking**: Registro de tratamientos realizados con precios finales
- **TASK-20250810-inventory-management**: Control de inventario y alertas de stock bajo
- **TASK-20250810-tariff-versions**: Versionado de tarifarios para historial de precios
- **TASK-20250810-bulk-import**: Importación masiva de insumos desde Excel/CSV

## Notas técnicas

### Decisiones de diseño
- `portions` como entero (no decimal) para evitar fracciones complejas
- `qty` en service_supplies como numeric para permitir 0.5, 1.5, etc.
- Costo variable calculado on-demand, no persistido
- CASCADE DELETE en service_supplies para limpieza automática

### Performance
- Índices en clinic_id para todas las tablas
- Join optimizado en /api/services/[id]/cost
- Paginación en listados de supplies y services

### Fórmulas clave
```javascript
// Costo por porción
costPerPortion = supply.price_cents / supply.portions

// Costo variable del servicio
variableCost = Σ(serviceSupply.qty * costPerPortion)

// Costo total
totalCost = (fixedCostPerMinute * service.est_minutes) + variableCost

// Precio final con margen
finalPrice = totalCost / (1 - margin/100)
```