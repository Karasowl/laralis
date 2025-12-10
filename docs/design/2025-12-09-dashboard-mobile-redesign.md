# Dashboard Mobile Redesign - Design Document

**Fecha**: 2025-12-09
**Estado**: Analisis y Propuestas (Sin implementar)
**Archivos afectados**:
- `web/app/page.tsx`
- `web/components/dashboard/DateFilterBar.tsx`
- `web/components/dashboard/CategoryBreakdown.tsx`
- `web/components/dashboard/RecentActivity.tsx`
- `web/components/dashboard/MetricCard.tsx`
- `web/components/dashboard/BusinessMetricsGrid.tsx`
- `web/components/ui/PageHeader.tsx`

---

## Resumen Ejecutivo

Este documento detalla 8 problemas de UX/UI identificados en el Dashboard para mobile y propone soluciones especificas siguiendo el sistema de diseno Apple-like del proyecto (radius 16, generous spacing, soft shadows, max-width 1280).

---

## Problema 1: DateFilterBar - Iconos de calendario se solapan con texto

### Ubicacion del Codigo
**Archivo**: `web/components/dashboard/DateFilterBar.tsx`
**Lineas**: 114-130

```tsx
// PROBLEMA: Los inputs type="date" no tienen suficiente padding para el icono nativo del browser
<input
  type="date"
  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  value={customRange?.from || ''}
  onChange={(e) => handleCustomFromChange(e.target.value)}
/>
```

### Analisis
- En mobile, los inputs `type="date"` tienen un icono de calendario nativo del browser
- El `px-3` (12px) no es suficiente para evitar solapamiento con el texto de la fecha
- El icono nativo puede variar entre browsers (Chrome, Safari, Firefox)

### Propuesta de Solucion

```tsx
// SOLUCION: Incrementar padding derecho para el icono nativo
<input
  type="date"
  className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  value={customRange?.from || ''}
  onChange={(e) => handleCustomFromChange(e.target.value)}
/>
```

**Cambios CSS**:
- `h-9` -> `h-10` (mayor altura para touch targets de 44px)
- Agregar `pr-10` (padding-right: 40px) para espacio del icono

### Wireframe ASCII - Antes vs Despues

```
ANTES (solapamiento):
+---------------------------+
| 2024-12-01[CAL]          |  <- Texto pegado al icono
+---------------------------+

DESPUES (con espacio):
+---------------------------+
| 2024-12-01       [CAL]   |  <- Texto separado del icono
+---------------------------+
```

---

## Problema 2: Espacio excesivo entre PageHeader y tarjetas

### Ubicacion del Codigo
**Archivo**: `web/components/ui/PageHeader.tsx`
**Lineas**: 16-19

```tsx
className={cn(
  "flex flex-col gap-4 pb-8 border-b border-border/40",  // pb-8 es mucho en mobile
  className
)}
```

**Archivo**: `web/app/page.tsx`
**Linea**: 296

```tsx
<div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
```

### Analisis
- `pb-8` (32px) en PageHeader + `space-y-6` (24px) = 56px de espacio vertical
- En mobile, este espacio empuja el contenido importante muy abajo
- El usuario debe hacer scroll para ver las metricas principales

### Propuesta de Solucion

**PageHeader.tsx**:
```tsx
className={cn(
  "flex flex-col gap-3 pb-4 sm:pb-6 lg:pb-8 border-b border-border/40",
  className
)}
```

**page.tsx**:
```tsx
<div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
```

**Cambios**:
- Mobile: `pb-4` (16px) + `space-y-4` (16px) = 32px
- Tablet: `pb-6` (24px) + `space-y-6` (24px) = 48px
- Desktop: `pb-8` (32px) + `space-y-6` (24px) = 56px (sin cambio)

### Wireframe ASCII - Antes vs Despues

```
ANTES (56px gap):
+---------------------------+
| Dashboard                 |
| Panel de control          |
|                           |  <- 56px de espacio
|                           |
+---------------------------+
| [Metric Cards]            |

DESPUES (32px gap en mobile):
+---------------------------+
| Dashboard                 |
| Panel de control          |
|                           |  <- 32px de espacio
+---------------------------+
| [Metric Cards]            |
```

---

## Problema 3: Boton "Actualizar" crea espacio en blanco

### Ubicacion del Codigo
**Archivo**: `web/app/page.tsx`
**Lineas**: 297-306

