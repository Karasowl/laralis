-- ============================================
-- 70. SISTEMA DE PERMISOS GRANULARES
-- ============================================
-- Actualiza el sistema de membresías para soportar:
-- - Permisos granulares por recurso/acción
-- - Roles personalizados por workspace
-- - Restricción de acceso a clínicas específicas
-- - Override de permisos a nivel individual
-- Date: 2025-12-30

-- =============================================================================
-- 1. ACTUALIZAR CONSTRAINT DE ROLES EN workspace_users
-- =============================================================================

-- Primero, actualizamos registros existentes que usan 'member' a 'editor'
UPDATE workspace_users
SET role = 'editor'
WHERE role = 'member';

-- Eliminar constraint antiguo y crear nuevo con roles expandidos
ALTER TABLE workspace_users
DROP CONSTRAINT IF EXISTS valid_workspace_role;

ALTER TABLE workspace_users
ADD CONSTRAINT valid_workspace_role
CHECK (role IN ('owner', 'super_admin', 'admin', 'editor', 'viewer'));

-- =============================================================================
-- 2. AGREGAR COLUMNAS A workspace_users
-- =============================================================================

-- Campo para restringir acceso a clínicas específicas
-- NULL o array vacío = acceso a todas las clínicas del workspace
ALTER TABLE workspace_users
ADD COLUMN IF NOT EXISTS allowed_clinics UUID[] DEFAULT '{}';

-- Campo para override de permisos individuales (JSONB)
-- Ejemplo: {"patients.delete": true, "expenses.view": false}
ALTER TABLE workspace_users
ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT NULL;

-- Índice GIN para búsquedas eficientes en allowed_clinics
CREATE INDEX IF NOT EXISTS idx_workspace_users_allowed_clinics
ON workspace_users USING GIN (allowed_clinics);

-- =============================================================================
-- 3. AGREGAR COLUMNAS A clinic_users
-- =============================================================================

-- Campo para override de permisos a nivel de clínica
ALTER TABLE clinic_users
ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT NULL;

-- =============================================================================
-- 4. TABLA DE ROLES PERSONALIZADOS POR WORKSPACE
-- =============================================================================

CREATE TABLE IF NOT EXISTS custom_role_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Identificación del rol
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,

  -- Permisos del rol (JSONB con estructura {resource.action: boolean})
  -- Ejemplo: {"patients.view": true, "patients.create": true, "expenses.view": false}
  permissions JSONB NOT NULL DEFAULT '{}',

  -- Scope: 'workspace' o 'clinic'
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('workspace', 'clinic')),

  -- Si está basado en un rol predefinido
  base_role VARCHAR(50),

  -- Estado
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unicidad: un slug único por workspace
  UNIQUE(workspace_id, slug)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_custom_role_templates_workspace
ON custom_role_templates(workspace_id);

CREATE INDEX IF NOT EXISTS idx_custom_role_templates_scope
ON custom_role_templates(scope);

-- Trigger para updated_at
CREATE TRIGGER update_custom_role_templates_updated_at
BEFORE UPDATE ON custom_role_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE custom_role_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios pueden ver roles de su workspace
CREATE POLICY "custom_role_templates_select_policy"
ON custom_role_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_users wu
    WHERE wu.workspace_id = custom_role_templates.workspace_id
    AND wu.user_id = auth.uid()
  )
);

-- Policy: Solo owner/admin pueden crear/editar/eliminar roles
CREATE POLICY "custom_role_templates_modify_policy"
ON custom_role_templates FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspace_users wu
    WHERE wu.workspace_id = custom_role_templates.workspace_id
    AND wu.user_id = auth.uid()
    AND wu.role IN ('owner', 'super_admin', 'admin')
  )
);

-- =============================================================================
-- 5. AGREGAR custom_role_id A workspace_users Y clinic_users
-- =============================================================================

-- Referencia a rol custom en workspace_users
ALTER TABLE workspace_users
ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES custom_role_templates(id) ON DELETE SET NULL;

-- Referencia a rol custom en clinic_users
ALTER TABLE clinic_users
ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES custom_role_templates(id) ON DELETE SET NULL;

-- =============================================================================
-- 6. TABLA DE PERMISOS BASE POR ROL
-- =============================================================================

-- Eliminar tabla existente si tiene estructura diferente
DROP TABLE IF EXISTS role_permissions CASCADE;

-- Crear tabla modernizada
CREATE TABLE role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identificación del rol y scope
  role VARCHAR(50) NOT NULL,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('workspace', 'clinic')),

  -- Permiso específico
  resource VARCHAR(100) NOT NULL,  -- ej: 'patients', 'treatments', 'expenses'
  action VARCHAR(50) NOT NULL,      -- ej: 'view', 'create', 'edit', 'delete'

  -- Si el permiso está permitido
  allowed BOOLEAN DEFAULT true,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unicidad: un permiso por rol/scope/resource/action
  UNIQUE(role, scope, resource, action)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_scope
ON role_permissions(role, scope);

CREATE INDEX IF NOT EXISTS idx_role_permissions_resource
ON role_permissions(resource, action);

