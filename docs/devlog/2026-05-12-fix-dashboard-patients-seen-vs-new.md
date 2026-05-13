# Fix dashboard card "Pacientes Atendidos" vs "Nuevos Pacientes"

- Fecha: 2026-05-12
- Versión: v0.6.1 (patch)
- Tasks: ad-hoc bug discovery (no TASK-id previo)

## Contexto

Usuario reportó: en producción (workspace "Lara"), al filtrar el dashboard
por abril 2026 el card "Pacientes Actuales" mostraba **0.4/día**
con la advertencia "⚠️ 0.6 pacientes menos que la meta". El backup exportado
ese mismo mes (`laralis-backup--2026-05-13.json`) contiene en abril:

- 48 tratamientos (47 completed + 1 scheduled)
- 34 pacientes únicos atendidos
- 19 días con citas en 30 días naturales

Por cualquier corte razonable el ratio real era **1.13–1.79 pacientes/día**,
no 0.4. El usuario estaba viendo una alarma falsa.

## Problema

El card prometía "tu promedio real de pacientes atendidos por día"
(tooltip i18n `dashboardComponents.businessMetrics.tooltips.currentPatients`)
pero el backend devolvía la **tasa de adquisición de pacientes nuevos**
(pacientes con `first_visit_date` en el período / días del período).

En clínicas donde la mayoría de pacientes son recurrentes,
ambos números divergen mucho. Y la comparación contra
`pacientesNecesariosPorDia` (la meta para alcanzar break-even)
no tiene sentido contra "nuevos adquiridos": el break-even se alimenta
de tratamientos ejecutados, no de registros nuevos.

## Causa raíz

`apps/dental/lib/analytics.ts::calculateKPIs`, rama que se ejecuta
cuando `options.daysInPeriod` está definido:

```ts
const patientsInPeriod = options.totalPatients ?? patients.length;
avgPatientsPerDay = patientsInPeriod / options.daysInPeriod;
```

`apps/dental/app/api/reports/summary/route.ts` pasa
`totalPatients: periodPatients.length`, donde `periodPatients` filtra a
pacientes cuyo `first_visit_date | acquisition_date | created_at`
cae dentro del rango — es decir, **pacientes nuevos**, no atendidos.

Reproducción exacta contra el backup:

```
13 patients con first_visit/acquisition/created_at en abril
13 / 30 días = 0.43 → redondeado a 0.4/día (coincide con UI)
```

## Qué cambió

1. `lib/analytics.ts::calculateKPIs` ahora calcula dos KPIs:
   - `avgPatientsPerDay` = `uniqueSeenPatients.size / daysInPeriod`
     (pacientes únicos con tratamiento `completed` en el período)
   - `avgNewPatientsPerDay` = `totalPatients / daysInPeriod`
     (preserva el cálculo anterior con nombre claro)
2. `hooks/use-reports.ts`: el tipo `kpis` expone ambos campos.
3. `components/dashboard/BusinessMetricsGrid.tsx`:
   - Nueva prop opcional `nuevosPacientesPorDia`.
   - Si está definida, se renderiza un card adicional "Nuevos Pacientes"
     al lado de "Pacientes Atendidos".
   - Grid ajustado: 4 cards visibles → `lg:grid-cols-4`;
     5 cards (con Net Profit) → `lg:grid-cols-3 xl:grid-cols-5`.
4. `app/page.tsx`: pasa `nuevosPacientesPorDia={kpis.avgNewPatientsPerDay ?? 0}`.
5. i18n (`messages/{es,en}.json`):
   - `currentPatients` renombrado: "Pacientes Atendidos" / "Patients Seen".
   - Nuevas keys `newPatients`, `newPatientsAcquired`, `tooltips.newPatients`.
   - Tooltips de `currentPatients` y `newPatients` reescritos con la fórmula real.
6. Versión bumpeada a 0.6.1 (`package.json`, `VersionBadge`,
   `messages/version.{es,en}.json`).

### Cobertura QA

7. `docs/qa/oracles.json`: nueva sección `kpis` con valores derivados
   del dataset stage (`uniquePatientsSeenInPeriod`, `newPatientsAcquiredInPeriod`,
   `periodDaysInclusive`, `avgPatientsPerDay`, `avgNewPatientsPerDay`).
8. `cypress/e2e/stage/19-reports-dashboard-oracles.cy.ts`: nuevo `it`
   "separates patients-seen-per-day from new-patients-per-day in summary KPIs"
   que valida:
   - Ambos campos están presentes en la respuesta del API (regression guard).
   - Cada KPI coincide con `expected = oracle / oracles.kpis.periodDaysInclusive`
     con tolerancia `0.0001`.
   - Invariante independiente del dataset: `avgPatientsPerDay ≤
     (completed_paid + partial) / periodDays`.

## Archivos tocados

- `apps/dental/lib/analytics.ts`
- `apps/dental/hooks/use-reports.ts`
- `apps/dental/components/dashboard/BusinessMetricsGrid.tsx`
- `apps/dental/app/page.tsx`
- `apps/dental/messages/es.json`
- `apps/dental/messages/en.json`
- `apps/dental/messages/version.es.json`
- `apps/dental/messages/version.en.json`
- `apps/dental/components/ui/VersionBadge.tsx`
- `apps/dental/package.json`
- `apps/dental/cypress/e2e/stage/19-reports-dashboard-oracles.cy.ts`
- `docs/qa/oracles.json`

## Antes vs después

Para el workspace "Lara" en abril 2026:

| Card                | Antes      | Después   |
|---------------------|------------|-----------|
| Pacientes Atendidos | — (no existía con ese nombre) | **1.13/día** (34 únicos / 30 días) |
| Pacientes Actuales  | 0.4/día (engañoso) | renombrado → "Pacientes Atendidos" |
| Nuevos Pacientes    | — (no existía) | **0.43/día** (13 nuevos / 30 días) |

El usuario ahora ve la cifra que esperaba ver, y separadamente
la tasa de adquisición. La advertencia
"⚠️ X pacientes menos que la meta" solo aplica al card
"Pacientes Atendidos" (que es el que importa para break-even).

## Cómo probar

1. Login con cuenta que tenga tratamientos recurrentes.
2. Filtrar dashboard a un mes donde haya pacientes que aparecen
   en varios tratamientos.
3. Verificar:
   - Card "Pacientes Atendidos" muestra pacientes únicos atendidos / días.
   - Card "Nuevos Pacientes" muestra `first_visit_date` en el período / días.
   - Tooltips coinciden con las fórmulas reales.
4. Correr `npm run test:e2e:stage:reports` después del deploy a preview:
   los 4 tests anteriores + el nuevo deben pasar.

## Riesgos y rollback

- Riesgo bajo: el cálculo nuevo es estrictamente más correcto.
  El único cambio observable es que el card que antes mostraba
  "nuevos/día" disfrazado de "atendidos/día" ahora muestra el ratio real.
- Layout: con 4 cards visibles el grid pasa a `lg:grid-cols-4`.
  Probado contra `15-visual-responsive-coverage` y los baselines de `24`.
- Rollback: revertir el commit; el bug visible vuelve pero no hay corrupción
  de datos (el API solo cambió de signature, no escribe).

## Follow-ups

- El dataset stage QA tiene actualmente 30 pacientes nuevos == 30 pacientes
  únicos atendidos, lo que hace que `avgPatientsPerDay === avgNewPatientsPerDay`
  por casualidad. Tarea pendiente: extender el seed para incluir pacientes
  recurrentes que reciben tratamiento en el período sin first_visit_date
  en ese período, para que el oracle distinga ambos números con valores
  distintos.
