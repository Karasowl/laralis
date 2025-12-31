import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidPermission, type Permission } from '@/lib/permissions';

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
