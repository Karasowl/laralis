-- Query para verificar la estructura actual (NO DESTRUCTIVO - SOLO CONSULTA)

-- Ver columnas de la tabla services
SELECT 
    'services' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'services'
ORDER BY ordinal_position;

-- Ver columnas de la tabla service_supplies si existe
SELECT 
    'service_supplies' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'service_supplies'
ORDER BY ordinal_position;

-- Ver si existe la tabla service_supplies
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'service_supplies'
) as service_supplies_exists;