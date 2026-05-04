# Laralis Stage QA Harness

Este documento es la memoria operativa del sistema de deteccion de bugs de Laralis Dental.

Si un agente futuro pierde el contexto del chat, debe empezar aqui antes de tocar pruebas, stage, Cypress, Vitest, datos QA, crons, permisos, dashboards, i18n, booking, SMS, audio o Lara.

La matriz canonica de capacidades vive en [QA Coverage Matrix](./coverage-matrix.md). Su version legible por maquina vive en `docs/qa/coverage-matrix.json` y debe ser revisada por `qa:inventory`.

El dataset canonico vive en [QA Dataset](./dataset.md). Los resultados esperados viven en [QA Oracles](./oracles.md).

## Objetivo

El objetivo no es arreglar bugs aislados. El objetivo es construir un sistema que detecte sistematicamente bugs presentes y futuros.

Cada bug importante debe terminar convertido en una prueba permanente. Si un flujo se rompe una vez, el sistema de QA debe poder detectar esa misma clase de rotura antes de que llegue a produccion.

## Ambiente de trabajo

- App: `apps/dental`
- Branch de trabajo: `codex/monorepo-suite`
- Stage URL: `https://laralis-monorepo-preview.vercel.app`
- Base de datos stage: Supabase stage separado de produccion
- Regla principal: las pruebas destructivas solo corren contra stage

No usar produccion para crear, editar o borrar datos durante pruebas automatizadas.

## Principio central

Mas clicks no equivalen a mas calidad.

Para detectar bugs reales hacen falta tres piezas:

1. Dataset QA controlado.
2. Oraculos con resultados esperados.
3. Tests por capas que validen datos, calculos, UI, permisos y efectos externos.

Sin oraculos, Cypress solo confirma que una pantalla abre. Con oraculos, el sistema confirma que la pantalla muestra el numero correcto, bajo el filtro correcto, para el usuario correcto y con los permisos correctos.

## Capas del sistema

### 1. Mapa de riesgo

Mantener una matriz viva de modulos y riesgos:

- Auth, registro, login, recuperacion de password y cuentas existentes.
- Onboarding, workspace activo, workspace incompleto y cancelacion.
- Multi-clinica, aislamiento de datos y cambio de clinica.
- Usuarios, roles, permisos y administradores por clinica.
- Pacientes, historial, tratamientos asociados y busqueda.
- Tratamientos, pagos, estados, presupuestos y cancelaciones.
- Insumos, servicios, costos variables y margen por servicio.
- Gastos, costos fijos, costos variables, activos y depreciacion.
- Dashboard, reportes, marketing, graficas y filtros de fecha.
- Booking publico, disponibilidad, citas, email, SMS y WhatsApp.
- Crons: recordatorios, citas completadas, gastos recurrentes, snapshots y limpieza de drafts.
- Lara bot, acciones sugeridas, confirmacion de acciones, audio input y audio output.
- Responsive: mobile, tablet y desktop.
- Tema claro/oscuro.
- i18n: espanol, ingles y claves faltantes.

La lista rastreable de capacidades esta en [QA Coverage Matrix](./coverage-matrix.md). No reemplazarla por notas sueltas en chat.

### 2. Dataset QA controlado

Crear una clinica QA con datos exactos, no aleatorios:

- Campana "Meta Mayo" con 22 pacientes atribuidos.
- Fuente "Referidos" con 7 pacientes.
- Servicios con precios, insumos y costos variables conocidos.
- Costos fijos mensuales conocidos.
- Activos con depreciacion esperada.
- Tratamientos pagados, parciales, pendientes y cancelados.
- Citas futuras para recordatorios.
- Usuarios con roles distintos: owner, admin, doctor, assistant, receptionist y viewer.
- Dos clinicas separadas para probar aislamiento de datos.

El dataset debe poder resetearse y recrearse por script.

Definicion completa: [QA Dataset](./dataset.md)

### 3. Oraculos

Para cada dataset debe existir una tabla de resultados esperados:

- Pacientes por campana.
- Ingresos por campana.
- ROI y costo de adquisicion.
- Margen bruto.
- Margen neto.
- Costo fijo por minuto.
- Costo variable por tratamiento.
- Depreciacion por periodo.
- Punto de equilibrio.
- Utilidad esperada.
- Resultados esperados por filtro de fecha.
- Acciones permitidas y prohibidas por rol.

