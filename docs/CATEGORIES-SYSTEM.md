# Sistema de Categorías - Arquitectura

## 📋 Resumen Ejecutivo

Este documento describe el **Sistema Unificado de Categorías** implementado en Laralis, que reemplaza el antiguo sistema de categorías hardcodeadas con una solución flexible basada en base de datos que soporta tanto categorías del sistema como categorías personalizadas por clínica.

**Versión:** 1.0.0
**Fecha:** 2025-10-20
**Estado:** Implementado (Sprint 1-3)

---

## 🎯 Objetivos

1. **Homogeneización**: Mismo sistema de categorías en todos los módulos
2. **Flexibilidad**: Permite categorías personalizadas por clínica
3. **Consistencia**: Categorías del sistema predefinidas e inmutables
4. **Usabilidad**: Creación inline de categorías desde formularios
5. **Seguridad**: RLS policies para multi-tenancy

---

## 🏗️ Arquitectura

### Modelo de Datos

```sql
CREATE TABLE public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'services', 'supplies', 'expenses', 'assets', 'fixed_costs'
  name TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 999,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Sistema categories: clinic_id = NULL, is_system = true
  -- Custom categories: clinic_id = UUID, is_system = false
  CHECK (
    (is_system = true AND clinic_id IS NULL) OR
    (is_system = false AND clinic_id IS NOT NULL)
  )
);
```

### Tipos de Categorías

#### 1. **Categorías del Sistema** (`is_system = true`)
- **Propósito**: Categorías predefinidas por Laralis
- **Características**:
  - `clinic_id = NULL` (globales)
  - `is_system = true` (inmutables)
  - No pueden ser editadas o eliminadas por usuarios
  - Se muestran primero en selectores (ordenadas por `display_order`)
- **Ejemplos**:
  - Services: "Preventivo", "Restaurativo", "Endodoncia"
  - Supplies: "Insumo", "Bioseguridad", "Consumibles"
  - Expenses: "Materiales", "Servicios", "Renta"
  - Assets: "Equipo Dental", "Mobiliario", "Tecnología"
  - Fixed Costs: "Renta", "Salarios", "Servicios"

#### 2. **Categorías Personalizadas** (`is_system = false`)
- **Propósito**: Categorías creadas por clínicas específicas
- **Características**:
  - `clinic_id = UUID` (scoped a clínica)
  - `is_system = false` (mutables)
  - Pueden ser editadas y eliminadas
  - Se muestran después de las del sistema
- **Ejemplos**:
  - "Cirugía Maxilofacial" (custom para clínica especializada)
  - "Insumos VIP" (custom para servicios premium)

---

## 🔧 Componentes

### 1. CategorySelect Component

**Ubicación**: `web/components/ui/category-select.tsx`

```typescript
<CategorySelect
  type="services" // 'services' | 'supplies' | 'expenses' | 'assets' | 'fixed_costs'
  value={selectedCategory}
  onValueChange={(value) => handleChange(value)}
  placeholder="Seleccionar categoría"
  disabled={false}
/>
```

**Características**:
- Carga categorías desde `/api/categories?type={type}&active=true&clinicId={clinicId}`
- Soporta creación inline de nuevas categorías
- Ordena automáticamente: sistema primero, custom después
- Loading states y manejo de errores
- Compatible con React Hook Form

### 2. API Endpoint

**Ubicación**: `web/app/api/categories/route.ts`

**GET** `/api/categories?type=services&active=true&clinicId={uuid}`
- Retorna categorías del sistema + categorías de la clínica
- Respeta `is_active` filter
- Ordenado por `is_system DESC, display_order ASC`

**POST** `/api/categories?type=services&clinicId={uuid}`
```json
{
  "name": "Nueva Categoría"
}
```
- Crea categoría personalizada para la clínica
- Valida que `clinic_id` corresponda al usuario autenticado

**PATCH** `/api/categories/{id}`
- Solo permite editar categorías custom (`is_system = false`)
- Valida ownership por `clinic_id`

**DELETE** `/api/categories/{id}`
- Solo permite eliminar categorías custom
- Valida ownership por `clinic_id`

---

