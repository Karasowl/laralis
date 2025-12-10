---
id: ISSUE-021
title: Configuración de moneda por clínica
status: open
priority: P3
area: feature
estimate: L (4-6 horas)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Configuración de moneda por clínica

## Problema
MXN está hardcodeado en múltiples lugares. Clínicas en otros países (USD, COP, ARS, EUR) no pueden usar la app correctamente.

## Ubicaciones Hardcodeadas

```typescript
// lib/money.ts
export function formatCurrency(cents: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',  // ← HARDCODED
  }).format(cents / 100)
}

// expenses/page.tsx
<span>MXN</span>  // ← HARDCODED
```

## Solución

### 1. Migración SQL

```sql
ALTER TABLE clinics ADD COLUMN currency varchar(3) DEFAULT 'MXN';
ALTER TABLE clinics ADD COLUMN locale varchar(10) DEFAULT 'es-MX';
```

### 2. Actualizar lib/money.ts

```typescript
// lib/money.ts
interface FormatOptions {
  currency?: string
  locale?: string
}

export function formatCurrency(
  cents: number,
  options: FormatOptions = {}
) {
  const { currency = 'MXN', locale = 'es-MX' } = options

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(cents / 100)
}
```

### 3. Contexto de Clínica

```typescript
// hooks/use-clinic-currency.ts
export function useClinicCurrency() {
  const { currentClinic } = useCurrentClinic()

  return {
    currency: currentClinic?.currency || 'MXN',
    locale: currentClinic?.locale || 'es-MX',
    format: (cents: number) => formatCurrency(cents, {
      currency: currentClinic?.currency,
      locale: currentClinic?.locale,
    }),
  }
}
```

### 4. UI de Configuración

En Settings → General:
```typescript
<SelectField
  name="currency"
  label={t('settings.currency')}
  options={[
    { value: 'MXN', label: 'MXN - Peso Mexicano' },
    { value: 'USD', label: 'USD - Dólar Estadounidense' },
    { value: 'COP', label: 'COP - Peso Colombiano' },
    { value: 'ARS', label: 'ARS - Peso Argentino' },
    { value: 'EUR', label: 'EUR - Euro' },
  ]}
/>

<SelectField
  name="locale"
  label={t('settings.locale')}
  options={[
    { value: 'es-MX', label: 'México' },
    { value: 'es-CO', label: 'Colombia' },
    { value: 'es-AR', label: 'Argentina' },
    { value: 'en-US', label: 'Estados Unidos' },
    { value: 'es-ES', label: 'España' },
  ]}
/>
```

### 5. Actualizar Todos los Usos

Buscar y reemplazar:
```typescript
// ANTES
formatCurrency(amount)

// DESPUÉS
const { format } = useClinicCurrency()
format(amount)
```

## Monedas Soportadas Inicialmente

| Código | País | Locale |
|--------|------|--------|
| MXN | México | es-MX |
| USD | USA | en-US |
| COP | Colombia | es-CO |
| ARS | Argentina | es-AR |
| EUR | España | es-ES |

## Acceptance Criteria
- [ ] Migración con campo `currency` y `locale`
- [ ] `useClinicCurrency()` hook implementado
- [ ] Todos los `formatCurrency()` usan el hook
- [ ] UI de configuración en Settings
- [ ] Al menos 5 monedas soportadas
- [ ] Traducción de nombres de moneda
- [ ] `npm run typecheck` pasa

## Testing
1. Crear clínica con currency=USD
2. Ver Dashboard → valores en $USD
3. Ver Gastos → formulario en $USD
4. Cambiar a MXN → todo actualiza

## Archivos a Crear
1. `supabase/migrations/XXXX_add_currency.sql`
2. `web/hooks/use-clinic-currency.ts`

## Archivos a Modificar
1. `web/lib/money.ts`
2. `web/app/settings/general/page.tsx` (o crear)
3. TODOS los archivos que usan `formatCurrency` (~30 archivos)
4. Traducciones

## Nota sobre Exchange Rates
Para V1, NO implementar conversión automática. Cada clínica trabaja en su moneda. Si se necesita conversión multi-moneda, es una feature futura.
