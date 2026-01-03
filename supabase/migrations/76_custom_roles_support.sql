-- ============================================
-- 76. CUSTOM ROLE SUPPORT + INVITATION COLUMN
-- ============================================

-- Add custom_role_id to invitations (if missing)
ALTER TABLE public.invitations
ADD COLUMN IF NOT EXISTS custom_role_id UUID
REFERENCES public.custom_role_templates(id)
ON DELETE SET NULL;

-- Update permission checks to honor custom role templates
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_clinic_id UUID,
  p_resource TEXT,
  p_action TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_workspace_id UUID;
  v_ws_role TEXT;
  v_ws_custom_perms JSONB;
  v_ws_allowed_clinics UUID[];
  v_ws_custom_role_id UUID;
  v_ws_template_perms JSONB;
  v_ws_template_base TEXT;
  v_ws_allowed BOOLEAN;

  v_clinic_role TEXT;
  v_clinic_custom_perms JSONB;
  v_clinic_custom_role_id UUID;
  v_clinic_template_perms JSONB;
  v_clinic_template_base TEXT;
  v_clinic_allowed BOOLEAN;

  v_permission_key TEXT;
BEGIN
  v_permission_key := p_resource || '.' || p_action;

  SELECT c.workspace_id
  INTO v_workspace_id
  FROM public.clinics c
  WHERE c.id = p_clinic_id;

  IF v_workspace_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT wu.role, wu.custom_permissions, wu.allowed_clinics, wu.custom_role_id
  INTO v_ws_role, v_ws_custom_perms, v_ws_allowed_clinics, v_ws_custom_role_id
  FROM public.workspace_users wu
  WHERE wu.workspace_id = v_workspace_id
    AND wu.user_id = p_user_id
    AND wu.is_active = true;

  IF v_ws_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_ws_role = 'owner' THEN
    RETURN TRUE;
  END IF;

  IF v_ws_role = 'super_admin' THEN
    IF v_permission_key IN ('workspace.delete', 'workspace.transfer_ownership') THEN
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  END IF;

  IF v_ws_allowed_clinics IS NOT NULL AND array_length(v_ws_allowed_clinics, 1) > 0 THEN
    IF NOT (p_clinic_id = ANY(v_ws_allowed_clinics)) THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Workspace explicit overrides
  IF v_ws_custom_perms IS NOT NULL AND v_ws_custom_perms ? v_permission_key THEN
    RETURN (v_ws_custom_perms->>v_permission_key)::BOOLEAN;
  END IF;

  -- Workspace custom role (optional)
  IF v_ws_custom_role_id IS NOT NULL THEN
    SELECT crt.permissions, crt.base_role
    INTO v_ws_template_perms, v_ws_template_base
    FROM public.custom_role_templates crt
    WHERE crt.id = v_ws_custom_role_id
      AND crt.scope = 'workspace'
      AND crt.is_active = true;

    IF v_ws_template_perms IS NOT NULL AND v_ws_template_perms ? v_permission_key THEN
      v_ws_allowed := (v_ws_template_perms->>v_permission_key)::BOOLEAN;
    ELSIF v_ws_template_base IS NOT NULL THEN
      SELECT rp.allowed
      INTO v_ws_allowed
      FROM public.role_permissions rp
      WHERE rp.role = v_ws_template_base
        AND rp.scope = 'workspace'
        AND rp.resource = p_resource
        AND rp.action = p_action;
    END IF;
  ELSE
    SELECT rp.allowed
    INTO v_ws_allowed
    FROM public.role_permissions rp
    WHERE rp.role = v_ws_role
      AND rp.scope = 'workspace'
      AND rp.resource = p_resource
      AND rp.action = p_action;
  END IF;

  -- Clinic explicit overrides
  SELECT cu.role, cu.custom_permissions, cu.custom_role_id
  INTO v_clinic_role, v_clinic_custom_perms, v_clinic_custom_role_id
  FROM public.clinic_users cu
  WHERE cu.clinic_id = p_clinic_id
    AND cu.user_id = p_user_id
    AND cu.is_active = true;

  IF v_clinic_custom_perms IS NOT NULL AND v_clinic_custom_perms ? v_permission_key THEN
    RETURN (v_clinic_custom_perms->>v_permission_key)::BOOLEAN;
  END IF;

  -- Clinic custom role (optional)
  IF v_clinic_custom_role_id IS NOT NULL THEN
    SELECT crt.permissions, crt.base_role
    INTO v_clinic_template_perms, v_clinic_template_base
    FROM public.custom_role_templates crt
    WHERE crt.id = v_clinic_custom_role_id
      AND crt.scope = 'clinic'
      AND crt.is_active = true;

    IF v_clinic_template_perms IS NOT NULL AND v_clinic_template_perms ? v_permission_key THEN
      v_clinic_allowed := (v_clinic_template_perms->>v_permission_key)::BOOLEAN;
    ELSIF v_clinic_template_base IS NOT NULL THEN
      SELECT rp.allowed
      INTO v_clinic_allowed
      FROM public.role_permissions rp
      WHERE rp.role = v_clinic_template_base
        AND rp.scope = 'clinic'
        AND rp.resource = p_resource
        AND rp.action = p_action;
    END IF;
  ELSIF v_clinic_role IS NOT NULL THEN
    SELECT rp.allowed
    INTO v_clinic_allowed
    FROM public.role_permissions rp
    WHERE rp.role = v_clinic_role
      AND rp.scope = 'clinic'
      AND rp.resource = p_resource
      AND rp.action = p_action;
  END IF;

  IF v_clinic_allowed IS NOT NULL THEN
    RETURN v_clinic_allowed;
  END IF;

  IF v_ws_allowed IS NOT NULL THEN
    RETURN v_ws_allowed;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update permission map resolution to honor custom roles
