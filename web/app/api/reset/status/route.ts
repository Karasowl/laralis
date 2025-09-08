import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinicId')

    if (!clinicId) {
      return NextResponse.json(
        { error: 'clinic_id is required' },
        { status: 400 }
      )
    }

    // Count records in each table
    const [
      { count: servicesCount, error: servicesError },
      { count: suppliesCount, error: suppliesError },
      { count: fixedCostsCount, error: fixedCostsError },
      { count: assetsCount, error: assetsError },
      { data: timeSettings, error: timeError },
      { count: customCategoriesCount, error: categoriesError }
    ] = await Promise.all([
      supabase.from('services').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabase.from('supplies').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabase.from('fixed_costs').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      supabase.from('settings_time').select('*').eq('clinic_id', clinicId).single(),
      supabase.from('categories').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('is_system', false)
    ])

    // Check for errors (ignore timeError as settings might not exist)
    if (servicesError || suppliesError || fixedCostsError || assetsError || categoriesError) {
      console.error('Error checking status:', { 
        servicesError, 
        suppliesError, 
        fixedCostsError, 
        assetsError, 
        categoriesError 
      })
      return NextResponse.json(
        { error: 'Failed to check status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      services: servicesCount || 0,
      supplies: suppliesCount || 0,
      fixedCosts: fixedCostsCount || 0,
      assets: assetsCount || 0,
      timeConfigured: !!timeSettings && !timeError,
      customCategories: customCategoriesCount || 0,
      hasData: (servicesCount || 0) + (suppliesCount || 0) + (fixedCostsCount || 0) + (assetsCount || 0) > 0
    })

  } catch (error) {
    console.error('Error checking status:', error)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}