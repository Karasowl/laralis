---
id: TASK-20251209-dashboard-mega-refactor
title: Dashboard Mega Refactor - UI/UX, Filters, Data Integrity
status: active
priority: P0
estimate: XL
area: ui|data|calc|i18n
parent: null
links: []
---

# Dashboard Mega Refactor

Este documento contiene el desglose completo de problemas identificados en el Dashboard y módulos relacionados, organizados por área y prioridad.

## Resumen Ejecutivo

Se identificaron **45+ issues** en las siguientes áreas:
- **Meta Mensual / Break-Even**: 5 issues
- **Filtros de Fecha (DateFilterBar)**: 4 issues
- **UI/UX Mobile**: 12 issues
- **Datos y Cálculos**: 8 issues
- **Marketing Metrics**: 6 issues
- **Lara (AI)**: 3 issues
- **Gastos (Expenses)**: 7 issues
- **API/Caching**: 2 issues

---

## GRUPO A: Meta Mensual Configurable (P0)

### A1. Meta mensual debe ser configurable, no solo punto de equilibrio
**Problema**: Actualmente el progreso mensual solo muestra el punto de equilibrio. El usuario debería poder configurar una meta mensual personalizada.

**Solución**:
1. Agregar campo `monthly_goal_cents` en `settings_time` o crear nueva tabla `clinic_goals`
2. Crear slider/input en configuración para establecer meta mensual
3. El progreso debe mostrar:
   - Punto de equilibrio como marcador intermedio (con color diferente)
   - Meta mensual como objetivo final
   - Cuánto falta para punto de equilibrio
   - Cuánto falta para meta mensual

**Archivos a modificar**:
- `supabase/migrations/` - Nueva migración para `monthly_goal_cents`
- `web/app/settings/time/page.tsx` - Agregar configuración de meta
- `web/components/dashboard/BreakEvenProgress.tsx` - Rediseñar componente
- `web/hooks/use-equilibrium.ts` - Incluir meta mensual
- `messages/en.json`, `messages/es.json` - Nuevas traducciones

**Acceptance Criteria**:
- [ ] Usuario puede configurar meta mensual vía slider
- [ ] Break-even se muestra como marcador intermedio en la barra de progreso
- [ ] Se muestra cuánto falta para break-even Y para meta mensual
- [ ] Colores diferentes para cada hito

---

## GRUPO B: Filtros de Fecha No Funcionan (P0)

### B1. DateFilterBar: Granularidad y comparación no afectan nada
**Problema**: Los selectores "Desglose por día/semana/mes" y "Comparar con periodo anterior" no modifican ningún dato visible.

**Archivos afectados**:
- `web/components/dashboard/DateFilterBar.tsx`
- `web/app/page.tsx` (Dashboard principal)
- Todos los hooks que consumen `currentRange`

**Solución**:
1. Verificar que todos los componentes del dashboard reciban y usen `granularity` y `comparison`
2. Si el cambio afecta datos debajo, mover los controles más cerca de los datos afectados o mostrar indicador visual de qué cambia

### B2. Pacientes activos no respetan filtro de fecha
**Problema**: "Pacientes activos" siempre muestra 147 sin importar si selecciono "hoy", "esta semana" o "este mes".

**Solución**:
- Renombrar a "Pacientes atendidos en el periodo" cuando hay filtro activo
- Mantener "Pacientes activos (últimos 90 días)" como métrica separada
- Agregar "Pacientes fidelizados" (con X+ tratamientos en Y meses)

### B3. Múltiples componentes ignoran el filtro de fechas
**Problema identificado en código**: Los siguientes hooks NO usan `currentRange`:
- `useEquilibrium` - Siempre mes actual
- `useCACTrend` - Siempre últimos 12 meses
- `useAcquisitionTrends` - Siempre últimos 12 meses

**Solución**: Algunos de estos son intencionales (tendencias históricas), pero debe haber indicador visual claro.

---

## GRUPO C: UI/UX Mobile (P1)

### C1. Iconos se solapan con texto en modo "personalizado"
**Problema**: Al seleccionar "Personalizado" en DateFilterBar, los iconos de calendario se solapan con el texto de fecha.

### C2. Espacio excesivo entre título y contenido
**Problema**: En mobile hay demasiado espacio entre "Dashboard / Panel de control" y las primeras tarjetas.

### C3. Botón "Actualizar" mal posicionado
**Problema**: El botón está a la derecha creando espacio en blanco a la izquierda. En desktop está justificado pero en mobile se ve mal.

