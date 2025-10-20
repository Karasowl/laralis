# Explicación: Migration 36 - Resolución del Conflicto con la Vista `low_stock_alerts`

**Fecha**: 2025-10-20
**Migración**: `36_remove_supplies_check_constraint.sql`
**Problema Resuelto**: Error al intentar alterar `supplies.category` debido a dependencia de vista

---

## Problema Original

Al intentar ejecutar la migración 36 para cambiar el tipo de columna `supplies.category` de un tipo con CHECK constraint a `VARCHAR(100)`, obtuvimos este error:

```
ERROR:  0A000: cannot alter type of a column used by a view or rule
DETAIL:  rule _RETURN on view low_stock_alerts depends on column "category"
```

### Causa Raíz

PostgreSQL **NO permite** alterar el tipo de una columna si existe una vista que depende de ella. Esto es una medida de seguridad para evitar que las vistas dejen de funcionar.

La vista `low_stock_alerts` fue creada en la **Migration 19** (`19_add_inventory_to_supplies.sql`, líneas 38-50) y utiliza directamente la columna `supplies.category`:

```sql
CREATE OR REPLACE VIEW public.low_stock_alerts AS
SELECT
    s.id,
    s.name,
    s.category,  -- ← Esta columna causa el bloqueo
    s.stock_quantity,
    s.min_stock_alert,
    s.clinic_id,
    c.name as clinic_name
FROM public.supplies s
JOIN public.clinics c ON s.clinic_id = c.id
WHERE s.stock_quantity <= s.min_stock_alert
  AND s.stock_quantity >= 0;
```

---

## Solución Implementada

La estrategia es **Drop → Alter → Recreate**:

### Paso 1: Detectar la Vista
Verificamos si la vista existe para manejar instalaciones nuevas:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'low_stock_alerts'
  ) THEN
    RAISE NOTICE 'Vista low_stock_alerts existe, será recreada';
  ELSE
    RAISE NOTICE 'Vista low_stock_alerts no existe (instalación nueva)';
  END IF;
END $$;
```

### Paso 2: Eliminar la Vista Temporalmente
```sql
DROP VIEW IF EXISTS public.low_stock_alerts;
```

**Por qué es seguro**: La vista se va a recrear inmediatamente después con la MISMA definición. No perdemos funcionalidad.

### Paso 3: Eliminar el CHECK Constraint
```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'supplies_category_check'
  ) THEN
    ALTER TABLE public.supplies DROP CONSTRAINT supplies_category_check;
  END IF;
END $$;
```

### Paso 4: Cambiar el Tipo de Columna
```sql
ALTER TABLE public.supplies
ALTER COLUMN category TYPE VARCHAR(100);
```

**Por qué VARCHAR(100)**: Permite valores flexibles de hasta 100 caracteres, suficiente para nombres de categorías del sistema de categorías dinámicas.

### Paso 5: Recrear la Vista con la MISMA Definición
```sql
CREATE OR REPLACE VIEW public.low_stock_alerts AS
SELECT
    s.id,
    s.name,
    s.category,
    s.stock_quantity,
    s.min_stock_alert,
    s.clinic_id,
    c.name as clinic_name
FROM public.supplies s
JOIN public.clinics c ON s.clinic_id = c.id
WHERE s.stock_quantity <= s.min_stock_alert
  AND s.stock_quantity >= 0;

COMMENT ON VIEW public.low_stock_alerts IS 'View for supplies with low stock levels';
```

**Importante**: Esta es la MISMA definición exacta de la Migration 19. No cambiamos la lógica, solo recreamos la vista.

### Paso 6: Verificación Automática
```sql
DO $$
DECLARE
  constraint_count INTEGER;
  view_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM pg_constraint
  WHERE conname = 'supplies_category_check';

  SELECT EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'low_stock_alerts'
  ) INTO view_exists;

  IF constraint_count = 0 AND view_exists THEN
    RAISE NOTICE '✓✓✓ MIGRACIÓN EXITOSA ✓✓✓';
  ELSIF constraint_count > 0 THEN
    RAISE EXCEPTION 'ERROR: El constraint todavía existe!';
  ELSIF NOT view_exists THEN
    RAISE EXCEPTION 'ERROR: La vista no fue recreada!';
  END IF;
