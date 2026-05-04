# Regression Log

Este archivo registra bugs convertidos en pruebas permanentes.

Cada entrada debe explicar:

- Que se rompia.
- Donde quedo la prueba.
- Como se verifica.
- Que riesgo protege.

## 2026-05-04 - Layout, graficas, tema e idioma deben tener guardrail visual en stage

### Problema

La suite QA tenia pruebas de datos y CRUD, pero la cobertura visual seguia dispersa. Eso dejaba abierto el riesgo de que una pantalla cargara con datos correctos, pero estuviera inutilizable por scroll horizontal, contenido principal vacio, tabs de dashboard sin graficas visibles, tema claro/oscuro roto o cambio de idioma regresando al flujo de setup.

Riesgo asociado:

- Mobile o tablet podian romper el layout sin que una prueba API lo detectara.
- Cypress podia confirmar que una ruta respondia, pero no que hubiera contenido visible.
- Las graficas podian desaparecer visualmente aunque los endpoints siguieran respondiendo.
- El cambio ES/EN podia reabrir la regresion de onboarding/setup.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/15-visual-responsive-coverage.cy.ts
```

Casos protegidos:

- Desktop abre dashboard, pacientes, tratamientos, servicios, insumos, gastos, costos fijos, activos, tiempo, marketing, equipo, notificaciones y booking settings.
- Tablet/mobile abren las pantallas con mas riesgo de layout.
- Cada ruta confirma shell activo, ausencia de errores fatales visibles, contenido principal con dimensiones reales y ausencia de scroll horizontal.
- Dashboard overview y dashboard Marketing renderizan graficas Recharts con dimensiones y primitivas visibles.
- Tema claro/oscuro e idioma ES/EN no rompen shell ni exponen cancelacion de setup.
- Booking publico funciona visualmente en desktop y mobile sin sesion autenticada.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:visual-responsive
```

## 2026-05-04 - Filtros de fecha deben aplicarse igual en listados, tarjetas, graficas y reportes

### Problema

Varios endpoints del dashboard recibian `date_from/date_to`, pero algunas graficas solo respetaban esas fechas si `period=custom`. Eso dejaba abierta la regresion donde una tarjeta podia mostrar un periodo y una grafica otro. Ademas `GET /api/treatments` no aceptaba rango de fechas, lo que hacia mas dificil probar listados de tratamientos por periodo desde QA.

Riesgo asociado:

- Revenue, gastos y tratamientos podian verse correctos en tarjetas, pero inconsistentes en graficas.
- Un servicio o tratamiento fuera del rango seleccionado podia aparecer en graficas de dashboard.
- Los reportes podian no coincidir con lo que se ve en listados y cards.
- Cypress no tenia un oraculo transversal que sembrara fechas dentro/fuera del periodo y comparara superficies.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/14-date-filters-coherence.cy.ts
```

Casos protegidos:

- Crea servicio, paciente, tratamiento y gasto en julio 2026.
- Crea servicio, paciente, tratamiento y gasto en agosto 2026.
- Verifica que el rango de julio solo suma julio en `dashboard/revenue`, `dashboard/expenses`, `dashboard/treatments`, `dashboard/patients`, `reports/revenue`, `reports/summary`, `charts/revenue`, `charts/categories`, `charts/services`, `GET /api/treatments` y `GET /api/expenses`.
- Verifica el rango de agosto con el mismo criterio para detectar contaminacion inversa.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/treatments/route.ts
apps/dental/app/api/dashboard/charts/revenue/route.ts
apps/dental/app/api/dashboard/charts/categories/route.ts
apps/dental/app/api/dashboard/charts/services/route.ts
apps/dental/hooks/use-dashboard.ts
```

Los charts ahora tratan fechas explicitas como rango dominante, aunque `period` no sea `custom`. El listado de tratamientos acepta `start_date/end_date`, `date_from/date_to` y `from/to`.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:date-filters
```

## 2026-05-03 - Activos deben traducir meses y alimentar depreciacion

### Problema

El formulario trabaja con meses de vida util, mientras la base usa `depreciation_years` y expone `depreciation_months` como columna generada. El endpoint debe traducir meses a años sin intentar insertar la columna generada, y los endpoints de negocio deben leer los meses resultantes.

Riesgo asociado:

- Un activo podia fallar al crearse si la API intentaba escribir una columna generada.
- Un activo podia verse creado, pero no sumar depreciacion mensual si la traduccion meses/años quedaba rota.
- Cambiar vida util del activo podia no recalcular punto de equilibrio.
- Profit analysis podia omitir o distorsionar la depreciacion teorica.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/11-assets-depreciation.cy.ts
```

