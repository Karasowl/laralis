---
id: TASK-20251021-marketing-categories
title: Implementar sistema de categorías de marketing para CAC
status: active
priority: P1
estimate: L
area: data
parent: null
links: []
---

# Sistema de Categorías de Marketing para CAC

## Contexto
El dashboard tiene un tab de Marketing que muestra métricas dummy. Necesitamos implementar el sistema completo para calcular CAC, LTV y ROI usando datos reales.

## Problema
1. No hay trigger para crear categorías automáticamente en clínicas nuevas
2. No existen endpoints de analytics para marketing
3. No hay gastos registrados en la base de datos
4. Dashboard muestra solo datos mock

## Solución Propuesta
Implementar sistema completo de categorías de marketing que:
- Se cree automáticamente con triggers
- Permita registrar gastos de marketing
- Calcule métricas reales (CAC, LTV, ROI)
- Persista entre resets de DB

## Subtasks

### 1. Migración SQL - Trigger de Categorías (P1, S)
- [ ] Crear `41_auto_create_clinic_categories.sql`
- [ ] Función `create_default_categories_for_clinic()`
- [ ] Trigger `after_clinic_insert` en tabla `clinics`
- [ ] Test: Crear clínica y verificar categorías

**Acceptance Criteria:**
- Al crear una clínica, se crean automáticamente patient_sources y custom_categories
- Las categorías del sistema (is_system=true) están disponibles globalmente
- No hay duplicados si se ejecuta múltiples veces

### 2. Endpoints de Marketing Analytics (P1, M)
- [ ] `/api/analytics/marketing-metrics` - CAC, LTV, Conversion
- [ ] `/api/analytics/cac-trend` - Tendencia de CAC por mes
- [ ] `/api/analytics/channel-roi` - ROI por canal

**Acceptance Criteria:**
- CAC = Gastos Marketing / Nuevos Pacientes del período
- LTV = Ingreso promedio por paciente × Retención promedio
- ROI = (Ingresos - Gastos) / Gastos × 100
- Manejo de división por cero
- Respuesta en formato consistente con otros endpoints

### 3. Motor de Cálculos de Marketing (P1, S)
- [ ] Crear `lib/calc/marketing.ts`
- [ ] Función `calculateCAC(expenses, newPatients)`
- [ ] Función `calculateLTV(revenue, patients, retention)`
- [ ] Función `calculateROI(revenue, investment)`
- [ ] Tests unitarios con 100% cobertura

**Acceptance Criteria:**
- Todas las funciones manejan cents (integers)
- División por cero retorna 0
- Tests cubren casos edge
- Documentación JSDoc completa

### 4. Formulario de Gastos con Categorías (P1, M)
- [ ] Crear `/app/expenses/components/ExpenseForm.tsx`
- [ ] Select de categorías dinámico
- [ ] Validación con Zod
- [ ] Integración con `useCrudOperations`

**Acceptance Criteria:**
- Dropdown muestra categorías del sistema
- Campo amount acepta decimales, guarda cents
- Fecha con datepicker HTML5
- Mensajes de éxito/error con toast

### 5. Actualizar Dashboard Marketing Tab (P1, M)
- [ ] Modificar `page.tsx` para usar endpoint real
- [ ] Hook `useMarketingMetrics()`
- [ ] Actualizar componentes para datos reales
- [ ] Loading states y error handling

**Acceptance Criteria:**
- Tab Marketing muestra datos reales de la DB
- Loading skeleton mientras carga
- Manejo de errores con mensaje friendly
- Actualización automática al agregar gastos

### 6. Seeds de Datos de Prueba (P2, XS)
- [ ] Script SQL con gastos de marketing de ejemplo
- [ ] Pacientes con source_id y campaign_id
- [ ] Tratamientos asociados para LTV

**Acceptance Criteria:**
- 10+ gastos de marketing variados
- 20+ pacientes con diferentes sources
- Datos realistas para demos

## Estimación Total
- **Complejidad**: L (Large)
- **Tiempo estimado**: 2-3 días
- **Dependencias**: Ninguna

## Riesgos
1. **Migración puede fallar** si hay datos inconsistentes
   - Mitigación: Verificar constraints antes de aplicar
2. **Performance** con muchos gastos
   - Mitigación: Índices en category_id y clinic_id

## Testing Plan
1. Crear clínica nueva → Verificar categorías creadas
2. Agregar gasto de marketing → Verificar CAC se actualiza
3. Agregar paciente nuevo → Verificar métricas cambian
4. Reset DB → Verificar categorías del sistema persisten

## Rollback Plan
1. Revertir migración SQL si falla
2. Dashboard vuelve a mostrar datos mock
3. No hay pérdida de datos críticos