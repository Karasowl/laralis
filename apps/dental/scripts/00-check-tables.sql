-- SCRIPT RÁPIDO PARA VER QUÉ TABLAS EXISTEN

SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;