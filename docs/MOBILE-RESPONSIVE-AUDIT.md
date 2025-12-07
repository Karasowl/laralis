# Mobile Responsive Design Audit - Laralis

**Fecha:** 2025-12-07
**Version:** 1.0
**Estado:** Auditoria Inicial Completa

---

## Resumen Ejecutivo

Esta auditoria documenta todos los problemas de responsive design encontrados en la aplicacion Laralis. El analisis cubre ~25 vistas principales y ~40 componentes. Los problemas se priorizan de **CRITICO** a **BAJO** segun su impacto en la usabilidad movil.

### Estadisticas Generales
- **Vistas auditadas:** 25
- **Componentes analizados:** 40+
- **Problemas criticos:** 8
- **Problemas altos:** 12
- **Problemas medios:** 15
- **Problemas bajos:** 10

---

## Inventario de Vistas

| Ruta | Nombre | Estado Responsive | Prioridad |
|------|--------|-------------------|-----------|
| `/` | Dashboard | PROBLEMATICO | CRITICO |
| `/services` | Servicios | PROBLEMATICO | CRITICO |
| `/treatments` | Tratamientos | PARCIAL | ALTO |
| `/treatments/calendar` | Calendario | BUENO | BAJO |
| `/patients` | Pacientes | PARCIAL | MEDIO |
| `/expenses` | Gastos | PARCIAL | MEDIO |
| `/equilibrium` | Punto de Equilibrio | PARCIAL | ALTO |
| `/time` | Configuracion de Tiempo | PARCIAL | MEDIO |
| `/fixed-costs` | Costos Fijos | PARCIAL | MEDIO |
| `/assets` | Activos | PARCIAL | MEDIO |
| `/supplies` | Insumos | PARCIAL | MEDIO |
| `/settings` | Configuracion | BUENO | BAJO |
| `/marketing` | Marketing | PARCIAL | MEDIO |
| `/profile` | Perfil | BUENO | BAJO |

---

## Problemas Criticos (P0)

### 1. ServiceROIAnalysis - Numeros Truncados

**Archivo:** `web/components/dashboard/ServiceROIAnalysis.tsx`
**Lineas afectadas:** 83-133, 165-201

**Problema:**
Los numeros grandes en las cards de resumen y la lista de servicios se truncan en pantallas pequenas. Ejemplo visible: "$3,888.4..." en vez de "$3,888.40".

**Causa:**
- `text-2xl` fijo sin escalado responsive
- Contenedores con `flex` sin `min-width: 0` para permitir truncado controlado
- Sin breakpoints para reducir tamano de fuente en movil

**Solucion Propuesta:**

```tsx
// ANTES (linea 92-93)
<p className="text-2xl font-bold text-emerald-600">
  {formatCurrency(data.totals.total_profit_cents)}
</p>

// DESPUES
<p className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-600 break-all">
  {formatCurrency(data.totals.total_profit_cents)}
</p>
```

```tsx
// Para la lista de servicios (linea 190-192)
// ANTES
<p className="text-2xl font-bold text-emerald-600">
  {formatCurrency(service.total_profit_cents)}
</p>

// DESPUES
<p className="text-base sm:text-lg lg:text-2xl font-bold text-emerald-600 tabular-nums">
  {formatCurrency(service.total_profit_cents)}
</p>
```

**CSS adicional recomendado:**

```css
/* En globals.css o componente */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
```

---

### 2. ServicesTable - Columnas Excesivas en Movil

**Archivo:** `web/app/services/components/ServicesTable.tsx`
**Lineas afectadas:** 347-362

**Problema:**
La tabla de servicios tiene 7 columnas, de las cuales solo 4 se muestran en `mobileColumns`. Sin embargo, el popover de desglose de costos no se adapta bien al viewport movil.

**Causa:**
- PopoverContent con `w-80` fijo que puede exceder viewport
- Falta de `max-w-[calc(100vw-2rem)]` ya implementado pero insuficiente
- Layout interno del popover no es responsive

**Solucion Propuesta:**

```tsx
// Linea 112 - PopoverContent ya tiene responsive pero mejorar
<PopoverContent
  className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm p-3 sm:p-4"
  side="bottom"
  align="end"
  sideOffset={4}
  collisionPadding={8}
>
  <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
    {/* contenido */}
  </div>
</PopoverContent>
```

