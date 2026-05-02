import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendConfirmationEmail } from '@/lib/email/service';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cookieStore = cookies();
    const clinicContext = await resolveClinicContext({ cookieStore });

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      );
    }

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = authData.user;
    const targetEmail = user.email;
    if (!targetEmail) {
      return NextResponse.json({ error: 'User email not available' }, { status: 400 });
    }

    const { data: clinic } = await supabaseAdmin
      .from('clinics')
      .select('name, phone, address')
      .eq('id', clinicContext.clinicId)
      .single();

    const today = new Date().toISOString().split('T')[0];
    const patientName =
      (user.user_metadata as { full_name?: string })?.full_name ||
      targetEmail.split('@')[0] ||
      'User';

    const result = await sendConfirmationEmail({
      patientName,
      patientEmail: targetEmail,
      clinicName: clinic?.name || 'Clinic',
      clinicPhone: clinic?.phone || undefined,
      clinicAddress: clinic?.address || undefined,
      serviceName: 'Test Appointment',
      appointmentDate: today,
      appointmentTime: '10:00',
      duration: 30,
      notes: 'Test email from settings',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send test email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('[settings/notifications/test] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
