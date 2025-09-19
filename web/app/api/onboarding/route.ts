import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { workspace, clinic } = body;

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
      console.error('Error creating workspace:', workspaceError);
      const status = (workspaceError as any).code === '23505' ? 400 : 500;
      const msg = (workspaceError as any).code === '23505' ? 'Workspace slug already exists' : 'Failed to create workspace';
      return NextResponse.json(
        { error: msg },
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
      console.error('Error creating clinic:', clinicError);
      // Try to rollback workspace creation
      await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceData.id);
      
      return NextResponse.json(
        { error: 'Failed to create clinic' },
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
