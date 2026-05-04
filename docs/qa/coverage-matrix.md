# QA Coverage Matrix

Esta matriz convierte la conversacion de pruebas en trabajo rastreable.

El objetivo no es recordar de memoria lo que falta. El objetivo es que un agente pueda abrir este archivo, ejecutar `qa:inventory` y saber que areas del producto todavia no tienen cobertura real.

La fuente legible por maquina vive en:

```text
docs/qa/coverage-matrix.json
```

## Flujos base

### Smoke tests rapidos

- Login con cuenta existente.
- Confirmar que no manda a onboarding/setup.
- Abrir dashboard, pacientes, tratamientos, marketing y reportes.
- No destruir datos.
- Correr rapido contra stage.

### Full lifecycle test

Este replica el flujo historico que el usuario usaba con Cypress:

- Registrarse con usuario unico.
- Confirmar el usuario en staging sin depender de Gmail.
- Hacer login.
- Completar onboarding.
- Crear workspace y clinica.
- Crear configuracion de tiempo.
- Crear costo fijo.
- Crear insumo.
- Crear servicio con insumos.
- Crear paciente.
- Crear tratamiento.
- Crear pago, gasto y campana.
- Verificar dashboard y reportes.
- Cambiar idioma.
- Limpiar datos o eliminar la cuenta.

Este flujo solo puede correr contra stage.

Cobertura actual:

- `apps/dental/cypress/e2e/stage/16-full-lifecycle-user.cy.ts` crea un usuario unico confirmado por tarea Supabase stage, inicia sesion por UI, completa onboarding real, crea workspace y clinica, siembra los requisitos minimos de setup, finaliza setup desde la UI y confirma que el workspace queda activo.
- El mismo spec usa los modulos principales como un usuario nuevo: activo/depreciacion, costo fijo, configuracion de tiempo, insumo, servicio con receta, campana, paciente atribuido, tratamiento con pago parcial, gasto vinculado, vistas de pacientes/tratamientos/marketing/gastos y cambio ES/EN sin caer en onboarding/setup.
- El cierre del flujo borra el arbol de cuenta QA con `qaDeleteUserByEmail` y vuelve a ejecutar la limpieza para confirmar que no queda usuario auth pendiente. La eliminacion self-service real queda como riesgo aparte porque `/api/account/delete` todavia no debe usarse como oraculo principal.

### CRUD por modulo

- Pacientes: crear, editar, buscar, filtrar y borrar.
- Tratamientos: crear, pagar, parcial, cambiar estado, cancelar y limpiar.
- Insumos: crear, editar, buscar, borrar y comprobar efecto en servicios.
- Servicios: crear, editar, asociar insumos y validar margenes.
- Costos fijos, activos, gastos y depreciacion.
- Marketing: campanas, fuentes, atribucion, ROI y CPA.

Cobertura actual:

- `apps/dental/cypress/e2e/stage/03-crud-lifecycle.cy.ts` cubre un ciclo destructivo contra stage para paciente, insumo, servicio y tratamiento.
- El spec crea datos unicos, actualiza registros, valida busqueda/historial, verifica que un insumo afecta el costo variable de un servicio y confirma que no se pueden borrar paciente, insumo o servicio mientras tienen dependencias.
- `apps/dental/cypress/e2e/stage/09-patient-treatment-history.cy.ts` toma un paciente QA con multiples tratamientos desde la API, verifica que `/api/treatments?patient_id=...` devuelve exactamente esos tratamientos y luego valida la ficha visual del paciente: nombre, total de tratamientos, ingreso completado, servicios, importes, estados y ausencia de scroll horizontal.
- Todavia faltan ciclos equivalentes para gastos, costos fijos, activos/depreciacion, campanas, citas, permisos y eliminacion completa de cuenta QA.

## Business scenarios

El sistema necesita una clinica QA deterministica, no datos casuales:

- 22 pacientes desde campana "Meta Mayo".
- 7 pacientes desde referidos.
- Servicios con costos variables conocidos.
- Configuracion de tiempo conocida.
- Costos fijos conocidos.
- Activos con depreciacion esperada.
- Tratamientos pagados, parciales, pendientes y cancelados.

Los tests deben validar oraculos:

