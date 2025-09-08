-- =====================================================
-- SCRIPT MAESTRO DE CONFIGURACIÓN COMPLETA
-- Laralis Dental Manager - Setup Completo de Base de Datos
-- =====================================================
-- 
-- INSTRUCCIONES:
-- 1. Ejecuta este script completo en Supabase SQL Editor
-- 2. El script configura todo: tablas, RLS, roles, permisos
-- 3. Si algo falla, el script te indicará qué revisar
--
-- =====================================================

-- =====================================================
-- SECCIÓN 1: PREPARACIÓN Y TABLAS BASE
-- =====================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- SECCIÓN 2: AGREGAR COLUMNAS DE SEGURIDAD
-- =====================================================

-- Agregar owner_id a workspaces si no existe
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Agregar clinic_ids a workspace_members si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workspace_members' 
        AND column_name = 'clinic_ids'
    ) THEN
        ALTER TABLE workspace_members 
        ADD COLUMN clinic_ids UUID[] DEFAULT '{}';
    END IF;
END $$;

-- =====================================================
-- SECCIÓN 3: CREAR TABLA DE MEMBRESÍAS
-- =====================================================

CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    clinic_ids UUID[] DEFAULT '{}', -- Clínicas específicas a las que tiene acceso
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    invited_by UUID REFERENCES auth.users(id),
    UNIQUE(workspace_id, user_id)
);

-- Si la tabla ya existía sin clinic_ids, agregarla
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workspace_members' 
        AND column_name = 'clinic_ids'
    ) THEN
        ALTER TABLE workspace_members 
        ADD COLUMN clinic_ids UUID[] DEFAULT '{}';
    END IF;
END $$;

-- =====================================================
-- SECCIÓN 4: CREAR ÍNDICES DE PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clinics_workspace_id ON clinics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_supplies_clinic_id ON supplies(clinic_id);
CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON services(clinic_id);
CREATE INDEX IF NOT EXISTS idx_settings_time_clinic_id ON settings_time(clinic_id);
CREATE INDEX IF NOT EXISTS idx_assets_clinic_id ON assets(clinic_id);
CREATE INDEX IF NOT EXISTS idx_fixed_costs_clinic_id ON fixed_costs(clinic_id);

-- =====================================================
-- SECCIÓN 5: FUNCIONES HELPER PARA RLS
-- =====================================================

