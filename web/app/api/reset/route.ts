import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// POST /api/reset - Limpiar datos según el tipo
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
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

      case 'all_data':
        // Eliminar TODO incluyendo workspaces y clínicas
        
        // Usar el workspace_id que ya tenemos
        const workspaceToDelete = activeWorkspaceId;
        
        if (workspaceToDelete) {
          // Obtener todas las clínicas del workspace
          const { data: allClinics } = await supabaseAdmin
            .from('clinics')
            .select('id')
            .eq('workspace_id', workspaceToDelete);
          
          const clinicIds = allClinics?.map(c => c.id) || [];
          
          // Borrar datos de todas las clínicas
          if (clinicIds.length > 0) {
            // 1. Service supplies (relaciones)
            await supabaseAdmin
              .from('service_supplies')
              .delete()
              .in('clinic_id', clinicIds);

            // 2. Services
            await supabaseAdmin
              .from('services')
              .delete()
              .in('clinic_id', clinicIds);

            // 3. Supplies
            await supabaseAdmin
              .from('supplies')
              .delete()
              .in('clinic_id', clinicIds);

            // 4. Fixed costs
            await supabaseAdmin
              .from('fixed_costs')
              .delete()
              .in('clinic_id', clinicIds);

            // 5. Assets
            await supabaseAdmin
              .from('assets')
              .delete()
              .in('clinic_id', clinicIds);

            // 6. Settings time
            await supabaseAdmin
              .from('settings_time')
              .delete()
              .in('clinic_id', clinicIds);
          }
        }

        // 7. Eliminar todas las clínicas del workspace
        if (workspaceToDelete) {
          await supabaseAdmin
            .from('clinics')
            .delete()
            .eq('workspace_id', workspaceToDelete);
          
          // 8. Eliminar el workspace
          await supabaseAdmin
            .from('workspaces')
            .delete()
            .eq('id', workspaceToDelete);
        }

        result.message = 'Todos los datos eliminados exitosamente';
        break;

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
    const clinicId = cookieStore.get('clinicId')?.value;

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