- Pacientes por campana.
- Costo por adquisicion.
- Ingresos por campana.
- Margen bruto.
- Margen neto.
- Costo fijo por minuto.
- Costo variable por tratamiento.
- Punto de equilibrio.
- Utilidad esperada.
- Resultados esperados por filtro de fecha.

Cobertura actual:

- `apps/dental/cypress/e2e/stage/10-fixed-costs-cost-per-minute.cy.ts` crea un costo fijo QA, verifica que aparece en `/fixed-costs`, confirma que `GET /api/time/cost-per-minute` aumenta `monthly_fixed_cents` y recalcula `per_minute_cents`, edita el monto, vuelve a medir y luego borra el costo para confirmar que el calculo regresa al baseline.
- `apps/dental/cypress/e2e/stage/11-assets-depreciation.cy.ts` crea un activo QA, verifica que `/assets` muestra inversion y depreciacion mensual, confirma que `/api/assets/summary`, `/api/equilibrium` y `/api/analytics/profit-analysis` incorporan esa depreciacion, edita vida util/precio y luego borra el activo para volver al baseline.
- `apps/dental/cypress/e2e/stage/12-time-settings-simulations.cy.ts` fija una configuracion de tiempo QA, crea costo fijo, insumo, servicio, paciente y tratamiento controlados, verifica `GET /api/time/cost-per-minute`, `GET /api/services`, `GET /api/services/:id/cost`, `POST /api/actions/update-time-settings` en dry-run y ejecucion real, y confirma que `POST /api/actions/simulate-price-change` recalcula costos fijos, variables, utilidad y margen con la productividad vigente.
- `apps/dental/cypress/e2e/stage/13-expenses-budget-links.cy.ts` crea un costo fijo planificado, un gasto fijo vinculado, un insumo y un gasto variable vinculado al inventario; verifica `GET /api/expenses/stats`, `GET /api/analytics/expenses`, `GET /api/dashboard/expenses`, filtros de gastos, variacion planificado-vs-real y que crear/editar/borrar gastos variables actualiza el stock por `portions`.
- `apps/dental/cypress/e2e/stage/14-date-filters-coherence.cy.ts` crea datos controlados dentro y fuera de un rango, y verifica que listados, tarjetas de dashboard, graficas de revenue/servicios y reportes no mezclan fechas cuando llegan `date_from/date_to`, `start_date/end_date` o `from/to`.
- `apps/dental/cypress/e2e/stage/02-qa-business-oracles.cy.ts` y `tests/qa/qa-oracles.test.ts` sostienen los oraculos agregados de marketing, ingresos, costos variables, costos fijos asignados, margen bruto y utilidad operativa.
- `apps/dental/cypress/e2e/stage/19-reports-dashboard-oracles.cy.ts` compara mayo 2026 contra `docs/qa/oracles.json` en `/api/reports/revenue`, `/api/reports/summary`, tarjetas de dashboard y endpoints de marketing ROI/channel ROI; valida revenue, tratamientos, pacientes, gasto, ROAS, ROI y CPA de "Meta Mayo".

## Onboarding y setup

Cobertura actual:

- `apps/dental/cypress/e2e/stage/07-onboarding-setup-lifecycle.cy.ts` crea un usuario confirmado en stage mediante tarea Supabase `service_role`, inicia sesion por UI y ejecuta el onboarding real hasta crear workspace y clinica.
- El spec comprueba que el usuario nuevo termina en `/setup`, que el workspace queda `draft`, que `onboarding_completed` sigue `false` y que la clinica existe dentro de ese workspace.
- El mismo spec reproduce el riesgo que rompio produccion: usuario con clinica activa, pero con un workspace `draft` seleccionado por cookie/localStorage, entra a `/setup/cancel`.
- `/setup/cancel` ahora restaura el workspace activo y su primera clinica antes de redirigir a `/`; no cierra sesion ni deja la app apuntando al draft si existe cualquier workspace activo accesible.
- El spec verifica que el conteo de pacientes de la clinica activa se mantiene despues de cancelar setup con el draft seleccionado.
- El inventario QA exige hooks estables en onboarding y setup para que el flujo no dependa de texto traducido.

Brechas abiertas:

