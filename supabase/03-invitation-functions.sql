-- ============================================
-- 03. FUNCIONES DE INVITACIÓN Y GESTIÓN DE USUARIOS
-- ============================================
-- Ejecutar después del script 02
-- Orden: Tercer script

-- Función para crear workspace con usuario owner
CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  p_name VARCHAR,
  p_slug VARCHAR,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_workspace_id UUID;
  v_user_id UUID;
BEGIN
  -- Obtener el ID del usuario actual
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;
  
  -- Crear el workspace
  INSERT INTO public.workspaces (name, slug, description, created_by)
  VALUES (p_name, p_slug, p_description, v_user_id)
  RETURNING id INTO v_workspace_id;
  
  -- Asignar al usuario como owner
  INSERT INTO public.workspace_users (workspace_id, user_id, role, is_active)
  VALUES (v_workspace_id, v_user_id, 'owner', true);
  
  RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para invitar usuario a workspace
CREATE OR REPLACE FUNCTION public.invite_user_to_workspace(
  p_workspace_id UUID,
  p_email VARCHAR,
  p_role VARCHAR,
  p_clinic_id UUID DEFAULT NULL,
  p_permissions JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
  v_invitation_id UUID;
  v_token VARCHAR;
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_inviter_id UUID;
  v_can_invite BOOLEAN;
BEGIN
  -- Verificar que el usuario actual puede invitar
  v_inviter_id := auth.uid();
  
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_users
    WHERE workspace_id = p_workspace_id
    AND user_id = v_inviter_id
    AND role IN ('owner', 'admin')
    AND is_active = true
  ) INTO v_can_invite;
  
  IF NOT v_can_invite THEN
    RAISE EXCEPTION 'No tienes permisos para invitar usuarios';
  END IF;
  
  -- Verificar límite de usuarios del workspace
  IF (SELECT COUNT(*) FROM public.workspace_users WHERE workspace_id = p_workspace_id) >= 
     (SELECT max_users FROM public.workspaces WHERE id = p_workspace_id) THEN
    RAISE EXCEPTION 'Se ha alcanzado el límite de usuarios para este workspace';
  END IF;
  
  -- Generar token único
  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := NOW() + INTERVAL '7 days';
  
  -- Crear invitación
  INSERT INTO public.invitations (
    workspace_id, clinic_id, email, role, permissions,
    token, expires_at, invited_by
  ) VALUES (
    p_workspace_id, p_clinic_id, p_email, p_role, p_permissions,
    v_token, v_expires_at, v_inviter_id
  ) RETURNING id INTO v_invitation_id;
  
  -- TODO: Aquí se debería enviar el email con el link de invitación
  -- El link sería algo como: https://app.laralis.com/invite/{token}
  
  RETURN v_invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para aceptar invitación
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token VARCHAR)
RETURNS JSONB AS $$
DECLARE
  v_invitation RECORD;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Obtener usuario actual
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;
  
  -- Buscar invitación válida
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE token = p_token
  AND expires_at > NOW()
  AND accepted_at IS NULL
  AND rejected_at IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitación inválida o expirada';
  END IF;
  
  -- Verificar que el email coincide
  IF v_invitation.email != (SELECT email FROM auth.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Esta invitación no es para tu cuenta';
  END IF;
  
  -- Si es invitación a workspace
  IF v_invitation.clinic_id IS NULL THEN
    INSERT INTO public.workspace_users (
      workspace_id, user_id, role, permissions, is_active,
      invited_by, invitation_accepted_at
    ) VALUES (
      v_invitation.workspace_id, v_user_id, v_invitation.role,
      v_invitation.permissions, true, v_invitation.invited_by, NOW()
    )
    ON CONFLICT (workspace_id, user_id) 
    DO UPDATE SET 
      role = EXCLUDED.role,
      permissions = EXCLUDED.permissions,
      is_active = true,
      invitation_accepted_at = NOW();
  ELSE
    -- Es invitación a clínica específica
    INSERT INTO public.clinic_users (
      clinic_id, user_id, role, permissions, is_active
    ) VALUES (
      v_invitation.clinic_id, v_user_id, v_invitation.role,
      v_invitation.permissions, true
    )
    ON CONFLICT (clinic_id, user_id)
    DO UPDATE SET
      role = EXCLUDED.role,
      permissions = EXCLUDED.permissions,
      is_active = true;
  END IF;
  
  -- Marcar invitación como aceptada
  UPDATE public.invitations
  SET accepted_at = NOW()
  WHERE id = v_invitation.id;
  
  -- Retornar información del workspace/clínica
  v_result := jsonb_build_object(
    'success', true,
    'workspace_id', v_invitation.workspace_id,
    'clinic_id', v_invitation.clinic_id,
    'role', v_invitation.role
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para cambiar rol de usuario
CREATE OR REPLACE FUNCTION public.change_user_role(
  p_workspace_id UUID,
  p_target_user_id UUID,
  p_new_role VARCHAR,
  p_clinic_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_user_id UUID;
  v_current_user_role VARCHAR;
  v_target_user_role VARCHAR;
BEGIN
  v_current_user_id := auth.uid();
  
  -- Obtener rol del usuario actual
  SELECT role INTO v_current_user_role
  FROM public.workspace_users
  WHERE workspace_id = p_workspace_id
  AND user_id = v_current_user_id
  AND is_active = true;
  
  -- Solo owners y admins pueden cambiar roles
  IF v_current_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'No tienes permisos para cambiar roles';
  END IF;
  
  -- Si es cambio en workspace
  IF p_clinic_id IS NULL THEN
    -- Obtener rol actual del target
    SELECT role INTO v_target_user_role
    FROM public.workspace_users
    WHERE workspace_id = p_workspace_id
    AND user_id = p_target_user_id;
    
    -- No se puede cambiar el rol del owner
    IF v_target_user_role = 'owner' THEN
      RAISE EXCEPTION 'No se puede cambiar el rol del owner';
    END IF;
    
    -- Solo el owner puede asignar rol de admin
    IF p_new_role = 'admin' AND v_current_user_role != 'owner' THEN
      RAISE EXCEPTION 'Solo el owner puede asignar rol de administrador';
    END IF;
    
    -- Actualizar rol
    UPDATE public.workspace_users
    SET role = p_new_role, updated_at = NOW()
    WHERE workspace_id = p_workspace_id
    AND user_id = p_target_user_id;
  ELSE
    -- Es cambio en clínica
    UPDATE public.clinic_users
    SET role = p_new_role, updated_at = NOW()
    WHERE clinic_id = p_clinic_id
    AND user_id = p_target_user_id;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para remover usuario
CREATE OR REPLACE FUNCTION public.remove_user_from_workspace(
  p_workspace_id UUID,
  p_target_user_id UUID,
  p_clinic_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_user_id UUID;
  v_current_user_role VARCHAR;
  v_target_user_role VARCHAR;
BEGIN
  v_current_user_id := auth.uid();
  
  -- Verificar permisos
  SELECT role INTO v_current_user_role
  FROM public.workspace_users
  WHERE workspace_id = p_workspace_id
  AND user_id = v_current_user_id
  AND is_active = true;
  
  IF v_current_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'No tienes permisos para remover usuarios';
  END IF;
  
  IF p_clinic_id IS NULL THEN
    -- Remover de workspace
    SELECT role INTO v_target_user_role
    FROM public.workspace_users
    WHERE workspace_id = p_workspace_id
    AND user_id = p_target_user_id;
    
    -- No se puede remover al owner
    IF v_target_user_role = 'owner' THEN
      RAISE EXCEPTION 'No se puede remover al owner del workspace';
    END IF;
    
    -- Solo el owner puede remover admins
    IF v_target_user_role = 'admin' AND v_current_user_role != 'owner' THEN
      RAISE EXCEPTION 'Solo el owner puede remover administradores';
    END IF;
    
    -- Soft delete
    UPDATE public.workspace_users
    SET is_active = false, updated_at = NOW()
    WHERE workspace_id = p_workspace_id
    AND user_id = p_target_user_id;
    
    -- También desactivar en todas las clínicas del workspace
    UPDATE public.clinic_users
    SET is_active = false, updated_at = NOW()
    WHERE clinic_id IN (
      SELECT id FROM public.clinics WHERE workspace_id = p_workspace_id
    )
    AND user_id = p_target_user_id;
  ELSE
    -- Remover solo de clínica específica
    UPDATE public.clinic_users
    SET is_active = false, updated_at = NOW()
    WHERE clinic_id = p_clinic_id
    AND user_id = p_target_user_id;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener workspaces del usuario
CREATE OR REPLACE FUNCTION public.get_user_workspaces()
RETURNS TABLE (
  workspace_id UUID,
  workspace_name VARCHAR,
  workspace_slug VARCHAR,
  user_role VARCHAR,
  clinics JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.slug as workspace_slug,
    wu.role as user_role,
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'role', cu.role
        )
      ) FILTER (WHERE c.id IS NOT NULL),
      '[]'::jsonb
    ) as clinics
  FROM public.workspace_users wu
  JOIN public.workspaces w ON w.id = wu.workspace_id
  LEFT JOIN public.clinics c ON c.workspace_id = w.id AND c.is_active = true
  LEFT JOIN public.clinic_users cu ON cu.clinic_id = c.id AND cu.user_id = wu.user_id
  WHERE wu.user_id = auth.uid()
  AND wu.is_active = true
  GROUP BY w.id, w.name, w.slug, wu.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para transferir ownership
CREATE OR REPLACE FUNCTION public.transfer_workspace_ownership(
  p_workspace_id UUID,
  p_new_owner_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_owner_id UUID;
BEGIN
  v_current_owner_id := auth.uid();
  
  -- Verificar que el usuario actual es el owner
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_users
    WHERE workspace_id = p_workspace_id
    AND user_id = v_current_owner_id
    AND role = 'owner'
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Solo el owner actual puede transferir la propiedad';
  END IF;
  
  -- Verificar que el nuevo owner es miembro del workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_users
    WHERE workspace_id = p_workspace_id
    AND user_id = p_new_owner_id
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'El nuevo owner debe ser miembro activo del workspace';
  END IF;
  
  -- Cambiar el owner anterior a admin
  UPDATE public.workspace_users
  SET role = 'admin', updated_at = NOW()
  WHERE workspace_id = p_workspace_id
  AND user_id = v_current_owner_id;
  
  -- Asignar nuevo owner
  UPDATE public.workspace_users
  SET role = 'owner', updated_at = NOW()
  WHERE workspace_id = p_workspace_id
  AND user_id = p_new_owner_id;
  
  -- Actualizar el created_by del workspace (opcional)
  UPDATE public.workspaces
  SET created_by = p_new_owner_id, updated_at = NOW()
  WHERE id = p_workspace_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON FUNCTION public.create_workspace_with_owner IS 'Crea un nuevo workspace y asigna al usuario actual como owner';
COMMENT ON FUNCTION public.invite_user_to_workspace IS 'Invita a un usuario por email a unirse a un workspace o clínica';
COMMENT ON FUNCTION public.accept_invitation IS 'Acepta una invitación usando el token único';
COMMENT ON FUNCTION public.change_user_role IS 'Cambia el rol de un usuario en workspace o clínica';
COMMENT ON FUNCTION public.remove_user_from_workspace IS 'Remueve (soft delete) a un usuario del workspace o clínica';
COMMENT ON FUNCTION public.get_user_workspaces IS 'Obtiene todos los workspaces y clínicas del usuario actual';
COMMENT ON FUNCTION public.transfer_workspace_ownership IS 'Transfiere la propiedad del workspace a otro usuario';