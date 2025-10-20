# Cómo Funciona Laralis - Documentación Completa

> **Versión:** 1.0
> **Fecha:** 2025-10-19
> **Audiencia:** Desarrolladores, stakeholders, y cualquier persona que necesite entender el sistema

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Problema que Resuelve](#problema-que-resuelve)
3. [Conceptos Fundamentales](#conceptos-fundamentales)
4. [El Motor de Cálculos - Explicación Completa](#el-motor-de-cálculos---explicación-completa)
5. [Arquitectura del Sistema](#arquitectura-del-sistema)
6. [Módulos Explicados](#módulos-explicados)
7. [Flujo de Datos Completo](#flujo-de-datos-completo)
8. [Ejemplo Real Paso a Paso](#ejemplo-real-paso-a-paso)
9. [Análisis Crítico: Fallos Lógicos Identificados](#análisis-crítico-fallos-lógicos-identificados)
10. [Glosario de Términos](#glosario-de-términos)

---

## Resumen Ejecutivo

**Laralis** es una aplicación de gestión dental que permite a dentistas y clínicas:
1. **Calcular el costo real** de cada procedimiento dental considerando todos los gastos (equipos, renta, salarios, materiales)
2. **Determinar precios rentables** aplicando márgenes de ganancia sobre costos reales
3. **Conocer su punto de equilibrio** financiero (cuánto deben facturar para no perder dinero)

### Los 3 Pilares del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    MOTOR DE CÁLCULOS                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. COSTO FIJO POR MINUTO                                  │
│     ↳ Depreciación de equipos + Gastos fijos mensuales    │
│     ↳ Dividido entre minutos de trabajo efectivos         │
│                                                             │
│  2. COSTO VARIABLE POR SERVICIO                            │
│     ↳ Suma de todos los materiales/insumos usados         │
│                                                             │
│  3. PRECIO FINAL                                           │
│     ↳ (Costo Fijo + Costo Variable) × (1 + Margen%)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Problema que Resuelve

### El Problema del Dentista

Un dentista típico enfrenta estos desafíos:

**Escenario Real:**
- Compró un autoclave por $7,500 pesos
- Paga renta de $3,000/mes
- Compra materiales dentales constantemente
- Trabaja ~20 días al mes, 7 horas por día
- Cobra $500 por una limpieza dental

**Preguntas sin respuesta:**
- ¿Ese precio de $500 cubre mis costos reales?
- ¿Cuánto del costo del autoclave está "oculto" en cada procedimiento?
- ¿Cuántas limpiezas necesito hacer al mes para cubrir la renta?
- ¿Estoy ganando o perdiendo dinero?

### La Solución de Laralis

Laralis responde todas estas preguntas automáticamente:

1. **Distribuye la inversión en equipos** a lo largo de su vida útil (depreciación)
2. **Calcula el costo por minuto** de mantener la clínica abierta
3. **Suma los materiales** usados en cada procedimiento
4. **Determina el precio mínimo** para no perder dinero
5. **Calcula el punto de equilibrio** mensual

---

## Conceptos Fundamentales

### 1. Todo el Dinero se Maneja en Centavos

**Regla de oro:** NUNCA usar decimales para dinero.

```typescript
// ❌ MAL - Errores de redondeo
const precio = 123.45;

// ✅ BIEN - Precisión absoluta
const precio_cents = 12345; // representa $123.45
```

**Razón:** Los números decimales tienen errores de precisión en JavaScript:
```javascript
0.1 + 0.2 === 0.30000000000000004 // true 😱
```

### 2. Depreciación Lineal

Los equipos dentales pierden valor con el tiempo. Laralis usa el método **línea recta**:

```
Depreciación Mensual = Precio de Compra ÷ Vida Útil en Meses

Ejemplo:
Autoclave: $7,500 pesos
Vida útil: 5 años (60 meses)
Depreciación mensual: $7,500 ÷ 60 = $125/mes
```

**Significado:** Cada mes, "pierdes" $125 del valor del autoclave. Este costo debe recuperarse cobrando en tus servicios.

### 3. Costos Fijos vs Variables

**Costos Fijos** (pagues o no pagues, siempre existen):
- Renta del consultorio
- Salarios del personal
- Luz, agua, internet
- Depreciación de equipos

**Costos Variables** (dependen de cada procedimiento):
- Guantes desechables
- Anestesia
- Resinas
- Materiales de impresión

### 4. Costo por Minuto

La clave de Laralis es convertir todos los costos fijos mensuales en un **costo por minuto**:

```
Ejemplo:
Costos fijos mensuales totales: $50,000
Días de trabajo al mes: 20 días
Horas por día: 7 horas
Eficiencia real: 75% (considerando pausas, retrasos, etc.)

Minutos totales teóricos: 20 × 7 × 60 = 8,400 minutos
Minutos efectivos: 8,400 × 0.75 = 6,300 minutos

Costo por minuto = $50,000 ÷ 6,300 = $7.94/minuto
```

### 5. Margen de Ganancia

El margen es el porcentaje de ganancia sobre el costo:

```
Costo base: $100
Margen: 60%
Ganancia: $100 × 0.60 = $60
Precio final: $100 + $60 = $160
```

---

## El Motor de Cálculos - Explicación Completa

El motor se divide en 5 módulos matemáticos puros ubicados en `web/lib/calc/`:

### 1. Módulo de Tiempo (`tiempo.ts`)

**Propósito:** Calcular cuántos minutos efectivos trabaja la clínica al mes.

**Funciones principales:**

```typescript
calculateTotalMinutesPerMonth(workDays, hoursPerDay)
// Ejemplo: 20 días × 7 horas × 60 minutos = 8,400 minutos

calculateEffectiveMinutesPerMonth(totalMinutes, efficiency)
// Ejemplo: 8,400 × 0.75 = 6,300 minutos efectivos

calculateFixedCostPerMinute(monthlyCosts, effectiveMinutes)
// Ejemplo: $50,000 ÷ 6,300 = $7.94/minuto
```

**Parámetros de entrada:**
- `workDaysPerMonth`: Días laborables (típicamente 20-22)
- `hoursPerDay`: Horas de consulta por día (típicamente 6-8)
- `effectiveWorkPercentage`: % de tiempo realmente productivo (0.7-0.8)

**Salida:**
- `fixedPerMinuteCents`: Costo fijo en centavos por cada minuto de trabajo

### 2. Módulo de Depreciación (`depreciacion.ts`)

**Propósito:** Calcular cuánto "cuesta" mensualmente cada equipo.

**Método usado:** Depreciación en línea recta

```typescript
calculateMonthlyDepreciation(totalInvestmentCents, depreciationMonths)
// Ejemplo: $750,000 centavos ÷ 60 meses = $12,500 centavos/mes

calculateAccumulatedDepreciation(monthlyDepreciation, currentMonth)
// Ejemplo: $12,500 × 24 meses = $300,000 acumulados

calculateBookValue(totalInvestment, accumulated)
// Ejemplo: $750,000 - $300,000 = $450,000 valor en libros
```

**Flujo:**
1. Se divide el precio de compra entre los meses de vida útil
2. Cada mes se "acumula" la depreciación
3. El valor en libros disminuye linealmente hasta llegar a $0

**Ejemplo visual:**
```
Mes 0:  Valor = $7,500  | Depreciación acumulada = $0
Mes 12: Valor = $6,000  | Depreciación acumulada = $1,500
Mes 24: Valor = $4,500  | Depreciación acumulada = $3,000
...
Mes 60: Valor = $0      | Depreciación acumulada = $7,500
```

### 3. Módulo de Costos Variables (`variable.ts`)

**Propósito:** Calcular el costo de materiales para un servicio.

**Conceptos clave:**

**Costo por Porción:**
```typescript
costPerPortion(supply)
// Ejemplo:
// Frasco de resina: $500 (50,000 centavos)
// Porciones: 20
// Costo por porción: 50,000 ÷ 20 = 2,500 centavos = $25
```

**Costo Variable del Servicio:**
```typescript
variableCostForService(recipe)
// Ejemplo: Restauración con resina
// - Resina: 1 porción × $25 = $25
// - Guantes: 2 porciones × $3 = $6
// - Anestesia: 0.5 porciones × $10 = $5
// Total variable: $36
```

**Funciones principales:**

```typescript
calculateVariableCost(supplies: SupplyUsage[]): number
// Suma: cantidad × costo_unitario para cada insumo

calculateVariableCostPercentage(variableCost, totalCost)
// Porcentaje que representa el costo variable del total

calculateTreatmentCost(minutes, fixedPerMinute, variableCost)
// Combina costos fijos y variables para un tratamiento
```

### 4. Módulo de Tarifas (`tarifa.ts`)

**Propósito:** Calcular el precio final de un servicio.

**Fórmula completa:**

```
1. Costo Fijo = Duración (minutos) × Costo por Minuto
2. Costo Base = Costo Fijo + Costo Variable
3. Margen = Costo Base × Porcentaje de Margen
4. Precio Final = Costo Base + Margen
```

**Ejemplo numérico:**

```typescript
// Entrada
const params = {
  durationMinutes: 60,           // 1 hora
  fixedPerMinuteCents: 794,      // $7.94/min
  variableCostCents: 3600,       // $36.00
  marginPercentage: 0.65         // 65% de margen
};

// Cálculo paso a paso
const fixedCost = 60 × 794 = 47,640 centavos = $476.40
const baseCost = 47,640 + 3,600 = 51,240 centavos = $512.40
const margin = 51,240 × 0.65 = 33,306 centavos = $333.06
const finalPrice = 51,240 + 33,306 = 84,546 centavos = $845.46

// Con redondeo opcional
const roundedPrice = 85,000 centavos = $850.00
```

**Funciones principales:**

```typescript
calculateFixedCost(minutes, ratePerMinute)
calculateBaseCost(fixedCost, variableCost)
calculateMargin(baseCost, marginPercentage)
calculateFinalPrice(baseCost, margin)
calculateTariff(params) // Calcula todo de una vez
```

### 5. Módulo de Punto de Equilibrio (`puntoEquilibrio.ts`)

**Propósito:** Determinar cuánto debe facturar la clínica para cubrir todos sus gastos.

**Concepto clave: Margen de Contribución**

```
Margen de Contribución = 1 - (Costo Variable % del Precio)

Ejemplo:
Si un servicio cuesta $100 y $35 son materiales:
Margen de contribución = 1 - 0.35 = 0.65 = 65%

Esto significa: por cada $100 que cobres, $65 quedan
para cubrir costos fijos y generar ganancia.
```

**Fórmula del Punto de Equilibrio:**

```
Ingreso Necesario = Costos Fijos Mensuales ÷ Margen de Contribución

Ejemplo:
Costos fijos: $50,000
Margen de contribución: 65%
Punto de equilibrio: $50,000 ÷ 0.65 = $76,923/mes
```

**Servicios Necesarios:**

```
Servicios = Ingreso Necesario ÷ Precio Promedio por Servicio

Ejemplo:
Punto de equilibrio: $76,923
Precio promedio: $500/servicio
Servicios necesarios: 76,923 ÷ 500 = 154 servicios/mes
Por día (20 días): 154 ÷ 20 = 7.7 ≈ 8 servicios/día
```

**Funciones principales:**

```typescript
calculateContributionMargin(variablePercentage)
calculateBreakEvenRevenue(fixedCosts, contributionMargin)
calculateRequiredServices(breakEvenRevenue, avgServicePrice)
calculateSafetyMargin(actualRevenue, breakEven) // Margen de seguridad
```

---

## Arquitectura del Sistema

### Stack Tecnológico

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND                          │
│  Next.js 14 (App Router) + React + TypeScript      │
│  TailwindCSS + shadcn/ui (componentes)             │
│  next-intl (i18n bilingüe: ES/EN)                  │
└─────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────┐
│                   API LAYER                         │
│  Route Handlers (/app/api/**/route.ts)             │
│  Validación con Zod                                 │
│  Autenticación y contexto multi-tenant             │
└─────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────┐
│               BUSINESS LOGIC                        │
│  Motor de cálculos (lib/calc/*.ts)                  │
│  Helpers de dinero (lib/money.ts)                   │
│  Funciones puras con tests unitarios                │
└─────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────┐
│                   DATABASE                          │
│  Supabase (PostgreSQL)                              │
│  RLS (Row Level Security) para multi-tenancy       │
│  Triggers automáticos para updated_at              │
└─────────────────────────────────────────────────────┘
```

### Principios de Diseño

1. **Server Components por defecto** - Solo client components donde hay interacción
2. **Lógica de negocio separada** - Nunca en componentes UI
3. **Dinero siempre en centavos** - Conversión solo en UI
4. **i18n obligatorio** - Cero strings hardcodeados
5. **Snapshots inmutables** - Los tratamientos guardan costos históricos

### Modelo Multi-Tenant

```
┌──────────────┐
│  Workspace   │  "Corporativo Dental SA"
└──────┬───────┘
       │
       ├─── Clínica 1 "Sucursal Norte"
       │    ├─── Pacientes
       │    ├─── Tratamientos
       │    ├─── Servicios
       │    ├─── Insumos
       │    ├─── Activos
       │    └─── Costos Fijos
       │
       └─── Clínica 2 "Sucursal Sur"
            ├─── (sus propios datos)
            └─── ...
```

**Características:**
- Cada clínica tiene datos completamente aislados
- RLS (Row Level Security) garantiza que cada usuario solo vea sus clínicas
- Un usuario puede pertenecer a múltiples clínicas
- Cada clínica tiene su propia configuración de tiempo y costos

---

## Módulos Explicados

### 1. Activos (Assets)

**¿Qué son?**
Equipamiento dental que se deprecia con el tiempo.

**Ejemplos:**
- Autoclaves
- Sillones dentales
- Rayos X digitales
- Computadoras
- Instrumental quirúrgico costoso

**Campos clave:**

```typescript
interface Asset {
  id: string;
  clinic_id: string;
  name: string;                    // "Autoclave Clase B"
  category: string;                // "Equipo de esterilización"
  purchase_date: Date;             // "2023-01-15"
  purchase_price_cents: number;    // 750000 ($7,500)
  depreciation_years: number;      // 5 años
  depreciation_months: number;     // 60 meses (generado)
  monthly_depreciation_cents: number; // 12500 ($125/mes)
}
```

**¿Por qué importan?**
La depreciación mensual de todos los activos se suma a los costos fijos mensuales.

**Cálculo automático:**
```sql
depreciation_months = depreciation_years × 12
monthly_depreciation_cents = purchase_price_cents ÷ depreciation_months
```

**Ejemplo:**
```
Activo: Rayos X Digital
Precio: $18,000
Vida útil: 5 años (60 meses)
Depreciación mensual: $18,000 ÷ 60 = $300/mes

Este $300/mes se añade automáticamente a tus costos fijos.
```

---

### 2. Costos Fijos (Fixed Costs)

**¿Qué son?**
Gastos mensuales recurrentes que NO dependen de cuántos pacientes atiendas.

**Categorías comunes:**

1. **Local:**
   - Renta
   - Luz
   - Agua
   - Internet
   - Teléfono
   - Mantenimiento

2. **Personal:**
   - Sueldo del dentista
   - Sueldo de asistente(s)
   - Contador
   - Recepcionista

3. **Provisiones:**
   - Material de oficina
   - Publicidad
   - Software/licencias
   - Seguros

**Campos clave:**

```typescript
interface FixedCost {
  id: string;
  clinic_id: string;
  category: string;      // "Local", "Personal", "Provisiones"
  concept: string;       // "Renta del consultorio"
  amount_cents: number;  // 300000 ($3,000)
  is_active: boolean;
}
```

**Cálculo del total:**

```typescript
// Endpoint: /api/fixed-costs
// Suma todos los fixed_costs activos
const manualFixedCosts = fixedCosts.reduce((sum, cost) =>
  sum + cost.amount_cents, 0
);

// Suma la depreciación de todos los activos
const assetsDepreciation = assets.reduce((sum, asset) =>
  sum + asset.monthly_depreciation_cents, 0
);

// Total de costos fijos mensuales
const totalFixedCosts = manualFixedCosts + assetsDepreciation;
```

---

### 3. Configuración de Tiempo (Settings Time)

**¿Qué es?**
Los parámetros que definen cuánto tiempo opera la clínica.

**Campos clave:**

```typescript
interface SettingsTime {
  clinic_id: string;
  work_days: number;          // 20 días/mes
  hours_per_day: number;      // 7 horas/día
  real_pct: number;           // 0.75 (75% eficiencia)

  // Calculados automáticamente:
  planned_hours_per_month: number;  // 20 × 7 = 140 horas
  real_hours_per_month: number;     // 140 × 0.75 = 105 horas
}
```

**¿Por qué el porcentaje de eficiencia?**

En la realidad, NO trabajas el 100% del tiempo:
- Tiempos muertos entre pacientes
- Cancelaciones
- Retrasos
- Pausas para comer
- Limpieza del consultorio

**Recomendaciones:**
- Clínica nueva: 60-70%
- Clínica establecida: 75-85%
- Clínica muy ocupada: 85-90%

**Impacto en el costo:**

```
Ejemplo con 100% eficiencia:
8,400 minutos/mes
Costo fijo: $50,000
Costo/minuto: $50,000 ÷ 8,400 = $5.95

Ejemplo con 75% eficiencia (REAL):
6,300 minutos efectivos
Costo fijo: $50,000
Costo/minuto: $50,000 ÷ 6,300 = $7.94

¡El costo por minuto aumenta 33% al considerar la realidad!
```

---

### 4. Insumos (Supplies)

**¿Qué son?**
Materiales consumibles que se usan en los procedimientos.

**Campos clave:**

```typescript
interface Supply {
  id: string;
  clinic_id: string;
  name: string;              // "Resina Fotopolimerizable 3M"
  category: string;          // "Materiales de restauración"
  presentation: string;      // "Jeringa 4g"
  price_cents: number;       // 50000 ($500)
  portions: number;          // 20 (usos/aplicaciones)

  // Calculado:
  cost_per_portion_cents: number; // 2500 ($25/porción)
}
```

**Concepto de "Porciones":**

Un frasco de resina no se usa completo en un solo tratamiento. Se divide en porciones:

```
Jeringa de resina: $500
Porciones: 20 aplicaciones
Costo por porción: $500 ÷ 20 = $25

Si un tratamiento usa 1 porción: cuesta $25
Si usa 0.5 porciones: cuesta $12.50
Si usa 2 porciones: cuesta $50
```

**Categorías comunes:**
- Anestésicos
- Materiales de restauración (resinas, amalgamas)
- Materiales de impresión
- Desechables (guantes, baberos, eyectores)
- Instrumental desechable
- Material de endodoncia
- Material de prótesis

---

### 5. Servicios (Services)

**¿Qué son?**
El catálogo de procedimientos que ofrece la clínica.

**Campos clave:**

```typescript
interface Service {
  id: string;
  clinic_id: string;
  name: string;                     // "Resina Compuesta"
  description: string;              // "Restauración con resina..."
  category: string;                 // "Restorative"
  est_minutes: number;              // 75 minutos estimados

  // Costos calculados:
  fixed_cost_per_minute_cents: number;  // Del settings_time
  variable_cost_cents: number;          // De la receta
  margin_pct: number;                   // 70% (como decimal: 0.70)
  price_cents: number;                  // Precio final calculado

  is_active: boolean;
}
```

**Relación con Insumos (Receta):**

Cada servicio tiene una "receta" que define qué insumos usa:

```typescript
// Tabla: service_supplies
interface ServiceSupply {
  service_id: string;
  supply_id: string;
  qty: number;  // Cantidad de porciones
}
```

**Ejemplo: Servicio "Resina Compuesta"**

```
Duración estimada: 75 minutos
Receta:
  - Resina fotopolimerizable: 1 porción × $25 = $25
  - Guantes: 2 porciones × $3 = $6
  - Anestesia: 0.5 porciones × $10 = $5
  - Eyector saliva: 2 porciones × $2 = $4

Costo variable total: $40

Costo fijo: 75 minutos × $7.94/min = $595.50
Costo base: $595.50 + $40 = $635.50
Margen (70%): $635.50 × 0.70 = $444.85
Precio final: $635.50 + $444.85 = $1,080.35
Redondeado: $1,100
```

**Categorías de servicios:**
- Preventive (limpiezas, selladores)
- Diagnostic (consultas, radiografías)
- Restorative (resinas, coronas)
- Surgery (extracciones, implantes)
- Endodontics (endodoncias)
- Orthodontics (brackets, alineadores)
- Prosthetics (prótesis, puentes)

---

### 6. Pacientes (Patients)

**¿Qué son?**
Registro de personas que reciben tratamientos.

**Campos clave:**

```typescript
interface Patient {
  id: string;
  clinic_id: string;

  // Información personal
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birth_date: Date;
  gender: string;

  // Dirección
  address: string;
  city: string;
  state: string;
  postal_code: string;

  // Información médica
  medical_history: string;
  allergies: string;
  medications: string;
  emergency_contact: string;
  emergency_phone: string;

  is_active: boolean;
}
```

**Regla de unicidad:**
Un email solo puede existir una vez por clínica (pero puede repetirse en diferentes clínicas).

---

### 7. Tratamientos (Treatments)

**¿Qué son?**
Registro de servicios realizados a pacientes. **Este es el corazón del sistema.**

**Campos clave:**

```typescript
interface Treatment {
  id: string;
  clinic_id: string;
  patient_id: string;
  service_id: string;

  // Fecha y duración
  treatment_date: Date;
  treatment_time: Time;
  duration_minutes: number;

  // SNAPSHOT INMUTABLE de costos
  fixed_cost_per_minute_cents: number;  // Costo/min al momento del tratamiento
  variable_cost_cents: number;          // Costo variable al momento
  margin_pct: number;                   // Margen aplicado
  price_cents: number;                  // Precio final cobrado
  snapshot_costs: JSON;                 // Detalle completo del cálculo

  // Estado
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes: string;
  completed_at: Date;
}
```

**¿Por qué "snapshot"?**

Los costos cambian con el tiempo:
- El costo por minuto varía si cambias la renta o compras equipos
- Los insumos cambian de precio
- Los márgenes se ajustan

**Problema sin snapshot:**
```
Enero 2024: Hiciste una endodoncia por $1,500
Marzo 2024: Subes precios 20%
Reportes: ¿La endodoncia de enero fue a $1,500 o a $1,800?
```

**Solución con snapshot:**
```typescript
{
  treatment_date: "2024-01-15",
  price_cents: 150000,  // $1,500 (FIJO, nunca cambia)
  snapshot_costs: {
    cost_per_minute_at_time: 794,  // $7.94 en ese momento
    variable_cost_at_time: 4500,   // $45 en ese momento
    margin_applied: 0.65,          // 65% de margen
    calculation_breakdown: {
      fixed_cost: 47640,
      variable_cost: 4500,
      base_cost: 52140,
      margin: 33891,
      final_price: 86031
    }
  }
}
```

**Estados del tratamiento:**

```
scheduled      → Agendado, aún no realizado
in_progress    → En proceso
completed      → Terminado (genera ingreso)
cancelled      → Cancelado (no genera ingreso)
```

**Validaciones importantes:**

1. **Antes de crear un tratamiento, debe existir:**
   - Configuración de tiempo (para calcular costo/minuto)
   - Al menos un costo fijo o activo (para tener costo/minuto > 0)
   - Receta del servicio (supplies asociados)

2. **Si el estado es "completed":**
   - Debe tener `price_cents > 0`
   - Se actualiza `completed_at`
   - Se ajusta `first_visit_date` del paciente si es su primer tratamiento

---

### 8. Gastos (Expenses)

**¿Qué son?**
Gastos extraordinarios que NO son costos fijos recurrentes.

**Campos clave:**

```typescript
interface Expense {
  id: string;
  clinic_id: string;

  expense_date: Date;
  category: string;           // "Marketing", "Mantenimiento", etc.
  subcategory: string;        // "Facebook Ads", "Reparación autoclave"
  description: string;
  amount_cents: number;

  // Proveedor
  vendor: string;
  invoice_number: string;

  // Estado
  is_recurring: boolean;      // ¿Se repite mensualmente?
  is_paid: boolean;
  payment_method: string;
}
```

**Diferencia con Fixed Costs:**

```
Fixed Cost:    Renta de $3,000 CADA MES (predecible)
Expense:       Reparación de sillón por $5,000 (extraordinario)

Fixed Cost:    Salario de asistente (mensual)
Expense:       Curso de capacitación (una vez)
```

**Categorías comunes:**
- Marketing (campañas, publicidad)
- Mantenimiento (reparaciones)
- Compra de insumos (inventario)
- Capacitación
- Legal/Contabilidad
- Viáticos

**Uso en reportes:**
Los gastos se registran para:
- Conocer el flujo de efectivo real
- Analizar ROI de marketing
- Calcular utilidad neta (ingresos - costos fijos - gastos)

---

### 9. Tarifas (Tariffs)

**¿Qué son?**
Versiones históricas de los precios de cada servicio.

**Campos clave:**

```typescript
interface Tariff {
  id: string;
  clinic_id: string;
  service_id: string;

  version: number;                      // 1, 2, 3...
  valid_from: Date;
  valid_until: Date | null;

  // Snapshot de costos
  fixed_cost_per_minute_cents: number;
  variable_cost_cents: number;
  margin_pct: number;
  price_cents: number;
  rounded_price_cents: number;

  is_active: boolean;
}
```

**¿Por qué versiones?**

Imagina que cambias tus precios cada 6 meses:

```
Tariff v1: Enero-Junio 2024
  Limpieza: $500
  Resina: $800

Tariff v2: Julio-Diciembre 2024
  Limpieza: $600 (+20%)
  Resina: $900 (+12.5%)

Tariff v3: Enero 2025
  Limpieza: $650
  Resina: $950
```

**Beneficios:**
1. Historial completo de cambios de precio
2. Análisis de tendencias
3. Justificación de aumentos (si tus costos subieron)
4. Auditoría

---

### 10. Punto de Equilibrio (Equilibrium)

**¿Qué es?**
Cálculo dinámico (no es una tabla) que responde: *"¿Cuánto necesito facturar este mes para no perder dinero?"*

**Endpoint:** `/api/equilibrium`

**Cálculo:**

```typescript
// 1. Sumar costos fijos
const manualFixed = sum(fixed_costs.amount_cents);
const depreciation = sum(assets.monthly_depreciation_cents);
const totalFixed = manualFixed + depreciation;

// 2. Determinar porcentaje de costo variable promedio
// (se puede pasar como parámetro o calcular de servicios)
const variablePct = 0.35; // 35% del precio es material

// 3. Calcular margen de contribución
const contributionMargin = 1 - variablePct; // 65%

// 4. Punto de equilibrio
const breakEven = totalFixed / contributionMargin;

// 5. Meta diaria
const dailyTarget = breakEven / work_days;
```

**Ejemplo numérico:**

```
Costos fijos: $50,000/mes
Costo variable promedio: 35% del precio
Margen de contribución: 65%

Punto de equilibrio: $50,000 ÷ 0.65 = $76,923/mes
Meta diaria (20 días): $76,923 ÷ 20 = $3,846/día
```

**Interpretación:**
- Si facturas **menos de $76,923/mes**: PIERDES dinero
- Si facturas **exactamente $76,923/mes**: No ganas ni pierdes (break even)
- Si facturas **más de $76,923/mes**: GANAS dinero

**Margen de seguridad:**

```typescript
const safetyMargin = breakEven × 1.2; // 20% arriba del break even
```

---

## Flujo de Datos Completo

### Diagrama General

```
┌─────────────────────────────────────────────────────────────────┐
│                    SETUP INICIAL (una vez)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Crear Workspace y Clínica                                  │
│  2. Configurar Tiempo (días/mes, horas/día, eficiencia)        │
│  3. Registrar Activos (equipos con depreciación)               │
│  4. Registrar Costos Fijos (renta, salarios, etc.)             │
│     ↓                                                           │
│  [CÁLCULO AUTOMÁTICO: Costo por Minuto]                        │
│     ↓                                                           │
│  5. Registrar Insumos (materiales con porciones)               │
│  6. Crear Servicios (procedimientos con recetas)               │
│     ↓                                                           │
│  [CÁLCULO AUTOMÁTICO: Precio sugerido para cada servicio]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    OPERACIÓN DIARIA                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Registrar Paciente (si es nuevo)                           │
│  2. Agendar Tratamiento (patient + service)                    │
│     ↓                                                           │
│  [SNAPSHOT: Se guarda costo/minuto y precio actual]            │
│     ↓                                                           │
│  3. Realizar Tratamiento (cambiar estado a "completed")        │
│     ↓                                                           │
│  [INGRESO: Se suma al revenue mensual]                         │
│                                                                 │
│  4. Registrar Gastos extraordinarios (si aplica)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ANÁLISIS Y REPORTES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  → Dashboard: Ingresos vs Meta diaria                          │
│  → Punto de Equilibrio: ¿Ya lo superaste este mes?            │
│  → Reportes: Servicios más rentables                          │
│  → Gráficas: Tendencias de ingresos                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Secuencia Detallada de Cálculos

**Paso 1: Configurar Tiempo**

```
Input:
  work_days = 20
  hours_per_day = 7
  real_pct = 0.75

Process:
  total_minutes = 20 × 7 × 60 = 8,400
  effective_minutes = 8,400 × 0.75 = 6,300

Output:
  effective_minutes_per_month = 6,300
```

**Paso 2: Sumar Costos Fijos Totales**

```
Input:
  fixed_costs = [
    { concept: "Renta", amount: 300000 },
    { concept: "Luz", amount: 25000 },
    { concept: "Salario", amount: 1200000 }
  ]
  assets = [
    { name: "Autoclave", monthly_depreciation: 12500 },
    { name: "Sillón", monthly_depreciation: 35714 }
  ]

Process:
  manual_fixed = 300000 + 25000 + 1200000 = 1,525,000
  depreciation = 12500 + 35714 = 48,214
  total_fixed = 1,525,000 + 48,214 = 1,573,214

Output:
  monthly_fixed_costs_cents = 1,573,214 ($15,732.14)
```

**Paso 3: Calcular Costo por Minuto**

```
Input:
  monthly_fixed_costs = 1,573,214 cents
  effective_minutes = 6,300

Process:
  cost_per_minute = 1,573,214 ÷ 6,300 = 249.7 cents

Output:
  fixed_per_minute_cents = 250 ($2.50/minuto)
```

**Paso 4: Calcular Costo Variable de un Servicio**

```
Input:
  service: "Limpieza Dental"
  recipe: [
    { supply: "Pasta profiláctica", qty: 1, cost_per_portion: 50 },
    { supply: "Guantes", qty: 2, cost_per_portion: 25 },
    { supply: "Hilo dental", qty: 0.5, cost_per_portion: 10 }
  ]

Process:
  variable_cost = (1 × 50) + (2 × 25) + (0.5 × 10)
                = 50 + 50 + 5
                = 105 cents

Output:
  variable_cost_cents = 105 ($1.05)
```

**Paso 5: Calcular Precio del Servicio**

```
Input:
  duration_minutes = 30
  fixed_per_minute_cents = 250
  variable_cost_cents = 105
  margin_percentage = 0.60 (60%)

Process:
  fixed_cost = 30 × 250 = 7,500 cents
  base_cost = 7,500 + 105 = 7,605 cents
  margin = 7,605 × 0.60 = 4,563 cents
  final_price = 7,605 + 4,563 = 12,168 cents

Output:
  price_cents = 12,168 ($121.68)
  rounded_price_cents = 12,000 ($120.00)
```

**Paso 6: Crear Tratamiento con Snapshot**

```
Input:
  patient_id = "uuid-123"
  service_id = "uuid-456"
  treatment_date = "2024-10-19"

Process:
  // Se copian los valores ACTUALES
  snapshot = {
    fixed_cost_per_minute_cents: 250,
    variable_cost_cents: 105,
    margin_pct: 60,
    price_cents: 12000,
    snapshot_costs: {
      fixed_cost: 7500,
      variable_cost: 105,
      base_cost: 7605,
      margin: 4563,
      final_price: 12168
    }
  }

Output:
  treatment_record creado con snapshot inmutable
```

**Paso 7: Calcular Punto de Equilibrio**

```
Input:
  total_fixed_costs = 1,573,214 cents
  variable_cost_percentage = 0.35 (35% del precio)

Process:
  contribution_margin = 1 - 0.35 = 0.65 (65%)
  break_even_revenue = 1,573,214 ÷ 0.65 = 2,420,329 cents
  daily_target = 2,420,329 ÷ 20 = 121,016 cents

Output:
  break_even_monthly = 2,420,329 cents ($24,203.29)
  daily_target = 121,016 cents ($1,210.16)
```

---

## Ejemplo Real Paso a Paso

### Escenario: Dra. María inaugura su consultorio

**Fecha:** 1 de enero de 2024

**Paso 1: Compra de Equipos**

```
Equipos comprados:
1. Autoclave Clase B: $7,500 (vida útil: 5 años)
2. Sillón dental: $25,000 (vida útil: 7 años)
3. Rayos X digital: $18,000 (vida útil: 5 años)

Total invertido: $50,500

Depreciación mensual:
1. Autoclave: $7,500 ÷ 60 meses = $125/mes
2. Sillón: $25,000 ÷ 84 meses = $297.62/mes
3. Rayos X: $18,000 ÷ 60 meses = $300/mes

Total depreciación: $722.62/mes
```

**Paso 2: Costos Fijos Mensuales**

```
Renta del consultorio:        $3,000
Luz:                          $250
Agua:                         $200
Internet:                     $500
Salario asistente:            $12,000
Material de oficina:          $300
Publicidad:                   $2,000
─────────────────────────────────────
Total costos fijos:           $18,250
+ Depreciación:               $722.62
─────────────────────────────────────
TOTAL MENSUAL:                $18,972.62
```

**Paso 3: Configuración de Tiempo**

```
Días de trabajo al mes:       20 días
Horas por día:                7 horas
Eficiencia real:              70% (es nueva, aún está generando clientes)

Minutos totales:              20 × 7 × 60 = 8,400 minutos
Minutos efectivos:            8,400 × 0.70 = 5,880 minutos

Costo por minuto:             $18,972.62 ÷ 5,880 = $3.23/minuto
```

**Paso 4: Registro de Insumos**

```
Insumo                    Precio    Porciones   Costo/Porción
────────────────────────────────────────────────────────────────
Resina 3M A2              $500      20          $25.00
Guantes (caja 100)        $300      100         $3.00
Anestesia (frasco)        $200      20          $10.00
Pasta profiláctica        $150      30          $5.00
Hilo dental               $100      20          $5.00
Eyector saliva (100u)     $200      100         $2.00
```

**Paso 5: Crear Servicios con Recetas**

**Servicio 1: Consulta de Valoración**
```
Duración: 30 minutos
Receta:
  - Guantes: 2 porciones × $3 = $6

Costo fijo: 30 min × $3.23 = $96.90
Costo variable: $6
Costo base: $96.90 + $6 = $102.90

Margen deseado: 50%
Ganancia: $102.90 × 0.50 = $51.45
Precio final: $102.90 + $51.45 = $154.35

PRECIO SUGERIDO: $150 (redondeado)
```

**Servicio 2: Limpieza Dental**
```
Duración: 60 minutos
Receta:
  - Pasta profiláctica: 1 porción × $5 = $5
  - Guantes: 2 porciones × $3 = $6
  - Hilo dental: 0.5 porciones × $5 = $2.50
  - Eyector: 2 porciones × $2 = $4

Costo fijo: 60 min × $3.23 = $193.80
Costo variable: $5 + $6 + $2.50 + $4 = $17.50
Costo base: $193.80 + $17.50 = $211.30

Margen deseado: 60%
Ganancia: $211.30 × 0.60 = $126.78
Precio final: $211.30 + $126.78 = $338.08

PRECIO SUGERIDO: $350 (redondeado)
```

**Servicio 3: Resina Compuesta**
```
Duración: 75 minutos
Receta:
  - Resina 3M: 1 porción × $25 = $25
  - Anestesia: 0.5 porciones × $10 = $5
  - Guantes: 2 porciones × $3 = $6
  - Eyector: 2 porciones × $2 = $4

Costo fijo: 75 min × $3.23 = $242.25
Costo variable: $25 + $5 + $6 + $4 = $40
Costo base: $242.25 + $40 = $282.25

Margen deseado: 70%
Ganancia: $282.25 × 0.70 = $197.58
Precio final: $282.25 + $197.58 = $479.83

PRECIO SUGERIDO: $500 (redondeado)
```

**Paso 6: Calcular Punto de Equilibrio**

```
Costos fijos mensuales: $18,972.62

Promedio ponderado de costo variable:
  Consulta: $6 ÷ $150 = 4%
  Limpieza: $17.50 ÷ $350 = 5%
  Resina: $40 ÷ $500 = 8%

  Promedio: ~6% costo variable

Margen de contribución: 100% - 6% = 94%

Punto de equilibrio: $18,972.62 ÷ 0.94 = $20,183.64/mes

Meta diaria (20 días): $20,183.64 ÷ 20 = $1,009.18/día
```

**Interpretación:**
- Dra. María necesita facturar **$1,009/día** para no perder dinero
- Con precio promedio de $333 ($150+$350+$500 ÷ 3), necesita **~3 pacientes/día**
- En un mes completo: **60 pacientes** (3 × 20 días)

**Paso 7: Primer Mes de Operación**

**Pacientes atendidos en enero:**

```
Día  | Paciente       | Servicio    | Precio  | Acumulado
─────────────────────────────────────────────────────────────
2    | Juan Pérez     | Consulta    | $150    | $150
2    | Ana López      | Limpieza    | $350    | $500
3    | Carlos Ruiz    | Resina      | $500    | $1,000
5    | María García   | Consulta    | $150    | $1,150
5    | Luis Torres    | Limpieza    | $350    | $1,500
...  | ...            | ...         | ...     | ...
31   | Rosa Martínez  | Resina      | $500    | $22,450
```

**Resultado del mes:**

```
Total facturado en enero:     $22,450
Punto de equilibrio:          $20,183.64
Margen de seguridad:          $22,450 - $20,183.64 = $2,266.36

Costos fijos:                 -$18,972.62
Costos variables (6%):        -$1,347 (6% de $22,450)
Gastos extraordinarios:       -$500 (compra adicional de insumos)
─────────────────────────────────────────────────────
UTILIDAD NETA:                $1,629.38 💰
```

**Análisis:**
- ✅ Superó el punto de equilibrio en el primer mes
- ✅ Generó utilidad neta de $1,629.38
- ✅ Atendió 65 pacientes (promedio 3.25/día)
- 📊 Margen de seguridad: 11.2% arriba del break even

**Paso 8: Mes 6 - Ajuste de Precios**

Después de 6 meses, Dra. María decide:
1. Aumentar eficiencia al 80% (ya tiene más clientes)
2. Subir precios 15% (costo de insumos aumentó 10%)

**Nuevo cálculo de costo/minuto:**

```
Minutos efectivos: 8,400 × 0.80 = 6,720 minutos
Costos fijos: $18,972.62 (igual)

Nuevo costo/minuto: $18,972.62 ÷ 6,720 = $2.82/minuto
(¡Bajó de $3.23 por mayor eficiencia!)
```

**Nuevos precios:**

```
Consulta:   $150 → $175 (+16.7%)
Limpieza:   $350 → $400 (+14.3%)
Resina:     $500 → $575 (+15%)
```

**Nuevo punto de equilibrio:**

```
Costos fijos: $18,972.62
Costo variable promedio: 6%
Margen contribución: 94%

Break even: $18,972.62 ÷ 0.94 = $20,183.64 (igual)
Precio promedio nuevo: $383
Pacientes necesarios: $20,183.64 ÷ $383 = 52.7 ≈ 53/mes
Por día: 53 ÷ 20 = 2.65 pacientes/día

¡Ahora necesita MENOS pacientes por día! 🎉
```

---

## Análisis Crítico: Fallos Lógicos Identificados

### 1. ❌ PROBLEMA: Costo por Minuto puede ser 0

**Ubicación:** `POST /api/treatments`

**Código problemático:**

```typescript
const cpm = effectiveMinutes > 0 && totalFixed > 0
  ? Math.round(totalFixed / effectiveMinutes)
  : 0;

if (cpm <= 0) {
  return NextResponse.json({
    error: 'precondition_failed',
    message: 'Cost per minute is not configured.'
  }, { status: 412 });
}
```

**Problema:**
Si una clínica NO tiene ningún activo Y NO tiene costos fijos, el costo por minuto es 0. La validación lo detecta, pero el mensaje es confuso.

**Escenario realista:**
- Un dentista freelance que renta espacio por hora en otra clínica
- NO tiene equipos propios
- NO paga renta fija

**Solución sugerida:**

```typescript
// Permitir costo/minuto = 0 si el usuario lo confirma explícitamente
// O requerir al menos UN costo fijo (aunque sea simbólico)

if (cpm <= 0 && !body.allow_zero_cost_per_minute) {
  return NextResponse.json({
    error: 'validation_warning',
    message: 'No fixed costs configured. Treatment will have zero fixed cost. Confirm?',
    warning_code: 'ZERO_FIXED_COST'
  }, { status: 422 });
}
```

### 2. ⚠️ INCONSISTENCIA: Porcentaje de Eficiencia

**Ubicación:** `POST /api/settings/time`

**Código:**

```typescript
const rawRealPct = body?.real_pct ?? body?.real_pct_decimal ?? body?.realPct ?? 0;
const real_pct = clamp(numberOrZero(rawRealPct), 0, 1);
```

**Problema:**
El sistema almacena `real_pct` como decimal (0.75 = 75%), pero la UI podría estar enviando porcentaje (75).

**Evidencia:**

```typescript
// En treatments route:
const rpDec = rp > 1 ? rp / 100 : rp; // tolera decimal o percent
```

Esta lógica "tolerante" indica que hay inconsistencia entre UI y backend.

**Solución sugerida:**

Estandarizar SIEMPRE como decimal en la base de datos:

```typescript
function normalizePercentage(value: any): number {
  const num = Number(value);
  if (num >= 0 && num <= 1) return num;      // Ya es decimal
  if (num > 1 && num <= 100) return num / 100; // Convertir de %
  throw new Error('Invalid percentage value');
}
```

### 3. ❌ FALLO LÓGICO: Receta Vacía Permitida

**Ubicación:** `POST /api/services`

**Problema:**
Se puede crear un servicio SIN receta (sin insumos), lo que resulta en `variable_cost_cents = 0`.

Esto es **técnicamente válido** para:
- Consultas que no usan materiales
- Servicios puramente intelectuales (diagnóstico)

Pero es **problemático** para:
- Servicios que DEBERÍAN tener receta (resinas, endodoncias)
- Cálculo del punto de equilibrio (asume que TODOS los servicios tienen costo variable)

**Solución sugerida:**

Añadir campo `requires_supplies: boolean` al servicio:

```typescript
interface Service {
  // ...
  requires_supplies: boolean;
  // ...
}

// En POST /api/services:
if (requires_supplies && (!supplies || supplies.length === 0)) {
  return NextResponse.json({
    error: 'validation_error',
    message: 'This service requires a recipe with supplies.'
  }, { status: 400 });
}
```

### 4. ⚠️ INCONSISTENCIA: Columnas de Duración

**Ubicación:** `treatments` table

**Evidencia:**

```typescript
// En GET /api/treatments:
minutes: (row.duration_minutes ?? row.minutes) ?? 0,
```

Esto sugiere que la tabla tiene AMBAS columnas: `minutes` y `duration_minutes`.

**Problema:**
- ¿Cuál es la fuente de verdad?
- ¿Pueden tener valores diferentes?
- ¿Por qué existen ambas?

**Solución:**

```sql
-- Migración para estandarizar
ALTER TABLE treatments
  RENAME COLUMN minutes TO duration_minutes_legacy;

-- Copiar datos si hay divergencia
UPDATE treatments
SET duration_minutes = COALESCE(duration_minutes, duration_minutes_legacy);

-- Eliminar columna legacy después de confirmar
ALTER TABLE treatments
  DROP COLUMN duration_minutes_legacy;
```

### 5. ❌ PROBLEMA: Margen de Ganancia Negativo

**Ubicación:** `lib/calc/tarifa.ts`

**Código:**

```typescript
export function calculateMargin(
  baseCostCents: number,
  marginPercentage: number
): number {
  if (marginPercentage < 0) {
    throw new Error('Margin percentage cannot be negative');
  }
  return Math.round(baseCostCents * marginPercentage);
}
```

**Problema:**
Solo valida que NO sea negativo, pero NO valida que sea razonable.

**Escenarios problemáticos:**
- Margin = 0% → No genera ganancia (solo recupera costos)
- Margin = 500% → Precio ridículamente alto
- Margin = 0.5% → Error del usuario (quiso decir 50%)

**Solución:**

```typescript
export function calculateMargin(
  baseCostCents: number,
  marginPercentage: number,
  options?: { minMargin?: number; maxMargin?: number }
): number {
  const min = options?.minMargin ?? 0;
  const max = options?.maxMargin ?? 3.0; // 300% máximo

  if (marginPercentage < min) {
    throw new Error(`Margin too low. Minimum: ${min * 100}%`);
  }
  if (marginPercentage > max) {
    throw new Error(`Margin too high. Maximum: ${max * 100}%`);
  }

  return Math.round(baseCostCents * marginPercentage);
}
```

### 6. ⚠️ DATO NO USADO: Snapshot Costs JSON

**Ubicación:** `treatments.snapshot_costs`

**Problema:**
El campo `snapshot_costs` se guarda pero aparentemente NO se usa en reportes ni análisis.

**Evidencia:**
```typescript
snapshot_costs: payloadBody.snapshot_costs || {}
```

Se almacena un objeto vacío por defecto.

**Preguntas:**
- ¿Qué debería contener exactamente?
- ¿Se usa para auditoría?
- ¿Por qué no hay validación de su estructura?

**Solución sugerida:**

Definir estructura clara:

```typescript
interface SnapshotCosts {
  calculation_date: string;
  cost_per_minute_source: 'settings_time' | 'manual';
  cost_breakdown: {
    fixed_cost_cents: number;
    variable_cost_cents: number;
    base_cost_cents: number;
    margin_cents: number;
    final_price_cents: number;
  };
  supplies_used: Array<{
    supply_id: string;
    supply_name: string;
    quantity: number;
    unit_cost_cents: number;
    total_cost_cents: number;
  }>;
  version: string; // Para tracking de cambios en el motor
}
```

### 7. ❌ FALLO: Redondeo de Precios Opcional

**Ubicación:** `lib/calc/tarifa.ts`

**Código:**

```typescript
if (params.roundingStepCents) {
  result.roundedPriceCents = roundToNearestStepCents(
    finalPriceCents,
    params.roundingStepCents
  );
}
```

**Problema:**
El redondeo es OPCIONAL. Esto significa que puedes tener:

```
Precio calculado: $845.46
Precio redondeado: (ninguno, es opcional)
```

En la UI, ¿qué precio se muestra?

**Escenario problemático:**
- Usuario espera ver precios "limpios" ($850 en lugar de $845.46)
- Pero el sistema puede mostrar $845.46 si no se especificó redondeo
- Inconsistencia entre lo que se calcula y lo que se cobra

**Solución:**

Siempre redondear a la unidad más cercana:

```typescript
const DEFAULT_ROUNDING_STEP = 100; // Redondear a pesos completos

const result: TariffResult = {
  // ...
  finalPriceCents,
  roundedPriceCents: roundToNearestStepCents(
    finalPriceCents,
    params.roundingStepCents ?? DEFAULT_ROUNDING_STEP
  )
};
```

### 8. ⚠️ INCONSISTENCIA: Status de Tratamiento

**Ubicación:** Enum de `treatments.status`

**Estados definidos:**

```typescript
status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
```

**Pero en el código:**

```typescript
// En GET /api/treatments:
status: (row.status === 'scheduled' || row.status === 'in_progress')
  ? 'pending'
  : (row.status || 'pending')

// En POST /api/treatments:
const normalizedStatus = (() => {
  const status = payloadBody.status;
  if (!status) return 'scheduled';
  return status === 'pending' ? 'scheduled' : status;
})();
```

**Problema:**
- UI envía `'pending'`
- Backend lo convierte a `'scheduled'`
- Backend almacena `'scheduled'` o `'in_progress'`
- GET devuelve `'pending'` si es `'scheduled'` o `'in_progress'`

**¡Círculo vicioso de conversiones!**

**Solución:**

Estandarizar en la base de datos:

```sql
ALTER TABLE treatments
  ALTER COLUMN status TYPE varchar(50),
  DROP CONSTRAINT IF EXISTS treatments_status_check,
  ADD CONSTRAINT treatments_status_check
    CHECK (status IN ('pending', 'completed', 'cancelled'));

-- Migrar datos existentes
UPDATE treatments
SET status = 'pending'
WHERE status IN ('scheduled', 'in_progress');
```

---

## Glosario de Términos

| Término | Definición | Ejemplo |
|---------|-----------|---------|
| **Centavos (cents)** | Unidad mínima de dinero. 1 peso = 100 centavos | 12345 cents = $123.45 |
| **Depreciación** | Pérdida de valor de un activo con el tiempo | Autoclave de $7,500 deprecia $125/mes en 5 años |
| **Costo Fijo** | Gasto que NO cambia según volumen de trabajo | Renta: $3,000/mes (atiendas 10 o 100 pacientes) |
| **Costo Variable** | Gasto que depende de cada procedimiento | Resina: $25 por tratamiento |
| **Costo Base** | Suma de costo fijo + costo variable | $476.40 (fijo) + $36 (variable) = $512.40 |
| **Margen** | Ganancia sobre el costo base | Costo $512.40 × 65% margen = $333.06 ganancia |
| **Precio Final** | Costo base + margen | $512.40 + $333.06 = $845.46 |
| **Porción** | Fracción de un insumo usada en un procedimiento | Frasco de resina: 20 porciones |
| **Receta** | Lista de insumos que requiere un servicio | Limpieza: pasta + guantes + hilo |
| **Snapshot** | Foto inmutable de costos al momento del tratamiento | Tratamiento del 15/01/24 siempre valdrá $1,500 |
| **Punto de Equilibrio** | Ingreso mínimo para NO perder dinero | $76,923/mes (ni ganas ni pierdes) |
| **Margen de Contribución** | Porcentaje del precio que cubre costos fijos | Si 35% es material, 65% es contribución |
| **Eficiencia (real_pct)** | % del tiempo que realmente trabajas productivamente | 75% = 6,300 de 8,400 minutos |
| **RLS** | Row Level Security - seguridad a nivel de fila en BD | Un usuario solo ve sus clínicas |
| **Multi-tenant** | Múltiples clínicas en la misma aplicación | Workspace → Clínica 1, Clínica 2... |

---

## Conclusiones y Próximos Pasos

### Lo que Funciona Bien ✅

1. **Motor de cálculos sólido** - Las funciones en `lib/calc/` son puras, probadas y correctas
2. **Separación clara** - Lógica de negocio separada de UI
3. **Snapshots inmutables** - Los tratamientos preservan costos históricos
4. **Multi-tenancy robusto** - RLS garantiza aislamiento de datos
5. **Manejo de dinero correcto** - Todo en centavos, sin errores de redondeo

### Áreas de Mejora ⚠️

1. **Validaciones inconsistentes** - Algunas reglas de negocio no se validan adecuadamente
2. **Campos legacy** - Duplicación de columnas (minutes vs duration_minutes)
3. **Conversiones status** - Mapeo innecesario entre 'pending' y 'scheduled'
4. **Datos no usados** - `snapshot_costs` se guarda vacío
5. **Mensajes de error** - Algunos son técnicos, deberían ser más amigables

### Fallos Críticos a Resolver 🔴

1. **Costo por minuto = 0** - Permitir pero con confirmación explícita
2. **Receta vacía en servicios** - Validar según tipo de servicio
3. **Margen sin límites** - Establecer rangos razonables (10%-300%)
4. **Redondeo opcional** - Siempre redondear a pesos completos

### Recomendaciones de Mejora

1. **Agregar campo `service_type`:**
   ```typescript
   type ServiceType = 'consultation' | 'procedure' | 'surgery';
   // consultation: puede no tener receta
   // procedure/surgery: requiere receta obligatoriamente
   ```

2. **Crear migración de limpieza:**
   - Eliminar columnas duplicadas
   - Estandarizar enums (status)
   - Normalizar porcentajes (siempre decimal 0-1)

3. **Mejorar snapshot_costs:**
   - Definir interfaz clara
   - Validar estructura al guardar
   - Usarlo en reportes de auditoría

4. **Dashboard de configuración:**
   - Wizard para setup inicial
   - Validar que TODOS los pasos estén completos antes de crear tratamientos
   - Indicador visual: "Sistema listo" vs "Falta configurar X"

---

**Última actualización:** 2025-10-19
**Mantenedor:** Equipo Laralis
**Versión del documento:** 1.0
