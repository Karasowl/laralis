-- ============================================================================
-- MOSTRAR TODA LA ESTRUCTURA EN UNA SOLA CONSULTA
-- Este script devuelve UNA SOLA TABLA con toda la información
-- ============================================================================

-- Ver todas las columnas de todas las tablas
SELECT
    c.table_name,
    c.ordinal_position,
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.is_nullable,
    c.column_default,
    -- Detectar si es primary key
    (SELECT COUNT(*)
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
     WHERE tc.constraint_type = 'PRIMARY KEY'
         AND kcu.table_name = c.table_name
         AND kcu.column_name = c.column_name
    ) > 0 as is_primary_key,
    -- Detectar si es foreign key y a qué tabla apunta
    (SELECT ccu.table_name || '.' || ccu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
     JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
         AND kcu.table_name = c.table_name
         AND kcu.column_name = c.column_name
     LIMIT 1
    ) as foreign_key_references
FROM information_schema.columns c
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;
