# Bug: Dashboard Rentabilidad no muestra datos + Revenue endpoint 500

**Fecha**: 2025-10-20
**Estado**: En investigación
**Prioridad**: P0 - Crítico

---

## Resumen del Problema

El usuario tiene **1 tratamiento completado** visible en `/treatments`, pero el **Tab "Rentabilidad" del Dashboard muestra "No hay tratamientos completados para analizar"**.

Además, el endpoint `/api/dashboard/revenue` está fallando con error 500, lo que está rompiendo la carga completa del dashboard.

---

## Síntomas Observados

### 1. Tratamiento Existente
**Ubicación**: `/treatments`

```
Fecha: 20 de octubre de 2025
Paciente: fsdfsdf dsfdsfsf
Servicio: sdfsdfsf
Duración: 30 minutos
Precio: $0.34 (34 centavos)
Estado: Completado ✅
```

**Detalles del modal de edición**:
- Fecha: 09/10/2025
- Duración: 30 minutos
- Margen: 60%
- Estado: Completado
- NO se muestran campos de costos fijos ni variables en el modal

### 2. Dashboard Tab "Rentabilidad"
Muestra estos mensajes de error:

```
- "No hay datos de rentabilidad disponibles"
- "No hay tratamientos completados para analizar"
- "No hay datos de tendencias disponibles"
- "Necesitas al menos 2 servicios con datos para comparar"
```

### 3. Error en Consola del Navegador

```
GET http://localhost:3000/api/dashboard/revenue?clinicId=4d65a236-a192-4c8e-b4d7-a76549e9a18e&period=month
500 (Internal Server Error)
```

**IMPORTANTE**: El tab "Rentabilidad" NO genera ninguna llamada a la API cuando se selecciona. Es como si el hook `useServiceROI` no se estuviera ejecutando.

---

## Cambios Realizados Durante la Investigación

### 1. Corregido `page.tsx` - Conexión de datos ROI

**Archivo**: `web/app/page.tsx`
**Líneas**: 434, 443-463, 468

**ANTES**:
```typescript
<ProfitabilitySummary services={roiData} loading={roiLoading} />

data={roiData && roiData.length > 0 ? (() => {
  roiData.slice(0, 5).forEach(service => {
```

**DESPUÉS**:
```typescript
<ProfitabilitySummary services={roiData?.services || []} loading={roiLoading} />

data={roiData?.services && roiData.services.length > 0 ? (() => {
  roiData.services.slice(0, 5).forEach(service => {
```

**Razón**: El API devuelve `ROIAnalysis { services: ServiceROI[] }`, no un array directo.

### 2. Agregado Logging a `service-roi/route.ts`

**Archivo**: `web/app/api/analytics/service-roi/route.ts`
**Líneas**: 110-111, 134-137

Agregados logs para debug:
```typescript
console.log('[service-roi] Fetching treatments for clinic:', clinicId)
console.log('[service-roi] Date range:', startDateStr, 'to', endDateStr)
console.log('[service-roi] Found treatments:', treatments?.length || 0)
if (treatments && treatments.length > 0) {
  console.log('[service-roi] First treatment:', JSON.stringify(treatments[0], null, 2))
}
```

### 3. Agregado Logging a `revenue/route.ts`

**Archivo**: `web/app/api/dashboard/revenue/route.ts`
**Líneas**: 126, 129, 139-147, 157-162, 167

Agregados logs para debug:
```typescript
console.log('[revenue] Fetching for clinic:', clinicId, 'period:', period)
console.log('[revenue] Date ranges - Current:', toDateParam(ranges.current.start), 'to', toDateParam(ranges.current.end))
console.log('[revenue] Found current treatments:', currentTreatments?.length || 0)
// ... más logs
```

### 4. Agregado Logging a `page.tsx`

**Archivo**: `web/app/page.tsx`
**Líneas**: 218-220

```typescript
useEffect(() => {
  console.log('[Dashboard] useServiceROI - clinicId:', currentClinic?.id, 'data:', roiData, 'loading:', roiLoading)
}, [currentClinic?.id, roiData, roiLoading])
```

---

## Hipótesis del Problema

### Hipótesis 1: Error 500 en Revenue está bloqueando todo
El endpoint `/api/dashboard/revenue` está fallando, lo que puede estar bloqueando la carga del dashboard y evitando que otros hooks se ejecuten.

**Pendiente**: Ver logs del servidor en la terminal de `npm run dev` para identificar el error exacto.

### Hipótesis 2: useServiceROI no se ejecuta
El hook tiene `enabled: !!clinicId` en `use-api.ts:20-22`, lo que podría estar bloqueando la ejecución si `clinicId` no está disponible inmediatamente.

**Pendiente**: Verificar con los logs `[Dashboard] useServiceROI` si el hook se está ejecutando.

### Hipótesis 3: Tratamiento sin costos calculados
El modal de edición NO muestra los campos `fixed_cost_per_minute_cents` ni `variable_cost_cents`. Estos valores podrían estar en `null` o `0` en la base de datos.

**Campos requeridos para cálculo de rentabilidad**:
- ✅ `price_cents`: 34 (confirmado)
- ✅ `minutes`: 30 (confirmado)
- ❓ `fixed_cost_per_minute_cents`: ? (no visible en UI)
- ❓ `variable_cost_cents`: ? (no visible en UI)
- ❓ `treatment_date`: Puede ser 09/10/2025 o 20/10/2025 (inconsistencia)

