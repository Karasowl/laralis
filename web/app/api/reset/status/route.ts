import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { resolveClinicContext } from '@/lib/clinic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const cookieStore = cookies();
    const ctx = await resolveClinicContext({ requestedClinicId: searchParams.get('clinicId'), cookieStore });
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status });
    }
    const { clinicId } = ctx;

    const [
      { count: servicesCount, error: servicesError },
      { count: suppliesCount, error: suppliesError },
      { count: fixedCostsCount, error: fixedCostsError },
      { count: assetsCount, error: assetsError },
      { data: timeSettings, error: timeError },
      { count: customCategoriesCount, error: categoriesError },
    ] = await Promise.all([
      supabase.from('services').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabase.from('supplies').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabase.from('fixed_costs').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabase.from('settings_time').select('*').eq('clinic_id', clinicId).single(),
      supabase.from('categories').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('is_system', false),
    ]);

    if (servicesError || suppliesError || fixedCostsError || assetsError || categoriesError) {
      console.error('Error checking status', {
        servicesError,
        suppliesError,
        fixedCostsError,
        assetsError,
        categoriesError,
      });
      return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
    }

    return NextResponse.json({
      services: servicesCount || 0,
      supplies: suppliesCount || 0,
      fixedCosts: fixedCostsCount || 0,
      assets: assetsCount || 0,
      timeConfigured: !!timeSettings && !timeError,
      customCategories: customCategoriesCount || 0,
      hasData: (servicesCount || 0) + (suppliesCount || 0) + (fixedCostsCount || 0) + (assetsCount || 0) > 0,
    });
  } catch (error) {
    console.error('Error checking status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}

