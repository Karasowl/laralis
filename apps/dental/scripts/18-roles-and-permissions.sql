-- =====================================================
-- SISTEMA DE ROLES Y PERMISOS DETALLADO
-- Basado en la visión inicial del proyecto
-- =====================================================

-- Los 4 roles según initial_idea.md:
-- 1. VIEWER (Lector): Solo lectura de áreas asignadas
-- 2. EDITOR: Puede añadir tratamientos y pacientes, no configura el negocio
-- 3. ADMIN: Configura el negocio, ejecuta pagos, NO ve reportes financieros
-- 4. OWNER (Propietario): Control total, único por workspace, transferible

-- =====================================================
-- 1. TABLA DE PERMISOS GRANULARES
-- =====================================================

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    allowed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(role, resource, action)
);

-- =====================================================
-- 2. DEFINIR PERMISOS POR ROL
-- =====================================================

-- Limpiar permisos existentes
TRUNCATE role_permissions;

-- VIEWER (Lector) - Solo lectura
INSERT INTO role_permissions (role, resource, action, allowed) VALUES
('viewer', 'patients', 'read', true),
('viewer', 'treatments', 'read', true),
('viewer', 'services', 'read', true),
('viewer', 'supplies', 'read', true),
('viewer', 'tariffs', 'read', true),
('viewer', 'dashboard', 'read', true),
-- No puede ver configuración ni reportes financieros
('viewer', 'settings', 'read', false),
('viewer', 'financial_reports', 'read', false),
('viewer', 'fixed_costs', 'read', false),
('viewer', 'assets', 'read', false);

-- EDITOR - Lectura + Crear/Editar pacientes y tratamientos
INSERT INTO role_permissions (role, resource, action, allowed) VALUES
-- Todo lo que puede el viewer
('editor', 'patients', 'read', true),
('editor', 'treatments', 'read', true),
('editor', 'services', 'read', true),
('editor', 'supplies', 'read', true),
('editor', 'tariffs', 'read', true),
('editor', 'dashboard', 'read', true),
-- Además puede crear y editar
('editor', 'patients', 'create', true),
('editor', 'patients', 'update', true),
('editor', 'treatments', 'create', true),
('editor', 'treatments', 'update', true),
('editor', 'supplies', 'create', true),
('editor', 'supplies', 'update', true),
('editor', 'services', 'create', true),
('editor', 'services', 'update', true),
-- NO puede configurar el negocio
('editor', 'settings', 'read', false),
('editor', 'settings', 'update', false),
('editor', 'fixed_costs', 'read', false),
('editor', 'fixed_costs', 'update', false),
('editor', 'assets', 'read', false),
('editor', 'assets', 'update', false),
-- NO puede ver reportes financieros
('editor', 'financial_reports', 'read', false);

-- ADMIN - Configura el negocio pero NO ve finanzas
INSERT INTO role_permissions (role, resource, action, allowed) VALUES
-- Todo lo que puede el editor
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
('admin', 'tariffs', 'read', true),
('admin', 'tariffs', 'create', true),
('admin', 'tariffs', 'update', true),
('admin', 'tariffs', 'delete', true),
-- Puede configurar el negocio
('admin', 'settings', 'read', true),
('admin', 'settings', 'update', true),
('admin', 'fixed_costs', 'read', true),
('admin', 'fixed_costs', 'create', true),
('admin', 'fixed_costs', 'update', true),
('admin', 'fixed_costs', 'delete', true),
('admin', 'assets', 'read', true),
('admin', 'assets', 'create', true),
('admin', 'assets', 'update', true),
('admin', 'assets', 'delete', true),
-- Puede ejecutar pagos (a la aplicación)
('admin', 'payments', 'execute', true),
-- Puede invitar usuarios
('admin', 'users', 'invite', true),
('admin', 'users', 'update_role', true),
-- NO puede ver reportes financieros ni utilidades
('admin', 'financial_reports', 'read', false),
('admin', 'profit_reports', 'read', false),
('admin', 'dashboard', 'read', true),
('admin', 'dashboard_financial', 'read', false);

-- OWNER (Propietario) - Control total
INSERT INTO role_permissions (role, resource, action, allowed) VALUES
-- Control total sobre todo
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
('owner', 'tariffs', 'read', true),
('owner', 'tariffs', 'create', true),
('owner', 'tariffs', 'update', true),
('owner', 'tariffs', 'delete', true),
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
-- Ve todos los reportes financieros
('owner', 'financial_reports', 'read', true),
('owner', 'profit_reports', 'read', true),
('owner', 'dashboard', 'read', true),
('owner', 'dashboard_financial', 'read', true),
-- Gestión de usuarios y workspace
('owner', 'users', 'invite', true),
('owner', 'users', 'update_role', true),
('owner', 'users', 'remove', true),
('owner', 'workspace', 'update', true),
('owner', 'workspace', 'delete', true),
('owner', 'workspace', 'transfer_ownership', true),
-- Métodos de pago y facturación
('owner', 'billing', 'manage', true),
('owner', 'payment_methods', 'manage', true);

