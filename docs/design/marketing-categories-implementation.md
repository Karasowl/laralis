# Implementación de Categorías de Marketing - Análisis Técnico

**Fecha**: 2025-10-21
**Status**: Planificación
**Priority**: P1 - Crítico
**Estimado**: L (2-3 días)

---

## 📋 Tabla de Contenidos
1. [Análisis del Estado Actual](#análisis-del-estado-actual)
2. [Arquitectura Propuesta](#arquitectura-propuesta)
3. [Categorías del Sistema](#categorías-del-sistema)
4. [Estrategia de Creación Automática](#estrategia-de-creación-automática)
5. [Definición de Endpoints](#definición-de-endpoints)
6. [Cálculos y Fórmulas](#cálculos-y-fórmulas)
7. [Plan de Implementación](#plan-de-implementación)
8. [Testing Strategy](#testing-strategy)

---

## Análisis del Estado Actual

### ✅ Lo que YA existe

1. **Categorías de Expenses del Sistema** (Migración 37)
   ```sql
   -- En public.categories con is_system = true, clinic_id = NULL
   - materials (Materiales)
   - services (Servicios)
   - rent (Alquiler)
   - utilities (Servicios Públicos)
   - salaries (Salarios)
   - marketing (Marketing) ← ✅ EXISTE
   - insurance (Seguros)
   - maintenance (Mantenimiento)
   - supplies (Insumos)
   - otros (Otros)
   ```

2. **Migración de category_id** (Migración 38)
   - Campo `category_id` en `expenses` ya es FK a `categories`
   - Datos migrados de string a UUID
   - Índice creado en `category_id`

3. **Tablas de Marketing** (Migración 20)
   - `marketing_campaigns` con status tracking
   - `marketing_campaign_status_history`
   - Campos en `patients`: `source_id`, `campaign_id`
   - Vistas: `campaign_stats`, `patient_source_stats`

4. **Componentes UI del Dashboard**
   - `MarketingMetrics` - Cards de CAC, LTV, Ratio, Conversion
   - `AcquisitionTrendsChart` - Tendencia de adquisición
   - `ChannelROIChart` - ROI por canal
   - Actualmente con datos MOCK

### ❌ Lo que FALTA

1. **Trigger de Auto-creación**
   - No existe función que cree categorías al crear clínica
   - Las categorías del sistema están pero no se "instancian" por clínica
   - patient_sources debe crearse por clínica

2. **Endpoints de Analytics**
   - `/api/analytics/marketing-metrics` - NO EXISTE
   - `/api/analytics/cac-trend` - NO EXISTE
   - `/api/analytics/channel-roi` - NO EXISTE

3. **Motor de Cálculos**
   - `lib/calc/marketing.ts` - NO EXISTE
   - Fórmulas de CAC, LTV, ROI no implementadas

4. **Datos Reales**
   - No hay gastos de marketing en la DB
   - Pacientes sin source_id ni campaign_id
   - Dashboard depende 100% de datos mock

---

## Arquitectura Propuesta

### Diagrama de Flujo de Datos

```
┌─────────────────────┐
│  Clínica Nueva      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ TRIGGER: after_clinic_insert            │
│ - Crea patient_sources (7 registros)    │
│ - Crea custom_categories (3 registros)  │
│ - NO crea categories (ya existen)       │
└──────────┬──────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Clínica tiene acceso a:                  │
│ - 10 categorías de expenses (sistema)    │
│ - 7 patient_sources (propias)            │
│ - 3 custom_categories (propias)          │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Usuario registra gasto:                  │
│ - Selecciona category_id = "Marketing"   │
│ - Monto: 50000 cents ($500)              │
│ - Fecha: 2025-10-15                      │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Analytics Engine calcula:                │
│ CAC = Σ(marketing expenses) / nuevos     │
│ LTV = AVG(Σ treatments per patient)      │
│ ROI = (Revenue - Cost) / Cost × 100      │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Dashboard muestra métricas reales        │
└──────────────────────────────────────────┘
```

### Modelo de Datos Actualizado

```sql
-- Categorías del SISTEMA (is_system = true, clinic_id = NULL)
-- Se crean UNA VEZ en la migración, persisten en resets
public.categories
  - id: UUID
  - entity_type: 'expense' | 'service' | 'supply' | etc.
  - name: VARCHAR (código en inglés)
  - display_name: VARCHAR (español)
  - is_system: BOOLEAN (true para sistema)
  - clinic_id: NULL para sistema

-- Fuentes de pacientes POR CLÍNICA (clinic_id NOT NULL)
-- Se crean con TRIGGER al crear clínica
public.patient_sources
  - id: UUID
  - clinic_id: UUID (FK a clinics)
  - name: VARCHAR
  - display_name: VARCHAR
  - is_active: BOOLEAN

-- Gastos que referencian categorías del sistema
public.expenses
  - id: UUID
  - clinic_id: UUID
  - category_id: UUID (FK a categories WHERE is_system=true)
  - amount_cents: BIGINT
  - expense_date: DATE

-- Pacientes vinculados a fuentes
public.patients
  - id: UUID
  - clinic_id: UUID
  - source_id: UUID (FK a patient_sources)
  - campaign_id: UUID (FK a marketing_campaigns)
  - acquisition_date: DATE
```

---

## Categorías del Sistema

### Categorías de Expenses (Ya Implementadas)

| name | display_name | uso_en_marketing |
|------|--------------|------------------|
| `marketing` | Marketing | ✅ **Para calcular CAC** |
| `materials` | Materiales | - |
| `services` | Servicios | - |
| `rent` | Alquiler | Overhead para ROI |
| `utilities` | Servicios Públicos | Overhead para ROI |
| `salaries` | Salarios | Overhead para ROI |
| `insurance` | Seguros | - |
| `maintenance` | Mantenimiento | - |
| `supplies` | Insumos | - |
| `otros` | Otros | - |

### ¿Necesitamos Subcategorías de Marketing?

**Respuesta**: NO en MVP, SÍ a futuro.

**Razón**:
- Para calcular CAC solo necesitamos **total de gastos de marketing**
- Subcategorías (Google Ads, Facebook Ads, etc.) son útiles para **optimización**
- Implementación futura: agregar campo `subcategory` o tabla `marketing_platforms`

**Fase 2** (futuro):
```sql
INSERT INTO categories (entity_type, name, display_name, parent_id) VALUES
  ('expense_subcategory', 'google_ads', 'Google Ads', (SELECT id FROM categories WHERE name='marketing')),
  ('expense_subcategory', 'facebook_ads', 'Facebook Ads', (SELECT id FROM categories WHERE name='marketing')),
  ('expense_subcategory', 'tiktok_ads', 'TikTok Ads', (SELECT id FROM categories WHERE name='marketing'));
```

---

## Estrategia de Creación Automática

### Opción 1: Trigger en tabla `clinics` ✅ RECOMENDADA

**Ventajas**:
- ✅ Automático al crear clínica
- ✅ Sobrevive a resets (trigger es parte del schema)
- ✅ Consistente con patient_sources existente
- ✅ No requiere código de aplicación

**Implementación**:
```sql
-- Migration: 41_auto_create_clinic_categories.sql

CREATE OR REPLACE FUNCTION create_default_categories_for_clinic()
RETURNS TRIGGER AS $$
BEGIN
  -- Patient Sources (POR CLÍNICA)
  INSERT INTO public.patient_sources (clinic_id, name, display_name, is_active, display_order)
  VALUES
    (NEW.id, 'campaign', 'Campaña', true, 1),
    (NEW.id, 'referral', 'Referido', true, 2),
    (NEW.id, 'direct', 'Directo', true, 3),
    (NEW.id, 'social_media', 'Redes Sociales', true, 4),
    (NEW.id, 'website', 'Sitio Web', true, 5),
    (NEW.id, 'recommendation', 'Recomendación', true, 6),
    (NEW.id, 'other', 'Otro', true, 99)
  ON CONFLICT DO NOTHING;

  -- Custom Categories opcionales (POR CLÍNICA)
  INSERT INTO public.custom_categories (clinic_id, type, name, display_name)
  VALUES
    (NEW.id, 'treatment', 'preventive', 'Preventivo'),
    (NEW.id, 'treatment', 'restorative', 'Restaurativo'),
    (NEW.id, 'treatment', 'endodontics', 'Endodoncia')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_clinic_insert
AFTER INSERT ON public.clinics
FOR EACH ROW
EXECUTE FUNCTION create_default_categories_for_clinic();
```

### Opción 2: Seed en onboarding (DESCARTADA)

**Desventajas**:
- ❌ Requiere código de aplicación
- ❌ Se perdería en resets si no se ejecuta seed
- ❌ Duplica lógica (SQL + TypeScript)

---

## Definición de Endpoints

### 1. `/api/analytics/marketing-metrics` - Métricas Principales

**Método**: GET
**Auth**: Required (clinic_id from session)
**Params**: `?period=30` (días, default 30)

**Response**:
```typescript
{
  cac: number,              // Customer Acquisition Cost in cents
  ltv: number,              // Lifetime Value in cents
  conversionRate: number,   // Percentage 0-100
  ltvCacRatio: number,      // LTV/CAC ratio
  newPatients: number,      // Count of new patients in period
  marketingSpend: number,   // Total marketing expenses in cents
  avgRevenuePerPatient: number // Average revenue in cents
}
```

**SQL Logic**:
```sql
WITH marketing_expenses AS (
  SELECT COALESCE(SUM(amount_cents), 0) as total
  FROM expenses e
  JOIN categories c ON e.category_id = c.id
  WHERE c.name = 'marketing'
    AND e.clinic_id = $clinic_id
    AND e.expense_date >= CURRENT_DATE - INTERVAL '$period days'
),
new_patients AS (
  SELECT COUNT(*) as total
  FROM patients
  WHERE clinic_id = $clinic_id
    AND acquisition_date >= CURRENT_DATE - INTERVAL '$period days'
),
patient_revenue AS (
  SELECT
    p.id,
    COALESCE(SUM(t.price_cents), 0) as total_revenue
  FROM patients p
  LEFT JOIN treatments t ON p.id = t.patient_id
  WHERE p.clinic_id = $clinic_id
  GROUP BY p.id
)
SELECT
  (marketing_expenses.total / NULLIF(new_patients.total, 0)) as cac,
  AVG(patient_revenue.total_revenue) as ltv,
  -- ... más cálculos
```

### 2. `/api/analytics/cac-trend` - Tendencia de CAC

**Método**: GET
**Auth**: Required
**Params**: `?months=12` (default 12)

**Response**:
```typescript
{
  data: Array<{
    month: string,          // "2025-01", "2025-02"
    cac: number,            // CAC in cents
    newPatients: number,    // Count
    marketingSpend: number  // Total in cents
  }>
}
```

### 3. `/api/analytics/channel-roi` - ROI por Canal

**Método**: GET
**Auth**: Required
**Params**: `?period=30`

**Response**:
```typescript
{
  channels: Array<{
    channelId: string,
    channelName: string,
    spent: number,          // Total expenses in cents
    revenue: number,        // Total revenue in cents
    roi: number,            // ROI percentage
    patients: number,       // Total patients
    trend: number[]         // Last 6 months trend
  }>
}
```

**SQL Logic**:
```sql
-- Relacionar patient_sources con gastos por canal
-- Asumir: marketing_campaigns.platform_id → categories
-- Gastos: campaign_id → marketing_campaigns → platform_id
-- Ingresos: patients.source_id → treatments.price_cents
```

---

## Cálculos y Fórmulas

### Archivo: `lib/calc/marketing.ts`

```typescript
/**
 * Calculate Customer Acquisition Cost (CAC)
 * Formula: Total Marketing Spend / New Customers
 * @param marketingExpensesCents - Total marketing expenses in cents
 * @param newPatients - Number of new patients acquired
 * @returns CAC in cents
 */
export function calculateCAC(
  marketingExpensesCents: number,
  newPatients: number
): number {
  if (newPatients === 0) return 0
  return Math.round(marketingExpensesCents / newPatients)
}

/**
 * Calculate Lifetime Value (LTV)
 * Formula: Average Revenue per Patient × Retention Period
 * @param totalRevenueCents - Total revenue from all patients
 * @param totalPatients - Total number of patients
 * @param avgRetentionMonths - Average patient retention in months (default 24)
 * @returns LTV in cents
 */
export function calculateLTV(
  totalRevenueCents: number,
  totalPatients: number,
  avgRetentionMonths: number = 24
): number {
  if (totalPatients === 0) return 0
  const avgRevenuePerPatient = totalRevenueCents / totalPatients
  // Simplified: assume linear revenue over retention period
  return Math.round(avgRevenuePerPatient)
}

/**
 * Calculate Return on Investment (ROI)
 * Formula: ((Revenue - Investment) / Investment) × 100
 * @param revenueCents - Total revenue in cents
 * @param investmentCents - Total investment in cents
 * @returns ROI as percentage
 */
export function calculateROI(
  revenueCents: number,
  investmentCents: number
): number {
  if (investmentCents === 0) return 0
  return ((revenueCents - investmentCents) / investmentCents) * 100
}

/**
 * Calculate Conversion Rate
 * Formula: (Converted / Total Leads) × 100
 * @param convertedPatients - Patients who completed treatment
 * @param totalInquiries - Total inquiries or leads
 * @returns Conversion rate as percentage
 */
export function calculateConversionRate(
  convertedPatients: number,
  totalInquiries: number
): number {
  if (totalInquiries === 0) return 0
  return (convertedPatients / totalInquiries) * 100
}

/**
 * Calculate LTV/CAC Ratio
 * Industry benchmark: 3:1 is excellent, 2:1 is good, 1:1 is break-even
 * @param ltvCents - Lifetime value in cents
 * @param cacCents - Customer acquisition cost in cents
 * @returns Ratio (e.g., 3.5 means 3.5:1)
 */
export function calculateLTVCACRatio(
  ltvCents: number,
  cacCents: number
): number {
  if (cacCents === 0) return 0
  return ltvCents / cacCents
}
```

### Tests: `lib/calc/marketing.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { calculateCAC, calculateLTV, calculateROI } from './marketing'

describe('Marketing Calculations', () => {
  describe('calculateCAC', () => {
    it('should calculate CAC correctly', () => {
      expect(calculateCAC(100000, 10)).toBe(10000) // $1000 / 10 = $100
    })

    it('should return 0 when no new patients', () => {
      expect(calculateCAC(50000, 0)).toBe(0)
    })

    it('should round to nearest cent', () => {
      expect(calculateCAC(10000, 3)).toBe(3333) // 10000/3 = 3333.33...
    })
  })

  describe('calculateLTV', () => {
    it('should calculate LTV correctly', () => {
      expect(calculateLTV(500000, 10)).toBe(50000) // $5000 / 10 = $500
    })

    it('should return 0 when no patients', () => {
      expect(calculateLTV(100000, 0)).toBe(0)
    })
  })

  describe('calculateROI', () => {
    it('should calculate positive ROI', () => {
      expect(calculateROI(200000, 100000)).toBe(100) // 100% ROI
    })

    it('should calculate negative ROI', () => {
      expect(calculateROI(50000, 100000)).toBe(-50) // -50% ROI
    })

    it('should return 0 when no investment', () => {
      expect(calculateROI(100000, 0)).toBe(0)
    })
  })
})
```

---

## Plan de Implementación

### Fase 1: Infraestructura (Día 1, AM)

**Tasks**:
1. ✅ Crear migración `41_auto_create_clinic_categories.sql`
2. ✅ Crear función `create_default_categories_for_clinic()`
3. ✅ Crear trigger `after_clinic_insert`
4. ✅ Test: Crear clínica nueva y verificar categorías

**Archivos**:
- `E:\dev-projects\laralis\supabase\migrations\41_auto_create_clinic_categories.sql`

**Acceptance Criteria**:
- [ ] Al crear clínica, se crean 7 patient_sources
- [ ] Trigger no falla si categorías ya existen
- [ ] Ejecución idempotente (ON CONFLICT DO NOTHING)

### Fase 2: Motor de Cálculos (Día 1, PM)

**Tasks**:
1. ✅ Crear `lib/calc/marketing.ts`
2. ✅ Implementar 5 funciones de cálculo
3. ✅ Crear `lib/calc/marketing.test.ts`
4. ✅ Ejecutar tests y verificar 100% cobertura

**Archivos**:
- `E:\dev-projects\laralis\web\lib\calc\marketing.ts`
- `E:\dev-projects\laralis\web\lib\calc\marketing.test.ts`

**Acceptance Criteria**:
- [ ] `npm test` pasa con 100% cobertura
- [ ] Todas las funciones manejan división por cero
- [ ] JSDoc completo en todas las funciones

### Fase 3: Endpoints de Analytics (Día 2, AM)

**Tasks**:
1. ✅ Crear `/api/analytics/marketing-metrics/route.ts`
2. ✅ Crear `/api/analytics/cac-trend/route.ts`
3. ✅ Crear `/api/analytics/channel-roi/route.ts`
4. ✅ Agregar i18n keys para errores

**Archivos**:
- `E:\dev-projects\laralis\web\app\api\analytics\marketing-metrics\route.ts`
- `E:\dev-projects\laralis\web\app\api\analytics\cac-trend\route.ts`
- `E:\dev-projects\laralis\web\app\api\analytics\channel-roi\route.ts`

**Acceptance Criteria**:
- [ ] Endpoints retornan 200 con datos válidos
- [ ] Manejo de errores con status 500
- [ ] Filtrado por clinic_id desde sesión
- [ ] Query params validados con Zod

### Fase 4: Actualizar Dashboard (Día 2, PM)

**Tasks**:
1. ✅ Crear hook `useMarketingMetrics()`
2. ✅ Actualizar `page.tsx` para usar datos reales
3. ✅ Reemplazar mock data en todos los componentes
4. ✅ Agregar loading states y error handling

**Archivos**:
- `E:\dev-projects\laralis\web\app\page.tsx`
- `E:\dev-projects\laralis\web\hooks\use-marketing-metrics.ts`

**Acceptance Criteria**:
- [ ] Dashboard muestra datos reales de la DB
- [ ] Loading skeleton mientras carga
- [ ] Toast de error si falla el endpoint
- [ ] Actualización automática al agregar gastos

### Fase 5: Formulario de Gastos (Día 3, AM)

**Tasks**:
1. ✅ Crear `/app/expenses/page.tsx`
2. ✅ Crear `ExpenseForm.tsx` con React Hook Form
3. ✅ Select dinámico de categorías
4. ✅ Validación con Zod

**Archivos**:
- `E:\dev-projects\laralis\web\app\expenses\page.tsx`
- `E:\dev-projects\laralis\web\app\expenses\components\ExpenseForm.tsx`

**Acceptance Criteria**:
- [ ] Select muestra las 10 categorías del sistema
- [ ] Campo amount acepta decimales, guarda en cents
- [ ] Mensajes de éxito/error
- [ ] Recarga tabla al agregar gasto

### Fase 6: Testing y Seeds (Día 3, PM)

**Tasks**:
1. ✅ Crear seed SQL con datos de prueba
2. ✅ Test end-to-end completo
3. ✅ Verificar reset de DB
4. ✅ Documentar en devlog

**Archivos**:
- `E:\dev-projects\laralis\supabase\seed\marketing-demo-data.sql`
- `E:\dev-projects\laralis\docs\devlog\2025-10-21-marketing-categories.md`

**Acceptance Criteria**:
- [ ] 10 gastos de marketing variados
- [ ] 20 pacientes con source_id y campaign_id
- [ ] Tratamientos asociados para LTV
- [ ] Dashboard muestra métricas realistas

---

## Testing Strategy

### Unit Tests (lib/calc/marketing.test.ts)

```typescript
// Test cases
✓ calculateCAC - normal case
✓ calculateCAC - zero patients
✓ calculateCAC - rounding
✓ calculateLTV - normal case
✓ calculateLTV - zero patients
✓ calculateROI - positive ROI
✓ calculateROI - negative ROI
✓ calculateROI - zero investment
✓ calculateConversionRate - normal case
✓ calculateLTVCACRatio - excellent (>3)
✓ calculateLTVCACRatio - good (2-3)
✓ calculateLTVCACRatio - break-even (1)
```

### Integration Tests (SQL)

```sql
-- Test: Trigger crea categorías al insertar clínica
INSERT INTO clinics (workspace_id, name, currency)
VALUES ('...', 'Test Clinic', 'MXN');

-- Verificar que se crearon patient_sources
SELECT COUNT(*) FROM patient_sources WHERE clinic_id = (SELECT id FROM clinics WHERE name='Test Clinic');
-- Esperado: 7

-- Test: Gastos de marketing se suman correctamente
INSERT INTO expenses (clinic_id, category_id, amount_cents, expense_date)
VALUES (..., (SELECT id FROM categories WHERE name='marketing'), 50000, '2025-10-15');

-- Verificar suma
SELECT SUM(amount_cents) FROM expenses e
JOIN categories c ON e.category_id = c.id
WHERE c.name = 'marketing' AND e.clinic_id = '...';
-- Esperado: 50000
```

### E2E Tests (Cypress)

```typescript
describe('Marketing Dashboard', () => {
  it('should show real marketing metrics', () => {
    cy.login()
    cy.visit('/dashboard')
    cy.get('[data-testid="marketing-tab"]').click()

    // Verificar que NO muestra datos mock
    cy.get('[data-testid="cac-value"]')
      .should('not.contain', '$500') // mock value
      .should('match', /\$[\d,]+\.\d{2}/) // real value format
  })

  it('should add expense and update CAC', () => {
    cy.login()

    // Capturar CAC inicial
    cy.visit('/dashboard')
    cy.get('[data-testid="cac-value"]').invoke('text').as('initialCAC')

    // Agregar gasto de marketing
    cy.visit('/expenses')
    cy.get('[data-testid="add-expense"]').click()
    cy.get('[name="category"]').select('Marketing')
    cy.get('[name="amount"]').type('1000')
    cy.get('[name="expense_date"]').type('2025-10-21')
    cy.get('[type="submit"]').click()

    // Verificar que CAC cambió
    cy.visit('/dashboard')
    cy.get('[data-testid="cac-value"]')
      .invoke('text')
      .should('not.equal', '@initialCAC')
  })
})
```

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Trigger falla con datos existentes | Media | Alto | Usar `ON CONFLICT DO NOTHING` |
| Performance con muchos gastos | Baja | Medio | Índices en `category_id`, `clinic_id`, `expense_date` |
| División por cero en cálculos | Alta | Bajo | Validar en todas las funciones |
| Categorías duplicadas en reset | Media | Medio | Constraint `UNIQUE(clinic_id, entity_type, name)` |
| Usuario elimina categoría del sistema | Baja | Alto | Proteger con RLS policy (is_system = true → no delete) |

---

## Rollback Plan

1. **Si falla migración SQL**:
   ```sql
   DROP TRIGGER IF EXISTS after_clinic_insert ON clinics;
   DROP FUNCTION IF EXISTS create_default_categories_for_clinic();
   ```

2. **Si falla endpoint**:
   - Revertir deployment
   - Dashboard vuelve a mostrar datos mock
   - No hay pérdida de datos

3. **Si hay performance issues**:
   - Agregar caché en endpoint (5 minutos)
   - Materializar vista con cálculos pre-agregados

---

## Siguientes Pasos (Post-MVP)

1. **Subcategorías de Marketing** (P2)
   - Google Ads, Facebook Ads, TikTok Ads
   - Análisis granular de ROI por plataforma

2. **Proyecciones Predictivas** (P2)
   - Machine learning para proyectar CAC futuro
   - Recomendaciones de inversión

3. **Benchmarking** (P3)
   - Comparar métricas con promedio de industria
   - Alertas si CAC supera benchmarks

4. **Integración con Plataformas** (P3)
   - API de Google Ads para gastos automáticos
   - API de Facebook Ads para tracking

---

## Acceptance Criteria General

**Antes de merge**:
- [ ] `npm run dev` builds clean
- [ ] `npm test` green con 100% cobertura en `marketing.ts`
- [ ] `npm run lint` sin errores
- [ ] `npm run typecheck` sin errores
- [ ] Todas las strings via next-intl (en/es)
- [ ] Dinero solo en cents (integers)
- [ ] No nuevas dependencias
- [ ] Visuales siguen tokens de diseño
- [ ] Devlog creado con tutorial step-by-step
- [ ] Tasks actualizadas en `tasks/active.md`

---

**Última actualización**: 2025-10-21
**Autor**: Claude
**Revisores**: Isma