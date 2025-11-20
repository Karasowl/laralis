# Mejoras al Prompt de Lara

**Fecha**: 2025-11-20
**Objetivo**: Documentar qué conocimiento crítico le falta a Lara en su prompt para ser más eficaz

---

## 🔴 Gaps Críticos en el Prompt Actual

### Gap #1: Margin vs Markup (CRÍTICO)

**Problema actual en prompt**:
```typescript
• **UTILIDAD/MARKUP: ${s.margin_pct}%**
```

**Qué falta**:
```markdown
## IMPORTANT: MARGIN VS MARKUP

⚠️ **CRITICAL CLARIFICATION**: The field called `margin_pct` in this system is actually **MARKUP**, not margin.

**Difference**:
- **MARGIN** = (Price - Cost) / Price × 100  (percentage of price)
- **MARKUP** = (Price - Cost) / Cost × 100   (percentage of cost) ← **THIS IS WHAT WE USE**

**Example**:
- Cost: $100
- Price: $150
- **Margin**: 33.3% (50/150)
- **Markup**: 50% (50/100) ← **What you see in the data**

**How to explain to users**:
✅ "Tu servicio tiene una UTILIDAD del 50% sobre el costo"
✅ "Por cada $100 que te cuesta, ganas $50"
❌ "Tu margen es 50%" (confusing - use "utilidad" or "markup")

**In calculations**: When user asks "what's my margin?", calculate and explain both:
- Markup (utilidad): 50%
- True margin: 33.3%
```

**Impacto**: SIN esto, Lara podría explicar mal la rentabilidad de servicios.

---

### Gap #2: Fixed Costs = Manual + Depreciation (CRÍTICO)

**Problema actual en prompt**:
```markdown
- **Monthly Fixed Costs**: $26,315
- **Monthly Asset Depreciation**: $3,200
- **Total Monthly Fixed**: $29,515
```

**Qué falta**:
```markdown
## CRITICAL: FIXED COSTS CALCULATION

**Fixed costs in this system = Manual fixed costs + Asset depreciation**

**Why depreciation is a fixed cost**:
- Assets (chairs, equipment, etc.) lose value over time
- This depreciation is spread monthly: `purchase_price / depreciation_months`
- Example: Chair costs $12,000, depreciates over 60 months = $200/month
- This $200/month is ALWAYS paid (it's the "cost" of using the asset)

**When explaining costs to users**:
✅ "Tus costos fijos totales son $29,515 mensuales: $26,315 en gastos fijos como renta y salarios, más $3,200 en depreciación de tus equipos"
❌ "Tus costos fijos son $26,315" (missing depreciation!)

**For break-even calculation**: ALWAYS use the TOTAL (manual + depreciation).
```

**Impacto**: SIN esto, Lara calculará break-even INCORRECTAMENTE.

---

### Gap #3: Variable Costs FROM SERVICES, NOT Expenses

**Problema actual en prompt**:
- Muestra tanto expenses como service variable costs
- NO aclara explícitamente cuál se usa para break-even

**Qué falta**:
```markdown
## CRITICAL: VARIABLE COSTS FOR BREAK-EVEN

⚠️ **DO NOT confuse variable costs with expenses!**

**Variable costs** (for break-even calculation):
- Calculated from SERVICES table: `SUM(supply.cost_per_portion × service_supplies.qty)`
- These are direct MATERIAL costs (amalgam, cement, etc.)
- Tied directly to each treatment performed
- Used in formula: `Variable Cost % = Total Variable / Total Revenue × 100`

**Expenses** (tracked separately):
- Operational expenses from expenses table (rent, utilities, supplies purchases, etc.)
- May include BOTH fixed and variable costs
- Used for: Net profit calculation, not break-even
- Formula: `Net Profit = Revenue - Expenses`

**When user asks about costs**:
- "¿Cuál es mi costo variable?" → Use service variable costs (materials per treatment)
- "¿Cuánto gasté este mes?" → Use expenses table
- "¿Cuánto necesito vender para break-even?" → Use service variable costs

**Example explanation**:
"Tu costo variable promedio es 35% (materiales que usas en cada tratamiento).
Esto significa que de cada $100 que cobras, $35 son materiales y $65 quedan
para cubrir tus costos fijos ($29,515) y ganancia."
```

**Impacto**: SIN esto, Lara podría usar expenses en vez de service variable costs → cálculos de break-even incorrectos.

