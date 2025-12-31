import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ClinicMember, ClinicRole } from '@/lib/permissions';

// Type for the user_profiles relation from Supabase query
interface UserProfileRelation {
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

/**
 * GET /api/team/clinic-members
 *
 * List all members of a specific clinic.
 * Query params:
 * - clinicId: Optional, defaults to current clinic
 */
export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const { searchParams } = new URL(request.url);
  const clinicIdParam = searchParams.get('clinicId');

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
    // Verify user has access to this clinic
    const { data: accessCheck } = await supabaseAdmin.rpc(
      'is_clinic_member',
      { p_clinic_id: clinicId }
    );

    // Fallback: check workspace membership
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

    const { data: workspaceMember } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!accessCheck && !workspaceMember) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Fetch all clinic members with user profile info
    const { data: members, error } = await supabaseAdmin
      .from('clinic_users')
      .select(`
        id,
        user_id,
        clinic_id,
        role,
        custom_permissions,
        custom_role_id,
        is_active,
        joined_at,
        can_access_all_patients,
        assigned_chair,
        schedule,
        user_profiles!inner (
          email,
          full_name,
          avatar_url
        )
      `)
      .eq('clinic_id', clinicId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('[clinic-members] Error fetching members:', error);
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      );
    }

    // Transform to expected format
    const transformedMembers: ClinicMember[] = (members || []).map((m) => ({
      id: m.id,
      user_id: m.user_id,
      clinic_id: m.clinic_id,
      role: m.role as ClinicRole,
      custom_permissions: m.custom_permissions,
      custom_role_id: m.custom_role_id,
      is_active: m.is_active,
      joined_at: m.joined_at,
      can_access_all_patients: m.can_access_all_patients,
      assigned_chair: m.assigned_chair,
      schedule: m.schedule as Record<string, unknown> | null,
      email: (m.user_profiles as unknown as UserProfileRelation).email,
      full_name: (m.user_profiles as unknown as UserProfileRelation).full_name,
      avatar_url: (m.user_profiles as unknown as UserProfileRelation).avatar_url,
    }));

    return NextResponse.json({
      members: transformedMembers,
      clinicId,
    });
  } catch (error) {
    console.error('[clinic-members] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Schema for adding a user to a clinic
const addMemberSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  role: z.enum(['admin', 'doctor', 'assistant', 'receptionist', 'viewer']),
  custom_permissions: z.record(z.boolean()).optional(),
  can_access_all_patients: z.boolean().optional(),
  assigned_chair: z.string().optional(),
});

/**
 * POST /api/team/clinic-members
 *
 * Add an existing workspace user to a specific clinic.
 * The user must already be a member of the workspace.
 */
export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const { searchParams } = new URL(request.url);
  const clinicIdParam = searchParams.get('clinicId');

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
    // Get clinic and workspace
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

    // Verify current user can add members
    const { data: currentMembership } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!currentMembership || !['owner', 'super_admin', 'admin'].includes(currentMembership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to add clinic members' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = addMemberSchema.parse(body);

    // Verify target user is in workspace
    const { data: targetWorkspaceMember } = await supabaseAdmin
      .from('workspace_users')
      .select('id, is_active')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', validatedData.user_id)
      .single();

    if (!targetWorkspaceMember || !targetWorkspaceMember.is_active) {
      return NextResponse.json(
        { error: 'User is not a member of this workspace' },
        { status: 400 }
      );
    }

    // Check if user already in clinic
    const { data: existingMember } = await supabaseAdmin
      .from('clinic_users')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('user_id', validatedData.user_id)
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this clinic' },
        { status: 400 }
      );
    }

    // Add user to clinic
    const { data: newMember, error: insertError } = await supabaseAdmin
      .from('clinic_users')
      .insert({
        clinic_id: clinicId,
        user_id: validatedData.user_id,
        role: validatedData.role,
        custom_permissions: validatedData.custom_permissions || null,
        can_access_all_patients: validatedData.can_access_all_patients ?? false,
        assigned_chair: validatedData.assigned_chair || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[clinic-members] Error adding member:', insertError);
      return NextResponse.json(
        { error: 'Failed to add member' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      member: newMember,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[clinic-members] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
