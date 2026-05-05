# QA Coverage Matrix

Esta matriz convierte la conversacion de pruebas en trabajo rastreable.

El objetivo no es recordar de memoria lo que falta. El objetivo es que un agente pueda abrir este archivo, ejecutar `qa:inventory` y saber que areas del producto todavia no tienen cobertura real.

La fuente legible por maquina vive en:

```text
docs/qa/coverage-matrix.json
```

Esta matriz responde: "hay una prueba para esta capacidad".

No responde por si sola: "el producto esta completo". Para eso se mantiene la tabla [Product Readiness vs QA Coverage](./product-readiness.md), que separa `real`, `provider-mock`, `contract-only` y `not-covered`.

Regla: una capacidad con proveedor mockeado puede estar cubierta como flujo QA, pero no debe contarse como validacion completa del proveedor real.

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

- `apps/dental/cypress/e2e/stage/00-auth-and-shell.cy.ts` cubre el smoke de autenticacion: rutas protegidas redirigen a login, el usuario QA entra al shell activo sin onboarding/setup, el registro con email existente queda en `/auth/register` con error claro y el cambio ES/EN no expone cancelacion de setup.
- `apps/dental/cypress/e2e/stage/29-core-navigation-smoke.cy.ts` abre dashboard, pacientes, tratamientos, marketing y reportes en stage, verifica shell activo, contenido principal, ausencia de error fatal y ausencia de scroll horizontal.
- `apps/dental/cypress/e2e/stage/16-full-lifecycle-user.cy.ts` crea un usuario unico confirmado por tarea Supabase stage, inicia sesion por UI, completa onboarding real, crea workspace y clinica, siembra los requisitos minimos de setup, finaliza setup desde la UI y confirma que el workspace queda activo.
- El mismo spec usa los modulos principales como un usuario nuevo: activo/depreciacion, costo fijo, configuracion de tiempo, insumo, servicio con receta, campana, paciente atribuido, tratamiento con pago parcial, gasto vinculado, vistas de pacientes/tratamientos/marketing/gastos y cambio ES/EN sin caer en onboarding/setup.
- El cierre del flujo borra el arbol de cuenta QA con `qaDeleteUserByEmail` y vuelve a ejecutar la limpieza para confirmar que no queda usuario auth pendiente. La eliminacion self-service real queda como riesgo aparte porque `/api/account/delete` todavia no debe usarse como oraculo principal.
- `apps/dental/cypress/e2e/stage/25-account-deletion-self-service.cy.ts` cubre ahora el borrado self-service real: crea un usuario descartable, crea workspace y clinica, bloquea la ruta legacy `/api/account/delete`, rechaza OTP de otro email y confirma que el OTP del usuario actual elimina auth, workspace y clinica.

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
- `apps/dental/cypress/e2e/stage/30-treatment-status-payment-lifecycle.cy.ts` cubre tratamientos programados, rechazo de sobrepago, pago parcial, pago total, cancelacion y limpieza, verificando tambien el historial del paciente.
- `apps/dental/cypress/e2e/stage/09-patient-treatment-history.cy.ts` toma un paciente QA con multiples tratamientos desde la API, verifica que `/api/treatments?patient_id=...` devuelve exactamente esos tratamientos y luego valida la ficha visual del paciente: nombre, total de tratamientos, ingreso completado, servicios, importes, estados y ausencia de scroll horizontal.
- Los ciclos equivalentes para gastos, costos fijos, activos/depreciacion, campanas, citas, permisos, pagos de tratamientos y eliminacion de cuenta QA quedan cubiertos por specs dedicados en `cypress/e2e/stage/`.
- `apps/dental/cypress/e2e/stage/33-prescriptions-medications-pdf.cy.ts` cubre recetas y medicamentos: protege APIs sin sesion, crea paciente/medicamento/receta con item, valida busqueda del medicamento, filtros por paciente/estado/fecha, detalle de receta, contrato PDF, actualizacion de estado, cancelacion y limpieza dura via tarea Supabase stage.
- El mismo spec abre `/prescriptions` en desktop y mobile para detectar regresiones de shell, setup y scroll horizontal.

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
- El mismo spec cubre `/setup/resume` con usuarios descartables sin workspace activo: crea drafts reales, continua uno hacia `/setup` con contexto de clinica, archiva otro desde la pantalla, elimina el ultimo y verifica que no queden drafts visibles ni scroll horizontal.
- El mismo spec captura y compara el baseline visual `setup-resume-multiple-drafts-desktop-dark.png` con dos drafts deterministas, enmascarando solo UUIDs y timestamps para evitar falsos positivos.
- El inventario QA exige hooks estables en onboarding y setup para que el flujo no dependa de texto traducido.