### Hipótesis 4: Problema de fechas
El tratamiento muestra dos fechas diferentes:
- En lista: "20 de octubre de 2025"
- En modal: "09/10/2025"

El endpoint de ROI busca en los últimos 30 días. Si la fecha está mal formateada o fuera del rango, no encontrará el tratamiento.

---

## Próximos Pasos para Debugging

### 1. Obtener logs del servidor (CRÍTICO)
Necesitamos ver qué error exacto está lanzando `/api/dashboard/revenue` en la terminal del servidor:

```bash
# Buscar en la terminal donde corre npm run dev:
[revenue] Fetching for clinic: ...
[revenue] Date ranges - Current: ...
[revenue] Error fetching current treatments: ...
```

### 2. Obtener logs del navegador (CRÍTICO)
Después de recargar el dashboard, copiar TODOS los logs de la consola, especialmente:

```
[Dashboard] useServiceROI - clinicId: ... data: ... loading: ...
```

### 3. Verificar datos del tratamiento en Supabase
Ejecutar query directo en Supabase para ver los valores reales:

```sql
SELECT
  id,
  treatment_date,
  status,
  price_cents,
  fixed_cost_per_minute_cents,
  variable_cost_cents,
  minutes,
  service_id,
  clinic_id
FROM treatments
WHERE clinic_id = '4d65a236-a192-4c8e-b4d7-a76549e9a18e'
  AND status = 'completed'
ORDER BY treatment_date DESC
LIMIT 1;
```

### 4. Verificar rango de fechas
Confirmar cuál es la fecha actual del sistema y si el tratamiento está dentro del rango de 30 días:

```javascript
const now = new Date()
const startDate = new Date()
startDate.setDate(startDate.getDate() - 30)

console.log('Hoy:', now.toISOString().split('T')[0])
console.log('Hace 30 días:', startDate.toISOString().split('T')[0])
console.log('Fecha tratamiento:', '2025-10-09' o '2025-10-20')
```

---

## Contexto Adicional: Implementación Completa del Dashboard

### Fase 4 - Tab Marketing COMPLETADA ✅
- ✅ 4 componentes nuevos creados (~800 líneas)
- ✅ Integrados en `page.tsx` con datos MOCK
- ✅ 62 traducciones agregadas (ES + EN)

**PENDIENTE**: Conectar Marketing con datos reales (después de arreglar este bug)

### Resumen Total del Dashboard Redesign
- **Fases completadas**: 4/4 (100%)
- **Componentes nuevos**: 12 (~2,100 líneas)
- **Traducciones agregadas**: ~162 claves (ES + EN)
- **Gráficas totales**: 12 (5 existentes + 7 nuevas)

---

## Archivos Modificados en Esta Sesión

1. `web/app/page.tsx` - Fix conexión roiData.services + logs
2. `web/app/api/analytics/service-roi/route.ts` - Logs de debug
3. `web/app/api/dashboard/revenue/route.ts` - Logs de debug
4. `web/components/dashboard/marketing/MarketingMetrics.tsx` - NUEVO
5. `web/components/dashboard/marketing/AcquisitionTrendsChart.tsx` - NUEVO
6. `web/components/dashboard/marketing/ChannelROIChart.tsx` - NUEVO
7. `web/components/dashboard/marketing/CACTrendChart.tsx` - NUEVO
8. `web/messages/es.json` - Sección `dashboard.marketing`
9. `web/messages/en.json` - Sección `dashboard.marketing`

---

## Cómo Retomar Este Problema

### Opción 1: Referencia directa
Copia y pega esto al iniciar la conversación:

```
Retomando bug documentado en:
docs/troubleshooting/2025-10-20-dashboard-rentabilidad-bug.md

Resumen: Dashboard Rentabilidad no muestra tratamiento completado + error 500 en revenue endpoint.

Necesito que leas ese archivo y continuemos desde "Próximos Pasos para Debugging".
```

### Opción 2: Referencia corta
```
Bug dashboard rentabilidad - ver docs/troubleshooting/2025-10-20-dashboard-rentabilidad-bug.md
```

### Opción 3: Contexto completo
```
Estábamos investigando por qué el Tab "Rentabilidad" del dashboard no muestra datos
a pesar de tener 1 tratamiento completado. El problema incluye:
- Error 500 en /api/dashboard/revenue
- useServiceROI no ejecutándose
- Posible problema con campos de costos en tratamiento

Lee docs/troubleshooting/2025-10-20-dashboard-rentabilidad-bug.md para contexto completo.
```

---

## Estado Final del Dashboard

### ✅ COMPLETADO
- Tab "Resumen" - Reorganizado con gráficas prominentes
- Tab "Rentabilidad" - 3 componentes + integración (CON BUG)
- Tab "Avanzado" - 2 componentes nuevos
- Tab "Marketing" - 4 componentes nuevos (CON DATOS MOCK)

### ⏳ PENDIENTE
1. **P0**: Arreglar error 500 en `/api/dashboard/revenue`
2. **P0**: Conectar Tab "Rentabilidad" con datos reales
3. **P1**: Conectar Tab "Marketing" con datos reales (eliminar mocks)
4. **P2**: Crear API `/api/analytics/profit-trends` para ProfitTrendsChart
5. **P2**: Crear API `/api/analytics/marketing-cac` para CACTrendChart
6. **P2**: Crear API `/api/analytics/channel-roi` para ChannelROIChart

---

**Última actualización**: 2025-10-20 - Sesión interrumpida para apagar laptop