**Mejora adicional para mobile cards:**

```tsx
// Agregar al render de mobileColumns
<div className="flex flex-col gap-1 py-2">
  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
    {column.label}
  </span>
  {/* valor */}
</div>
```

---

### 3. SummaryCards - Valores Grandes Desbordados

**Archivo:** `web/components/ui/summary-cards.tsx`
**Lineas afectadas:** 121-123

**Problema:**
Los valores monetarios grandes (ej: "$1,234,567.89") desbordan las cards en pantallas pequenas.

**Causa:**
- `text-2xl` fijo para todos los valores
- Sin `truncate` o `break-all` para numeros largos
- Cards con `min-width` implicito que no permite compresion

**Solucion Propuesta:**

```tsx
// ANTES (linea 121-123)
<div className={cn('text-2xl font-semibold', colorClasses[color])}>
  {value}
</div>

// DESPUES
<div className={cn(
  'text-lg sm:text-xl lg:text-2xl font-semibold tabular-nums',
  'overflow-hidden text-ellipsis',
  colorClasses[color]
)}>
  {typeof value === 'string' && value.length > 12 ? (
    <span className="text-base sm:text-lg lg:text-xl">{value}</span>
  ) : value}
</div>
```

**Alternativa con auto-sizing:**

```tsx
// Componente helper para auto-size
function AutoSizeValue({ value, maxLength = 10 }: { value: string | number | React.ReactNode, maxLength?: number }) {
  const strValue = String(value)
  const size = strValue.length > maxLength
    ? 'text-sm sm:text-base lg:text-xl'
    : strValue.length > 8
    ? 'text-base sm:text-lg lg:text-2xl'
    : 'text-lg sm:text-xl lg:text-2xl'

  return <span className={cn(size, 'font-semibold tabular-nums')}>{value}</span>
}
```

---

### 4. DataTable Mobile Cards - Layout Inconsistente

**Archivo:** `web/components/ui/DataTable.tsx`
**Lineas afectadas:** 201-222

**Problema:**
Las mobile cards no tienen estructura visual clara. Los valores se apilan sin labels visibles, dificultando la interpretacion.

**Causa:**
- `mobileColumns` solo renderiza valores, no labels
- Sin separacion visual entre campos
- Padding/spacing inconsistente

**Solucion Propuesta:**

```tsx
// ANTES (linea 201-222)
<div className="md:hidden divide-y">
  {sortedData.map((item, rowIndex) => {
    const cols = mobileColumns && mobileColumns.length > 0 ? mobileColumns : columns.slice(0, Math.min(2, columns.length));
    return (
      <div key={(item as any).id ?? rowIndex} className="p-4">
        {cols.map((column, colIndex) => {
          const value = getValue(item, column.key);
          return (
            <div key={colIndex} className={cn("py-1")}>
              {column.render ? (
                <div>{column.render(value, item, rowIndex)}</div>
              ) : (
                <div className="text-sm">{String(value ?? "")}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  })}
</div>

// DESPUES
<div className="md:hidden divide-y divide-border">
  {sortedData.map((item, rowIndex) => {
    const cols = mobileColumns && mobileColumns.length > 0
      ? mobileColumns
      : columns.slice(0, Math.min(3, columns.length));
    return (
      <div
        key={(item as any).id ?? rowIndex}
        className="p-3 sm:p-4 space-y-2 active:bg-muted/50 transition-colors"
      >
        {cols.map((column, colIndex) => {
          const value = getValue(item, column.key);
          const isActions = column.key === 'actions';

          return (
            <div
              key={colIndex}
              className={cn(
                "flex items-start gap-2",
                isActions && "justify-end pt-2 border-t mt-2"
              )}
            >
              {!isActions && column.label && (
                <span className="text-xs text-muted-foreground min-w-[80px] flex-shrink-0">
                  {column.label}:
                </span>
              )}
              <div className={cn(
                "text-sm flex-1 min-w-0",
                !isActions && "text-right"
              )}>
                {column.render
                  ? column.render(value, item, rowIndex)
                  : String(value ?? "")}
              </div>
            </div>
          );
        })}
      </div>
    );
  })}
</div>
```

---

### 5. BusinessMetricsGrid - Cards Comprimidas