- Falta convertir la eliminacion self-service de cuenta en flujo real seguro; hoy el full lifecycle limpia por tarea stage `service_role` para no dejar datos huerfanos.
- Falta probar el flujo visual de `/setup/resume` con multiples drafts, archive y delete desde la pantalla.

## Multi-clinica

Cobertura actual:

- `apps/dental/cypress/e2e/stage/04-multiclinic-isolation.cy.ts` usa las dos clinicas del dataset QA.
- El spec tambien crea una clinica nueva dentro del workspace QA, la selecciona como clinica activa, crea un paciente unico, verifica que no aparece en la clinica A y limpia paciente/clinica al terminar.
- Cambia la clinica activa por API, verifica que la clinica A conserva pacientes, tratamientos, servicios y campana "Meta Mayo", y confirma que la clinica B no ve esos datos.
- Tambien consulta explicitamente la clinica A mientras la B esta activa para comprobar que `clinicId` solicitado y cookie activa se resuelven de forma coherente.
- `apps/dental/cypress/e2e/stage/20-role-matrix-and-clinic-access.cy.ts` valida que owner/admin puedan seleccionar la clinica B, que doctor/assistant/receptionist/viewer no puedan seleccionarla y que `clinicId` explicito no caiga silenciosamente a la cookie activa cuando el usuario no tiene acceso.
- `apps/dental/cypress/e2e/stage/21-lara-dashboard-multiclinic-isolation.cy.ts` pregunta a Lara en clinica A y B, valida el snapshot QA devuelto por SSE, confirma que "Meta Mayo" no se filtra a la clinica B y compara endpoints de dashboard/marketing despues de cambiar la clinica activa.
- Todavia falta crear una segunda clinica desde UI y hacer comparacion visual con screenshots de dashboards.

## Permisos

Cobertura actual:

- `apps/dental/cypress/e2e/stage/08-team-admin-invitation.cy.ts` cubre el flujo positivo de equipo: owner invita a un admin unico, el usuario acepta la invitacion, aparece como admin de workspace/clinica y puede crear un paciente real en la clinica QA.
- `apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts` inicia sesion como `qa-viewer@laralis.test` y verifica que sus permisos de pacientes, servicios, insumos y tratamientos son solo lectura, y que marketing/pagos no son accesibles para ese rol.
- `apps/dental/cypress/e2e/stage/20-role-matrix-and-clinic-access.cy.ts` valida la matriz efectiva de owner, admin, doctor, assistant, receptionist y viewer usando `/api/permissions/my`; fija permisos criticos de clinica, pagos, marketing, equipo, finanzas, Lara e import/export.
- El mismo spec comprueba que el backend bloquea con `403` escrituras de viewer en `POST /api/patients`, `POST/PUT/DELETE /api/supplies`, `POST/PUT/DELETE /api/services`, `POST/PUT/DELETE /api/treatments`, endpoints de plataformas/campanas de marketing y `POST /api/treatments/:id/payment`.
- El spec tambien bloquea lecturas sensibles de analytics/reportes para viewer: CAC trend, channel ROI, marketing metrics, campaign ROI, legacy marketing ROI, predicciones de ingresos y refunds.
- El spec tambien bloquea acciones de Lara para viewer: consultas de retencion, comparaciones financieras, forecasts, analisis de margen, optimizacion de inventario, simulaciones de precio y acciones que cambian precios, gastos o configuracion de tiempo.
- El spec tambien bloquea catalogos clinicos auxiliares para viewer: categorias de costos, fuentes de pacientes, medicamentos, recetas, PDFs de recetas, tarifas, costo por minuto, costos de servicios, recetas de insumos por servicio, chequeo de conflictos y refunds.
- El spec tambien bloquea endpoints administrativos para viewer: miembros de workspace/clinica, settings de booking/notificaciones/tiempo, correo de prueba de notificaciones, snapshots y reset de datos.
- El spec tambien bloquea dashboards financieros y export clinico para viewer: revenue, expenses, actividades mixtas, charts financieros y `GET /api/clinic/:clinicId/export`; mantiene lectura de dashboards clinicos basicos de pacientes y tratamientos.
- El spec tambien bloquea endpoints base de Lara para viewer: sesiones de consulta, `/api/ai/query`, feedback y estadisticas de feedback.
- El spec tambien bloquea invitaciones para viewer: listar, crear, cancelar y reenviar invitaciones.
- El spec tambien bloquea conversion de inbox a paciente para viewer y el inventario reconoce rutas protegidas con `withAllPermissions`/`withAnyPermission`.
- El spec tambien bloquea administracion de workspace/clinica para viewer: crear workspaces, editar/borrar workspace, crear clinicas, ejecutar lifecycle de workspace, editar/borrar clinicas y cambiar descuento global. A la vez conserva lecturas de contexto necesarias para no romper seleccion de clinica/workspace.
- El spec tambien bloquea export/import de workspace para viewer: generar bundles y ejecutar importaciones exige `export_import.export` o `export_import.import`.
- El spec tambien bloquea envios manuales de confirmacion de tratamiento para viewer; `POST /api/notifications/send-confirmation` exige permiso de creacion de tratamientos antes de leer el tratamiento o enviar correo.
- El spec tambien comprueba que el owner sigue pudiendo crear y limpiar un paciente QA, para evitar que el guard rompa permisos legitimos.
- `apps/dental/app/api/patients/*`, `apps/dental/app/api/supplies/*`, `apps/dental/app/api/services/*`, `apps/dental/app/api/treatments/*`, `apps/dental/app/api/marketing/*`, `apps/dental/app/api/prescriptions/*`, `apps/dental/app/api/categories/*`, `apps/dental/app/api/medications`, `apps/dental/app/api/patient-sources`, `apps/dental/app/api/tariffs`, `apps/dental/app/api/time/cost-per-minute`, `apps/dental/app/api/team/*`, `apps/dental/app/api/invitations`, `apps/dental/app/api/invitations/[id]/resend`, `apps/dental/app/api/settings/*`, `apps/dental/app/api/snapshots/*`, `apps/dental/app/api/reset`, `apps/dental/app/api/dashboard/*`, `apps/dental/app/api/clinic/[clinicId]/export`, `apps/dental/app/api/export/*`, `apps/dental/app/api/notifications/send-confirmation`, `apps/dental/app/api/ai/query`, `apps/dental/app/api/ai/feedback` y `apps/dental/app/api/ai/sessions/*` ya tienen guards granulares en la superficie probada de stage.
- El inventario QA ya distingue rutas publicas/booking, tokenizadas, webhook, self-service de cuenta y rutas de contexto para no mezclarlas con fugas de permisos.
- Booking publico ya tiene prueba funcional propia; todavia falta convertir la clasificacion restante en pruebas completas de push notifications y self-service de cuenta.
- Brecha abierta: el viewer puede autenticarse y operar permisos por API, pero el flujo visual estricto todavia puede caer en onboarding. El spec usa `allowSetup` para aislar la prueba de permisos backend hasta que el middleware/UI de miembros quede resuelto.

## Booking publico y notificaciones

Cobertura actual:

- `apps/dental/cypress/e2e/stage/06-public-booking-notifications.cy.ts` publica la clinica QA por slug, selecciona `Limpieza QA` como servicio publico y verifica `GET /api/public/clinic/:slug`.
- El spec consulta `GET /api/public/availability`, escoge el primer slot disponible, crea una reserva con `POST /api/public/book` y comprueba que ese slot queda ocupado despues de reservar.
- El endpoint `POST /api/public/book` ahora exige que el servicio este activo en `public_booking_services`; un servicio activo pero no publicado ya no se puede reservar por ID.
- El mismo endpoint usa la duracion real del servicio publicado para validar disponibilidad, en vez de depender solo del slot generico de la clinica.
- El spec usa `x-laralis-qa-notifications: mock` solo contra el ref Supabase stage `kafbqdliromcveojtdar`; asi verifica email, SMS y WhatsApp sin llamar Resend, Twilio ni 360dialog.
- El flujo UI completo se ejecuta en desktop, tablet y mobile: servicio, fecha, hora, datos del paciente, submit, pantalla de confirmacion y sin scroll horizontal.
- El seed QA deja `working_hours`, servicio publico y configuracion de notificaciones coherente para que futuras reconstrucciones de stage no vuelvan a dejar booking vacio.

