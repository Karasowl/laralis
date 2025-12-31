-- ============================================
-- 71. SEED DE PERMISOS BASE POR ROL
-- ============================================
-- Inserta los permisos predefinidos para cada rol
-- Date: 2025-12-30

-- Limpiar permisos existentes (si los hay)
TRUNCATE role_permissions;

-- =============================================================================
-- WORKSPACE ROLES: owner, super_admin, admin, editor, viewer
-- =============================================================================

-- Nota: owner y super_admin se manejan en la función check_user_permission
-- con lógica especial (owner = todo, super_admin = casi todo)

-- -----------------------------------------------------------------------------
-- ADMIN (workspace scope)
-- Gestiona operaciones clínicas, NO ve finanzas ni break-even
-- -----------------------------------------------------------------------------

-- Pacientes: acceso completo
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'patients', 'view', true),
('admin', 'workspace', 'patients', 'create', true),
('admin', 'workspace', 'patients', 'edit', true),
('admin', 'workspace', 'patients', 'delete', true);

-- Tratamientos: acceso completo
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'treatments', 'view', true),
('admin', 'workspace', 'treatments', 'create', true),
('admin', 'workspace', 'treatments', 'edit', true),
('admin', 'workspace', 'treatments', 'delete', true),
('admin', 'workspace', 'treatments', 'mark_paid', true);

-- Recetas: acceso completo
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'prescriptions', 'view', true),
('admin', 'workspace', 'prescriptions', 'create', true),
('admin', 'workspace', 'prescriptions', 'edit', true),
('admin', 'workspace', 'prescriptions', 'delete', true),
('admin', 'workspace', 'prescriptions', 'print', true);

-- Presupuestos: acceso completo
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'quotes', 'view', true),
('admin', 'workspace', 'quotes', 'create', true),
('admin', 'workspace', 'quotes', 'edit', true),
('admin', 'workspace', 'quotes', 'delete', true),
('admin', 'workspace', 'quotes', 'send', true);

-- Servicios: NO puede cambiar precios
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'services', 'view', true),
('admin', 'workspace', 'services', 'create', true),
('admin', 'workspace', 'services', 'edit', true),
('admin', 'workspace', 'services', 'delete', true),
('admin', 'workspace', 'services', 'set_prices', false);

-- Insumos: acceso completo
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'supplies', 'view', true),
('admin', 'workspace', 'supplies', 'create', true),
('admin', 'workspace', 'supplies', 'edit', true),
('admin', 'workspace', 'supplies', 'delete', true),
('admin', 'workspace', 'supplies', 'manage_stock', true);

-- Gastos: NO tiene acceso (información financiera sensible)
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'expenses', 'view', false),
('admin', 'workspace', 'expenses', 'create', false),
('admin', 'workspace', 'expenses', 'edit', false),
('admin', 'workspace', 'expenses', 'delete', false);

-- Costos fijos: NO tiene acceso
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'fixed_costs', 'view', false),
('admin', 'workspace', 'fixed_costs', 'create', false),
('admin', 'workspace', 'fixed_costs', 'edit', false),
('admin', 'workspace', 'fixed_costs', 'delete', false);

-- Activos: NO tiene acceso
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'assets', 'view', false),
('admin', 'workspace', 'assets', 'create', false),
('admin', 'workspace', 'assets', 'edit', false),
('admin', 'workspace', 'assets', 'delete', false);

-- Reportes financieros: NO tiene acceso
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'financial_reports', 'view', false),
('admin', 'workspace', 'financial_reports', 'export', false);

-- Break-even: NO tiene acceso
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'break_even', 'view', false);

-- Campañas: acceso completo
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'campaigns', 'view', true),
('admin', 'workspace', 'campaigns', 'create', true),
('admin', 'workspace', 'campaigns', 'edit', true),
('admin', 'workspace', 'campaigns', 'delete', true);

-- Configuración: puede ver y editar
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'settings', 'view', true),
('admin', 'workspace', 'settings', 'edit', true);

-- Equipo: puede ver e invitar, NO puede cambiar roles
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'team', 'view', true),
('admin', 'workspace', 'team', 'invite', true),
('admin', 'workspace', 'team', 'edit_roles', false),
('admin', 'workspace', 'team', 'remove', false);

