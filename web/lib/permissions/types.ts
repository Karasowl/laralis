/**
 * Granular Permissions System - Type Definitions
 *
 * This module defines the type system for the granular permissions feature.
 * Permissions follow the format: `resource.action`
 *
 * @example
 * - 'patients.view' - Can view patients
 * - 'treatments.create' - Can create treatments
 * - 'expenses.delete' - Can delete expenses
 */

// =============================================================================
// PERMISSION RESOURCES AND ACTIONS
// =============================================================================

/**
 * All available permission resources and their actions.
 * This is the single source of truth for all permissions in the system.
 */
export const PERMISSION_RESOURCES = {
  // Clinical Operations
  patients: ['view', 'create', 'edit', 'delete'] as const,
  treatments: ['view', 'create', 'edit', 'delete', 'mark_paid'] as const,
  prescriptions: ['view', 'create', 'edit', 'delete', 'print'] as const,
  quotes: ['view', 'create', 'edit', 'delete', 'send'] as const,

  // Catalog Management
  services: ['view', 'create', 'edit', 'delete', 'set_prices'] as const,
  supplies: ['view', 'create', 'edit', 'delete', 'manage_stock'] as const,

  // Financial
  expenses: ['view', 'create', 'edit', 'delete'] as const,
  fixed_costs: ['view', 'create', 'edit', 'delete'] as const,
  assets: ['view', 'create', 'edit', 'delete'] as const,
  financial_reports: ['view', 'export'] as const,
  break_even: ['view'] as const,

  // Marketing
  campaigns: ['view', 'create', 'edit', 'delete'] as const,
  leads: ['view', 'create', 'edit', 'delete'] as const,

  // Inbox
  inbox: ['view', 'assign', 'reply', 'close', 'transfer'] as const,

  // Configuration
  settings: ['view', 'edit'] as const,

  // Team Management
  team: ['view', 'invite', 'edit_roles', 'remove'] as const,

  // AI Assistant
  lara: ['use_entry_mode', 'use_query_mode', 'execute_actions'] as const,

  // Data Management
  export_import: ['export', 'import'] as const,
} as const;

// =============================================================================
// DERIVED TYPES
// =============================================================================

/** All resource names */
export type PermissionResource = keyof typeof PERMISSION_RESOURCES;

/** Actions for a specific resource */
export type PermissionAction<R extends PermissionResource> =
  (typeof PERMISSION_RESOURCES)[R][number];

/** All possible permission strings (e.g., 'patients.view', 'treatments.create') */
export type Permission = {
  [R in PermissionResource]: `${R}.${PermissionAction<R>}`;
}[PermissionResource];

/** Map of permission to boolean (for storing user permissions) */
export type PermissionMap = Partial<Record<Permission, boolean>>;

// =============================================================================
// ROLE TYPES
// =============================================================================

/** Workspace-level roles */
export type WorkspaceRole =
  | 'owner'
  | 'super_admin'
  | 'admin'
  | 'editor'
  | 'viewer';

/** Clinic-level roles */
export type ClinicRole =
  | 'admin'
  | 'doctor'
  | 'assistant'
  | 'receptionist'
  | 'viewer';

/** All roles (workspace + clinic) */
export type Role = WorkspaceRole | ClinicRole;

/** Role scope */
export type RoleScope = 'workspace' | 'clinic';

// =============================================================================
// MEMBER TYPES
// =============================================================================

/** Base member fields shared between workspace and clinic members */
interface BaseMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  joined_at: string;
  custom_permissions: PermissionMap | null;
  custom_role_id: string | null;
}

/** Workspace member with workspace-specific fields */
export interface WorkspaceMember extends BaseMember {
  workspace_id: string;
  role: WorkspaceRole;
  allowed_clinics: string[];
}

/** Clinic member with clinic-specific fields */
export interface ClinicMember extends BaseMember {
  clinic_id: string;
  role: ClinicRole;
  can_access_all_patients: boolean;
  assigned_chair: string | null;
  schedule: Record<string, unknown> | null;
}

// =============================================================================
// INVITATION TYPES
// =============================================================================

/** Invitation status */
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

/** Invitation record */
export interface Invitation {
  id: string;
  workspace_id: string;
  clinic_id: string | null;
  clinic_ids: string[];
  email: string;
  role: Role;
  permissions: PermissionMap | null;
  custom_permissions: PermissionMap | null;
  custom_role_id: string | null;
  token: string;
  expires_at: string;
  invited_by: string;
  accepted_at: string | null;
  rejected_at: string | null;
  message: string | null;
  resent_count: number;
  last_resent_at: string | null;
  created_at: string;
}

