'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import type { Permission } from '@/lib/permissions/types';
import { AlertTriangle, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PermissionGateProps {
  /**
   * Permission(s) required to view the content
   */
  permission: Permission | Permission[];

  /**
   * How to check multiple permissions
   */
  mode?: 'all' | 'any';

  /**
   * Content to render if user has permission
   */
  children: ReactNode;

  /**
   * Type of fallback to show when permission denied:
   * - 'hidden': Don't render anything
   * - 'locked': Show a locked state placeholder
   * - 'message': Show an access denied message
   * - 'custom': Use the provided fallback ReactNode
   */
  fallbackType?: 'hidden' | 'locked' | 'message' | 'custom';

  /**
   * Custom fallback content (used when fallbackType is 'custom')
   */
  fallback?: ReactNode;

  /**
   * Custom message to show (used when fallbackType is 'message')
   */
  message?: string;
}

/**
 * A more feature-rich permission gate with built-in fallback UI options.
 *
 * @example
 * // Hide content if no permission
 * <PermissionGate permission="expenses.view" fallbackType="hidden">
 *   <ExpensesTable />
 * </PermissionGate>
 *
 * @example
 * // Show locked placeholder
 * <PermissionGate permission="financial_reports.view" fallbackType="locked">
 *   <ReportsSection />
 * </PermissionGate>
 *
 * @example
 * // Show access denied message
 * <PermissionGate
 *   permission="team.edit_roles"
 *   fallbackType="message"
 *   message="Contact your administrator for access"
 * >
 *   <RoleEditor />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  mode = 'all',
  children,
  fallbackType = 'hidden',
  fallback,
  message,
}: PermissionGateProps) {
  const t = useTranslations('permissions');
  const { canAll, canAny, loading } = usePermissions();

  if (loading) {
    return null;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasPermission =
    mode === 'all' ? canAll(permissions) : canAny(permissions);

  if (hasPermission) {
    return <>{children}</>;
  }

  // Render appropriate fallback
  switch (fallbackType) {
    case 'hidden':
      return null;

    case 'locked':
      return (
        <div className="flex items-center justify-center p-8 border border-dashed rounded-lg bg-muted/30">
          <div className="text-center text-muted-foreground">
            <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">{t('locked.title')}</p>
            <p className="text-xs">{t('locked.description')}</p>
          </div>
        </div>
      );

    case 'message':
      return (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              {t('denied.title')}
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {message || t('denied.description')}
            </p>
          </div>
        </div>
      );

    case 'custom':
      return <>{fallback}</>;

    default:
      return null;
  }
}

/**
 * HOC to wrap a page/component with permission check
 *
 * @example
 * export default withPermission('expenses.view')(ExpensesPage);
 */
export function withPermission<P extends object>(
  permission: Permission | Permission[],
  options?: {
    mode?: 'all' | 'any';
    fallbackType?: 'hidden' | 'locked' | 'message';
    message?: string;
  }
) {
  return function WithPermissionWrapper(
    WrappedComponent: React.ComponentType<P>
  ) {
    return function WithPermission(props: P) {
      return (
        <PermissionGate
          permission={permission}
          mode={options?.mode}
          fallbackType={options?.fallbackType ?? 'message'}
          message={options?.message}
        >
          <WrappedComponent {...props} />
        </PermissionGate>
      );
    };
  };
}