Caso protegido:

- Lee baseline de `/api/assets/summary`, `/api/equilibrium` y `/api/analytics/profit-analysis`.
- Crea un activo QA por API con precio y vida util conocidos.
- Verifica que `/assets` muestra inversion y depreciacion mensual esperada.
- Confirma que summary, punto de equilibrio y profit analysis aumentan exactamente por la depreciacion mensual.
- Edita precio/vida util, vuelve a medir y luego elimina el activo.
- Confirma que los calculos regresan al baseline.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:assets
```

## 2026-05-03 - Costos fijos deben afectar el costo por minuto

### Problema

Los tests de calculo verificaban formulas puras, pero no el contrato completo entre CRUD de costos fijos, pantalla de costos y endpoint real de costo por minuto.

Riesgo asociado:

- Un costo fijo podia crearse visualmente pero no alimentar el calculo operativo.
- Editar un costo fijo podia dejar el costo por minuto con datos stale.
- Borrar un costo fijo podia no restaurar el baseline de calculo.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/10-fixed-costs-cost-per-minute.cy.ts
```

Caso protegido:

- Lee el baseline de `GET /api/time/cost-per-minute`.
- Crea un costo fijo QA por API y verifica que aparece en `/fixed-costs`.
- Verifica que `monthly_fixed_cents` aumenta por el monto creado y que `per_minute_cents` coincide con `monthly_fixed_cents / effective_minutes_per_month`.
- Edita el costo fijo, vuelve a verificar el calculo y luego lo elimina.
- Confirma que el costo mensual y costo por minuto regresan al baseline.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:fixed-costs
```

## 2026-05-03 - Ficha de paciente debe mostrar sus tratamientos reales

### Problema

La navegacion podia confirmar que la pantalla de pacientes cargaba, pero no que la ficha de un paciente mostrara los tratamientos asociados con numeros correctos.

Riesgo asociado:

- La tabla de historial podia quedar vacia aunque la API tuviera tratamientos.
- La ficha podia mezclar tratamientos de otra clinica o de otro paciente.
- Las tarjetas podian calcular ingresos o conteos con datos distintos a los que muestra la tabla.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/09-patient-treatment-history.cy.ts
```

Caso protegido:

- Selecciona la clinica A del dataset QA.
- Busca por API un paciente QA que tenga multiples tratamientos.
- Verifica que `GET /api/treatments?patient_id=...` devuelve exactamente los ids esperados.
- Abre `/patients/:id` y valida nombre, total de tratamientos, ingreso completado, servicios, importes, estados visibles y ausencia de scroll horizontal.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:patient-history
```

## 2026-05-03 - Invitacion de admin debe crear permisos reales

### Problema

La cobertura anterior verificaba muchos bloqueos para `viewer`, pero no demostraba el flujo positivo de equipo: que un owner pueda invitar a una persona nueva, que esa persona acepte la invitacion y que luego tenga permisos reales dentro de la clinica correcta.

Riesgo asociado:

- La UI/API podia bloquear viewers correctamente y aun asi fallar al agregar administradores.
- Una invitacion podia quedar creada pero sin membresia efectiva en `workspace_users` o `clinic_users`.
- El admin podia aparecer en listas pero no poder operar datos reales de la clinica.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/08-team-admin-invitation.cy.ts
```

Caso protegido:

