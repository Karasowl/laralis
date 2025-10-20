
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { deleteClinicData } from '@/lib/clinic-tables';

export const dynamic = 'force-dynamic'


async function deleteWorkspaceData(workspaceId: string) {
  const { data: clinicRows, error: clinicQueryError } = await supabaseAdmin
    .from('clinics')
    .select('id')
    .eq('workspace_id', workspaceId);

  if (clinicQueryError) throw clinicQueryError;

  const clinicIds = (clinicRows ?? []).map(row => row?.id).filter((id): id is string => Boolean(id));

  if (clinicIds.length > 0) {
    for (const clinicId of clinicIds) {
      await deleteClinicData(clinicId);
    }
  }

  const { error: clinicDeleteError } = await supabaseAdmin
    .from('clinics')
    .delete()
    .eq('workspace_id', workspaceId);
  if (clinicDeleteError && clinicDeleteError.code !== 'PGRST116') throw clinicDeleteError;

  const { error: memberDeleteError } = await supabaseAdmin
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId);
  if (memberDeleteError && memberDeleteError.code !== 'PGRST116') throw memberDeleteError;

  const { error: activityDeleteError } = await supabaseAdmin
    .from('workspace_activity')
    .delete()
    .eq('workspace_id', workspaceId);
  if (activityDeleteError && activityDeleteError.code !== 'PGRST116') throw activityDeleteError;

  const { error: workspaceDeleteError } = await supabaseAdmin
    .from('workspaces')
    .delete()
    .eq('id', workspaceId);
  if (workspaceDeleteError && workspaceDeleteError.code !== 'PGRST116') throw workspaceDeleteError;
}