CREATE OR REPLACE FUNCTION get_user_permissions(
  p_user_id UUID,
  p_clinic_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_workspace_id UUID;
  v_ws_role TEXT;
  v_ws_custom_perms JSONB;
  v_ws_custom_role_id UUID;
  v_ws_template_perms JSONB;
  v_ws_template_base TEXT;

  v_clinic_role TEXT;
  v_clinic_custom_perms JSONB;
  v_clinic_custom_role_id UUID;
  v_clinic_template_perms JSONB;
  v_clinic_template_base TEXT;

  v_result JSONB := '{}'::JSONB;
  v_perm JSONB;
BEGIN
  SELECT c.workspace_id
  INTO v_workspace_id
  FROM public.clinics c
  WHERE c.id = p_clinic_id;

  IF v_workspace_id IS NULL THEN
    RETURN v_result;
  END IF;

  SELECT wu.role, wu.custom_permissions, wu.custom_role_id
  INTO v_ws_role, v_ws_custom_perms, v_ws_custom_role_id
  FROM public.workspace_users wu
  WHERE wu.workspace_id = v_workspace_id
    AND wu.user_id = p_user_id
    AND wu.is_active = true;

  IF v_ws_role IS NULL THEN
    RETURN v_result;
  END IF;

  IF v_ws_role IN ('owner', 'super_admin') THEN
    SELECT COALESCE(jsonb_object_agg(rp.resource || '.' || rp.action, true), '{}'::jsonb)
    INTO v_result
    FROM public.role_permissions rp;
  ELSE
    SELECT COALESCE(jsonb_object_agg(rp.resource || '.' || rp.action, rp.allowed), '{}'::jsonb)
    INTO v_result
    FROM public.role_permissions rp
    WHERE rp.role = v_ws_role
      AND rp.scope = 'workspace';
  END IF;

  IF v_ws_custom_role_id IS NOT NULL THEN
    SELECT crt.permissions, crt.base_role
    INTO v_ws_template_perms, v_ws_template_base
    FROM public.custom_role_templates crt
    WHERE crt.id = v_ws_custom_role_id
      AND crt.scope = 'workspace'
      AND crt.is_active = true;

    IF v_ws_template_base IS NOT NULL THEN
      SELECT COALESCE(jsonb_object_agg(rp.resource || '.' || rp.action, rp.allowed), '{}'::jsonb)
      INTO v_perm
      FROM public.role_permissions rp
      WHERE rp.role = v_ws_template_base
        AND rp.scope = 'workspace';

      v_result := v_perm;
    ELSE
      v_result := '{}'::jsonb;
    END IF;

    IF v_ws_template_perms IS NOT NULL THEN
      v_result := v_result || v_ws_template_perms;
    END IF;
  END IF;

  IF v_ws_custom_perms IS NOT NULL THEN
    v_result := v_result || v_ws_custom_perms;
  END IF;

  SELECT cu.role, cu.custom_permissions, cu.custom_role_id
  INTO v_clinic_role, v_clinic_custom_perms, v_clinic_custom_role_id
  FROM public.clinic_users cu
  WHERE cu.clinic_id = p_clinic_id
    AND cu.user_id = p_user_id
    AND cu.is_active = true;

  IF v_clinic_role IS NOT NULL THEN
    SELECT COALESCE(jsonb_object_agg(rp.resource || '.' || rp.action, rp.allowed), '{}'::jsonb)
    INTO v_perm
    FROM public.role_permissions rp
    WHERE rp.role = v_clinic_role
      AND rp.scope = 'clinic';

    v_result := v_result || v_perm;
  END IF;

  IF v_clinic_custom_role_id IS NOT NULL THEN
    SELECT crt.permissions, crt.base_role
    INTO v_clinic_template_perms, v_clinic_template_base
    FROM public.custom_role_templates crt
    WHERE crt.id = v_clinic_custom_role_id
      AND crt.scope = 'clinic'
      AND crt.is_active = true;

    IF v_clinic_template_base IS NOT NULL THEN
      SELECT COALESCE(jsonb_object_agg(rp.resource || '.' || rp.action, rp.allowed), '{}'::jsonb)
      INTO v_perm
      FROM public.role_permissions rp
      WHERE rp.role = v_clinic_template_base
        AND rp.scope = 'clinic';

      v_result := v_result || v_perm;
    END IF;

    IF v_clinic_template_perms IS NOT NULL THEN
      v_result := v_result || v_clinic_template_perms;
    END IF;
  END IF;

  IF v_clinic_custom_perms IS NOT NULL THEN
    v_result := v_result || v_clinic_custom_perms;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION check_user_permission(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID, UUID) TO authenticated;