- Crea un usuario confirmado unico en stage.
- El owner QA invita ese email como `admin` con acceso a la clinica A.
- Cypress recupera el token solo mediante tarea stage-only con `service_role` y verifica el lookup publico de la invitacion.
- El usuario invitado inicia sesion, acepta la invitacion, selecciona la clinica A, ve permisos `team.view`, `team.invite` y `patients.create`, aparece en miembros de workspace y clinica, y crea un paciente real.
- El spec limpia paciente, membresias, invitaciones y usuario QA al terminar.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/team/workspace-members/route.ts
apps/dental/app/api/invitations/accept/[token]/route.ts
apps/dental/cypress.config.ts
```

Las tareas Cypress stage-only ahora pueden recuperar tokens de invitacion y limpiar membresias/invitaciones de usuarios QA, ademas de borrar usuarios confirmados.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:team
```

## 2026-05-03 - Una clinica creada debe quedar seleccionable y aislada

### Problema

Crear una clinica nueva dentro de un workspace no basta si el usuario que la crea no queda con acceso efectivo a esa clinica. En stage, los owners/admins pueden tener `allowed_clinics` con una lista cerrada de clinicas; si la clinica nueva no se agrega a esa lista y no se crea membresia en `clinic_users`, `POST /api/clinics` puede rechazar la seleccion aunque la creacion haya devuelto 200.

Riesgo asociado:

- El usuario crea una segunda clinica pero no puede seleccionarla.
- Los datos creados en esa clinica quedan dificiles de administrar o limpiar.
- El aislamiento multi-clinica queda incompleto porque no se prueba el flujo real de creacion + seleccion + datos propios.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/04-multiclinic-isolation.cy.ts
```

Caso protegido:

- El owner QA crea una clinica unica dentro del workspace QA.
- La nueva clinica aparece en `GET /api/workspaces/:id/clinics`.
- La nueva clinica se puede seleccionar con `POST /api/clinics`.
- Un paciente creado en la clinica nueva aparece alli, no aparece en la clinica A, y tambien puede consultarse explicitamente por `clinicId` aunque la clinica A este activa.
- El spec limpia paciente y clinica al terminar.

### Implementacion protegida

Archivo:

```text
apps/dental/app/api/workspaces/[id]/clinics/route.ts
```

Al crear una clinica, la ruta ahora concede acceso a owners/admins activos del workspace: crea filas `clinic_users` admin y actualiza `allowed_clinics`/`clinic_ids` cuando esas listas son cerradas.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:multiclinic
```

## 2026-05-03 - Cancelar setup no debe sacar a una clinica activa

### Problema

Un usuario con una clinica activa podia terminar tocando `/setup/cancel` mientras el navegador tenia seleccionado un workspace incompleto o draft. El flujo antiguo confiaba demasiado en `workspaceId`/`selectedWorkspaceId`: si ese workspace seleccionado no estaba completado, limpiaba estado local y cerraba sesion aunque el usuario tuviera otro workspace activo con datos reales.

Riesgo asociado:

- La app podia aparentar que la clinica habia quedado en cero datos porque el contexto local apuntaba a un workspace incompleto.
- Cambios de idioma o navegacion accidental hacia setup podian dejar al usuario fuera del contexto activo.
- El bug era dificil de reproducir sin un workspace draft seleccionado artificialmente.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/07-onboarding-setup-lifecycle.cy.ts
```

Casos protegidos:

- Crea un usuario confirmado en stage, hace login y ejecuta onboarding real hasta crear workspace y clinica.
- Crea un workspace draft para el owner QA activo, fuerza cookie/localStorage hacia ese draft y visita `/setup/cancel`.
- Verifica que `/setup/cancel` restaura el workspace activo, vuelve a `/`, mantiene el shell de la app y conserva el conteo de pacientes de la clinica activa.

### Implementacion protegida

Archivos:

```text
apps/dental/app/setup/cancel/page.tsx
apps/dental/app/api/onboarding/route.ts
apps/dental/app/api/clinics/route.ts
apps/dental/app/api/workspaces/route.ts
apps/dental/app/onboarding/page.tsx
apps/dental/app/setup/page.tsx
apps/dental/app/setup/resume/page.tsx
apps/dental/components/onboarding/OnboardingModal.tsx
apps/dental/components/onboarding/WorkspaceStep.tsx
apps/dental/components/onboarding/ClinicStep.tsx
apps/dental/contexts/workspace-context.tsx
apps/dental/cypress.config.ts
```

`/setup/cancel` ahora busca workspaces activos accesibles con `/api/workspaces?list=true`, restaura `workspaceId`/`clinicId` hacia un workspace activo antes de redirigir y solo limpia estado/cierra sesion si no existe ningun workspace activo. `POST /api/onboarding` crea membresias owner/admin para que el workspace nuevo sea visible de forma consistente, `POST /api/clinics` sincroniza la cookie server-side de `workspaceId` cuando se selecciona una clinica, `GET /api/workspaces` deja de preferir un draft stale si existe un workspace activo accesible, y `WorkspaceContext` carga workspaces desde esa ruta server para no depender de lecturas RLS incompletas en cliente. Cypress usa tareas stage-only con `service_role` para crear y borrar usuarios QA sin depender de Gmail.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:onboarding
```

