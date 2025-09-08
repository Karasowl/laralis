-- =====================================================
-- SCRIPT PARA ARREGLAR PROBLEMAS ENCONTRADOS
-- =====================================================

-- 1. ARREGLAR settings_time - Renombrar columnas para que coincidan con el código
ALTER TABLE settings_time 
RENAME COLUMN working_days_per_month TO work_days;

ALTER TABLE settings_time 
RENAME COLUMN real_hours_percentage TO real_pct;

-- Las columnas planned_hours_per_month y real_hours_per_month son calculadas,
-- no necesitamos guardarlas, así que las eliminamos
ALTER TABLE settings_time 
DROP COLUMN IF EXISTS planned_hours_per_month;

ALTER TABLE settings_time 
DROP COLUMN IF EXISTS real_hours_per_month;

-- 2. ARREGLAR fixed_costs - Los montos están multiplicados por 100
-- Dividir entre 100 para corregir
UPDATE fixed_costs 
SET amount_cents = amount_cents / 100;

-- 3. Verificar que los cambios se aplicaron correctamente
SELECT 
    'settings_time columnas después del cambio:' as info,
    string_agg(column_name, ', ') as columnas
FROM information_schema.columns 
WHERE table_name = 'settings_time';

-- 4. Verificar los montos corregidos
SELECT 
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos
FROM fixed_costs
ORDER BY created_at DESC
LIMIT 10;

-- 5. Verificar un registro de settings_time
SELECT * FROM settings_time LIMIT 1;