-- Lara AI: puede usar entry mode
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'lara', 'use_entry_mode', true),
('admin', 'workspace', 'lara', 'use_query_mode', false),
('admin', 'workspace', 'lara', 'execute_actions', false);

-- Export/Import: solo export
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'export_import', 'export', true),
('admin', 'workspace', 'export_import', 'import', false);

-- -----------------------------------------------------------------------------
-- EDITOR (workspace scope)
-- Crea y edita pacientes/tratamientos, NO borra ni gestiona equipo
-- -----------------------------------------------------------------------------

-- Pacientes: crear y editar, NO borrar
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('editor', 'workspace', 'patients', 'view', true),
('editor', 'workspace', 'patients', 'create', true),
('editor', 'workspace', 'patients', 'edit', true),
('editor', 'workspace', 'patients', 'delete', false);

-- Tratamientos: crear y editar, NO borrar ni marcar pagado
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('editor', 'workspace', 'treatments', 'view', true),
('editor', 'workspace', 'treatments', 'create', true),
('editor', 'workspace', 'treatments', 'edit', true),
('editor', 'workspace', 'treatments', 'delete', false),
('editor', 'workspace', 'treatments', 'mark_paid', false);

-- Recetas: acceso completo
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('editor', 'workspace', 'prescriptions', 'view', true),
('editor', 'workspace', 'prescriptions', 'create', true),
('editor', 'workspace', 'prescriptions', 'edit', true),
('editor', 'workspace', 'prescriptions', 'delete', false),
('editor', 'workspace', 'prescriptions', 'print', true);

-- Presupuestos: solo ver y crear
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('editor', 'workspace', 'quotes', 'view', true),
('editor', 'workspace', 'quotes', 'create', true),
('editor', 'workspace', 'quotes', 'edit', false),
('editor', 'workspace', 'quotes', 'delete', false),
('editor', 'workspace', 'quotes', 'send', false);

-- Servicios: solo ver
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('editor', 'workspace', 'services', 'view', true),
('editor', 'workspace', 'services', 'create', false),
('editor', 'workspace', 'services', 'edit', false),
('editor', 'workspace', 'services', 'delete', false),
('editor', 'workspace', 'services', 'set_prices', false);

-- Insumos: solo ver
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('editor', 'workspace', 'supplies', 'view', true),
('editor', 'workspace', 'supplies', 'create', false),
('editor', 'workspace', 'supplies', 'edit', false),
('editor', 'workspace', 'supplies', 'delete', false),
('editor', 'workspace', 'supplies', 'manage_stock', false);

-- Sin acceso a finanzas
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('editor', 'workspace', 'expenses', 'view', false),
('editor', 'workspace', 'expenses', 'create', false),
('editor', 'workspace', 'expenses', 'edit', false),
('editor', 'workspace', 'expenses', 'delete', false),
('editor', 'workspace', 'fixed_costs', 'view', false),
('editor', 'workspace', 'fixed_costs', 'create', false),
('editor', 'workspace', 'fixed_costs', 'edit', false),
('editor', 'workspace', 'fixed_costs', 'delete', false),
('editor', 'workspace', 'assets', 'view', false),
('editor', 'workspace', 'assets', 'create', false),
('editor', 'workspace', 'assets', 'edit', false),
('editor', 'workspace', 'assets', 'delete', false),
('editor', 'workspace', 'financial_reports', 'view', false),
('editor', 'workspace', 'financial_reports', 'export', false),
('editor', 'workspace', 'break_even', 'view', false);

-- Campañas: solo ver
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('editor', 'workspace', 'campaigns', 'view', true),
('editor', 'workspace', 'campaigns', 'create', false),
('editor', 'workspace', 'campaigns', 'edit', false),
('editor', 'workspace', 'campaigns', 'delete', false);

-- Sin acceso a configuración ni equipo
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('editor', 'workspace', 'settings', 'view', false),
('editor', 'workspace', 'settings', 'edit', false),
('editor', 'workspace', 'team', 'view', false),
('editor', 'workspace', 'team', 'invite', false),
('editor', 'workspace', 'team', 'edit_roles', false),
('editor', 'workspace', 'team', 'remove', false);

-- Lara: solo entry mode
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('editor', 'workspace', 'lara', 'use_entry_mode', true),
('editor', 'workspace', 'lara', 'use_query_mode', false),
('editor', 'workspace', 'lara', 'execute_actions', false);