Los tests deben comparar contra esos valores, no contra "la pantalla cargo".

Definicion completa: [QA Oracles](./oracles.md)

### 4. Tests unitarios

Usar Vitest para funciones puras:

- Fechas y zonas horarias.
- Filtros de fecha.
- Margenes.
- Punto de equilibrio.
- Depreciacion.
- Costos fijos y variables.
- Rentabilidad por servicio.
- Atribucion de marketing.
- Simuladores de tiempo, beneficio y costos.

### 5. Tests API e integracion

Validar endpoints con datos reales o mocks controlados:

- Auth y sesiones.
- Multi-tenancy y aislamiento de datos.
- Permisos por rol.
- CRUD por modulo.
- Booking publico.
- Crons con `CRON_SECRET`.
- Acciones de Lara.
- Email, SMS, WhatsApp y audio con providers mockeados.

Los tests que solo mockean todo el backend sirven para logica local, pero no sustituyen pruebas contra stage.

### 6. Tests E2E con Cypress

Cypress debe cubrir flujos completos:

- Registro de usuario QA.
- Confirmacion controlada de auth en stage.
- Login.
- Onboarding.
- Crear workspace y clinica.
- Crear segunda clinica y verificar aislamiento.
- Crear usuarios/administradores y permisos.
- Crear insumos.
- Crear servicios usando esos insumos.
- Crear pacientes.
- Crear tratamientos y pagos.
- Crear gastos y relacionarlos con costos.
- Cambiar idioma.
- Cambiar tema.
- Abrir dashboards y validar numeros.
- Probar responsive en mobile, tablet y desktop.
- Eliminar o limpiar los datos creados.

Los specs deben vivir bajo `apps/dental/cypress/e2e/stage/` cuando dependan de stage.

### 7. Tests visuales

Para graficas y layout, Cypress debe capturar evidencia visual:

- Dashboard financiero.
- Marketing.
- Reportes.
- Tratamientos por paciente.
- Formularios criticos.
- Mobile, tablet y desktop.
- Tema claro y oscuro.
- Espanol e ingles.

Las capturas deben detectar:

- Pantallas en blanco.
- Graficas sin barras/lineas/segmentos.
- Scroll horizontal no esperado.
- Texto cortado.
- Controles superpuestos.
- Layout roto en mobile.

### 8. Test hooks

La UI necesita selectores estables. Agregar `data-testid` en componentes criticos antes de escribir specs fragiles.

Prioridad:

- Sidebar y selector de clinica.
- Selector de idioma.
- Selector de tema.
- Tablas de pacientes, tratamientos, insumos, servicios y gastos.
- Formularios de alta/edicion.
- Graficas y tarjetas KPI.
- Bot de Lara.
- Controles de audio.
- Booking publico.

## Regla de regresion

Cada bug reportado debe convertirse en una prueba.

Flujo obligatorio:

1. Reproducir bug en stage o test local.
2. Escribir test que falle.
3. Arreglar bug.
4. Verificar que el test pasa.
5. Mantener el test para siempre salvo que el comportamiento esperado cambie.

Registro de regresiones convertidas en pruebas: [Regression Log](./regression-log.md)

## Hallazgos iniciales que ya deben convertirse en trabajo QA

Estos hallazgos salieron de una auditoria no destructiva del codigo:

- `npm --workspace @laralis/dental run test:unit` fallaba en `apps/dental/lib/calc/dates.test.ts`; ya se convirtio en regresion documentada.
- El fallo apuntaba a fechas y zonas horarias: `new Date('YYYY-MM-DD')` mas `getDay()` podia mover lunes a domingo segun timezone.
- `npm --workspace @laralis/dental run i18n:check` reporta 129 claves faltantes en ingles.
- `apps/dental/package.json` tiene scripts E2E para auth, patients, supplies, services, treatments, settings y marketing, pero esos specs no existen.
- Hay muchos endpoints API y solo una parte usa `withPermission`; se necesita matriz de permisos y pruebas por rol.
- Los cron routes usan `requireCronAuth`, pero falta probar efectos reales con datos QA.
- La UI tiene pocos `data-testid`, lo que vuelve fragiles las pruebas de Cypress.

## Primeros entregables

