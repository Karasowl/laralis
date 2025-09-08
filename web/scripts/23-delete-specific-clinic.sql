-- =====================================================
-- ELIMINAR CLÍNICA ESPECÍFICA: "Podent Arboleda"
-- =====================================================

-- 1. Primero, veamos TODAS las clínicas que existen con ese nombre
SELECT 
    c.id,
    c.name,
    c.workspace_id,
    c.created_at,
    w.name as workspace_name,
    w.owner_id,
    au.email as owner_email
FROM clinics c
LEFT JOIN workspaces w ON c.workspace_id = w.id
LEFT JOIN auth.users au ON w.owner_id = au.id
WHERE LOWER(c.name) LIKE '%podent%arboleda%'
ORDER BY c.created_at DESC;

-- 2. Ver tu usuario actual
SELECT 
    id as your_user_id,
    email as your_email
FROM auth.users
WHERE id = auth.uid();

-- 3. ELIMINAR la clínica "Podent Arboleda" 
-- Esta línea eliminará TODAS las clínicas con ese nombre
DELETE FROM clinics 
WHERE LOWER(name) LIKE '%podent%arboleda%';

-- 4. Si solo quieres eliminar las que NO son tuyas, usa esto en su lugar:
-- DELETE FROM clinics c
-- WHERE LOWER(c.name) LIKE '%podent%arboleda%'
-- AND NOT EXISTS (
--     SELECT 1 FROM workspaces w 
--     WHERE w.id = c.workspace_id 
--     AND w.owner_id = auth.uid()
-- );

-- 5. Verificar que se eliminó
SELECT 
    c.id,
    c.name,
    c.workspace_id,
    w.name as workspace_name,
    au.email as owner_email
FROM clinics c
LEFT JOIN workspaces w ON c.workspace_id = w.id
LEFT JOIN auth.users au ON w.owner_id = au.id
WHERE au.id = auth.uid() OR au.id IS NULL
ORDER BY c.name;

-- 6. Ver TODAS las clínicas que puedes ver actualmente
SELECT 
    COUNT(*) as total_clinicas,
    STRING_AGG(DISTINCT name, ', ' ORDER BY name) as nombres_clinicas
FROM clinics;