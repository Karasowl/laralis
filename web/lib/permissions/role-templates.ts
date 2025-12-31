/**
 * Predefined Role Templates
 *
 * These templates define the default permissions for each built-in role.
 * They can be used to:
 * 1. Display role capabilities in the UI
 * 2. Create custom roles based on existing ones
 * 3. Validate permissions client-side
 */

import type {
  Permission,
  PermissionMap,
  WorkspaceRole,
  ClinicRole,
} from './types';

// =============================================================================
// WORKSPACE ROLE TEMPLATES
// =============================================================================

/**
 * Get default permissions for a workspace role
 */
export function getWorkspaceRolePermissions(role: WorkspaceRole): PermissionMap {
  switch (role) {
    case 'owner':
    case 'super_admin':
      // These are handled specially in the backend
      // They get all permissions
      return {};

    case 'admin':
      return {
        // Patients: full access
        'patients.view': true,
        'patients.create': true,
        'patients.edit': true,
        'patients.delete': true,

        // Treatments: full access
        'treatments.view': true,
        'treatments.create': true,
        'treatments.edit': true,
        'treatments.delete': true,
        'treatments.mark_paid': true,

        // Prescriptions: full access
        'prescriptions.view': true,
        'prescriptions.create': true,
        'prescriptions.edit': true,
        'prescriptions.delete': true,
        'prescriptions.print': true,

        // Quotes: full access
        'quotes.view': true,
        'quotes.create': true,
        'quotes.edit': true,
        'quotes.delete': true,
        'quotes.send': true,

        // Services: NO price setting
        'services.view': true,
        'services.create': true,
        'services.edit': true,
        'services.delete': true,
        'services.set_prices': false,

        // Supplies: full access
        'supplies.view': true,
        'supplies.create': true,
        'supplies.edit': true,
        'supplies.delete': true,
        'supplies.manage_stock': true,

        // Financial: NO access
        'expenses.view': false,
        'expenses.create': false,
        'expenses.edit': false,
        'expenses.delete': false,
        'fixed_costs.view': false,
        'fixed_costs.create': false,
        'fixed_costs.edit': false,
        'fixed_costs.delete': false,
        'assets.view': false,
        'assets.create': false,
        'assets.edit': false,
        'assets.delete': false,
        'financial_reports.view': false,
        'financial_reports.export': false,
        'break_even.view': false,

        // Campaigns: full access
        'campaigns.view': true,
        'campaigns.create': true,
        'campaigns.edit': true,
        'campaigns.delete': true,

        // Settings: full access
        'settings.view': true,
        'settings.edit': true,

        // Team: can view and invite, NOT edit roles
        'team.view': true,
        'team.invite': true,
        'team.edit_roles': false,
        'team.remove': false,

        // Lara: entry mode only
        'lara.use_entry_mode': true,
        'lara.use_query_mode': false,
        'lara.execute_actions': false,

        // Export: yes, Import: no
        'export_import.export': true,
        'export_import.import': false,
      };

    case 'editor':
      return {
        // Patients: create and edit, NO delete
        'patients.view': true,
        'patients.create': true,
        'patients.edit': true,
        'patients.delete': false,

        // Treatments: create and edit, NO delete or mark_paid
        'treatments.view': true,
        'treatments.create': true,
        'treatments.edit': true,
        'treatments.delete': false,
        'treatments.mark_paid': false,

        // Prescriptions: create and edit
        'prescriptions.view': true,
        'prescriptions.create': true,
        'prescriptions.edit': true,
        'prescriptions.delete': false,
        'prescriptions.print': true,

        // Quotes: view and create only
        'quotes.view': true,
        'quotes.create': true,
        'quotes.edit': false,
        'quotes.delete': false,
        'quotes.send': false,

        // Services and Supplies: view only
        'services.view': true,
        'services.create': false,
        'services.edit': false,
        'services.delete': false,
        'services.set_prices': false,
        'supplies.view': true,
        'supplies.create': false,
        'supplies.edit': false,
        'supplies.delete': false,
        'supplies.manage_stock': false,

        // No financial access
        'expenses.view': false,
        'expenses.create': false,
        'expenses.edit': false,
        'expenses.delete': false,
        'fixed_costs.view': false,
        'fixed_costs.create': false,
        'fixed_costs.edit': false,
        'fixed_costs.delete': false,
        'assets.view': false,
        'assets.create': false,
        'assets.edit': false,
        'assets.delete': false,
        'financial_reports.view': false,
        'financial_reports.export': false,
        'break_even.view': false,

        // Campaigns: view only
        'campaigns.view': true,
        'campaigns.create': false,
        'campaigns.edit': false,
        'campaigns.delete': false,

        // No settings or team
        'settings.view': false,
        'settings.edit': false,
        'team.view': false,
        'team.invite': false,
        'team.edit_roles': false,
        'team.remove': false,

        // Lara: entry mode only
        'lara.use_entry_mode': true,
        'lara.use_query_mode': false,
        'lara.execute_actions': false,

        // No export/import
        'export_import.export': false,
        'export_import.import': false,
      };

    case 'viewer':
      return {
        // View-only access to clinical data
        'patients.view': true,
        'patients.create': false,
        'patients.edit': false,
        'patients.delete': false,

        'treatments.view': true,
        'treatments.create': false,
        'treatments.edit': false,
        'treatments.delete': false,
        'treatments.mark_paid': false,

        'prescriptions.view': true,
        'prescriptions.create': false,
        'prescriptions.edit': false,
        'prescriptions.delete': false,
        'prescriptions.print': false,

        'quotes.view': true,
        'quotes.create': false,
        'quotes.edit': false,
        'quotes.delete': false,
        'quotes.send': false,

        'services.view': true,
        'services.create': false,
        'services.edit': false,
        'services.delete': false,
        'services.set_prices': false,

        'supplies.view': true,
        'supplies.create': false,
        'supplies.edit': false,
        'supplies.delete': false,
        'supplies.manage_stock': false,

        // No access to anything else
        'expenses.view': false,
        'expenses.create': false,
        'expenses.edit': false,
        'expenses.delete': false,
        'fixed_costs.view': false,
        'fixed_costs.create': false,
        'fixed_costs.edit': false,
        'fixed_costs.delete': false,
        'assets.view': false,
        'assets.create': false,
        'assets.edit': false,
        'assets.delete': false,
        'financial_reports.view': false,
        'financial_reports.export': false,
        'break_even.view': false,
        'campaigns.view': false,
        'campaigns.create': false,
        'campaigns.edit': false,
        'campaigns.delete': false,
        'settings.view': false,
        'settings.edit': false,
        'team.view': false,
        'team.invite': false,
        'team.edit_roles': false,
        'team.remove': false,
        'lara.use_entry_mode': false,
        'lara.use_query_mode': false,
        'lara.execute_actions': false,
        'export_import.export': false,
        'export_import.import': false,
      };
  }
}

