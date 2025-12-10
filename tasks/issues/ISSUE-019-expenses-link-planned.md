---
id: ISSUE-019
title: Vincular gastos con costos planificados
status: open
priority: P2
area: feature
estimate: L (4-6 horas)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Vincular gastos con costos planificados

## Problema
Los gastos registrados no tienen correlación con:
- Costos fijos planificados (alquiler, salarios)
- Costos variables planificados (insumos)
- Depreciación de activos

Esto dificulta:
- Comparar planificado vs real
- Detectar desviaciones de presupuesto
- Análisis de rentabilidad real

## Solución

### 1. Migración SQL

```sql
-- supabase/migrations/XXXX_add_expense_links.sql

-- Tipo de correlación
CREATE TYPE expense_link_type AS ENUM (
  'fixed_cost',    -- Alquiler, salarios
  'variable_cost', -- Insumos
  'asset',         -- Depreciación
  'campaign',      -- Marketing
  'none'           -- Sin correlación
);

-- Agregar columnas de vínculo
ALTER TABLE expenses ADD COLUMN link_type expense_link_type DEFAULT 'none';
ALTER TABLE expenses ADD COLUMN fixed_cost_id uuid REFERENCES fixed_costs(id);
ALTER TABLE expenses ADD COLUMN supply_id uuid REFERENCES supplies(id);
ALTER TABLE expenses ADD COLUMN asset_id uuid REFERENCES assets(id);
-- campaign_id ya existe

-- Constraint: solo un FK puede estar poblado
ALTER TABLE expenses ADD CONSTRAINT valid_expense_link CHECK (
  CASE link_type
    WHEN 'fixed_cost' THEN fixed_cost_id IS NOT NULL
    WHEN 'variable_cost' THEN supply_id IS NOT NULL
    WHEN 'asset' THEN asset_id IS NOT NULL
    WHEN 'campaign' THEN campaign_id IS NOT NULL
    WHEN 'none' THEN TRUE
  END
);
```

### 2. Flujo UX en ExpenseForm

```
┌─────────────────────────────────────────┐
│ Nuevo Gasto                             │
├─────────────────────────────────────────┤
│ Monto: $______                          │
│ Descripción: ____________               │
│                                         │
│ ¿Corresponde a costo planificado?       │
│ ○ No (gasto nuevo sin correlación)      │
│ ○ Costo fijo → [Dropdown: Alquiler, ...]│
│ ○ Insumo → [Dropdown: Amalgama, ...]    │
│ ○ Depreciación → [Dropdown: Sillón, ...]│
│ ○ Campaña marketing → [Dropdown: ...]   │
└─────────────────────────────────────────┘
```

### 3. Componente de Selector

```typescript
// components/ExpenseLinkSelector.tsx
interface ExpenseLinkSelectorProps {
  value: ExpenseLink
  onChange: (value: ExpenseLink) => void
}

interface ExpenseLink {
  type: 'none' | 'fixed_cost' | 'variable_cost' | 'asset' | 'campaign'
  id?: string
}

export function ExpenseLinkSelector({ value, onChange }) {
  const { fixedCosts } = useFixedCosts()
  const { supplies } = useSupplies()
  const { assets } = useAssets()
  const { campaigns } = useCampaigns()

  return (
    <RadioGroup value={value.type} onValueChange={...}>
      <RadioGroupItem value="none">
        Sin correlación (gasto nuevo)
      </RadioGroupItem>

      <RadioGroupItem value="fixed_cost">
        Costo fijo
        {value.type === 'fixed_cost' && (
          <Select
            options={fixedCosts.map(fc => ({
              value: fc.id,
              label: `${fc.description} (${formatCurrency(fc.amount_cents)}/mes)`
            }))}
            ...
          />
        )}
      </RadioGroupItem>

      {/* Similares para supply, asset, campaign */}
    </RadioGroup>
  )
}
```

### 4. Análisis de Desviación

Nueva sección en Dashboard o en Gastos:

```typescript
// Comparar planificado vs real
const deviation = {
  fixedCosts: {
    planned: 50000,  // settings
    actual: 48500,   // expenses con link_type='fixed_cost'
    variance: -1500, // Ahorraste
  },
  variableCosts: {
    planned: 20000,
    actual: 22300,
    variance: 2300,  // Gastaste de más
  },
  // ...
}
```

## Acceptance Criteria
- [ ] Migración SQL con columnas de vínculo
- [ ] ExpenseForm muestra selector de correlación
- [ ] Selector filtra opciones por tipo
- [ ] Gastos vinculados muestran el item planificado
- [ ] Dashboard muestra desviación planificado vs real
- [ ] RLS policies actualizadas
- [ ] Traducciones EN y ES
- [ ] `npm run typecheck` pasa

## Testing
1. Crear gasto sin correlación → funciona
2. Crear gasto vinculado a costo fijo "Alquiler" → funciona
3. Ver lista de gastos → muestra badge de vinculación
4. Ver análisis → muestra desviación

## Archivos a Crear
1. `supabase/migrations/XXXX_add_expense_links.sql`
2. `web/app/expenses/components/ExpenseLinkSelector.tsx`
3. `web/components/dashboard/BudgetVarianceCard.tsx`

## Archivos a Modificar
1. `web/app/expenses/page.tsx` (o modal)
2. `web/lib/types/expense.ts`
3. `web/app/api/expenses/route.ts`
4. Traducciones

## Dependencias
- ISSUE-017 (refactor base de expenses)
