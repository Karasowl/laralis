# 🗄️ Guía de Ejecución de Migraciones SQL - Sistema de Categorías

## 📋 Resumen

Esta guía te indica **exactamente qué scripts SQL ejecutar en Supabase** y en qué orden para implementar el nuevo Sistema de Categorías.

**⏱️ Tiempo estimado**: 10-15 minutos
**⚠️ Importante**: Ejecuta los scripts en el orden indicado. No omitas pasos.

---

## 🎯 Scripts a Ejecutar

Hay **4 migraciones SQL** que debes ejecutar en orden:

1. **Migration 36**: Eliminar constraint de supplies
2. **Migration 37**: Crear categorías del sistema para expenses
3. **Migration 38**: Migrar expenses al nuevo schema (⚠️ CRÍTICO)
4. **Migration 39**: Habilitar RLS policies

---

## 📝 Instrucciones Paso a Paso

### Paso 0: Backup (Recomendado)

Antes de ejecutar cualquier migración, haz un backup de tu base de datos:

1. Ve a Supabase Dashboard → Tu Proyecto
2. Sidebar → Database → Backups
3. Click en "Create Backup"
4. Espera a que complete

---

### ✅ Paso 1: Migration 36 - Remove Supplies CHECK Constraint

**Objetivo**: Permite valores flexibles en `supplies.category`

**Archivo**: `supabase/migrations/36_remove_supplies_check_constraint.sql`

**SQL a ejecutar**:
```sql
-- Migration 36: Remove supplies category CHECK constraint
-- Fecha: 2025-10-20
-- Propósito: Permitir categorías flexibles desde DB

-- 1. Eliminar constraint que fuerza valores hardcodeados
ALTER TABLE public.supplies DROP CONSTRAINT IF EXISTS supplies_category_check;

-- 2. Cambiar tipo de columna para mayor flexibilidad
ALTER TABLE public.supplies ALTER COLUMN category TYPE VARCHAR(100);

-- ✅ Verificación:
-- Debe retornar 0 filas (constraint eliminado)
SELECT COUNT(*)
FROM information_schema.table_constraints
WHERE constraint_name = 'supplies_category_check'
  AND table_name = 'supplies';
```

**Cómo ejecutarlo**:
1. Supabase Dashboard → SQL Editor → "New Query"
2. Copia y pega el SQL completo
3. Click en "Run"
4. Verifica que la query de verificación retorne `0`

**✅ Resultado esperado**: "Success. No rows returned"

---

### ✅ Paso 2: Migration 37 - Seed Expense Categories

**Objetivo**: Pre-poblar 10 categorías del sistema para expenses

**Archivo**: `supabase/migrations/37_add_expense_categories.sql`

**SQL a ejecutar**:
```sql
-- Migration 37: Seed expense system categories
-- Fecha: 2025-10-20
-- Propósito: Pre-poblar categorías del sistema para expenses

-- Insertar 10 categorías del sistema
INSERT INTO public.categories (entity_type, name, display_name, is_system, display_order, clinic_id)
VALUES
  ('expense', 'materials', 'Materiales', true, 1, NULL),
  ('expense', 'services', 'Servicios', true, 2, NULL),
  ('expense', 'rent', 'Renta', true, 3, NULL),
  ('expense', 'utilities', 'Servicios Públicos', true, 4, NULL),
  ('expense', 'salaries', 'Salarios', true, 5, NULL),
  ('expense', 'marketing', 'Marketing', true, 6, NULL),
  ('expense', 'insurance', 'Seguros', true, 7, NULL),
  ('expense', 'maintenance', 'Mantenimiento', true, 8, NULL),
  ('expense', 'supplies', 'Insumos', true, 9, NULL),
  ('expense', 'otros', 'Otros', true, 10, NULL)
ON CONFLICT (entity_type, name, clinic_id) DO NOTHING;

-- ✅ Verificación:
-- Debe retornar 10 filas
SELECT entity_type, name, display_name, is_system, display_order
FROM public.categories
WHERE entity_type = 'expense' AND is_system = true
ORDER BY display_order;
```

**Cómo ejecutarlo**:
1. Nueva query en SQL Editor
2. Copia y pega el SQL completo
3. Click en "Run"
4. Verifica que la query de verificación retorne **10 filas**

**✅ Resultado esperado**: 10 categorías listadas con `is_system = true`

---

### ⚠️ Paso 3: Migration 38 - Expenses Schema Migration (CRÍTICO)

**⚠️ ATENCIÓN**: Esta migración modifica la tabla `expenses`. Lee cuidadosamente.

**Objetivo**: Migrar expenses de string category a FK category_id

**Archivo**: `supabase/migrations/38_expenses_category_migration.sql`

**SQL a ejecutar** (en 4 pasos):