## 🔐 Seguridad (RLS Policies)

### SELECT Policy
```sql
-- Usuarios ven: categorías del sistema + categorías de sus clínicas
CREATE POLICY "Users can view system and own clinic categories"
ON public.categories FOR SELECT
USING (
  is_system = true OR
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_users
    WHERE user_id = auth.uid()
  )
);
```

### INSERT Policy
```sql
-- Usuarios solo pueden crear categorías custom en sus clínicas
CREATE POLICY "Users can create custom categories in own clinics"
ON public.categories FOR INSERT
WITH CHECK (
  is_system = false AND
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_users
    WHERE user_id = auth.uid()
  )
);
```

### UPDATE Policy
```sql
-- Usuarios solo pueden editar categorías custom propias
CREATE POLICY "Users can update own custom categories"
ON public.categories FOR UPDATE
USING (
  is_system = false AND
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_users
    WHERE user_id = auth.uid()
  )
);
```

### DELETE Policy
```sql
-- Usuarios solo pueden eliminar categorías custom propias
CREATE POLICY "Users can delete own custom categories"
ON public.categories FOR DELETE
USING (
  is_system = false AND
  clinic_id IN (
    SELECT clinic_id FROM public.clinic_users
    WHERE user_id = auth.uid()
  )
);
```

---

## 📦 Módulos Migrados

### ✅ Services (Servicios)
- **Antes**: `SelectWithCreate` con categorías hardcodeadas
- **Después**: `CategorySelect type="services"`
- **Migración**: Completada en Sprint 2
- **Categorías Sistema**: preventivo, restaurativo, endodoncia, cirugía, estética, ortodoncia, prótesis, periodoncia, otros

### ✅ Supplies (Insumos)
- **Antes**: Hybrid (DB + legacy fallback array)
- **Después**: `CategorySelect type="supplies"` + CategoryModal removido
- **Migración**: Completada en Sprint 2
- **Categorías Sistema**: insumo, bioseguridad, consumibles, materiales, medicamentos, equipos, otros
- **Nota**: Removed `supplies_category_check` constraint (Migration 36)

### ✅ Assets (Activos)
- **Antes**: Sin categorías
- **Después**: `CategorySelect type="assets"` agregado
- **Migración**: Completada en Sprint 2
- **Categorías Sistema**: equipo_dental, mobiliario, tecnologia, instrumental, otros
- **Campo Agregado**: `category: string` en form y tabla

### ✅ Fixed Costs (Costos Fijos)
- **Antes**: Array hardcodeado de 8 categorías
- **Después**: `CategorySelect type="fixed_costs"`
- **Migración**: Completada en Sprint 2
- **Categorías Sistema**: rent (renta), salaries (salarios), utilities (servicios), insurance (seguros), maintenance (mantenimiento), education (educación), advertising (publicidad), other (otros)
- **Removed**: Hardcoded `categories` array (lines 201-227)

### ⏸️ Expenses (Gastos) - PENDIENTE
- **Estado**: Requiere sprint dedicado (complejo)
- **Razón**: Dual schema (category string + category_id FK)
- **Plan**: Migration 38 preparada, falta actualizar ExpenseForm
- **Categorías Sistema**: materials, services, rent, utilities, salaries, marketing, insurance, maintenance, supplies, otros

---

## 🔄 Migraciones SQL

### Migration 36: Remove Supplies CHECK Constraint
```sql
-- Permite valores flexibles en supplies.category
ALTER TABLE public.supplies DROP CONSTRAINT supplies_category_check;
ALTER TABLE public.supplies ALTER COLUMN category TYPE VARCHAR(100);
```

### Migration 37: Seed Expense Categories
```sql
-- Pre-populate 10 system categories para expenses
INSERT INTO public.categories (entity_type, name, display_name, is_system, display_order, clinic_id)
VALUES
  ('expense', 'materials', 'Materiales', true, 1, NULL),
  ('expense', 'services', 'Servicios', true, 2, NULL),
  ...
```

