-- Script de diagnóstico: Ver qué categorías está trayendo el API

-- 1. Ver todas las categorías de gastos que existen
SELECT
  id,
  entity_type,
  name,
  display_name,
  parent_id,
  is_system,
  clinic_id
FROM categories
WHERE (entity_type IN ('expense', 'fixed_cost', 'expenses')
       OR name IN ('marketing', 'equipos', 'administrativos'))
  AND is_system = true
  AND clinic_id IS NULL
ORDER BY parent_id NULLS FIRST, display_order;

-- 2. ¿Qué entity_type tienen nuestras categorías nuevas?
SELECT DISTINCT entity_type, COUNT(*) as total
FROM categories
WHERE is_system = true
  AND clinic_id IS NULL
  AND name IN ('marketing', 'equipos', 'administrativos', 'publicidad', 'legal')
GROUP BY entity_type;

-- 3. Simular lo que trae el API con type=expenses
-- El API busca entity_type = 'fixed_cost' cuando le pasas type='expenses'
SELECT
  id,
  entity_type,
  name,
  display_name,
  parent_id
FROM categories
WHERE entity_type = 'fixed_cost'  -- Esto es lo que busca el API
  AND is_system = true
  AND clinic_id IS NULL;
