# Devlog: Fix Integer Overflow en Campos Monetarios

**Fecha**: 2025-09-18
**Task ID**: HOTFIX-20250918-integer-overflow
**PR**: Pending

## Contexto

Se detectó un error crítico en producción donde valores monetarios grandes causaban overflow de integer en la base de datos PostgreSQL. El error específico era: "value '342343420000' is out of range for type integer".

## Problema

1. **Límite de INTEGER en PostgreSQL**: 2,147,483,647 (aproximadamente $21,474,836.47 en centavos)
2. **Doble conversión en frontend**: El código estaba convirtiendo pesos a centavos dos veces
3. **Validaciones inadecuadas**: Las validaciones del frontend no prevenían valores que excedían el límite

## Causa Raíz

1. **Tipo de dato inadecuado**: Las tablas usaban INTEGER para valores monetarios cuando deberían usar BIGINT
2. **Bug en fixed-costs/page.tsx**: El código aplicaba una conversión adicional después de que Zod ya había transformado pesos a centavos
3. **Validaciones desactualizadas**: Las validaciones verificaban contra el límite de INTEGER en lugar de usar Number.MAX_SAFE_INTEGER

## Qué Cambió

### 1. Migración de Base de Datos (BIGINT)

**Archivo**: `supabase/migrations/26_fix_integer_overflow_bigint.sql`

Convertimos todos los campos monetarios de INTEGER a BIGINT en las siguientes tablas:
- `fixed_costs.amount_cents`
- `supplies.price_cents`
- `services.fixed_cost_per_minute_cents`, `variable_cost_cents`, `price_cents`
- `treatments.fixed_cost_per_minute_cents`, `variable_cost_cents`, `price_cents`
- `expenses.amount_cents`
- `assets.purchase_price_cents`, `monthly_depreciation_cents`, `disposal_value_cents`
- `tariffs.fixed_cost_per_minute_cents`, `variable_cost_cents`, `price_cents`, `rounded_price_cents`
- `marketing_campaigns.budget_cents`, `spent_cents` (si existe)

### 2. Actualización de Validaciones

**Archivo**: `web/lib/zod.ts`

```typescript
// Antes (límite INTEGER)
.refine((v) => Math.round(v * 100) <= 2_147_483_647, {
  message: 'Amount too large',
})

// Después (límite BIGINT / JavaScript safe)
.refine((v) => Math.round(v * 100) <= Number.MAX_SAFE_INTEGER, {
  message: 'Amount too large',
})
```

### 3. Corrección de Doble Conversión

**Archivo**: `web/app/fixed-costs/page.tsx`

```typescript
// Antes (doble conversión incorrecta)
amount_cents: Math.round(Number(data.amount_pesos))

// Después (ya transformado por Zod)
amount_cents: data.amount_pesos as any
```

### 4. Scripts de Verificación

- **`supabase/scripts/27-check-integer-overflow.sql`**: Detecta valores problemáticos antes de migrar
- **`supabase/migrations/26_rollback_bigint_to_integer.sql`**: Script de rollback en caso de problemas

## Archivos Tocados

1. `supabase/migrations/26_fix_integer_overflow_bigint.sql` (creado)
2. `supabase/migrations/26_rollback_bigint_to_integer.sql` (creado)
3. `supabase/scripts/27-check-integer-overflow.sql` (creado)
4. `web/lib/zod.ts` (modificado - 3 cambios)
5. `web/app/fixed-costs/page.tsx` (modificado - 2 cambios)
6. `docs/devlog/2025-09-18-fix-integer-overflow.md` (creado)

## Antes vs Después

### Antes
- Límite máximo: $21,474,836.47 (INTEGER)
- Error al guardar valores grandes
- Doble conversión causaba valores incorrectos

### Después
- Límite máximo: $92,233,720,368,547,758.07 (BIGINT)
- Manejo correcto de valores grandes
- Conversión simple y correcta de pesos a centavos

## Cómo Probar

1. **Verificar problemas actuales**:
```sql
-- Ejecutar en Supabase SQL Editor
-- Copiar contenido de: supabase/scripts/27-check-integer-overflow.sql
```

2. **Aplicar migración**:
```sql
-- Ejecutar en Supabase SQL Editor
-- Copiar contenido de: supabase/migrations/26_fix_integer_overflow_bigint.sql
```

3. **Probar en la aplicación**:
   - Ir a Costos Fijos
   - Intentar crear un costo de $50,000,000 pesos
   - Debe guardarse correctamente sin errores

4. **Verificar valores guardados**:
```sql
SELECT id, concept, amount_cents, amount_cents / 100.0 as amount_pesos
FROM fixed_costs
WHERE amount_cents > 1000000000
ORDER BY amount_cents DESC;
```

## Riesgos y Rollback

### Riesgos
- **Mínimos**: BIGINT es compatible hacia atrás con INTEGER
- **Performance**: Negligible, BIGINT usa 8 bytes vs 4 bytes de INTEGER
- **Compatibilidad**: JavaScript maneja BIGINT hasta Number.MAX_SAFE_INTEGER sin problemas

### Rollback
Si hay problemas (muy improbable):
1. Verificar que no hay valores > 2,147,483,647
2. Ejecutar script de rollback: `26_rollback_bigint_to_integer.sql`

## Siguientes Pasos

- [x] TASK-20250918-01: Crear migración BIGINT
- [x] TASK-20250918-02: Actualizar validaciones frontend
- [x] TASK-20250918-03: Corregir bug de doble conversión
- [ ] TASK-20250918-04: Aplicar migración en producción
- [ ] TASK-20250918-05: Monitorear por 24 horas
- [ ] TASK-20250918-06: Auditar otros posibles overflows

## Lecciones Aprendidas

1. **Siempre usar BIGINT para valores monetarios** - El costo adicional de almacenamiento es mínimo comparado con el riesgo
2. **Cuidado con transformaciones en Zod** - Si Zod transforma valores, no transformar nuevamente en el handler
3. **Validaciones deben ser consistentes** - Frontend y backend deben tener los mismos límites
4. **Tests para valores extremos** - Agregar tests que prueben valores cercanos a los límites

## Referencias

- [PostgreSQL Integer Types](https://www.postgresql.org/docs/current/datatype-numeric.html)
- [JavaScript Number.MAX_SAFE_INTEGER](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)
- [Zod Transform Documentation](https://zod.dev/?id=transform)