async function resetUserMetadata(userId: string, metadata: Record<string, unknown>) {
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: metadata,
    });
  } catch (error) {
    console.error('Failed to reset user metadata', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const resetType = body?.resetType as string | undefined;

    if (!resetType) {
      return NextResponse.json({ error: 'Reset type is required' }, { status: 400 });
    }

    const workspaceCookie = cookieStore.get('workspaceId')?.value || null;

    if (resetType === 'initial_setup') {
      const workspaceIds = new Set<string>();
      if (workspaceCookie) workspaceIds.add(workspaceCookie);

      const { data: ownedWorkspaces, error: ownedError } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id);
      if (ownedError) throw ownedError;
      (ownedWorkspaces ?? []).forEach(ws => {
        if (ws?.id) workspaceIds.add(ws.id);
      });

      const { data: memberWorkspaces, error: memberError } = await supabaseAdmin
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id);
      if (memberError) throw memberError;
      (memberWorkspaces ?? []).forEach(row => {
        if (row?.workspace_id) workspaceIds.add(row.workspace_id);
      });

      for (const wsId of workspaceIds) {
        await deleteWorkspaceData(wsId);
      }

      await supabaseAdmin
        .from('workspace_members')
        .delete()
        .eq('user_id', user.id);

      const currentMetadata = { ...(user.user_metadata || {}) } as Record<string, unknown>;
      currentMetadata.onboarding_completed = false;
      delete currentMetadata.default_workspace_id;
      delete currentMetadata.default_clinic_id;
      await resetUserMetadata(user.id, currentMetadata);

      const response = NextResponse.json({ success: true, message: 'Initial setup cancelled' });
      response.cookies.set('workspaceId', '', { path: '/', maxAge: 0 });
      response.cookies.set('clinicId', '', { path: '/', maxAge: 0 });
      return response;
    }

    let activeWorkspaceId = workspaceCookie;
    let clinicId: string | null = cookieStore.get('clinicId')?.value || null;

    if (clinicId) {
      const { data: clinicRow } = await supabaseAdmin
        .from('clinics')
        .select('workspace_id')
        .eq('id', clinicId)
        .limit(1)
        .single();
      if (clinicRow?.workspace_id) {
        activeWorkspaceId = clinicRow.workspace_id;
      }
    }

    if (!clinicId && activeWorkspaceId) {
      const { data: firstClinic } = await supabaseAdmin
        .from('clinics')
        .select('id')
        .eq('workspace_id', activeWorkspaceId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      if (firstClinic?.id) {
        clinicId = firstClinic.id;
      }
    }

    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic found for reset' }, { status: 400 });
    }

    let result: { success: boolean; message: string } = { success: true, message: '' };

    switch (resetType) {
      case 'patients': {
        const { error } = await supabaseAdmin
          .from('patients')
          .delete()
          .eq('clinic_id', clinicId);
        if (error) throw error;
        result.message = 'Pacientes eliminados';
        break;
      }
      case 'treatments': {
        const { error } = await supabaseAdmin
          .from('treatments')
          .delete()
          .eq('clinic_id', clinicId);
        if (error) throw error;
        result.message = 'Tratamientos eliminados';
        break;
      }
      case 'expenses': {
        const { error } = await supabaseAdmin
          .from('expenses')
          .delete()
          .eq('clinic_id', clinicId);
        if (error) throw error;
        result.message = 'Gastos eliminados';
        break;
      }
      case 'services': {
        const { error } = await supabaseAdmin
          .from('services')
          .delete()
          .eq('clinic_id', clinicId);
        if (error) throw error;
        result.message = 'Servicios eliminados';
        break;
      }
      case 'supplies': {
        const { data: clinicServices, error: serviceLookupError } = await supabaseAdmin
          .from('services')
          .select('id')
          .eq('clinic_id', clinicId);
        if (serviceLookupError) throw serviceLookupError;

        let usedSupplies: any[] | null = null;
        if ((clinicServices?.length || 0) > 0) {
          const serviceIds = (clinicServices || []).map(service => service.id);
          const { data: ssRows, error: recipeError } = await supabaseAdmin
            .from('service_supplies')
            .select('supply_id')
            .in('service_id', serviceIds)
            .limit(1);
          if (recipeError) throw recipeError;
          usedSupplies = ssRows || [];
        } else {
          usedSupplies = [];
        }

        if (usedSupplies && usedSupplies.length > 0) {
          return NextResponse.json(
            { error: 'No se pueden eliminar insumos que están en uso. Elimina primero los servicios.' },
            { status: 400 }
          );
        }

        const { error } = await supabaseAdmin
          .from('supplies')
          .delete()
          .eq('clinic_id', clinicId);
        if (error) throw error;
        result.message = 'Insumos eliminados';
        break;
      }
      case 'fixed_costs': {
        const { error } = await supabaseAdmin
          .from('fixed_costs')
          .delete()
          .eq('clinic_id', clinicId);
        if (error) throw error;
        result.message = 'Costos fijos eliminados';
        break;
      }
      case 'assets': {
        const { error } = await supabaseAdmin
          .from('assets')
          .delete()
          .eq('clinic_id', clinicId);
        if (error) throw error;
        result.message = 'Activos eliminados';
        break;
      }
      case 'time_settings': {
        const { error } = await supabaseAdmin
          .from('settings_time')
          .upsert({
            clinic_id: clinicId,
            working_days_per_month: 20,
            hours_per_day: 8,
            real_hours_percentage: 80,
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
        result.message = 'Configuración de tiempo restablecida';
        break;
      }
      case 'custom_categories': {
        const { error: campaignsError } = await supabaseAdmin
          .from('marketing_campaigns')
          .delete()
          .eq('clinic_id', clinicId);
        if (campaignsError && campaignsError.code !== 'PGRST116') throw campaignsError;

        const { error } = await supabaseAdmin
          .from('categories')
          .delete()
          .eq('clinic_id', clinicId)
          .eq('is_system', false);
        if (error) throw error;
        result.message = 'Categorias personalizadas eliminadas';
        break;
      }
      case 'all_data': {
        if (!user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: userWorkspaces, error: workspaceQueryError } = await supabaseAdmin
          .from('workspaces')
          .select('id')
          .eq('owner_id', user.id);
        if (workspaceQueryError) throw workspaceQueryError;

        for (const ws of userWorkspaces ?? []) {
          if (ws?.id) {
            await deleteWorkspaceData(ws.id);
          }
        }

        const response = NextResponse.json({ success: true, message: 'Todos los datos eliminados exitosamente' });
        response.cookies.set('workspaceId', '', { path: '/', maxAge: 0 });
        response.cookies.set('clinicId', '', { path: '/', maxAge: 0 });
        return response;
      }
      default:
        return NextResponse.json({ error: 'Invalid reset type' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in reset:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && 'details' in error ? (error as any).details : null;
    return NextResponse.json(
      {
        error: 'Failed to reset data',
        message: errorMessage,
        details: errorDetails,
        ...(process.env.NODE_ENV === 'development' && {
          stack: error instanceof Error ? error.stack : null,
        }),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const searchParams = request.nextUrl.searchParams;
    const clinicId = searchParams.get('clinicId') || cookieStore.get('clinicId')?.value || undefined;

    if (!clinicId) {
      return NextResponse.json({ error: 'No clinic selected' }, { status: 400 });
    }

    const [
      { count: servicesCount },
      { count: suppliesCount },
      { count: fixedCostsCount },
      { count: assetsCount },
      { data: timeSettings },
      { count: customCategoriesCount },
    ] = await Promise.all([
      supabaseAdmin.from('services').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabaseAdmin.from('supplies').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabaseAdmin.from('fixed_costs').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabaseAdmin.from('assets').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabaseAdmin.from('settings_time').select('*').eq('clinic_id', clinicId).single(),
      supabaseAdmin.from('categories').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('is_system', false),
    ]);

    return NextResponse.json({
      services: servicesCount || 0,
      supplies: suppliesCount || 0,
      fixedCosts: fixedCostsCount || 0,
      assets: assetsCount || 0,
      timeConfigured: !!timeSettings,
      customCategories: customCategoriesCount || 0,
      hasData: (servicesCount || 0) + (suppliesCount || 0) + (fixedCostsCount || 0) + (assetsCount || 0) > 0,
    });
  } catch (error) {
    console.error('Error checking status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}

