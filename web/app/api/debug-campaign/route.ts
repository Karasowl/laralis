import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { getClinicIdOrDefault } from '@/lib/clinic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== DEBUG: Campaign Creation ===');
    
    const body = await request.json();
    console.log('1. Request body:', JSON.stringify(body, null, 2));
    
    const cookieStore = cookies();
    const clinicId = body.clinic_id || await getClinicIdOrDefault(cookieStore);
    console.log('2. Clinic ID:', clinicId);

    if (!clinicId) {
      return NextResponse.json(
        { error: 'No clinic context available' },
        { status: 400 }
      );
    }

    // Verificar que el platform_id existe
    console.log('3. Checking if platform exists with ID:', body.platform_id);
    const { data: platformData, error: platformError } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('id', body.platform_id)
      .eq('entity_type', 'marketing_platform')
      .single();

    if (platformError) {
      console.error('Platform check error:', platformError);
      return NextResponse.json(
        { 
          error: 'Platform validation failed', 
          details: {
            message: platformError.message,
            platformId: body.platform_id,
            hint: 'Platform ID might not exist in categories table'
          }
        },
        { status: 400 }
      );
    }

    console.log('4. Platform found:', platformData);

    // Intentar crear la campaña
    const insertData = {
      clinic_id: clinicId,
      platform_category_id: body.platform_id,  // La columna correcta es platform_category_id
      name: body.name,
      code: body.code || null,
    };

    console.log('5. Insert data:', JSON.stringify(insertData, null, 2));

    const { data, error } = await supabaseAdmin
      .from('marketing_campaigns')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('6. Insert error:', error);
      return NextResponse.json(
        { 
          error: 'Failed to create marketing campaign', 
          details: {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          }
        },
        { status: 500 }
      );
    }

    console.log('7. Campaign created successfully:', data);
    return NextResponse.json({ data });
    
  } catch (error) {
    console.error('8. Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint para verificar plataformas disponibles
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const clinicId = await getClinicIdOrDefault(cookieStore);

    console.log('=== DEBUG: Get Platforms ===');
    console.log('Clinic ID:', clinicId);

    // Obtener todas las plataformas de marketing
    const { data: platforms, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('entity_type', 'marketing_platform')
      .order('display_order');

    if (error) {
      console.error('Error fetching platforms:', error);
      return NextResponse.json(
        { error: 'Failed to fetch platforms', details: error },
        { status: 500 }
      );
    }

    console.log('Platforms found:', platforms?.length);
    
    return NextResponse.json({ 
      platforms,
      clinicId,
      totalCount: platforms?.length || 0
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}