END $$;
```

Esta verificación automática asegura que:
1. El constraint fue eliminado correctamente
2. La vista fue recreada exitosamente
3. Si algo falla, la migración se revierte automáticamente (transaccional)

---

## Por Qué Este Enfoque es Seguro

### 1. **No Hay Pérdida de Datos**
- Solo modificamos el tipo de columna
- Los valores existentes en `supplies.category` se preservan automáticamente
- PostgreSQL convierte los valores existentes al nuevo tipo

### 2. **No Hay Pérdida de Funcionalidad**
- La vista se recrea con la MISMA definición exacta
- Cualquier query que use `low_stock_alerts` sigue funcionando
- El comportamiento de la vista es idéntico

### 3. **Compatibilidad con Instalaciones Nuevas**
- Usamos `DROP VIEW IF EXISTS` (no falla si la vista no existe)
- La vista se crea siempre al final
- Funciona tanto en instalaciones existentes como nuevas

### 4. **Verificación Automática**
- Si algo falla, la transacción se revierte
- La base de datos queda en estado consistente
- Errores claros indican qué falló

### 5. **No Afecta RLS Policies**
- Las políticas de Row Level Security se aplican a tablas, no a vistas
- La vista hereda los permisos de las tablas subyacentes
- No necesitamos recrear políticas RLS

---

## Orden de Ejecución

**IMPORTANTE**: Ejecutar en este orden:

1. **Primero**: `36_remove_supplies_check_constraint.sql`
   - Realiza la migración completa (drop → alter → recreate)

2. **Segundo (Opcional)**: `36_verify_migration.sql`
   - Verifica que todo quedó correcto
   - Muestra el estado de la columna, constraint y vista
   - Útil para debugging

---

## Resultados Esperados

### Mensajes durante la migración:
```
NOTICE:  Vista low_stock_alerts existe, será recreada después de la migración
NOTICE:  ✓ Vista low_stock_alerts eliminada temporalmente
NOTICE:  Eliminando constraint supplies_category_check...
NOTICE:  ✓ Constraint eliminado exitosamente
NOTICE:  ✓ Columna supplies.category cambiada a VARCHAR(100)
NOTICE:  ✓ Vista low_stock_alerts recreada exitosamente
NOTICE:  ✓✓✓ MIGRACIÓN EXITOSA ✓✓✓
NOTICE:    - supplies.category ahora es VARCHAR(100) flexible
NOTICE:    - Vista low_stock_alerts recreada correctamente
NOTICE:    - Sin pérdida de datos o funcionalidad
```

### Verificación (36_verify_migration.sql):
```
✓ CHECK Constraint Status: ELIMINADO CORRECTAMENTE (0 registros)
✓ Column Type Status: VARCHAR(100) CORRECTO
✓ View Existence: VISTA RECREADA CORRECTAMENTE (1 registro)
✓ View Columns: 7 columnas (id, name, category, stock_quantity, min_stock_alert, clinic_id, clinic_name)
✓ View Functionality: VISTA FUNCIONAL
✓ Existing Category Values: Muestra valores sin errores
```

---

## Lecciones Aprendidas

### 1. Siempre verificar dependencias antes de ALTER COLUMN
```sql
-- Query útil para encontrar vistas que dependen de una columna:
SELECT
  v.schemaname,
  v.viewname,
  v.definition
FROM pg_views v
WHERE v.definition LIKE '%supplies.category%'
  AND v.schemaname = 'public';
```

### 2. Patrón Drop-Alter-Recreate es estándar
Este patrón se usa frecuentemente en migraciones de PostgreSQL cuando hay dependencias de vistas.

### 3. CREATE OR REPLACE VIEW es tu amigo
Permite recrear vistas sin tener que dropearlas primero (pero no funciona si cambiamos el tipo de columna).

### 4. Verificación automática previene errores silenciosos
Siempre incluir verificaciones al final de migraciones críticas.

---

## Rollback (Si Fuera Necesario)

Si por alguna razón necesitas revertir esta migración:

```sql
-- ROLLBACK Migration 36 (No recomendado, solo para emergencias)

-- 1. Drop la vista
DROP VIEW IF EXISTS public.low_stock_alerts;

-- 2. Restaurar el tipo original (si era TEXT o similar)
ALTER TABLE public.supplies
ALTER COLUMN category TYPE TEXT;

-- 3. Restaurar el CHECK constraint
ALTER TABLE public.supplies
ADD CONSTRAINT supplies_category_check
CHECK (category IN ('dental', 'lab', 'office', 'cleaning'));

-- 4. Recrear la vista
CREATE OR REPLACE VIEW public.low_stock_alerts AS
SELECT
    s.id,
    s.name,
    s.category,
    s.stock_quantity,
    s.min_stock_alert,
    s.clinic_id,
    c.name as clinic_name
FROM public.supplies s
JOIN public.clinics c ON s.clinic_id = c.id
WHERE s.stock_quantity <= s.min_stock_alert
  AND s.stock_quantity >= 0;
```

**NOTA**: El rollback solo tiene sentido si NO has empezado a usar categorías personalizadas. Si ya existen categorías fuera de los valores hardcodeados, el rollback fallará.

---

## Referencias

- **Migration 19**: `19_add_inventory_to_supplies.sql` (definición original de `low_stock_alerts`)
- **Migration 36**: `36_remove_supplies_check_constraint.sql` (esta migración)
- **Verificación**: `36_verify_migration.sql` (script de verificación)
- **PostgreSQL Docs**: [Views and Rules](https://www.postgresql.org/docs/current/rules-views.html)
- **TASK**: TASK-homogenizar-categorias

---

**Conclusión**: La migración es segura, no destructiva y preserva toda la funcionalidad existente. El error original se resolvió manejando correctamente la dependencia de la vista.
