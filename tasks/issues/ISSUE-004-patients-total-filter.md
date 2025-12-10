---
id: ISSUE-004
title: Pacientes activos no respeta filtro de fecha
status: open
priority: P0
area: data
estimate: S (30 min)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Pacientes activos no respeta filtro de fecha

## Problema
La métrica "Pacientes activos" en el dashboard siempre muestra el TOTAL histórico de pacientes. No cambia cuando se selecciona "Hoy", "Esta semana" o "Este mes".

## Causa Raíz
En `/api/dashboard/patients`, el query de `total` NO filtra por fecha:

```typescript
// Líneas 36-40 - SIN FILTRO
const { count: total } = await supabaseAdmin
  .from('patients')
  .select('id', { count: 'exact', head: true })
  .eq('clinic_id', clinicId)
  // ❌ Falta filtro de fecha
```

Pero `new` SÍ filtra:
```typescript
// Líneas 42-47 - CON FILTRO
const { count: newly } = await supabaseAdmin
  .from('patients')
  .select('id', { count: 'exact', head: true })
  .eq('clinic_id', clinicId)
  .gte('created_at', start.toISOString())  // ✅
  .lte('created_at', end.toISOString())    // ✅
```

## Solución Propuesta

### Opción A: Filtrar `total` por fecha (cambio de significado)
```typescript
const { count: total } = await supabaseAdmin
  .from('patients')
  .select('id', { count: 'exact', head: true })
  .eq('clinic_id', clinicId)
  .gte('created_at', start.toISOString())
  .lte('created_at', end.toISOString())
```
**Problema**: Cambia el significado de "activos" a "creados en el periodo"

### Opción B: Renombrar y agregar métricas (recomendado)
Mostrar DOS métricas:
1. **"Pacientes atendidos"** = Pacientes con tratamiento en el periodo
2. **"Pacientes activos"** = Total con tratamiento en últimos 90 días (fijo)

```typescript
// Pacientes ATENDIDOS en el periodo
const { data: treatedPatients } = await supabaseAdmin
  .from('treatments')
  .select('patient_id', { count: 'exact' })
  .eq('clinic_id', clinicId)
  .gte('treatment_date', start.toISOString())
  .lte('treatment_date', end.toISOString())

const attendedCount = new Set(treatedPatients.map(t => t.patient_id)).size

// Pacientes ACTIVOS (últimos 90 días - siempre fijo)
const ninetyDaysAgo = new Date()
ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

const { data: activePatients } = await supabaseAdmin
  .from('treatments')
  .select('patient_id')
  .eq('clinic_id', clinicId)
  .gte('treatment_date', ninetyDaysAgo.toISOString())

const activeCount = new Set(activePatients.map(t => t.patient_id)).size
```

## Acceptance Criteria
- [ ] Dashboard muestra pacientes ATENDIDOS en el periodo seleccionado
- [ ] Métrica cambia al cambiar filtro de fecha
- [ ] Opcionalmente: mantener "activos (90 días)" como referencia
- [ ] `npm run typecheck` pasa

## Archivos a Modificar
1. `web/app/api/dashboard/patients/route.ts`
2. `web/app/page.tsx` (si se agrega nueva métrica)
3. `messages/en.json`, `messages/es.json` (nuevas traducciones)

## Testing
1. Crear tratamiento hoy
2. Ver Dashboard con filtro "Hoy" → debe mostrar 1 paciente atendido
3. Cambiar a "Esta semana" → debe mostrar pacientes de la semana