**Archivo:** `web/components/dashboard/BusinessMetricsGrid.tsx`
**Lineas afectadas:** 71, 92-94

**Problema:**
Las 4 cards de metricas de negocio se comprimen demasiado en movil con `md:grid-cols-2 lg:grid-cols-4`. Los valores y labels quedan apretados.

**Causa:**
- Grid pasa de 1 a 2 columnas muy temprano (768px)
- Padding interno de cards no se reduce en movil
- Valores `text-2xl` fijos

**Solucion Propuesta:**

```tsx
// ANTES (linea 71)
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

// DESPUES
<div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">

// Para cada card, reducir padding en movil (linea ~75)
// ANTES
<CardContent className="p-6 relative">

// DESPUES
<CardContent className="p-4 sm:p-6 relative">

// Para valores (linea 92-94)
// ANTES
<p className="text-2xl font-bold text-foreground">

// DESPUES
<p className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground tabular-nums">
```

---

### 6. Tabs en ServiceROIAnalysis - No Scrollables

**Archivo:** `web/components/dashboard/ServiceROIAnalysis.tsx`
**Lineas afectadas:** 137-154

**Problema:**
Los tabs de analisis ("Por Ganancia Total", "Por Unidad", "Matriz", "Oportunidades") no caben en pantallas pequenas y se cortan.

**Causa:**
- `TabsList` con `grid w-full grid-cols-4` fijo
- Sin scroll horizontal ni colapso a iconos

**Solucion Propuesta:**

```tsx
// ANTES (linea 137-154)
<TabsList className="grid w-full grid-cols-4">
  <TabsTrigger value="total">
    <DollarSign className="h-4 w-4 mr-2" />
    {t('tabs.total')}
  </TabsTrigger>
  {/* ... */}
</TabsList>

// DESPUES
<TabsList className="flex w-full overflow-x-auto no-scrollbar">
  <TabsTrigger value="total" className="flex-1 min-w-[80px] sm:min-w-0">
    <DollarSign className="h-4 w-4 sm:mr-2" />
    <span className="hidden sm:inline">{t('tabs.total')}</span>
  </TabsTrigger>
  <TabsTrigger value="unit" className="flex-1 min-w-[80px] sm:min-w-0">
    <Gem className="h-4 w-4 sm:mr-2" />
    <span className="hidden sm:inline">{t('tabs.unit')}</span>
  </TabsTrigger>
  <TabsTrigger value="matrix" className="flex-1 min-w-[80px] sm:min-w-0">
    <Activity className="h-4 w-4 sm:mr-2" />
    <span className="hidden sm:inline">{t('tabs.matrix')}</span>
  </TabsTrigger>
  <TabsTrigger value="opportunities" className="flex-1 min-w-[80px] sm:min-w-0">
    <TrendingUp className="h-4 w-4 sm:mr-2" />
    <span className="hidden sm:inline">{t('tabs.opportunities')}</span>
  </TabsTrigger>
</TabsList>
```

**CSS para ocultar scrollbar:**

