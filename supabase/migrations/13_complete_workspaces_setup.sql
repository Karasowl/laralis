-- Migration: Setup completo del sistema de Workspaces
-- Esta migración crea todas las tablas necesarias en el orden correcto

-- 1. Primero crear la tabla workspaces si no existe
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    owner_id UUID,
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    max_clinics INTEGER DEFAULT 3,
    max_users INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    onboarding_completed BOOLEAN DEFAULT false,
    onboarding_step INTEGER DEFAULT 0
);

-- 2. Agregar columna workspace_id a clinics si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'clinics' 
        AND column_name = 'workspace_id'
    ) THEN
        ALTER TABLE public.clinics 
        ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Limpiar tablas con problemas
DROP VIEW IF EXISTS public.v_user_permissions CASCADE;
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.workspace_activity CASCADE;

-- 4. Crear tabla role_permissions si no existe
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
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
    hierarchy_level INTEGER NOT NULL,
    is_system BOOLEAN DEFAULT true
);

-- 5. Insertar o actualizar roles por defecto
INSERT INTO public.role_permissions (
    role, display_name, description, hierarchy_level,
    can_view_patients, can_edit_patients,
    can_view_treatments, can_edit_treatments,
    can_view_finances, can_edit_finances,
    can_view_configuration, can_edit_configuration,
    can_manage_users, can_manage_clinics,
    can_transfer_ownership, can_view_reports, can_export_data
) VALUES
    ('owner', 'Propietario', 'Control total del workspace', 1,
     true, true, true, true, true, true, true, true, true, true, true, true, true),
    ('super_admin', 'Super Administrador', 'Administración completa sin transferencia', 2,
     true, true, true, true, true, true, true, true, true, true, false, true, true),
    ('admin', 'Administrador', 'Configura el negocio pero no ve resultados financieros', 3,
     true, true, true, true, false, false, true, true, false, true, false, true, true),
    ('editor', 'Editor', 'Añade pacientes y tratamientos', 4,
     true, true, true, true, false, false, false, false, false, false, false, false, true),
    ('viewer', 'Lector', 'Solo puede ver información', 5,
     true, false, true, false, false, false, false, false, false, false, false, true, false)
ON CONFLICT (role) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    hierarchy_level = EXCLUDED.hierarchy_level;

-- 6. Crear tabla workspace_members
CREATE TABLE public.workspace_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'super_admin', 'admin', 'editor', 'viewer')),
    permissions JSONB DEFAULT '{}',
    allowed_clinics UUID[] DEFAULT NULL,
    invitation_status VARCHAR(50) DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'rejected')),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id),
    UNIQUE(workspace_id, email)
);

-- 7. Crear tabla workspace_activity
CREATE TABLE public.workspace_activity (
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

-- 8. Crear vista v_user_permissions
CREATE VIEW public.v_user_permissions AS
SELECT 
    wm.workspace_id,
    wm.user_id,
    wm.email,
    wm.role,
    rp.display_name as role_display_name,
    rp.description as role_description,
    rp.hierarchy_level,
    rp.can_view_patients,
    rp.can_edit_patients,
    rp.can_view_treatments,
    rp.can_edit_treatments,
    rp.can_view_finances,
    rp.can_edit_finances,
    rp.can_view_configuration,
    rp.can_edit_configuration,
    rp.can_manage_users,
    rp.can_manage_clinics,
    rp.can_transfer_ownership,
    rp.can_view_reports,
    rp.can_export_data,
    wm.allowed_clinics,
    wm.permissions as custom_permissions
FROM public.workspace_members wm
JOIN public.role_permissions rp ON wm.role = rp.role
WHERE wm.is_active = true
  AND wm.invitation_status = 'accepted';

-- 9. Crear función para verificar permisos
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
    
    IF NOT v_has_permission THEN
        RETURN false;
    END IF;
    
    IF p_clinic_id IS NOT NULL AND v_allowed_clinics IS NOT NULL THEN
        RETURN p_clinic_id = ANY(v_allowed_clinics);
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 10. Crear triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at 
BEFORE UPDATE ON public.workspaces 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workspace_members_updated_at ON public.workspace_members;
CREATE TRIGGER update_workspace_members_updated_at 
BEFORE UPDATE ON public.workspace_members 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 11. Crear índices
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_clinics_workspace ON public.clinics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_email ON public.workspace_members(email);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON public.workspace_members(role);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_workspace ON public.workspace_activity(workspace_id);

-- 12. Crear workspace por defecto si no existe
DO $$
DECLARE
    v_default_workspace_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.workspaces LIMIT 1) THEN
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
        
        -- Asociar clínicas existentes
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
            invitation_status,
            accepted_at
        ) VALUES (
            v_default_workspace_id,
            gen_random_uuid(),
            'owner@example.com',
            'Propietario',
            'owner',
            'accepted',
            NOW()
        );
    END IF;
END $$;

-- Success message
SELECT 'Migración completada: Sistema de Workspaces configurado correctamente' as status;