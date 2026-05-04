# QA Oracles

Los oraculos son los resultados esperados del dataset QA.

La fuente legible por maquina vive en:

```text
docs/qa/oracles.json
```

## Por que existen

Cypress no debe limitarse a confirmar que una pantalla carga.

Los tests deben poder decir:

- la campana Meta Mayo tiene 22 pacientes;
- el CPA es 300;
- el revenue de Meta Mayo es 63000;
- el ROI es 854.55%;
- el costo fijo por minuto es 5;
- el margen bruto es 95.6732%;
- el dashboard muestra los numeros correctos para mayo 2026;
- los filtros de fecha cambian los mismos numeros de forma coherente.

## Numeros base

Periodo: mayo 2026.

Pacientes:

- Total: 30.
- Meta Mayo: 22.
- Referidos: 7.
- Organico: 1.

Tratamientos:

- Total: 32.
- Completados pagados: 29.
- Parcial: 1.
- Pendiente: 1.
- Cancelado: 1.

Tiempo:

- Dias laborables: 26.
- Minutos productivos por dia: 360.
- Minutos productivos mensuales: 9360.

Costos fijos:

- Total mensual: 46800.
- Costo por minuto: 5.

## Servicios

Resina QA:

- Precio: 2500.
- Costo variable: 130.
- Costo fijo asignado: 300.
- Neto por tratamiento: 2070.

Limpieza QA:

- Precio: 1500.
- Costo variable: 25.
- Costo fijo asignado: 225.
- Neto por tratamiento: 1250.

Endodoncia QA:

- Precio: 6500.
- Costo variable: 330.
- Costo fijo asignado: 600.
- Neto por tratamiento: 5570.

## Marketing

Meta Mayo:

- Pacientes: 22.
- Gasto: 6600.
- Revenue: 63000.
- CPA: 300.
- ROAS: 9.5455.
- ROI: 8.5455.
- ROI porcentual: 854.55%.

Referidos:

- Pacientes: 7.
- Revenue: 13500.

## Financiero

- Revenue completado: 76500.
- Cash cobrado incluyendo parcial: 77750.
- Costo variable completado: 3310.
- Gross profit: 73190.
- Gross margin: 95.6732%.
- Costo fijo asignado a tratamientos: 9000.
- Service net profit: 64190.
- Costos fijos mensuales: 46800.
- Marketing spend: 6600.
- Gastos reales registrados en mayo: 10900.
- Operating profit: 19790.
- Operating margin: 25.8693%.

## Punto de equilibrio

- Margen de contribucion promedio: 2523.79.
- Break-even solo con costos fijos: 19 tratamientos.
- Break-even con costos fijos + marketing: 22 tratamientos.

## Visual

Las vistas criticas deben validarse en:

- mobile;
- tablet;
- desktop;
- light mode;
- dark mode;
- espanol;
- ingles.

## Tolerancias

- Moneda: 1 centavo.
- Porcentaje: 0.01.
- Graficas: 5 pixeles.
