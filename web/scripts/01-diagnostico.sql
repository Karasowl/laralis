-- =====================================================
-- SCRIPT DE DIAGNÓSTICO - EJECUTA ESTO PRIMERO
-- =====================================================

-- 1. Ver columnas de settings_time
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'settings_time'
ORDER BY ordinal_position;

-- 2. Ver columnas de fixed_costs
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'fixed_costs'
ORDER BY ordinal_position;

-- 3. Ver columnas de assets
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'assets'
ORDER BY ordinal_position;

-- 4. Ver columnas de services
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'services'
ORDER BY ordinal_position;

-- 5. Ver si existe la tabla service_supplies
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'service_supplies'
) as tabla_existe;

-- 6. Ver si existe la tabla patients
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'patients'
) as tabla_existe;

-- 7. Ver si existe la tabla treatments
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'treatments'
) as tabla_existe;

-- 8. Ver algunos datos de fixed_costs para verificar los montos
SELECT 
    id,
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos
FROM fixed_costs
LIMIT 5;