## 2026-05-03 - Inventario reconoce guards compuestos y conversion de inbox

### Problema

`POST /api/inbox/convert` ya estaba protegido con `withAllPermissions(['inbox.view', 'patients.create'])`, pero el inventario solo reconocia `withPermission(...)`. Eso dejaba una ruta protegida marcada como pendiente.

Tambien faltaba una prueba permanente que validara que un viewer no puede convertir leads de inbox en pacientes.

Riesgo asociado:

- El inventario producia ruido y ocultaba mejor los huecos reales.
- Una mutacion que crea pacientes desde inbox no estaba cubierta por Cypress.
- El sistema QA podia tratar `withAllPermissions` y `withAnyPermission` como rutas sin guard.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Caso protegido:

- `qa-viewer@laralis.test` recibe `403 Forbidden` en `POST /api/inbox/convert`.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/inbox/convert/route.ts
apps/dental/scripts/qa-inventory.mjs
```

El endpoint sigue usando `withAllPermissions(['inbox.view', 'patients.create'])`. El inventario ahora reconoce `withPermission`, `withAllPermissions` y `withAnyPermission` como guards estructurales.

### Verificacion

Comandos:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
npm --workspace @laralis/dental run qa:check
```

## 2026-05-03 - Administracion de workspace y clinica no debe quedar abierta a viewers

### Problema

Las rutas de workspace/clinica mezclaban dos responsabilidades distintas:

- Resolver contexto de workspace/clinica para que un miembro pueda entrar a la app.
- Mutar administracion sensible como crear clinicas, editar clinicas, borrar clinicas, cambiar descuentos o ejecutar acciones de lifecycle.

Riesgo asociado:

- Un viewer necesitaba poder listar/seleccionar su clinica para no caer en onboarding.
- Ese mismo viewer no debe poder crear workspaces, crear clinicas, editar/borrar clinicas ni tocar lifecycle por API.
- Las rutas de workspace usaban principalmente `owner_id`, lo que no modelaba bien miembros con permisos granulares.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Casos protegidos:

- `qa-viewer@laralis.test` puede resolver clinicas accesibles, seleccionar la clinica QA y listar workspaces/clinicas de contexto.
- `qa-viewer@laralis.test` recibe `403 Forbidden` al crear workspaces, editar/borrar workspace, crear clinicas, ejecutar lifecycle, editar/borrar clinicas o cambiar descuento global.

### Implementacion protegida

Archivos:

```text
apps/dental/lib/workspace-access.ts
apps/dental/app/api/workspaces/route.ts
apps/dental/app/api/workspaces/[id]/route.ts
apps/dental/app/api/workspaces/[id]/clinics/route.ts
apps/dental/app/api/workspaces/[id]/lifecycle/route.ts
apps/dental/app/api/clinics/route.ts
apps/dental/app/api/clinics/[id]/route.ts
apps/dental/app/api/clinics/discount/route.ts
```

`workspace-access` centraliza workspaces accesibles por ownership o membresia. Las rutas de contexto siguen permitiendo lectura/seleccion a miembros validos. Las mutaciones administrativas exigen owner o permiso `settings.edit` aplicado a una clinica activa del workspace.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```

## 2026-05-04 - Crons de stage deben mutar solo lo esperado

### Problema

Los cron jobs eran flujos silenciosos: podian cambiar recordatorios, citas vencidas, gastos recurrentes y drafts sin que Cypress los ejercitara. Al cubrir `send-reminders` aparecio ademas un bug concreto: el cron guardaba el `provider_message_id` como si fuera el UUID de `email_notifications`, lo que podia impedir que `scheduled_reminders.email_notification_id` quedara correctamente relacionado.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/17-cron-jobs.cy.ts
```

