import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'


export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { workspace, clinic } = body;

    // Try to refresh session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('[onboarding] Session error:', sessionError);
    }

    // If we have a session, try to refresh it
    if (session) {
      const { error: refreshError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });

      if (refreshError) {
        console.error('[onboarding] Refresh error:', refreshError);
      }
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[onboarding] Auth error:', {
        userError,
        hasSession: !!session,
        sessionUserId: session?.user?.id,
        errorMessage: userError?.message
      });
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message || 'No user found' },
        { status: 401 }
      );
    }

    console.log('[onboarding] User authenticated:', {
      userId: user.id,
      email: user.email,
      workspaceName: workspace.name,
      clinicName: clinic.name
    });

    // Generate slug from workspace name
    const generateSlug = (name: string) => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);
    };

    // Create workspace (handle slug conflicts gracefully)
    const baseSlug = generateSlug(workspace.name);
    const attemptInsert = async (slug: string) => {
      return await supabase
        .from('workspaces')
        .insert({
          name: workspace.name,
          slug,
          description: workspace.description,
          owner_id: user.id
        })
        .select()
        .single();
    };

    let { data: workspaceData, error: workspaceError } = await attemptInsert(baseSlug);
    if (workspaceError && (workspaceError as any).code === '23505') {
      // Slug already exists. Try a suffixed slug once.
      const altSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const retry = await attemptInsert(altSlug);
      workspaceData = retry.data as any;
      workspaceError = retry.error as any;
    }

    if (workspaceError) {
      console.error('[onboarding] Error creating workspace:', {
        error: workspaceError,
        code: (workspaceError as any).code,
        message: workspaceError.message,
        details: (workspaceError as any).details,
        hint: (workspaceError as any).hint,
        userId: user.id,
        workspaceName: workspace.name,
        slug: baseSlug
      });
      const status = (workspaceError as any).code === '23505' ? 400 : 500;
      const msg = (workspaceError as any).code === '23505' ? 'Workspace slug already exists' : 'Failed to create workspace';
      return NextResponse.json(
        {
          error: msg,
          details: workspaceError.message,
          code: (workspaceError as any).code,
          hint: (workspaceError as any).hint
        },
        { status }
      );
    }

    // Create clinic
    const { data: clinicData, error: clinicError } = await supabase
      .from('clinics')
      .insert({
        name: clinic.name,
        address: clinic.address || null, // Make address optional
        phone: clinic.phone || null,
        email: clinic.email || null,
        workspace_id: workspaceData.id
      })
      .select()
      .single();

    if (clinicError) {
      console.error('[onboarding] Error creating clinic:', {
        error: clinicError,
        code: (clinicError as any).code,
        message: clinicError.message,
        details: (clinicError as any).details,
        hint: (clinicError as any).hint,
        userId: user.id,
        workspaceId: workspaceData.id,
        clinicName: clinic.name
      });
      // Try to rollback workspace creation
      await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceData.id);

      return NextResponse.json(
        {
          error: 'Failed to create clinic',
          details: clinicError.message,
          code: (clinicError as any).code,
          hint: (clinicError as any).hint
        },
        { status: 500 }
      );
    }

    // Mark onboarding as complete in user metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        onboarding_completed: true,
        default_workspace_id: workspaceData.id,
        default_clinic_id: clinicData.id
      }
    });

    if (updateError) {
      console.error('Error updating user metadata:', updateError);
    }

    return NextResponse.json({
      success: true,
      workspace: workspaceData,
      clinic: clinicData
    });

  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
