import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { PermissionMap, WorkspaceRole, ClinicRole } from '@/lib/permissions';

/**
 * GET /api/permissions/my
 *
 * Returns the current user's permissions for the current clinic.
 * Includes workspace role, clinic role, and resolved permission map.
 *
 * Response:
 * {
 *   workspaceRole: 'owner' | 'super_admin' | 'admin' | 'editor' | 'viewer' | null,
 *   clinicRole: 'admin' | 'doctor' | 'assistant' | 'receptionist' | 'viewer' | null,
 *   permissions: { 'patients.view': true, 'expenses.view': false, ... }
 * }
 */
export async function GET() {
  const cookieStore = cookies();
  const context = await resolveClinicContext({ cookieStore });

  if ('error' in context) {
    return NextResponse.json(
      { error: context.error.message },
      { status: context.error.status }
    );
  }

  const { clinicId, userId } = context;

  try {
    // Get workspace for this clinic
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .select('workspace_id')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    // Get workspace membership
    const { data: workspaceMember, error: wsError } = await supabaseAdmin
      .from('workspace_users')
      .select('role, custom_permissions, allowed_clinics')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (wsError && wsError.code !== 'PGRST116') {
      console.error('[permissions] Error fetching workspace member:', wsError);
    }

    // Get clinic membership (optional, may not exist)
    const { data: clinicMember, error: clinicMemberError } = await supabaseAdmin
      .from('clinic_users')
      .select('role, custom_permissions')
      .eq('clinic_id', clinicId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (clinicMemberError && clinicMemberError.code !== 'PGRST116') {
      console.error('[permissions] Error fetching clinic member:', clinicMemberError);
    }

    const workspaceRole = (workspaceMember?.role || null) as WorkspaceRole | null;
    const clinicRole = (clinicMember?.role || null) as ClinicRole | null;

    // Get resolved permissions from database function
    const { data: permissions, error: permError } = await supabaseAdmin.rpc(
      'get_user_permissions',
      {
        p_user_id: userId,
        p_clinic_id: clinicId,
      }
    );

    if (permError) {
      console.error('[permissions] Error getting permissions:', permError);
      return NextResponse.json(
        { error: 'Failed to get permissions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      workspaceRole,
      clinicRole,
      permissions: (permissions || {}) as PermissionMap,
      clinicId,
      workspaceId: clinic.workspace_id,
    });
  } catch (error) {
    console.error('[permissions] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
