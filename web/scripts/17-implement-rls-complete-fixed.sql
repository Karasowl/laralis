-- =====================================================
-- IMPLEMENTACIÓN COMPLETA DE ROW LEVEL SECURITY (RLS)
-- VERSIÓN CORREGIDA - Sin usar schema auth directamente
-- =====================================================

-- IMPORTANTE: Ejecutar este script en Supabase SQL Editor
-- Asegúrate de tener la columna owner_id en workspaces primero

-- =====================================================
-- 1. PREPARACIÓN: Agregar columnas de seguridad
-- =====================================================

-- Agregar owner_id a workspaces si no existe
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Agregar índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_clinics_workspace_id ON clinics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatments_patient_id ON treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_clinic_id ON treatments(clinic_id);

-- =====================================================
-- 2. CREAR TABLA DE MEMBRESÍAS (para roles futuros)
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

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);

-- =====================================================
-- 3. FUNCIONES HELPER PARA RLS (Sin usar schema auth)
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
    
    -- Verificar si tiene acceso específico a esta clínica (para roles futuros)
    RETURN EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = v_workspace_id
        AND wm.user_id = auth.uid()
        AND (
            wm.clinic_ids = '{}' -- Acceso a todas las clínicas
            OR clinic_id = ANY(wm.clinic_ids) -- Acceso específico
            OR wm.role IN ('owner', 'admin') -- Roles con acceso total
        )
    ) OR EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = v_workspace_id
        AND w.owner_id = auth.uid() -- El propietario siempre tiene acceso
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
-- 4. HABILITAR RLS EN TODAS LAS TABLAS
-- =====================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. POLÍTICAS PARA WORKSPACES
-- =====================================================

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Users can view their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Owners and admins can update workspaces" ON workspaces;
DROP POLICY IF EXISTS "Only owners can delete workspaces" ON workspaces;

-- Ver workspaces: propietario o miembro
CREATE POLICY "Users can view their workspaces" ON workspaces
    FOR SELECT USING (
        owner_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = id
            AND wm.user_id = auth.uid()
        )
    );

-- Crear workspaces: cualquier usuario autenticado
CREATE POLICY "Users can create workspaces" ON workspaces
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Actualizar workspaces: solo propietario o admin
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

-- Eliminar workspaces: solo propietario
CREATE POLICY "Only owners can delete workspaces" ON workspaces
    FOR DELETE USING (owner_id = auth.uid());

-- =====================================================
-- 6. POLÍTICAS PARA WORKSPACE_MEMBERS
-- =====================================================

DROP POLICY IF EXISTS "Users can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Owners and admins can add members" ON workspace_members;
DROP POLICY IF EXISTS "Owners and admins can update members" ON workspace_members;
DROP POLICY IF EXISTS "Owners and admins can remove members" ON workspace_members;

-- Ver miembros: si tienes acceso al workspace
CREATE POLICY "Users can view workspace members" ON workspace_members
    FOR SELECT USING (public.user_has_workspace_access(workspace_id));

-- Agregar miembros: solo owner y admin
CREATE POLICY "Owners and admins can add members" ON workspace_members
    FOR INSERT WITH CHECK (
        public.get_user_role(workspace_id) IN ('owner', 'admin')
    );

-- Actualizar miembros: solo owner y admin
CREATE POLICY "Owners and admins can update members" ON workspace_members
    FOR UPDATE USING (
        public.get_user_role(workspace_id) IN ('owner', 'admin')
    );

-- Eliminar miembros: solo owner y admin (no pueden eliminarse a sí mismos)
CREATE POLICY "Owners and admins can remove members" ON workspace_members
    FOR DELETE USING (
        public.get_user_role(workspace_id) IN ('owner', 'admin')
        AND user_id != auth.uid()
    );

-- =====================================================
-- 7. POLÍTICAS PARA CLINICS
-- =====================================================

DROP POLICY IF EXISTS "Users can view clinics in their workspaces" ON clinics;
DROP POLICY IF EXISTS "Owners and admins can create clinics" ON clinics;
DROP POLICY IF EXISTS "Owners and admins can update clinics" ON clinics;
DROP POLICY IF EXISTS "Only owners can delete clinics" ON clinics;

-- Ver clínicas: si tienes acceso al workspace
CREATE POLICY "Users can view clinics in their workspaces" ON clinics
    FOR SELECT USING (public.user_has_workspace_access(workspace_id));

-- Crear clínicas: owner y admin
CREATE POLICY "Owners and admins can create clinics" ON clinics
    FOR INSERT WITH CHECK (
        public.get_user_role(workspace_id) IN ('owner', 'admin')
    );

-- Actualizar clínicas: owner y admin
CREATE POLICY "Owners and admins can update clinics" ON clinics
    FOR UPDATE USING (
        public.get_user_role(workspace_id) IN ('owner', 'admin')
    );