---

### Gap #4: Time Settings & Effective Minutes Calculation

**Problema actual en prompt**:
```markdown
- 22 days/month
- 8 hours/day
- 80% productive time
- **Available treatment minutes**: 8,448 min/month
```

**Qué falta**:
```markdown
## HOW TIME SETTINGS WORK

**Calculation of available minutes**:
```
Total minutes = work_days × hours_per_day × 60
             = 22 × 8 × 60 = 10,560 minutes

Effective minutes = Total minutes × (real_productivity_pct / 100)
                  = 10,560 × 0.80 = 8,448 minutes
```

**What real_productivity_pct means**:
- NOT all work hours are billable (breaks, admin, cleaning, etc.)
- 80% means: Of 8 hours/day, only ~6.4 hours are actual treatment time
- Realistic range: 60-85%

**How fixed cost per minute is calculated**:
```
Fixed cost per minute = Total fixed costs / Effective minutes
                      = $29,515 / 8,448 min
                      = $3.49 per minute
```

**When explaining to users**:
"Trabajas 22 días al mes, 8 horas por día, con un 80% de productividad efectiva.
Esto te da 8,448 minutos disponibles para tratamientos. Cada minuto te cuesta
$3.49 en costos fijos (renta, salarios, depreciación, etc.)."

**⚠️ IMPORTANT NOTE**:
The field `real_pct` can be stored as:
- Decimal (0.8 = 80%)
- Percentage (80 = 80%)
System normalizes it, but be aware when explaining.
```

**Impacto**: SIN esto, Lara no puede explicar cómo se calcula el costo por minuto.

---

### Gap #5: Service Pricing Formula (COMPLETA)

**Problema actual en prompt**:
- Muestra los costos desglosados
- NO muestra la fórmula completa de cálculo

**Qué falta**:
```markdown
## SERVICE PRICING FORMULA (COMPLETE)

**Step-by-step calculation**:

```javascript
// 1. Fixed cost (time-based)
fixed_cost = est_minutes × fixed_cost_per_minute
Example: 60 min × $3.49/min = $209

// 2. Variable cost (materials)
variable_cost = SUM(supply.cost_per_portion × service_supplies.qty)
Example:
  - Amalgam: $5/portion × 2 portions = $10
  - Cement: $3/portion × 1 portion = $3
  - Total variable = $13

// 3. Total cost
total_cost = fixed_cost + variable_cost
Example: $209 + $13 = $222

// 4. Apply markup (NOT margin!)
price_before_discount = total_cost × (1 + markup_pct/100)
Example: $222 × (1 + 50/100) = $333

// 5. Apply discount (if configured)
if (discount_type === 'percentage') {
  discount = price_before_discount × (discount_value / 100)
} else if (discount_type === 'fixed') {
  discount = discount_value
}

// 6. Final price
final_price = price_before_discount - discount
Example (no discount): $333
```

**When explaining pricing to users**:
"El precio de $333 se calculó así:
1. Tiempo: 60 min × $3.49/min = $209 (costo fijo)
2. Materiales: $13 (amalgam $10 + cemento $3)
3. Costo total: $222
4. Utilidad del 50%: $222 × 1.5 = $333
5. Sin descuento aplicado"
```

**Impacto**: SIN esto, Lara no puede explicar detalladamente cómo se calculan los precios.

---

### Gap #6: Tariffs Table DEPRECATED

**Problema actual en prompt**:
- NO menciona que tariffs está deprecated
- Si usuario pregunta sobre "tarifas", Lara no sabe redirigir

**Qué falta**:
```markdown
## DEPRECATED: TARIFFS TABLE

⚠️ **IMPORTANT ARCHITECTURAL CHANGE** (v3):

**OLD SYSTEM (v2)**:
- Services → Tariffs (versioned prices) → Treatments
- Tariffs table stored price history with versions

**CURRENT SYSTEM (v3)**:
- Services (price_cents + discounts) → Treatments
- Tariffs table is **DEPRECATED** (kept for audit only)

**Why this matters**:
- `services.price_cents` is now the SINGLE SOURCE OF TRUTH
- NO need for separate tariffs management
- Historical pricing: Query treatments table, NOT tariffs

**When user asks about "tarifas"**:
✅ "Los precios ahora se configuran directamente en los servicios.
    Puedes verlos y editarlos en la página de Servicios."
❌ "No encuentro información de tarifas" (confusing)

**If user mentions "versiones de tarifas"**:
"El sistema ya no usa versiones de tarifas. Cada tratamiento guarda el
precio exacto que se cobró en ese momento, así conservas el historial
de precios de forma automática."
```

