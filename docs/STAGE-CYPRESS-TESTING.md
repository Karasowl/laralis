# Cypress Stage Testing

Esta guia explica como correr las pruebas E2E de Laralis Dental contra el ambiente de stage:

```text
https://laralis-monorepo-preview.vercel.app
```

El objetivo es probar flujos reales sin tocar produccion.

Para la estrategia completa de deteccion sistematica de bugs, leer primero:

```text
docs/qa/README.md
```

Ese documento define el QA Harness de stage: dataset controlado, oraculos, capas de tests, pruebas visuales, permisos, crons, i18n, audio, booking y regla de regresion.

## Forma rapida: doble clic

Desde Windows, abre este archivo en la raiz del repo:

```text
Abrir Cypress Stage.bat
```

La primera vez puede pedir:

- Email de stage
- Password de stage

Esos datos se guardan localmente en:

```text
apps/dental/cypress.env.json
```

Ese archivo esta ignorado por Git. No se debe commitear porque puede contener credenciales.

Luego el script abre Cypress en modo visual contra stage. Desde la UI de Cypress puedes elegir el navegador y correr los specs.

## Que hace el lanzador

El `.bat` ejecuta:

```text
scripts/open-cypress-stage.ps1
```

Ese script:

1. Lee `apps/dental/cypress.env.json`.
2. Usa `STAGE_TEST_EMAIL` y `STAGE_TEST_PASSWORD`.
3. Si faltan, los pide por consola y los guarda en el JSON local.
4. No reutiliza `TEST_EMAIL` ni `TEST_PASSWORD`, porque esas claves pueden apuntar a otra cuenta.
5. Exporta las variables para Cypress.
6. Ejecuta:

```bash
npm --workspace @laralis/dental run test:e2e:stage:open
```

## Comandos utiles

Abrir Cypress visual contra stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:open
```

Correr todo el suite de stage en modo automatico:

```bash
npm --workspace @laralis/dental run test:e2e:stage
```

Preparar el dataset QA antes de specs destructivos o de negocio:

```bash
npm --workspace @laralis/dental run qa:seed:plan
```

```bash
cp apps/dental/.env.qa.example apps/dental/.env.qa.local
```

```powershell
$env:QA_STAGE_SEED_CONFIRM="laralis-stage"
npm --workspace @laralis/dental run qa:seed
```

El seed solo debe apuntar a Supabase stage (`kafbqdliromcveojtdar`) y toma el contrato desde `docs/qa/dataset.json` + `docs/qa/oracles.json`.

Correrlo con navegador visible:

```bash
npm --workspace @laralis/dental run test:e2e:stage:headed
```

Correr solo el spec de oraculos de negocio:

```bash
npm --workspace @laralis/dental run test:e2e:stage:business
```

Correr solo el ciclo CRUD destructivo de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:crud
```

Correr solo aislamiento multi-clinica de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:multiclinic
```

Correr solo fronteras de permisos de stage:

```bash
npm --workspace @laralis/dental run test:e2e:stage:permissions
```

## Specs actuales

Los specs de stage viven en:

```text
apps/dental/cypress/e2e/stage/
```

Actualmente cubren:

- Login y shell principal: `00-auth-and-shell.cy.ts`
- Flujo dental de lectura y regresiones basicas: `01-readonly-dental-flow.cy.ts`
- Oraculos QA de negocio: `02-qa-business-oracles.cy.ts`
- Ciclo CRUD destructivo con limpieza: `03-crud-lifecycle.cy.ts`
- Aislamiento multi-clinica: `04-multiclinic-isolation.cy.ts`
- Fronteras de permisos: `05-permission-boundaries.cy.ts`

## Reglas de seguridad

- Stage debe apuntar a la base de datos de staging, no a produccion.
- No uses cuentas reales de pacientes para pruebas destructivas.
- Las credenciales viven en `apps/dental/cypress.env.json`, nunca en Git.
- Si una prueba va a crear, editar o borrar datos, debe hacerlo solo en stage.

## Si algo falla

1. Confirma que el deploy de stage abre:

```text
https://laralis-monorepo-preview.vercel.app
```

2. Confirma que `apps/dental/cypress.env.json` tiene:

```json
{
  "STAGE_TEST_EMAIL": "email-de-stage",
  "STAGE_TEST_PASSWORD": "password-de-stage"
}
```

3. Si Cypress abre pero no autentica, vuelve a ejecutar `Abrir Cypress Stage.bat` y revisa las credenciales guardadas.
4. Si la app carga pero no aparecen datos, revisa que Vercel stage tenga las variables de Supabase staging y que no este apuntando a produccion.
5. Si por error Cypress intento entrar con `TEST_EMAIL`, borra o completa las claves `STAGE_TEST_EMAIL` y `STAGE_TEST_PASSWORD` en `apps/dental/cypress.env.json`, cierra Cypress y vuelve a abrir `Abrir Cypress Stage.bat`.