Brechas abiertas:

- Falta probar gestion interna de solicitudes de booking por el equipo clinico: aceptar, rechazar, convertir en tratamiento y trazabilidad de estado.
- Falta probar push notifications aparte de SMS/WhatsApp/email.

## Cron jobs

Cobertura actual:

- `apps/dental/cypress/e2e/stage/17-cron-jobs.cy.ts` valida que `send-reminders`, `complete-appointments`, `recurring-expenses` y `cleanup-draft-workspaces` rechazan llamadas sin `CRON_SECRET`.
- El spec siembra un paciente, dos tratamientos y un recordatorio vencido en Supabase stage mediante tareas `service_role`; luego ejecuta `GET /api/cron/send-reminders` con `x-laralis-qa-notifications: mock` y comprueba que el recordatorio termina `sent`, que existe un email `reminder` mockeado y que `scheduled_reminders.email_notification_id` apunta al UUID real de `email_notifications`.
- El mismo spec activa `auto_complete_appointments` solo para la clinica QA, ejecuta `GET /api/cron/complete-appointments`, verifica que el tratamiento pasado cambia a `completed` y que el futuro queda `scheduled`.
- Tambien crea un gasto recurrente vencido, ejecuta `GET /api/cron/recurring-expenses` y valida que se genera exactamente un gasto hijo con `parent_expense_id`, importe y descripcion esperados.
- `GET /api/cron/cleanup-draft-workspaces?dryRun=true` queda cubierto como smoke seguro: autentica con cron, devuelve politica de expiracion y no muta datos.
- El cron de recordatorios tiene mock de proveedor limitado al ref stage `kafbqdliromcveojtdar`, para no llamar Resend/Twilio en QA.

Brechas abiertas:

- Falta probar la mutacion real de `cleanup-draft-workspaces` con workspaces draft/expired sembrados y oraculos de archive/delete.
- Falta probar push notifications por separado de email/SMS/WhatsApp.

## Lara, acciones y audio

Cobertura actual:

- `apps/dental/cypress/e2e/stage/18-lara-ai-actions.cy.ts` usa `x-laralis-qa-ai: mock` limitado al Supabase stage `kafbqdliromcveojtdar`, asi Lara responde sin llamar proveedores externos de LLM/STT/TTS.
- El mock de `/api/ai/query` sigue pasando por autenticacion, seleccion de clinica y permiso `lara.use_query_mode`; despues devuelve SSE deterministico con respuesta, metadata y accion sugerida `update_time_settings`.
- El spec abre Lara desde el FAB real, entra a modo Consultas, envia una pregunta por UI, recibe la sugerencia, confirma la accion y verifica en `/api/settings/time` que la configuracion se persistio en la base de datos.
- El mismo spec prueba que `qa-viewer@laralis.test` recibe `403 Forbidden` tanto en la consulta mockeada de Lara como en la accion mutable `update-time-settings`.
- Los mocks de `/api/ai/transcribe` y `/api/ai/synthesize` verifican entrada y salida de audio sin tocar Deepgram, Kimi ni proveedor TTS real.
- `FloatingAssistant`, `QueryAssistant` y `ActionConfirmCard` tienen hooks `data-testid` para que la suite no dependa de texto traducido al probar Lara.
- `apps/dental/cypress/e2e/stage/21-lara-dashboard-multiclinic-isolation.cy.ts` prueba Lara con clinica A y clinica B: el mock sigue pasando por permisos reales, pero ahora lee un snapshot de pacientes, tratamientos y campanas de la clinica resuelta para detectar fugas de contexto multi-clinica.

Brechas abiertas:

- Falta una prueba visual de reproduccion real del boton de audio con `Audio` mockeado en navegador.
- Falta cubrir Entry Mode completo: dictar datos, previsualizar entidad, confirmar y verificar registro creado.
- La ruta mockeada de Lara ya cubre multi-clinica a nivel API/SSE; falta repetirlo con captura visual del panel abierto y, opcionalmente, un smoke real no deterministico de proveedor.

## Gates de inventario

Cobertura actual:

