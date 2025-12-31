# AI Knowledge Gaps - Información Crítica del Sistema

Este documento contiene conocimiento crítico del sistema que **NO es obvio** a partir de la documentación existente, pero que es esencial para que la IA entienda correctamente la arquitectura y lógica de negocio.

**Fecha de creación**: 2025-11-20
**Última actualización**: 2025-12-31

---

## 🔴 Gaps Críticos (P0)

### 0. Sistema de Roles y Permisos Multi-Usuario (NUEVO 2025-12-31)

**Problema**: La app ahora soporta múltiples usuarios con diferentes roles y permisos, pero esto no estaba documentado.

**Arquitectura de Permisos**:
```
Workspace (propietario)
├── workspace_users (rol a nivel workspace)
│   ├── owner (todo)
│   ├── super_admin (casi todo)
│   ├── admin (operaciones, sin finanzas)
│   ├── editor (crear/editar, sin borrar)
│   └── viewer (solo lectura)
│
└── Clinic (múltiples por workspace)
    └── clinic_users (rol específico en esa clínica)
        ├── admin, doctor, assistant, receptionist, viewer
```

**Flujo de Resolución de Permisos**:
```typescript
// Orden de prioridad (de mayor a menor)
1. ¿Es owner del workspace? → SÍ → Permitir todo
2. ¿Es super_admin? → SÍ → Permitir casi todo
3. ¿Tiene override en workspace_users.custom_permissions? → Usar override
4. ¿Tiene rol en clinic_users? → Usar permisos del rol clínica
5. Fallback → Usar permisos del rol workspace
```

**Verificación de Permisos en Código**:
```typescript
// Frontend - en componentes
import { usePermissions } from '@/hooks/use-permissions';
const { can, canAll, canAny, isSuperUser } = usePermissions();

if (can('patients.delete')) {
  // Mostrar botón de borrar
}

// Frontend - rendering condicional
import { Can, CanNot } from '@/components/auth';
<Can permission="expenses.view">
  <ExpensesSection />
</Can>

// Backend - en APIs (usar supabaseAdmin)
// Las funciones RPC están disponibles pero se recomienda
// verificar con resolveClinicContext + filtros explícitos
```

**Funciones RPC Disponibles**:
```sql
-- Verificar un permiso específico
SELECT check_user_permission(
  'user-uuid',
  'clinic-uuid',
  'patients',
  'delete'
); -- returns BOOLEAN

-- Wrapper con auth.uid() automático
SELECT has_permission('clinic-uuid', 'patients', 'delete');

-- Obtener todos los permisos de un usuario
SELECT get_user_permissions('user-uuid', 'clinic-uuid');
-- returns JSONB: {"patients.view": true, "expenses.view": false, ...}

-- Verificar si es miembro de clínica
SELECT is_clinic_member('clinic-uuid');
SELECT is_clinic_admin('clinic-uuid');
```

**Sistema de Invitaciones**:
```typescript
// Crear invitación
POST /api/invitations
{
  email: "user@example.com",
  role: "doctor", // o workspace role
  clinic_ids: ["uuid"], // opcional
  message: "Bienvenido al equipo"
}

// Token generado: 64 chars, expira en 7 días
// Link: /invite/[token]

// Flujo de aceptación:
// 1. Usuario visita /invite/[token]
// 2. Si no tiene cuenta → Signup → Aceptar
// 3. Si tiene cuenta → Login → Aceptar
// 4. Se crean workspace_users y/o clinic_users
```

**Ubicación de Archivos Críticos**:
- Hooks: `web/hooks/use-permissions.ts`, `use-workspace-members.ts`, `use-clinic-members.ts`
- Componentes: `web/components/auth/Can.tsx`, `PermissionGate.tsx`
- APIs: `web/app/api/team/*`, `web/app/api/permissions/*`, `web/app/api/invitations/*`
- UI: `web/app/settings/team/*`
- Migraciones: `70_granular_permissions_system.sql`, `71_seed_role_permissions.sql`, `72_fix_rls_clinic_memberships.sql`

**Por qué es crítico**:
- Toda la UI debe respetar permisos usando `<Can>` o `usePermissions()`
- APIs deben verificar permisos antes de operaciones sensibles
- Los roles determinan qué puede ver/hacer cada usuario
- El sistema es compatible hacia atrás (usuarios existentes = owner)

