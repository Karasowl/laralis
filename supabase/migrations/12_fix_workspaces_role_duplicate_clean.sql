-- Migration: Solucionar duplicación de columna 'role' en workspace_members
-- Ejecutar este script en el SQL Editor de Supabase Dashboard

-- 1. Limpiar estructuras existentes con problemas
DROP VIEW IF EXISTS public.v_user_permissions CASCADE;
DROP TABLE IF EXISTS public.workspace_members CASCADE;

-- 2. Crear la tabla workspace_members correcta
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

-- 3. Crear la vista v_user_permissions
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

-- 4. Agregar workspace por defecto si no existe
INSERT INTO public.workspaces (
    name, 
    slug, 
    description,
    onboarding_completed
) 
SELECT 
    'Mi Consultorio',
    'mi-consultorio-' || substr(gen_random_uuid()::text, 1, 8),
    'Workspace inicial',
    false
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces LIMIT 1);

-- 5. Agregar miembro owner al workspace por defecto
INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    email,
    display_name,
    role,
    invitation_status,
    accepted_at
)
SELECT 
    id,
    gen_random_uuid(),
    'owner@example.com',
    'Propietario',
    'owner',
    'accepted',
    NOW()
FROM public.workspaces
WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members LIMIT 1)
LIMIT 1;

-- 6. Asociar clínicas existentes al workspace por defecto
UPDATE public.clinics 
SET workspace_id = (SELECT id FROM public.workspaces LIMIT 1)
WHERE workspace_id IS NULL;

-- 7. Crear índices
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_email ON public.workspace_members(email);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON public.workspace_members(role);

-- 8. Crear trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspace_members_updated_at 
BEFORE UPDATE ON public.workspace_members 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();