-- Script de diagnóstico para el error al crear clínicas
-- Ejecutar en Supabase SQL Editor para ver la estructura actual y posibles problemas

-- 1. Verificar estructura de la tabla clinics
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clinics'
ORDER BY ordinal_position;

-- 2. Verificar constraints en la tabla clinics
SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    CASE con.contype
        WHEN 'c' THEN 'CHECK'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'x' THEN 'EXCLUSION'
    END AS constraint_type_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'clinics'
ORDER BY con.contype, con.conname;

-- 3. Verificar políticas RLS
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'clinics';

-- 4. Verificar si RLS está habilitado
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('clinics', 'workspaces');

-- 5. Verificar estructura de workspaces
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'workspaces'
ORDER BY ordinal_position;

-- 6. Test manual de inserción (esto debería fallar con el mismo error que estás viendo)
-- Reemplaza 'test-user-id' con un UUID de usuario real
DO $$
DECLARE
    test_workspace_id UUID;
    test_user_id UUID := auth.uid(); -- Esto usa el usuario actual
BEGIN
    -- Intentar crear workspace
    INSERT INTO public.workspaces (name, slug, owner_id)
    VALUES ('Test Workspace', 'test-workspace', test_user_id)
    RETURNING id INTO test_workspace_id;

    RAISE NOTICE 'Workspace creado con ID: %', test_workspace_id;

    -- Intentar crear clínica
    INSERT INTO public.clinics (name, address, phone, email, workspace_id)
    VALUES ('Test Clinic', 'Test Address', '1234567890', 'test@test.com', test_workspace_id);

    RAISE NOTICE 'Clínica creada exitosamente';

    -- Limpiar
    DELETE FROM public.clinics WHERE workspace_id = test_workspace_id;
    DELETE FROM public.workspaces WHERE id = test_workspace_id;

    RAISE NOTICE 'Test completado - limpieza exitosa';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: % - %', SQLERRM, SQLSTATE;
        -- Intentar limpiar si es posible
        BEGIN
            IF test_workspace_id IS NOT NULL THEN
                DELETE FROM public.clinics WHERE workspace_id = test_workspace_id;
                DELETE FROM public.workspaces WHERE id = test_workspace_id;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END;
END $$;