---

### 1. Multi-Tenancy: Resolución de Contexto de Clínica

**Problema**: La documentación explica que existe multi-tenancy pero no explica **CÓMO** se determina la clínica actual en las APIs.

**Realidad del Sistema**:
```typescript
// TODAS las APIs usan resolveClinicContext() para determinar la clínica
const clinicContext = await resolveClinicContext({
  requestedClinicId: searchParams.get('clinicId') || body?.clinic_id,
  cookieStore,
});
```

**Orden de prioridad para resolver clinic_id**:
1. **Query param explícito**: `?clinicId=xxx` en GET requests
2. **Body field**: `clinic_id` en POST/PUT requests
3. **Cookie**: `clinicId` cookie (set por UI)
4. **Auth context**: Primera clínica del usuario autenticado

**Por qué es crítico**: Si una API no usa `resolveClinicContext`, fallará con RLS errors o retornará datos incorrectos.

**Ubicación del código**: `web/lib/clinic.ts` (función `resolveClinicContext`)

---

### 2. Fixed Costs = Manual Fixed Costs + Asset Depreciation

**Problema**: La documentación menciona `fixed_costs` y `assets` como tablas separadas, pero no explica que se SUMAN para el cálculo del costo fijo total.

**Realidad del Sistema**:
```typescript
// Cálculo real en useTimeSettings y ClinicSnapshotService
const totalFixedCosts = fixedCosts.reduce((sum, cost) =>
  sum + (cost.amount_cents || 0), 0
) + assetsDepreciation

// Esto afecta el fixed_cost_per_minute_cents
fixedCostPerMinuteCents = totalFixedCosts / effectiveMinutesMonth
```

**Fórmula completa**:
```
Total Fixed Costs = SUM(fixed_costs.amount_cents) + SUM(assets.monthly_depreciation_cents)

Monthly Depreciation per Asset = purchase_price_cents / depreciation_months
```

**Por qué es crítico**:
- El costo por minuto es la base para calcular precios de servicios
- Si solo se consideran los fixed_costs manuales, los precios serán incorrectos
- Los activos SIEMPRE deben incluirse en el cálculo

**Archivos relevantes**:
- `web/hooks/use-time-settings.ts:84-87`
- `web/lib/ai/ClinicSnapshotService.ts:553-557`

---

### 3. Margin vs Markup: Confusión Semántica Crítica

**Problema**: El código usa el término `margin_pct` pero **NO ES MARGIN**, es **MARKUP**.

**Diferencia crítica**:
```typescript
// ❌ MARGIN (percentage of price)
margin = (price - cost) / price × 100

// ✅ MARKUP (percentage of cost) - LO QUE USA LA APP
markup = (price - cost) / cost × 100
```

**Ejemplo real**:
- Cost: $100
- Price: $150
- **Margin**: 33.3% (50/150)
- **Markup**: 50% (50/100) ← **Esto es lo que usa Laralis**

**Ubicación en código**:
```typescript
// lib/calc/tarifa.ts:108-121
export function calculateRequiredMargin(
  baseCostCents: number,
  targetPriceCents: number
): number {
  // Esta función retorna MARKUP, no margin
  return (targetPriceCents - baseCostCents) / baseCostCents;
}

// lib/ai/ClinicSnapshotService.ts:378-380
// IMPORTANT: margin_pct in the app is actually MARKUP, not margin!
// Formula: (Price - Cost) / Cost × 100 (NOT (Price - Cost) / Price)
const markup = totalCost > 0 ? ((price - totalCost) / totalCost) * 100 : 0
```

**Por qué es crítico**:
- Si la IA trata `margin_pct` como margin verdadero, los cálculos serán incorrectos
- Afecta pricing, análisis de rentabilidad, y punto de equilibrio
- Los usuarios esperan markup, no margin

**Recomendación**: Siempre leer `margin_pct` como "markup percentage" mentalmente.

---

### 4. Time Settings: Decimal vs Percentage Ambiguity

**Problema**: El campo `real_pct` puede estar en dos formatos diferentes dependiendo de la fuente.

