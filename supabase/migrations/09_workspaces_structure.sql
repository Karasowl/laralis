-- Migration: Estructura de Workspaces y sistema de roles (tipo Metricool)

-- 1. Crear tabla de Workspaces (como las "Marcas" en Metricool)
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL, -- URL-friendly identifier
    description TEXT,
    owner_id UUID, -- Por ahora es UUID, después será el usuario real
    logo_url TEXT,
    settings JSONB DEFAULT '{}', -- Configuraciones del workspace
    
    -- Límites del plan (para futuro)
    max_clinics INTEGER DEFAULT 3,
    max_users INTEGER DEFAULT 5,
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Onboarding progress
    onboarding_completed BOOLEAN DEFAULT false,
    onboarding_step INTEGER DEFAULT 0
);

-- 2. Actualizar tabla de clínicas para asociarlas con workspaces
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 3. Crear tabla de miembros del workspace (usuarios y sus roles)
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Por ahora UUID, después será auth.users
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    
    -- Rol en el workspace
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'super_admin', 'admin', 'editor', 'viewer')),
    
    -- Permisos específicos (override del rol si es necesario)
    permissions JSONB DEFAULT '{}',
    
    -- Clínicas a las que tiene acceso (NULL = todas)
    allowed_clinics UUID[] DEFAULT NULL,
    
    -- Estado de la invitación
    invitation_status VARCHAR(50) DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'rejected')),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Un usuario solo puede tener un rol por workspace
    UNIQUE(workspace_id, user_id),
    UNIQUE(workspace_id, email)
);

-- 4. Tabla de configuración de roles y permisos
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Permisos detallados
    can_view_patients BOOLEAN DEFAULT false,
    can_edit_patients BOOLEAN DEFAULT false,
    can_view_treatments BOOLEAN DEFAULT false,
    can_edit_treatments BOOLEAN DEFAULT false,
    can_view_finances BOOLEAN DEFAULT false,
    can_edit_finances BOOLEAN DEFAULT false,
    can_view_configuration BOOLEAN DEFAULT false,
    can_edit_configuration BOOLEAN DEFAULT false,
    can_manage_users BOOLEAN DEFAULT false,
    can_manage_clinics BOOLEAN DEFAULT false,
    can_transfer_ownership BOOLEAN DEFAULT false,
    can_view_reports BOOLEAN DEFAULT false,
    can_export_data BOOLEAN DEFAULT false,
    
    -- Nivel de jerarquía (menor número = mayor poder)
    hierarchy_level INTEGER NOT NULL,
    
    is_system BOOLEAN DEFAULT true -- Roles del sistema vs personalizados
);

-- 5. Insertar roles por defecto con sus permisos
INSERT INTO public.role_permissions (
    role, display_name, description, hierarchy_level,
    can_view_patients, can_edit_patients,
    can_view_treatments, can_edit_treatments,
    can_view_finances, can_edit_finances,
    can_view_configuration, can_edit_configuration,
    can_manage_users, can_manage_clinics,
    can_transfer_ownership, can_view_reports, can_export_data
) VALUES
    -- Propietario: TODO el poder
    ('owner', 'Propietario', 'Control total del workspace', 1,
     true, true, true, true, true, true, true, true, true, true, true, true, true),
    
    -- Super Admin: Todo excepto transferir propiedad
    ('super_admin', 'Super Administrador', 'Administración completa sin transferencia', 2,
     true, true, true, true, true, true, true, true, true, true, false, true, true),
    
    -- Admin: Gestión del negocio pero sin ver finanzas
    ('admin', 'Administrador', 'Configura el negocio pero no ve resultados financieros', 3,
     true, true, true, true, false, false, true, true, false, true, false, true, true),
    
    -- Editor: Opera el día a día
    ('editor', 'Editor', 'Añade pacientes y tratamientos', 4,
     true, true, true, true, false, false, false, false, false, false, false, false, true),
    
    -- Viewer: Solo lectura
    ('viewer', 'Lector', 'Solo puede ver información', 5,
     true, false, true, false, false, false, false, false, false, false, false, true, false)
