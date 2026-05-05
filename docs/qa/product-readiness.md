# Product Readiness vs QA Coverage

Esta tabla evita una falsa sensacion de avance.

Una prueba puede pasar por tres razones muy distintas:

- El producto real funciona.
- El codigo existe, pero una parte externa esta mockeada.
- Solo estamos validando un contrato minimo para recordar que falta terminar el modulo.

La fuente legible por maquina vive en:

```text
docs/qa/product-readiness.json
```

## Estados

### implementationStatus

- `real`: el comportamiento existe como producto usable.
- `partial`: hay codigo util, pero faltan partes de producto, proveedor, UX o edge cases.
- `unknown`: existe superficie de codigo, pero aun no se audito lo suficiente.
- `missing`: no hay codigo de producto suficiente para probarlo como feature.

### coverageMode

- `real`: prueba el comportamiento real contra stage.
- `provider-mock`: prueba el flujo de app y base de datos, pero simula el proveedor externo.
- `contract-only`: valida contratos, guards, render o estructura, pero no prueba experiencia completa.
- `not-covered`: existe riesgo conocido sin cobertura automatizada suficiente.

## Reglas

- No marcar una capacidad como producto completo si depende de un mock de proveedor.
- No implementar una version pobre de un modulo solo para que el test pase.
- Si falta codigo estable, registrar el area como `partial`, `unknown`, `missing` o `not-covered`.
- Los mocks son validos para QA deterministico, pero deben estar nombrados como mocks y limitados a stage.
- Cada suite nueva debe decir que prueba y que no prueba.
- Los gaps P0 abiertos deben aparecer en `qa:inventory` para que no dependan de la memoria del chat.

## Lectura correcta

`coverage-matrix.json` dice que existe una prueba para una capacidad.

`product-readiness.json` dice cuanta confianza real tenemos en esa capacidad.

Ambas cosas son necesarias. Cobertura sin readiness puede mentir. Readiness sin tests se olvida.
