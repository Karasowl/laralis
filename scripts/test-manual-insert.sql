-- Script de prueba manual para simular el onboarding
-- Ejecutar en Supabase SQL Editor mientras estás autenticado

-- PASO 1: Verificar quién soy
SELECT
    'Usuario actual:' as info,
    auth.uid() as user_id,
    auth.email() as user_email;

-- PASO 2: Intentar crear un workspace
DO $$
DECLARE
    v_workspace_id UUID;
    v_clinic_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    -- Verificar que estamos autenticados
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado - auth.uid() es NULL';
    END IF;

    RAISE NOTICE 'Usuario autenticado: %', v_user_id;

    -- Intentar crear workspace
    BEGIN
        INSERT INTO public.workspaces (name, slug, description, owner_id)
        VALUES (
            'Test Workspace Manual',
            'test-workspace-manual-' || substr(gen_random_uuid()::text, 1, 8),
            'Testing manual insert',
            v_user_id
        )
        RETURNING id INTO v_workspace_id;

        RAISE NOTICE '✅ Workspace creado: %', v_workspace_id;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION '❌ Error creando workspace: % - %', SQLERRM, SQLSTATE;
    END;

    -- Intentar crear clínica
    BEGIN
        INSERT INTO public.clinics (name, address, phone, email, workspace_id)
        VALUES (
            'Test Clinic Manual',
            'Test Address',
            '1234567890',
            'test@manual.com',
            v_workspace_id
        )
        RETURNING id INTO v_clinic_id;

        RAISE NOTICE '✅ Clínica creada: %', v_clinic_id;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION '❌ Error creando clínica: % - %', SQLERRM, SQLSTATE;
    END;

    -- Limpiar (rollback)
    DELETE FROM public.clinics WHERE id = v_clinic_id;
    DELETE FROM public.workspaces WHERE id = v_workspace_id;

    RAISE NOTICE '✅ Test completado exitosamente - limpieza realizada';
END $$;

-- PASO 3: Verificar políticas que aplican al usuario actual
SELECT
    'Políticas que aplican a mi usuario:' as info;

SELECT
    tablename,
    policyname,
    cmd,
    CASE
        WHEN cmd = 'INSERT' THEN 'Esta política permite INSERT'
        WHEN cmd = 'SELECT' THEN 'Esta política permite SELECT'
        WHEN cmd = 'UPDATE' THEN 'Esta política permite UPDATE'
        WHEN cmd = 'DELETE' THEN 'Esta política permite DELETE'
    END as descripcion
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('workspaces', 'clinics')
  AND cmd = 'INSERT'
ORDER BY tablename, policyname;