-- Eliminar clínicas: solo owner
CREATE POLICY "Only owners can delete clinics" ON clinics
    FOR DELETE USING (
        public.get_user_role(workspace_id) = 'owner'
    );

-- =====================================================
-- 8. POLÍTICAS PARA PATIENTS
-- =====================================================

DROP POLICY IF EXISTS "Users can view patients in their clinics" ON patients;
DROP POLICY IF EXISTS "Users can create patients" ON patients;
DROP POLICY IF EXISTS "Users can update patients" ON patients;
DROP POLICY IF EXISTS "Owners and admins can delete patients" ON patients;

-- Ver pacientes: si tienes acceso a la clínica
CREATE POLICY "Users can view patients in their clinics" ON patients
    FOR SELECT USING (public.user_has_clinic_access(clinic_id));

-- Crear pacientes: owner, admin y editor
CREATE POLICY "Users can create patients" ON patients
    FOR INSERT WITH CHECK (
        public.user_has_clinic_access(clinic_id)
        AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
            IN ('owner', 'admin', 'editor')
    );

-- Actualizar pacientes: owner, admin y editor
CREATE POLICY "Users can update patients" ON patients
    FOR UPDATE USING (
        public.user_has_clinic_access(clinic_id)
        AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
            IN ('owner', 'admin', 'editor')
    );

-- Eliminar pacientes: owner y admin
CREATE POLICY "Owners and admins can delete patients" ON patients
    FOR DELETE USING (
        public.user_has_clinic_access(clinic_id)
        AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
            IN ('owner', 'admin')
    );

-- =====================================================
-- 9. POLÍTICAS PARA TREATMENTS (si la tabla existe)
-- =====================================================

-- Verificar si la tabla treatments existe antes de crear políticas
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'treatments') THEN
        -- Eliminar políticas existentes
        DROP POLICY IF EXISTS "Users can view treatments in their clinics" ON treatments;
        DROP POLICY IF EXISTS "Users can create treatments" ON treatments;
        DROP POLICY IF EXISTS "Users can update treatments" ON treatments;
        DROP POLICY IF EXISTS "Owners and admins can delete treatments" ON treatments;
        
        -- Ver tratamientos: si tienes acceso a la clínica
        EXECUTE 'CREATE POLICY "Users can view treatments in their clinics" ON treatments
            FOR SELECT USING (public.user_has_clinic_access(clinic_id))';

        -- Crear tratamientos: owner, admin y editor
        EXECUTE 'CREATE POLICY "Users can create treatments" ON treatments
            FOR INSERT WITH CHECK (
                public.user_has_clinic_access(clinic_id)
                AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
                    IN (''owner'', ''admin'', ''editor'')
            )';

        -- Actualizar tratamientos: owner, admin y editor
        EXECUTE 'CREATE POLICY "Users can update treatments" ON treatments
            FOR UPDATE USING (
                public.user_has_clinic_access(clinic_id)
                AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
                    IN (''owner'', ''admin'', ''editor'')
            )';

        -- Eliminar tratamientos: owner y admin
        EXECUTE 'CREATE POLICY "Owners and admins can delete treatments" ON treatments
            FOR DELETE USING (
                public.user_has_clinic_access(clinic_id)
                AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
                    IN (''owner'', ''admin'')
            )';
    END IF;
END $$;

-- =====================================================
-- 10. POLÍTICAS PARA CONFIGURACIÓN (settings_time, assets, fixed_costs)
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
-- 11. POLÍTICAS PARA SUPPLIES Y SERVICES
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

-- =====================================================
-- 12. POLÍTICAS PARA TARIFFS Y EXPENSES (si existen)
-- =====================================================

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

-- EXPENSES (si la tabla existe)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        DROP POLICY IF EXISTS "Users can view expenses" ON expenses;
        DROP POLICY IF EXISTS "Users can manage expenses" ON expenses;
        
        EXECUTE 'CREATE POLICY "Users can view expenses" ON expenses
            FOR SELECT USING (public.user_has_clinic_access(clinic_id))';

        EXECUTE 'CREATE POLICY "Users can manage expenses" ON expenses
            FOR ALL USING (
                public.user_has_clinic_access(clinic_id)
                AND public.get_user_role((SELECT workspace_id FROM clinics WHERE id = clinic_id)) 
                    IN (''owner'', ''admin'', ''editor'')
            )';
    END IF;
END $$;

-- =====================================================
-- 13. TRIGGER PARA AUTO-CREAR MEMBRESÍA DE OWNER
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
-- FIN DEL SCRIPT
-- =====================================================

-- Para verificar que RLS está funcionando:
-- SELECT * FROM workspaces; -- Solo deberías ver tus workspaces
-- SELECT * FROM clinics; -- Solo deberías ver clínicas de tus workspaces