Casos protegidos:

- `send-reminders`, `complete-appointments`, `recurring-expenses` y `cleanup-draft-workspaces` exigen `CRON_SECRET`.
- Un recordatorio vencido se procesa con proveedor de email mockeado solo en stage y queda `sent`.
- `scheduled_reminders.email_notification_id` apunta al UUID real del row de `email_notifications`.
- Una cita pasada pasa a `completed`, pero una cita futura queda `scheduled`.
- Un gasto recurrente vencido genera exactamente un gasto hijo con `parent_expense_id`.
- La limpieza de drafts corre en `dryRun` autenticado y devuelve politica/resultados sin mutar datos.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/cron/send-reminders/route.ts
apps/dental/cypress.config.ts
apps/dental/cypress/e2e/stage/17-cron-jobs.cy.ts
```

El mock de proveedor queda limitado al Supabase stage `kafbqdliromcveojtdar`; fuera de ese ref, el cron conserva los proveedores reales.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:crons
```

## 2026-05-03 - Full lifecycle de usuario QA stage

### Problema

El sistema tenia pruebas por piezas, pero no existia una prueba que replicara el flujo historico completo que el usuario espera de Cypress:

- crear usuario nuevo,
- confirmar la cuenta sin depender de Gmail,
- hacer login,
- completar onboarding,
- terminar setup,
- crear datos reales de negocio,
- verificar pantallas principales,
- cambiar idioma,
- y limpiar todo lo creado.

Riesgo asociado:

- Un flujo podia pasar en smoke tests aunque un usuario nuevo quedara atrapado en `/setup`.
- Setup podia marcar requisitos en backend pero no permitir finalizar desde la UI.
- Los datos creados por QA podian quedar huerfanos si la limpieza no era parte del flujo.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/16-full-lifecycle-user.cy.ts
```

Casos protegidos:

- Crea un usuario unico confirmado con `qaCreateConfirmedUser`.
- Ejecuta login y onboarding reales.
- Verifica workspace `draft` antes de setup.
- Crea activo, costo fijo, configuracion de tiempo, insumo y servicio con receta para completar los requisitos de setup.
- Protege que `/api/setup/status` cuente recetas de servicio usando los servicios de la clinica, no una columna inexistente o vacia en `service_supplies`.
- Finaliza setup desde la UI y confirma workspace `active`.
- Crea campana, paciente atribuido, tratamiento con pago parcial y gasto vinculado.
- Verifica pacientes, tratamientos, marketing y gastos desde la UI.
- Cambia ES/EN sin regresar a onboarding/setup.
- Ejecuta `qaDeleteUserByEmail` y confirma que una segunda limpieza no encuentra usuario pendiente.

### Implementacion protegida

Archivo:

```text
apps/dental/app/api/setup/status/route.ts
```

La cuenta `servicesWithRecipeCount` ahora resuelve primero los servicios de la clinica activa y despues cuenta las filas `service_supplies` asociadas a esos `service_id`.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:full-lifecycle
```

## 2026-05-04 - Simulaciones de precio deben usar costos vivos de tiempo e insumos

### Problema

`simulate_price_change` leia `fixed_cost_cents` y `variable_cost_cents` directamente desde `services`. Esos campos pueden estar vacios o quedar desactualizados cuando cambian la productividad, los costos fijos, activos o los insumos asociados al servicio.

Riesgo asociado:

