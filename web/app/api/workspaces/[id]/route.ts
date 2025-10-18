import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    
    // Crear cliente de Supabase para el servidor
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, onboarding_completed, onboarding_step } = body;

    // Permitir actualizaciones parciales: nombre/descr o flags de onboarding
    if (
      (name === undefined || name === null) &&
      description === undefined &&
      onboarding_completed === undefined &&
      onboarding_step === undefined
    ) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Verificar que el workspace pertenece al usuario
    const { data: existingWorkspace, error: fetchError } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('id', params.id)
      .eq('owner_id', user.id)
      .single();

    if (fetchError || !existingWorkspace) {
      return NextResponse.json(
        { error: 'Workspace not found or unauthorized' },
        { status: 404 }
      );
    }

    // Actualizar el workspace
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (onboarding_completed !== undefined) updateData.onboarding_completed = Boolean(onboarding_completed);
    if (onboarding_step !== undefined) updateData.onboarding_step = Number(onboarding_step);

    const { data: workspace, error: updateError } = await supabaseAdmin
      .from('workspaces')
      .update(updateData)
      .eq('id', params.id)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating workspace:', updateError);
      return NextResponse.json(
        { error: 'Failed to update workspace', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Unexpected error in PUT /api/workspaces/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();

    // Crear cliente de Supabase para el servidor
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verificar que el workspace pertenece al usuario
    const { data: existingWorkspace, error: fetchError } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('id', params.id)
      .eq('owner_id', user.id)
      .single();

    if (fetchError || !existingWorkspace) {
      return NextResponse.json(
        { error: 'Workspace not found or unauthorized' },
        { status: 404 }
      );
    }

    // Check if there are other workspaces with clinics for this user
    const { data: otherWorkspaces, error: wsErr } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .neq('id', params.id);

    if (wsErr) {
      return NextResponse.json(
        { error: 'Failed to check other workspaces', details: wsErr.message },
        { status: 500 }
      );
    }

    let hasOtherWorkspacesWithClinics = false;
    if (otherWorkspaces && otherWorkspaces.length > 0) {
      for (const ws of otherWorkspaces) {
        const { count, error: countErr } = await supabaseAdmin
          .from('clinics')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', ws.id);

        if (!countErr && count && count > 0) {
          hasOtherWorkspacesWithClinics = true;
          break;
        }
      }
    }

    // Business rule: Cannot delete workspace if it's the last one with clinics
    if (!hasOtherWorkspacesWithClinics) {
      return NextResponse.json(
        {
          error: 'Cannot delete the last workspace with clinics. Create another workspace with at least one clinic first.',
          code: 'LAST_WORKSPACE'
        },
        { status: 400 }
      );
    }

    // Eliminar el workspace (esto también eliminará las clínicas asociadas por cascade)
    const { error: deleteError } = await supabaseAdmin
      .from('workspaces')
      .delete()
      .eq('id', params.id)
      .eq('owner_id', user.id);

    if (deleteError) {
      console.error('Error deleting workspace:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete workspace', details: deleteError.message },
        { status: 500 }
      );
    }

    // Si el workspace eliminado era el actual, limpiar la cookie
    const currentWorkspaceId = cookieStore.get('workspaceId')?.value;
    if (currentWorkspaceId === params.id) {
      const response = NextResponse.json({ success: true });
      response.cookies.delete('workspaceId');
      response.cookies.delete('clinicId');
      return response;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/workspaces/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
