# Nivel 1 (modo simple / gross-margin) — Análisis de factibilidad

**Estado:** ANÁLISIS — NO implementado. Decisión y construcción pendientes.
**Fecha:** 2026-06-08
**Origen:** auditoría multi-agente del motor de cálculo + onboarding (ultracode).

> ⚠️ Este documento es un **mapa para una implementación futura**. No se ha tocado código del
> "Nivel 1" todavía. Cuando se decida construirlo, este doc tiene la evidencia (file:line) y el
> orden de cambios. Hasta entonces, es solo el diagnóstico.

---

## 1. El concepto de producto (por qué existe Nivel 1)

La app puede dar **precisión financiera alta** (ganancia real después de costos fijos, tiempo de
sillón, depreciación, punto de equilibrio). Pero esa precisión exige inputs que el dentista —sobre
todo el **recién graduado**, nuestro ICP— **no tiene a la mano**: cuánto costó el sillón, en cuántos
años se deprecia, sus costos fijos desglosados, etc.

**El acantilado de activación:** setup difícil → no configura → nunca ve el valor → se va. Es el
dolor #1 de adopción.

**La solución (instinto del fundador, confirmado técnicamente aquí):** dos niveles de la misma máquina.

| | **Nivel 1 — Margen bruto** | **Nivel 2 — Ganancia real** |
|---|---|---|
| Pregunta que responde | "¿cuánto me queda por servicio?" = precio − insumos | "¿de verdad gano, después de TODO?" |
| Config requerida | casi nula (precio del servicio, opcional un insumo) | costos fijos, tiempo, activos, depreciación, break-even |
| Tier | **Gratis** (gancho, cruza el acantilado) | **De pago** (+ Lara analista, automatización) |

El **gap entre los dos niveles ES el upsell**, y es honesto: el margen bruto *miente* (un servicio
puede verse rentable solo por insumos y perder plata al cargar tiempo + fijos). Ese miedo —"¿y si
creo que gano cuando pierdo?"— es lo que empuja al Nivel 2.

---

## 2. Veredicto técnico

**El motor y el modelo de datos YA soportan Nivel 1. No hay reescritura de motor.** Lo que bloquea
está concentrado en la capa de **UI / gating de onboarding** — justo lo que el fundador identificó
como el dolor. "Nivel 1" es ~80% **quitar candados que ya existen**, no construir.

### 2.1 El motor degrada limpio con todo en cero ✅

Cada división por tiempo o costo está guardada (`> 0 ? ... : 0`). Con `fixed_costs=0`, `assets=0`,
`settings_time` ausente y `est_minutes=0`: el costo por minuto cae a **0 limpio** — nunca NaN, nunca
Infinity, nunca crash. El **precio de venta está desacoplado de los costos** (fix anti-drift de
2025-12-18), así que `precio − insumos` es un número finito y correcto **hoy**, sin configurar nada.

Evidencia:
- `app/api/services/[id]/cost/route.ts:62` (insumo aporta 0 si `portions/qty` no son >0), `:84`,
  `:164` (`if (settingsTime)` — sin row, bloque de fijos se salta), `:192` (`if monthlyFixedTotal>0`),
  `:208` (`effectiveMinutes>0 ? ... : 0`).
- `app/api/services/route.ts:200`, `:498-511`, `:520` (precio = descuento sobre original/target,
  NO derivado de costo).
- `hooks/use-time-settings.ts:103` (triple guard), `lib/ai/ClinicSnapshotService.ts:589`, `:615`,
  `:632` (markup = `totalCost>0 ? ... : 0`), `:1288-1336` (break-even guardado), `app/api/equilibrium/route.ts:42-46`.

**Único landmine:** las funciones *puras* de `lib/calc/` SÍ lanzan error con ceros
(`puntoEquilibrio.ts:22-37`, `tiempo.ts:46-48`, `tarifa.ts:113-115`). El código vivo de la app NO las
llama en el camino de ceros (usa versiones inline guardadas). **Acción al construir Nivel 1:** no
cablear esas funciones puras en el modo simple, o hacerlas devolver neutro en vez de throw.

### 2.2 El onboarding fuerza 5 pasos antes de dejarte entrar ❌ (esto es el acantilado)

El workspace no se "activa" (y un guard saca al usuario del dashboard con redirect) hasta completar:

| Paso | ¿Obligatorio hoy? | Problema para el recién graduado |
|---|---|---|
| Activos (precio **positivo** + depreciación múltiplo de 12) | **Sí** | no sabe la depreciación de su sillón |
| Costos fijos (≥1 monto positivo) | **Sí** | rechaza $0 — no se puede "saltar con cero" |
| Tiempo (días/horas/productividad) → costo/min > 0 | **Sí** | conocimiento que no tiene a la mano |
| ≥1 insumo | **Sí** | — |
| ≥1 servicio | **Sí** | — |

El wizard está **diseñado para que los ceros NO pasen** (un activo de $0 falla en `zAssetForm`,
`lib/zod.ts:163-175`; un costo fijo de $0 no pone verde el paso, `validators.ts:85-90`). Ya están
**relajados**: break-even y "receta con insumos" (no se exigen para terminar), y dirección/teléfono/
email de clínica.

