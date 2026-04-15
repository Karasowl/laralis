import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { deleteClinicData } from '@/lib/clinic-tables';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic'

const deleteAccountSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});


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

    // Primero intentar verificar con el OTP de Supabase
    // Esto funciona si el usuario recibiÃ³ un cÃ³digo de 6 dÃ­gitos
    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      email: email,
      token: code,
      type: 'email'
    });

    // SECURITY: the only acceptable proof of email ownership for account
    // deletion is a successful Supabase OTP verification (the user must
    // have received and entered the actual code Supabase emailed them).
    //
    // The previous fallback queried a `verification_codes` row by
    // (email, code) — but that code was never sent to the user; it just
    // sat in the DB. Any leak of that table (snapshots, exports, backups)
    // turned it into a pre-shared deletion key. Removed entirely.
    const emailVerified = !otpError && Boolean(otpData?.user);

    if (!emailVerified) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    // Obtener todos los workspaces del usuario
    const { data: userWorkspaces, error: workspacesError } = await supabaseAdmin
      .from('user_workspaces')
      .select('workspace_id')
      .eq('user_id', userId);

    if (!workspacesError && userWorkspaces) {
      // Para cada workspace donde el usuario es owner
      for (const uw of userWorkspaces) {
        const { data: workspace } = await supabaseAdmin
          .from('workspaces')
          .select('*')
          .eq('id', uw.workspace_id)
          .eq('owner_id', userId)
          .single();

        if (workspace) {
          // Obtener todas las clÃ­nicas del workspace
          const { data: clinics } = await supabaseAdmin
            .from('clinics')
            .select('id')
            .eq('workspace_id', workspace.id);

          if (clinics) {
            for (const clinic of clinics) {
              await deleteClinicData(clinic.id);
            }

            // Eliminar las clÃ­nicas
            await supabaseAdmin
              .from('clinics')
              .delete()
              .eq('workspace_id', workspace.id);
          }

          // Eliminar miembros del workspace
          await supabaseAdmin
            .from('workspace_members')
            .delete()
            .eq('workspace_id', workspace.id);

          await supabaseAdmin
            .from('user_workspaces')
            .delete()
            .eq('workspace_id', workspace.id);

          // Eliminar actividad del workspace
          await supabaseAdmin
            .from('workspace_activity')
            .delete()
            .eq('workspace_id', workspace.id);

          // Eliminar el workspace
          await supabaseAdmin
            .from('workspaces')
            .delete()
            .eq('id', workspace.id);
        }
      }
    }

    // Eliminar el usuario de user_workspaces (si queda alguno)
    await supabaseAdmin
      .from('user_workspaces')
      .delete()
      .eq('user_id', userId);

    await supabaseAdmin
      .from('workspace_members')
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