-- =====================================================
-- 3. FUNCIÓN PARA VERIFICAR PERMISOS
-- =====================================================

CREATE OR REPLACE FUNCTION auth.check_permission(
    p_resource TEXT,
    p_action TEXT,
    p_workspace_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- Si no se proporciona workspace_id, intentar obtenerlo del contexto
    IF p_workspace_id IS NULL THEN
        -- Obtener el primer workspace al que tiene acceso
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
    
    -- Obtener el rol del usuario
    v_role := auth.get_user_role(p_workspace_id);
    
    -- Si no tiene rol, no tiene permiso
    IF v_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar el permiso en la tabla
    RETURN EXISTS (
        SELECT 1 FROM role_permissions rp
        WHERE rp.role = v_role
        AND rp.resource = p_resource
        AND rp.action = p_action
        AND rp.allowed = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. TABLA DE INVITACIONES
-- =====================================================

CREATE TABLE IF NOT EXISTS workspace_invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    clinic_ids UUID[] DEFAULT '{}',
    token TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(workspace_id, email)
);

CREATE INDEX idx_invitations_token ON workspace_invitations(token);
CREATE INDEX idx_invitations_email ON workspace_invitations(email);

-- =====================================================
-- 5. FUNCIÓN PARA TRANSFERIR PROPIEDAD
-- =====================================================

CREATE OR REPLACE FUNCTION transfer_workspace_ownership(
    p_workspace_id UUID,
    p_new_owner_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_owner_id UUID;
BEGIN
    -- Verificar que el usuario actual es el propietario
    SELECT owner_id INTO v_old_owner_id
    FROM workspaces
    WHERE id = p_workspace_id;
    
    IF v_old_owner_id != auth.uid() THEN
        RAISE EXCEPTION 'Solo el propietario puede transferir la propiedad';
    END IF;
    
    -- Actualizar el propietario del workspace
    UPDATE workspaces
    SET owner_id = p_new_owner_id,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_workspace_id;
    
    -- Actualizar roles en workspace_members
    -- El nuevo propietario pasa a ser owner
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (p_workspace_id, p_new_owner_id, 'owner')
    ON CONFLICT (workspace_id, user_id) 
    DO UPDATE SET role = 'owner';
    
    -- El antiguo propietario pasa a ser admin
    UPDATE workspace_members
    SET role = 'admin'
    WHERE workspace_id = p_workspace_id
    AND user_id = v_old_owner_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. VISTAS PARA FACILITAR CONSULTAS
-- =====================================================

-- Vista de permisos del usuario actual
CREATE OR REPLACE VIEW my_permissions AS
SELECT DISTINCT
    w.id as workspace_id,
    w.name as workspace_name,
    auth.get_user_role(w.id) as role,
    rp.resource,
    rp.action,
    rp.allowed
FROM workspaces w
LEFT JOIN role_permissions rp ON rp.role = auth.get_user_role(w.id)
WHERE w.owner_id = auth.uid()
OR EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = w.id
    AND wm.user_id = auth.uid()
);

-- Vista de workspaces y clínicas accesibles
CREATE OR REPLACE VIEW my_workspaces_and_clinics AS
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.slug as workspace_slug,
    auth.get_user_role(w.id) as my_role,
    c.id as clinic_id,
    c.name as clinic_name,
    c.address as clinic_address,
    CASE 
        WHEN wm.clinic_ids = '{}' THEN true
        WHEN c.id = ANY(wm.clinic_ids) THEN true
        WHEN w.owner_id = auth.uid() THEN true
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
-- 7. TRIGGERS PARA AUDITORÍA
-- =====================================================

-- Tabla de auditoría para cambios de roles
CREATE TABLE IF NOT EXISTS role_audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    old_role TEXT,
    new_role TEXT,
    changed_by UUID NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Trigger para registrar cambios de rol
CREATE OR REPLACE FUNCTION log_role_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        INSERT INTO role_audit_log (
            workspace_id,
            user_id,
            old_role,
            new_role,
            changed_by
        ) VALUES (
            NEW.workspace_id,
            NEW.user_id,
            OLD.role,
            NEW.role,
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_role_changes
    AFTER UPDATE ON workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION log_role_changes();

-- =====================================================
-- FIN DEL SCRIPT DE ROLES Y PERMISOS
-- =====================================================