**Realidad del Sistema**:
```typescript
// real_pct puede ser:
// 1. Decimal (0-1): 0.8 = 80%
// 2. Percentage (0-100): 80 = 80%

// Código de normalización en ClinicSnapshotService.ts:172-176
const rawRealPct = timeSettings?.real_pct ?? 0.8
// Si ≤ 1 → es decimal, usar directo
// Si > 1 → es porcentaje, dividir entre 100
const realPctFactor = rawRealPct <= 1 ? rawRealPct : rawRealPct / 100
const realPctDisplay = rawRealPct <= 1 ? rawRealPct * 100 : rawRealPct
```

**Heurística de detección**:
- `real_pct ≤ 1.0` → Es decimal (0.8 = 80%)
- `real_pct > 1.0` → Es porcentaje (80 = 80%)

**Por qué es crítico**:
- Cálculos de tiempo efectivo serán incorrectos si se interpreta mal
- Afecta costo por minuto y capacidad productiva
- Puede causar errores silenciosos (80% vs 0.8% es 100x diferencia)

**Ubicación**:
- Schema: `settings_time.real_pct` (numeric)
- Hook: `web/hooks/use-time-settings.ts:95-99`
- Service: `web/lib/ai/ClinicSnapshotService.ts:172-176`

---

### 5. Break-Even Calculation: Variable Costs from Services, NOT Expenses

**Problema**: Es intuitivo pensar que variable costs = expenses, pero **NO**.

**Realidad del Sistema**:
```typescript
// ❌ INCORRECTO
variable_costs = expenses.amount_cents

// ✅ CORRECTO
variable_costs = SUM(service.variable_cost_cents × treatments.count)

// Donde variable_cost_cents viene de:
variable_cost_cents = SUM(supply.cost_per_portion_cents × service_supplies.qty)
```

**Lógica de negocio**:
- **Variable costs**: Materiales directos (supplies) usados en servicios
- **Expenses**: Gastos operacionales (pueden incluir costos fijos y variables)
- **Break-even**: Se calcula solo con costos variables de SERVICIOS

**Fórmula completa**:
```
1. Total Variable Costs = SUM(service.variable_cost_cents × treatment.count)
2. Total Revenue = SUM(treatment.price_cents)
3. Variable Cost % = (Total Variable / Total Revenue) × 100
4. Contribution Margin % = 100 - Variable Cost %
5. Break-even Revenue = Total Fixed Costs ÷ (Contribution Margin % / 100)
6. Break-even Treatments = Break-even Revenue ÷ Avg Treatment Price
```

**Por qué es crítico**:
- Usar expenses en vez de service variable costs da resultados incorrectos
- El punto de equilibrio es una métrica crítica del negocio
- Afecta toda la lógica de análisis financiero

**Ubicación**: `web/lib/ai/ClinicSnapshotService.ts:562-596`

---

## 🟡 Gaps Importantes (P1)

### 6. Services Pricing: Depreciación de Tariffs Table

**Problema**: CLAUDE.md menciona que tariffs está deprecated, pero no explica el flujo de migración completo.

**Estado actual (v3)**:
```
❌ v2 (deprecated): services → tariffs (versioned prices) → treatments
✅ v3 (current):    services (price_cents + discounts) → treatments
```

**Campos críticos en services**:
```typescript
interface Service {
  price_cents: bigint        // SINGLE SOURCE OF TRUTH - final price with discount
  discount_type: 'none' | 'percentage' | 'fixed'
  discount_value: numeric    // % (0-100) or cents depending on type
  discount_reason: text      // Optional description
  margin_pct: numeric        // Actually MARKUP (see Gap #3)
}
```

**Migración completa**:
1. ✅ Discounts moved from tariffs → services (migration 46)
2. ✅ `price_cents` now stores final discounted price
3. ✅ Tariffs table marked DEPRECATED with SQL comment
4. ✅ RLS policies on tariffs changed to read-only
5. ⚠️ **Historical data**: Query treatments, NOT tariffs

**Queries correctos**:
```typescript
// ❌ NUNCA HACER ESTO (v2 legacy)
const tariff = await supabase
  .from('tariffs')
  .select('*')
  .eq('service_id', serviceId)
  .eq('is_active', true)

// ✅ CORRECTO (v3)
const service = await supabase
  .from('services')
  .select('*')
  .eq('id', serviceId)
  .single()
// price_cents ya incluye discount aplicado
```

**Por qué es crítico**:
- Queries a tariffs retornarán data obsoleta
- UI debe mostrar pricing desde services únicamente
- AI debe responder con "servicios" no "tarifas"