**Impacto**: SIN esto, Lara podría confundir a usuarios que hablan de "tarifas" o "versiones".

---

### Gap #7: Supply Portions & Recipe Calculation

**Problema actual en prompt**:
- Muestra variable cost total
- NO explica cómo se calcula desde supplies

**Qué falta**:
```markdown
## SUPPLY PORTIONS & SERVICE RECIPES

**How variable costs are calculated**:

```javascript
// 1. Supply cost per portion
supply.cost_per_portion = supply.price_cents / supply.portions
Example:
  Amalgam bottle: $500 / 100 portions = $5 per portion

// 2. Service recipe (service_supplies table)
service_recipe = [
  { supply: "Amalgam", qty: 2 },   // Uses 2 portions
  { supply: "Cement", qty: 1 }     // Uses 1 portion
]

// 3. Variable cost for service
variable_cost = SUM(cost_per_portion × qty)
             = ($5 × 2) + ($3 × 1)
             = $10 + $3 = $13
```

**When explaining variable costs**:
"El costo variable de $13 viene de:
- Amalgama: $5 por porción × 2 porciones = $10
- Cemento: $3 por porción × 1 porción = $3

Esto es lo que gastas en materiales por cada tratamiento de este tipo."

**If service has NO supplies configured**:
"Este servicio no tiene insumos configurados todavía. El costo variable
es $0, lo que significa que no estás registrando los materiales que usas.
Deberías agregarlos en la página de Servicios para tener costos más precisos."
```

**Impacto**: SIN esto, Lara no puede explicar el origen del costo variable de servicios.

---

### Gap #8: Calculation Metadata & Data Source

**Problema actual en prompt**:
- Muestra "Average Treatment Price"
- NO explica si es de historical o configured prices

**Qué falta**:
```markdown
## CALCULATION METADATA (BREAK-EVEN)

**The system tracks WHERE numbers come from**:

```typescript
calculation_metadata: {
  avg_treatment_price_cents: 80000,
  price_data_source: 'historical' | 'configured' | 'none',
  historical_treatments_count: 1,
  configured_services_count: 3,
  services_with_pricing_count: 3,
  warning: "Using configured prices due to insufficient history..."
}
```

**Decision logic**:
```javascript
if (treatments_count >= 10) {
  // Sufficient history - use actual average
  use historical_avg_price
  source = 'historical'
} else {
  // Insufficient history - use configured average
  use configured_services_avg_price
  source = 'configured'
  warning = "Only X treatments, using configured prices..."
}
```

**When explaining break-even**:
✅ **If historical** (≥10 treatments):
"Necesitas 33 tratamientos al mes para break-even, calculado con tu
precio promedio real de $800 por tratamiento (basado en 45 tratamientos
históricos)."

✅ **If configured** (<10 treatments):
"Necesitas aproximadamente 33 tratamientos al mes. Este número está
basado en el promedio de tus 3 servicios configurados ($800), porque
solo tienes 1 tratamiento registrado. Cuando tengas más historial,
este número será más preciso."

**ALWAYS check and mention the data source** in your response!
```

**Impacto**: SIN esto, Lara da números de break-even sin explicar que son aproximados (cuando usa configured prices).

---

## 🟡 Gaps Importantes (Nice to Have)

### Gap #9: Multi-Tenancy Context

**Qué falta**:
```markdown
## MULTI-TENANCY AWARENESS

You are analyzing data for ONE specific clinic:
- Clinic ID: ${clinicId}
- All data is filtered to this clinic only
- Other clinics in the system are NOT visible to you

**When user asks comparative questions**:
❌ "No puedo compararte con otras clínicas" (technically correct but unhelpful)
✅ "Puedo comparar tus números actuales con tus meses anteriores para
    ver tu progreso. ¿Quieres ver cómo has mejorado?"
```

### Gap #10: Actionable Recommendations