```tsx
<PageHeader
  title={t('title')}
  subtitle={t('subtitle', { clinic: currentClinic?.name || '' })}
  actions={
    <Button onClick={handleRefresh} variant="outline">
      <RefreshCw className="h-4 w-4 mr-2" />
      {t('refresh')}
    </Button>
  }
/>
```

### Analisis
- El boton "Actualizar" tiene uso limitado (los datos se actualizan automaticamente)
- Ocupa espacio horizontal valioso en mobile
- Crea desbalance visual con espacio vacio a la izquierda
- Deberia estar en el sidebar global o eliminarse completamente

### Propuesta de Solucion

**Opcion A - Eliminar el boton (RECOMENDADO)**:
```tsx
<PageHeader
  title={t('title')}
  subtitle={t('subtitle', { clinic: currentClinic?.name || '' })}
  // Sin actions - los datos se actualizan automaticamente
/>
```

**Opcion B - Mover a posicion contextual**:
Si se necesita refresh manual, agregarlo como icono pequeno en el DateFilterBar:

```tsx
// En DateFilterBar.tsx, agregar al final del primer div:
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8 shrink-0"
  onClick={onRefresh}
>
  <RefreshCw className="h-4 w-4" />
</Button>
```

### Wireframe ASCII

```
ANTES:
+------------------------------------------+
| Dashboard                    [Actualizar]|
| Panel de control                         |
+------------------------------------------+

DESPUES (Opcion A):
+------------------------------------------+
| Dashboard                                |
| Panel de control para Clinica Demo       |
+------------------------------------------+

DESPUES (Opcion B - icono en DateFilterBar):
+------------------------------------------+
| Dashboard                                |
+------------------------------------------+
| [Hoy][Semana][Mes]...           [Reload] |
+------------------------------------------+
```

---

## Problema 4: CategoryBreakdown - Texto de categorias se superpone

### Ubicacion del Codigo
**Archivo**: `web/components/dashboard/CategoryBreakdown.tsx`
**Lineas**: 92-118

```tsx
<ResponsiveContainer width="100%" height={250} className="sm:!h-[260px] lg:!h-[300px]">
  <PieChart>
    <Pie
      data={data}
      cx="50%"
      cy="50%"
      labelLine={false}
      label={CustomLabel}
      outerRadius={100}  // Radio fijo, no se adapta a mobile
      fill="#8884d8"
      dataKey="value"
    >
```

```tsx
<Legend
  verticalAlign="bottom"
  height={36}
  wrapperStyle={{ fontSize: '12px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px' }}
/>
```

### Analisis
- `outerRadius={100}` es un valor fijo que no se adapta al tamano de pantalla
- En mobile (width < 375px), el pie chart puede desbordar el contenedor
- La leyenda con `flexWrap: 'wrap'` puede crear multiples lineas que se superponen
- El `height={36}` para Legend es insuficiente cuando hay muchas categorias

### Propuesta de Solucion

```tsx
// 1. Usar outerRadius responsivo
<Pie
  data={data}
  cx="50%"
  cy="45%"  // Mover ligeramente hacia arriba para dejar espacio a leyenda
  labelLine={false}
  label={CustomLabel}
  outerRadius="70%"  // Porcentaje en lugar de valor fijo
  innerRadius="0%"
  fill="#8884d8"
  dataKey="value"
>

// 2. Mejorar Legend para mobile
<Legend
  verticalAlign="bottom"
  height={56}  // Mas altura para wrap
  wrapperStyle={{
    fontSize: '11px',  // Slightly smaller
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '6px 12px',  // gap vertical y horizontal
    paddingTop: '8px',
    maxWidth: '100%',
    lineHeight: '1.4'
  }}
/>

// 3. Ajustar altura del contenedor
<ResponsiveContainer
  width="100%"
  height={220}  // Mobile
  className="sm:!h-[260px] lg:!h-[300px]"
>
```

**Cambios adicionales en CustomLabel**:
```tsx
const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  // Umbral mas alto para mobile - no mostrar labels en slices pequenas
  if (percent < 0.08) return null  // 8% en lugar de 5%

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"  // Siempre centrado para evitar desborde
      dominantBaseline="central"
      className="text-[10px] sm:text-xs font-medium"  // Texto mas pequeno en mobile
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}
```

### Wireframe ASCII