**Referencias**:
- `docs/database/SCHEMA-CURRENT.md` (v3 breaking changes)
- `docs/devlog/2025-11-17-tariff-to-service-architecture-migration.md`

---

### 7. RLS y supabaseAdmin: Por Qué No Usar Cliente Normal

**Problema**: El código usa `supabaseAdmin` en APIs, no cliente normal con RLS.

**Razón técnica**:
```typescript
// ❌ No funciona bien en APIs server-side
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, anonKey)

// ✅ Correcto para APIs
import { supabaseAdmin } from '@/lib/supabaseAdmin'
// Usa service-role key, bypasses RLS
```

**Pero entonces, ¿cómo funciona multi-tenancy?**
- RLS se simula mediante filtros explícitos: `.eq('clinic_id', clinicId)`
- `resolveClinicContext` asegura que solo se acceda a clínicas autorizadas
- El service-role key se necesita para triggers y operaciones admin

**Patrón estándar**:
```typescript
export async function GET(request: NextRequest) {
  // 1. Resolver contexto de clínica (verifica auth)
  const clinicContext = await resolveClinicContext({...})

  // 2. Usar supabaseAdmin con filtro explícito
  const { data } = await supabaseAdmin
    .from('table_name')
    .select('*')
    .eq('clinic_id', clinicContext.clinicId)  // ← Simula RLS
}
```

**Por qué es crítico**:
- No entender esto puede llevar a security issues
- Nuevas APIs deben seguir este patrón SIEMPRE
- RLS policies en DB son backup, no primary defense

---

### 8. Service Variable Cost Calculation: Supply Portions

**Problema**: No es obvio cómo se calculan los costos variables de servicios.

**Fórmula completa**:
```typescript
// 1. Cost per portion for each supply
supply.cost_per_portion_cents = supply.price_cents / supply.portions

// 2. Cost for service (recipe)
service.variable_cost_cents = SUM(
  supply.cost_per_portion_cents × service_supplies.qty
)
```

**Ejemplo real**:
```
Supply: Amalgama
- price_cents: 50000 ($500.00)
- portions: 100
- cost_per_portion: 500 cents ($5.00)

Service Recipe: Obturación
- service_supplies.qty: 2 (uses 2 portions)
- variable_cost: 1000 cents ($10.00)
```

**Edge cases**:
```typescript
// Si portions = 0 o null
cost_per_portion = 0  // Evita división por cero

// Si qty = 0
variable_cost += 0  // No contribuye al costo

// Si supply no existe (foreign key issue)
// Skip silently, no crash
```

**Por qué es crítico**:
- Base para pricing de servicios
- Afecta análisis de rentabilidad
- Errors en portions causan pricing incorrecto

**Ubicación**:
- `web/lib/ai/ClinicSnapshotService.ts:356-368`
- `web/app/api/services/[id]/cost/route.ts`

---

## 🔵 Gaps de Conveniencia (P2)

### 9. Hook Dependencies: Cascading Fetches

**Problema**: Algunos hooks dependen de datos de otros hooks, creando cascadas de fetches.

**Ejemplo: useTimeSettings**:
```typescript
// Fetch cascade:
// 1. Fetch time settings
const settingsApi = useApi('/api/settings/time')

// 2. Fetch fixed costs (en paralelo)
const fixedCostsApi = useApi('/api/fixed-costs')

// 3. Fetch assets (en paralelo)
const assetsApi = useApi('/api/assets/summary')

// 4. Calculate totalFixedCosts (derivado)
const totalFixedCosts = fixedCosts + assetsDepreciation

// 5. Calculate fixedCostPerMinuteCents (derivado final)
const fixedCostPerMinuteCents = totalFixedCosts / effectiveMinutes
```

**Por qué es importante**:
- Si faltan fixed_costs, el costo por minuto será 0
- Si faltan assets, la depreciación no se incluye
- No es obvio que time settings NECESITA fixed costs y assets para ser útil

**Recomendación**: Si trabajas con time settings, verificar que existan fixed_costs Y assets.

---

### 10. Clinic Onboarding: Auto-Created Data

**Problema**: No está documentado qué se crea automáticamente al crear una clínica.

