import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';

// POST /api/reset - Limpiar datos según el tipo
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    // Create SSR client bound to cookies to identify current user
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    const workspaceId = cookieStore.get('workspaceId')?.value;
    
    // Si no hay workspace en cookies, buscar cualquier workspace activo
    let activeWorkspaceId = workspaceId;
    let clinicId: string | null = null;
    
    if (!activeWorkspaceId) {
      const { data: workspaces } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .limit(1)
        .single();
      
      if (workspaces) {
        activeWorkspaceId = workspaces.id;
      }
    }
    
    // Obtener la primera clínica del workspace
    if (activeWorkspaceId) {
      const { data: clinic } = await supabaseAdmin
        .from('clinics')
        .select('id')
        .eq('workspace_id', activeWorkspaceId)
        .limit(1)
        .single();
      
      if (clinic) {
        clinicId = clinic.id;
      }
    }
    
    if (!clinicId && !activeWorkspaceId) {
      return NextResponse.json(
        { error: 'No workspace or clinic found' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { resetType } = body;

    if (!resetType) {
      return NextResponse.json(
        { error: 'Reset type is required' },
        { status: 400 }
      );
    }

    let result = { success: true, message: '' };

    switch (resetType) {
      case 'services':
        // Eliminar servicios (las recetas se eliminan por CASCADE)
        const { error: servicesError } = await supabaseAdmin
          .from('services')
          .delete()
          .eq('clinic_id', clinicId);
        
        if (servicesError) throw servicesError;
        result.message = 'Servicios eliminados';
        break;

      case 'supplies':
        // Primero verificar si hay insumos en uso
        const { data: usedSupplies } = await supabaseAdmin
          .from('service_supplies')
          .select('supply_id')
          .eq('clinic_id', clinicId)
          .limit(1);

        if (usedSupplies && usedSupplies.length > 0) {
          return NextResponse.json(
            { error: 'No se pueden eliminar insumos que están en uso. Elimina primero los servicios.' },
            { status: 400 }
          );
        }

        const { error: suppliesError } = await supabaseAdmin
          .from('supplies')
          .delete()
          .eq('clinic_id', clinicId);
        
        if (suppliesError) throw suppliesError;
        result.message = 'Insumos eliminados';
        break;

      case 'fixed_costs':
        const { error: fixedCostsError } = await supabaseAdmin
          .from('fixed_costs')
          .delete()
          .eq('clinic_id', clinicId);
        
        if (fixedCostsError) throw fixedCostsError;
        result.message = 'Costos fijos eliminados';
        break;

      case 'assets':
        const { error: assetsError } = await supabaseAdmin
          .from('assets')
          .delete()
          .eq('clinic_id', clinicId);
        
        if (assetsError) throw assetsError;
        result.message = 'Activos eliminados';
        break;

      case 'time_settings':
        // Restablecer a valores por defecto
        const { error: timeError } = await supabaseAdmin
          .from('settings_time')
          .upsert({
            clinic_id: clinicId,
            working_days_per_month: 20,
            hours_per_day: 8,
            real_hours_percentage: 80,
            updated_at: new Date().toISOString()
          });
        
        if (timeError) throw timeError;
        result.message = 'Configuración de tiempo restablecida';
        break;

      case 'custom_categories':
        // Eliminar solo categorías personalizadas de la clínica
        const { error: categoriesError } = await supabaseAdmin
          .from('categories')
          .delete()
          .eq('clinic_id', clinicId)
          .eq('is_system', false);
        
        if (categoriesError) throw categoriesError;
        result.message = 'Categorías personalizadas eliminadas';
        break;

      case 'all_data': {
        // Eliminar TODO de TODOS los workspaces del usuario autenticado
        if (!user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Buscar todos los workspaces del propietario
        const { data: userWorkspaces, error: wsErr } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', user.id);

        if (wsErr) throw wsErr;

        const workspacesToDelete = userWorkspaces?.map(w => w.id) || [];

        for (const wsId of workspacesToDelete) {
          // Todas las clínicas del workspace
          const { data: allClinics, error: clErr } = await supabase
            .from('clinics')
            .select('id')
            .eq('workspace_id', wsId);
          if (clErr) throw clErr;

          const clinicIds = allClinics?.map(c => c.id) || [];

          if (clinicIds.length > 0) {
            // Borrar primero servicios (elimina service_supplies por cascade)
            const { error: e2 } = await supabase
              .from('services')
              .delete()
              .in('clinic_id', clinicIds);
            if (e2) throw e2;

            // Luego insumos
            const { error: e3 } = await supabase
              .from('supplies')
              .delete()
              .in('clinic_id', clinicIds);
            if (e3) throw e3;

            // Costos fijos
            const { error: e4 } = await supabase
              .from('fixed_costs')
              .delete()
              .in('clinic_id', clinicIds);
            if (e4) throw e4;

            // Activos
            const { error: e5 } = await supabase
              .from('assets')
              .delete()
              .in('clinic_id', clinicIds);
            if (e5) throw e5;

            // Configuración de tiempo
            const { error: e6 } = await supabase
              .from('settings_time')
              .delete()
              .in('clinic_id', clinicIds);
            if (e6) throw e6;
          }

          // 7. Eliminar clínicas del workspace
          const { error: clDelErr } = await supabase
            .from('clinics')
            .delete()
            .eq('workspace_id', wsId);
          if (clDelErr) throw clDelErr;

          // 8. Eliminar el workspace (workspace_members cae por cascade)
          const { error: wsDelErr } = await supabase
            .from('workspaces')
            .delete()
            .eq('id', wsId);
          if (wsDelErr) throw wsDelErr;
        }

        // Limpiar cookies de contexto en la respuesta
        const response = NextResponse.json({ success: true, message: 'Todos los datos eliminados exitosamente' });
        response.cookies.set('workspaceId', '', { path: '/', maxAge: 0 });
        response.cookies.set('clinicId', '', { path: '/', maxAge: 0 });
        return response;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid reset type' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in reset:', error);
    return NextResponse.json(
      { error: 'Failed to reset data', details: error },
      { status: 500 }
    );
  }
}

// GET /api/reset/status - Verificar qué datos existen
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const searchParams = request.nextUrl.searchParams;
    const clinicId = searchParams.get('clinicId') || cookieStore.get('clinicId')?.value || undefined as any;

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic selected' },
        { status: 400 }
      );
    }

    // Contar registros en cada tabla
    const [
      { count: servicesCount },
      { count: suppliesCount },
      { count: fixedCostsCount },
      { count: assetsCount },
      { data: timeSettings },
      { count: customCategoriesCount }
    ] = await Promise.all([
      supabaseAdmin.from('services').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabaseAdmin.from('supplies').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabaseAdmin.from('fixed_costs').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabaseAdmin.from('assets').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabaseAdmin.from('settings_time').select('*').eq('clinic_id', clinicId).single(),
      supabaseAdmin.from('categories').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('is_system', false)
    ]);

    return NextResponse.json({
      services: servicesCount || 0,
      supplies: suppliesCount || 0,
      fixedCosts: fixedCostsCount || 0,
      assets: assetsCount || 0,
      timeConfigured: !!timeSettings,
      customCategories: customCategoriesCount || 0,
      hasData: (servicesCount || 0) + (suppliesCount || 0) + (fixedCostsCount || 0) + (assetsCount || 0) > 0
    });
  } catch (error) {
    console.error('Error checking status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
