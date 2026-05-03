# Regression Log

Este archivo registra bugs convertidos en pruebas permanentes.

Cada entrada debe explicar:

- Que se rompia.
- Donde quedo la prueba.
- Como se verifica.
- Que riesgo protege.

## 2026-05-03 - Dashboards financieros y export clinico requieren permisos backend

### Problema

Los endpoints de dashboard resolvian la clinica activa, pero varias lecturas usaban `supabaseAdmin` sin permisos granulares antes de calcular revenue, expenses, actividad mixta o charts financieros.

La exportacion completa de clinica tambien verificaba acceso a la clinica, pero no exigia permiso explicito de export.

Riesgo asociado:

- Un viewer podia consultar metricas financieras o actividad con montos por API.
- Una cuenta con acceso basico a la clinica podia intentar exportar snapshot/full data sin permiso `export_import.export`.
- Las pruebas de permisos cubrian analytics/reportes, pero dejaban fuera dashboards operativos.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Casos protegidos:

- `qa-viewer@laralis.test` conserva lectura de dashboards clinicos basicos: pacientes y tratamientos.
- `qa-viewer@laralis.test` recibe `403 Forbidden` en revenue, expenses, actividades mixtas, chart de revenue y chart de categorias.
- `qa-viewer@laralis.test` recibe `403 Forbidden` en `GET /api/clinic/:clinicId/export?type=snapshot`.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/dashboard/patients/route.ts
apps/dental/app/api/dashboard/treatments/route.ts
apps/dental/app/api/dashboard/revenue/route.ts
apps/dental/app/api/dashboard/expenses/route.ts
apps/dental/app/api/dashboard/activities/route.ts
apps/dental/app/api/dashboard/charts/revenue/route.ts
apps/dental/app/api/dashboard/charts/categories/route.ts
apps/dental/app/api/clinic/[clinicId]/export/route.ts
```

Dashboards clinicos usan `patients.view` o `treatments.view`. Dashboards financieros y actividad mixta usan `financial_reports.view`. Export clinico usa `export_import.export`.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```

## 2026-05-03 - Catalogos clinicos y recetas requieren permisos backend

### Problema

Despues de proteger superficies principales, seguian quedando endpoints auxiliares con `supabaseAdmin` sin guard granular explicito:

- Categorias.
- Fuentes de pacientes.
- Medicamentos.
- Recetas y PDFs de recetas.
- Tarifas y costos por minuto.
- Costo de servicio y recetas de insumos por servicio.
- Chequeo de conflictos de citas.
- Refunds de tratamientos.

Riesgo asociado:

- Un rol de solo lectura podia intentar escribir catalogos por API aunque la UI ocultara botones.
- Costos, margenes y tarifas podian quedar expuestos fuera de permisos financieros.
- Recetas, PDFs y refunds podian consultarse o ejecutarse sin pasar por permisos de recetas o cobro.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Casos protegidos:

- `qa-viewer@laralis.test` recibe `403 Forbidden` en categorias de costos y escritura de categorias de servicios.
- `POST /api/patient-sources` exige permiso de crear pacientes.
- `GET /api/medications` y `GET /api/prescriptions` respetan `prescriptions.view`; `POST /api/medications` y `POST/PUT/DELETE /api/prescriptions` quedan bloqueados para viewer.
- `GET /api/prescriptions/:id/pdf` exige `prescriptions.print`.
- `GET/POST /api/tariffs`, `GET /api/services/:id/cost` y `GET /api/time/cost-per-minute` exigen permisos financieros o de pricing.
- Mutaciones de `service_supplies`, chequeo de conflictos y refunds devuelven `403` para viewer.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/categories/route.ts
apps/dental/app/api/categories/[id]/route.ts
apps/dental/app/api/patient-sources/route.ts
apps/dental/app/api/medications/route.ts
apps/dental/app/api/prescriptions/route.ts
apps/dental/app/api/prescriptions/[id]/route.ts
apps/dental/app/api/prescriptions/[id]/pdf/route.ts
apps/dental/app/api/tariffs/route.ts
apps/dental/app/api/services/[id]/cost/route.ts
apps/dental/app/api/services/[id]/supplies/route.ts
apps/dental/app/api/services/[id]/supplies/[rowId]/route.ts
apps/dental/app/api/time/cost-per-minute/route.ts
apps/dental/app/api/treatments/check-conflicts/route.ts
apps/dental/app/api/treatments/[id]/refund/route.ts
```

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```

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