**Reality Check**:
```sql
-- Trigger: after_clinic_insert
CREATE TRIGGER after_clinic_insert
AFTER INSERT ON clinics
FOR EACH ROW EXECUTE FUNCTION handle_new_clinic();

-- Auto-creates:
-- 1. 7 default patient_sources
INSERT INTO patient_sources (clinic_id, name) VALUES
  (NEW.id, 'Referral'),
  (NEW.id, 'Website'),
  (NEW.id, 'Social Media'),
  (NEW.id, 'Walk-in'),
  (NEW.id, 'Advertisement'),
  (NEW.id, 'Event'),
  (NEW.id, 'Other');

-- 2. 3 default custom_categories (service categories)
INSERT INTO custom_categories (clinic_id, name, type) VALUES
  (NEW.id, 'Preventive', 'service'),
  (NEW.id, 'Restorative', 'service'),
  (NEW.id, 'Surgical', 'service');
```

**Por qué es importante**:
- La UI asume que estas categorías existen
- Si el trigger falla, el onboarding se rompe
- Tests deben verificar que se crearon

**Ubicación**:
- Migration: `supabase/migrations/*_create_default_clinic_data_trigger.sql`
- Docs: `docs/database/SCHEMA-CURRENT.md:468-471`

---

### 11. Export/Import: Schema Versioning

**Problema**: El sistema de export/import tiene versionado de schema que no es obvio.

**Schema versioning**:
```typescript
interface ExportedData {
  version: string  // e.g., "1.0.0"
  exported_at: string
  clinic: { ... }
  tables: {
    patients: [...],
    treatments: [...],
    // ...
  }
}
```

**Compatibility**:
- Forward compatible: Newer app can import old exports
- Backward compatible: Migrations can upgrade old schemas
- Breaking changes increment major version

**Validation types** (8 total):
1. Structure validation (has required fields)
2. Type validation (field types correct)
3. Reference validation (foreign keys valid)
4. Data validation (business rules)
5. Checksum validation (SHA-256)
6. Size validation (reasonable sizes)
7. Schema version validation
8. Clinic ID validation

**Por qué es importante**:
- Exports pueden fallar silently si schema es incorrecto
- Imports pueden corromper data si validations fallan
- Migration logic está en `web/lib/export/migrations.ts`

---

### 12. ClinicSnapshotService: AI Context System

**Problema**: Existe un servicio completo para generar snapshots de clínicas para AI que no está documentado en CLAUDE.md.

**Purpose**: Dar contexto completo a Kimi K2 Thinking (o cualquier AI) para responder preguntas precisas sin decir "no data available".

**What it includes**:
```typescript
interface FullClinicSnapshot {
  app_schema: {
    version: string
    modules: {...}  // Descripción de todas las tablas
    business_formulas: {...}  // Fórmulas de negocio
  },
  clinic: {
    id: string
    name: string
    time_settings: TimeSettings
  },
  data: {
    patients: {...}
    treatments: {...}
    services: {...}   // Con pricing y costos calculados
    supplies: {...}
    assets: {...}
    expenses: {...}
    fixed_costs: {...}
  },
  analytics: {
    break_even: {...}         // Pre-calculado con metadata
    margins: {...}
    profitability: {...}
    efficiency: {...}
    top_performers: {...}
  }
}
```

**Key features**:
- **Pre-computes analytics**: No lazy calculations, todo está listo
- **Includes business formulas**: AI sabe cómo se calculan las métricas
- **Metadata rich**: Includes calculation warnings and data sources
- **Optimized JSON**: Removes nulls, rounds decimals

**Por qué es importante**:
- Si AI necesita "entender la clínica completamente", usar este servicio
- Es la fuente de verdad para análisis completo
- Tiene lógica correcta para todos los cálculos

**Ubicación**: `web/lib/ai/ClinicSnapshotService.ts`

---

## 🤖 Lara: La Asistente AI Integrada

**Problema**: Existe una asistente AI completa llamada "Lara" integrada en la app, pero no está documentada en CLAUDE.md.

### ¿Quién es Lara?

**Lara** es una asistente AI de voz integrada en Laralis que reduce el tiempo de entrada de datos en 60% mediante conversación natural.

**Ubicación en UI**: FAB (Floating Action Button) en esquina inferior derecha de todas las páginas.

### Arquitectura de Lara