Evidencia: `config/requirements-dag.json:13-22`, `app/setup/page.tsx:33-39` (STEP_IDS),
`lib/requirements/validators.ts:85-133`, `hooks/use-onboarding.ts:113-122`,
`contexts/workspace-context.tsx:484-493`, `middleware.ts:220-230`.

### 2.3 El modelo de datos ya es permisivo ✅

Sin constraints que fuercen `settings_time`/activos/costos fijos. Un servicio solo necesita
`name` + un precio; un trigger BEFORE-INSERT llena `price_cents` desde `original_price_cents`.

Evidencia: `FULL-SCHEMA-v56.sql:383` (`services.name` NOT NULL), `:387` (`est_minutes` NOT NULL
**pero DEFAULT 60**), `:388-391` (`margin_pct`/`variable_cost_cents`/`fixed_cost_per_minute_cents`
con DEFAULT 30/0/0), migración 68:53-60 (trigger de `price_cents`), migración 41:15-54 (el seed de
clínica crea 7 patient_sources + 3 categorías, NADA de config de costos).

---

## 3. Qué cuesta de verdad "Nivel 1" (cuando se decida construir)

### 3.1 Fácil — quitar/relajar candados (UI + config, NADA de motor)
1. **Encoger el DAG de `/setup`** de 5 pasos a "crea un servicio con precio" (+ opcional un insumo).
   → `config/requirements-dag.json`, `app/setup/page.tsx:33-39`.
2. **Activar el workspace al crear la clínica**, sin los 3 pasos financieros.
   → `hooks/use-onboarding.ts`, `contexts/workspace-context.tsx:484-493`, `middleware.ts:220-230`.
3. **`est_minutes` opcional/oculto en modo simple** (hoy obligatorio por zod cliente+servidor).
   → `app/api/services/route.ts:26`, `lib/schemas.ts:112`.
4. **Soltar el candado `create_service`** que exige ≥1 insumo en la clínica.
   → `config/requirements-dag.json:13-16`, `lib/requirements/validators.ts:122-125`,
   `app/services/page.tsx:126`.
5. **Relabel clave (UI-framing):** mostrar `price_cents − variable_cost_cents` como **"margen
   bruto"** explícito. Hoy la UI enseña costo total (fijo+variable) y un markup etiquetado
   `margin_pct`. → `components/.../ServiceForm.tsx:114-116`, `:165-168`, `:359-361`.

### 3.2 El único cambio de verdad (NO es framing)
- **Registrar tratamientos exige hoy** que el servicio tenga receta + costo/min positivo
  (el `412 precondition_failed` "Service has no recipe" que vimos en producción). Para operar en
  modo gross-margin, esas dos precondiciones deben volverse **degradables** (permitir tratamiento con
  `variable_cost=0` / `cost_per_minute=0`). Es contrato del motor, no UI.
  → `app/api/treatments/route.ts:227-229`, `:233`, `:546-548`, `:559-560`.

### 3.3 Limpieza recomendada de paso
- Reconciliar **3 defaults de margen divergentes**: BD `30.00`, fallback POST `30` (`route.ts:444`),
  DAG `40`.
- Hacer que las funciones puras de `lib/calc` (`tiempo.ts:46-48`, `puntoEquilibrio.ts:22-37`,
  `tarifa.ts:113-115`) devuelvan neutro/0 en vez de `throw`, para que un cableado futuro de modo
  simple no pueda crashear.

---

## 4. Mapa free/pago resultante

- **Gratis = Nivel 1:** crear servicio con precio (+ insumo opcional) → margen bruto. Casi cero
  config. Cruza el acantilado. (Lara: solo "te configura" / sabor, según decisión de tiering.)
- **Pago = Nivel 2:** "desbloquea tu ganancia REAL" → activos, costos fijos, tiempo, depreciación,
  break-even + Lara analista + automatización (WhatsApp, recetas, PDF).

---

## 5. Decisiones abiertas (antes de construir)
1. ¿Lara entra gratis solo para **onboarding/setup** (el gancho) y se cobra el uso **analítico**
   continuo? (Tensión: si Lara es la mejor forma de configurar sin dolor y la metes 100% tras el
   paywall, mueres en la activación.)
2. ¿Freemium generoso vs. early-adopter pagado? (El doc de pricing decía "no freemium ahora"; el
   ICP recién-graduado empuja hacia free. Es jugada de confianza/distribución, no de ingresos.)
3. ¿El modo simple también deja **registrar tratamientos** (requiere el cambio 3.2) o Nivel 1 es
   solo "catálogo + margen bruto" sin agenda clínica completa?

---

## Relacionado
- `docs/competencia/PRICING-STRATEGY.md`, `docs/competencia/ROADMAP-COMPETITIVO.md`
- `docs/AI-KNOWLEDGE-GAPS.md` (margin = markup; fixed costs = manual + depreciación; break-even)
