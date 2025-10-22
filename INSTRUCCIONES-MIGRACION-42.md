# Instrucciones: Migración 42 - Categorías de Gastos Jerárquicas

## 🎯 Qué se arregló

Esta migración soluciona el problema de las categorías de gastos:

### Antes (Problema)
❌ Categorías hardcodeadas en el código
❌ "Legal" posiblemente en "Marketing" (dependiendo de datos)
❌ Subcategorías no funcionaban al seleccionar categoría
❌ Se perdían en reset de base de datos

### Después (Solución)
✅ Categorías en la base de datos con jerarquía (parent/child)
✅ "Legal" correctamente en "Administrativos"
✅ Subcategorías filtran dinámicamente según categoría seleccionada
✅ Marcadas como `is_system = true` → **se recrean automáticamente en reset**

---

## 📋 Categorías Creadas

### 8 Categorías Padre

1. **Equipos**
   - Dental
   - Mobiliario
   - Tecnología
   - Herramientas

2. **Insumos**
   - Anestesia
   - Materiales
   - Limpieza
   - Protección

3. **Servicios**
   - Electricidad
   - Agua
   - Internet
   - Teléfono
   - Gas

4. **Mantenimiento**
   - Equipos
   - Instalaciones
   - Software

5. **Marketing**
   - Publicidad
   - Promociones
   - Eventos

6. **Administrativos**
   - Papelería
   - Contabilidad
   - **Legal** ← Aquí está correctamente

7. **Personal**
   - Nómina
   - Beneficios
   - Capacitación

8. **Otros**
   - (sin subcategorías)

**Total:** 8 categorías padre + 23 subcategorías = 31 categorías

---

## 🚀 Pasos para Ejecutar

### Paso 1: Ejecutar la Migración

1. Ve a Supabase Dashboard → SQL Editor
2. Abre el archivo: `supabase/migrations/42_fix_expense_categories_hierarchy.sql`
3. Copia todo el contenido
4. Pégalo en el SQL Editor
5. Click en "Run"

### Paso 2: Verificar Resultados

Deberías ver este output al final:

```
========================================
RESUMEN DE MIGRACIÓN 42:
========================================
Categorías padre creadas: 8
Subcategorías creadas: 23
Total de categorías: 31
----------------------------------------
Total de gastos: X
Gastos con categoría: X
========================================
✓ MIGRACIÓN EXITOSA: Todos los gastos tienen categoría
```

También verás una tabla mostrando la jerarquía:

```
categoria_padre    | subcategoria          | display_order
-------------------|-----------------------|---------------
Equipos            |                       | 1
                   |   └─ Dental           | 1
                   |   └─ Mobiliario       | 2
                   |   └─ Tecnología       | 3
                   |   └─ Herramientas     | 4
Marketing          |                       | 5
                   |   └─ Publicidad       | 1
                   |   └─ Promociones      | 2
                   |   └─ Eventos          | 3
Administrativos    |                       | 6
                   |   └─ Papelería        | 1
                   |   └─ Contabilidad     | 2
                   |   └─ Legal            | 3  ← AQUÍ ESTÁ
...
```

### Paso 3: Probar en la Aplicación

1. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Ve a la página de **Gastos**

3. Click en **"Crear Gasto"**

4. En el dropdown de **"Categoría"**, deberías ver:
   ```
   - Equipos
   - Insumos
   - Servicios
   - Mantenimiento
   - Marketing
   - Administrativos
   - Personal
   - Otros
   ```

5. **Selecciona "Marketing"**

6. En el dropdown de **"Subcategoría"**, deberías ver:
   ```
   - Publicidad
   - Promociones
   - Eventos
   ```
   ✅ **"Legal" NO debe aparecer aquí**

7. **Selecciona "Administrativos"**

8. En el dropdown de **"Subcategoría"**, deberías ver:
   ```
   - Papelería
   - Contabilidad
   - Legal  ← AQUÍ SÍ debe aparecer
   ```

9. Prueba con otras categorías

---

## ⚠️ Si algo sale mal

### Problema: No se crearon todas las categorías

