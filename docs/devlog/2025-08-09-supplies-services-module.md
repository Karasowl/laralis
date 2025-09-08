# 2025-08-09 - Módulo de Insumos y Servicios

**PR**: N/A (desarrollo inicial)
**TASK IDs**: TASK-20250809-supplies-module

## Contexto

El sistema necesitaba un módulo completo para gestionar insumos y servicios dentales, con cálculo de costos variables basados en recetas (servicios compuestos de múltiples insumos) y preview de precios con márgenes configurables.

## Problema

No existía una forma de:
1. Gestionar insumos con precio por presentación y porciones
2. Definir servicios como recetas de insumos
3. Calcular costos variables automáticamente
4. Previsualizar precios base con márgenes

## Causa raíz

El sistema estaba en fase inicial y necesitaba estas funcionalidades fundamentales para el cálculo de tarifas dentales.

## Qué cambió

### Base de datos
- Creadas tablas `supplies`, `services` y `service_supplies` con multi-tenant support
- Índices para optimización de consultas por `clinic_id`

### APIs
- `/api/supplies` - CRUD completo de insumos
- `/api/services` - CRUD completo de servicios  
- `/api/services/[id]/supplies` - Gestión línea por línea de recetas
- `/api/services/[id]/supplies/[rowId]` - Actualización/eliminación de líneas individuales

### Cálculos
- `lib/calc/variable.ts` - Funciones para cálculo de costos:
  - `costPerPortion()` - Costo por porción de un insumo
  - `variableCostForService()` - Costo variable total de un servicio
  - `calculateTreatmentCost()` - Costo base con fijos + variables

### UI
- `/supplies` - Página completa de gestión de insumos con:
  - Métricas (total, valor, precio promedio por porción)
  - Preview en vivo de precio por porción
  - Conversión automática de price_pesos a price_cents
  
- `/services` - Página de servicios con:
  - Panel lateral para gestión de recetas
  - Cálculo en tiempo real de costos
  - Preview de precio sugerido con margen configurable

### i18n
- Agregados todos los strings necesarios en EN y ES
- Soporte completo para ambos idiomas

## Archivos tocados

```
- supabase/migrations/03_supplies_services.sql (nuevo)
- supabase/seed.sql (actualizado)
- web/lib/types.ts (actualizado)
- web/lib/zod.ts (actualizado)  
- web/lib/calc/variable.ts (nuevo)
- web/app/api/supplies/route.ts (nuevo)
- web/app/api/supplies/[id]/route.ts (nuevo)
- web/app/api/services/route.ts (nuevo)
- web/app/api/services/[id]/route.ts (nuevo)
- web/app/api/services/[id]/supplies/route.ts (nuevo)
- web/app/api/services/[id]/supplies/[rowId]/route.ts (nuevo)
- web/app/supplies/page.tsx (nuevo)
- web/app/services/page.tsx (nuevo)
- web/app/layout.tsx (actualizado - navegación)
- web/messages/en.json (actualizado)
- web/messages/es.json (actualizado)
```

## Antes vs Después

### Antes
- Sin gestión de insumos o servicios
- Sin cálculo de costos variables
- Sin preview de precios

### Después
- CRUD completo de insumos con precio/porción
- Servicios con recetas configurables
- Cálculo automático de costos (fijos + variables)
- Preview de precios con márgenes
- Multi-tenant y i18n completos

## Cómo probar

1. Navegar a `/supplies`:
   - Crear insumos con precio y porciones
   - Ver preview del precio por porción
   - Buscar y filtrar insumos

2. Navegar a `/services`:
   - Crear servicios con duración
   - Abrir panel de receta con ícono de calculadora
   - Agregar insumos y cantidades
   - Ver cálculo automático de costos
   - Ajustar margen y ver precio sugerido

3. Verificar multi-tenant:
   - Cambiar de clínica con el switcher
   - Confirmar que solo se ven datos de la clínica activa

4. Verificar i18n:
   - Cambiar idioma EN/ES
   - Confirmar traducciones correctas

## Riesgos y rollback

### Riesgos
- Las migraciones de DB son irreversibles sin backup
- Los cálculos de costos afectan directamente los precios

### Rollback
1. Restaurar backup de base de datos
2. Revertir cambios en el código
3. Limpiar caché del navegador

## Siguientes pasos

- [ ] TASK-20250809-tariff-calc - Implementar cálculo completo de tarifas
- [ ] TASK-20250809-reports - Dashboard de reportes financieros
- [ ] TASK-20250809-data-export - Exportación de datos a CSV/Excel

## Lecciones aprendidas

1. **Separación de concerns**: Mantener cálculos en `lib/calc` facilita testing y reutilización
2. **Cents vs Pesos**: Trabajar siempre en cents evita errores de redondeo
3. **Line-by-line APIs**: Más granulares pero más flexibles que bulk updates
4. **Live preview**: Mejora significativamente la UX al configurar precios