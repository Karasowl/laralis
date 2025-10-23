-- Diagnostic: Verificar estructura real de marketing_campaigns
-- Este script revela qué columnas existen realmente en la tabla

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'marketing_campaigns'
ORDER BY ordinal_position;
