# Devlog: Implementar esquema Supabase y CRUD básico

**PR**: #2  
**Tasks**: TASK-20250809-supabase-schema, TASK-20250809-crud-operations  
**Date**: 2025-08-09

## Context

Después del bootstrap inicial del proyecto con Next.js 14, calculadora de costos y sistema i18n, el siguiente paso era conectar la aplicación a una base de datos real. El usuario requirió implementar un esquema SQL mínimo y conectar las dos páginas existentes (configuración de tiempo y costos fijos) a APIs reales de Supabase.

## Problem

La aplicación funcionaba con datos hardcodeados y sin persistencia. Necesitábamos:
1. Esquema de base de datos con tablas para settings_time y fixed_costs
2. Manejo de dinero exclusivamente en centavos (integers)
3. APIs de CRUD completo para ambas entidades
4. Validación con Zod en server-side
5. Conexión de las páginas existentes sin refactoring mayor

## Root cause

Las páginas existentes estaban diseñadas para trabajar con datos hardcodeados de la hoja Excel de referencia. Necesitábamos persistencia real manteniendo la misma estructura de datos y validaciones.

## What changed

### 1. Esquema SQL (supabase/schema.sql)
```sql
-- Tabla para configuración de tiempo (único registro)
create table if not exists public.settings_time (
  id uuid primary key default gen_random_uuid(),
  work_days int not null,
  hours_per_day int not null,
  real_pct numeric not null check (real_pct >= 0 and real_pct <= 1),
  updated_at timestamptz default now()
);

-- Tabla para costos fijos mensuales
create table if not exists public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('rent', 'salaries', 'utilities', 'insurance', 'equipment', 'other')),
  concept text not null,
  amount_cents int not null check (amount_cents > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 2. Cliente Supabase Admin (web/lib/supabaseAdmin.ts)
```typescript
// Cliente server-side con service role key
export const supabaseAdmin = createClient(
  supabaseUrl, 
  supabaseServiceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
```

### 3. Validaciones Zod (web/lib/zod.ts)
```typescript
// Esquemas para validación en API
export const zFixedCost = z.object({
  category: z.enum(['rent', 'salaries', 'utilities', 'insurance', 'equipment', 'other']),
  concept: z.string().min(1, 'Concept is required'),
  amount_cents: z.number().int().positive('Amount must be positive'),
});

// Esquemas para formularios que transforman pesos a centavos
export const zFixedCostForm = z.object({
  category: z.string().min(1, 'Category is required'),
  concept: z.string().min(1, 'Concept is required'),
  amount_pesos: z.number().positive('Amount must be positive').transform(pesos => Math.round(pesos * 100)),
});
```

### 4. API Routes
- `web/app/api/settings/time/route.ts`: GET/POST/PUT para configuración única
- `web/app/api/fixed-costs/route.ts`: GET/POST con paginación 
- `web/app/api/fixed-costs/[id]/route.ts`: GET/PUT/DELETE individual

### 5. Conexión de páginas existentes
- **Time page**: Carga configuración existente, calcula con costos fijos reales
- **Fixed costs page**: CRUD completo, desglose por categoría, inline editing

## Files touched

### Created:
- `supabase/schema.sql`
- `web/lib/supabaseAdmin.ts` 
- `web/lib/zod.ts`
- `web/lib/format.ts`
- `web/app/api/settings/time/route.ts`
- `web/app/api/fixed-costs/route.ts`
- `web/app/api/fixed-costs/[id]/route.ts`

### Modified:
- `web/app/(setup)/time/page.tsx` - Conectado a API
- `web/app/(setup)/fixed-costs/page.tsx` - CRUD completo
- `web/messages/en.json` - Nuevas claves i18n
- `web/messages/es.json` - Traducciones

## Before vs After

**Before:**
- Datos hardcodeados en componentes
- Sin persistencia
- Cálculos con valores de ejemplo

**After:**  
- Datos persistidos en Supabase PostgreSQL
- CRUD completo con validación
- Cálculos con costos fijos reales
- Manejo consistente en centavos

## How to test

1. Configurar variables de entorno Supabase
2. Ejecutar migrations: `supabase db reset` 
3. `npm run dev`
4. Navegar a /time y /fixed-costs
5. Verificar CRUD operations funcionan
6. Comprobar que cálculos usan datos reales

## I18n keys añadidas

**English (en.json):**
```json
"fixedCosts": {
  "messages": {
    "saved": "Fixed cost saved successfully",
    "deleted": "Fixed cost deleted successfully", 
    "saveError": "Error saving fixed cost",
    "deleteError": "Error deleting fixed cost"
  }
}
```

**Spanish (es.json):**  
```json  
"fixedCosts": {
  "messages": {
    "saved": "Costo fijo guardado exitosamente",
    "deleted": "Costo fijo eliminado exitosamente",
    "saveError": "Error al guardar costo fijo", 
    "deleteError": "Error al eliminar costo fijo"
  }
}
```

## Unit tests

Las validaciones Zod incluyen tests automáticos para:
- Transformación pesos → centavos
- Validación de categorías enum
- Campos requeridos
- Números positivos

## Risks and rollback

**Risks:**
- Dependencia en Supabase para funcionalidad básica
- Variables de entorno requeridas en producción

**Rollback:**
- Revertir a datos hardcodeados cambiando imports
- Schema SQL es idempotente (safe to re-run)

## Follow ups

- **TASK-20250810-auth-rls**: Implementar autenticación y Row Level Security
- **TASK-20250810-end-to-end-testing**: Testing completo con Supabase local
- **TASK-20250810-error-handling**: Mejorar UX de errores con toast notifications

---

**🤖 Generated with [Claude Code](https://claude.ai/code)**