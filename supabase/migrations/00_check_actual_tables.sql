-- CONSULTA CORRECTA para ver las tablas que realmente existen en tu proyecto

-- 1. Ver TODAS las tablas en el schema public
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Ver si existe alguna tabla relacionada con servicios
SELECT 
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%service%'
ORDER BY table_name;

-- 3. Ver columnas de la tabla supplies (que sabemos que existe)
SELECT 
    column_name, 
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'supplies'
ORDER BY ordinal_position;

-- 4. Ver columnas de la tabla fixed_costs (que sabemos que existe)
SELECT 
    column_name, 
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'fixed_costs'
ORDER BY ordinal_position;