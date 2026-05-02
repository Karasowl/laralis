/**
 * Permissions Module
 *
 * Central export for all permission-related types, functions, and utilities.
 *
 * @example
 * import { Permission, PERMISSION_RESOURCES, roleHasPermission } from '@/lib/permissions';
 *
 * if (roleHasPermission('admin', 'patients.create')) {
 *   // User can create patients
 * }
 */

// Types
export type {
  Permission,
  PermissionResource,
  PermissionAction,
  PermissionMap,
  WorkspaceRole,
  ClinicRole,
  Role,
  RoleScope,
  WorkspaceMember,
  ClinicMember,
  Invitation,
  InvitationWithInviter,
  CreateInvitationInput,
  InvitationStatus,
  PermissionsContext,
  CustomRoleTemplate,
} from './types';

// Constants
export {
  PERMISSION_RESOURCES,
  WORKSPACE_ROLES,
  CLINIC_ROLES,
} from './types';

// Helper functions
export {
  getAllPermissionsForResource,
  getAllPermissions,
  parsePermission,
  isValidPermission,
  getPermissionCategories,
} from './types';

// Role templates
export {
  getWorkspaceRolePermissions,
  getClinicRolePermissions,
  roleHasPermission,
  getDifferentPermissions,
  mergePermissions,
} from './role-templates';