-- Función para verificar si un usuario tiene acceso a un workspace
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = workspace_id 
        AND (
            w.owner_id = auth.uid() -- Es el propietario
            OR EXISTS ( -- O es miembro
                SELECT 1 FROM workspace_members wm
                WHERE wm.workspace_id = w.id
                AND wm.user_id = auth.uid()
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si un usuario tiene acceso a una clínica
CREATE OR REPLACE FUNCTION public.user_has_clinic_access(clinic_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_workspace_id UUID;
BEGIN
    -- Obtener el workspace_id de la clínica
    SELECT workspace_id INTO v_workspace_id
    FROM clinics
    WHERE id = clinic_id;
    
    -- Verificar acceso al workspace
    IF NOT public.user_has_workspace_access(v_workspace_id) THEN
        RETURN FALSE;
    END IF;
    
    -- El propietario siempre tiene acceso
    IF EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = v_workspace_id
        AND w.owner_id = auth.uid()
    ) THEN
        RETURN TRUE;
    END IF;
    
    -- Verificar si tiene acceso específico a esta clínica
    RETURN EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = v_workspace_id
        AND wm.user_id = auth.uid()
        AND (
            COALESCE(array_length(wm.clinic_ids, 1), 0) = 0 -- Sin restricción de clínicas
            OR clinic_id = ANY(wm.clinic_ids) -- Acceso específico
            OR wm.role IN ('owner', 'admin') -- Roles con acceso total
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener el rol del usuario en un workspace
CREATE OR REPLACE FUNCTION public.get_user_role(workspace_id UUID)
RETURNS TEXT AS $$
BEGIN
    -- Si es el propietario
    IF EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    ) THEN
        RETURN 'owner';
    END IF;
    
    -- Si es miembro, retornar su rol
    RETURN (
        SELECT role FROM workspace_members wm
        WHERE wm.workspace_id = workspace_id
        AND wm.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECCIÓN 6: HABILITAR RLS EN TODAS LAS TABLAS
-- =====================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS en tablas que podrían no existir aún
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'treatments') THEN
        ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- SECCIÓN 7: POLÍTICAS RLS PARA WORKSPACES
-- =====================================================

-- Limpiar políticas existentes
DROP POLICY IF EXISTS "Users can view their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Owners and admins can update workspaces" ON workspaces;
DROP POLICY IF EXISTS "Only owners can delete workspaces" ON workspaces;

-- Crear nuevas políticas
CREATE POLICY "Users can view their workspaces" ON workspaces
    FOR SELECT USING (
        owner_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = id
            AND wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create workspaces" ON workspaces
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners and admins can update workspaces" ON workspaces
    FOR UPDATE USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = id
            AND wm.user_id = auth.uid()
            AND wm.role = 'admin'
        )
    );

CREATE POLICY "Only owners can delete workspaces" ON workspaces
    FOR DELETE USING (owner_id = auth.uid());

-- =====================================================
-- SECCIÓN 8: POLÍTICAS RLS PARA WORKSPACE_MEMBERS
-- =====================================================

DROP POLICY IF EXISTS "Users can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Owners and admins can add members" ON workspace_members;
DROP POLICY IF EXISTS "Owners and admins can update members" ON workspace_members;
DROP POLICY IF EXISTS "Owners and admins can remove members" ON workspace_members;

CREATE POLICY "Users can view workspace members" ON workspace_members
    FOR SELECT USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "Owners and admins can add members" ON workspace_members
    FOR INSERT WITH CHECK (
        public.get_user_role(workspace_id) IN ('owner', 'admin')
    );

CREATE POLICY "Owners and admins can update members" ON workspace_members
    FOR UPDATE USING (
        public.get_user_role(workspace_id) IN ('owner', 'admin')
    );

CREATE POLICY "Owners and admins can remove members" ON workspace_members
    FOR DELETE USING (
        public.get_user_role(workspace_id) IN ('owner', 'admin')
        AND user_id != auth.uid()
    );

-- =====================================================
-- SECCIÓN 9: POLÍTICAS RLS PARA CLINICS
-- =====================================================

DROP POLICY IF EXISTS "Users can view clinics in their workspaces" ON clinics;
DROP POLICY IF EXISTS "Owners and admins can create clinics" ON clinics;
DROP POLICY IF EXISTS "Owners and admins can update clinics" ON clinics;
DROP POLICY IF EXISTS "Only owners can delete clinics" ON clinics;

CREATE POLICY "Users can view clinics in their workspaces" ON clinics
    FOR SELECT USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "Owners and admins can create clinics" ON clinics
    FOR INSERT WITH CHECK (
        public.get_user_role(workspace_id) IN ('owner', 'admin')
    );

CREATE POLICY "Owners and admins can update clinics" ON clinics
    FOR UPDATE USING (
        public.get_user_role(workspace_id) IN ('owner', 'admin')
    );

CREATE POLICY "Only owners can delete clinics" ON clinics
    FOR DELETE USING (
        public.get_user_role(workspace_id) = 'owner'
    );

-- =====================================================
-- SECCIÓN 10: POLÍTICAS RLS PARA PATIENTS
-- =====================================================

DROP POLICY IF EXISTS "Users can view patients in their clinics" ON patients;
DROP POLICY IF EXISTS "Users can create patients" ON patients;
DROP POLICY IF EXISTS "Users can update patients" ON patients;
DROP POLICY IF EXISTS "Owners and admins can delete patients" ON patients;

CREATE POLICY "Users can view patients in their clinics" ON patients
    FOR SELECT USING (public.user_has_clinic_access(clinic_id));

CREATE POLICY "Users can create patients" ON patients
    FOR INSERT WITH CHECK (
        public.user_has_clinic_access(clinic_id)
        AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
            IN ('owner', 'admin', 'editor')
    );

CREATE POLICY "Users can update patients" ON patients
    FOR UPDATE USING (
        public.user_has_clinic_access(clinic_id)
        AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
            IN ('owner', 'admin', 'editor')
    );

CREATE POLICY "Owners and admins can delete patients" ON patients
    FOR DELETE USING (
        public.user_has_clinic_access(clinic_id)
        AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
            IN ('owner', 'admin')
    );

-- =====================================================
-- SECCIÓN 11: POLÍTICAS RLS PARA CONFIGURACIÓN
-- =====================================================

-- SETTINGS_TIME
DROP POLICY IF EXISTS "Users can view time settings" ON settings_time;
DROP POLICY IF EXISTS "Admins can manage time settings" ON settings_time;

CREATE POLICY "Users can view time settings" ON settings_time
    FOR SELECT USING (public.user_has_clinic_access(clinic_id));

CREATE POLICY "Admins can manage time settings" ON settings_time
    FOR ALL USING (
        public.user_has_clinic_access(clinic_id)
        AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
            IN ('owner', 'admin')
    );

-- ASSETS
DROP POLICY IF EXISTS "Users can view assets" ON assets;
DROP POLICY IF EXISTS "Admins can manage assets" ON assets;

CREATE POLICY "Users can view assets" ON assets
    FOR SELECT USING (public.user_has_clinic_access(clinic_id));

CREATE POLICY "Admins can manage assets" ON assets
    FOR ALL USING (
        public.user_has_clinic_access(clinic_id)
        AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
            IN ('owner', 'admin')
    );

-- FIXED_COSTS
DROP POLICY IF EXISTS "Users can view fixed costs" ON fixed_costs;
DROP POLICY IF EXISTS "Admins can manage fixed costs" ON fixed_costs;

CREATE POLICY "Users can view fixed costs" ON fixed_costs
    FOR SELECT USING (public.user_has_clinic_access(clinic_id));

CREATE POLICY "Admins can manage fixed costs" ON fixed_costs
    FOR ALL USING (
        public.user_has_clinic_access(clinic_id)
        AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
            IN ('owner', 'admin')
    );

-- =====================================================
-- SECCIÓN 12: POLÍTICAS RLS PARA SUPPLIES Y SERVICES
-- =====================================================

-- SUPPLIES
DROP POLICY IF EXISTS "Users can view supplies" ON supplies;
DROP POLICY IF EXISTS "Users can manage supplies" ON supplies;

CREATE POLICY "Users can view supplies" ON supplies
    FOR SELECT USING (public.user_has_clinic_access(clinic_id));

CREATE POLICY "Users can manage supplies" ON supplies
    FOR ALL USING (
        public.user_has_clinic_access(clinic_id)
        AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
            IN ('owner', 'admin', 'editor')
    );

-- SERVICES
DROP POLICY IF EXISTS "Users can view services" ON services;
DROP POLICY IF EXISTS "Users can manage services" ON services;

CREATE POLICY "Users can view services" ON services
    FOR SELECT USING (public.user_has_clinic_access(clinic_id));

CREATE POLICY "Users can manage services" ON services
    FOR ALL USING (
        public.user_has_clinic_access(clinic_id)
        AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
            IN ('owner', 'admin', 'editor')
    );

-- SERVICE_SUPPLIES
DROP POLICY IF EXISTS "Users can view service supplies" ON service_supplies;
DROP POLICY IF EXISTS "Users can manage service supplies" ON service_supplies;

CREATE POLICY "Users can view service supplies" ON service_supplies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM services s
            WHERE s.id = service_id
            AND public.user_has_clinic_access(s.clinic_id)
        )
    );

