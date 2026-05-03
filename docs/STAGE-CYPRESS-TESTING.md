# Cypress Stage Testing

Esta guia explica como correr las pruebas E2E de Laralis Dental contra el ambiente de stage:

```text
https://laralis-monorepo-preview.vercel.app
```

El objetivo es probar flujos reales sin tocar produccion.

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
3. Si faltan, intenta reutilizar `TEST_EMAIL` y `TEST_PASSWORD`.
4. Si siguen faltando, los pide por consola y los guarda en el JSON local.
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

Correrlo con navegador visible:

```bash
npm --workspace @laralis/dental run test:e2e:stage:headed
```

## Specs actuales

Los specs de stage viven en:

```text
apps/dental/cypress/e2e/stage/
```

Actualmente cubren:

- Login y shell principal: `00-auth-and-shell.cy.ts`
- Flujo dental de lectura y regresiones basicas: `01-readonly-dental-flow.cy.ts`

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