- Lara podia mostrar margen y utilidad incorrectos al sugerir o simular cambios de precio.
- Cambiar la configuracion de tiempo podia recalcular `/api/services` pero no necesariamente la simulacion de precio.
- Un servicio recien creado con insumos podia simular rentabilidad como si no tuviera costo.
- Stage podia rechazar cambios de tiempo cuando el esquema no tenia columnas largas como `real_hours_percentage`.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/12-time-settings-simulations.cy.ts
```

Casos protegidos:

- Configuracion de tiempo QA produce el `effective_minutes_per_month` esperado.
- Un costo fijo QA cambia `monthly_fixed_cents` y `per_minute_cents`.
- Un servicio con insumo calcula costo variable, costo fijo y costo total desde `/api/services` y `/api/services/:id/cost`.
- `POST /api/actions/simulate-price-change` devuelve utilidad y margen usando costos vivos.
- `POST /api/actions/update-time-settings` en dry-run no persiste cambios.
- La ejecucion real de `update-time-settings` actualiza productividad y la simulacion vuelve a reflejar el nuevo costo fijo por minuto.

### Implementacion protegida

Archivos:

```text
apps/dental/lib/ai/actions/pricing-actions.ts
apps/dental/app/api/settings/time/route.ts
apps/dental/app/api/services/[id]/cost/route.ts
```

La simulacion ahora recalcula costo fijo por minuto desde `settings_time`, `fixed_costs` y `assets`, y costo variable desde `service_supplies` + `supplies`. La ruta individual de costo de servicio tambien normaliza `real_pct` como decimal o porcentaje para mantenerse alineada con el resto de endpoints. La escritura de configuracion de tiempo ahora reintenta sin columnas opcionales cuando Supabase reporta que no existen en el esquema actual.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:time
```

## 2026-05-04 - Gastos variables deben actualizar inventario y no inflar presupuesto fijo real

### Problema

La integracion de gastos con insumos leia `portions_per_presentation`, pero el modelo actual de insumos usa `portions`. Segun el esquema, comprar insumos desde gastos podia no actualizar el stock correctamente. Ademas faltaba una prueba que comprobara que los gastos variables no se mezclan con el real de costos fijos planificados.

Riesgo asociado:

- Un gasto de insumos podia quedar registrado como `auto_processed` sin reflejar el stock correcto.
- Editar o borrar un gasto variable podia dejar inventario acumulado de mas o de menos.
- `vs_fixed_costs.actual` podia confundirse si los gastos variables entraban en la comparacion contra costos fijos planificados.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/13-expenses-budget-links.cy.ts
```

Casos protegidos:

- Un costo fijo planificado aumenta `vs_fixed_costs.planned`.
- Un gasto fijo vinculado aumenta `vs_fixed_costs.actual`.
- Un gasto variable vinculado a insumo aumenta el gasto total, pero no `vs_fixed_costs.actual`.
- Crear, editar y borrar el gasto variable actualiza `stock_quantity` usando `supplies.portions`.
- Filtros de gastos, analytics de gastos y dashboard de gastos reflejan el periodo controlado.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/expenses/route.ts
apps/dental/app/api/expenses/[id]/route.ts
```

Las rutas de gastos ahora calculan porciones compradas desde `portions_per_presentation` o `portions`, y actualizan inventario con tolerancia a columnas opcionales como `last_purchase_price_cents`.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:expenses
```

## 2026-05-03 - Booking publico debe reservar slots reales y mockear notificaciones

### Problema

La clasificacion de rutas publicas distinguia booking de fugas de permisos, pero no habia un flujo funcional que demostrara que un paciente puede generar una cita desde la pagina publica. El seed QA tambien dejaba booking incompleto: no publicaba servicios en `public_booking_services` y no incluia `working_hours`, asi que la pagina podia quedar sin servicios o sin horarios disponibles.

Riesgo asociado:

- La pagina publica podia cargar pero no permitir reservar.
- Un servicio activo pero no publicado podia reservarse por ID si alguien conocia el UUID.
- El flujo de booking no verificaba SMS/WhatsApp/email sin depender de proveedores reales.
- Una regresion de responsive podia romper mobile/tablet sin que el smoke test autenticado lo viera.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/06-public-booking-notifications.cy.ts
```

Casos protegidos:

- `GET /api/public/clinic/:slug` expone la clinica QA y solo el servicio publicado.
- `GET /api/public/availability` devuelve slots reales para el servicio publicado.
- `POST /api/public/book` crea una reserva pendiente y el slot queda no disponible inmediatamente.
- El header stage-only `x-laralis-qa-notifications: mock` registra resultados mockeados de email, SMS y WhatsApp sin llamar a Resend/Twilio/360dialog.
- El flujo UI completo reserva desde `/book/qa-dental-centro` en desktop, tablet y mobile y comprueba que no aparece scroll horizontal.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/public/book/route.ts
apps/dental/app/book/[slug]/page.tsx
apps/dental/app/book/[slug]/confirmation/page.tsx
apps/dental/lib/sms/service.ts
apps/dental/scripts/qa-stage-seed.mjs
```

`POST /api/public/book` ahora exige que el servicio este publicado para booking, usa la duracion del servicio para validar disponibilidad y anade SMS al flujo de solicitud recibida. El mock de notificaciones solo se activa si la app apunta al ref stage `kafbqdliromcveojtdar`.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:booking
```

## 2026-05-03 - Notificaciones sensibles y rutas publicas clasificadas

### Problema

El inventario QA marcaba rutas con `supabaseAdmin` que no tenian permiso granular ni contrato explicito. Mezclaba dos casos distintos:

- Rutas sensibles que si disparan acciones, como correo de prueba y confirmaciones de tratamiento.
- Rutas intencionalmente publicas, tokenizadas, self-service, de contexto o webhook, como booking publico, invitaciones por token, push subscription, delete-account y WhatsApp webhook.

Riesgo asociado:

- Un usuario viewer podia intentar disparar correos desde endpoints de notificaciones por API.
- El inventario generaba ruido y no diferenciaba una fuga real de una ruta publica disenada para booking o webhooks.
- Las rutas intencionales podian quedar sin contrato visible para futuros agentes.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Casos protegidos:

- `POST /api/settings/notifications/test` responde `403 Forbidden` para viewer.
- `POST /api/notifications/send-confirmation` responde `403 Forbidden` para viewer antes de leer tratamiento o enviar correo.
- `npm --workspace @laralis/dental run qa:check` exige que la superficie API quede sin rutas admin ambiguas.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/settings/notifications/test/route.ts
apps/dental/app/api/notifications/send-confirmation/route.ts
apps/dental/scripts/qa-inventory.mjs
```

Las rutas de correo usan `settings.edit` o `treatments.create`. El inventario acepta clasificaciones explicitas `@qa-public-route`, `@qa-self-service-route`, `@qa-context-route`, `@qa-token-route` y `@qa-webhook-guard` para rutas con contrato distinto a permisos granulares.

### Verificacion

Comandos:

```bash
npm --workspace @laralis/dental run qa:check
npm --workspace @laralis/dental run test:e2e:stage:permissions
```

## 2026-05-03 - Inventario QA sin fallos estructurales

### Problema

`qa:inventory` seguia fallando por tres causas que no eran bugs aislados, sino deuda del propio sistema de QA:

- 129 claves existentes en espanol no tenian equivalente efectivo en ingles.
- Los scripts historicos `test:e2e:*` apuntaban a specs Cypress que ya no existian.
- La metrica de hooks UI media todos los archivos visuales y no garantizaba hooks estables en las pantallas P0.

Riesgo asociado:

- Cambiar idioma podia ocultar errores de claves faltantes.
- Un agente o desarrollador podia ejecutar un comando Cypress documentado y recibir un fallo falso por archivo inexistente.
- Cypress seguia dependiendo demasiado de texto visible, que cambia con idioma o copy.

### Prueba permanente

Archivo:

```text
apps/dental/scripts/qa-inventory.mjs
```

Casos protegidos:

- El inventario falla si falta una clave en ingles o espanol.
- El inventario falla si un script Cypress declarado apunta a un spec inexistente.
- El inventario falla si faltan hooks P0 como `login-form-fields`, `patients-page`, `treatments-page`, `marketing-page`, `public-booking-page` o `app-main-content`.

### Implementacion protegida

Archivos:

```text
apps/dental/messages/en-overrides.json
apps/dental/package.json
apps/dental/components/layouts/AppLayout.tsx
apps/dental/components/ui/crud-page-layout.tsx
apps/dental/scripts/qa-inventory.mjs
```

Se agregaron traducciones inglesas faltantes, se redirigieron los aliases Cypress a specs stage existentes y se agregaron hooks UI estables en pantallas criticas.

### Verificacion

Comando:

```bash
npm --workspace @laralis/dental run qa:check
```

## 2026-05-03 - Export/import de workspace requiere permisos granulares

### Problema

`POST /api/export/generate` tenia una comprobacion local de owner/super_admin, separada del sistema granular. `POST /api/export/import` verificaba autenticacion, pero no exigia permiso antes de crear un workspace importado con `supabaseAdmin`.

Riesgo asociado:

- Un rol custom con `export_import.export` podia quedar bloqueado por la logica antigua.
- Un usuario con membresia de solo lectura podia intentar importar bundles por API.
- Export/import no estaba cubierto por el spec permanente de permisos de stage.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Casos protegidos:

- `qa-viewer@laralis.test` recibe `403 Forbidden` al generar un export de workspace.
- `qa-viewer@laralis.test` recibe `403 Forbidden` al intentar importar un bundle, incluso en `dryRun`.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/export/generate/route.ts
apps/dental/app/api/export/import/route.ts
apps/dental/lib/workspace-access.ts
```

