import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { deleteClinicData } from '@/lib/clinic-tables';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';

// QA route contract: @qa-self-service-route authenticated current-user account deletion.
export const dynamic = 'force-dynamic'

const deleteAccountSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});

async function verifyAccountDeletionOtp(
  supabase: ReturnType<typeof createServerClient>,
  email: string,
  code: string
) {
  const emailOtp = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email'
  });

  if (!emailOtp.error && emailOtp.data?.user) {
    return true;
  }

  const magicLinkOtp = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'magiclink'
  });

  return !magicLinkOtp.error && Boolean(magicLinkOtp.data?.user);
}

async function deleteOwnedWorkspace(workspaceId: string) {
  const { data: clinics } = await supabaseAdmin
    .from('clinics')
    .select('id')
    .eq('workspace_id', workspaceId);

  for (const clinic of clinics || []) {
    await deleteClinicData(clinic.id);
  }

  await supabaseAdmin
    .from('clinics')
    .delete()
    .eq('workspace_id', workspaceId);

  await supabaseAdmin
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId);

  await supabaseAdmin
    .from('workspace_users')
    .delete()
    .eq('workspace_id', workspaceId);

  await supabaseAdmin
    .from('user_workspaces')
    .delete()
    .eq('workspace_id', workspaceId);

  await supabaseAdmin
    .from('workspace_activity')
    .delete()
    .eq('workspace_id', workspaceId);

  await supabaseAdmin
    .from('workspaces')
    .delete()
    .eq('id', workspaceId);
}


export async function DELETE(request: NextRequest) {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const parsed = validateSchema(deleteAccountSchema, bodyResult.data);
    if ('error' in parsed) {
      return parsed.error;
    }
    const { email, code } = parsed.data;

    // Crear cliente de Supabase para verificar autenticaciÃ³n
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // No necesitamos establecer cookies en esta ruta
          },
          remove(name: string, options: CookieOptions) {
            // No necesitamos eliminar cookies en esta ruta
          },
        },
      }
    );

    // Obtener el usuario actual
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userId = user.id;
    if (user.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email does not match current user' },
        { status: 403 }
      );
    }

    // SECURITY: the only acceptable proof of email ownership for account
    // deletion is a successful Supabase OTP verification (the user must
    // have received and entered the actual code Supabase emailed them).
    //
    // The previous fallback queried a `verification_codes` row by
    // (email, code) — but that code was never sent to the user; it just
    // sat in the DB. Any leak of that table (snapshots, exports, backups)
    // turned it into a pre-shared deletion key. Removed entirely.
    const emailVerified = await verifyAccountDeletionOtp(supabase, email, code);

    if (!emailVerified) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    const workspaceIds = new Set<string>();

    const { data: ownedWorkspaces, error: ownedWorkspacesError } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('owner_id', userId);

    if (ownedWorkspacesError) {
      return NextResponse.json(
        { error: 'Failed to load owned workspaces' },
        { status: 500 }
      );
    }

    for (const workspace of ownedWorkspaces || []) {
      workspaceIds.add(workspace.id);
    }

    // Keep compatibility with older rows that still used user_workspaces.
    const { data: userWorkspaces, error: workspacesError } = await supabaseAdmin
      .from('user_workspaces')
      .select('workspace_id')
      .eq('user_id', userId);

    if (!workspacesError && userWorkspaces) {
      for (const uw of userWorkspaces) {
        const { data: workspace } = await supabaseAdmin
          .from('workspaces')
          .select('id')
          .eq('id', uw.workspace_id)
          .eq('owner_id', userId)
          .single();

        if (workspace?.id) workspaceIds.add(workspace.id);
      }
    }

    for (const workspaceId of Array.from(workspaceIds)) {
      await deleteOwnedWorkspace(workspaceId);
    }

    // Remove memberships where the user was not the owner.
    await supabaseAdmin
      .from('user_workspaces')
      .delete()
      .eq('user_id', userId);

    await supabaseAdmin
      .from('workspace_members')
      .delete()
      .eq('user_id', userId);

    await supabaseAdmin
      .from('workspace_users')
      .delete()
      .eq('user_id', userId);

    // Eliminar el usuario de la tabla users
    await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    // Finalmente, eliminar el usuario de Supabase Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      // Aunque falle la eliminaciÃ³n del auth, los datos ya fueron eliminados
    }

    // Limpiar cookies
    cookieStore.delete('userId');
    cookieStore.delete('userEmail');
    cookieStore.delete('workspaceId');
    cookieStore.delete('clinicId');

    return NextResponse.json({ 
      message: 'Account successfully deleted',
      redirect: '/'
    });

  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