**Solución**: En mobile, botones de acción deben ser full-width o centrados.

### C4. Gráfico de pastel (CategoryBreakdown) - texto se superpone
**Problema**: En mobile el texto de las categorías se superpone.

### C5. Pacientes necesarios sin icono en mobile
**Problema**: La tarjeta "8 pacientes/día para punto de equilibrio" no tiene icono en mobile pero "Ticket promedio" sí lo tiene.

### C6. RecentActivity debería estar colapsada por defecto
**Problema**: Ocupa mucho espacio. Debería mostrar 1-2 items y expandir on-demand.

### C7. Tarjetas de métricas inconsistentes
**Problema**: No hay consistencia visual entre MetricCard en diferentes secciones (rentabilidad, marketing, etc.).

### C8. Botón actualizar no debería existir
**Problema**: El botón "Actualizar" no existe en ningún otro módulo. Si es necesario, debería estar en la barra lateral o superior globalmente.

---

## GRUPO D: Datos y Cálculos Incorrectos (P0)

### D1. Utilidad Bruta vs Ganancia Neta - sin explicación
**Problema**: No hay tooltip/info que explique:
- Qué es "Utilidad Bruta"
- Qué es "Ganancia Neta"
- Cómo se calculan
- Por qué son diferentes

**Solución**: Agregar icono de info (i) que al hacer click muestre desglose:
```
Utilidad Bruta = Ingresos - Costos Variables
= $X - $Y = $Z

Ganancia Neta = Utilidad Bruta - Costos Fijos - Depreciación
= $Z - $A - $B = $C
```

### D2. "Ganancia Total" en Rentabilidad - ambiguo
**Problema**: ¿Qué diferencia hay con "Ganancia Neta"? ¿Por qué hay ROI de 711% si la ganancia neta es -$11,822?

### D3. "Ventas Totales" debería ser "Tratamientos Totales"
**Problema**: Usamos "Tratamientos" en toda la app, no "Ventas".

### D4. Predicciones de ingreso inconsistentes
**Problema**:
- Periodo seleccionado: 1 semana
- Muestra: "Próximo mes: $1,470" y "Cierre del año: $1,470"
- No tiene sentido que sean iguales

### D5. "Período últimos 30 días" hardcodeado
**Problema**: En Rentabilidad aparece una tarjeta que dice "Periodo: últimos 30 días" aunque el filtro esté en "Esta semana".

### D6. Servicios más rentables - sin explicación del ROI
**Problema**: Dice "Consulta dental: 2174.5% ROI" pero no explica de dónde sale ese cálculo.

### D7. "K" en gráficos causa confusión
**Problema**: En gráficos de Ingresos vs Gastos, "$10K" puede parecer $10 millones en vez de $10,000.

**Solución**: Usar formato local: "$10,000" o "$10 mil"

### D8. Utilización de capacidad - datos confusos
**Problema**: "3h 28min de 8h disponibles" - ¿Es promedio? ¿Total? ¿Del periodo seleccionado?

---

## GRUPO E: Marketing Metrics Rotos (P0)

### E1. CAC (Costo por Adquisición) siempre en cero
**Problema**: A pesar de tener gastos con categoría Marketing, el CAC muestra $0.

**Causa probable**: El cálculo de CAC no está conectando con la tabla `expenses` filtrada por categoría "Marketing".

### E2. Iconos de info (CAC, LTV) no funcionan
**Problema**: Los iconos de información al lado de CAC y LTV:
- En mobile no responden al toque
- En desktop no muestran tooltip al hover
- Causan que el título se vea más pequeño y debajo del icono

### E3. Tasa de conversión leads-a-pacientes - dato inventado
**Problema**: Muestra 27.7% pero no hay forma de saber cuántos leads hay. No hay módulo de leads.

### E4. ROI por campaña muestra "Crea tu primera campaña"
**Problema**: Existen campañas con pacientes asignados pero el componente dice que no hay campañas.

**Archivos afectados**:
- `web/components/dashboard/CampaignROISection.tsx`
- `web/hooks/use-campaigns.ts`

### E5. CAC objetivo vs actual - datos hardcodeados
**Problema**: "CAC objetivo: $74, CAC actual: $0" - ¿De dónde sale el objetivo?

### E6. Tendencia de adquisición posiblemente hardcodeada
**Problema**: Los datos de tendencia no parecen reflejar datos reales.

