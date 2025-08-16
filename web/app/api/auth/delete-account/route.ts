import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function DELETE(request: NextRequest) {
  try {
    const { email, code } = await request.json();
    
    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    // Crear cliente de Supabase para verificar autenticación
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
    // Esto funciona si el usuario recibió un código de 6 dígitos
    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      email: email,
      token: code,
      type: 'email'
    });

    // Si el OTP de Supabase funciona, el email está verificado
    let emailVerified = !otpError && otpData?.user;

    // Si el OTP de Supabase no funciona, verificar en nuestra tabla de fallback
    if (!emailVerified) {
      const { data: verificationCode, error: codeError } = await supabaseAdmin
        .from('verification_codes')
        .select('*')
        .eq('email', email)
        .eq('code', code)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (codeError || !verificationCode) {
        return NextResponse.json(
          { error: 'Invalid or expired verification code' },
          { status: 400 }
        );
      }

      // Marcar código como usado
      await supabaseAdmin
        .from('verification_codes')
        .update({ used: true })
        .eq('email', email);
      
      emailVerified = true;
    }

    // Si el email no está verificado, rechazar
    if (!emailVerified) {
      return NextResponse.json(
        { error: 'Could not verify email ownership' },
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
          // Obtener todas las clínicas del workspace
          const { data: clinics } = await supabaseAdmin
            .from('clinics')
            .select('id')
            .eq('workspace_id', workspace.id);

          if (clinics) {
            for (const clinic of clinics) {
              // Eliminar todos los datos de cada clínica
              // El orden es importante por las foreign keys
              
              // 1. Eliminar tratamientos
              await supabaseAdmin
                .from('treatments')
                .delete()
                .eq('clinic_id', clinic.id);

              // 2. Eliminar service_supplies
              const { data: services } = await supabaseAdmin
                .from('services')
                .select('id')
                .eq('clinic_id', clinic.id);
              
              if (services) {
                for (const service of services) {
                  await supabaseAdmin
                    .from('service_supplies')
                    .delete()
                    .eq('service_id', service.id);
                }
              }

              // 3. Eliminar servicios
              await supabaseAdmin
                .from('services')
                .delete()
                .eq('clinic_id', clinic.id);

              // 4. Eliminar pacientes
              await supabaseAdmin
                .from('patients')
                .delete()
                .eq('clinic_id', clinic.id);

              // 5. Eliminar insumos
              await supabaseAdmin
                .from('supplies')
                .delete()
                .eq('clinic_id', clinic.id);

              // 6. Eliminar gastos
              await supabaseAdmin
                .from('expenses')
                .delete()
                .eq('clinic_id', clinic.id);

              // 7. Eliminar activos
              await supabaseAdmin
                .from('assets')
                .delete()
                .eq('clinic_id', clinic.id);

              // 8. Eliminar costos fijos
              await supabaseAdmin
                .from('fixed_costs')
                .delete()
                .eq('clinic_id', clinic.id);

              // 9. Eliminar configuración de tiempo
              await supabaseAdmin
                .from('settings_time')
                .delete()
                .eq('clinic_id', clinic.id);

              // 10. Eliminar tarifas
              await supabaseAdmin
                .from('tariffs')
                .delete()
                .eq('clinic_id', clinic.id);
            }

            // Eliminar las clínicas
            await supabaseAdmin
              .from('clinics')
              .delete()
              .eq('workspace_id', workspace.id);
          }

          // Eliminar miembros del workspace
          await supabaseAdmin
            .from('user_workspaces')
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

    // Eliminar el usuario de la tabla users
    await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    // Finalmente, eliminar el usuario de Supabase Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      // Aunque falle la eliminación del auth, los datos ya fueron eliminados
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