1. Mantener un inventario QA ejecutable que detecte huecos sistematicos.
2. Crear el seed/reset de dataset QA stage.
3. Escribir oraculos matematicos del dataset QA.
4. Agregar `data-testid` en superficies criticas.
5. Convertir los scripts E2E declarados en specs reales.
6. Agregar pruebas de i18n como gate.
7. Agregar smoke de crons con `CRON_SECRET`.
8. Agregar visual/responsive checks para dashboard, marketing y pacientes.
9. Convertir bugs reales en regresiones permanentes.

## Comandos relacionados

Generar inventario QA de brechas actuales:

```bash
npm --workspace @laralis/dental run qa:inventory
```

Modo estricto para CI/agentes:

```bash
npm --workspace @laralis/dental run qa:inventory:strict
```

El reporte se escribe en:

```text
docs/qa/generated/inventory-report.md
```

Planificar el seed/reset de stage sin tocar la base de datos:

```bash
npm --workspace @laralis/dental run qa:seed:plan
```

Ejecutar seed/reset contra stage requiere confirmacion explicita y variables de stage en `apps/dental/.env.qa.local` o en el shell:

```bash
cp apps/dental/.env.qa.example apps/dental/.env.qa.local
```

```powershell
$env:QA_STAGE_SEED_CONFIRM="laralis-stage"
npm --workspace @laralis/dental run qa:seed
```

El script se niega a escribir si `NEXT_PUBLIC_SUPABASE_URL` no apunta al ref de stage `kafbqdliromcveojtdar`, si falta `SUPABASE_SERVICE_ROLE_KEY`, o si se intenta cargar como produccion. No carga archivos `.env.production*`.

Resetear solo los datos QA sin recrearlos:

```powershell
$env:QA_STAGE_SEED_CONFIRM="laralis-stage"
npm --workspace @laralis/dental run qa:seed:reset
```

Verificar que la base stage sembrada coincide con los oraculos:

```bash
npm --workspace @laralis/dental run qa:stage:assert
```

Verificar los oraculos localmente, sin base de datos:

```bash
npm --workspace @laralis/dental run qa:oracles
```

Chequeo local compuesto:

```bash
npm --workspace @laralis/dental run qa:check
```

Las specs que crean usuarios/invitaciones con `cy.task` necesitan credenciales admin del Supabase de stage. Configuralas solo localmente, por variables de entorno o en `apps/dental/cypress.env.json`:

```json
{
  "CYPRESS_SUPABASE_URL": "https://kafbqdliromcveojtdar.supabase.co",
  "CYPRESS_SUPABASE_SERVICE_ROLE_KEY": "stage-service-role-key"
}
```

Abrir Cypress visual contra stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:open
```

Correr Cypress stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage
```

Correr solo el spec de oraculos de negocio contra stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:business
```

Correr solo el ciclo CRUD destructivo contra stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:crud
```

Correr solo tiempo, costo por minuto y simulaciones de precio contra stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:time
```

Correr solo gastos, presupuesto fijo e inventario de insumos contra stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:expenses
```

Correr solo coherencia de filtros de fecha contra stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:date-filters
```

Correr solo cobertura visual/responsive contra stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:visual-responsive
```

Correr solo Lara, acciones confirmables y audio mockeado contra stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:lara
```

Correr solo reportes, dashboard y marketing contra oraculos de negocio:

```bash
npm --workspace @laralis/dental run test:e2e:stage:reports
```

Correr solo aislamiento multi-clinica contra stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:multiclinic
```

Correr solo matriz de roles y acceso multi-clinica contra stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:roles
```

Correr solo aislamiento multi-clinica de Lara, dashboard y marketing contra stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:lara-isolation
```

Correr solo fronteras de permisos contra stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```

Correr unit tests de calculos:

```bash
npm --workspace @laralis/dental run test:calc
```

Nota: `test:unit` tambien aplica el umbral global de coverage configurado en Vitest. `test:calc` verifica comportamiento funcional sin mezclarlo con el gate de coverage.

Revisar i18n:

```bash
npm --workspace @laralis/dental run i18n:check
```

## Definicion de listo

Este sistema estara listo cuando un agente pueda ejecutar un comando de QA completo y obtener:

- Resultado de unit tests.
- Resultado de API/integration tests.
- Resultado de Cypress stage.
- Resultado de i18n.
- Evidencia visual de pantallas criticas.
- Lista clara de fallos con modulo, ruta, usuario, datos y screenshot/video cuando aplique.

Hasta que eso exista, Laralis no tiene una red completa de deteccion de bugs; solo tiene pruebas parciales.