CREATE POLICY "Users can manage service supplies" ON service_supplies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM services s
            WHERE s.id = service_id
            AND public.user_has_clinic_access(s.clinic_id)
            AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = s.clinic_id)) 
                IN ('owner', 'admin', 'editor')
        )
    );

-- TARIFFS
DROP POLICY IF EXISTS "Users can view tariffs" ON tariffs;
DROP POLICY IF EXISTS "Admins can manage tariffs" ON tariffs;

CREATE POLICY "Users can view tariffs" ON tariffs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM services s
            WHERE s.id = service_id
            AND public.user_has_clinic_access(s.clinic_id)
        )
    );

CREATE POLICY "Admins can manage tariffs" ON tariffs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM services s
            WHERE s.id = service_id
            AND public.user_has_clinic_access(s.clinic_id)
            AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = s.clinic_id)) 
                IN ('owner', 'admin')
        )
    );

-- =====================================================
-- SECCIÓN 13: TRIGGER PARA AUTO-CREAR MEMBRESÍA
-- =====================================================

CREATE OR REPLACE FUNCTION auto_create_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
    -- Cuando se crea un workspace, automáticamente crear membresía de owner
    INSERT INTO workspace_members (workspace_id, user_id, role, clinic_ids)
    VALUES (NEW.id, NEW.owner_id, 'owner', '{}')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_owner_membership_on_workspace_creation ON workspaces;
