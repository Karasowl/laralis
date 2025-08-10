import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/reset - Limpiar datos según el tipo
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const clinicId = cookieStore.get('clinicId')?.value;

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic selected' },
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
        // Eliminar todo en orden para evitar conflictos de FK
        
        // 1. Service supplies (relaciones)
        await supabaseAdmin
          .from('service_supplies')
          .delete()
          .eq('clinic_id', clinicId);

        // 2. Services
        await supabaseAdmin
          .from('services')
          .delete()
          .eq('clinic_id', clinicId);

        // 3. Supplies
        await supabaseAdmin
          .from('supplies')
          .delete()
          .eq('clinic_id', clinicId);

        // 4. Fixed costs
        await supabaseAdmin
          .from('fixed_costs')
          .delete()
          .eq('clinic_id', clinicId);

        // 5. Assets
        await supabaseAdmin
          .from('assets')
          .delete()
          .eq('clinic_id', clinicId);

        // 6. Custom categories
        await supabaseAdmin
          .from('categories')
          .delete()
          .eq('clinic_id', clinicId)
          .eq('is_system', false);

        // 7. Reset time settings
        await supabaseAdmin
          .from('settings_time')
          .upsert({
            clinic_id: clinicId,
            working_days_per_month: 20,
            hours_per_day: 8,
            real_hours_percentage: 80,
            updated_at: new Date().toISOString()
          });

        result.message = 'Todos los datos eliminados';
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