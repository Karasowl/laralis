-- ============================================================================
-- DIAGNÓSTICO: Categorías de Gastos
-- ============================================================================
-- Propósito: Verificar qué categorías de gastos existen en la base de datos
-- Ejecuta este script en Supabase SQL Editor y pégame los resultados
-- ============================================================================

-- 1. Ver todas las categorías relacionadas con gastos
SELECT
  id,
  clinic_id,
  entity_type,
  name,
  display_name,
  parent_id,
  is_system,
  is_active,
  category_type_id
FROM categories
WHERE entity_type IN ('fixed_cost', 'expense', 'expenses')
   OR category_type_id IN (
     SELECT id FROM category_types
     WHERE code IN ('expense', 'expenses', 'fixed_cost')
   )
ORDER BY parent_id NULLS FIRST, display_name;

-- 2. Ver todos los category_types que podrían ser para gastos
SELECT
  id,
  name,
  code,
  display_name,
  clinic_id,
  is_system
FROM category_types
WHERE code ILIKE '%expense%'
   OR code ILIKE '%cost%'
   OR name ILIKE '%gasto%'
ORDER BY is_system DESC, name;

-- 3. Ver gastos actuales y sus categorías asignadas
SELECT DISTINCT
  e.category,
  e.subcategory,
  COUNT(*) as count
FROM expenses e
GROUP BY e.category, e.subcategory
ORDER BY e.category, e.subcategory;

-- 4. Ver si hay categorías con parent_id (jerarquía)
SELECT
  parent.display_name as parent_category,
  child.display_name as subcategory,
  child.id as child_id,
  child.entity_type
FROM categories child
LEFT JOIN categories parent ON child.parent_id = parent.id
WHERE child.parent_id IS NOT NULL
  AND (child.entity_type IN ('fixed_cost', 'expense', 'expenses')
       OR parent.entity_type IN ('fixed_cost', 'expense', 'expenses'))
ORDER BY parent.display_name, child.display_name;