-- RLS (lectura pública para usuarios autenticados)
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_select_policy"
ON role_permissions FOR SELECT
TO authenticated
USING (true);

-- Solo service_role puede modificar
CREATE POLICY "role_permissions_modify_policy"
ON role_permissions FOR ALL
TO service_role
USING (true);

-- =============================================================================
-- 7. FUNCIÓN PARA VERIFICAR PERMISO
-- =============================================================================

CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_clinic_id UUID,
  p_resource TEXT,
  p_action TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_workspace_id UUID;
  v_ws_role TEXT;
  v_clinic_role TEXT;
  v_ws_custom_perms JSONB;
  v_clinic_custom_perms JSONB;
  v_allowed_clinics UUID[];
  v_permission_key TEXT;
  v_allowed BOOLEAN;
BEGIN
  -- Construir key del permiso
  v_permission_key := p_resource || '.' || p_action;

  -- Obtener workspace de la clínica
  SELECT workspace_id INTO v_workspace_id
  FROM clinics WHERE id = p_clinic_id;

  IF v_workspace_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Obtener rol y permisos del workspace
  SELECT role, custom_permissions, allowed_clinics
  INTO v_ws_role, v_ws_custom_perms, v_allowed_clinics
  FROM workspace_users
  WHERE workspace_id = v_workspace_id
  AND user_id = p_user_id
  AND is_active = true;

  -- Si no es miembro del workspace, denegar
  IF v_ws_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Owner tiene TODOS los permisos
  IF v_ws_role = 'owner' THEN
    RETURN TRUE;
  END IF;

  -- Super admin tiene casi todos los permisos (excepto algunos)
  IF v_ws_role = 'super_admin' THEN
    -- Denegar solo acciones críticas de ownership
    IF v_permission_key IN ('workspace.delete', 'workspace.transfer_ownership') THEN
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  END IF;

  -- Verificar acceso a la clínica específica
  -- Si allowed_clinics está vacío o es NULL, tiene acceso a todas
  IF v_allowed_clinics IS NOT NULL AND array_length(v_allowed_clinics, 1) > 0 THEN
    IF NOT (p_clinic_id = ANY(v_allowed_clinics)) THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- 1. Verificar override en custom_permissions de workspace_users
  IF v_ws_custom_perms IS NOT NULL AND v_ws_custom_perms ? v_permission_key THEN
    RETURN (v_ws_custom_perms->>v_permission_key)::BOOLEAN;
  END IF;

  -- 2. Verificar rol específico de clínica
  SELECT role, custom_permissions INTO v_clinic_role, v_clinic_custom_perms
  FROM clinic_users
  WHERE clinic_id = p_clinic_id
  AND user_id = p_user_id
  AND is_active = true;

  IF v_clinic_role IS NOT NULL THEN
    -- Verificar override en custom_permissions de clinic_users
    IF v_clinic_custom_perms IS NOT NULL AND v_clinic_custom_perms ? v_permission_key THEN
      RETURN (v_clinic_custom_perms->>v_permission_key)::BOOLEAN;
    END IF;

    -- Usar permisos base del rol de clínica
    SELECT allowed INTO v_allowed
    FROM role_permissions
    WHERE role = v_clinic_role
    AND scope = 'clinic'
    AND resource = p_resource
    AND action = p_action;

    IF v_allowed IS NOT NULL THEN
      RETURN v_allowed;
    END IF;
  END IF;

  -- 3. Fallback a permisos del rol de workspace
  SELECT allowed INTO v_allowed
  FROM role_permissions
  WHERE role = v_ws_role
  AND scope = 'workspace'
  AND resource = p_resource
  AND action = p_action;

  -- Si no hay permiso definido, denegar por defecto
  RETURN COALESCE(v_allowed, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION check_user_permission IS
'Verifica si un usuario tiene un permiso específico para una clínica.
Flujo: Owner → Super Admin → Clinic Access → Custom Perms → Clinic Role → Workspace Role';

-- =============================================================================
-- 8. FUNCIÓN WRAPPER PARA USO CON auth.uid()
-- =============================================================================

CREATE OR REPLACE FUNCTION has_permission(
  p_clinic_id UUID,
  p_resource TEXT,
  p_action TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN check_user_permission(auth.uid(), p_clinic_id, p_resource, p_action);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION has_permission IS
'Wrapper de check_user_permission que usa auth.uid() automáticamente';

-- =============================================================================
-- 9. FUNCIÓN PARA OBTENER TODOS LOS PERMISOS DE UN USUARIO
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_permissions(
  p_user_id UUID,
  p_clinic_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_workspace_id UUID;
  v_ws_role TEXT;
  v_clinic_role TEXT;
  v_ws_custom_perms JSONB;
  v_clinic_custom_perms JSONB;
  v_result JSONB;
  v_perm RECORD;
BEGIN
  v_result := '{}'::JSONB;

  -- Obtener workspace de la clínica
  SELECT workspace_id INTO v_workspace_id
  FROM clinics WHERE id = p_clinic_id;

  IF v_workspace_id IS NULL THEN
    RETURN v_result;
  END IF;

  -- Obtener rol del workspace
  SELECT role, custom_permissions INTO v_ws_role, v_ws_custom_perms
  FROM workspace_users
  WHERE workspace_id = v_workspace_id
  AND user_id = p_user_id
  AND is_active = true;

  IF v_ws_role IS NULL THEN
    RETURN v_result;
  END IF;

  -- Owner tiene todos los permisos
  IF v_ws_role = 'owner' THEN
    FOR v_perm IN
      SELECT DISTINCT resource, action FROM role_permissions
    LOOP
      v_result := v_result || jsonb_build_object(
        v_perm.resource || '.' || v_perm.action, true
      );
    END LOOP;
    RETURN v_result;
  END IF;

  -- Super admin tiene casi todos
  IF v_ws_role = 'super_admin' THEN
    FOR v_perm IN
      SELECT DISTINCT resource, action FROM role_permissions
      WHERE NOT (resource = 'workspace' AND action IN ('delete', 'transfer_ownership'))
    LOOP
      v_result := v_result || jsonb_build_object(
        v_perm.resource || '.' || v_perm.action, true
      );
    END LOOP;
    RETURN v_result;
  END IF;

  -- Cargar permisos base del rol de workspace
  FOR v_perm IN
    SELECT resource, action, allowed FROM role_permissions
    WHERE role = v_ws_role AND scope = 'workspace'
  LOOP
    v_result := v_result || jsonb_build_object(
      v_perm.resource || '.' || v_perm.action, v_perm.allowed
    );
  END LOOP;

  -- Sobrescribir con rol de clínica si existe
  SELECT role, custom_permissions INTO v_clinic_role, v_clinic_custom_perms
  FROM clinic_users
  WHERE clinic_id = p_clinic_id
  AND user_id = p_user_id
  AND is_active = true;

  IF v_clinic_role IS NOT NULL THEN
    FOR v_perm IN
      SELECT resource, action, allowed FROM role_permissions
      WHERE role = v_clinic_role AND scope = 'clinic'
    LOOP
      v_result := v_result || jsonb_build_object(
        v_perm.resource || '.' || v_perm.action, v_perm.allowed
      );
    END LOOP;

    -- Aplicar custom permissions de clínica
    IF v_clinic_custom_perms IS NOT NULL THEN
      v_result := v_result || v_clinic_custom_perms;
    END IF;
  END IF;

  -- Aplicar custom permissions de workspace (mayor prioridad)
  IF v_ws_custom_perms IS NOT NULL THEN
    v_result := v_result || v_ws_custom_perms;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_permissions IS
'Retorna todos los permisos de un usuario para una clínica como JSONB';

-- =============================================================================
-- 10. ACTUALIZAR INVITATIONS PARA SOPORTAR MÚLTIPLES CLÍNICAS
-- =============================================================================

-- Agregar campo para múltiples clínicas
ALTER TABLE invitations
ADD COLUMN IF NOT EXISTS clinic_ids UUID[] DEFAULT '{}';

-- Agregar campo para permisos personalizados
ALTER TABLE invitations
ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT NULL;

-- Agregar campo para mensaje personalizado
ALTER TABLE invitations
ADD COLUMN IF NOT EXISTS message TEXT;

-- Campos para reenvío
ALTER TABLE invitations
ADD COLUMN IF NOT EXISTS resent_count INTEGER DEFAULT 0;

ALTER TABLE invitations
ADD COLUMN IF NOT EXISTS last_resent_at TIMESTAMPTZ;

-- Índice para búsqueda por clinic_ids
CREATE INDEX IF NOT EXISTS idx_invitations_clinic_ids
ON invitations USING GIN (clinic_ids);

-- =============================================================================
-- 11. GRANTS
-- =============================================================================

-- Funciones accesibles para usuarios autenticados
GRANT EXECUTE ON FUNCTION check_user_permission(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION has_permission(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID, UUID) TO authenticated;

-- Service role tiene acceso completo
GRANT ALL ON custom_role_templates TO service_role;
GRANT ALL ON role_permissions TO service_role;

-- Usuarios autenticados pueden leer
GRANT SELECT ON custom_role_templates TO authenticated;
GRANT SELECT ON role_permissions TO authenticated;

-- =============================================================================
-- 12. COMENTARIOS
-- =============================================================================

COMMENT ON TABLE custom_role_templates IS
'Roles personalizados por workspace. Permite crear roles con permisos específicos además de los predefinidos.';

COMMENT ON TABLE role_permissions IS
'Matriz de permisos base por rol. Define qué acciones puede realizar cada rol predefinido.';

COMMENT ON COLUMN workspace_users.allowed_clinics IS
'Array de UUIDs de clínicas a las que el usuario tiene acceso. Vacío = todas las clínicas.';

COMMENT ON COLUMN workspace_users.custom_permissions IS
'Override de permisos individuales. Formato: {"resource.action": boolean}';

COMMENT ON COLUMN clinic_users.custom_permissions IS
'Override de permisos a nivel de clínica. Formato: {"resource.action": boolean}';