```
ANTES (superposicion):
+---------------------------+
|       [PIE CHART]         |
|    15%  22%  18%          |  <- Labels se superponen
| [Cat1][Cat2][Cat3][Cat4]  |  <- Leyenda desborda
| [Cat5][Cat6]              |
+---------------------------+

DESPUES (separado):
+---------------------------+
|                           |
|      [PIE CHART]          |
|    15%     22%            |  <- Labels visibles
|                           |
| Cat1  Cat2  Cat3          |
| Cat4  Cat5  Cat6          |  <- Leyenda con espacio
+---------------------------+
```

---

## Problema 5: "Pacientes necesarios" sin icono (inconsistencia)

### Ubicacion del Codigo
**Archivo**: `web/components/dashboard/BusinessMetricsGrid.tsx`
**Lineas**: 115-140

```tsx
{/* Pacientes Necesarios */}
<Card className="relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.01]">
  <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/10 rounded-full blur-2xl" />
  <CardContent className="p-4 sm:p-6 relative">
    <div className="flex items-center justify-between mb-4">
      <div className="w-10 h-10 rounded-lg bg-secondary/10 dark:bg-secondary/20 backdrop-blur-sm flex items-center justify-center">
        <Target className="h-5 w-5 text-secondary dark:text-secondary/80" />
      </div>
      {/* PROBLEMA: No hay Badge aqui, pero Ticket Promedio SI tiene */}
    </div>
```

### Analisis
Comparando las tarjetas de BusinessMetricsGrid:
- **Ticket Promedio** (lineas 86-113): Tiene icono (DollarSign) + Badge de cambio
- **Pacientes Necesarios** (lineas 115-140): Tiene icono (Target) pero NO Badge
- **Pacientes Actuales** (lineas 142-203): Tiene icono (Users) + Badge de diferencia
- **Ganancia Neta** (lineas 205-282): Tiene icono (DollarSign) + Badge de cambio

El problema NO es que falte icono (si tiene Target), sino que no tiene Badge de cambio/comparacion como las demas tarjetas.

### Propuesta de Solucion

Agregar un Badge informativo o mantener consistencia sin Badge:

**Opcion A - Agregar Badge informativo**:
```tsx
<div className="flex items-center justify-between mb-4">
  <div className="w-10 h-10 rounded-lg bg-secondary/10 dark:bg-secondary/20 backdrop-blur-sm flex items-center justify-center">
    <Target className="h-5 w-5 text-secondary dark:text-secondary/80" />
  </div>
  {/* Badge que muestra el objetivo diario */}
  <Badge variant="outline" className="text-muted-foreground gap-1">
    <Calendar className="h-3 w-3" />
    {t('daily')}
  </Badge>
</div>
```

**Opcion B - Agregar tooltip explicativo (RECOMENDADO)**:
```tsx
<div className="flex items-center justify-between mb-4">
  <div className="w-10 h-10 rounded-lg bg-secondary/10 dark:bg-secondary/20 backdrop-blur-sm flex items-center justify-center">
    <Target className="h-5 w-5 text-secondary dark:text-secondary/80" />
  </div>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent>
        <p>{t('patientsNeeded_tooltip')}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
```

---

## Problema 6: RecentActivity ocupa mucho espacio

### Ubicacion del Codigo
**Archivo**: `web/components/dashboard/RecentActivity.tsx`
**Lineas**: 74-119

```tsx
<CardContent>
  <div className="space-y-4">
    {activities.length === 0 ? (
      // Empty state...
    ) : (
      activities.map((activity) => {
        // Renderiza TODOS los items sin limite
        return (
          <div key={activity.id} className="flex items-start space-x-3 p-2 -mx-2 rounded-lg transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
            // ... item content
          </div>
        )
      })
    )}
  </div>
</CardContent>
```

### Analisis
- El componente renderiza TODOS los activities sin limite
- En mobile, esto puede ocupar todo el viewport
- No hay estado colapsado por defecto
- No hay "Ver mas" para expandir

### Propuesta de Solucion

**Nuevo componente con estado colapsable**:

```tsx
'use client'

import { useState } from 'react'
// ... otros imports
import { ChevronDown, ChevronUp } from 'lucide-react'

export function RecentActivity({
  activities,
  title,
  description,
  initialCollapsed = true,  // NUEVO: Colapsado por defecto
  collapsedLimit = 2        // NUEVO: Mostrar solo 2 items cuando esta colapsado
}: RecentActivityProps) {
  const t = useTranslations('dashboardComponents.recentActivity')
  const [isExpanded, setIsExpanded] = useState(!initialCollapsed)

  // Determinar que items mostrar
  const visibleActivities = isExpanded
    ? activities
    : activities.slice(0, collapsedLimit)

  const hasMore = activities.length > collapsedLimit

  return (
    <Card className="transition-all duration-200 hover:shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title || t('title')}</CardTitle>
            <CardDescription className="text-xs">{description || t('description')}</CardDescription>
          </div>
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  {t('showLess')}
                  <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  {t('showMore', { count: activities.length - collapsedLimit })}
                  <ChevronDown className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-2">  {/* Reducir space-y-4 a space-y-2 */}
          {visibleActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('noActivity')}
            </p>
          ) : (
            visibleActivities.map((activity) => {
              // ... render item (mas compacto)
              return (
                <div key={activity.id} className="flex items-center space-x-3 p-2 -mx-2 rounded-lg transition-all duration-200 hover:bg-muted/50">
                  <div className={`p-1.5 rounded-md ${colorClass}`}>  {/* Icono mas pequeno */}
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      {(activity.amount ?? null) !== null && (
                        <span className="text-sm font-medium shrink-0">
                          {formatCurrency(activity.amount!)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {safeFormatDistance(activity.timestamp)}
                      {activity.user && ` - ${activity.user}`}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

**Nuevas claves i18n**:
```json
{
  "dashboardComponents": {
    "recentActivity": {
      "showMore": "Ver {count} mas",
      "showLess": "Ver menos"
    }
  }
}
```

### Wireframe ASCII

```
ANTES (expandido siempre):
+---------------------------+
| Actividad Reciente        |
+---------------------------+
| [icon] Tratamiento 1      |
| [icon] Tratamiento 2      |
| [icon] Gasto 1            |
| [icon] Paciente nuevo     |
| [icon] Tratamiento 3      |
| [icon] Gasto 2            |
+---------------------------+  <- Ocupa mucho espacio

DESPUES (colapsado por defecto):
+---------------------------+
| Actividad Reciente  [+3]  |
+---------------------------+
| [icon] Tratamiento 1      |
| [icon] Tratamiento 2      |
+---------------------------+  <- Compacto