Brechas abiertas:

- La eliminacion self-service segura ya tiene spec propio con OTP generado por Supabase Admin en stage.
- `/setup/resume` queda cubierto como regresion de flujo; los baselines visuales profundos para variantes adicionales siguen siendo trabajo de endurecimiento, no un bloqueo P0.

## Multi-clinica

Cobertura actual:

- `apps/dental/cypress/e2e/stage/04-multiclinic-isolation.cy.ts` usa las dos clinicas del dataset QA.
- El spec tambien crea una clinica nueva dentro del workspace QA, la selecciona como clinica activa, crea un paciente unico, verifica que no aparece en la clinica A y limpia paciente/clinica al terminar.
- Cambia la clinica activa por API, verifica que la clinica A conserva pacientes, tratamientos, servicios y campana "Meta Mayo", y confirma que la clinica B no ve esos datos.
- Tambien consulta explicitamente la clinica A mientras la B esta activa para comprobar que `clinicId` solicitado y cookie activa se resuelven de forma coherente.
- `apps/dental/cypress/e2e/stage/20-role-matrix-and-clinic-access.cy.ts` valida que owner/admin puedan seleccionar la clinica B, que doctor/assistant/receptionist/viewer no puedan seleccionarla y que `clinicId` explicito no caiga silenciosamente a la cookie activa cuando el usuario no tiene acceso.
- `apps/dental/cypress/e2e/stage/21-lara-dashboard-multiclinic-isolation.cy.ts` pregunta a Lara en clinica A y B, valida el snapshot QA devuelto por SSE, confirma que "Meta Mayo" no se filtra a la clinica B y compara endpoints de dashboard/marketing despues de cambiar la clinica activa.
- Multi-clinica queda cubierta por API/UI y por aislamiento de Lara/dashboard; crear la segunda clinica puramente desde UI y comparar dashboards por screenshot queda como endurecimiento visual adicional.

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
- Booking publico, self-service de cuenta y permisos backend quedan cubiertos por specs dedicados. Push notifications siguen separadas de email/SMS/WhatsApp porque requieren contrato propio de navegador/subscription.

## Inbox y WhatsApp

Cobertura actual:

- `apps/dental/cypress/e2e/stage/34-inbox-whatsapp-lifecycle.cy.ts` protege las acciones de inbox sin sesion: marcar leida, asignar, alternar bot, transferir, cerrar, responder y convertir.
- El spec siembra una conversacion WhatsApp real en Supabase stage con lead, mensaje inbound, campana QA y conversacion en estado `bot`; luego valida por API que marcar como leida, asignar, retomar bot, transferir y cerrar cambian la base de datos como se espera.
- `POST /api/inbox/reply` acepta `x-laralis-qa-notifications: mock` solo cuando `NEXT_PUBLIC_SUPABASE_URL` apunta al ref stage `kafbqdliromcveojtdar`; asi se prueba respuesta outbound sin llamar proveedor externo de WhatsApp.
- El spec convierte el lead en paciente, comprueba que `leads.converted_patient_id`, `inbox_conversations.patient_id` y el paciente creado quedan enlazados, y que un segundo intento devuelve `alreadyLinked` sin duplicar paciente.
- La pagina `/inbox` se abre en desktop y mobile con datos reales de la conversacion seed, verifica mensaje visible, evita setup/onboarding accidental y detecta scroll horizontal.

Brechas abiertas:

- El webhook inbound de WhatsApp y la verificacion de firma quedan para un spec separado, porque necesitan contrato de payload de Twilio/360dialog.

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

- La gestion interna de solicitudes de booking por el equipo clinico ya tiene spec: aceptar, rechazar, convertir en tratamiento y trazabilidad de estado.
- Push notifications quedan como endurecimiento pendiente aparte de SMS/WhatsApp/email.

## Cron jobs

Cobertura actual:

- `apps/dental/cypress/e2e/stage/17-cron-jobs.cy.ts` valida que `send-reminders`, `complete-appointments`, `recurring-expenses` y `cleanup-draft-workspaces` rechazan llamadas sin `CRON_SECRET`.
- El spec siembra un paciente, dos tratamientos y un recordatorio vencido en Supabase stage mediante tareas `service_role`; luego ejecuta `GET /api/cron/send-reminders` con `x-laralis-qa-notifications: mock` y comprueba que el recordatorio termina `sent`, que existe un email `reminder` mockeado y que `scheduled_reminders.email_notification_id` apunta al UUID real de `email_notifications`.
- El mismo spec activa `auto_complete_appointments` solo para la clinica QA, ejecuta `GET /api/cron/complete-appointments`, verifica que el tratamiento pasado cambia a `completed` y que el futuro queda `scheduled`.
- Tambien crea un gasto recurrente vencido, ejecuta `GET /api/cron/recurring-expenses` y valida que se genera exactamente un gasto hijo con `parent_expense_id`, importe y descripcion esperados.
- `GET /api/cron/cleanup-draft-workspaces?dryRun=true` queda cubierto como smoke seguro: autentica con cron, devuelve politica de expiracion y no muta datos.
- El cron de recordatorios tiene mock de proveedor limitado al ref stage `kafbqdliromcveojtdar`, para no llamar Resend/Twilio en QA.

Brechas abiertas:

- `cleanup-draft-workspaces` ya tiene cobertura cron/API. Push notifications siguen pendientes por separado de email/SMS/WhatsApp.

## Lara, acciones y audio

Cobertura actual:

- `apps/dental/cypress/e2e/stage/18-lara-ai-actions.cy.ts` usa `x-laralis-qa-ai: mock` limitado al Supabase stage `kafbqdliromcveojtdar`, asi Lara responde sin llamar proveedores externos de LLM/STT/TTS.
- El mock de `/api/ai/query` sigue pasando por autenticacion, seleccion de clinica y permiso `lara.use_query_mode`; despues devuelve SSE deterministico con respuesta, metadata y accion sugerida `update_time_settings`.
- El spec abre Lara desde el FAB real, entra a modo Consultas, envia una pregunta por UI, recibe la sugerencia, confirma la accion y verifica en `/api/settings/time` que la configuracion se persistio en la base de datos.
- El mismo spec prueba que `qa-viewer@laralis.test` recibe `403 Forbidden` tanto en la consulta mockeada de Lara como en la accion mutable `update-time-settings`.
- Los mocks de `/api/ai/transcribe` y `/api/ai/synthesize` verifican entrada y salida de audio sin tocar Deepgram, Kimi ni proveedor TTS real.
- El mismo spec abre Lara desde la UI, genera una respuesta deterministica, pulsa el boton de escuchar y verifica con `Audio` mockeado en navegador que `/api/ai/synthesize` responde y que `audio.play()` se ejecuta.
- `FloatingAssistant`, `QueryAssistant` y `ActionConfirmCard` tienen hooks `data-testid` para que la suite no dependa de texto traducido al probar Lara.
- `apps/dental/cypress/e2e/stage/21-lara-dashboard-multiclinic-isolation.cy.ts` prueba Lara con clinica A y clinica B: el mock sigue pasando por permisos reales, pero ahora lee un snapshot de pacientes, tratamientos y campanas de la clinica resuelta para detectar fugas de contexto multi-clinica.

Brechas abiertas:

- Lara cubre respuesta mockeada, accion sugerida, persistencia, limites de permisos, audio input/output y panel visual. Entry Mode completo y un smoke real no deterministico de proveedor quedan como endurecimiento posterior.

## Gates de inventario

Cobertura actual:

- `npm --workspace @laralis/dental run qa:inventory` queda verde con 0 fallos estructurales.
- Los scripts `test:e2e:*` ya no apuntan a specs inexistentes; los aliases historicos ejecutan specs stage existentes.
- La paridad i18n queda en `missing en: 0` y `missing es: 0`.
- El inventario exige hooks UI estables en pantallas P0: login, onboarding, setup, booking publico, pacientes, insumos, servicios, tratamientos, marketing, notificaciones y shell principal.
- La paridad de claves i18n queda cubierta por inventario y el cambio ES/EN queda cubierto visualmente en rutas publicas y privadas. La calidad editorial completa de traduccion sigue siendo revision humana/producto, no solo automatizacion.

## Visual, responsive e idiomas

Cobertura actual:

- `apps/dental/cypress/e2e/stage/15-visual-responsive-coverage.cy.ts` abre modulos criticos en desktop: dashboard, pacientes, tratamientos, servicios, insumos, gastos, costos fijos, activos, tiempo, marketing, equipo, notificaciones y booking settings.
- El mismo spec prueba las pantallas de mayor riesgo en tablet y mobile: dashboard, pacientes, tratamientos, servicios, gastos, marketing y equipo.
- En cada ruta verifica que el usuario activo no cae en `/auth`, `/onboarding` ni `/setup`, que no hay texto visible de error fatal, que el contenido principal existe con dimensiones reales y que no aparece scroll horizontal.
- El spec tambien valida que las graficas del dashboard y del tab Marketing tienen wrappers/primitivas Recharts visibles con dimensiones reales.
- El spec cambia tema claro/oscuro en dashboard y pacientes, cambia ES/EN en el shell activo, y confirma que el cambio de idioma no vuelve a exponer cancelacion/setup.
- Booking publico queda cubierto visualmente en desktop y mobile sin depender del shell autenticado.
- `apps/dental/cypress/e2e/stage/22-navigation-session-regression.cy.ts` cubre reload, atras/adelante, cambio ES/EN, persistencia de clinica activa vacia y sesion expirada: las rutas protegidas deben ir a login, no a onboarding/setup.
- `apps/dental/cypress/e2e/stage/23-chart-tooltips-dark-mode.cy.js` valida que la grafica de ingresos/gastos en tema claro y las graficas de ROI por canal/CAC en tema oscuro tienen primitivas Recharts con dimensiones reales, que sus tooltips aparecen al interactuar y que Marketing mantiene visible la campana QA "Meta Mayo".
- `apps/dental/cypress/e2e/stage/24-visual-regression-baselines.cy.js` agrega comparacion de screenshots con baseline PNG y tolerancia visual para dashboard overview desktop claro, dashboard marketing desktop oscuro, pacientes mobile oscuro, reportes/rentabilidad, ficha de paciente con historial de tratamientos, formulario de paciente, formulario de tratamiento, booking publico mobile, panel de Lara abierto, formulario de servicio mobile, gastos, costos fijos, activos/depreciacion, calendario de tratamientos, equipo/permisos y notificaciones mobile.
- `apps/dental/cypress/e2e/stage/26-dashboard-appointments-real-data.cy.ts` siembra citas controladas y verifica que `/api/dashboard/appointments` usa tratamientos/bookings reales, excluye cancelados y bookings ya convertidos en tratamientos, y no devuelve numeros aleatorios.
- `apps/dental/cypress/e2e/stage/27-booking-request-admin-actions.cy.ts` cubre gestion interna de solicitudes publicas: listar pendientes, confirmar creando paciente/tratamiento, rechazar con motivo y bloquear cambios invalidos posteriores.
- `apps/dental/cypress/e2e/stage/28-appointment-conflict-enforcement.cy.ts` cubre conflictos de agenda contra tratamientos y solicitudes publicas, bloqueo backend de tratamientos conflictivos y bloqueo al confirmar bookings cuyo horario ya fue ocupado.

Brechas abiertas:

- Ya existe comparador visual automatico con `pixelmatch`/`pngjs` para varias superficies P0. El booking paso-a-paso, export/import, seguridad/MFA y snapshots/restore tienen smoke funcional/responsive; sus baselines visuales pixel-perfect quedan como endurecimiento posterior.
- La paridad de claves i18n esta cubierta por inventario; la auditoria editorial de traduccion y longitudes extremas en todas las pantallas queda como revision de contenido.

## Data portability, snapshots y seguridad

Cobertura actual:

- `apps/dental/cypress/e2e/stage/32-data-portability-security-snapshots.cy.ts` verifica que export/import, snapshots/restore y MFA no son accesibles sin sesion.
- El mismo spec exporta el workspace QA, valida el bundle generado y ejecuta import en `dryRun` para confirmar el contrato sin crear datos nuevos.
- Tambien crea un snapshot real de la clinica QA, consulta metadata, ejecuta restore en `dryRun` y borra el snapshot para no dejar basura permanente.
- En seguridad, inicia setup de MFA, verifica QR/secret, rechaza un codigo invalido y limpia el estado pendiente para que el usuario QA siga siendo reutilizable.
- Las pantallas `/settings/export-import`, `/settings/snapshots` y `/settings/security` se abren en desktop y mobile sin caer a onboarding/setup ni producir scroll horizontal.

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

La lista canonica actual vive en `coverage-matrix.json`; ejecuta `npm --workspace @laralis/dental run qa:inventory` para ver el conteo vigente.

Estados posibles:

- `planned`: definido pero no cubierto.
- `partial`: existe cobertura parcial, normalmente smoke.
- `covered`: existe prueba permanente verificable.

Ninguna capacidad P0 debe pasar a `covered` si no tiene dato semilla, oraculo o assertion observable.
