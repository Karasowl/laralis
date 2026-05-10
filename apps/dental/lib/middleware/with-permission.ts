import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveClinicContext, type ClinicContextSuccess } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { Permission } from '@/lib/permissions';

/**
 * Extended context passed to handlers wrapped with withPermission
 */
export interface PermissionContext extends ClinicContextSuccess {
  workspaceId: string;
}

/**
 * Handler type for permission-protected routes
 */
type PermissionHandler = (
  request: NextRequest,
  context: PermissionContext
) => Promise<NextResponse>;

/**
 * Check if user has permission using the database function
 */
async function checkPermission(
  userId: string,
  clinicId: string,
  permission: Permission
): Promise<boolean> {
  const [resource, action] = permission.split('.');

  const { data, error } = await supabaseAdmin.rpc('check_user_permission', {
    p_user_id: userId,
    p_clinic_id: clinicId,
    p_resource: resource,
    p_action: action,
  });

  if (error) {
    console.error('[withPermission] Error checking permission:', error);
    return false;
  }

  return Boolean(data);
}

/**
 * Higher-order function to wrap API handlers with permission checking.
 *
 * @param permission - The permission required to access this endpoint
 * @param handler - The handler function to execute if permission is granted
 *
 * @example
 * // In route.ts
 * export const POST = withPermission('patients.create', async (req, ctx) => {
 *   // ctx contains: { clinicId, userId, workspaceId }
 *   const body = await req.json();
 *   // ... create patient
 *   return NextResponse.json({ success: true });
 * });
 */
export function withPermission(
  permission: Permission,
  handler: PermissionHandler
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const cookieStore = cookies();

    // Get clinic ID from query params or body
    const url = new URL(request.url);
    const clinicIdFromQuery =
      url.searchParams.get('clinicId') || url.searchParams.get('clinic_id');

    // Resolve clinic context
    const context = await resolveClinicContext({
      requestedClinicId: clinicIdFromQuery,
      cookieStore,
    });

    if ('error' in context) {
      return NextResponse.json(
        { error: context.error.message },
        { status: context.error.status }
      );
    }

    const { clinicId, userId } = context;

    // Get workspace ID for context
    const { data: clinic } = await supabaseAdmin
      .from('clinics')
      .select('workspace_id')
      .eq('id', clinicId)
      .single();

    if (!clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    // Check permission
    const hasPermission = await checkPermission(userId, clinicId, permission);

    if (!hasPermission) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: `You do not have permission: ${permission}`,
        },
        { status: 403 }
      );
    }

    // Call the wrapped handler with extended context
    return handler(request, {
      clinicId,
      userId,
      workspaceId: clinic.workspace_id,
    });
  };
}

/**
 * Check multiple permissions (all must pass)
 *
 * @example
 * export const DELETE = withAllPermissions(
 *   ['patients.view', 'patients.delete'],
 *   async (req, ctx) => { ... }
 * );
 */
export function withAllPermissions(
  permissions: Permission[],
  handler: PermissionHandler
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const cookieStore = cookies();
    const url = new URL(request.url);
    const clinicIdFromQuery =
      url.searchParams.get('clinicId') || url.searchParams.get('clinic_id');

    const context = await resolveClinicContext({
      requestedClinicId: clinicIdFromQuery,
      cookieStore,
    });

    if ('error' in context) {
      return NextResponse.json(
        { error: context.error.message },
        { status: context.error.status }
      );
    }

    const { clinicId, userId } = context;

    const { data: clinic } = await supabaseAdmin
      .from('clinics')
      .select('workspace_id')
      .eq('id', clinicId)
      .single();

    if (!clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    // Check all permissions
    const results = await Promise.all(
      permissions.map((perm) => checkPermission(userId, clinicId, perm))
    );

    const missingPermissions = permissions.filter((_, i) => !results[i]);

    if (missingPermissions.length > 0) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: `Missing permissions: ${missingPermissions.join(', ')}`,
        },
        { status: 403 }
      );
    }

    return handler(request, {
      clinicId,
      userId,
      workspaceId: clinic.workspace_id,
    });
  };
}

/**
 * Check any of the permissions (at least one must pass)
 *
 * @example
 * export const GET = withAnyPermission(
 *   ['expenses.view', 'financial_reports.view'],
 *   async (req, ctx) => { ... }
 * );
 */
export function withAnyPermission(
  permissions: Permission[],
  handler: PermissionHandler
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const cookieStore = cookies();
    const url = new URL(request.url);
    const clinicIdFromQuery =
      url.searchParams.get('clinicId') || url.searchParams.get('clinic_id');

    const context = await resolveClinicContext({
      requestedClinicId: clinicIdFromQuery,
      cookieStore,
    });

    if ('error' in context) {
      return NextResponse.json(
        { error: context.error.message },
        { status: context.error.status }
      );
    }

    const { clinicId, userId } = context;

    const { data: clinic } = await supabaseAdmin
      .from('clinics')
      .select('workspace_id')
      .eq('id', clinicId)
      .single();

    if (!clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    // Check if any permission passes
    const results = await Promise.all(
      permissions.map((perm) => checkPermission(userId, clinicId, perm))
    );

    const hasAnyPermission = results.some(Boolean);

    if (!hasAnyPermission) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: `Requires one of: ${permissions.join(', ')}`,
        },
        { status: 403 }
      );
    }

    return handler(request, {
      clinicId,
      userId,
      workspaceId: clinic.workspace_id,
    });
  };
}
