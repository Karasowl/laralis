import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic'

const sendCodeSchema = z.object({
  email: z.string().email(),
});


export async function POST(request: NextRequest) {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const parsed = validateSchema(sendCodeSchema, bodyResult.data);
    if ('error' in parsed) {
      return parsed.error;
    }
    const { email } = parsed.data;

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

    // Verificar que el email corresponde al usuario actual
    if (user.email !== email) {
      return NextResponse.json(
        { error: 'Email does not match current user' },
        { status: 403 }
      );
    }

    // Primero verificar si ya existe un código reciente para este email
    const { data: recentCode } = await supabaseAdmin
      .from('verification_codes')
      .select('created_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentCode) {
      const lastSentTime = new Date(recentCode.created_at).getTime();
      const now = Date.now();
      const timeSinceLastCode = now - lastSentTime;
      const waitTime = 60000; // 60 segundos en milisegundos
      
      if (timeSinceLastCode < waitTime) {
        const remainingSeconds = Math.ceil((waitTime - timeSinceLastCode) / 1000);
        return NextResponse.json({
          error: 'rate_limit',
          message: `Por favor espera ${remainingSeconds} segundos antes de solicitar un nuevo código`,
          remainingSeconds
        }, { status: 429 });
      }
    }

    // Usar el sistema OTP de Supabase para enviar un código de verificación
    const { data, error: otpError } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false, // No crear usuario si no existe
      }
    });

    if (otpError) {
      // Si es error de rate limit de Supabase
      if (otpError.message && otpError.message.includes('after')) {
        // Extraer segundos del mensaje de error
        const match = otpError.message.match(/after (\d+) seconds/);
        const seconds = match ? parseInt(match[1]) : 60;
        
        return NextResponse.json({
          error: 'rate_limit',
          message: `Por favor espera ${seconds} segundos antes de solicitar un nuevo código`,
          remainingSeconds: seconds
        }, { status: 429 });
      }
      
      // Otros errores
      console.error('Error sending OTP:', otpError);
      return NextResponse.json({ 
        error: 'Failed to send verification code',
        message: 'No se pudo enviar el código de verificación'
      }, { status: 500 });
    }

    // Guardar registro del código enviado para control de rate limit
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    await supabaseAdmin
      .from('verification_codes')
      .upsert({
        email,
        code: verificationCode,
        expires_at: new Date(Date.now() + 600000).toISOString(), // 10 minutos
        used: false,
        created_at: new Date().toISOString()
      });

    // OTP enviado exitosamente por Supabase
    console.info(`
      ========================================
      ✅ Código de verificación enviado por Supabase
      📧 Email: ${email}
      
      El email contendrá un código de 6 dígitos
      o un link mágico según tu configuración.
      ========================================
    `);

    return NextResponse.json({ 
      message: 'Verification code sent to your email',
      useSupabaseOtp: true
    });

  } catch (error) {
    console.error('Error in send-code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