/** Invitation with inviter details (for display) */
export interface InvitationWithInviter extends Invitation {
  inviter: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

/** Data for creating a new invitation */
export interface CreateInvitationInput {
  email: string;
  role: Role;
  scope?: RoleScope;
  clinic_ids?: string[];
  custom_permissions?: PermissionMap;
  custom_role_id?: string | null;
  message?: string;
}

// =============================================================================
// PERMISSION CONTEXT
// =============================================================================

/** Context returned by usePermissions hook */
export interface PermissionsContext {
  /** User's role in current workspace */
  workspaceRole: WorkspaceRole | null;
  /** User's role in current clinic (if any) */
  clinicRole: ClinicRole | null;
  /** Map of all resolved permissions */
  permissions: PermissionMap;
  /** Whether permissions are still loading */
  loading: boolean;
  /** Error if permissions failed to load */
  error: Error | null;
}

// =============================================================================
// CUSTOM ROLE TEMPLATE
// =============================================================================

/** Custom role template (created by workspace admins) */
export interface CustomRoleTemplate {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string | null;
  permissions: PermissionMap;
  scope: RoleScope;
  base_role: Role | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all permissions for a specific resource
 * @example getAllPermissionsForResource('patients') // ['patients.view', 'patients.create', ...]
 */
export function getAllPermissionsForResource(
  resource: PermissionResource
): Permission[] {
  return PERMISSION_RESOURCES[resource].map(
    (action) => `${resource}.${action}` as Permission
  );
}

/**
 * Get all permissions in the system
 */
export function getAllPermissions(): Permission[] {
  return Object.entries(PERMISSION_RESOURCES).flatMap(([resource, actions]) =>
    actions.map((action) => `${resource}.${action}` as Permission)
  );
}

/**
 * Parse a permission string into resource and action
 * @example parsePermission('patients.view') // { resource: 'patients', action: 'view' }
 */
export function parsePermission(
  permission: Permission
): { resource: PermissionResource; action: string } | null {
  const [resource, action] = permission.split('.') as [
    PermissionResource,
    string,
  ];
  if (!resource || !action) return null;
  if (!(resource in PERMISSION_RESOURCES)) return null;
  return { resource, action };
}

/**
 * Check if a string is a valid permission
 */
export function isValidPermission(value: string): value is Permission {
  const result = parsePermission(value as Permission);
  if (!result) return false;
  const actions = PERMISSION_RESOURCES[result.resource] as readonly string[];
  return actions.includes(result.action);
}

/**
 * Get permission categories for UI grouping
 */
export function getPermissionCategories(): {
  key: string;
  label: string;
  resources: PermissionResource[];
}[] {
  return [
    {
      key: 'clinical',
      label: 'Clinical Operations',
      resources: ['patients', 'treatments', 'prescriptions', 'quotes'],
    },
    {
      key: 'catalog',
      label: 'Catalog',
      resources: ['services', 'supplies'],
    },
    {
      key: 'financial',
      label: 'Financial',
      resources: [
        'expenses',
        'fixed_costs',
        'assets',
        'financial_reports',
        'break_even',
      ],
    },
    {
      key: 'marketing',
      label: 'Marketing',
      resources: ['campaigns', 'leads'],
    },
    {
      key: 'inbox',
      label: 'Inbox',
      resources: ['inbox'],
    },
    {
      key: 'admin',
      label: 'Administration',
      resources: ['settings', 'team', 'export_import'],
    },
    {
      key: 'ai',
      label: 'AI Assistant',
      resources: ['lara'],
    },
  ];
}

// =============================================================================
// ROLE METADATA
// =============================================================================

/** Metadata for workspace roles */
export const WORKSPACE_ROLES: Record<
  WorkspaceRole,
  {
    label: string;
    description: string;
    isSystem: boolean;
  }
> = {
  owner: {
    label: 'Owner',
    description: 'Full control over workspace and all clinics',
    isSystem: true,
  },
  super_admin: {
    label: 'Super Admin',
    description: 'Full control except ownership transfer',
    isSystem: true,
  },
  admin: {
    label: 'Admin',
    description: 'Manage clinic operations without financial visibility',
    isSystem: false,
  },
  editor: {
    label: 'Editor',
    description: 'Create and edit patients and treatments',
    isSystem: false,
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to clinical data',
    isSystem: false,
  },
};

/** Metadata for clinic roles */
export const CLINIC_ROLES: Record<
  ClinicRole,
  {
    label: string;
    description: string;
  }
> = {
  admin: {
    label: 'Clinic Admin',
    description: 'Full control over this clinic',
  },
  doctor: {
    label: 'Doctor',
    description: 'Clinical professional with patient access',
  },
  assistant: {
    label: 'Assistant',
    description: 'Support staff with limited access',
  },
  receptionist: {
    label: 'Receptionist',
    description: 'Front desk with appointments and payments',
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access',
  },
};