### Migration 38: Expenses Schema Migration (PREPARADA)
```sql
-- 1. Add category_id column
ALTER TABLE public.expenses ADD COLUMN category_id UUID REFERENCES public.categories(id);

-- 2. Migrate existing data
UPDATE public.expenses e
SET category_id = c.id
FROM public.categories c
WHERE e.category = c.name AND c.entity_type = 'expense';

-- 3. Set NOT NULL constraint
ALTER TABLE public.expenses ALTER COLUMN category_id SET NOT NULL;

-- 4. Deprecate old column (mantener por seguridad)
-- ALTER TABLE public.expenses DROP COLUMN category;
```

### Migration 39: RLS Policies
```sql
-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 4 policies: SELECT, INSERT, UPDATE, DELETE (ver sección Seguridad)
```

---

## 💻 Uso en Código

### 1. En Formularios

```typescript
import { CategorySelect } from '@/components/ui/category-select'

function ServiceForm() {
  const form = useForm<ServiceFormData>({
    defaultValues: {
      category: ''
    }
  })

  return (
    <CategorySelect
      type="services"
      value={form.watch('category')}
      onValueChange={(value) => form.setValue('category', value)}
      placeholder={t('categories.selectCategory')}
    />
  )
}
```

### 2. Creación Inline

El componente `CategorySelect` incluye automáticamente la funcionalidad de creación inline:
- Click en "Nueva categoría"
- Modal se abre pidiendo nombre
- POST a `/api/categories` crea la categoría
- Se agrega automáticamente al selector
- Se selecciona automáticamente

### 3. Validación con Zod

```typescript
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  category: z.string().min(1, 'Categoría requerida'),
  // ...
})
```

---

## 🎨 UX/UI Patterns

### Orden de Visualización
1. **Categorías del Sistema** (orden por `display_order`)
   - Badge con indicador "Sistema" (opcional)
   - Color distintivo (primary/blue)
2. **Separador visual** (opcional)
3. **Categorías Personalizadas** (orden alfabético)
   - Badge con indicador "Custom" (opcional)
   - Color distintivo (secondary/gray)

### Estados
- **Loading**: Skeleton con animación
- **Empty**: Mensaje "No hay categorías disponibles"
- **Error**: Toast con mensaje de error
- **Success**: Toast "Categoría creada exitosamente"

### Accesibilidad
- Keyboard navigation (arrow keys, enter, esc)
- Screen reader labels
- Focus indicators visibles
- Placeholder descriptivo

---

## 📊 Ventajas del Sistema

### Antes (Hardcoded)
```typescript
// ❌ Cada módulo tenía su propio array
const SUPPLY_CATEGORIES = ['insumo', 'bioseguridad', ...]
const SERVICE_CATEGORIES = ['preventivo', 'restaurativo', ...]
const EXPENSE_CATEGORIES = ['materials', 'services', ...]
```
- ❌ Duplicación de código
- ❌ Difícil de personalizar
- ❌ Cambios requieren redeploy
- ❌ Inconsistencia entre módulos
- ❌ No multi-tenant

