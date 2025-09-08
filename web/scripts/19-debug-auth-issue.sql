-- =====================================================
-- SCRIPT DE DIAGNÓSTICO DE PROBLEMAS DE AUTENTICACIÓN
-- =====================================================

-- 1. Verificar si hay usuarios en la tabla auth.users
SELECT 
    id,
    email,
    created_at,
    last_sign_in_at,
    raw_user_meta_data->>'first_name' as first_name,
    raw_user_meta_data->>'last_name' as last_name
FROM auth.users
ORDER BY created_at DESC;

-- 2. Verificar si hay workspaces
SELECT 
    w.id,
    w.name,
    w.owner_id,
    w.created_at,
    u.email as owner_email
FROM workspaces w
LEFT JOIN auth.users u ON w.owner_id = u.id
ORDER BY w.created_at DESC;

-- 3. Verificar si hay clínicas
SELECT 
    c.id,
    c.name,
    c.workspace_id,
    w.name as workspace_name
FROM clinics c
LEFT JOIN workspaces w ON c.workspace_id = w.id
ORDER BY c.created_at DESC;

-- 4. Verificar la tabla workspace_members
SELECT 
    wm.workspace_id,
    wm.user_id,
    wm.role,
    u.email,
    w.name as workspace_name
FROM workspace_members wm
LEFT JOIN auth.users u ON wm.user_id = u.id
LEFT JOIN workspaces w ON wm.workspace_id = w.id;

-- 5. Si no hay workspaces para tu usuario, puedes crear uno manualmente
-- IMPORTANTE: Reemplaza 'TU_USER_ID' con el ID de tu usuario de la primera consulta
/*
-- Descomentar y ejecutar si necesitas crear un workspace manualmente:

INSERT INTO workspaces (name, slug, owner_id, onboarding_completed, onboarding_step)
VALUES (
    'Mi Consultorio',
    'mi-consultorio-' || substr(gen_random_uuid()::text, 1, 8),
    'TU_USER_ID', -- <-- REEMPLAZAR CON TU USER ID
    true,
    3
) RETURNING id;

-- Luego crear una clínica (reemplazar WORKSPACE_ID con el ID devuelto arriba):
INSERT INTO clinics (workspace_id, name, address, is_active)
VALUES (
    'WORKSPACE_ID', -- <-- REEMPLAZAR CON EL WORKSPACE ID
    'Clínica Principal',
    'Dirección de ejemplo',
    true
);
*/

-- 6. Verificar si RLS está activo (podría estar bloqueando)
SELECT 
    schemaname,
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('workspaces', 'clinics', 'patients')
ORDER BY tablename;