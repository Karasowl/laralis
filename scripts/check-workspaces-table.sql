-- =================================================================
-- VERIFICAR ESTRUCTURA DE TABLA WORKSPACES
-- =================================================================

SELECT
    '═══════════════════════════════════════════════════════' as separador;

SELECT
    'COLUMNAS DE WORKSPACES:' as info;

SELECT
    column_name as "Columna",
    data_type as "Tipo",
    is_nullable as "Nullable",
    column_default as "Default"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'workspaces'
ORDER BY ordinal_position;

SELECT
    '═══════════════════════════════════════════════════════' as separador;

SELECT
    'DIAGNÓSTICO CRÍTICO:' as info;

-- Verificar si tiene owner_id
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'workspaces'
              AND column_name = 'owner_id'
        )
        THEN '✅ Columna owner_id EXISTE'
        ELSE '❌ Columna owner_id NO EXISTE'
    END as "Estado owner_id";

-- Verificar si tiene created_by
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'workspaces'
              AND column_name = 'created_by'
        )
        THEN '✅ Columna created_by EXISTE'
        ELSE '❌ Columna created_by NO EXISTE'
    END as "Estado created_by";

SELECT
    '═══════════════════════════════════════════════════════' as separador;

SELECT
    'POLÍTICAS RLS QUE USAN owner_id:' as info;

SELECT
    policyname as "Política",
    cmd as "Comando",
    qual::text as "Condición"
FROM pg_policies
WHERE tablename = 'workspaces'
  AND (qual::text LIKE '%owner_id%' OR with_check::text LIKE '%owner_id%');

SELECT
    '═══════════════════════════════════════════════════════' as separador;

SELECT
    'POLÍTICAS RLS QUE USAN created_by:' as info;

SELECT
    policyname as "Política",
    cmd as "Comando",
    qual::text as "Condición"
FROM pg_policies
WHERE tablename = 'workspaces'
  AND (qual::text LIKE '%created_by%' OR with_check::text LIKE '%created_by%');
