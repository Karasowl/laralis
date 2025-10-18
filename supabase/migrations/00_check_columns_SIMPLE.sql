-- ============================================================================
-- SCRIPT SIMPLE: Ver estructura de tablas CRÍTICAS
-- Ejecuta esto para ver qué columnas tienen las tablas que dan error
-- ============================================================================

-- IMPORTANTE: Este query devuelve UNA SOLA TABLA con TODAS las columnas
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN (
        'workspaces',
        'workspace_members',
        'clinics',
        'patients',
        'services',
        'supplies',
        'service_supplies',
        'treatments',
        'expenses',
        'fixed_costs',
        'assets',
        'marketing_campaigns',
        'marketing_platforms'
    )
ORDER BY
    table_name,
    ordinal_position;
