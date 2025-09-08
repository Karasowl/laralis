-- =====================================================
-- CONFIGURAR POLÍTICAS RLS (Row Level Security)
-- Para asegurar aislamiento correcto entre usuarios
-- =====================================================

-- IMPORTANTE: Ejecutar este script en Supabase SQL Editor

-- 1. Habilitar RLS en todas las tablas principales
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para WORKSPACES
-- Los usuarios solo pueden ver/editar sus propios workspaces
DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
CREATE POLICY "Users can view own workspaces" ON workspaces
    FOR SELECT
    USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can create own workspaces" ON workspaces;
CREATE POLICY "Users can create own workspaces" ON workspaces
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
CREATE POLICY "Users can update own workspaces" ON workspaces
    FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own workspaces" ON workspaces;
CREATE POLICY "Users can delete own workspaces" ON workspaces
    FOR DELETE
    USING (auth.uid() = owner_id);

-- 3. Políticas para CLINICS
-- Los usuarios solo pueden ver/editar clínicas de sus workspaces
DROP POLICY IF EXISTS "Users can view clinics in their workspaces" ON clinics;
CREATE POLICY "Users can view clinics in their workspaces" ON clinics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspaces 
            WHERE workspaces.id = clinics.workspace_id 
            AND workspaces.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create clinics in their workspaces" ON clinics;
CREATE POLICY "Users can create clinics in their workspaces" ON clinics
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workspaces 
            WHERE workspaces.id = clinics.workspace_id 
            AND workspaces.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update clinics in their workspaces" ON clinics;
CREATE POLICY "Users can update clinics in their workspaces" ON clinics
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workspaces 
            WHERE workspaces.id = clinics.workspace_id 
            AND workspaces.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workspaces 
            WHERE workspaces.id = clinics.workspace_id 
            AND workspaces.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete clinics in their workspaces" ON clinics;
CREATE POLICY "Users can delete clinics in their workspaces" ON clinics
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workspaces 
            WHERE workspaces.id = clinics.workspace_id 
            AND workspaces.owner_id = auth.uid()
        )
    );

-- 4. Políticas para SUPPLIES
-- Los usuarios solo pueden ver/editar insumos de sus clínicas
DROP POLICY IF EXISTS "Users can view supplies in their clinics" ON supplies;
CREATE POLICY "Users can view supplies in their clinics" ON supplies
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM clinics 
            JOIN workspaces ON workspaces.id = clinics.workspace_id
            WHERE clinics.id = supplies.clinic_id 
            AND workspaces.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create supplies in their clinics" ON supplies;
CREATE POLICY "Users can create supplies in their clinics" ON supplies
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM clinics 
            JOIN workspaces ON workspaces.id = clinics.workspace_id
            WHERE clinics.id = supplies.clinic_id 
            AND workspaces.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update supplies in their clinics" ON supplies;
CREATE POLICY "Users can update supplies in their clinics" ON supplies
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM clinics 
            JOIN workspaces ON workspaces.id = clinics.workspace_id
            WHERE clinics.id = supplies.clinic_id 
            AND workspaces.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete supplies in their clinics" ON supplies;
CREATE POLICY "Users can delete supplies in their clinics" ON supplies
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM clinics 
            JOIN workspaces ON workspaces.id = clinics.workspace_id
            WHERE clinics.id = supplies.clinic_id 
            AND workspaces.owner_id = auth.uid()
        )
    );

-- 5. Verificar que RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'workspaces', 'clinics', 'workspace_members', 
    'settings_time', 'assets', 'fixed_costs',
    'supplies', 'services', 'service_supplies',
    'patients', 'treatments'
)
ORDER BY tablename;