**Solución:**
```sql
-- En SQL Editor, ejecuta esto para ver cuántas se crearon
SELECT COUNT(*) as total_categories
FROM public.categories
WHERE entity_type = 'expense'
  AND is_system = true
  AND clinic_id IS NULL;
```

Si el resultado es < 31, ejecuta la migración de nuevo (es idempotente).

### Problema: Gastos sin categoría

**Solución:**
```sql
-- Verifica cuántos gastos no tienen categoría
SELECT COUNT(*) as sin_categoria
FROM public.expenses
WHERE category_id IS NULL;
```

Si hay gastos sin categoría:
```sql
-- Asignar todos a "Otros"
UPDATE public.expenses
SET category_id = (
  SELECT id FROM public.categories
  WHERE entity_type = 'expense'
    AND name = 'otros'
    AND is_system = true
    AND clinic_id IS NULL
  LIMIT 1
)
WHERE category_id IS NULL;
```

### Problema: Subcategorías no aparecen

**Verificar:**
```sql
-- Ver jerarquía completa
SELECT
  parent.display_name as categoria_padre,
  child.display_name as subcategoria,
  child.parent_id
FROM categories child
LEFT JOIN categories parent ON child.parent_id = parent.id
WHERE child.entity_type = 'expense'
  AND child.is_system = true
  AND child.clinic_id IS NULL
ORDER BY parent.display_name, child.display_name;
```

Si no hay subcategorías (parent_id NULL para todas), la migración no se ejecutó correctamente. Ejecuta de nuevo.

---

## 🔄 Rollback (Si necesitas revertir)

Si algo sale muy mal:

```sql
-- SOLO SI NECESITAS REVERTIR
-- Esto elimina todas las categorías de sistema de expenses
DELETE FROM public.categories
WHERE entity_type = 'expense'
  AND is_system = true
  AND clinic_id IS NULL;

-- Luego ejecuta la migración 42 de nuevo
```

---

## 📊 Verificación Post-Migración

### Query de Verificación Completa

```sql
-- Ejecuta esto para ver todo el estado
SELECT
  'Total categorías' as metrica,
  COUNT(*)::text as valor
FROM categories
WHERE entity_type = 'expense' AND is_system = true AND clinic_id IS NULL

UNION ALL

SELECT
  'Categorías padre',
  COUNT(*)::text
FROM categories
WHERE entity_type = 'expense' AND is_system = true AND clinic_id IS NULL AND parent_id IS NULL

UNION ALL

SELECT
  'Subcategorías',
  COUNT(*)::text
FROM categories
WHERE entity_type = 'expense' AND is_system = true AND clinic_id IS NULL AND parent_id IS NOT NULL

UNION ALL

SELECT
  'Gastos totales',
  COUNT(*)::text
FROM expenses

UNION ALL

SELECT
  'Gastos con categoría',
  COUNT(*)::text
FROM expenses
WHERE category_id IS NOT NULL;
```

**Resultado esperado:**
```
metrica                 | valor
------------------------|-------
Total categorías        | 31
Categorías padre        | 8
Subcategorías          | 23
Gastos totales         | X
Gastos con categoría   | X
```

---

## ✅ Checklist Final

Marca cada ítem cuando lo completes:

- [ ] Migración ejecutada sin errores
- [ ] Output muestra 8 categorías padre
- [ ] Output muestra 23 subcategorías
- [ ] Todos los gastos tienen category_id
- [ ] En la UI, dropdown de "Categoría" muestra 8 opciones
- [ ] Al seleccionar "Marketing", dropdown de "Subcategoría" muestra 3 opciones
- [ ] "Legal" aparece bajo "Administrativos", NO bajo "Marketing"
- [ ] Se puede crear un nuevo gasto con categoría y subcategoría
- [ ] El gasto guardado muestra correctamente la categoría/subcategoría

---

## 📞 Soporte

Si encuentras algún problema:

1. Copia el error exacto
2. Copia el resultado de la "Query de Verificación Completa"
3. Dime qué pasó y te ayudo a debuggear

---

**Fecha:** 2025-10-21
**Migración:** 42
**Archivos modificados:**
- `supabase/migrations/42_fix_expense_categories_hierarchy.sql` (NUEVO)
- `web/components/expenses/CreateExpenseForm.tsx` (ACTUALIZADO)
