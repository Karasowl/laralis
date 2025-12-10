---
id: ISSUE-020
title: Implementar cron para gastos recurrentes
status: open
priority: P2
area: infra
estimate: M (3 horas)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Implementar cron para gastos recurrentes

## Problema
El checkbox "Repetir en cada período" en el form de gastos NO funciona. El campo `is_recurring` se guarda pero NO hay job que cree los gastos automáticamente.

## Solución

### Opción A: Edge Function de Supabase (Recomendado)

```typescript
// supabase/functions/recurring-expenses/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Obtener gastos recurrentes del mes pasado que deben repetirse
  const today = new Date()
  const currentMonth = today.toISOString().slice(0, 7) // YYYY-MM

  const { data: recurring } = await supabase
    .from('expenses')
    .select('*')
    .eq('is_recurring', true)
    .not('last_recurrence_date', 'gte', currentMonth)

  // Crear nuevas instancias
  for (const expense of recurring) {
    await supabase.from('expenses').insert({
      clinic_id: expense.clinic_id,
      description: expense.description,
      amount_cents: expense.amount_cents,
      category: expense.category,
      is_recurring: true,
      original_expense_id: expense.id, // FK al original
      expense_date: today.toISOString(),
    })

    // Actualizar fecha de última recurrencia
    await supabase
      .from('expenses')
      .update({ last_recurrence_date: currentMonth })
      .eq('id', expense.id)
  }

  return new Response(
    JSON.stringify({ processed: recurring.length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

### Configurar Cron en Supabase Dashboard
1. Ir a Database → Extensions → pg_cron
2. Crear job:
```sql
SELECT cron.schedule(
  'recurring-expenses',
  '0 0 1 * *', -- Día 1 de cada mes a medianoche
  $$SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/recurring-expenses',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  )$$
);
```

### Opción B: Vercel Cron (Alternativa)

```typescript
// web/app/api/cron/recurring-expenses/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  // Verificar cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... misma lógica que arriba
}
```

En `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/recurring-expenses",
    "schedule": "0 0 1 * *"
  }]
}
```

## Migración SQL (Campos Adicionales)

```sql
ALTER TABLE expenses ADD COLUMN last_recurrence_date varchar(7); -- YYYY-MM
ALTER TABLE expenses ADD COLUMN original_expense_id uuid REFERENCES expenses(id);
ALTER TABLE expenses ADD COLUMN recurrence_period varchar(20) DEFAULT 'monthly';
-- recurrence_period: 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
```

## UI: Selector de Período

```typescript
// En ExpenseForm
{isRecurring && (
  <SelectField
    name="recurrence_period"
    label={t('recurrence_period')}
    options={[
      { value: 'weekly', label: t('weekly') },
      { value: 'monthly', label: t('monthly') },
      { value: 'quarterly', label: t('quarterly') },
      { value: 'yearly', label: t('yearly') },
    ]}
  />
)}
```

## Acceptance Criteria
- [ ] Edge Function o Vercel Cron implementado
- [ ] Gastos recurrentes se crean automáticamente
- [ ] Campo `last_recurrence_date` previene duplicados
- [ ] UI muestra período de recurrencia
- [ ] Log de ejecución visible (para debugging)
- [ ] Tests para lógica de recurrencia

## Testing
1. Crear gasto recurrente mensual
2. Ejecutar cron manualmente (o esperar)
3. Verificar que se creó nuevo gasto
4. Verificar que `last_recurrence_date` se actualizó
5. Ejecutar cron de nuevo → NO duplica

## Archivos a Crear
1. `supabase/functions/recurring-expenses/index.ts` (Opción A)
2. O `web/app/api/cron/recurring-expenses/route.ts` (Opción B)
3. `supabase/migrations/XXXX_add_recurrence_fields.sql`

## Archivos a Modificar
1. `web/app/expenses/page.tsx` (UI de período)
2. `vercel.json` (si Opción B)

## Dependencias
- ISSUE-017 (refactor expenses)
