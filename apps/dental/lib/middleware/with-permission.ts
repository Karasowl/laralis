import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveClinicContext, type ClinicContextSuccess } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthBackend } from '@/lib/auth/convex-session';
import { getConvexDocumentByLegacyId } from '@/lib/convex/server';
import { userHasPermission } from '@/lib/permissions/check';
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

async function getClinicWorkspaceId(clinicId: string) {
  if (getAuthBackend() === 'convex') {
    const clinic = await getConvexDocumentByLegacyId('clinics', clinicId) as { workspace_id?: string; workspaceId?: string } | null;
    return clinic?.workspace_id || clinic?.workspaceId || null;
  }

  const { data: clinic, error } = await supabaseAdmin
    .from('clinics')
    .select('workspace_id')
    .eq('id', clinicId)
    .single();

  if (clinic?.workspace_id) return clinic.workspace_id;

  if (getAuthBackend() === 'dual') {
    try {
      const convexClinic = await getConvexDocumentByLegacyId('clinics', clinicId) as { workspace_id?: string; workspaceId?: string } | null;
      if (convexClinic?.workspace_id || convexClinic?.workspaceId) {
        return convexClinic.workspace_id || convexClinic.workspaceId || null;
      }
    } catch (convexError) {
      console.error('[withPermission] Error loading Convex clinic workspace:', convexError);
    }
  }

  if (error) console.error('[withPermission] Error loading clinic workspace:', error);
  return null;
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

    const workspaceId = await getClinicWorkspaceId(clinicId);

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    // Check permission
    const hasPermission = await userHasPermission(userId, clinicId, permission);

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
      workspaceId,
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

    const workspaceId = await getClinicWorkspaceId(clinicId);

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    // Check all permissions
    const results = await Promise.all(
      permissions.map((perm) => userHasPermission(userId, clinicId, perm))
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
      workspaceId,
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

    const workspaceId = await getClinicWorkspaceId(clinicId);

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    // Check if any permission passes
    const results = await Promise.all(
      permissions.map((perm) => userHasPermission(userId, clinicId, perm))
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
      workspaceId,
    });
  };
}
