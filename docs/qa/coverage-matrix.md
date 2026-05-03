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

## Multi-clinica

Cobertura actual:

- `apps/dental/cypress/e2e/stage/04-multiclinic-isolation.cy.ts` usa las dos clinicas del dataset QA.
- Cambia la clinica activa por API, verifica que la clinica A conserva pacientes, tratamientos, servicios y campana "Meta Mayo", y confirma que la clinica B no ve esos datos.
- Tambien consulta explicitamente la clinica A mientras la B esta activa para comprobar que `clinicId` solicitado y cookie activa se resuelven de forma coherente.
- Todavia falta crear una segunda clinica desde UI y validar aislamiento en dashboards visuales, reportes y Lara.

## Permisos

Cobertura actual:

- `apps/dental/cypress/e2e/stage/05-permission-boundaries.cy.ts` inicia sesion como `qa-viewer@laralis.test` y verifica que sus permisos de pacientes, servicios, insumos y tratamientos son solo lectura, y que marketing/pagos no son accesibles para ese rol.
- El mismo spec comprueba que el backend bloquea con `403` escrituras de viewer en `POST /api/patients`, `POST/PUT/DELETE /api/supplies`, `POST/PUT/DELETE /api/services`, `POST/PUT/DELETE /api/treatments`, endpoints de plataformas/campanas de marketing y `POST /api/treatments/:id/payment`.
- El spec tambien bloquea lecturas sensibles de analytics/reportes para viewer: CAC trend, channel ROI, marketing metrics, campaign ROI, legacy marketing ROI, predicciones de ingresos y refunds.
- El spec tambien bloquea acciones de Lara para viewer: consultas de retencion, comparaciones financieras, forecasts, analisis de margen, optimizacion de inventario, simulaciones de precio y acciones que cambian precios, gastos o configuracion de tiempo.
- El spec tambien bloquea catalogos clinicos auxiliares para viewer: categorias de costos, fuentes de pacientes, medicamentos, recetas, PDFs de recetas, tarifas, costo por minuto, costos de servicios, recetas de insumos por servicio, chequeo de conflictos y refunds.
- El spec tambien bloquea endpoints administrativos para viewer: miembros de workspace/clinica, settings de booking/notificaciones/tiempo, snapshots y reset de datos.
- El spec tambien bloquea dashboards financieros y export clinico para viewer: revenue, expenses, actividades mixtas, charts financieros y `GET /api/clinic/:clinicId/export`; mantiene lectura de dashboards clinicos basicos de pacientes y tratamientos.
- El spec tambien bloquea endpoints base de Lara para viewer: sesiones de consulta, `/api/ai/query`, feedback y estadisticas de feedback.
- El spec tambien comprueba que el owner sigue pudiendo crear y limpiar un paciente QA, para evitar que el guard rompa permisos legitimos.
- `apps/dental/app/api/patients/*`, `apps/dental/app/api/supplies/*`, `apps/dental/app/api/services/*`, `apps/dental/app/api/treatments/*`, `apps/dental/app/api/marketing/*`, `apps/dental/app/api/prescriptions/*`, `apps/dental/app/api/categories/*`, `apps/dental/app/api/medications`, `apps/dental/app/api/patient-sources`, `apps/dental/app/api/tariffs`, `apps/dental/app/api/time/cost-per-minute`, `apps/dental/app/api/team/*`, `apps/dental/app/api/settings/*`, `apps/dental/app/api/snapshots/*`, `apps/dental/app/api/reset`, `apps/dental/app/api/dashboard/*`, `apps/dental/app/api/clinic/[clinicId]/export`, `apps/dental/app/api/ai/query`, `apps/dental/app/api/ai/feedback` y `apps/dental/app/api/ai/sessions/*` ya tienen guards granulares en la superficie probada de stage.
- Todavia falta extender el mismo patron a export/import workspace, inbox, invitaciones, workspaces/clinicas y endpoints publicos/booking.
- Brecha abierta: el viewer puede autenticarse y operar permisos por API, pero el flujo visual estricto todavia puede caer en onboarding. El spec usa `allowSetup` para aislar la prueba de permisos backend hasta que el middleware/UI de miembros quede resuelto.

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
