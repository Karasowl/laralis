-- =================================================================
-- FIX: Políticas RLS para permitir onboarding
-- =================================================================
--
-- PROBLEMA:
-- 1. workspaces NO tiene política de INSERT
-- 2. clinics requiere que el usuario ya esté en workspace_users
--    pero en onboarding esto aún no sucede
--
-- SOLUCIÓN:
-- Agregar políticas que permitan a usuarios autenticados:
-- 1. Crear sus propios workspaces
-- 2. Crear clínicas en workspaces que ellos crearon
-- =================================================================

-- 1. Permitir a usuarios autenticados crear workspaces
-- NOTA: Esto es seguro porque solo se permite si están autenticados
DROP POLICY IF EXISTS "Users can create their own workspaces" ON public.workspaces;
CREATE POLICY "Users can create their own workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

-- 2. Permitir crear clínicas en workspaces propios (durante onboarding)
-- NOTA: Se verifica con created_by en workspaces, no con workspace_users
DROP POLICY IF EXISTS "Creators can create clinics in their workspace" ON public.clinics;
CREATE POLICY "Creators can create clinics in their workspace" ON public.clinics
  FOR INSERT WITH CHECK (
    -- El usuario es el creador del workspace
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = clinics.workspace_id
      AND workspaces.created_by = auth.uid()
    )
  );

-- 3. IMPORTANTE: Mantener la política original para admins
-- (esta ya existe, solo documentamos)
-- "Admins can create clinics" - permite a admins de workspace_users crear clínicas

-- =================================================================
-- RESULTADO ESPERADO:
-- =================================================================
-- Ahora el onboarding funcionará así:
-- 1. Usuario autenticado crea workspace ✅ (política nueva #1)
-- 2. Usuario crea clínica en su workspace ✅ (política nueva #2)
-- 3. Se guarda clinicId/workspaceId en cookies/localStorage
-- 4. Redirige a /setup ✅
--
-- Además, después del onboarding:
-- - Admins pueden seguir creando clínicas (política existente)
-- - Usuarios solo pueden crear workspaces propios (seguro)
-- =================================================================

-- VERIFICACIÓN:
SELECT
    'POLÍTICAS RLS ACTUALIZADAS' as status,
    'Verificar que las 3 políticas existan:' as verificacion;

SELECT
    tablename as tabla,
    policyname as politica,
    cmd as comando
FROM pg_policies
WHERE tablename IN ('workspaces', 'clinics')
  AND policyname IN (
    'Users can create their own workspaces',
    'Creators can create clinics in their workspace',
    'Admins can create clinics'
  )
ORDER BY tablename, policyname;
