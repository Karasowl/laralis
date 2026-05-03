# QA Dataset

Este documento define los datos controlados que debe crear stage para que las pruebas detecten bugs reales.

La fuente legible por maquina vive en:

```text
docs/qa/dataset.json
```

## Periodo

- Rango: `2026-05-01` a `2026-05-31`.
- Dias laborables: 26.
- Minutos productivos por dia: 360.
- Minutos productivos mensuales: 9360.

## Estructura base

- Workspace: `QA Workspace Laralis`.
- Workspace slug: `qa-workspace-laralis`.
- Clinica A: `QA Dental Centro`.
- Clinica B: `QA Dental Norte`.

La clinica B existe para probar aislamiento. Nada creado en la clinica A debe aparecer en la clinica B.

## Usuarios

El dataset define seis roles:

- owner
- admin
- doctor
- assistant
- receptionist
- viewer

Estos usuarios son necesarios para probar permisos en UI, API y Lara.

## Pacientes y fuentes

- 22 pacientes desde `Meta Mayo`.
- 7 pacientes desde `Referidos`.
- 1 paciente desde `Organico`.
- Total esperado: 30 pacientes en la clinica A.

## Servicios e insumos

Servicios:

- `Resina QA`: precio 2500, duracion 60 min, costo variable 130.
- `Limpieza QA`: precio 1500, duracion 45 min, costo variable 25.
- `Endodoncia QA`: precio 6500, duracion 120 min, costo variable 330.

Insumos:

- Anestesia QA.
- Composite QA.
- Kit desechable QA.
- Kit quirurgico QA.
- Sutura QA.

La prueba debe comprobar que cambiar o crear insumos afecta el costo variable del servicio esperado.

## Costos y activos

Costos fijos mensuales:

- Renta QA: 20000.
- Asistente QA: 16000.
- Servicios QA: 4000.
- Software QA: 2800.
- Limpieza QA: 4000.
- Total: 46800.

Activo:

- Sillon Dental QA.
- Compra: 120000.
- Valor residual: 20000.
- Vida util: 60 meses.
- Depreciacion mensual esperada: 1666.67.

## Tratamientos

Tratamientos completados y pagados:

- Meta Mayo: 10 resinas, 8 limpiezas, 4 endodoncias.
- Referidos: 3 resinas, 4 limpiezas.
- Total completado pagado: 29 tratamientos.

Casos adicionales:

- 1 tratamiento parcial.
- 1 tratamiento pendiente.
- 1 tratamiento cancelado.

## Booking y notificaciones

Debe existir un caso de booking publico que espere:

- creacion de cita;
- email;
- SMS.

Los providers deben mockearse para no depender de terceros ni gastar dinero.

## Lara

Debe existir al menos un caso deterministico:

- prompt: registrar gasto de laboratorio QA por 1500 pesos;
- accion esperada: `create_expense`;
- requiere confirmacion;
- efecto esperado: gasto creado en base de datos.

## Uso esperado

Este dataset no es produccion ni demo. Es contrato de pruebas.

Un seed futuro debe poder:

1. borrar solo datos QA;
2. crear el workspace, clinicas, usuarios, pacientes, servicios, costos, tratamientos, booking y casos de Lara;
3. dejar IDs trazables;
4. permitir que Cypress/API/Vitest comparen contra `docs/qa/oracles.json`.

## Seed/reset stage

El script ejecutable vive en:

```text
apps/dental/scripts/qa-stage-seed.mjs
```

Primero se valida el plan sin tocar datos:

```bash
npm --workspace @laralis/dental run qa:seed:plan
```

Para escribir en stage, usar solo variables del proyecto stage y confirmar la accion:

```bash
cp apps/dental/.env.qa.example apps/dental/.env.qa.local
```

```powershell
$env:QA_STAGE_SEED_CONFIRM="laralis-stage"
npm --workspace @laralis/dental run qa:seed
```

El reset borra datos por el slug `qa-workspace-laralis` y por los emails `@laralis.test`. No debe usarse con datos reales ni con produccion.

Despues de sembrar, comprobar que la base stage coincide con los oraculos:

```bash
npm --workspace @laralis/dental run qa:stage:assert
```
