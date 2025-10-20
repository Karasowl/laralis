-- ============================================================================
-- Verificación Post-Migración 36
-- Descripción: Verifica que la migración 36 se ejecutó correctamente
-- Uso: Ejecutar DESPUÉS de 36_remove_supplies_check_constraint.sql
-- ============================================================================

-- 1. Verificar que el CHECK constraint fue eliminado
SELECT
  'CHECK Constraint Status' as verificacion,
  CASE
    WHEN COUNT(*) = 0 THEN '✓ ELIMINADO CORRECTAMENTE'
    ELSE '✗ TODAVÍA EXISTE (ERROR)'
  END as estado,
  COUNT(*) as cantidad
FROM pg_constraint
WHERE conname = 'supplies_category_check';

-- 2. Verificar el nuevo tipo de columna
SELECT
  'Column Type Status' as verificacion,
  CASE
    WHEN data_type = 'character varying' AND character_maximum_length = 100
    THEN '✓ VARCHAR(100) CORRECTO'
    ELSE '✗ TIPO INCORRECTO: ' || data_type || '(' || character_maximum_length::text || ')'
  END as estado,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'supplies'
  AND column_name = 'category';

-- 3. Verificar que la vista low_stock_alerts existe
SELECT
  'View Existence' as verificacion,
  CASE
    WHEN COUNT(*) = 1 THEN '✓ VISTA RECREADA CORRECTAMENTE'
    WHEN COUNT(*) = 0 THEN '✗ VISTA NO EXISTE (ERROR)'
    ELSE '✗ VISTAS DUPLICADAS (ERROR)'
  END as estado,
  COUNT(*) as cantidad
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'low_stock_alerts';

-- 4. Verificar la definición de la vista (columnas)
SELECT
  'View Columns' as verificacion,
  '✓ Columnas de la vista' as estado,
  column_name,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'low_stock_alerts'
ORDER BY ordinal_position;

-- 5. Probar que la vista funciona (query simple)
SELECT
  'View Functionality' as verificacion,
  CASE
    WHEN COUNT(*) >= 0 THEN '✓ VISTA FUNCIONAL (retorna ' || COUNT(*)::text || ' registros con stock bajo)'
    ELSE '✗ ERROR AL CONSULTAR VISTA'
  END as estado
FROM public.low_stock_alerts;

-- 6. Verificar datos existentes en supplies.category
SELECT
  'Existing Category Values' as verificacion,
  '✓ Valores actuales en supplies.category' as estado,
  category,
  COUNT(*) as cantidad
FROM public.supplies
GROUP BY category
ORDER BY COUNT(*) DESC;

-- ============================================================================
-- RESUMEN ESPERADO:
-- ============================================================================
-- 1. CHECK Constraint Status: ✓ ELIMINADO CORRECTAMENTE (0 registros)
-- 2. Column Type Status: ✓ VARCHAR(100) CORRECTO
-- 3. View Existence: ✓ VISTA RECREADA CORRECTAMENTE (1 registro)
-- 4. View Columns: Debe mostrar 7 columnas (id, name, category, stock_quantity, min_stock_alert, clinic_id, clinic_name)
-- 5. View Functionality: ✓ VISTA FUNCIONAL
-- 6. Existing Category Values: Muestra los valores actuales sin errores
-- ============================================================================
