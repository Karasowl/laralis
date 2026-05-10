# Numeric QA Oracles

Este documento define el contrato de QA para los numeros de Laralis Dental.

La regla central: ningun numero importante debe quedar validado solo porque "se ve en pantalla". Cada cifra critica debe tener una cadena comprobable:

```text
dato base -> formula -> API -> UI -> export -> decision de negocio
```

La fuente ejecutable vive en:

```text
docs/qa/numeric-oracles.json
```

Se valida con:

```text
npm --workspace @laralis/dental run qa:numeric
```

Para volver confiables los oraculos contra stage cuando hay datos acumulados:

```text
npm --workspace @laralis/dental run qa:stage:prepare
```

Ese comando resetea y re-siembra solo el dataset QA protegido por el ref stage, y luego ejecuta `qa:stage:assert`.

Modo estricto, util para CI cuando queramos bloquear gaps P0 abiertos:

```text
npm --workspace @laralis/dental run qa:numeric:strict
```

## Por que es P0

Los numeros de Laralis no son decorativos. Si un insumo no entra en el costo variable, el margen de contribucion queda inflado. Si el costo fijo por minuto se calcula mal, el precio sugerido, el punto de equilibrio, la utilidad y los objetivos comerciales quedan contaminados. Si marketing cuenta mal pacientes o ingresos, CPA, ROAS y ROI pueden empujar decisiones equivocadas.

Por eso el QA numerico debe cubrir toda la cadena, no solo dashboard.

## Niveles de prueba

### 1. Formula pura

Debe validar funciones sin UI ni base de datos:

- costo variable por receta de insumos;
- costo fijo mensual;
- minutos productivos;
- costo fijo por minuto;
- costo fijo asignado por servicio;
- precio sugerido;
- margen bruto;
- margen de contribucion;
- punto de equilibrio;
- utilidad operativa;
- CPA, ROAS, ROI;
- objetivos de ingresos, pacientes y tratamientos.

Archivos actuales:

- `apps/dental/tests/calc/integration.test.ts`
- `apps/dental/tests/qa/qa-oracles.test.ts`

### 2. API con dataset controlado

Debe validar que los endpoints calculan lo mismo que los oraculos:

- pacientes por fuente/campana;
- ingresos por campana;
- tratamientos por estado;
- pagos parciales y saldo pendiente;
- costos variables desde insumos;
- costos fijos planificados y reales;
- depreciacion de activos;
- gastos vinculados a presupuestos;
- filtros de fecha;
- dashboards y reportes agregados.

Archivos actuales:

- `apps/dental/cypress/e2e/stage/02-qa-business-oracles.cy.ts`
- `apps/dental/cypress/e2e/stage/10-fixed-costs-cost-per-minute.cy.ts`
- `apps/dental/cypress/e2e/stage/11-assets-depreciation.cy.ts`
- `apps/dental/cypress/e2e/stage/12-time-settings-simulations.cy.ts`
- `apps/dental/cypress/e2e/stage/13-expenses-budget-links.cy.ts`
- `apps/dental/cypress/e2e/stage/14-date-filters-coherence.cy.ts`
- `apps/dental/cypress/e2e/stage/19-reports-dashboard-oracles.cy.ts`

### 3. UI numerica

Debe validar que el usuario ve los mismos numeros que la API:

- cards de dashboard;
- reportes;
- tablas de pacientes/tratamientos;
- detalle del paciente;
- servicios y recetas;
- insumos;
- gastos;
- costos fijos;
- activos/depreciacion;
- marketing;
- simuladores;
- acciones sugeridas por Lara.

La UI no debe probar solo que aparece un texto como "Margen". Debe comparar importes concretos contra `docs/qa/oracles.json` o contra un calculo deterministico del spec.

### 4. Export numerico

Debe validar que los datos necesarios para recalcular sobreviven al export:

- insumos;
- recetas `service_supplies`;
- servicios;
- tratamientos;
- pagos;
- gastos;
- costos fijos;
- activos/depreciacion;
- campanas;
- fuentes;
- snapshots de costos si existen.

Archivo actual:

- `apps/dental/cypress/e2e/stage/32-data-portability-security-snapshots.cy.ts`

Brecha pendiente:

- `qa-087-export-real-import-roundtrip`: importar realmente en un workspace temporal y comprobar que los numeros restaurados siguen coincidiendo.

## Invariantes obligatorios

Estas invariantes deben mantenerse en pruebas nuevas:

- `service.variable_cost_cents` debe derivarse de la receta de insumos.
- Cambiar costo de un insumo debe afectar el costo variable de servicios nuevos o recalculados segun la regla de producto.
- Un tratamiento ya creado debe preservar snapshots de costo/precio cuando el producto requiera historico estable.
- `gross_profit = completed_revenue - completed_variable_cost`.
- `service_net_profit = completed_revenue - completed_variable_cost - allocated_fixed_cost`.
- `operating_profit` debe separar costo fijo planificado, costo fijo asignado y gasto real para no contar doble.
- `contribution_margin = price - variable_cost`.
- `break_even_units = ceil(fixed_costs / average_contribution_margin)`.
- `CPA = campaign_spend / attributed_patients`.
- `ROAS = attributed_revenue / campaign_spend`.
- Los filtros de fecha deben afectar numerador y denominador de la misma forma.
- Export e import no deben perder ningun insumo o relacion necesaria para recalcular margen.

## Regla de release

Para cambios que toquen precios, costos, insumos, servicios, tratamientos, pagos, gastos, marketing, dashboards, reportes, Lara o exports, no basta con smoke UI.

La puerta minima debe incluir:

```text
npm --workspace @laralis/dental run qa:oracles
npm --workspace @laralis/dental run test:e2e:stage:business
npm --workspace @laralis/dental run test:e2e:stage:reports
```

Puerta numerica recomendada para una rama que toca numeros o exports:

```text
npm --workspace @laralis/dental run qa:release:numeric
```

Si el cambio toca export/import:

```text
npm --workspace @laralis/dental run test:e2e:stage:exports
```

Si `test:e2e:stage:business` falla por conteos inesperados del dataset, la causa debe tratarse como stage sucio u oraculo roto. No se debe rebajar el oraculo para hacerlo pasar.

## Auditoria ejecutable

`qa:numeric` falla si:

- `docs/qa/numeric-oracles.json` no existe o no parsea;
- un metric group `covered` y `P0` no tiene assertions numericas;
- un metric group `covered` y `P0` no tiene evidencia de formula;
- un metric group `covered` y `P0` no tiene evidencia API;
- un metric group `covered` y `P0` no tiene evidencia UI ni export;
- un archivo de evidencia declarado no existe;
- un valor esperado no coincide con `docs/qa/oracles.json`, `docs/qa/dataset.json` o los valores `computed`.

El script genera:

```text
docs/qa/generated/numeric-oracle-report.md
```

El reporte puede quedar en `warn` cuando hay P0 planeados, por ejemplo objetivos de dinero/marketing todavia sin flujo estable. Eso es intencional: no debe bloquear fixes urgentes, pero debe dejar el gap visible.