-- Sin export/import
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('editor', 'workspace', 'export_import', 'export', false),
('editor', 'workspace', 'export_import', 'import', false);

-- -----------------------------------------------------------------------------
-- VIEWER (workspace scope)
-- Solo lectura de datos clínicos
-- -----------------------------------------------------------------------------

-- Pacientes: solo ver
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('viewer', 'workspace', 'patients', 'view', true),
('viewer', 'workspace', 'patients', 'create', false),
('viewer', 'workspace', 'patients', 'edit', false),
('viewer', 'workspace', 'patients', 'delete', false);

-- Tratamientos: solo ver
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('viewer', 'workspace', 'treatments', 'view', true),
('viewer', 'workspace', 'treatments', 'create', false),
('viewer', 'workspace', 'treatments', 'edit', false),
('viewer', 'workspace', 'treatments', 'delete', false),
('viewer', 'workspace', 'treatments', 'mark_paid', false);

-- Recetas: solo ver
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('viewer', 'workspace', 'prescriptions', 'view', true),
('viewer', 'workspace', 'prescriptions', 'create', false),
('viewer', 'workspace', 'prescriptions', 'edit', false),
('viewer', 'workspace', 'prescriptions', 'delete', false),
('viewer', 'workspace', 'prescriptions', 'print', false);

-- Presupuestos: solo ver
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('viewer', 'workspace', 'quotes', 'view', true),
('viewer', 'workspace', 'quotes', 'create', false),
('viewer', 'workspace', 'quotes', 'edit', false),
('viewer', 'workspace', 'quotes', 'delete', false),
('viewer', 'workspace', 'quotes', 'send', false);

-- Servicios: solo ver
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('viewer', 'workspace', 'services', 'view', true),
('viewer', 'workspace', 'services', 'create', false),
('viewer', 'workspace', 'services', 'edit', false),
('viewer', 'workspace', 'services', 'delete', false),
('viewer', 'workspace', 'services', 'set_prices', false);

-- Insumos: solo ver
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('viewer', 'workspace', 'supplies', 'view', true),
('viewer', 'workspace', 'supplies', 'create', false),
('viewer', 'workspace', 'supplies', 'edit', false),
('viewer', 'workspace', 'supplies', 'delete', false),
('viewer', 'workspace', 'supplies', 'manage_stock', false);

-- Sin acceso a nada más
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('viewer', 'workspace', 'expenses', 'view', false),
('viewer', 'workspace', 'expenses', 'create', false),
('viewer', 'workspace', 'expenses', 'edit', false),
('viewer', 'workspace', 'expenses', 'delete', false),
('viewer', 'workspace', 'fixed_costs', 'view', false),
('viewer', 'workspace', 'fixed_costs', 'create', false),
('viewer', 'workspace', 'fixed_costs', 'edit', false),
('viewer', 'workspace', 'fixed_costs', 'delete', false),
('viewer', 'workspace', 'assets', 'view', false),
('viewer', 'workspace', 'assets', 'create', false),
('viewer', 'workspace', 'assets', 'edit', false),
('viewer', 'workspace', 'assets', 'delete', false),
('viewer', 'workspace', 'financial_reports', 'view', false),
('viewer', 'workspace', 'financial_reports', 'export', false),
('viewer', 'workspace', 'break_even', 'view', false),
('viewer', 'workspace', 'campaigns', 'view', false),
('viewer', 'workspace', 'campaigns', 'create', false),
('viewer', 'workspace', 'campaigns', 'edit', false),
('viewer', 'workspace', 'campaigns', 'delete', false),
('viewer', 'workspace', 'settings', 'view', false),
('viewer', 'workspace', 'settings', 'edit', false),
('viewer', 'workspace', 'team', 'view', false),
('viewer', 'workspace', 'team', 'invite', false),
('viewer', 'workspace', 'team', 'edit_roles', false),
('viewer', 'workspace', 'team', 'remove', false),
('viewer', 'workspace', 'lara', 'use_entry_mode', false),
('viewer', 'workspace', 'lara', 'use_query_mode', false),
('viewer', 'workspace', 'lara', 'execute_actions', false),
('viewer', 'workspace', 'export_import', 'export', false),
('viewer', 'workspace', 'export_import', 'import', false);

-- =============================================================================
-- CLINIC ROLES: admin, doctor, assistant, receptionist, viewer
-- =============================================================================

