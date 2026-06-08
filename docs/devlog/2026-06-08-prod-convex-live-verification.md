# Verificación en producción viva: la app corre 100% sobre Convex (datos)

**Fecha:** 2026-06-08
**Tipo:** Verificación / QA de producción (sin cambio de código de app)
**Runbook reusable:** [`docs/IMPORTANT/PROD-CONVEX-VERIFICATION-RUNBOOK.md`](../IMPORTANT/PROD-CONVEX-VERIFICATION-RUNBOOK.md)
**TASK ids:** seguimiento de la migración Supabase→Convex (Fase F write-cutover ya ejecutado)

---

## Contexto

Producción ya estaba con las flags de datos en Convex (`DATA_READ_BACKEND=convex`,
`DATA_WRITE_MODE=convex`, `DATA_WRITE_MODE_STORAGE=convex`) tras el write-cutover. Faltaba lo más
importante: **demostrar, de forma automatizada, que el sitio vivo realmente lee y escribe en Convex**
— no a ojo, no pidiéndole al usuario que haga clics.

## Problema

La suite Cypress de convex-only estaba hardcodeada a la cuenta **real de la doctora**
(`conladoctoralara@gmail.com`) y a un flujo de login convex-auth que **no existe en producción**
(prod sigue con login Supabase, `AUTH_BACKEND=dual`). Además, el usuario de prueba documentado en
`cypress.env.json` (`ismaelguimarais@gmail.com`) pertenece a **otro proyecto Supabase**
(`ojlfihowjakbgobbrwjz`) y **no existe** en el Supabase de producción (`julrghzzqdgdwqaongct`). O sea:
no había, de entrada, una credencial válida para entrar al sitio vivo sin tocar la cuenta de la doctora.

## Causa raíz

- Los specs commiteados fueron escritos para el entorno **dev** convex-auth, no para producción.
- Prod nunca sembró Convex-Auth (su tabla `users` estaba vacía) ni tiene llaves JWT de convex-auth
  (solo `CONVEX_AUTH_BRIDGE_SECRET`), porque por diseño el login de prod sigue en Supabase.

## Qué cambió (solo verificación + infra de prueba)

1. **Cuenta de prueba habilitada en prod** sin tocar la de la doctora:
   - Se reseteó el password Supabase de `adventismael@gmail.com` (UUID `61797a50-…`) vía admin API
     usando la service-role key de prod. Es cuenta de prueba (Isma Prueba, clínica `4d65a236`).
   - (Inerte para el sitio vivo) Se sembró la tabla `users` de Convex prod desde el mirror (3 filas,
     sin passwords, idempotente) y se enlazó un password authAccount solo para la cuenta de prueba —
     útil únicamente cuando se ejecute el cutover de auth; el sitio vivo usa login Supabase y no lee
     esa tabla.
2. **Tres specs nuevos parametrizados por env** (sin secretos en el repo), apuntables a cualquier
   `baseUrl`:
   - `cypress/e2e/prod-convex-read-smoke.cy.ts`
   - `cypress/e2e/prod-convex-write-lifecycle.cy.ts`
   - `cypress/e2e/prod-convex-write-features.cy.ts`
3. **Runbook reusable** `docs/IMPORTANT/PROD-CONVEX-VERIFICATION-RUNBOOK.md` con todas las coordenadas
   (deployments Convex prod `superb-grouse-940` vs dev `quaint-blackbird-737`, el `.vercel` en la raíz
   → `--cwd C:/dev/laralis`, el gotcha del Supabase de prod, las cuentas, los flags).

## Archivos tocados

- **Nuevos:** `apps/dental/cypress/e2e/prod-convex-read-smoke.cy.ts`,
  `apps/dental/cypress/e2e/prod-convex-write-lifecycle.cy.ts`,
  `apps/dental/cypress/e2e/prod-convex-write-features.cy.ts`,
  `docs/IMPORTANT/PROD-CONVEX-VERIFICATION-RUNBOOK.md`,
  `docs/devlog/2026-06-08-prod-convex-live-verification.md`
- **Sin cambios de código de app.** No requiere version bump (no hay cambio observable para el usuario).

## Antes vs Después

- **Antes:** "creo que prod corre en Convex" — verificado solo a mano / por export de datos.
- **Después:** suite automatizada verde contra `https://laralis.vercel.app`:
  - Lectura: **58/58** GET sin 5xx (51×200 con datos reales de Convex; 7×400 son endpoints que exigen
    query params — validación correcta, no crash).
  - Escritura core: **9/9** crear+borrar (incl. cadena completa insumo→servicio→receta→paciente→
    tratamiento; el tratamiento exige receta o devuelve 412).
  - Escritura features: **4/4** (platforms, medications, campaigns, prescriptions).

## Cómo probar

Ver el runbook (los 4 comandos del TL;DR). Resumen: `vercel env pull --cwd C:/dev/laralis` para
confirmar flags, reset de password de la cuenta de prueba vía admin API, y los tres
`npx cypress run --spec …` con `CYPRESS_baseUrl=https://laralis.vercel.app`.

## Riesgos y rollback

- Huella cero: los smokes borran lo que crean (salvo `medications` y `patient_sources`, POST-only sin
  delete: dejan una fila `E2E-…` por corrida en la clínica de prueba).
- No tocan a la doctora ni su clínica. No cambian código desplegado → nada que revertir.
- El archivo temporal con la service-role key (`/tmp/prod.env`) debe borrarse al terminar.

## Siguientes pasos

- El **cutover de auth** (`AUTH_BACKEND=convex`) es la última dependencia de Supabase (el login).
  Diferido por decisión del usuario. Runbook: `docs/IMPORTANT/CONVEX-AUTH-CUTOVER-RUNBOOK.md`.
- Tras el cutover de auth, la prueba de "quitar llaves Supabase" → decomisión.
