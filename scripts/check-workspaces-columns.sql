-- Ver la estructura de workspaces
SELECT
    column_name as "Columna",
    data_type as "Tipo",
    is_nullable as "NULL?",
    column_default as "Default"
FROM information_schema.columns
WHERE table_name = 'workspaces'
  AND table_schema = 'public'
ORDER BY ordinal_position;
