-- ============================================
-- 72. FIX RLS POLICIES - clinic_memberships → clinic_users
-- ============================================
-- Corrige políticas RLS que referencian 'clinic_memberships'
-- (tabla que no existe) cambiándolas a 'clinic_users'
-- Date: 2025-12-30

-- =============================================================================
-- 1. FIX action_logs RLS POLICIES
-- =============================================================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view action logs for their clinics" ON action_logs;
DROP POLICY IF EXISTS "System can insert action logs" ON action_logs;

-- Recrear con clinic_users en lugar de clinic_memberships
CREATE POLICY "Users can view action logs for their clinics"
  ON action_logs
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id
      FROM clinic_users
      WHERE user_id = auth.uid()
      AND is_active = true
    )
    OR
    -- También permitir acceso a través de workspace_users
    clinic_id IN (
      SELECT c.id
      FROM clinics c
      JOIN workspace_users wu ON wu.workspace_id = c.workspace_id
      WHERE wu.user_id = auth.uid()
      AND wu.is_active = true
    )
  );

CREATE POLICY "System can insert action logs"
  ON action_logs
  FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id
      FROM clinic_users
      WHERE user_id = auth.uid()
      AND is_active = true
    )
    OR
    clinic_id IN (
      SELECT c.id
      FROM clinics c
      JOIN workspace_users wu ON wu.workspace_id = c.workspace_id
      WHERE wu.user_id = auth.uid()
      AND wu.is_active = true
    )
  );

-- =============================================================================
-- 2. FIX clinic_google_calendar RLS POLICIES
-- =============================================================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS clinic_google_calendar_select_policy ON clinic_google_calendar;
DROP POLICY IF EXISTS clinic_google_calendar_insert_policy ON clinic_google_calendar;
DROP POLICY IF EXISTS clinic_google_calendar_update_policy ON clinic_google_calendar;
DROP POLICY IF EXISTS clinic_google_calendar_delete_policy ON clinic_google_calendar;

-- Recrear con clinic_users
CREATE POLICY "clinic_google_calendar_select_policy"
  ON clinic_google_calendar
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_users
      WHERE user_id = auth.uid()
      AND is_active = true
    )
    OR
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspace_users wu ON wu.workspace_id = c.workspace_id
      WHERE wu.user_id = auth.uid()
      AND wu.is_active = true
    )
  );

CREATE POLICY "clinic_google_calendar_insert_policy"
  ON clinic_google_calendar
  FOR INSERT
  WITH CHECK (
    -- Solo admin de clínica o owner/admin de workspace
    clinic_id IN (
      SELECT clinic_id FROM clinic_users
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
    OR
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspace_users wu ON wu.workspace_id = c.workspace_id
      WHERE wu.user_id = auth.uid()
      AND wu.role IN ('owner', 'super_admin', 'admin')
      AND wu.is_active = true
    )
  );

CREATE POLICY "clinic_google_calendar_update_policy"
  ON clinic_google_calendar
  FOR UPDATE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_users
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
    OR
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspace_users wu ON wu.workspace_id = c.workspace_id
      WHERE wu.user_id = auth.uid()
      AND wu.role IN ('owner', 'super_admin', 'admin')
      AND wu.is_active = true
    )
  );

CREATE POLICY "clinic_google_calendar_delete_policy"
  ON clinic_google_calendar
  FOR DELETE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_users
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
    OR
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspace_users wu ON wu.workspace_id = c.workspace_id
      WHERE wu.user_id = auth.uid()
      AND wu.role IN ('owner', 'super_admin', 'admin')
      AND wu.is_active = true
    )
  );

-- =============================================================================
-- 3. CREAR FUNCIÓN HELPER: is_clinic_member
-- =============================================================================
-- Esta función verifica si un usuario es miembro de una clínica
-- ya sea directamente (clinic_users) o a través del workspace (workspace_users)

CREATE OR REPLACE FUNCTION is_clinic_member(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar membresía directa en clinic_users
  IF EXISTS (
    SELECT 1 FROM clinic_users
    WHERE clinic_id = p_clinic_id
    AND user_id = auth.uid()
    AND is_active = true
  ) THEN
    RETURN TRUE;
  END IF;

  -- Verificar membresía a través de workspace_users
  IF EXISTS (
    SELECT 1 FROM clinics c
    JOIN workspace_users wu ON wu.workspace_id = c.workspace_id
    WHERE c.id = p_clinic_id
    AND wu.user_id = auth.uid()
    AND wu.is_active = true
    -- Verificar allowed_clinics si está configurado
    AND (
      wu.allowed_clinics = '{}'
      OR wu.allowed_clinics IS NULL
      OR p_clinic_id = ANY(wu.allowed_clinics)
    )
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_clinic_member IS
'Verifica si el usuario actual es miembro de una clínica (directa o vía workspace)';

-- =============================================================================
-- 4. CREAR FUNCIÓN HELPER: is_clinic_admin
-- =============================================================================
-- Verifica si el usuario tiene rol de admin en la clínica

CREATE OR REPLACE FUNCTION is_clinic_admin(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar rol admin directo en clinic_users
  IF EXISTS (
    SELECT 1 FROM clinic_users
    WHERE clinic_id = p_clinic_id
    AND user_id = auth.uid()
    AND role = 'admin'
    AND is_active = true
  ) THEN
    RETURN TRUE;
  END IF;

  -- Verificar owner/super_admin/admin en workspace
  IF EXISTS (
    SELECT 1 FROM clinics c
    JOIN workspace_users wu ON wu.workspace_id = c.workspace_id
    WHERE c.id = p_clinic_id
    AND wu.user_id = auth.uid()
    AND wu.role IN ('owner', 'super_admin', 'admin')
    AND wu.is_active = true
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_clinic_admin IS
'Verifica si el usuario actual es admin de una clínica (directa o vía workspace)';

-- =============================================================================
-- 5. CREAR FUNCIÓN: user_has_clinic_access
-- =============================================================================
-- Esta función es llamada desde web/lib/clinic.ts

CREATE OR REPLACE FUNCTION user_has_clinic_access(p_clinic_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_clinic_member(p_clinic_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION user_has_clinic_access IS
'Alias de is_clinic_member para compatibilidad con código existente';

-- =============================================================================
-- 6. GRANTS
-- =============================================================================

GRANT EXECUTE ON FUNCTION is_clinic_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_clinic_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_clinic_access(UUID) TO authenticated;

-- =============================================================================
-- 7. VERIFICACIÓN
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== RLS POLICIES ACTUALIZADAS ===';
  RAISE NOTICE 'action_logs: 2 policies actualizadas';
  RAISE NOTICE 'clinic_google_calendar: 4 policies actualizadas';
  RAISE NOTICE 'Funciones creadas: is_clinic_member, is_clinic_admin, user_has_clinic_access';
END $$;