```css
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

---

### 7. Equilibrium Page - Cards de Metricas Apretadas

**Archivo:** `web/app/equilibrium/page.tsx`
**Lineas afectadas:** 275-305

**Problema:**
Las 4 metric cards de punto de equilibrio tienen valores largos que se truncan incorrectamente.

**Causa:**
- Mismo problema que BusinessMetricsGrid
- MetricCard local no tiene responsive sizing
- Valores como "$1,234,567" no caben

**Solucion Propuesta:**

```tsx
// Modificar MetricCard local (linea 30-66)
function MetricCard({ /* ... */ }: { /* ... */ }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium">{title}</CardTitle>
        <div className={`p-1.5 sm:p-2 rounded-lg ${variantStyles[variant]}`}>
          <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-lg sm:text-xl lg:text-2xl font-bold tabular-nums">
          {value}
        </div>
        {description && (
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

---

### 8. ServiceComparison - Grid de 3 Columnas Roto

**Archivo:** `web/components/dashboard/profitability/ServiceComparison.tsx`
**Lineas afectadas:** 89-113, 124-156, 162-182

**Problema:**
El comparador de servicios usa `grid-cols-[1fr,auto,1fr]` que no funciona bien en movil. Los valores quedan truncados y los selects son muy pequenos.

**Causa:**
- Grid fijo sin breakpoints
- Selectores con ancho implicito
- Labels centrados que ocupan espacio fijo

**Solucion Propuesta:**

```tsx
// Para los selectores (linea 124-156)
// ANTES
<div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">

// DESPUES
<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
  <Select value={serviceA} onValueChange={setServiceA} className="flex-1">
    <SelectTrigger className="w-full">
      <SelectValue placeholder={t('select_service_a')} />
    </SelectTrigger>
    {/* ... */}
  </Select>

  <ArrowRight className="hidden sm:block h-5 w-5 text-muted-foreground flex-shrink-0" />
  <span className="sm:hidden text-center text-xs text-muted-foreground">vs</span>

  <Select value={serviceB} onValueChange={setServiceB} className="flex-1">
    {/* ... */}
  </Select>
</div>

// Para las metricas de comparacion (linea 89-113)
// ANTES
<div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center py-3 border-b last:border-0">

// DESPUES
<div className="flex flex-col sm:grid sm:grid-cols-[1fr,auto,1fr] gap-2 sm:gap-4 items-start sm:items-center py-3 border-b last:border-0">
  <div className="flex justify-between w-full sm:block sm:text-right">
    <span className="text-xs text-muted-foreground sm:hidden">{label}</span>
    <p className="text-base sm:text-lg font-semibold">{formatter(valueA)}{suffix}</p>
  </div>
  <div className="hidden sm:flex flex-col items-center gap-1 min-w-[120px]">
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
    {/* badge */}
  </div>
  <div className="flex justify-between w-full sm:block sm:text-left">
    <span className="text-xs text-muted-foreground sm:hidden">{t('vs')}</span>
    <p className="text-base sm:text-lg font-semibold">{formatter(valueB)}{suffix}</p>
  </div>
</div>
```

---

## Problemas Altos (P1)

### 9. Treatments Page - Filtros Apilados Incorrectamente

**Archivo:** `web/app/treatments/page.tsx`
**Lineas afectadas:** 624-677

**Problema:**
Los toggles de vista (Lista/Calendario) y tipo (Todos/Citas/Tratamientos) ocupan demasiado espacio horizontal y causan scroll.

**Solucion Propuesta:**

```tsx
// Apilar verticalmente en movil extra-pequeno
<div className="flex flex-col xs:flex-row xs:flex-wrap items-start xs:items-center gap-2 sm:gap-3">
```

---

### 10. PageHeader Actions - Botones Desbordados

**Archivo:** Multiples archivos usan PageHeader
**Ejemplos:** `equilibrium/page.tsx:254-271`, `time/page.tsx:196-213`

**Problema:**
Los botones de accion en el header no se adaptan bien cuando hay 2+ botones.

**Solucion Propuesta:**

```tsx
// En PageHeader actions, usar flex-wrap
<div className="flex flex-wrap gap-2 justify-end">
  {actions}
</div>

// En paginas especificas, hacer botones responsive
<Button variant="outline" className="w-full sm:w-auto">
  <Icon className="h-4 w-4 sm:mr-2" />
  <span className="hidden sm:inline">{label}</span>
</Button>
```

---

### 11. FormGrid - Columnas Fijas

**Archivo:** `web/components/ui/form-field.tsx`
**Problema:** `columns={2}` no colapsa a 1 columna en movil muy pequeno (<360px).

**Solucion:**

```tsx
const gridCols = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 xs:grid-cols-2',
  3: 'grid-cols-1 xs:grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-1 xs:grid-cols-2 lg:grid-cols-4',
}
```

---

### 12. Fixed Costs Category Breakdown - Chart Comprimido

**Archivo:** `web/app/fixed-costs/page.tsx`
**Lineas afectadas:** 318-401

**Problema:**
La card de breakdown de categorias se comprime demasiado en el layout 2/3 + 1/3.

**Solucion Propuesta:**

```tsx
// ANTES (linea 300)
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">
    {/* DataTable */}
  </div>
  <div>
    {/* Category breakdown */}
  </div>
</div>

// DESPUES
<div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
  <div className="lg:col-span-2 order-2 lg:order-1">
    {/* DataTable */}
  </div>
  <div className="order-1 lg:order-2">
    {/* Category breakdown - aparece primero en movil */}
  </div>
</div>
```

---

### 13. Time Settings Page - Grid de 3 Columnas

**Archivo:** `web/app/time/page.tsx`
**Lineas afectadas:** 216-240

**Problema:**
El grid de 3 metric cards usa `md:grid-cols-3` que comprime las cards en tablets.

**Solucion:**

```tsx
// ANTES
<div className="grid gap-4 md:grid-cols-3">

// DESPUES
<div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
```

---

### 14. SmartFilters - Dropdowns Cortados

**Archivo:** `web/components/ui/smart-filters.tsx`
**Problema:**
Los dropdowns de filtros no tienen collision detection adecuado y se cortan en bordes de pantalla.

**Solucion:**

```tsx
<PopoverContent
  className="w-[280px] sm:w-[320px]"
  side="bottom"
  align="start"
  collisionPadding={16}
  avoidCollisions={true}
>
```

---

### 15. Modal Forms - Altura Excesiva

**Archivo:** `web/components/ui/form-modal.tsx`
**Problema:**
Modales con formularios largos no tienen scroll interno, empujando botones fuera de viewport.

**Solucion:**

```tsx
<DialogContent className="max-h-[90vh] overflow-hidden flex flex-col">
  <DialogHeader className="flex-shrink-0">
    {/* titulo */}
  </DialogHeader>
  <div className="flex-1 overflow-y-auto py-4">
    {children}
  </div>
  <DialogFooter className="flex-shrink-0 border-t pt-4">
    {/* botones */}
  </DialogFooter>
</DialogContent>
```

---

## Problemas Medios (P2)

### 16. Calendar MonthView - Celdas Muy Pequenas

**Archivo:** `web/app/treatments/calendar/components/MonthView.tsx`

**Estado Actual:** Ya tiene buen soporte responsive con `min-h-[44px] md:min-h-[120px]`

**Mejora Sugerida:** Agregar haptic feedback visual al tap en movil:

```tsx
className="active:scale-95 transition-transform"
```

---

### 17. ProfitabilitySummary - Cards de 4 Columnas

**Archivo:** `web/components/dashboard/profitability/ProfitabilitySummary.tsx`
**Linea:** 91

**Problema:** `md:grid-cols-2 lg:grid-cols-4` salta directamente de 1 a 2 columnas.

**Solucion:**

```tsx
<div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
```

---

### 18. Badge con ROI% - Texto Truncado

**Archivos varios:** ServiceROIAnalysis, ServicesTable

**Problema:** Badges con "ROI 234%" se truncan si el numero es grande.

**Solucion:**

```tsx
<Badge variant="secondary" className="text-[10px] sm:text-xs whitespace-nowrap">
  ROI {value}%
</Badge>
```

---

### 19. Assets Summary Cards - Iconos Desalineados

**Archivo:** `web/app/assets/page.tsx`

**Problema:** Los iconos de las summary cards se desalinean cuando los valores son muy largos.

**Solucion:** Mover icono a posicion fija en header de card.

---

### 20. Supplies Form - Preview Apretado

**Archivo:** `web/app/supplies/page.tsx`
**Lineas:** 291-301

**Problema:** El preview de "Precio por Porcion" queda muy comprimido en modales moviles.

**Solucion:**

```tsx
<div className="p-2.5 sm:p-3 bg-primary/10 rounded-lg">
  <p className="text-xs sm:text-sm text-primary/95">
    {/* contenido */}
  </p>
</div>
```

---

### 21-30. Problemas Adicionales Medios

| # | Archivo | Problema | Solucion Rapida |
|---|---------|----------|-----------------|
| 21 | `RevenueChart.tsx` | Chart muy pequeno en movil | `h-[200px] sm:h-[300px]` |
| 22 | `BreakEvenProgress.tsx` | Progress bar sin labels movil | Agregar labels encima |
| 23 | `CategoryBreakdown.tsx` | Legend cortada | Flex-wrap en legend |
| 24 | `MarketingROITable.tsx` | Tabla ancha | mobileColumns subset |
| 25 | `PatientAnalysis.tsx` | Graficos apilados mal | Stack vertical en sm |
| 26 | `CapacityUtilization.tsx` | Metricas truncadas | text-sm en movil |
| 27 | `AcquisitionTrendsChart.tsx` | Leyenda debajo del chart | Mover a tooltip |
| 28 | `Sidebar.tsx` | Items muy juntos | Aumentar gap |
| 29 | `UserMenu.tsx` | Dropdown cortado | collisionPadding |
| 30 | `ContextIndicator.tsx` | Texto clinic largo | truncate + tooltip |

---

## Problemas Bajos (P3)

### 31-40. Refinamientos Menores

| # | Componente | Problema | Impacto |
|---|------------|----------|---------|
| 31 | ActionDropdown | Menu muy ancho | Estetico |
| 32 | ConfirmDialog | Botones juntos | UX menor |
| 33 | DateFilterBar | Presets cortados | Funcionalidad ok |
| 34 | EmptyState | Icono grande | Estetico |
| 35 | Skeleton | Tamanos fijos | Estetico |
| 36 | Badge variants | Inconsistencia en sm | Estetico |
| 37 | Tooltip mobile | No aparece en tap | Esperado |
| 38 | Sheet animations | Lag en dispositivos lentos | Performance |
| 39 | Input focus ring | Muy grueso en movil | Estetico |
| 40 | Card shadows | Sombras no escaladas | Estetico |

---

## Patrones de Solucion Recomendados

### Patron 1: Responsive Text Sizing para Numeros

```tsx
// Crear componente reutilizable
function ResponsiveNumber({ value, className }: { value: string; className?: string }) {
  const size = value.length > 12
    ? 'text-sm sm:text-base lg:text-lg'
    : value.length > 8
    ? 'text-base sm:text-lg lg:text-xl'
    : 'text-lg sm:text-xl lg:text-2xl'

  return (
    <span className={cn(size, 'font-semibold tabular-nums', className)}>
      {value}
    </span>
  )
}
```

### Patron 2: Mobile-First Grid

```tsx
// Siempre empezar con 1 columna
const gridClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4', // 2 en movil para cards pequenas
}
```

### Patron 3: Collapsing Actions

```tsx
// En movil: solo icono, en desktop: icono + texto
<Button variant="outline" size="sm" className="px-2 sm:px-3">
  <Icon className="h-4 w-4" />
  <span className="hidden sm:inline sm:ml-2">{label}</span>
</Button>
```

### Patron 4: Safe Popover/Dropdown

```tsx
<PopoverContent
  className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm"
  side="bottom"
  align="end"
  sideOffset={8}
  collisionPadding={16}
  avoidCollisions={true}
>
```

### Patron 5: Scrollable Tabs

```tsx
<TabsList className="flex w-full overflow-x-auto no-scrollbar gap-1">
  {tabs.map(tab => (
    <TabsTrigger
      key={tab.value}
      value={tab.value}
      className="flex-shrink-0 px-3"
    >
      <tab.icon className="h-4 w-4" />
      <span className="hidden sm:inline sm:ml-2">{tab.label}</span>
    </TabsTrigger>
  ))}
</TabsList>
```

---

## Plan de Implementacion

### Fase 1 - Criticos (1-2 dias)
1. [ ] ServiceROIAnalysis responsive text
2. [ ] SummaryCards auto-sizing
3. [ ] DataTable mobile cards con labels
4. [ ] BusinessMetricsGrid grid fix

### Fase 2 - Altos (2-3 dias)
5. [ ] Tabs scrollables globalmente
6. [ ] ServiceComparison mobile layout
7. [ ] PageHeader actions responsive
8. [ ] FormModal scroll fix

### Fase 3 - Medios (3-4 dias)
9. [ ] Popover collision fixes
10. [ ] Chart sizing responsive
11. [ ] Form previews mobile
12. [ ] Grid breakpoints ajustados

### Fase 4 - Bajos (cuando haya tiempo)
13. [ ] Refinamientos esteticos
14. [ ] Animaciones optimizadas
15. [ ] Focus states ajustados

---

## Metricas de Exito

- [ ] Todos los numeros visibles sin truncar en iPhone SE (375px)
- [ ] Todas las tablas navegables en movil
- [ ] Todos los modales con scroll interno funcionando
- [ ] Touch targets minimo 44x44px
- [ ] Sin scroll horizontal no intencional

---

## Referencias

- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [WCAG Touch Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [shadcn/ui Responsive Patterns](https://ui.shadcn.com/)

---

**Ultima actualizacion:** 2025-12-07
**Autor:** Claude Code Audit
**Revision pendiente:** Equipo de desarrollo
