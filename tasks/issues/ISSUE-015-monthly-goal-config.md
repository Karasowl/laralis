---
id: ISSUE-015
title: Meta mensual configurable independiente del punto de equilibrio
status: open
priority: P1
area: feature
estimate: L (4-6 horas)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Meta mensual configurable independiente del punto de equilibrio

## Problema
Actualmente el `BreakEvenProgress` solo muestra progreso hacia el punto de equilibrio. El usuario quiere:
1. Configurar una META MENSUAL personalizada
2. Ver el punto de equilibrio como marcador intermedio
3. Ver cuánto falta para ambos hitos

## Solución

### 1. Migración SQL
```sql
-- supabase/migrations/XXXX_add_monthly_goal.sql
ALTER TABLE settings_time
ADD COLUMN monthly_goal_cents bigint DEFAULT NULL;

COMMENT ON COLUMN settings_time.monthly_goal_cents IS
  'Meta mensual de ingresos configurable por el usuario';
```

### 2. Actualizar API `/api/settings/time`

**GET**: Incluir `monthly_goal_cents` en response
**PUT**: Permitir actualizar `monthly_goal_cents`

### 3. Actualizar Hook `use-equilibrium.ts`
Ya tiene soporte para `manualMonthlyTargetCents`, solo cargar desde API.

### 4. Rediseñar `BreakEvenProgress.tsx`

Nueva barra con dos marcadores:
```
[===========|=====BE=====|=====GOAL=====]
            ↑             ↑
        Actual        Break-Even        Meta
```

Props nuevos:
```typescript
interface BreakEvenProgressProps {
  breakEvenRevenueCents: number      // NUEVO: BE puro
  monthlyGoalCents: number | null    // NUEVO: Goal configurado
  monthlyTargetCents: number         // Final (max de BE y Goal)
  currentRevenueCents: number
  // ... resto igual
}
```

### 5. UI de Configuración

Agregar en `/settings/time`:
```typescript
<Card>
  <CardHeader>
    <CardTitle>Meta de Ingresos Mensual</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <div className="bg-muted p-3 rounded-lg">
        <span className="text-sm text-muted-foreground">Punto de equilibrio actual</span>
        <span className="text-2xl font-bold">{formatCurrency(breakEven)}</span>
      </div>

      <div>
        <Label>Meta mensual</Label>
        <div className="flex gap-2">
          <Slider
            min={breakEven / 100}
            max={breakEven * 3 / 100}
            step={1000}
            value={[goalPesos]}
            onValueChange={([v]) => setGoal(v * 100)}
          />
          <Input
            type="number"
            value={goalPesos}
            onChange={e => setGoal(Number(e.target.value) * 100)}
            className="w-32"
          />
        </div>
      </div>
    </div>
  </CardContent>
</Card>
```

## Traducciones Necesarias

```json
{
  "equilibrium": {
    "monthlyGoal": "Meta Mensual",
    "monthlyGoalConfig": "Meta de Ingresos Mensual",
    "monthlyGoalDescription": "Establece un objetivo independiente del punto de equilibrio",
    "currentBreakEven": "Punto de Equilibrio Actual",
    "breakEven": "Punto de Equilibrio",
    "goal": "Meta",
    "aboveBreakEven": "Por encima del equilibrio"
  }
}
```

## Acceptance Criteria
- [ ] Campo `monthly_goal_cents` en `settings_time`
- [ ] API GET/PUT funcionan con el campo
- [ ] Slider de configuración en Settings → Time
- [ ] BreakEvenProgress muestra dos marcadores
- [ ] Colores diferentes para BE (amber) y Goal (green)
- [ ] Muestra cuánto falta para cada hito
- [ ] Traducciones EN y ES
- [ ] `npm run typecheck` pasa
- [ ] Tests para cálculos de equilibrio

## Testing
1. Configurar meta de $50,000 (BE es $40,000)
2. Ver Dashboard
3. Verificar que barra muestra BE al 80% y Goal al 100%
4. Verificar que stats muestran falta para ambos

## Archivos a Crear/Modificar
1. CREAR: `supabase/migrations/XXXX_add_monthly_goal.sql`
2. MODIFICAR: `web/app/api/settings/time/route.ts`
3. MODIFICAR: `web/hooks/use-equilibrium.ts`
4. MODIFICAR: `web/components/dashboard/BreakEvenProgress.tsx`
5. MODIFICAR: `web/app/settings/time/page.tsx` (o crear si no existe)
6. AGREGAR: Traducciones

## Dependencias
- ISSUE-001 (filtros de fecha en equilibrium)
