---
id: ISSUE-008
title: Lara dice "22 días" cuando la configuración tiene 20 días
status: open
priority: P0
area: ai
estimate: XS (10 min)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Lara dice "22 días" cuando la configuración tiene 20 días

## Problema
Lara (AI assistant) menciona "22 días laborales" en sus respuestas cuando la clínica tiene configurados 20 días de trabajo en `settings_time`.

## Causa Raíz
El prompt usa un campo que NO EXISTE: `work_days_per_month`. El fallback es 22.

**Ubicación**: `web/lib/ai/ClinicSnapshotService.ts` línea 216

```typescript
// INCORRECTO
${clinic.time_settings?.work_days_per_month || 22} days/month
//                       ^^^^^^^^^^^^^^^^^ NO EXISTE
```

**Campo correcto**: `work_days` (cargado en línea 258)
```typescript
const workDays = timeSettings?.work_days || 20
```

## Solución

### Fix 1: ClinicSnapshotService.ts línea 216
```typescript
// ANTES
${clinic.time_settings?.work_days_per_month || 22} days/month

// DESPUÉS
${clinic.time_settings?.work_days || 20} days/month
```

### Fix 2: También en línea 223 (cálculo de minutos)
```typescript
// ANTES
Total minutes = ${clinic.time_settings?.work_days_per_month || 22} days * ...

// DESPUÉS
Total minutes = ${clinic.time_settings?.work_days || 20} days * ...
```

### Fix 3: query-prompt.ts (si aplica)
Buscar y reemplazar cualquier uso de `work_days_per_month`.

## Acceptance Criteria
- [ ] Lara menciona el número correcto de días de trabajo
- [ ] El cálculo de minutos disponibles es correcto
- [ ] Lara menciona el porcentaje de productividad configurado
- [ ] No hay referencias a `work_days_per_month` en el código

## Testing
1. Configurar 20 días de trabajo en Settings → Time
2. Abrir Lara en modo Query
3. Preguntar "¿Cuántos días trabajo al mes?"
4. Verificar que responde "20 días" (no 22)

## Archivos a Modificar
1. `web/lib/ai/ClinicSnapshotService.ts` (líneas 216, 223)
2. `web/lib/ai/prompts/query-prompt.ts` (verificar)

## Comando de Búsqueda
```bash
grep -r "work_days_per_month" web/lib/ai/
```