DESPUES (expandido al hacer click):
+---------------------------+
| Actividad Reciente  [-]   |
+---------------------------+
| [icon] Tratamiento 1      |
| [icon] Tratamiento 2      |
| [icon] Gasto 1            |
| [icon] Paciente nuevo     |
| [icon] Tratamiento 3      |
+---------------------------+
```

---

## Problema 7: MetricCard inconsistencias visuales

### Ubicacion del Codigo
**Archivo**: `web/components/dashboard/MetricCard.tsx`

Comparando con BusinessMetricsGrid:
- MetricCard usa `bg-primary/10` fijo para el icono
- BusinessMetricsGrid usa colores contextuales (emerald, amber, red)

### Analisis
- MetricCard y BusinessMetricsGrid tienen estilos diferentes para las mismas metricas
- Esto crea inconsistencia visual en el Dashboard
- El usuario puede confundirse sobre que tarjetas son interactivas

### Propuesta de Solucion

**Opcion A - Unificar estilos en MetricCard**:
```tsx
interface MetricCardProps {
  // ... existing props
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

export function MetricCard({
  // ... existing
  variant = 'default'
}: MetricCardProps) {

  const variantStyles = {
    default: {
      bg: 'bg-primary/10 dark:bg-primary/20',
      border: '',
      iconColor: color  // usar el color prop
    },
    success: {
      bg: 'bg-emerald-100 dark:bg-emerald-950/30',
      border: 'border-emerald-200 dark:border-emerald-900',
      iconColor: 'text-emerald-600 dark:text-emerald-400'
    },
    warning: {
      bg: 'bg-amber-100 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-900',
      iconColor: 'text-amber-600 dark:text-amber-400'
    },
    danger: {
      bg: 'bg-destructive/10 dark:bg-destructive/20',
      border: 'border-destructive/30 dark:border-destructive/40',
      iconColor: 'text-destructive'
    }
  }

  const styles = variantStyles[variant]

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-lg hover:scale-[1.01]",
      styles.border && `border-2 ${styles.border}`
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-lg backdrop-blur-sm ${styles.bg}`}>
          <Icon className={`h-4 w-4 ${styles.iconColor}`} />
        </div>
      </CardHeader>
      {/* ... rest */}
    </Card>
  )
}
```

**Opcion B - Crear MetricCardGrid (wrapper unificado)**:
Crear un componente que maneje la grid de metricas con estilos consistentes.

---

## Problema 8: Boton Actualizar no deberia existir

### Analisis (Extension del Problema 3)

El boton "Actualizar" actual tiene varios problemas:
1. **UX innecesario**: Los datos ya se actualizan automaticamente con los hooks
2. **Implementacion problematica**: `window.location.reload()` es un anti-pattern en SPA
3. **Posicion incorrecta**: Si se necesita, deberia estar en el sidebar global

### Propuesta de Solucion

**Paso 1: Eliminar el boton del PageHeader**

```tsx
// page.tsx - ANTES
<PageHeader
  title={t('title')}
  subtitle={t('subtitle', { clinic: currentClinic?.name || '' })}
  actions={
    <Button onClick={handleRefresh} variant="outline">
      <RefreshCw className="h-4 w-4 mr-2" />
      {t('refresh')}
    </Button>
  }
/>

// page.tsx - DESPUES
<PageHeader
  title={t('title')}
  subtitle={t('subtitle', { clinic: currentClinic?.name || '' })}
/>
```

**Paso 2: Eliminar la funcion handleRefresh**

```tsx
// ELIMINAR estas lineas (246-249)
const handleRefresh = () => {
  fetchReportsData()
  window.location.reload()
}
```

**Paso 3: Si se necesita refresh manual, usar SWR/React Query**

En lugar de `window.location.reload()`, los hooks deberian exponer una funcion `mutate` o `refetch`:

```tsx
// En el hook
export function useDashboard({ clinicId, period }) {
  const { data, mutate } = useSWR(...)
  return {
    ...data,
    refresh: mutate  // Exponer funcion de refresh
  }
}

// En el componente, si realmente se necesita:
const { metrics, refresh } = useDashboard(...)

// Agregar al DateFilterBar si es necesario
<DateFilterBar
  // ... other props
  onRefresh={refresh}
/>
```

---

## Resumen de Cambios Propuestos

| Problema | Prioridad | Complejidad | Archivos |
|----------|-----------|-------------|----------|
| 1. DateFilterBar iconos | P1 | XS | DateFilterBar.tsx |
| 2. Espacio excesivo | P1 | XS | PageHeader.tsx, page.tsx |
| 3. Boton Actualizar posicion | P2 | S | page.tsx |
| 4. CategoryBreakdown overlap | P1 | M | CategoryBreakdown.tsx |
| 5. Inconsistencia iconos | P3 | S | BusinessMetricsGrid.tsx |
| 6. RecentActivity espacio | P1 | M | RecentActivity.tsx |
| 7. MetricCard inconsistencias | P3 | M | MetricCard.tsx |
| 8. Eliminar boton Actualizar | P2 | XS | page.tsx |

### Orden de Implementacion Recomendado

1. **Sprint 1 (Quick wins)**:
   - Problema 2: Reducir spacing (XS)
   - Problema 1: Fix DateFilterBar padding (XS)
   - Problema 8: Eliminar boton Actualizar (XS)

2. **Sprint 2 (Mobile UX)**:
   - Problema 6: RecentActivity colapsable (M)
   - Problema 4: CategoryBreakdown responsive (M)

3. **Sprint 3 (Consistencia)**:
   - Problema 5: BusinessMetricsGrid badge (S)
   - Problema 7: MetricCard variants (M)
   - Problema 3: Refactor refresh (S)

---

## Nuevas Claves i18n Necesarias

```json
{
  "dashboardComponents": {
    "recentActivity": {
      "showMore": "Ver {count} mas",
      "showLess": "Ver menos"
    },
    "businessMetrics": {
      "patientsNeeded_tooltip": "Pacientes necesarios por dia para alcanzar el punto de equilibrio",
      "daily": "diario"
    }
  }
}
```

---

## Metricas de Exito

Despues de implementar estos cambios:

1. **Above the fold content**: Las 4 metricas principales deben ser visibles sin scroll en iPhone SE (320px)
2. **Touch targets**: Todos los elementos interactivos >= 44px
3. **Loading time**: No incrementar el bundle size mas de 5KB
4. **Accesibilidad**: Mantener AA compliance

---

## Referencias

- [Apple Human Interface Guidelines - Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Recharts Responsive](https://recharts.org/en-US/api/ResponsiveContainer)
- [CLAUDE.md - UI Design System](../../CLAUDE.md)