```
┌─────────────────────────────────────────┐
│  FloatingAssistant (FAB button)         │
│  ├─ Entry Mode (crear registros)       │
│  └─ Query Mode (análisis y consultas)  │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│  AIService (lib/ai/service.ts)          │
│  ├─ transcribe(audio) → text            │
│  ├─ chat(messages) → response           │
│  ├─ queryDatabase(query) → insights     │
│  └─ speakText(text) → audio             │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│  AIProviderFactory (Strategy Pattern)   │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴─────────┬─────────────┐
    │                   │             │
┌───▼─────┐   ┌────────▼────┐   ┌────▼──────┐
│ STT     │   │ LLM         │   │ TTS       │
│2 options│   │3 options    │   │3 options  │
└─────────┘   └─────────────┘   └───────────┘
```

### Capabilities de Lara

**Entry Mode** (COMPLETE ✅):
- Crear registros mediante voz (14 entidades soportadas)
- Guía conversacional paso a paso
- Validación automática de campos
- Preview antes de guardar
- Reduce entrada de datos de 2 min → 48 seg

**Query Mode** (COMPLETE ✅):
- Análisis de datos mediante conversación
- Responde preguntas sobre finanzas, servicios, pacientes
- **Contexto completo**: Recibe snapshot de TODA la clínica (ClinicSnapshotService)
- Visualiza proceso de pensamiento (Kimi K2 Thinking)
- 8 analytics endpoints integrados

### Providers Actuales

**STT (Speech-to-Text)**:
- Deepgram Nova-3 (recommended)
- OpenAI Whisper

**LLM (Large Language Model)**:
- **Kimi K2 Thinking** (default) - Mejor razonamiento analítico
- GPT-4o-mini (OpenAI)
- DeepSeek V3 (budget option)

**TTS (Text-to-Speech)**:
- Deepgram Aura-2 (recommended)
- Fish Audio
- OpenAI TTS

**Configuración**: Via `.env.local` - cambiar provider sin tocar código

### Prompt System de Lara

**Entry Mode Prompt** (línea 198-212):
```typescript
`You are Lara, a helpful assistant for a dental clinic management
system called Laralis. Your goal is to help the user fill out the
"${formName}" form...`
```

**Query Mode Prompt** (línea 214-344):
- **Recibe contexto completo de clínica** (snapshot de 30 días)
- Servicios con breakdown de costos (fijo, variable, total)
- Tratamientos, pacientes, gastos, insumos
- **Analytics pre-calculadas**: break-even, márgenes, rentabilidad
- **Instrucciones específicas**: Siempre citar números reales, nunca decir "no tengo información"

### Sistema de Snapshot para Lara (CRÍTICO)

**Por qué es importante**: Lara NO usa function calling para consultar datos. En su lugar, recibe un **snapshot completo** de la clínica en el system prompt.

**Ventajas de este approach**:
1. ✅ **Más rápido**: 1 LLM call vs múltiples function calls
2. ✅ **Más barato**: Menos tokens totales
3. ✅ **Más inteligente**: Puede hacer análisis complejos cross-table
4. ✅ **Más confiable**: No hay "no tengo información disponible"

**Qué incluye el snapshot**:
```typescript
{
  app_schema: {
    modules: {...},           // Descripción de tablas
    business_formulas: {...}  // Fórmulas de negocio
  },
  clinic: {
    name: "...",
    time_settings: {...}      // Días, horas, productividad
  },
  data: {
    patients: {...},          // Agregados (total, new, active)
    treatments: {...},        // Agregados por servicio
    services: {...},          // CON costos calculados
    supplies: {...},
    expenses: {...},
    fixed_costs: {...},
    assets: {...},
    // NUEVOS: Registros completos para contexto AI (FIXED 2025-12-07)
    full_patients: [...],     // Lista de pacientes con nombre, teléfono, email, notas
    full_treatments: [...]    // Lista de citas con DATE, TIME, paciente, servicio, status, tooth_number
  },
  analytics: {
    break_even: {...},        // Pre-calculado
    margins: {...},
    profitability: {...},
    efficiency: {...},
    top_performers: {...}
  }
}
```

**Ubicación**: `lib/ai/ClinicSnapshotService.ts:91-149`

### Cómo Lara Calcula Break-Even (Ejemplo)

