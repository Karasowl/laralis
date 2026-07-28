import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidPermission, type Permission } from '@/lib/permissions';
import { shouldReturnConvexData } from '@/lib/data-backend';
import { convexUserHasPermission } from '@/lib/convex/server';
import { getAuthBackend } from '@/lib/auth/convex-session';

// QA route contract: @qa-self-service-route authenticated current-user permission check.
/**
 * GET /api/permissions/check?permission=patients.create
 *
 * Check if the current user has a specific permission for the current clinic.
 *
 * Query params:
 * - permission: The permission to check (e.g., 'patients.create')
 * - clinicId: Optional clinic ID (defaults to current)
 *
 * Response:
 * {
 *   allowed: true | false,
 *   permission: 'patients.create'
 * }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const permissionParam = searchParams.get('permission');
  const clinicIdParam = searchParams.get('clinicId');

  // Validate permission parameter
  if (!permissionParam) {
    return NextResponse.json(
      { error: 'Missing permission parameter' },
      { status: 400 }
    );
  }

  if (!isValidPermission(permissionParam)) {
    return NextResponse.json(
      { error: `Invalid permission: ${permissionParam}` },
      { status: 400 }
    );
  }

  const permission = permissionParam as Permission;
  const [resource, action] = permission.split('.');

  const cookieStore = cookies();
  const context = await resolveClinicContext({
    requestedClinicId: clinicIdParam,
    cookieStore,
  });

  if ('error' in context) {
    return NextResponse.json(
      { error: context.error.message },
      { status: context.error.status }
    );
  }

  const { clinicId, userId } = context;

  try {
    // Convex read branch (flag-gated, default Supabase). This is HIGH-RISK auth
    // code, so the branch only runs AFTER resolveClinicContext above has
    // authenticated the caller and verified they belong to `clinicId`
    // (it returns 401/403 otherwise). The Convex bridge has NO RLS, so that
    // guard MUST stay before this branch and must never be skipped.
    //
    // convexUserHasPermission -> convex/authBridge.userHasPermission replicates
    // the Supabase RPC `check_user_permission`: workspace-owner => all, then
    // direct clinic_users role via role_permissions, then workspace
    // membership role ('owner' => all) via role_permissions. It receives the
    // full `resource.action` string and re-splits it the same way this route
    // does, so the resolved (resource, action) pair is identical.
    //
    // Returns the EXACT same { allowed, permission, clinicId } shape as the
    // Supabase path below.
    // Gate mirrors lib/permissions/check.ts so the whole permission subsystem
    // (enforcement guard + self-service routes) flips on the SAME signal: either
    // a full auth cutover (AUTH_BACKEND=convex) or DATA_READ_BACKEND_ROLE_PERMISSIONS.
    if (getAuthBackend() === 'convex' || shouldReturnConvexData('role_permissions')) {
      const allowed = await convexUserHasPermission(userId, clinicId, permission);

      return NextResponse.json({
        allowed: Boolean(allowed),
        permission,
        clinicId,
      });
    }

    // Use the database function to check permission
    const { data: allowed, error } = await supabaseAdmin.rpc(
      'check_user_permission',
      {
        p_user_id: userId,
        p_clinic_id: clinicId,
        p_resource: resource,
        p_action: action,
      }
    );

    if (error) {
      console.error('[permissions] Error checking permission:', error);
      return NextResponse.json(
        { error: 'Failed to check permission' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      allowed: Boolean(allowed),
      permission,
      clinicId,
    });
  } catch (error) {
    console.error('[permissions] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
