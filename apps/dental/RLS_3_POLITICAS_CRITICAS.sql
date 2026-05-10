-- =====================================================
-- PASO 3: POLÍTICAS CRÍTICAS DE SEGURIDAD
-- =====================================================
-- Ejecuta TODO este archivo tercero
-- ESTAS SON LAS MÁS IMPORTANTES
-- =====================================================

-- WORKSPACES - Solo el dueño puede ver/modificar
DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
CREATE POLICY "Users can view own workspaces" ON workspaces
    FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own workspaces" ON workspaces;
CREATE POLICY "Users can insert own workspaces" ON workspaces
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
CREATE POLICY "Users can update own workspaces" ON workspaces
    FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own workspaces" ON workspaces;
CREATE POLICY "Users can delete own workspaces" ON workspaces
    FOR DELETE USING (auth.uid() = owner_id);

-- CLINICS - Solo las del workspace propio
DROP POLICY IF EXISTS "Users can view clinics in their workspaces" ON clinics;
CREATE POLICY "Users can view clinics in their workspaces" ON clinics
    FOR SELECT USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert clinics in their workspaces" ON clinics;
CREATE POLICY "Users can insert clinics in their workspaces" ON clinics
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update clinics in their workspaces" ON clinics;
CREATE POLICY "Users can update clinics in their workspaces" ON clinics
    FOR UPDATE USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete clinics in their workspaces" ON clinics;
CREATE POLICY "Users can delete clinics in their workspaces" ON clinics
    FOR DELETE USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

-- Verificar que se crearon:
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('workspaces', 'clinics')
ORDER BY tablename;