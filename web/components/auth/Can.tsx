'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import type { Permission } from '@/lib/permissions/types';

interface CanProps {
  /**
   * Permission(s) to check.
   * If array, behavior depends on `mode`.
   */
  permission: Permission | Permission[];

  /**
   * How to check multiple permissions:
   * - 'all': User must have ALL permissions (default)
   * - 'any': User must have AT LEAST ONE permission
   */
  mode?: 'all' | 'any';

  /**
   * Content to render if user has permission
   */
  children: ReactNode;

  /**
   * Optional fallback to render if user doesn't have permission
   */
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on user permissions.
 *
 * @example
 * // Single permission
 * <Can permission="patients.create">
 *   <Button>New Patient</Button>
 * </Can>
 *
 * @example
 * // Multiple permissions (all required)
 * <Can permission={['expenses.view', 'expenses.edit']} mode="all">
 *   <ExpenseEditor />
 * </Can>
 *
 * @example
 * // Multiple permissions (any one required)
 * <Can permission={['expenses.view', 'financial_reports.view']} mode="any">
 *   <FinanceSection />
 * </Can>
 *
 * @example
 * // With fallback
 * <Can permission="team.invite" fallback={<Locked />}>
 *   <InviteButton />
 * </Can>
 */
export function Can({ permission, mode = 'all', children, fallback = null }: CanProps) {
  const { can, canAll, canAny, loading } = usePermissions();

  // While loading, don't render anything (prevents flash)
  if (loading) {
    return null;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasPermission =
    mode === 'all' ? canAll(permissions) : canAny(permissions);

  if (hasPermission) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Renders children only if user DOES NOT have the specified permission(s).
 *
 * @example
 * <CanNot permission="team.manage">
 *   <Alert>You don't have permission to manage the team</Alert>
 * </CanNot>
 */
export function CanNot({
  permission,
  mode = 'all',
  children,
  fallback = null,
}: CanProps) {
  const { can, canAll, canAny, loading } = usePermissions();

  if (loading) {
    return null;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasPermission =
    mode === 'all' ? canAll(permissions) : canAny(permissions);

  if (!hasPermission) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