-- -----------------------------------------------------------------------------
-- DOCTOR (clinic scope)
-- Profesional que atiende pacientes
-- -----------------------------------------------------------------------------

-- Pacientes: acceso completo
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('doctor', 'clinic', 'patients', 'view', true),
('doctor', 'clinic', 'patients', 'create', true),
('doctor', 'clinic', 'patients', 'edit', true),
('doctor', 'clinic', 'patients', 'delete', true);

-- Tratamientos: acceso completo excepto mark_paid
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('doctor', 'clinic', 'treatments', 'view', true),
('doctor', 'clinic', 'treatments', 'create', true),
('doctor', 'clinic', 'treatments', 'edit', true),
('doctor', 'clinic', 'treatments', 'delete', true),
('doctor', 'clinic', 'treatments', 'mark_paid', false);

-- Recetas: acceso completo
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('doctor', 'clinic', 'prescriptions', 'view', true),
('doctor', 'clinic', 'prescriptions', 'create', true),
('doctor', 'clinic', 'prescriptions', 'edit', true),
('doctor', 'clinic', 'prescriptions', 'delete', true),
('doctor', 'clinic', 'prescriptions', 'print', true);

-- Presupuestos: puede crear pero no enviar
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('doctor', 'clinic', 'quotes', 'view', true),
('doctor', 'clinic', 'quotes', 'create', true),
('doctor', 'clinic', 'quotes', 'edit', true),
('doctor', 'clinic', 'quotes', 'delete', false),
('doctor', 'clinic', 'quotes', 'send', false);

-- Servicios e insumos: solo ver
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('doctor', 'clinic', 'services', 'view', true),
('doctor', 'clinic', 'services', 'create', false),
('doctor', 'clinic', 'services', 'edit', false),
('doctor', 'clinic', 'services', 'delete', false),
('doctor', 'clinic', 'services', 'set_prices', false),
('doctor', 'clinic', 'supplies', 'view', true),
('doctor', 'clinic', 'supplies', 'create', false),
('doctor', 'clinic', 'supplies', 'edit', false),
('doctor', 'clinic', 'supplies', 'delete', false),
('doctor', 'clinic', 'supplies', 'manage_stock', false);

-- Lara: puede usar todo
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('doctor', 'clinic', 'lara', 'use_entry_mode', true),
('doctor', 'clinic', 'lara', 'use_query_mode', true),
('doctor', 'clinic', 'lara', 'execute_actions', false);

-- -----------------------------------------------------------------------------
-- ASSISTANT (clinic scope)
-- Asistente dental que apoya en tratamientos
-- -----------------------------------------------------------------------------

-- Pacientes: ver, crear, editar
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('assistant', 'clinic', 'patients', 'view', true),
('assistant', 'clinic', 'patients', 'create', true),
('assistant', 'clinic', 'patients', 'edit', true),
('assistant', 'clinic', 'patients', 'delete', false);

-- Tratamientos: ver y crear
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('assistant', 'clinic', 'treatments', 'view', true),
('assistant', 'clinic', 'treatments', 'create', true),
('assistant', 'clinic', 'treatments', 'edit', false),
('assistant', 'clinic', 'treatments', 'delete', false),
('assistant', 'clinic', 'treatments', 'mark_paid', false);

-- Sin acceso a recetas
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('assistant', 'clinic', 'prescriptions', 'view', true),
('assistant', 'clinic', 'prescriptions', 'create', false),
('assistant', 'clinic', 'prescriptions', 'edit', false),
('assistant', 'clinic', 'prescriptions', 'delete', false),
('assistant', 'clinic', 'prescriptions', 'print', false);

-- Presupuestos: solo ver
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('assistant', 'clinic', 'quotes', 'view', true),
('assistant', 'clinic', 'quotes', 'create', false),
('assistant', 'clinic', 'quotes', 'edit', false),
('assistant', 'clinic', 'quotes', 'delete', false),
('assistant', 'clinic', 'quotes', 'send', false);

