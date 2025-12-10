---
id: ISSUE-014
title: Agregar tooltips explicativos a métricas financieras
status: open
priority: P1
area: ui
estimate: M (2 horas)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Agregar tooltips explicativos a métricas financieras

## Problema
Los usuarios no entienden qué significan las métricas financieras:
- Utilidad Bruta vs Ganancia Neta
- EBITDA
- ROI de servicios (711% parece absurdo)

Las fórmulas son correctas, pero falta contexto y explicación.

## Solución
Agregar icono de información con tooltip que muestre:
1. Fórmula usada
2. Valores que alimentan el cálculo
3. Explicación en lenguaje simple

## Diseño de Tooltip

```typescript
interface MetricTooltipData {
  formula: string
  values: { label: string; amount: number }[]
  explanation: string
  benchmark?: { industry: number; current: number }
}

// Ejemplo para Utilidad Bruta
const grossProfitTooltip: MetricTooltipData = {
  formula: 'Ingresos - Costos Variables',
  values: [
    { label: 'Ingresos', amount: 1000000 },
    { label: 'Costos Variables', amount: 300000 },
    { label: 'Resultado', amount: 700000 }
  ],
  explanation: 'Lo que ganas después de pagar materiales. No incluye costos fijos como alquiler o salarios.',
  benchmark: { industry: 75, current: 70 }
}
```

## Componente Propuesto

```typescript
// components/ui/metric-tooltip.tsx
interface MetricTooltipProps {
  data: MetricTooltipData
  children: React.ReactNode
}

export function MetricTooltip({ data, children }: MetricTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            {children}
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-4">
          <div className="space-y-2">
            <p className="font-mono text-xs text-muted-foreground">
              {data.formula}
            </p>
            <div className="space-y-1">
              {data.values.map((v, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{v.label}</span>
                  <span className="font-medium">{formatCurrency(v.amount)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground border-t pt-2">
              {data.explanation}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

## Uso en Dashboard

```typescript
<MetricCard
  title={
    <MetricTooltip data={grossProfitTooltip}>
      {t('gross_profit')}
    </MetricTooltip>
  }
  value={formatCurrency(profitAnalysis.profits.gross_profit_cents)}
/>
```

## Métricas a Documentar

| Métrica | Fórmula | Explicación |
|---------|---------|-------------|
| Utilidad Bruta | Revenue - Variable Costs | Ganancia después de materiales |
| EBITDA | Operating Profit + Depreciation | Ganancia operativa sin deprec |
| Ganancia Neta | Operating Profit | Ganancia después de todo |
| ROI Servicio | (Profit / Cost) × 100 | Retorno por cada peso invertido |
| Ticket Promedio | Revenue / Treatments | Valor promedio por tratamiento |

## Acceptance Criteria
- [ ] Icono de info al lado de métricas financieras
- [ ] Tooltip muestra fórmula y valores
- [ ] Tooltip funciona en desktop y mobile
- [ ] Traducciones en EN y ES
- [ ] `npm run typecheck` pasa

## Archivos a Crear/Modificar
1. CREAR: `web/components/ui/metric-tooltip.tsx`
2. MODIFICAR: `web/app/page.tsx` (métricas con tooltip)
3. MODIFICAR: `web/components/dashboard/ServiceROIAnalysis.tsx`
4. AGREGAR: Traducciones para explicaciones

## Dependencias
- ISSUE-007 (TooltipProvider pattern)