// =============================================================================
// CLINIC ROLE TEMPLATES
// =============================================================================

/**
 * Get default permissions for a clinic role
 */
export function getClinicRolePermissions(role: ClinicRole): PermissionMap {
  switch (role) {
    case 'admin':
      // Same as workspace admin
      return getWorkspaceRolePermissions('admin');

    case 'doctor':
      return {
        // Patients: full access
        'patients.view': true,
        'patients.create': true,
        'patients.edit': true,
        'patients.delete': true,

        // Treatments: full access except mark_paid
        'treatments.view': true,
        'treatments.create': true,
        'treatments.edit': true,
        'treatments.delete': true,
        'treatments.mark_paid': false,

        // Prescriptions: full access
        'prescriptions.view': true,
        'prescriptions.create': true,
        'prescriptions.edit': true,
        'prescriptions.delete': true,
        'prescriptions.print': true,

        // Quotes: create but not send
        'quotes.view': true,
        'quotes.create': true,
        'quotes.edit': true,
        'quotes.delete': false,
        'quotes.send': false,

        // Services and Supplies: view only
        'services.view': true,
        'services.create': false,
        'services.edit': false,
        'services.delete': false,
        'services.set_prices': false,
        'supplies.view': true,
        'supplies.create': false,
        'supplies.edit': false,
        'supplies.delete': false,
        'supplies.manage_stock': false,

        // Lara: entry and query mode
        'lara.use_entry_mode': true,
        'lara.use_query_mode': true,
        'lara.execute_actions': false,
      };

    case 'assistant':
      return {
        // Patients: create and edit
        'patients.view': true,
        'patients.create': true,
        'patients.edit': true,
        'patients.delete': false,

        // Treatments: view and create
        'treatments.view': true,
        'treatments.create': true,
        'treatments.edit': false,
        'treatments.delete': false,
        'treatments.mark_paid': false,

        // Prescriptions: view only
        'prescriptions.view': true,
        'prescriptions.create': false,
        'prescriptions.edit': false,
        'prescriptions.delete': false,
        'prescriptions.print': false,

        // Quotes: view only
        'quotes.view': true,
        'quotes.create': false,
        'quotes.edit': false,
        'quotes.delete': false,
        'quotes.send': false,

        // Services: view, Supplies: manage stock
        'services.view': true,
        'services.create': false,
        'services.edit': false,
        'services.delete': false,
        'services.set_prices': false,
        'supplies.view': true,
        'supplies.create': false,
        'supplies.edit': false,
        'supplies.delete': false,
        'supplies.manage_stock': true,

        // Lara: entry mode only
        'lara.use_entry_mode': true,
        'lara.use_query_mode': false,
        'lara.execute_actions': false,
      };

    case 'receptionist':
      return {
        // Patients: create and edit
        'patients.view': true,
        'patients.create': true,
        'patients.edit': true,
        'patients.delete': false,

        // Treatments: create and mark_paid
        'treatments.view': true,
        'treatments.create': true,
        'treatments.edit': false,
        'treatments.delete': false,
        'treatments.mark_paid': true,

        // Prescriptions: view only
        'prescriptions.view': true,
        'prescriptions.create': false,
        'prescriptions.edit': false,
        'prescriptions.delete': false,
        'prescriptions.print': false,

        // Quotes: create and send
        'quotes.view': true,
        'quotes.create': true,
        'quotes.edit': false,
        'quotes.delete': false,
        'quotes.send': true,

        // Services: view only
        'services.view': true,
        'services.create': false,
        'services.edit': false,
        'services.delete': false,
        'services.set_prices': false,
        'supplies.view': false,
        'supplies.create': false,
        'supplies.edit': false,
        'supplies.delete': false,
        'supplies.manage_stock': false,

        // Lara: entry mode only
        'lara.use_entry_mode': true,
        'lara.use_query_mode': false,
        'lara.execute_actions': false,
      };

    case 'viewer':
      return getWorkspaceRolePermissions('viewer');
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a permission is included in a role's default permissions
 */
export function roleHasPermission(
  role: WorkspaceRole | ClinicRole,
  permission: Permission,
  scope: 'workspace' | 'clinic' = 'workspace'
): boolean {
  // Owner and super_admin have all permissions
  if (role === 'owner' || role === 'super_admin') {
    // Except these for super_admin
    if (
      role === 'super_admin' &&
      (permission === 'workspace.delete' as unknown as Permission ||
        permission === 'workspace.transfer_ownership' as unknown as Permission)
    ) {
      return false;
    }
    return true;
  }

  const permissions =
    scope === 'workspace'
      ? getWorkspaceRolePermissions(role as WorkspaceRole)
      : getClinicRolePermissions(role as ClinicRole);

  return permissions[permission] === true;
}

/**
 * Get permissions that differ between two roles
 */
export function getDifferentPermissions(
  baseRole: WorkspaceRole | ClinicRole,
  compareRole: WorkspaceRole | ClinicRole,
  scope: 'workspace' | 'clinic' = 'workspace'
): {
  added: Permission[];
  removed: Permission[];
} {
  const basePerms =
    scope === 'workspace'
      ? getWorkspaceRolePermissions(baseRole as WorkspaceRole)
      : getClinicRolePermissions(baseRole as ClinicRole);

  const comparePerms =
    scope === 'workspace'
      ? getWorkspaceRolePermissions(compareRole as WorkspaceRole)
      : getClinicRolePermissions(compareRole as ClinicRole);

  const added: Permission[] = [];
  const removed: Permission[] = [];

  // Find permissions added in compareRole
  for (const [perm, allowed] of Object.entries(comparePerms)) {
    if (allowed && !basePerms[perm as Permission]) {
      added.push(perm as Permission);
    }
  }

  // Find permissions removed in compareRole
  for (const [perm, allowed] of Object.entries(basePerms)) {
    if (allowed && !comparePerms[perm as Permission]) {
      removed.push(perm as Permission);
    }
  }

  return { added, removed };
}

/**
 * Merge base role permissions with custom overrides
 */
export function mergePermissions(
  baseRole: WorkspaceRole | ClinicRole,
  customPermissions: PermissionMap | null,
  scope: 'workspace' | 'clinic' = 'workspace'
): PermissionMap {
  const basePerms =
    scope === 'workspace'
      ? getWorkspaceRolePermissions(baseRole as WorkspaceRole)
      : getClinicRolePermissions(baseRole as ClinicRole);

  if (!customPermissions) {
    return basePerms;
  }

  return {
    ...basePerms,
    ...customPermissions,
  };
}
