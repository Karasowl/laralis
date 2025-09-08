-- Verificar que la tabla patients existe y tiene las columnas correctas

-- 1. Ver si existe la tabla
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'patients'
) as patients_table_exists;

-- 2. Ver columnas de patients
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'patients'
ORDER BY ordinal_position;

-- 3. Ver si hay registros
SELECT COUNT(*) as total_patients FROM patients;

-- 4. Verificar permisos (esto es importante)
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'patients';