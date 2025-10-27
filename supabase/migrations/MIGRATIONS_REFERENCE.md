# 📋 Referencia de Migraciones - Laralis

Este documento lista las migraciones que deben ejecutarse manualmente en Supabase.

---

## 🔴 MIGRACIONES PENDIENTES (Ejecutar en orden)

### 1. **Fix Campaign Platform Column** (CRÍTICO)
**Archivo:** `20251027_fix_campaign_platform_column_FINAL.sql`
**Fecha:** 2025-10-27
**Propósito:** Corregir el nombre de columna `platform_category_id` → `platform_id` en `marketing_campaigns`

**Problema que resuelve:**
- Error 500 al crear campañas de marketing
- Dropdown de gastos no muestra campañas
- API de campañas falla por columna incorrecta

**Qué hace:**
1. Elimina vista `campaign_stats` (dependencia)
2. Elimina FK constraint de `platform_category_id`
3. Renombra columna a `platform_id`
4. Crea nuevo FK a `categories(id)`
5. Recrea vista `campaign_stats` con columna correcta

**Cómo ejecutar:**
```bash
# En Supabase SQL Editor:
# 1. Ir a: https://supabase.com/dashboard/project/[tu-proyecto]/sql
# 2. Copiar contenido del archivo: 20251027_fix_campaign_platform_column_FINAL.sql
# 3. Pegar en el editor
# 4. Click en "Run" o Ctrl+Enter
```

**Verificar que funcionó:**
```sql
-- Debería mostrar SOLO platform_id (NOT NULL)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'marketing_campaigns'
AND column_name IN ('platform_id', 'platform_category_id');
```

---

## ✅ MIGRACIONES COMPLETADAS

### 1. Add Notes to Expenses
**Archivo:** `20251026213219_add_notes_to_expenses.sql`
**Estado:** ✅ Ejecutada
**Descripción:** Agrega campo `notes` a la tabla `expenses`

---

## 📁 ARCHIVOS DEPRECADOS (NO EJECUTAR)

Estos archivos fueron versiones anteriores y NO deben ejecutarse:

- ❌ `20251027_fix_campaign_platform_column.sql` (v1 - sin manejo de vistas)
- ❌ `20251027_fix_campaign_platform_column_v2.sql` (v2 - reemplazada por FINAL)

**Razón:** La versión FINAL consolida todas las correcciones necesarias.

---

## 🔧 ORDEN DE EJECUCIÓN RECOMENDADO

Si estás configurando una base de datos nueva desde cero:

1. Ejecutar todas las migraciones numeradas en orden (01, 02, 03...)
2. Ejecutar `20251026213219_add_notes_to_expenses.sql`
3. Ejecutar `20251027_fix_campaign_platform_column_FINAL.sql`

---

## 📝 NOTAS IMPORTANTES

- **Siempre hacer backup** antes de ejecutar migraciones en producción
- **Verificar** los resultados después de cada migración
- **No ejecutar** archivos deprecados marcados con ❌
- **Leer** los comentarios dentro de cada archivo SQL antes de ejecutar

---

## 🆘 ROLLBACK

Si necesitas revertir la migración de campaign platform:

```sql
-- NO RECOMENDADO - Solo en caso de emergencia
-- Esto puede causar pérdida de datos

-- 1. Eliminar vista
DROP VIEW IF EXISTS public.campaign_stats CASCADE;

-- 2. Renombrar columna de vuelta
ALTER TABLE public.marketing_campaigns
RENAME COLUMN platform_id TO platform_category_id;

-- 3. Recrear FK constraint
ALTER TABLE public.marketing_campaigns
ADD CONSTRAINT marketing_campaigns_platform_category_id_fkey
FOREIGN KEY (platform_category_id)
REFERENCES public.categories(id)
ON DELETE CASCADE;
```

---

**Última actualización:** 2025-10-27