### Después (Database)
```typescript
// ✅ Un componente reutilizable
<CategorySelect type="services" />
<CategorySelect type="supplies" />
<CategorySelect type="expenses" />
```
- ✅ DRY (Don't Repeat Yourself)
- ✅ Categorías personalizables por clínica
- ✅ Cambios en tiempo real
- ✅ Consistencia garantizada
- ✅ Multi-tenant desde el inicio
- ✅ RLS policies para seguridad
- ✅ Creación inline desde formularios

---

## 🧪 Testing

### Unit Tests (Futuro)
```typescript
describe('CategorySelect', () => {
  it('loads system categories', ...)
  it('loads clinic custom categories', ...)
  it('sorts system categories first', ...)
  it('creates new category inline', ...)
  it('handles loading state', ...)
  it('handles error state', ...)
})
```

### Integration Tests (Futuro)
```typescript
describe('Categories API', () => {
  it('GET returns system + clinic categories', ...)
  it('POST creates custom category', ...)
  it('POST rejects system category creation', ...)
  it('PATCH updates only custom categories', ...)
  it('DELETE removes only custom categories', ...)
})
```

### E2E Tests (Futuro)
```typescript
describe('Category workflow', () => {
  it('user can create and use custom category', ...)
  it('user cannot edit system categories', ...)
  it('categories are scoped to clinic', ...)
})
```

---

## 🚀 Roadmap

### Fase 1: Core (✅ Completada - Sprint 1-3)
- [x] Crear tabla `categories` con RLS
- [x] Migrar Supplies, Assets, Fixed Costs
- [x] Crear `CategorySelect` component
- [x] Implementar API `/api/categories`
- [x] Seedear categorías del sistema
- [x] Actualizar i18n (es.json + en.json)
- [x] Documentación de arquitectura

### Fase 2: Expenses (⏸️ Pendiente)
- [ ] Ejecutar Migration 38 (schema migration)
- [ ] Actualizar ExpenseForm con CategorySelect
- [ ] Remover hardcoded EXPENSE_CATEGORIES
- [ ] Testing completo del módulo

### Fase 3: Mejoras (🔮 Futuro)
- [ ] Category Manager UI (editar/eliminar custom categories)
- [ ] Drag & drop para reordenar custom categories
- [ ] Iconos por categoría (opcional)
- [ ] Color picker para custom categories
- [ ] Analytics de uso de categorías
- [ ] Importar/exportar categorías custom

### Fase 4: Optimizaciones (🔮 Futuro)
- [ ] Cache de categorías del sistema (no cambian)
- [ ] Prefetch de categorías en AppLayout
- [ ] Optimistic updates en creación de categorías
- [ ] Infinite scroll si > 50 categorías

---

## 🐛 Troubleshooting

### Error: "Failed to load categories"
**Causa**: RLS policies no habilitadas o incorrectas
**Solución**: Ejecutar Migration 39 (RLS policies)

### Error: "Cannot create system category"
**Causa**: INSERT policy rechaza `is_system = true`
**Solución**: Solo crear categorías custom (`is_system = false`)

### Error: "Category not found after creation"
**Causa**: SELECT policy no incluye categorías recién creadas
**Solución**: Verificar que `clinic_id` en la categoría sea correcto

### Categorías duplicadas en selector
**Causa**: Misma categoría existe como sistema + custom
**Solución**: Usar `display_name` único o agregar lógica de deduplicación

---

## 📚 Referencias

### Archivos Relevantes
- `web/components/ui/category-select.tsx` - Componente principal
- `web/components/ui/select-with-create.tsx` - Base component
- `web/app/api/categories/route.ts` - API endpoint
- `web/hooks/use-categories.ts` - Hook de dominio (legacy, deprecar?)
- `supabase/migrations/36_*.sql` - Remove supplies constraint
- `supabase/migrations/37_*.sql` - Seed expense categories
- `supabase/migrations/38_*.sql` - Expenses schema migration
- `supabase/migrations/39_*.sql` - RLS policies

### Documentación Relacionada
- `docs/CODING-STANDARDS.md` - Reglas de código
- `docs/ICONOGRAPHY.md` - Sistema de iconos
- `docs/devlog/INDEX.md` - Historia de cambios
- `tasks/backlog.md` - Tasks pendientes

### Decisiones de Diseño
- **Por qué dual system?** Balance entre consistencia (sistema) y flexibilidad (custom)
- **Por qué `display_name`?** Permite nombres técnicos (`name`) + nombres visibles
- **Por qué `clinic_id = NULL` para sistema?** Simplifica queries y RLS policies
- **Por qué no soft delete?** `is_active = false` permite desactivar sin perder historial

---

## 👥 Contribución

### Agregar Categorías del Sistema
1. Crear migration en `supabase/migrations/`
2. INSERT con `is_system = true`, `clinic_id = NULL`
3. Actualizar traducciones en `messages/en.json` y `messages/es.json`
4. Actualizar este documento

### Agregar Nuevo Tipo de Categoría
1. Agregar valor en `entity_type` enum (si no existe)
2. Crear migration para seedear categorías del sistema
3. Implementar en módulo correspondiente con `<CategorySelect type="nuevo" />`
4. Actualizar documentación

---

**Última actualización**: 2025-10-20
**Autor**: Claude Code (AI Assistant)
**Versión del sistema**: 1.0.0