CREATE TRIGGER create_owner_membership_on_workspace_creation
    AFTER INSERT ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_owner_membership();

-- =====================================================
-- SECCIÓN 14: SISTEMA DE ROLES Y PERMISOS
-- =====================================================

DROP TABLE IF EXISTS role_permissions CASCADE;

CREATE TABLE role_permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    resource_name TEXT NOT NULL,
    action_name TEXT NOT NULL,
    allowed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(role, resource_name, action_name)
);

-- Insertar todos los permisos
INSERT INTO role_permissions (role, resource_name, action_name, allowed) VALUES
-- VIEWER
('viewer', 'patients', 'read', true),
('viewer', 'treatments', 'read', true),
('viewer', 'services', 'read', true),
('viewer', 'supplies', 'read', true),
('viewer', 'tariffs', 'read', true),
('viewer', 'dashboard', 'read', true),
('viewer', 'settings', 'read', false),
('viewer', 'financial_reports', 'read', false),
('viewer', 'fixed_costs', 'read', false),
('viewer', 'assets', 'read', false),
-- EDITOR (todo lo del viewer más...)
('editor', 'patients', 'read', true),
('editor', 'patients', 'create', true),
('editor', 'patients', 'update', true),
('editor', 'treatments', 'read', true),
('editor', 'treatments', 'create', true),
('editor', 'treatments', 'update', true),
('editor', 'services', 'read', true),
('editor', 'services', 'create', true),
('editor', 'services', 'update', true),
('editor', 'supplies', 'read', true),
('editor', 'supplies', 'create', true),
('editor', 'supplies', 'update', true),
('editor', 'tariffs', 'read', true),
('editor', 'dashboard', 'read', true),
('editor', 'settings', 'read', false),
('editor', 'financial_reports', 'read', false),
-- ADMIN (configura pero no ve finanzas)
('admin', 'patients', 'read', true),
('admin', 'patients', 'create', true),
('admin', 'patients', 'update', true),
('admin', 'patients', 'delete', true),
('admin', 'treatments', 'read', true),
('admin', 'treatments', 'create', true),
('admin', 'treatments', 'update', true),
('admin', 'treatments', 'delete', true),
('admin', 'services', 'read', true),
('admin', 'services', 'create', true),
('admin', 'services', 'update', true),
('admin', 'services', 'delete', true),
('admin', 'supplies', 'read', true),
('admin', 'supplies', 'create', true),
('admin', 'supplies', 'update', true),
('admin', 'supplies', 'delete', true),
('admin', 'settings', 'read', true),
('admin', 'settings', 'update', true),
('admin', 'fixed_costs', 'read', true),
('admin', 'fixed_costs', 'create', true),
('admin', 'fixed_costs', 'update', true),
('admin', 'assets', 'read', true),
('admin', 'assets', 'create', true),
('admin', 'assets', 'update', true),
('admin', 'users', 'invite', true),
('admin', 'financial_reports', 'read', false),
('admin', 'dashboard_financial', 'read', false),
-- OWNER (control total)
('owner', 'patients', 'read', true),
('owner', 'patients', 'create', true),
('owner', 'patients', 'update', true),
('owner', 'patients', 'delete', true),
('owner', 'treatments', 'read', true),
('owner', 'treatments', 'create', true),
('owner', 'treatments', 'update', true),
('owner', 'treatments', 'delete', true),
('owner', 'services', 'read', true),
('owner', 'services', 'create', true),
('owner', 'services', 'update', true),
('owner', 'services', 'delete', true),
('owner', 'supplies', 'read', true),
('owner', 'supplies', 'create', true),
('owner', 'supplies', 'update', true),
('owner', 'supplies', 'delete', true),
('owner', 'settings', 'read', true),
('owner', 'settings', 'update', true),
('owner', 'fixed_costs', 'read', true),
('owner', 'fixed_costs', 'create', true),
('owner', 'fixed_costs', 'update', true),
('owner', 'fixed_costs', 'delete', true),
('owner', 'assets', 'read', true),
('owner', 'assets', 'create', true),
('owner', 'assets', 'update', true),
('owner', 'assets', 'delete', true),
('owner', 'financial_reports', 'read', true),
('owner', 'profit_reports', 'read', true),
('owner', 'dashboard_financial', 'read', true),
('owner', 'users', 'invite', true),
('owner', 'users', 'remove', true),
('owner', 'workspace', 'transfer_ownership', true),
('owner', 'billing', 'manage', true);