```typescript
// Sistema CORRECTO (línea 554-596)
1. Variable costs = SUM(service.variable_cost_cents × treatment.count)
2. Total revenue = SUM(treatment.price_cents)
3. Variable cost % = (Variable / Revenue) × 100
4. Contribution margin % = 100 - Variable cost %
5. Break-even revenue = Total Fixed Costs ÷ (Contribution margin % / 100)
6. Break-even treatments = Break-even revenue ÷ Avg treatment price

// IMPORTANTE: Detecta si hay suficiente historial
if (treatments < 10) {
  // Usa promedio de PRECIOS CONFIGURADOS en services
  // Advierte al usuario en el response
} else {
  // Usa promedio de PRECIOS REALES de treatments
}
```

### Diferencia vs Claude Code

**Claude Code (tú)**: Agente externo que ayuda con desarrollo
- Modifica código
- Crea migraciones
- Documenta features
- Usa tools como Read, Write, Edit

**Lara (AI interna)**: Asistente de usuario final dentro de la app
- Entrada de datos por voz
- Análisis de negocio
- Responde preguntas sobre la clínica
- No modifica código

**Ambos pueden leer docs**: Pero tienen roles completamente diferentes.

### Cost Analysis (Monthly)

**Recommended Stack** (100 entries/day):
- STT (Deepgram Nova-3): ~$20/mo
- TTS (Deepgram Aura-2): ~$14/mo
- LLM (Kimi K2 Thinking): ~$49/mo
- **Total: ~$83/mo**

**Budget Stack**:
- STT (Deepgram): $20/mo
- TTS (Deepgram): $14/mo
- LLM (DeepSeek V3): ~$17/mo
- **Total: ~$51/mo**

### Security Considerations

**API Keys**:
- ✅ Nunca expuestas al client
- ✅ Solo server-side routes tienen acceso
- ✅ Stored en `.env.local` (no commiteado)

**RLS Integration**:
- ✅ Query mode verifica clinic membership
- ✅ Usa `resolveClinicContext` como cualquier API
- ✅ Snapshot respeta multi-tenancy

**Audio Data**:
- ✅ Audio NO se almacena en servidor
- ✅ Transcripts NO se loggean (solo errors)
- ✅ Blob eliminado después de transcription

### Analytics Endpoints Disponibles (8)

Lara NO usa estos endpoints directamente (usa snapshot), pero están disponibles para UI:

1. `/api/analytics/revenue` - Revenue analysis
2. `/api/analytics/expenses` - Expense breakdown
3. `/api/analytics/services/top` - Top services
4. `/api/analytics/patients/stats` - Patient metrics
5. `/api/analytics/treatments/frequency` - Treatment patterns
6. `/api/analytics/compare` - Period comparison
7. `/api/analytics/inventory/alerts` - Stock alerts
8. `/api/analytics/break-even` - Profitability

### Translations para Lara

**Archivos**:
- `messages/ai-assistant.es.json` (~90 keys)
- `messages/ai-assistant.en.json` (~90 keys)

**Namespaces**:
- `ai.title`, `ai.entry_mode`, `ai.query_mode`
- `ai.entities.*` (14 entities)
- `ai.transcription.*`, `ai.recording.*`
- `ai.errors.*`

### Debugging Lara

**"Lara dice 'no tengo información'"**:
→ Check: ¿ClinicSnapshotService retorna data completa?
→ Check: ¿System prompt incluye el snapshot?
→ Check: ¿Hay datos en las tablas (services, treatments, etc.)?

**"Break-even calculation es incorrecto"**:
→ Check: ¿Se usa variable costs de services, NO expenses?
→ Check: ¿Fixed costs incluye depreciation?
→ Check: ¿Calculation metadata muestra el data source correcto?

**"STT no transcribe nada"**:
→ Check: ¿API key configurada en .env.local?
→ Check: ¿Provider correcto (AI_STT_PROVIDER)?
→ Check: ¿Browser permissions para mic?

**"LLM response es lento"**:
→ Check: ¿Model es K2 Thinking? (más lento pero mejor)
→ Option: Cambiar a moonshot-v1-32k o gpt-4o-mini
→ Check: ¿Snapshot es demasiado grande? (normal hasta ~50KB)

### Extensiones Futuras de Lara

**Phase 2** (opcional):
- [ ] Más analytics endpoints (20+ total)
- [ ] Visualizaciones de gráficos (line, bar, pie)
- [ ] Persistencia de conversación
- [ ] Conversaciones multi-turn con contexto
- [ ] Sugerencias inteligentes basadas en uso

