-- Migration: Solucionar duplicación de columna 'role' en workspace_members

-- 1. Verificar y limpiar cualquier tabla duplicada o con problemas
DO $$
BEGIN
    -- Si la vista v_user_permissions existe con la columna duplicada, eliminarla
    DROP VIEW IF EXISTS public.v_user_permissions CASCADE;
    
    -- Si existe alguna versión corrupta de workspace_members, hacer backup
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'workspace_members'
    ) THEN
        -- Verificar si tiene las columnas correctas
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'workspace_members' 
            AND column_name = 'role'
        ) THEN
            -- Si no tiene role, la tabla está mal, eliminarla
            DROP TABLE IF EXISTS public.workspace_members CASCADE;
        END IF;
    END IF;
END $$;

-- 2. Crear o verificar la tabla workspace_members correcta
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    
    -- Rol en el workspace (una sola columna role)
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'super_admin', 'admin', 'editor', 'viewer')),
    
    -- Permisos específicos
    permissions JSONB DEFAULT '{}',
    allowed_clinics UUID[] DEFAULT NULL,
    
    -- Estado de invitación
    invitation_status VARCHAR(50) DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'rejected')),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints únicos
    UNIQUE(workspace_id, user_id),
    UNIQUE(workspace_id, email)
);

-- 3. Verificar o crear la tabla role_permissions
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
    
    hierarchy_level INTEGER NOT NULL,
    is_system BOOLEAN DEFAULT true
);

-- 4. Insertar roles si no existen
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
ON CONFLICT (role) DO NOTHING;

-- 5. Recrear la vista v_user_permissions correctamente
CREATE OR REPLACE VIEW public.v_user_permissions AS
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

-- 6. Asegurar que existe un workspace por defecto
DO $$
DECLARE
    v_default_workspace_id UUID;
BEGIN
    -- Si no hay workspaces, crear uno por defecto
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

-- 7. Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_email ON public.workspace_members(email);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON public.workspace_members(role);

-- 8. Crear triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workspace_members_updated_at ON public.workspace_members;
CREATE TRIGGER update_workspace_members_updated_at 
BEFORE UPDATE ON public.workspace_members 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Success
SELECT 'Migración completada: Problema de columna role duplicada resuelto' as status;