ON CONFLICT (role) DO NOTHING;

-- 6. Tabla de actividad/logs del workspace
CREATE TABLE IF NOT EXISTS public.workspace_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
    user_id UUID,
    user_email VARCHAR(255),
    
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Vista para facilitar la gestión de permisos
CREATE OR REPLACE VIEW public.v_user_permissions AS
SELECT 
    wm.workspace_id,
    wm.user_id,
    wm.email,
    wm.role,
    rp.*,
    wm.allowed_clinics,
    wm.permissions as custom_permissions
FROM public.workspace_members wm
JOIN public.role_permissions rp ON wm.role = rp.role
WHERE wm.is_active = true
  AND wm.invitation_status = 'accepted';

-- 8. Función para verificar permisos
CREATE OR REPLACE FUNCTION check_user_permission(
    p_workspace_id UUID,
    p_user_id UUID,
    p_permission VARCHAR,
    p_clinic_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN;
    v_allowed_clinics UUID[];
BEGIN
    -- Verificar si el usuario tiene el permiso en el workspace
    SELECT 
        CASE p_permission
            WHEN 'view_patients' THEN can_view_patients
            WHEN 'edit_patients' THEN can_edit_patients
            WHEN 'view_treatments' THEN can_view_treatments
            WHEN 'edit_treatments' THEN can_edit_treatments
            WHEN 'view_finances' THEN can_view_finances
            WHEN 'edit_finances' THEN can_edit_finances
            WHEN 'view_configuration' THEN can_view_configuration
            WHEN 'edit_configuration' THEN can_edit_configuration
            WHEN 'manage_users' THEN can_manage_users
            WHEN 'manage_clinics' THEN can_manage_clinics
            WHEN 'transfer_ownership' THEN can_transfer_ownership
            WHEN 'view_reports' THEN can_view_reports
            WHEN 'export_data' THEN can_export_data
            ELSE false
        END,
        allowed_clinics
    INTO v_has_permission, v_allowed_clinics
    FROM v_user_permissions
    WHERE workspace_id = p_workspace_id
      AND user_id = p_user_id;
    
    -- Si no tiene el permiso base, denegar
    IF NOT v_has_permission THEN
        RETURN false;
    END IF;
    
    -- Si se especifica una clínica, verificar acceso
    IF p_clinic_id IS NOT NULL AND v_allowed_clinics IS NOT NULL THEN
        RETURN p_clinic_id = ANY(v_allowed_clinics);
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger para mantener updated_at
CREATE TRIGGER update_workspaces_updated_at 
BEFORE UPDATE ON public.workspaces 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_members_updated_at 
BEFORE UPDATE ON public.workspace_members 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 10. Índices para performance
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_clinics_workspace ON public.clinics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_workspace ON public.workspace_activity(workspace_id);

-- 11. Crear workspace por defecto para datos existentes
DO $$
DECLARE
    v_default_workspace_id UUID;
BEGIN
    -- Solo si no hay workspaces
    IF NOT EXISTS (SELECT 1 FROM public.workspaces LIMIT 1) THEN
        -- Crear workspace por defecto
        INSERT INTO public.workspaces (
            name, 
            slug, 
            description,
            onboarding_completed
        ) VALUES (
            'Mi Consultorio',
            'mi-consultorio-' || substr(gen_random_uuid()::text, 1, 8),
            'Workspace inicial',
            false
        ) RETURNING id INTO v_default_workspace_id;
        
        -- Asociar clínicas existentes a este workspace
        UPDATE public.clinics 
        SET workspace_id = v_default_workspace_id
        WHERE workspace_id IS NULL;
        
        -- Crear un miembro owner temporal
        INSERT INTO public.workspace_members (
            workspace_id,
            user_id,
            email,
            display_name,
            role,
            invitation_status
        ) VALUES (
            v_default_workspace_id,
            gen_random_uuid(), -- Usuario temporal
            'owner@example.com',
            'Propietario',
            'owner',
            'accepted'
        );
    END IF;
END $$;

-- Success
SELECT 'Migración completada: Estructura de Workspaces implementada' as status;