## 2026-05-03 - Administracion sensible requiere permisos granulares

### Problema

Varias rutas administrativas verificaban acceso basico a la clinica o roles hardcodeados, pero no pasaban por el sistema granular de permisos.

Riesgo asociado:

- Un viewer podia intentar leer miembros, settings, snapshots o estados de reset por API.
- Rutas de mutacion dependian de checks de rol locales en vez de permisos `team.*`, `settings.*` o `export_import.*`.
- Operaciones destructivas como restore/reset quedaban fuera de la matriz permanente de permisos.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Casos protegidos:

- `qa-viewer@laralis.test` recibe `403 Forbidden` en listado, invitacion, edicion y borrado de miembros de workspace/clinica.
- `qa-viewer@laralis.test` recibe `403 Forbidden` al leer o editar booking, notificaciones y configuracion de tiempo.
- `qa-viewer@laralis.test` recibe `403 Forbidden` al listar, descubrir, crear, descargar, borrar o restaurar snapshots.
- `qa-viewer@laralis.test` recibe `403 Forbidden` al consultar o ejecutar reset de datos.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/team/workspace-members/route.ts
apps/dental/app/api/team/workspace-members/[id]/route.ts
apps/dental/app/api/team/clinic-members/route.ts
apps/dental/app/api/team/clinic-members/[id]/route.ts
apps/dental/app/api/settings/booking/route.ts
apps/dental/app/api/settings/notifications/route.ts
apps/dental/app/api/settings/time/route.ts
apps/dental/app/api/snapshots/route.ts
apps/dental/app/api/snapshots/[snapshotId]/route.ts
apps/dental/app/api/snapshots/[snapshotId]/restore/route.ts
apps/dental/app/api/snapshots/discover/route.ts
apps/dental/app/api/reset/route.ts
```

Team usa `team.view`, `team.invite`, `team.edit_roles` y `team.remove`. Settings usa `settings.view/edit`. Snapshots y restore/reset usan `export_import.export/import`.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```

## 2026-05-03 - Acciones de Lara no deben saltarse permisos de modulo

### Problema

Las rutas `/api/actions/*` verificaban autenticacion y acceso a la clinica, pero no verificaban permisos granulares antes de ejecutar acciones con `supabaseAdmin`.

Riesgo asociado:

- Un usuario con acceso a la clinica podia intentar acciones de Lara que leen retencion, forecast, margenes, inventario o simulaciones financieras.
- Acciones con efecto real podian cambiar precios, crear gastos o actualizar configuracion de tiempo si el usuario lograba llamar la API directamente.
- El permiso de Lara (`use_query_mode` / `execute_actions`) no estaba acoplado al permiso del modulo afectado.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Casos protegidos:

- `qa-viewer@laralis.test` recibe `403 Forbidden` al ejecutar acciones de consulta de Lara: retencion, comparacion de periodos, forecast, analisis de margen, optimizacion de inventario y simulacion de precio.
- `qa-viewer@laralis.test` recibe `403 Forbidden` al ejecutar acciones mutables de Lara: ajustar margen, actualizar precios masivos, cambiar precio de servicio, crear gasto y actualizar settings de tiempo.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/actions/adjust-service-margin/route.ts
apps/dental/app/api/actions/analyze-patient-retention/route.ts
apps/dental/app/api/actions/bulk-update-prices/route.ts
apps/dental/app/api/actions/compare-periods/route.ts
apps/dental/app/api/actions/create-expense/route.ts
apps/dental/app/api/actions/forecast-revenue/route.ts
apps/dental/app/api/actions/identify-underperforming-services/route.ts
apps/dental/app/api/actions/optimize-inventory/route.ts
apps/dental/app/api/actions/simulate-price-change/route.ts
apps/dental/app/api/actions/update-service-price/route.ts
apps/dental/app/api/actions/update-time-settings/route.ts
apps/dental/lib/permissions/check.ts
```

Las acciones de consulta exigen `lara.use_query_mode` mas el permiso del dominio. Las acciones mutables exigen `lara.execute_actions` mas el permiso de escritura correspondiente.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```

## 2026-05-03 - Analytics y reportes sensibles deben respetar permisos

### Problema

Varias rutas de analytics usaban `supabaseAdmin` despues de resolver la clinica activa, pero no exigian permisos granulares antes de consultar datos de marketing o financieros.

Riesgo asociado:

- Un usuario viewer podia leer CAC, ROI, predicciones de ingresos o refunds por API aunque la UI no le mostrara esos reportes.
- Los endpoints exponian informacion sensible de marketing y finanzas solo con sesion valida y contexto de clinica.
- La cobertura de permisos se concentraba en escrituras CRUD y dejaba fuera lecturas analiticas.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Casos protegidos:

- `qa-viewer@laralis.test` recibe `403 Forbidden` en CAC trend, channel ROI, marketing metrics, campaign ROI y legacy marketing ROI.
- `qa-viewer@laralis.test` recibe `403 Forbidden` en predicciones de ingresos y analytics de refunds.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/analytics/cac-trend/route.ts
apps/dental/app/api/analytics/channel-roi/route.ts
apps/dental/app/api/analytics/marketing-metrics/route.ts
apps/dental/app/api/analytics/predictions/route.ts
apps/dental/app/api/analytics/refunds/route.ts
apps/dental/app/api/marketing/campaigns/roi/route.ts
apps/dental/app/api/marketing/roi/route.ts
```

Las rutas de marketing usan `campaigns.view`. Las rutas de predicciones y refunds usan `financial_reports.view`.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```

## 2026-05-03 - Permisos backend en catalogo clinico y tratamientos

### Problema

Despues de proteger pacientes, quedaban rutas criticas usando `supabaseAdmin` sin validar permisos granulares antes de escribir:

- Insumos.
- Servicios.
- Tratamientos.

Riesgo asociado:

- Un usuario viewer podia quedar limitado en UI pero aun intentar escrituras directas contra API.
- Las pruebas de permisos no detectaban fugas fuera de pacientes.
- El sistema podia mezclar "visibilidad de boton" con seguridad real, cuando el bloqueo debe vivir tambien en backend.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Casos protegidos:

- `qa-viewer@laralis.test` conserva lectura en pacientes, insumos, servicios y tratamientos.
- `POST/PUT/DELETE /api/supplies` responde `403 Forbidden` para viewer.
- `POST/PUT/DELETE /api/services` responde `403 Forbidden` para viewer.
- `POST/PUT/DELETE /api/treatments` responde `403 Forbidden` para viewer.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/supplies/route.ts
apps/dental/app/api/supplies/[id]/route.ts
apps/dental/app/api/services/route.ts
apps/dental/app/api/services/[id]/route.ts
apps/dental/app/api/treatments/route.ts
apps/dental/app/api/treatments/[id]/route.ts
```

Cada ruta consulta `forbiddenIfMissingPermission` despues de resolver la clinica activa y antes de ejecutar lecturas o mutaciones de negocio.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```

## 2026-05-03 - Marketing y pagos de tratamientos no deben saltarse permisos

### Problema

Las rutas de marketing todavia tenian mutaciones directas con `supabaseAdmin` sin permisos granulares. En particular, las rutas dinamicas de plataformas y campanas no filtraban consistentemente por `clinic_id`; una ruta de plataformas permitia borrar categorias de sistema.

La ruta de pagos de tratamientos tambien actualizaba pagos usando `supabaseAdmin` sin exigir `treatments.mark_paid`.

Riesgo asociado:

- Un usuario sin permiso de marketing podia listar, crear, editar o borrar campanas/plataformas por API.
- Una plataforma global del sistema podia eliminarse desde una ruta dinamica.
- Un usuario sin permiso de cobro podia registrar pagos directamente contra un tratamiento.
- Los datos de marketing podian quedar expuestos o modificados fuera de la clinica activa.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Casos protegidos:

- `qa-viewer@laralis.test` recibe `403 Forbidden` en lectura y escritura de plataformas/campanas de marketing.
- `PUT/DELETE /api/marketing/platforms/:id` ya no permite saltarse permisos ni borrar plataformas de sistema.
- `PATCH/DELETE /api/marketing/campaigns/:id` queda filtrado por clinica activa y permisos.
- `POST /api/treatments/:id/payment` exige `treatments.mark_paid`.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/marketing/platforms/route.ts
apps/dental/app/api/marketing/platforms/[id]/route.ts
apps/dental/app/api/marketing/campaigns/route.ts
apps/dental/app/api/marketing/campaigns/[id]/route.ts
apps/dental/app/api/treatments/[id]/payment/route.ts
```

Marketing usa permisos `campaigns.view/create/edit/delete`. Los pagos de tratamientos usan `treatments.mark_paid`. Las rutas dinamicas ahora resuelven clinica activa con `resolveClinicContext`, filtran por `clinic_id` y mantienen las plataformas de sistema como solo lectura.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```