- `npm --workspace @laralis/dental run qa:inventory` queda verde con 0 fallos estructurales.
- Los scripts `test:e2e:*` ya no apuntan a specs inexistentes; los aliases historicos ejecutan specs stage existentes.
- La paridad i18n queda en `missing en: 0` y `missing es: 0`.
- El inventario exige hooks UI estables en pantallas P0: login, onboarding, setup, booking publico, pacientes, insumos, servicios, tratamientos, marketing, notificaciones y shell principal.
- Todavia falta revisar calidad de traduccion completa en ingles, porque habia deuda previa con algunas cadenas inglesas heredadas en espanol.

## Visual, responsive e idiomas

Cobertura actual:

- `apps/dental/cypress/e2e/stage/15-visual-responsive-coverage.cy.ts` abre modulos criticos en desktop: dashboard, pacientes, tratamientos, servicios, insumos, gastos, costos fijos, activos, tiempo, marketing, equipo, notificaciones y booking settings.
- El mismo spec prueba las pantallas de mayor riesgo en tablet y mobile: dashboard, pacientes, tratamientos, servicios, gastos, marketing y equipo.
- En cada ruta verifica que el usuario activo no cae en `/auth`, `/onboarding` ni `/setup`, que no hay texto visible de error fatal, que el contenido principal existe con dimensiones reales y que no aparece scroll horizontal.
- El spec tambien valida que las graficas del dashboard y del tab Marketing tienen wrappers/primitivas Recharts visibles con dimensiones reales.
- El spec cambia tema claro/oscuro en dashboard y pacientes, cambia ES/EN en el shell activo, y confirma que el cambio de idioma no vuelve a exponer cancelacion/setup.
- Booking publico queda cubierto visualmente en desktop y mobile sin depender del shell autenticado.
- `apps/dental/cypress/e2e/stage/22-navigation-session-regression.cy.ts` cubre reload, atras/adelante, cambio ES/EN, persistencia de clinica activa vacia y sesion expirada: las rutas protegidas deben ir a login, no a onboarding/setup.

Brechas abiertas:

- Las graficas ya tienen presencia visual y dimensiones, pero todavia falta validar tooltips y comparar screenshots con tolerancia visual.
- La paridad de claves i18n esta cubierta por inventario; falta auditoria de calidad de traduccion y longitudes extremas en todas las pantallas.

## Capacidades que no pueden quedar fuera

- Crear otra clinica.
- Verificar que otra clinica no comparte datos con la anterior.
- Agregar pacientes dentro de la clinica correcta.
- Agregar administradores dentro de una clinica.
- Probar permisos por rol.
- Verificar que permisos tambien se aplican en backend.
- Abrir Lara.
- Probar que Lara responde.
- Probar acciones sugeridas por Lara.
- Confirmar una accion sugerida y verificar que sucede en base de datos.
- Probar que Lara respeta permisos.
- Probar entrada de audio.
- Probar salida/reproduccion de audio.
- Probar desktop, tablet y mobile.
- Detectar scroll horizontal inesperado.
- Ver tratamientos asociados a un paciente.
- Verificar filtros de fecha en tablas, tarjetas, dashboards y reportes.
- Crear insumo y comprobar que afecta servicios.
- Relacionar gastos con costos fijos o variables planificados.
- Activar y verificar depreciacion.
- Verificar modo oscuro.
- Verificar espanol e ingles.
- Verificar cron jobs.
- Verificar SMS, email o WhatsApp al generar una cita.
- Verificar booking publico completo.

## Capas esperadas

- `inventory`: detecta huecos estructurales.
- `vitest`: calculos puros, reglas de negocio y fechas.
- `api`: permisos, multi-tenancy, crons, booking y acciones.
- `cypress`: flujo de usuario real.
- `visual`: graficas, responsive, modo oscuro, idiomas.
- `provider-mock`: email, SMS, WhatsApp, IA, STT y TTS sin depender de proveedores reales.
- `database`: aislamiento de datos y efectos persistidos.

## Estado

La lista canonica actual tiene 44 capacidades en `coverage-matrix.json`.

Estados posibles:

- `planned`: definido pero no cubierto.
- `partial`: existe cobertura parcial, normalmente smoke.
- `covered`: existe prueba permanente verificable.

Ninguna capacidad P0 debe pasar a `covered` si no tiene dato semilla, oraculo o assertion observable.
