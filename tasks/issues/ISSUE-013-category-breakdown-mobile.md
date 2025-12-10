---
id: ISSUE-013
title: CategoryBreakdown - Texto superpuesto en mobile
status: open
priority: P1
area: ui
estimate: S (30 min)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# CategoryBreakdown - Texto superpuesto en mobile

## Problema
En el gráfico de pastel "Desglose por categoría", el texto de las categorías se superpone y es ilegible en dispositivos móviles.

## Causa Raíz
- `outerRadius={100}` es fijo (no responsive)
- Legend `height={36}` es insuficiente
- Labels se renderizan sin considerar espacio disponible

**Ubicación**: `web/components/dashboard/CategoryBreakdown.tsx`

## Solución Propuesta

```typescript
// 1. Usar porcentaje en lugar de valor fijo
<PieChart>
  <Pie
    outerRadius="70%"  // En vez de 100
    // ...
  >
    {/* Solo mostrar label si segmento > 8% */}
    <LabelList
      dataKey="value"
      position="outside"
      formatter={(value, entry) =>
        entry.percent > 0.08 ? entry.name : ''
      }
    />
  </Pie>
</PieChart>

// 2. Legend más alta en mobile
<Legend
  layout="horizontal"
  verticalAlign="bottom"
  height={56}  // En vez de 36
  wrapperStyle={{
    paddingTop: '8px',
    fontSize: '12px'
  }}
/>
```

## Alternativa: Ocultar labels en mobile
```typescript
const isMobile = useMediaQuery('(max-width: 640px)')

<Pie
  label={!isMobile}  // Sin labels en mobile
>
```

## Acceptance Criteria
- [ ] Texto de categorías legible en mobile
- [ ] Gráfico responsive (se ajusta al contenedor)
- [ ] Legend visible y legible
- [ ] No hay superposición de texto
- [ ] `npm run typecheck` pasa

## Testing
1. Abrir Dashboard en mobile (320px - 414px)
2. Scroll a "Desglose por categoría"
3. Verificar que las categorías son legibles
4. Verificar que la leyenda no se corta

## Archivos a Modificar
1. `web/components/dashboard/CategoryBreakdown.tsx`
