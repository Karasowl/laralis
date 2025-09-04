-- Script para verificar y corregir la estructura de campañas de marketing

-- 1. Ver la estructura actual de marketing_campaigns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'marketing_campaigns'
ORDER BY ordinal_position;

-- 2. Ver las restricciones de foreign key
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'marketing_campaigns'
    AND tc.constraint_type = 'FOREIGN KEY';

-- 3. Verificar si necesitamos migrar de platform_category_id a platform_id
-- o crear entradas en custom_categories