**Qué falta**:
```markdown
## PROACTIVE RECOMMENDATIONS FRAMEWORK

When analyzing data, look for these patterns:

**Low margin services** (<20%):
"⚠️ Tu servicio 'Limpieza' solo tiene 15% de utilidad. Considera:
 1. Aumentar el precio
 2. Reducir el tiempo (actualmente 60 min)
 3. Optimizar materiales"

**Underutilized capacity** (<50%):
"💡 Solo estás usando el 35% de tu capacidad. Podrías atender
2.5x más pacientes con tus recursos actuales. ¿Quieres ideas
para atraer más pacientes?"

**High variable cost** (>40%):
"⚠️ Tus materiales representan el 45% del precio. Revisa:
 1. ¿Estás usando porciones correctas en las recetas?
 2. ¿Puedes negociar mejores precios con proveedores?
 3. ¿Hay desperdicios?"

**Negative margin services**:
"🚨 CRÍTICO: El servicio 'Ortodoncia' está perdiendo dinero ($150
de pérdida por tratamiento). Debes ajustar el precio YA o dejar
de ofrecerlo."
```

---

## 📋 Checklist: Prompt Improvements Priority

### P0 (Crítico - implementar YA):
- [ ] Gap #1: Margin vs Markup clarification
- [ ] Gap #2: Fixed costs = manual + depreciation
- [ ] Gap #3: Variable costs from services, not expenses
- [ ] Gap #8: Calculation metadata & data source

### P1 (Importante - implementar pronto):
- [ ] Gap #4: Time settings calculation
- [ ] Gap #5: Service pricing formula
- [ ] Gap #6: Tariffs deprecated notice
- [ ] Gap #7: Supply portions explanation

### P2 (Nice to have):
- [ ] Gap #9: Multi-tenancy awareness
- [ ] Gap #10: Proactive recommendations framework

---

## 🎯 Ejemplo: Prompt Mejorado (Fragmento)

**Actual** (línea 275-282):
```typescript
### SERVICES (Configured) - COMPLETE COST BREAKDOWN
${services.map((s: any) => `📊 **${s.name}**
   • Precio: ${fmt(s.current_price_cents || s.price_cents || 0)}
   • Costo fijo (tiempo): ${fmt(s.fixed_cost_cents || 0)}
   • Costo variable (materiales): ${fmt(s.variable_cost_cents || 0)}
   • **Costo total**: ${fmt(s.total_cost_cents || 0)}
   • Ganancia bruta por tratamiento: ${fmt((s.current_price_cents || s.price_cents || 0) - (s.total_cost_cents || 0))}
   • **UTILIDAD/MARKUP: ${s.margin_pct}%**`).join('\n')}
```

**Mejorado**:
```typescript
### SERVICES (Configured) - COMPLETE COST BREAKDOWN

⚠️ **CRITICAL NOTE**: "UTILIDAD/MARKUP" is calculated as (Price - Cost) / Cost × 100
This is MARKUP, not margin. Margin would be (Price - Cost) / Price × 100.

${services.map((s: any) => `📊 **${s.name}**
   • Precio: ${fmt(s.current_price_cents || s.price_cents || 0)}
   • Costo fijo (tiempo: ${s.est_minutes}min × ${fmt(fixedCostPerMinuteCents)}/min): ${fmt(s.fixed_cost_cents || 0)}
   • Costo variable (${s.supplies_count || 0} insumos): ${fmt(s.variable_cost_cents || 0)}
   • **Costo total**: ${fmt(s.total_cost_cents || 0)}
   • Ganancia bruta: ${fmt((s.current_price_cents || s.price_cents || 0) - (s.total_cost_cents || 0))}
   • **MARKUP: ${s.margin_pct}%** (utilidad sobre costo)
   • **MARGEN REAL**: ${calculateTrueMargin(s)}% (ganancia sobre precio)`).join('\n')}

**When explaining profitability**: Use "utilidad" or "markup" (not "margen") to avoid confusion.
**Formula reference**: Price = Cost × (1 + markup/100)
```

---

## 💰 Valor de Estas Mejoras

**Sin estas mejoras**:
- ❌ Lara explica rentabilidad incorrectamente (margin vs markup)
- ❌ Break-even calculation puede estar mal (missing depreciation)
- ❌ Usuarios confundidos sobre costos variables
- ❌ No puede explicar cómo se calculan precios

**Con estas mejoras**:
- ✅ Explicaciones precisas y educativas
- ✅ Cálculos correctos siempre
- ✅ Usuarios aprenden sobre su negocio
- ✅ Confianza en las respuestas de Lara

---

**Última actualización**: 2025-11-20
**Mantenido por**: Laralis Dev Team
