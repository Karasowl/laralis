import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
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

    const workspaceId = cookieStore.get('workspaceId')?.value;

    if (workspaceId) {
      // Verificar que el workspace existe y pertenece al usuario
      const { data: workspace, error } = await supabaseAdmin
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .eq('owner_id', user.id)
        .single();

      if (!error && workspace) {
        return NextResponse.json({ workspace });
      }
    }

    // Buscar workspaces del usuario
    const { data: workspaces, error } = await supabaseAdmin
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error('Error fetching workspaces:', error);
      return NextResponse.json(
        { error: 'Failed to fetch workspaces' },
        { status: 500 }
      );
    }

    if (workspaces && workspaces.length > 0) {
      // Guardar el primer workspace en cookies
      const response = NextResponse.json({ workspace: workspaces[0] });
      response.cookies.set('workspaceId', workspaces[0].id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 días
      });
      return response;
    }

    return NextResponse.json({ workspace: null });
  } catch (error) {
    console.error('Unexpected error in GET /api/workspaces:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const { workspaceName, workspaceSlug, clinicName, clinicAddress } = body;

    console.log('Creating workspace with data:', { workspaceName, workspaceSlug, clinicName, userId: user.id });

    // Validar datos requeridos
    if (!workspaceName || !workspaceSlug || !clinicName) {
      return NextResponse.json(
        { error: 'Missing required fields', details: { workspaceName: !!workspaceName, workspaceSlug: !!workspaceSlug, clinicName: !!clinicName } },
        { status: 400 }
      );
    }

    // Crear el workspace asociado al usuario autenticado
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .insert({
        name: workspaceName,
        slug: workspaceSlug,
        description: `Workspace de ${workspaceName}`,
        owner_id: user.id,
        onboarding_completed: true,
        onboarding_step: 3
      })
      .select()
      .single();

    if (workspaceError) {
      console.error('Error creating workspace:', workspaceError);
      if (workspaceError.code === '23505') {
        return NextResponse.json(
          { error: 'El slug ya está en uso. Por favor elige otro.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to create workspace', details: workspaceError.message || workspaceError },
        { status: 500 }
      );
    }

    console.log('Workspace created successfully:', workspace.id);

    // Crear la primera clínica
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .insert({
        workspace_id: workspace.id,
        name: clinicName,
        address: clinicAddress || null,
        is_active: true
      })
      .select()
      .single();

    if (clinicError) {
      console.error('Error creating clinic:', clinicError);
      
      // Rollback: eliminar workspace si falla la creación de la clínica
      await supabaseAdmin
        .from('workspaces')
        .delete()
        .eq('id', workspace.id);
      
      return NextResponse.json(
        { error: 'Failed to create clinic', details: (clinicError as any).message || clinicError },
        { status: 500 }
      );
    }

    // Crear el miembro owner del workspace
    const { error: memberError } = await supabaseAdmin
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner',
        clinic_ids: []
      });

    if (memberError) {
      console.error('Error creating workspace member:', memberError);
      // No es crítico, continuamos ya que owner_id en workspaces es suficiente
    }

    // Establecer cookies para workspace y clinic
    const response = NextResponse.json({ 
      workspace,
      clinic,
      success: true
    });

    response.cookies.set('workspaceId', workspace.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 días
    });

    response.cookies.set('clinicId', clinic.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 días
    });

    return response;
  } catch (error) {
    console.error('Unexpected error in POST /api/workspaces:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as any)?.message },
      { status: 500 }
    );
  }
}