-- =====================================================
-- SECCIÓN 15: FUNCIONES DE UTILIDAD
-- =====================================================

-- Función para verificar permisos
CREATE OR REPLACE FUNCTION public.check_permission(
    p_resource TEXT,
    p_action TEXT,
    p_workspace_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
BEGIN
    IF p_workspace_id IS NULL THEN
        SELECT w.id INTO p_workspace_id
        FROM workspaces w
        WHERE w.owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = w.id
            AND wm.user_id = auth.uid()
        )
        LIMIT 1;
    END IF;
    
    v_role := public.get_user_role(p_workspace_id);
    
    IF v_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM role_permissions rp
        WHERE rp.role = v_role
        AND rp.resource_name = p_resource
        AND rp.action_name = p_action
        AND rp.allowed = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECCIÓN 16: VISTAS ÚTILES
-- =====================================================

-- Vista de permisos del usuario actual
CREATE OR REPLACE VIEW my_permissions AS
SELECT DISTINCT
    w.id as workspace_id,
    w.name as workspace_name,
    public.get_user_role(w.id) as role,
    rp.resource_name,
    rp.action_name,
    rp.allowed
FROM workspaces w
LEFT JOIN role_permissions rp ON rp.role = public.get_user_role(w.id)
WHERE w.owner_id = auth.uid()
OR EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = w.id
    AND wm.user_id = auth.uid()
);

-- Vista de workspaces y clínicas accesibles (CORREGIDA)
CREATE OR REPLACE VIEW my_workspaces_and_clinics AS
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.slug as workspace_slug,
    public.get_user_role(w.id) as my_role,
    c.id as clinic_id,
    c.name as clinic_name,
    c.address as clinic_address,
    CASE 
        WHEN w.owner_id = auth.uid() THEN true
        WHEN wm.clinic_ids IS NULL THEN true
        WHEN COALESCE(array_length(wm.clinic_ids, 1), 0) = 0 THEN true
        WHEN c.id = ANY(wm.clinic_ids) THEN true
        ELSE false
    END as has_access
FROM workspaces w
LEFT JOIN clinics c ON c.workspace_id = w.id
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = auth.uid()
WHERE w.owner_id = auth.uid()
OR EXISTS (
    SELECT 1 FROM workspace_members wm2
    WHERE wm2.workspace_id = w.id
    AND wm2.user_id = auth.uid()
);

-- =====================================================
-- SECCIÓN 17: VERIFICACIÓN FINAL
-- =====================================================

-- Verificar que RLS está activo en las tablas principales
DO $$
DECLARE
    v_tables TEXT[] := ARRAY['workspaces', 'clinics', 'patients', 'supplies', 'services'];
    v_table TEXT;
    v_rls_enabled BOOLEAN;
BEGIN
    FOREACH v_table IN ARRAY v_tables
    LOOP
        SELECT rowsecurity INTO v_rls_enabled
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = v_table;
        
        IF v_rls_enabled THEN
            RAISE NOTICE 'RLS está ACTIVO en tabla %', v_table;
        ELSE
            RAISE WARNING 'RLS NO está activo en tabla %', v_table;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- FIN DEL SCRIPT MAESTRO
-- =====================================================

-- Mensajes de éxito
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ CONFIGURACIÓN COMPLETA EXITOSA';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'El sistema ahora tiene:';
    RAISE NOTICE '- Row Level Security (RLS) activo';
    RAISE NOTICE '- Sistema de roles configurado';
    RAISE NOTICE '- Permisos granulares establecidos';
    RAISE NOTICE '- Funciones helper creadas';
    RAISE NOTICE '- Vistas de utilidad disponibles';
    RAISE NOTICE '';
    RAISE NOTICE 'Prueba con:';
    RAISE NOTICE '  SELECT * FROM my_permissions;';
    RAISE NOTICE '  SELECT * FROM my_workspaces_and_clinics;';
    RAISE NOTICE '';
END $$;