-- Insumos: puede ver y gestionar stock
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('assistant', 'clinic', 'services', 'view', true),
('assistant', 'clinic', 'services', 'create', false),
('assistant', 'clinic', 'services', 'edit', false),
('assistant', 'clinic', 'services', 'delete', false),
('assistant', 'clinic', 'services', 'set_prices', false),
('assistant', 'clinic', 'supplies', 'view', true),
('assistant', 'clinic', 'supplies', 'create', false),
('assistant', 'clinic', 'supplies', 'edit', false),
('assistant', 'clinic', 'supplies', 'delete', false),
('assistant', 'clinic', 'supplies', 'manage_stock', true);

-- Lara: solo entry mode
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('assistant', 'clinic', 'lara', 'use_entry_mode', true),
('assistant', 'clinic', 'lara', 'use_query_mode', false),
('assistant', 'clinic', 'lara', 'execute_actions', false);

-- -----------------------------------------------------------------------------
-- RECEPTIONIST (clinic scope)
-- Recepcionista que maneja citas y pagos
-- -----------------------------------------------------------------------------

-- Pacientes: ver, crear, editar
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('receptionist', 'clinic', 'patients', 'view', true),
('receptionist', 'clinic', 'patients', 'create', true),
('receptionist', 'clinic', 'patients', 'edit', true),
('receptionist', 'clinic', 'patients', 'delete', false);

-- Tratamientos: ver, crear, mark_paid
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('receptionist', 'clinic', 'treatments', 'view', true),
('receptionist', 'clinic', 'treatments', 'create', true),
('receptionist', 'clinic', 'treatments', 'edit', false),
('receptionist', 'clinic', 'treatments', 'delete', false),
('receptionist', 'clinic', 'treatments', 'mark_paid', true);

-- Sin acceso a recetas
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('receptionist', 'clinic', 'prescriptions', 'view', true),
('receptionist', 'clinic', 'prescriptions', 'create', false),
('receptionist', 'clinic', 'prescriptions', 'edit', false),
('receptionist', 'clinic', 'prescriptions', 'delete', false),
('receptionist', 'clinic', 'prescriptions', 'print', false);

-- Presupuestos: crear y enviar
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('receptionist', 'clinic', 'quotes', 'view', true),
('receptionist', 'clinic', 'quotes', 'create', true),
('receptionist', 'clinic', 'quotes', 'edit', false),
('receptionist', 'clinic', 'quotes', 'delete', false),
('receptionist', 'clinic', 'quotes', 'send', true);

-- Servicios: solo ver
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('receptionist', 'clinic', 'services', 'view', true),
('receptionist', 'clinic', 'services', 'create', false),
('receptionist', 'clinic', 'services', 'edit', false),
('receptionist', 'clinic', 'services', 'delete', false),
('receptionist', 'clinic', 'services', 'set_prices', false),
('receptionist', 'clinic', 'supplies', 'view', false),
('receptionist', 'clinic', 'supplies', 'create', false),
('receptionist', 'clinic', 'supplies', 'edit', false),
('receptionist', 'clinic', 'supplies', 'delete', false),
('receptionist', 'clinic', 'supplies', 'manage_stock', false);

-- Lara: solo entry mode
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('receptionist', 'clinic', 'lara', 'use_entry_mode', true),
('receptionist', 'clinic', 'lara', 'use_query_mode', false),
('receptionist', 'clinic', 'lara', 'execute_actions', false);

-- -----------------------------------------------------------------------------
-- ADMIN (clinic scope)
-- Administrador de clínica específica
-- -----------------------------------------------------------------------------

-- Copia de permisos de admin workspace pero solo para esa clínica
INSERT INTO role_permissions (role, scope, resource, action, allowed)
SELECT 'admin', 'clinic', resource, action, allowed
FROM role_permissions
WHERE role = 'admin' AND scope = 'workspace';

-- -----------------------------------------------------------------------------
-- VIEWER (clinic scope)
-- Solo lectura en clínica específica
-- -----------------------------------------------------------------------------

INSERT INTO role_permissions (role, scope, resource, action, allowed)
SELECT 'viewer', 'clinic', resource, action, allowed
FROM role_permissions
WHERE role = 'viewer' AND scope = 'workspace';

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================

-- Mostrar conteo de permisos por rol
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=== PERMISOS CREADOS ===';
  FOR r IN
    SELECT role, scope, count(*) as total
    FROM role_permissions
    GROUP BY role, scope
    ORDER BY scope, role
  LOOP
    RAISE NOTICE '% (%) = % permisos', r.role, r.scope, r.total;
  END LOOP;
END $$;
