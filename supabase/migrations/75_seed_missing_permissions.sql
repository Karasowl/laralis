-- ============================================
-- 75. SEED MISSING PERMISSIONS (LEADS/INBOX)
-- ============================================
-- Adds missing permissions without truncating existing data.

-- Workspace roles
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'workspace', 'leads', 'view', true),
('admin', 'workspace', 'leads', 'create', true),
('admin', 'workspace', 'leads', 'edit', true),
('admin', 'workspace', 'leads', 'delete', true),
('admin', 'workspace', 'inbox', 'view', true),
('admin', 'workspace', 'inbox', 'assign', true),
('admin', 'workspace', 'inbox', 'reply', true),
('admin', 'workspace', 'inbox', 'close', true),
('admin', 'workspace', 'inbox', 'transfer', true),

('editor', 'workspace', 'leads', 'view', true),
('editor', 'workspace', 'leads', 'create', false),
('editor', 'workspace', 'leads', 'edit', false),
('editor', 'workspace', 'leads', 'delete', false),
('editor', 'workspace', 'inbox', 'view', true),
('editor', 'workspace', 'inbox', 'assign', false),
('editor', 'workspace', 'inbox', 'reply', true),
('editor', 'workspace', 'inbox', 'close', false),
('editor', 'workspace', 'inbox', 'transfer', false),

('viewer', 'workspace', 'leads', 'view', false),
('viewer', 'workspace', 'leads', 'create', false),
('viewer', 'workspace', 'leads', 'edit', false),
('viewer', 'workspace', 'leads', 'delete', false),
('viewer', 'workspace', 'inbox', 'view', false),
('viewer', 'workspace', 'inbox', 'assign', false),
('viewer', 'workspace', 'inbox', 'reply', false),
('viewer', 'workspace', 'inbox', 'close', false),
('viewer', 'workspace', 'inbox', 'transfer', false)
ON CONFLICT (role, scope, resource, action) DO NOTHING;

-- Clinic roles
INSERT INTO role_permissions (role, scope, resource, action, allowed) VALUES
('admin', 'clinic', 'leads', 'view', true),
('admin', 'clinic', 'leads', 'create', true),
('admin', 'clinic', 'leads', 'edit', true),
('admin', 'clinic', 'leads', 'delete', true),
('admin', 'clinic', 'inbox', 'view', true),
('admin', 'clinic', 'inbox', 'assign', true),
('admin', 'clinic', 'inbox', 'reply', true),
('admin', 'clinic', 'inbox', 'close', true),
('admin', 'clinic', 'inbox', 'transfer', true),

('doctor', 'clinic', 'leads', 'view', true),
('doctor', 'clinic', 'leads', 'create', false),
('doctor', 'clinic', 'leads', 'edit', false),
('doctor', 'clinic', 'leads', 'delete', false),
('doctor', 'clinic', 'inbox', 'view', true),
('doctor', 'clinic', 'inbox', 'assign', false),
('doctor', 'clinic', 'inbox', 'reply', false),
('doctor', 'clinic', 'inbox', 'close', false),
('doctor', 'clinic', 'inbox', 'transfer', false),

('assistant', 'clinic', 'leads', 'view', true),
('assistant', 'clinic', 'leads', 'create', false),
('assistant', 'clinic', 'leads', 'edit', false),
('assistant', 'clinic', 'leads', 'delete', false),
('assistant', 'clinic', 'inbox', 'view', true),
('assistant', 'clinic', 'inbox', 'assign', false),
('assistant', 'clinic', 'inbox', 'reply', true),
('assistant', 'clinic', 'inbox', 'close', true),
('assistant', 'clinic', 'inbox', 'transfer', false),

('receptionist', 'clinic', 'leads', 'view', true),
('receptionist', 'clinic', 'leads', 'create', true),
('receptionist', 'clinic', 'leads', 'edit', true),
('receptionist', 'clinic', 'leads', 'delete', true),
('receptionist', 'clinic', 'inbox', 'view', true),
('receptionist', 'clinic', 'inbox', 'assign', true),
('receptionist', 'clinic', 'inbox', 'reply', true),
('receptionist', 'clinic', 'inbox', 'close', true),
('receptionist', 'clinic', 'inbox', 'transfer', true),

('viewer', 'clinic', 'leads', 'view', false),
('viewer', 'clinic', 'leads', 'create', false),
('viewer', 'clinic', 'leads', 'edit', false),
('viewer', 'clinic', 'leads', 'delete', false),
('viewer', 'clinic', 'inbox', 'view', false),
('viewer', 'clinic', 'inbox', 'assign', false),
('viewer', 'clinic', 'inbox', 'reply', false),
('viewer', 'clinic', 'inbox', 'close', false),
('viewer', 'clinic', 'inbox', 'transfer', false)
ON CONFLICT (role, scope, resource, action) DO NOTHING;
