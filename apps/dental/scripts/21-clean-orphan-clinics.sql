-- =====================================================
-- LIMPIEZA: Eliminar clínicas huérfanas y verificar integridad
-- =====================================================

-- 1. Primero, veamos qué clínicas existen y sus relaciones
SELECT 
    c.id,
    c.name,
    c.workspace_id,
    w.name as workspace_name,
    w.owner_id,
    au.email as owner_email
FROM clinics c
LEFT JOIN workspaces w ON c.workspace_id = w.id
LEFT JOIN auth.users au ON w.owner_id = au.id
ORDER BY c.created_at DESC;

-- 2. Identificar clínicas huérfanas (sin workspace válido)
SELECT 
    c.id,
    c.name,
    c.workspace_id,
    c.created_at
FROM clinics c
WHERE NOT EXISTS (
    SELECT 1 
    FROM workspaces w 
    WHERE w.id = c.workspace_id
)
ORDER BY c.created_at DESC;

-- 3. ELIMINAR clínicas huérfanas (sin workspace asociado)
DELETE FROM clinics c
WHERE NOT EXISTS (
    SELECT 1 
    FROM workspaces w 
    WHERE w.id = c.workspace_id
);

-- 4. Verificar que todas las clínicas restantes tienen un workspace válido
SELECT 
    COUNT(*) as total_clinics,
    COUNT(DISTINCT workspace_id) as unique_workspaces,
    COUNT(CASE WHEN workspace_id IS NULL THEN 1 END) as null_workspace_count
FROM clinics;

-- 5. Listar clínicas por usuario (para verificar la separación correcta)
SELECT 
    au.email,
    w.name as workspace_name,
    COUNT(c.id) as clinic_count,
    STRING_AGG(c.name, ', ' ORDER BY c.name) as clinic_names
FROM auth.users au
JOIN workspaces w ON w.owner_id = au.id
LEFT JOIN clinics c ON c.workspace_id = w.id
GROUP BY au.email, w.name
ORDER BY au.email, w.name;

-- 6. Si necesitas eliminar una clínica específica por nombre
-- DESCOMENTA y EJECUTA solo si estás seguro:
-- DELETE FROM clinics WHERE LOWER(name) = 'podent arboleda';

-- 7. Verificar resultado final
SELECT 
    c.id,
    c.name,
    c.workspace_id,
    w.name as workspace_name,
    au.email as owner_email,
    c.created_at
FROM clinics c
JOIN workspaces w ON c.workspace_id = w.id
JOIN auth.users au ON w.owner_id = au.id
ORDER BY au.email, w.name, c.name;