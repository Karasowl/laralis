---
id: ISSUE-017
title: Refactorizar expenses/page.tsx (1,233 líneas)
status: open
priority: P1
area: refactor
estimate: L (3-4 horas)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Refactorizar expenses/page.tsx (1,233 líneas)

## Problema
El archivo `web/app/expenses/page.tsx` tiene 1,233 líneas, violando el límite de 400 líneas establecido en CODING-STANDARDS.md.

## Componentes Internos a Extraer

| Componente | Líneas Actuales | Nuevo Archivo |
|------------|-----------------|---------------|
| `ExpenseForm` | 836-1107 (272 líneas) | `ExpenseFormModal.tsx` |
| `FiltersCard` | 1110-1227 (117 líneas) | `ExpensesFilterBar.tsx` |
| `getDefaultFormValues` | 776-798 | Mover a `ExpenseFormModal.tsx` |
| `mapExpenseToFormValues` | 800-825 | Mover a `ExpenseFormModal.tsx` |
| `severityBadgeClass` | 1229-1233 | Mover a tipos o utils |

## Estructura Propuesta

```
app/expenses/
├── page.tsx (~200 líneas)
└── components/
    ├── ExpenseFormModal.tsx (~250 líneas)
    ├── ExpensesFilterBar.tsx (~150 líneas)
    ├── ExpensesSummary.tsx (~80 líneas)
    ├── ExpensesTable.tsx (~100 líneas)
    └── ExpenseAlerts.tsx (~150 líneas)
```

## Plan de Extracción

### Paso 1: Crear ExpenseFormModal.tsx
```typescript
// components/ExpenseFormModal.tsx
import { FormModal } from '@/components/ui/form-modal'

interface ExpenseFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: ExpenseWithRelations | null  // null = create, object = edit
  onSubmit: (values: ExpenseFormData) => Promise<boolean>
  isSubmitting: boolean
  categoryOptions: Option[]
  supplyOptions: Option[]
  campaignOptions: Option[]
}

export function ExpenseFormModal({...}: ExpenseFormModalProps) {
  // Mover lógica de form aquí
  // Incluir getDefaultFormValues y mapExpenseToFormValues
}
```

### Paso 2: Crear ExpensesFilterBar.tsx con SmartFilters
```typescript
// components/ExpensesFilterBar.tsx
import { SmartFilters, type FilterConfig } from '@/components/ui/smart-filters'

interface ExpensesFilterBarProps {
  filters: ExpenseFilters
  onFiltersChange: (filters: ExpenseFilters) => void
  categoryOptions: Option[]
  subcategoryOptions: Option[]
}

export function ExpensesFilterBar({...}: ExpensesFilterBarProps) {
  const filterConfigs: FilterConfig[] = [
    { key: 'category', type: 'select', ... },
    { key: 'date_range', type: 'date-range', ... },
    { key: 'amount_range', type: 'number-range', ... },
    // ...
  ]

  return <SmartFilters filters={filterConfigs} ... />
}
```

### Paso 3: Crear ExpensesSummary.tsx
```typescript
// Extraer SummaryCards + stats lógica
export function ExpensesSummary({ stats, filters }) {
  // ...
}
```

### Paso 4: Crear ExpenseAlerts.tsx
```typescript
// Extraer renderAlerts() y lógica de alertas
export function ExpenseAlerts({ alerts }) {
  // ...
}
```

### Paso 5: Simplificar page.tsx
```typescript
// page.tsx final (~200 líneas)
export default function ExpensesPage() {
  const { expenses, filters, stats, alerts, ... } = useExpenses()

  return (
    <AppLayout>
      <PageHeader ... />
      <ExpensesSummary stats={stats} />
      <ExpensesFilterBar filters={filters} ... />
      <ExpensesTable expenses={expenses} ... />
      <ExpenseAlerts alerts={alerts} />
      <ExpenseFormModal ... />
    </AppLayout>
  )
}
```

## Acceptance Criteria
- [ ] `page.tsx` tiene <400 líneas
- [ ] Cada componente extraído tiene <300 líneas
- [ ] No hay cambios en funcionalidad
- [ ] Filtros usan `SmartFilters` (consistente con Pacientes)
- [ ] `npm run typecheck` pasa
- [ ] `npm test` pasa

## Testing
1. Crear gasto → funciona
2. Editar gasto → funciona
3. Eliminar gasto → funciona
4. Filtros → funcionan
5. Alertas → se muestran correctamente

## Archivos a Crear
1. `web/app/expenses/components/ExpenseFormModal.tsx`
2. `web/app/expenses/components/ExpensesFilterBar.tsx`
3. `web/app/expenses/components/ExpensesSummary.tsx`
4. `web/app/expenses/components/ExpensesTable.tsx`
5. `web/app/expenses/components/ExpenseAlerts.tsx`

## Archivos a Modificar
1. `web/app/expenses/page.tsx` (simplificar)

## Dependencias
Ninguna - refactor aislado
