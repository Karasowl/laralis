import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { resolveClinicContext } from '@/lib/clinic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Schema for updating a clinic member
const updateMemberSchema = z.object({
  role: z.enum(['admin', 'doctor', 'assistant', 'receptionist', 'viewer']).optional(),
  custom_permissions: z.record(z.boolean()).nullable().optional(),
  can_access_all_patients: z.boolean().optional(),
  assigned_chair: z.string().nullable().optional(),
  schedule: z.record(z.unknown()).nullable().optional(),
  is_active: z.boolean().optional(),
});

/**
 * PUT /api/team/clinic-members/[id]
 *
 * Update a clinic member's role, permissions, or other settings.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params;
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

    // Get current user's workspace membership
    const { data: currentMembership } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    // Or check clinic admin role
    const { data: currentClinicMember } = await supabaseAdmin
      .from('clinic_users')
      .select('role')
      .eq('clinic_id', clinicId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    const canEdit =
      (currentMembership && ['owner', 'super_admin', 'admin'].includes(currentMembership.role)) ||
      (currentClinicMember && currentClinicMember.role === 'admin');

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions to edit clinic members' },
        { status: 403 }
      );
    }

    // Get target member
    const { data: targetMember } = await supabaseAdmin
      .from('clinic_users')
      .select('id, user_id, clinic_id')
      .eq('id', memberId)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Verify target member belongs to same clinic
    if (targetMember.clinic_id !== clinicId) {
      return NextResponse.json(
        { error: 'Member not in this clinic' },
        { status: 403 }
      );
    }

    // Cannot modify yourself (role/is_active)
    if (targetMember.user_id === userId) {
      const body = await request.json();
      if (body.role || body.is_active === false) {
        return NextResponse.json(
          { error: 'Cannot modify your own role or deactivate yourself' },
          { status: 403 }
        );
      }
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateMemberSchema.parse(body);

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (validatedData.role !== undefined) {
      updateData.role = validatedData.role;
    }

    if (validatedData.custom_permissions !== undefined) {
      updateData.custom_permissions = validatedData.custom_permissions;
    }

    if (validatedData.can_access_all_patients !== undefined) {
      updateData.can_access_all_patients = validatedData.can_access_all_patients;
    }

    if (validatedData.assigned_chair !== undefined) {
      updateData.assigned_chair = validatedData.assigned_chair;
    }

    if (validatedData.schedule !== undefined) {
      updateData.schedule = validatedData.schedule;
    }

    if (validatedData.is_active !== undefined) {
      updateData.is_active = validatedData.is_active;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update member
    const { data: updatedMember, error: updateError } = await supabaseAdmin
      .from('clinic_users')
      .update(updateData)
      .eq('id', memberId)
      .select()
      .single();

    if (updateError) {
      console.error('[clinic-members] Error updating member:', updateError);
      return NextResponse.json(
        { error: 'Failed to update member' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      member: updatedMember,
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

/**
 * DELETE /api/team/clinic-members/[id]
 *
 * Remove a member from a clinic (deactivate).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params;
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

    // Get current user's membership
    const { data: currentMembership } = await supabaseAdmin
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', clinic.workspace_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    const { data: currentClinicMember } = await supabaseAdmin
      .from('clinic_users')
      .select('role')
      .eq('clinic_id', clinicId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    const canRemove =
      (currentMembership && ['owner', 'super_admin', 'admin'].includes(currentMembership.role)) ||
      (currentClinicMember && currentClinicMember.role === 'admin');

    if (!canRemove) {
      return NextResponse.json(
        { error: 'Insufficient permissions to remove clinic members' },
        { status: 403 }
      );
    }

    // Get target member
    const { data: targetMember } = await supabaseAdmin
      .from('clinic_users')
      .select('id, user_id, clinic_id')
      .eq('id', memberId)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Verify target member belongs to same clinic
    if (targetMember.clinic_id !== clinicId) {
      return NextResponse.json(
        { error: 'Member not in this clinic' },
        { status: 403 }
      );
    }

    // Cannot remove yourself
    if (targetMember.user_id === userId) {
      return NextResponse.json(
        { error: 'Cannot remove yourself from clinic' },
        { status: 403 }
      );
    }

    // Deactivate member instead of deleting
    const { error: updateError } = await supabaseAdmin
      .from('clinic_users')
      .update({ is_active: false })
      .eq('id', memberId);

    if (updateError) {
      console.error('[clinic-members] Error removing member:', updateError);
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed from clinic',
    });
  } catch (error) {
    console.error('[clinic-members] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