#### 3.1 - Agregar columna category_id
```sql
-- Migration 38: Expenses category migration (Paso 1/4)
-- Fecha: 2025-10-20
-- Propósito: Migrar expenses.category (string) → category_id (FK)

-- Paso 1: Agregar nueva columna category_id (nullable por ahora)
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT;

-- ✅ Verificación:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'expenses' AND column_name = 'category_id';
```

**✅ Resultado esperado**: 1 fila mostrando `category_id | uuid | YES`

#### 3.2 - Migrar datos existentes
```sql
-- Paso 2: Migrar datos existentes de category (string) a category_id (UUID)
UPDATE public.expenses e
SET category_id = c.id
FROM public.categories c
WHERE e.category = c.name
  AND c.entity_type = 'expense'
  AND c.is_system = true
  AND e.category_id IS NULL;

-- ✅ Verificación:
-- Debe retornar 0 filas (todos migrados)
SELECT COUNT(*) as expenses_sin_migrar
FROM public.expenses
WHERE category_id IS NULL;
```

**✅ Resultado esperado**: `0` (todos los expenses tienen category_id asignado)

**⚠️ Si hay filas sin migrar**: Revisa los valores de `category` que no matchean con categorías del sistema.

#### 3.3 - Establecer NOT NULL constraint
```sql
-- Paso 3: Hacer category_id obligatorio
ALTER TABLE public.expenses
ALTER COLUMN category_id SET NOT NULL;

-- ✅ Verificación:
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'expenses' AND column_name = 'category_id';
```

**✅ Resultado esperado**: `is_nullable = NO`

#### 3.4 - (Opcional) Deprecar columna category antigua
```sql
-- Paso 4 (OPCIONAL): Deprecar columna category antigua
-- ⚠️ RECOMENDACIÓN: Mantener por 1-2 sprints como backup, luego eliminar

-- Opción A: Renombrar para mantener como backup
-- ALTER TABLE public.expenses RENAME COLUMN category TO category_deprecated;

-- Opción B: Eliminar columna (⚠️ NO RECOMENDADO inmediatamente)
-- ALTER TABLE public.expenses DROP COLUMN category;

-- ✅ Por ahora, NO ejecutar este paso. Mantener la columna antigua como backup.
```

**Decisión**: Mantener `category` por ahora como backup. Se eliminará en futuro sprint.

---

### ✅ Paso 4: Migration 39 - RLS Policies

**Objetivo**: Habilitar Row Level Security para tabla categories

**Archivo**: `supabase/migrations/39_categories_rls_policies.sql`

**SQL a ejecutar**:
```sql
-- Migration 39: Categories RLS Policies
-- Fecha: 2025-10-20
-- Propósito: Implementar seguridad multi-tenant para categories

-- 1. Habilitar RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 2. Policy: SELECT (Ver categorías del sistema + propias)
CREATE POLICY "Users can view system and own clinic categories"
ON public.categories
FOR SELECT
USING (
  is_system = true OR
  clinic_id IN (
    SELECT clinic_id
    FROM public.clinic_users
    WHERE user_id = auth.uid()
  )
);

-- 3. Policy: INSERT (Solo crear custom en clínicas propias)
CREATE POLICY "Users can create custom categories in own clinics"
ON public.categories
FOR INSERT
WITH CHECK (
  is_system = false AND
  clinic_id IN (
    SELECT clinic_id
    FROM public.clinic_users
    WHERE user_id = auth.uid()
  )
);

-- 4. Policy: UPDATE (Solo editar custom propias)
CREATE POLICY "Users can update own custom categories"
ON public.categories
FOR UPDATE
USING (
  is_system = false AND
  clinic_id IN (
    SELECT clinic_id
    FROM public.clinic_users
    WHERE user_id = auth.uid()
  )
);

-- 5. Policy: DELETE (Solo eliminar custom propias)
CREATE POLICY "Users can delete own custom categories"
ON public.categories
FOR DELETE
USING (
  is_system = false AND
  clinic_id IN (
    SELECT clinic_id
    FROM public.clinic_users
    WHERE user_id = auth.uid()
  )
);

-- ✅ Verificación:
-- Debe retornar 4 políticas
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'categories';
```

**Cómo ejecutarlo**:
1. Nueva query en SQL Editor
2. Copia y pega el SQL completo
3. Click en "Run"
4. Verifica que la query de verificación retorne **4 políticas**

**✅ Resultado esperado**: 4 filas mostrando las policies creadas

---

## 🧪 Verificación Final

Después de ejecutar las 4 migraciones, ejecuta esta verificación completa:

```sql
-- ✅ VERIFICACIÓN COMPLETA DEL SISTEMA DE CATEGORÍAS

-- 1. Verificar que RLS está habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'categories';
-- Esperado: rowsecurity = true

-- 2. Contar categorías del sistema por tipo
SELECT entity_type, COUNT(*) as total
FROM public.categories
WHERE is_system = true
GROUP BY entity_type
ORDER BY entity_type;
-- Esperado: expense = 10, (más si ya existían otras)

-- 3. Verificar que expenses tienen category_id
SELECT
  COUNT(*) as total_expenses,
  COUNT(category_id) as con_category_id,
  COUNT(*) - COUNT(category_id) as sin_category_id
FROM public.expenses;
-- Esperado: sin_category_id = 0

-- 4. Verificar policies
SELECT COUNT(*) as total_policies
FROM pg_policies
WHERE tablename = 'categories';
-- Esperado: 4

-- 5. Test de query (como usuario autenticado)
-- Esta query debe funcionar en la app
SELECT id, entity_type, name, display_name, is_system
FROM public.categories
WHERE entity_type = 'expense' AND is_active = true
ORDER BY is_system DESC, display_order ASC
LIMIT 20;
-- Esperado: 10 categorías (todas is_system = true)
```

**✅ Todos los checks pasan?** → Sistema de categorías implementado correctamente!

---

## 🐛 Troubleshooting

### Error: "relation 'categories' does not exist"

**Causa**: La tabla `categories` no ha sido creada aún.

**Solución**:
1. Verifica que hayas ejecutado migraciones anteriores para crear la tabla
2. Si no existe, ejecuta primero la migración que crea la tabla `categories`
3. En el devlog busca la migración que creó la tabla inicialmente

### Error: "constraint 'supplies_category_check' does not exist"

**Causa**: El constraint ya fue eliminado o nunca existió.

**Solución**: Es seguro ignorar este error. Continúa con Migration 37.

### Error: UPDATE en expenses retorna 0 filas

**Causa**: Los valores en `expenses.category` no matchean con `categories.name`

**Solución**:
```sql
-- Ver qué categorías no matchean
SELECT DISTINCT category
FROM public.expenses
WHERE category NOT IN (
  SELECT name FROM public.categories WHERE entity_type = 'expense'
);

-- Agregar las categorías faltantes manualmente
INSERT INTO public.categories (entity_type, name, display_name, is_system, clinic_id)
VALUES ('expense', 'nombre_faltante', 'Nombre Faltante', false, 'tu_clinic_id_aqui');

-- Luego re-ejecutar el UPDATE
```

### Error: "new row violates check constraint"

**Causa**: Intentas crear una categoría del sistema con `clinic_id` o custom sin `clinic_id`

**Solución**: Verifica que:
- Categorías del sistema: `is_system = true` AND `clinic_id = NULL`
- Categorías custom: `is_system = false` AND `clinic_id = UUID`

### Error: "permission denied for table categories"

**Causa**: RLS policies no permiten la operación

**Solución**:
1. Verifica que el usuario esté autenticado (`auth.uid()` no es NULL)
2. Verifica que el usuario tenga membresía en la clínica (`clinic_users` table)
3. Re-ejecuta Migration 39 (RLS policies)

---

## 📊 Resumen de Cambios

| Tabla | Campo Modificado | Cambio |
|-------|------------------|--------|
| `supplies` | `category` | Tipo VARCHAR(100), sin CHECK constraint |
| `categories` | - | Habilitado RLS, 4 policies creadas |
| `expenses` | `category_id` | Nueva columna FK a categories (NOT NULL) |
| `expenses` | `category` | Deprecada (mantener como backup) |

---

## 🚀 Siguiente Paso

Después de ejecutar todas las migraciones:

1. **Reinicia el servidor de desarrollo** (`npm run dev`)
2. **Verifica en la app** que CategorySelect funciona en:
   - ✅ Services (Servicios)
   - ✅ Supplies (Insumos)
   - ✅ Assets (Activos)
   - ✅ Fixed Costs (Costos Fijos)
   - ⏸️ Expenses (Pendiente actualizar UI)

3. **Prueba crear una categoría custom**:
   - Ve a Services → Agregar Servicio
   - Click en selector de categoría
   - Click en "Nueva categoría"
   - Ingresa nombre → Guardar
   - Verifica que aparezca en la lista

4. **Revisa CATEGORIES-SYSTEM.md** para entender la arquitectura completa

---

## 📚 Referencias

- **Arquitectura**: `docs/CATEGORIES-SYSTEM.md`
- **Migraciones originales**: `supabase/migrations/36_*.sql` a `39_*.sql`
- **Verificación de RLS**: `scripts/check-categories-rls.sql`

---

**✅ Checklist Final**

- [ ] Migration 36 ejecutada (supplies constraint removido)
- [ ] Migration 37 ejecutada (10 categorías de expense seeded)
- [ ] Migration 38 ejecutada (expenses.category_id creado y migrado)
- [ ] Migration 39 ejecutada (RLS habilitado, 4 policies creadas)
- [ ] Verificación completa pasada (todos los checks ✅)
- [ ] App reiniciada y probada
- [ ] CategorySelect funciona en todos los módulos
- [ ] Puedo crear categorías custom

---

**Fecha de creación**: 2025-10-20
**Autor**: Claude Code (AI Assistant)
**Versión**: 1.0.0