Export usa `export_import.export`. Import usa `export_import.import`; si hay `targetWorkspaceId`, se valida contra ese workspace, y si es importacion nueva se exige el permiso en algun workspace accesible del usuario. Cuentas sin workspace existente siguen pudiendo usar import como bootstrap.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```

## 2026-05-03 - Gestion de invitaciones requiere permisos de equipo

### Problema

La gestion de invitaciones dependia de checks hardcodeados de rol (`owner`, `super_admin`, `admin`) en vez de usar el sistema granular de permisos.

Riesgo asociado:

- Un rol custom con permiso real de equipo podia quedar bloqueado por checks antiguos.
- Un viewer debia quedar bloqueado por backend, no solo por la UI.
- Listar, crear, cancelar o reenviar invitaciones no estaba dentro de la prueba permanente de permisos.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Casos protegidos:

- `qa-viewer@laralis.test` recibe `403 Forbidden` al listar invitaciones.
- `qa-viewer@laralis.test` recibe `403 Forbidden` al crear, cancelar o reenviar invitaciones.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/invitations/route.ts
apps/dental/app/api/invitations/[id]/resend/route.ts
```

Listar invitaciones usa `team.view`. Crear, cancelar y reenviar invitaciones usan `team.invite`. Las rutas siguen comprobando membresia activa en el workspace antes de operar.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```

## 2026-05-03 - Sesiones y consulta de Lara requieren permisos backend

### Problema

Las acciones de Lara ya estaban protegidas, pero quedaban rutas base del asistente fuera del mismo limite granular:

- Crear/listar sesiones de AI.
- Leer, archivar o borrar sesiones.
- Agregar mensajes a sesiones.
- Ejecutar `/api/ai/query`.
- Leer o escribir feedback de AI.

Riesgo asociado:

- Un viewer podia intentar abrir la puerta de Lara por APIs de sesion aunque no pudiera ejecutar acciones.
- `/api/ai/query` podia consultar datos si el usuario tenia contexto de clinica pero no permiso `lara.use_query_mode`.
- Estadisticas de feedback del asistente quedaban expuestas sin permiso de Lara.

### Prueba permanente

Archivo:

```text
apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts
```

Casos protegidos:

- `qa-viewer@laralis.test` recibe `403 Forbidden` al listar o crear sesiones de query.
- `qa-viewer@laralis.test` recibe `403 Forbidden` al llamar `/api/ai/query`.
- `qa-viewer@laralis.test` recibe `403 Forbidden` al leer estadisticas de feedback o crear feedback de Lara.

### Implementacion protegida

Archivos:

```text
apps/dental/app/api/ai/query/route.ts
apps/dental/app/api/ai/feedback/route.ts
apps/dental/app/api/ai/sessions/route.ts
apps/dental/app/api/ai/sessions/[id]/route.ts
apps/dental/app/api/ai/sessions/[id]/messages/route.ts
```

Sesiones entry usan `lara.use_entry_mode`. Sesiones query y `/api/ai/query` usan `lara.use_query_mode`. Feedback exige acceso a Lara y las estadisticas de feedback exigen `lara.use_query_mode`.

### Verificacion

Comando de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```

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
