---
id: ISSUE-018
title: Modernizar filtros de gastos con SmartFilters
status: open
priority: P2
area: ui
estimate: M (2 horas)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Modernizar filtros de gastos con SmartFilters

## Problema
Los filtros de gastos usan componentes legacy (cards horizontales con selects) mientras que Pacientes y Tratamientos usan `SmartFilters` con chips y barra unificada.

## Estado Actual (Gastos)
```typescript
// FiltersCard - 117 líneas legacy
<Card>
  <CardContent className="flex gap-4">
    <Select value={filters.category} ...>
    <Select value={filters.subcategory} ...>
    <Input type="month" value={filters.month} ...>
    <Button onClick={clearFilters}>Clear</Button>
  </CardContent>
</Card>
```

## Estado Ideal (Pacientes)
```typescript
<SmartFilters
  filters={filterConfigs}
  values={filterValues}
  onChange={setFilterValues}
  onClear={clearFilters}
/>
```

## Configuración de Filtros

```typescript
// web/app/expenses/components/ExpensesFilterBar.tsx

const filterConfigs: FilterConfig[] = [
  {
    key: 'category',
    type: 'select',
    label: t('filters.category'),
    options: categoryOptions,
  },
  {
    key: 'subcategory',
    type: 'select',
    label: t('filters.subcategory'),
    options: subcategoryOptions,
    dependsOn: 'category',  // Solo mostrar si hay category
  },
  {
    key: 'date_range',
    type: 'date-range',
    label: t('filters.dateRange'),
  },
  {
    key: 'amount_min',
    type: 'number',
    label: t('filters.amountMin'),
    placeholder: '$0',
  },
  {
    key: 'amount_max',
    type: 'number',
    label: t('filters.amountMax'),
    placeholder: '$∞',
  },
  {
    key: 'is_variable',
    type: 'boolean',
    label: t('filters.isVariable'),
  },
  {
    key: 'is_recurring',
    type: 'boolean',
    label: t('filters.isRecurring'),
  },
]
```

## Traducciones Necesarias

```json
{
  "expenses": {
    "filters": {
      "category": "Categoría",
      "subcategory": "Subcategoría",
      "dateRange": "Rango de fechas",
      "amountMin": "Monto mínimo",
      "amountMax": "Monto máximo",
      "isVariable": "Solo variables",
      "isRecurring": "Solo recurrentes"
    }
  }
}
```

## Acceptance Criteria
- [ ] Filtros de gastos usan `SmartFilters`
- [ ] Chips activos muestran filtros aplicados
- [ ] Botón "Limpiar filtros" funciona
- [ ] Dependencia subcategory→category funciona
- [ ] Consistente con filtros de Pacientes
- [ ] Traducciones EN y ES
- [ ] `npm run typecheck` pasa

## Testing
1. Ir a Gastos
2. Aplicar filtro por categoría → chip aparece
3. Aplicar filtro por fecha → chip aparece
4. Limpiar filtros → chips desaparecen
5. Verificar que tabla se filtra correctamente

## Archivos a Crear/Modificar
1. CREAR: `web/app/expenses/components/ExpensesFilterBar.tsx`
2. MODIFICAR: `web/app/expenses/page.tsx`
3. AGREGAR: Traducciones

## Dependencias
- ISSUE-017 (refactor de expenses)
- SmartFilters debe existir (verificar en `components/ui/`)