---

## GRUPO F: Lara (AI Assistant) (P1)

### F1. Lara no tiene acceso a configuración de tiempo
**Problema**: Lara dice "22 días laborales" cuando la configuración tiene 20 días.

**Archivos afectados**:
- `web/lib/ai/ClinicSnapshotService.ts`
- `web/lib/ai/prompts/query-prompt.ts`

**Solución**: Verificar que `time_settings` se incluya correctamente en el snapshot.

### F2. Lara no calcula eficiencia/minutos desaprovechados
**Problema**: Debería poder calcular:
- Minutos productivos esperados = días × horas × productividad%
- Minutos reales usados = sum(tratamientos.duration)
- Eficiencia = reales / esperados

### F3. Productividad al 85% no se refleja en respuestas
**Problema**: La configuración dice 85% de tiempo real pero Lara no lo menciona en análisis.

---

## GRUPO G: Módulo de Gastos (P1)

### G1. Filtros de gastos son diferentes al resto de la app
**Problema**: Los filtros en Gastos usan un estilo antiguo diferente a Pacientes/Tratamientos.

**Solución**: Refactorizar `FiltersCard` para usar el mismo patrón de filtros modernos.

### G2. Alerta informativa molesta y no cerrable
**Problema**: El `<Alert>` con información sobre costos fijos ocupa espacio y no se puede cerrar.

**Solución**: Convertirlo en un tooltip/icono de info que se active on-demand.

### G3. Tipo de gasto y categoría redundantes
**Problema**: Hay "Categoría" y "Tipo de gasto" que son redundantes y confusos.

**Solución**:
1. Simplificar a una sola clasificación
2. Agregar toggle: "¿Este gasto corresponde a algo planificado?"
3. Si sí, selector de costo fijo o insumo existente
4. Si no, es gasto nuevo

### G4. Gastos recurrentes no se repiten automáticamente
**Problema**: El checkbox "Repetir en cada período" no tiene cron job implementado.

**Solución**: Implementar Vercel cron o similar para crear gastos recurrentes.

### G5. Inventario no existe
**Problema**: "Actualizar inventario con esta compra" no funciona porque no hay módulo de inventario.

### G6. Correlación gastos-planificado incompleta
**Problema**: No hay forma fácil de vincular un gasto con un costo fijo o insumo planificado.

### G7. MXN hardcodeado
**Problema**: El monto dice "MXN" hardcodeado. Debería ser configurable por clínica.

---

## GRUPO H: API y Caching (P2)

### H1. Datos se recargan al cambiar de módulo
**Problema**: Si cargo Pacientes, voy a Insights, y vuelvo a Pacientes, los datos se recargan.

**Solución**: Implementar cache con SWR o React Query, o usar Context global.

### H2. Botón de refresh global
**Problema**: Si decidimos mantener cache, necesitamos botón de refresh en sidebar/header.

---

## GRUPO I: Gastos Planeados vs Reales (P1)

### I1. Flecha indica dirección incorrecta
**Problema**: "Salario Dra. Lara: $8,000 → $0" implica que no se gastó, pero sí se pagó con otro concepto.

**Solución**: La correlación debe ser por monto aproximado + fecha, no por nombre exacto.

---

## Plan de Ejecución

### Fase 1: Críticos (P0) - Paralelo
1. **Agente 1**: GRUPO B - Filtros de fecha
2. **Agente 2**: GRUPO D - Cálculos y tooltips de información
3. **Agente 3**: GRUPO E - Marketing metrics
4. **Agente 4**: GRUPO A - Meta mensual configurable

### Fase 2: Importantes (P1) - Paralelo
5. **Agente 5**: GRUPO C - UI/UX Mobile
6. **Agente 6**: GRUPO F - Lara AI
7. **Agente 7**: GRUPO G - Módulo de Gastos

### Fase 3: Mejoras (P2)
8. **Agente 8**: GRUPO H - API Caching

---

## Notas Importantes

1. **No romper nada existente**: Cada cambio debe ser backward-compatible
2. **Migraciones Supabase**: Cualquier cambio de schema requiere migración
3. **i18n**: TODAS las strings nuevas en `messages/en.json` y `messages/es.json`
4. **Tests**: Funciones de cálculo en `lib/calc/` deben tener tests
5. **Mobile-first**: Diseñar primero para mobile, luego adaptar a desktop

---

Última actualización: 2025-12-09
