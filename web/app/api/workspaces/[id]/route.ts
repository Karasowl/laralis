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
    const { name, description } = body;

    // Validar datos requeridos
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
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
    const { data: workspace, error: updateError } = await supabaseAdmin
      .from('workspaces')
      .update({
        name,
        description,
        updated_at: new Date().toISOString()
      })
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