**Documentación Completa**: `docs/AI-ASSISTANT.md`

---

## 📋 Checklist para Nuevas Features

Al agregar nuevas features, verificar:

### Multi-tenancy
- [ ] Usa `resolveClinicContext` en APIs
- [ ] Filtra por `clinic_id` en queries
- [ ] Cookie `clinicId` se maneja correctamente en UI

### Pricing/Costs
- [ ] Money SIEMPRE en cents (bigint)
- [ ] Fixed costs = manual + depreciation
- [ ] Margin = actually MARKUP (price - cost) / cost
- [ ] Pricing desde `services.price_cents`, NO desde tariffs

### Time Calculations
- [ ] Normaliza `real_pct` (puede ser decimal o percentage)
- [ ] Effective minutes = total × real_pct
- [ ] Fixed cost per minute = total fixed / effective minutes

### Business Logic
- [ ] Cálculos en `lib/calc/`, NO en componentes
- [ ] Variable costs desde services, NO desde expenses
- [ ] Tests unitarios para funciones de cálculo

### Data Integrity
- [ ] Validación con Zod schemas
- [ ] Handle null/undefined gracefully
- [ ] Foreign keys validated before insert

---

## 🔍 Debugging Tips

### "Fixed cost per minute is 0"
→ Check: ¿Existen fixed_costs Y assets en la clínica?
→ Check: ¿time_settings.real_pct > 0?
→ Check: ¿work_days y hours_per_day > 0?

### "Break-even calculation seems wrong"
→ Check: ¿Se usan variable costs de SERVICES, no de expenses?
→ Check: ¿Avg treatment price es correcto? (historical vs configured)
→ Check: ¿Contribution margin > 0?

### "Service pricing is incorrect"
→ Check: ¿Se suma depreciación a fixed costs?
→ Check: ¿margin_pct es tratado como MARKUP, no margin?
→ Check: ¿Variable costs calculados con supply portions correctas?

### "Multi-tenant data leak"
→ Check: ¿Todas las queries filtran por clinic_id?
→ Check: ¿resolveClinicContext retorna la clínica correcta?
→ Check: ¿Cookie clinicId está sincronizada?

### "RLS errors in API"
→ Check: ¿Usas supabaseAdmin, no cliente anon?
→ Check: ¿Filtras explícitamente por clinic_id?
→ Check: ¿resolveClinicContext se ejecuta antes de query?

### "Lara dice 'no tengo información sobre horarios'"
**FIXED 2025-12-07**: Este problema fue resuelto.

**Antes del fix**:
- `treatment_time` NO se cargaba en `loadFullTreatments()`
- `full_treatments` se cargaba pero NO se incluía en el prompt
- Lara solo veía agregados por servicio, no citas individuales

**Después del fix**:
- `treatment_time`, `tooth_number`, `is_paid` se cargan
- Nueva sección "DETAILED APPOINTMENT SCHEDULE" en el prompt
- Incluye análisis de "Most Popular Hours" y "Appointments by Day of Week"
- Lara ahora puede responder preguntas sobre horarios específicos

**Archivos modificados**:
- `web/lib/ai/ClinicSnapshotService.ts:600-640`
- `web/lib/ai/prompts/query-prompt.ts:320-376`

---

## 📚 Referencias Rápidas

### Archivos Críticos
- **Multi-tenancy**: `web/lib/clinic.ts`
- **Fixed costs calc**: `web/hooks/use-time-settings.ts:84-87`
- **Margin vs markup**: `web/lib/calc/tarifa.ts:108-121`
- **Break-even**: `web/lib/ai/ClinicSnapshotService.ts:562-596`
- **Service pricing**: `web/app/api/services/route.ts`

### Documentos Relacionados
- Schema actual: `docs/database/SCHEMA-CURRENT.md`
- Coding standards: `docs/CODING-STANDARDS.md`
- Migration guide: `docs/devlog/2025-11-17-tariff-to-service-architecture-migration.md`

---

**Mantenimiento**: Este documento debe actualizarse cuando:
1. Se descubren nuevos gaps de conocimiento
2. Cambia arquitectura fundamental (como deprecation de tariffs)
3. Se agregan nuevos sistemas críticos (como ClinicSnapshotService)
4. Hay confusiones recurrentes en PRs

**Última revisión**: 2025-12-07
