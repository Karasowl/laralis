# Regression Log

Este archivo registra bugs convertidos en pruebas permanentes.

Cada entrada debe explicar:

- Que se rompia.
- Donde quedo la prueba.
- Como se verifica.
- Que riesgo protege.

## 2026-05-03 - Fechas `YYYY-MM-DD` y zonas horarias

### Problema

Los calculos de dias laborables podian interpretar mal fechas creadas como `new Date('YYYY-MM-DD')`.

En zonas horarias negativas, una fecha civil como `2025-10-20` podia convertirse localmente en la tarde/noche del dia anterior. Eso hacia que un lunes se tratara como domingo.

Impacto potencial:

- Filtros de fecha.
- Calculos de dias laborables.
- Punto de equilibrio.
- Simuladores de tiempo.
- Dashboards y reportes que dependen de rangos.
- Deteccion historica de patrones de trabajo.

### Prueba permanente

Archivo:

```text
apps/dental/lib/calc/dates.test.ts
```

Casos protegidos:

- `isWorkingDay` identifica lunes correctamente desde `YYYY-MM-DD`.
- `isWorkingDay` identifica domingo correctamente desde `YYYY-MM-DD`.
- `calculateWorkingDaysInRange` maneja rango de un solo dia.
- `detectWorkingDayPattern` usa una fecha de referencia deterministica para no romperse con el paso del tiempo.

### Implementacion protegida

Archivo:

```text
apps/dental/lib/calc/dates.ts
```

La logica normaliza fechas de tipo date-only como fechas civiles antes de calcular el dia de la semana.

### Verificacion

Comando funcional:

```bash
npm --workspace @laralis/dental exec -- vitest run lib/calc --coverage.enabled=false
```

Resultado esperado:

```text
11 test files passed
244 tests passed
```

Nota: `npm --workspace @laralis/dental run test:unit` ejecuta los mismos tests, pero actualmente tambien aplica umbrales globales de coverage configurados en `apps/dental/vitest.config.ts`. Puede fallar por coverage global aunque los tests pasen.

## 2026-05-03 - Borrado de registros con dependencias no debe responder 500

### Problema

El ciclo CRUD de stage detecto que `DELETE /api/services/:id` devolvia `500` al intentar borrar un servicio usado por un tratamiento.

La causa era un lookup de dependencias que dependia de un join PostgREST con nombre de foreign key especifico. En el schema remoto ese join podia fallar antes de devolver el bloqueo de negocio esperado.

Riesgo asociado:

- El usuario ve un error interno en vez de una explicacion accionable.
- Cypress no puede diferenciar entre un bug del backend y una proteccion correcta.
- Endpoints de borrado pueden depender de detalles fragiles del schema en vez de verificar relaciones por IDs.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/03-crud-lifecycle.cy.ts
```

Casos protegidos:

- Un insumo usado por un servicio responde `409 supply_in_use`.
- Un servicio usado por un tratamiento responde `409 service_in_use`.
- Un paciente con tratamientos responde `409 patient_in_use`.
- Luego de borrar el tratamiento, el spec limpia servicio, insumo y paciente creados.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/services/[id]/route.ts
apps/dental/app/api/patients/[id]/route.ts
```

Los guards de borrado ahora consultan dependencias por IDs simples y resuelven nombres relacionados en consultas separadas. `patients/[id]` tambien resuelve la clinica activa antes de leer, actualizar o borrar.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:crud
```

## 2026-05-03 - Miembros no owner y permisos backend de pacientes

### Problema

Al probar con `qa-viewer@laralis.test`, el usuario autenticado caia en onboarding porque `GET /api/clinics` solo listaba workspaces donde el usuario era owner. Eso dejaba fuera a miembros validos del workspace/clinica.

El mismo bloque de QA tambien confirmo que necesitabamos una prueba permanente donde un viewer no pudiera crear pacientes por API, aunque pudiera verlos.

Riesgo asociado:

- Un miembro invitado puede parecer "sin clinica" aunque tenga membresia.
- La UI puede mandar a onboarding a usuarios activos.
- Un endpoint con `supabaseAdmin` puede aceptar escrituras si no consulta permisos granulares.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Casos protegidos:

- `qa-viewer@laralis.test` puede resolver la clinica QA por membresia.
- Sus permisos reportan `patients.view=true` y `patients.create/edit/delete=false`.
- `POST /api/patients` responde `403 Forbidden` para viewer.
- El owner sigue pudiendo crear y limpiar un paciente QA.

Nota: el spec permite que el viewer aterrice temporalmente en onboarding durante el login (`allowSetup`) para aislar la verificacion backend. El flujo visual estricto de miembros sigue como brecha abierta hasta que middleware/UI puedan resolver workspaces por membresia sin depender de RLS de Edge.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/clinics/route.ts
apps/dental/app/api/patients/route.ts
apps/dental/app/api/patients/[id]/route.ts
apps/dental/lib/permissions/check.ts
```

`/api/clinics` ahora toma en cuenta membresias de `workspace_users` y `workspace_members`, no solo `workspaces.owner_id`. Los endpoints de pacientes consultan permisos granulares antes de ver, crear, editar o borrar.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```
